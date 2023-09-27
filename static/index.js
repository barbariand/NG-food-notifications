function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
function askForNotifications() {
    return new Promise(function (resolve, reject) {
        const permissionResult = Notification.requestPermission(function (result) {
            resolve(result);
        });

        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    }).then(function (permissionResult) {
        if (permissionResult !== 'granted') {
            throw new Error("We weren't granted permission.");
        }
    });

}
let hastried = false;
async function subscribeUserToPush() {
    let reg = await navigator.serviceWorker.getRegistrations();
    console.log(reg);
    if (reg.length > 0) {
        if (!hastried) {
            let button = document.getElementById("button");
            button.innerText = "Redan registrerad, men klicka på du"
            button.dataset.value = "Redan registrerad, men klicka på du"
            doFun(button)
            hastried = true
        }
    }
    askForNotifications().then(async () => {
        await navigator.serviceWorker
            .register('/service-worker.js');
    })
    let button = document.getElementById("button");
    button.innerText = "du är nu registrerad, men klicka på du"
    button.dataset.value = "du är nu registrerad, men klicka på du"
}

// animation code from Hyperplexed
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let interval = null;

document.querySelector("button").onmouseover = event => {
    doFun(event.target)
}
function doFun(target) {
    let iteration = 0;

    clearInterval(interval);

    interval = setInterval(() => {
        target.innerText = target.innerText
            .split("")
            .map((letter, index) => {
                if (index < iteration) {
                    return target.dataset.value[index];
                }

                return letters[Math.floor(Math.random() * 26)]
            })
            .join("");

        if (iteration >= target.dataset.value.length) {
            clearInterval(interval);
        }

        iteration += 2 / 3;
    }, 30);
}