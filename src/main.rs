#![feature(fn_traits)]
use log::info;
use pretty_env_logger;
use serde::{Deserialize, Serialize};
use warp::reply::{Reply, Json};
use std::ops::{Deref, DerefMut};
use std::sync::Arc;
use tokio;
use tokio::sync::Mutex;
use warp;
use warp::Filter;
use web_push::{self, SubscriptionInfo};
use replitdb::AsyncClient;
use async_trait::async_trait;
use serde_json;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    
    std::env::set_var("RUST_LOG", "info");
    pretty_env_logger::init();
    let log = warp::log("Test");
    #[cfg(dev="true")]
    let cache = Cache(NotificationCache {
        cache: Arc::new(Mutex::new(Vec::new())),
    });
    #[cfg(not(dev="true"))]
    let cache=Cache(Arc::new(AsyncClient::new()));
    let with_cache = warp::any().map(move || cache.clone());
    
    let notification = warp::path!("service-worker.js").map(|| {
        warp::http::Response::builder()
            .header("Content-Type", "text/javascript")
            .body(include_str!("notifications.js"))
    });

    let js = warp::fs::file("static/index.js");

    let register_notification = warp::post()
        .and(warp::path("save-subscription"))
        .and(warp::body::json())
        .and(with_cache.clone()).then(insert_data)
        .with(log);
        
    let css = warp::fs::file("static/index.css");
    //extracting the cache into private server witch is protected with bcrypt key beause this server wont run allways
    let drain_cache = warp::path!("get-cache")
        .and(warp::body::json())
        .and_then(verify_key)
        .and(with_cache.clone())
        .then(get_all_data);
    let routes = js
        .or(drain_cache)
        .or(notification)
        .or(register_notification)
        .or(css);

    let index =
        warp::path::end().map(|| warp::http::Response::builder().body(include_str!("index.html")));
    info!(target:"Server","{}","starting server");
    warp::serve(warp::any().and(routes.or(index)))
        .run(([127, 0, 0, 1], 8080))
        .await;
    Ok(())
}

#[derive(Serialize, Deserialize)]
struct Key(String);
type NotificationInfos = Vec<web_push::SubscriptionInfo>;
#[derive(Clone)]
struct NotificationCache {
    cache: Arc<Mutex<Vec<web_push::SubscriptionInfo>>>,
}
#[async_trait]
trait DataManagement:Clone{
    async fn insert(&mut self,notificationinfo:web_push::SubscriptionInfo);
    async fn get_all(&mut self)->NotificationInfos;
}

#[async_trait]
impl DataManagement for NotificationCache{
    async fn insert(&mut self,notificationinfo:web_push::SubscriptionInfo) {
        (*self.lock().await).push(notificationinfo);
    }
    async fn get_all(&mut self)->NotificationInfos{
        let mut vec = self.lock().await;
            let res:Vec<SubscriptionInfo>=vec.drain(..).collect();
            NotificationInfos::from_iter(res)
    }
}
impl Deref for NotificationCache {
    type Target = Mutex<Vec<web_push::SubscriptionInfo>>;
    fn deref(&self) -> &Self::Target {
        &self.cache
    }
}
#[async_trait]
impl DataManagement for Arc<AsyncClient>{
    async fn insert(&mut self, notificationinfo:web_push::SubscriptionInfo){
        let mut vec=match self.get("json").await.ok().flatten(){
            Some(json)=>{
                serde_json::from_str(&json).expect("Database got corupted oopsie")
            },
            None=>Vec::new(),
        };
        vec.push(notificationinfo);
        self.set("json", serde_json::to_string(&vec).unwrap()).await;
    }
    async fn get_all(&mut self)->NotificationInfos{
        match self.get("json").await.ok().flatten(){
            Some(json)=>{
                self.delete("json").await;
                serde_json::from_str(&json).expect("Database got corupted oopsie")
            }
            None=>{
                Vec::new()
            }
        }
    }
}
async fn verify_key(key: Key) -> Result<(), warp::Rejection> {
    match bcrypt::verify(
        key.0.as_str(),
        "$2b$15$YLO.7h7/7sptkX8fZ.0z5uxD0b3mxuv.cqFHoeJRCZcm4x0F8ViLe",
    )
    .map_err(|_| warp::reject())?
    {
        true => Ok(()),
        false => Err(warp::reject()),
    }
}
#[derive(Clone)]
struct Cache<T:DataManagement+ Clone>(T);
impl<T:DataManagement> Deref for Cache<T>{
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl<T:DataManagement> DerefMut for Cache<T>{
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

async fn insert_data<T:DataManagement>(notificationinfo:SubscriptionInfo,mut cache:Cache<T>)->impl Reply{
    cache.insert(notificationinfo).await;
    warp::reply()
}
async fn get_all_data<T:DataManagement>(_:(),mut cache:Cache<T>)->Json{
    warp::reply::json(&cache.get_all().await)
}