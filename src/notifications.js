// urlB64ToUint8Array is a magic function that will encode the base64 public key
// to Array buffer which is needed by the subscription option
const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

const saveSubscription = async (subscription) => {
    const SERVER_URL = '/save-subscription'
    console.log(SERVER_URL);
    const response = await fetch(SERVER_URL, {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
    })
    return response.json()
}

self.addEventListener('activate', async () => {
    // This will be called only once when the service worker is installed for first time.
    console.log("hello from service worker")
    try {
        const applicationServerKey = urlB64ToUint8Array(
            'BM2MyW26EuQSmKICtFkNqeLXhzgSIOoTKGtr5vb_c-LZZZcJ1l8TE38pgTNBMKnOPjvn8pJ0s3NlvqciB9Oqf2Y='
        )
        const options = { applicationServerKey, userVisibleOnly: true }
        const subscription = await self.registration.pushManager.subscribe(options)
        const response = await saveSubscription(subscription)
        console.log(response)
    } catch (err) {
        console.log('Error', err)
    }
})

self.addEventListener('push', function (event) {
    if (event.data) {
        console.log('Push event!! ', event.data.json())
        let data = event.data.json()
        showLocalNotification(data.title, data.options, self.registration)
    } else {
        console.log('Push event but no data')
    }
})

const showLocalNotification = (title, options, swRegistration) => {
    swRegistration.showNotification(title, options)
}
self.addEventListener('notificationclick', (event) => {
    const clickedNotification = event.notification;
    clickedNotification.close();
    let url = "https://www.nacka.se/valfard-skola/nacka-gymnasium/skolinfo/matsedel/#:~:text="
    var weekday = new Array(7);
    weekday[0] = "";
    weekday[1] = "M%C3%A5ndag";
    weekday[2] = "Tisdag";
    weekday[3] = "Onsdag";
    weekday[4] = "Torsdag";
    weekday[5] = "Fredag";
    weekday[6] = "";
    
    let day=new Date().getDay()
    console.log(day)
    console.log("day:"+weekday[day])
    const urlToOpen = new URL(url+weekday[day]).href;

    const promiseChain = clients
        .matchAll({
            type: 'window',
            includeUncontrolled: true,
        })
        .then((windowClients) => {
            let matchingClient = null;

            for (let i = 0; i < windowClients.length; i++) {
                const windowClient = windowClients[i];
                if (windowClient.url === urlToOpen) {
                    matchingClient = windowClient;
                    break;
                }
            }

            if (matchingClient) {
                return matchingClient.focus();
            } else {
                return clients.openWindow(urlToOpen);
            }
        });

    event.waitUntil(promiseChain);
    event.waitUntil(promiseChain);
});

