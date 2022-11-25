/***
 *
 *    This script is basically just a relay for messages between the app window and the extension.
 *    In general message are passed thru, sometimes we need to pull from local storage
 *
***/


function getFromLocalStorage(key) {
    // Promisification of storage.local.get
    return new Promise(resolve => {
	    chrome.storage.local.get(key, function(item) {
	        resolve(item[key]);
	    });
    });
}


function setToLocalStorage(obj) {
    // Promisification of storage.local.set
    return new Promise(resolve => {
	    chrome.storage.local.set(obj, function() {
            if (chrome.runtime.lastError)
                alert(`Error saving to browser storage:\n${chrome.runtime.lastError.message}\nContact BrainTool support`);
	        resolve();
	    });
    });
}

// Listen for messages from the App
window.addEventListener('message', async function(event) {
    // Handle message from Window, NB ignore msgs relayed from this script in listener below
    if (event.source != window || event.data.from == "btextension")
        return;
    console.log(`Content-IN ${event.data.function} from TopicManager:`, event.data);
    if (event.data.function == 'localStore') {
        // stores tags, preferences, current tabs tag/note info etc for popup/extensions use
        try {
            await setToLocalStorage(event.data.data);
        }
        catch (e) {
            const err = chrome.runtime.lastError.message || e;
            console.warn("Error saving to storage:", err, "\nContact BrainTool support");
        }
    }
    else {
        // handle all other default type messages
        event.data["from"] = "btwindow";
        chrome.runtime.sendMessage(event.data);
    }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((msg, sender, response) => {
    // Handle messages from extension

    // NB workaround for bug in Chrome, see https://stackoverflow.com/questions/71520198/manifestv3-new-promise-error-the-message-port-closed-before-a-response-was-rece/71520415#71520415
    response();

    console.log(`Content-IN ${msg.function} from Extension:`, msg);
    switch (msg.function) {
    case 'loadBookmarks':
        chrome.storage.local.get('bookmarks', data => {
            msg.data = data;
            window.postMessage(msg);
        });
        chrome.storage.local.remove('bookmarks');             // clean up space
        break;
    case 'launchApp':           // set up btfiletext before passing on to app, see below
        launchApp(msg);
        break;
    default:
        // handle all other default type messages
        msg["from"] = "btextension";
        window.postMessage(msg);
    }
});


// Let extension know bt window is ready to open gdrive app. Should only run once
var NotLoaded = true;
if (!window.LOCALTEST && NotLoaded) {
    chrome.runtime.sendMessage({'from': 'btwindow', 'function': 'initializeExtension' });
    NotLoaded = false;
    //setTimeout(waitForKeys, 5000);
    console.count('Content-OUT:initializeExtension');
}


async function launchApp(msg) {
    // Launchapp msg comes from extension code w GDrive app IDs
    // inject btfile data into msg either from local storage or the initial .org on server
    // and then just pass on to app
    
    if (window.LOCALTEST) return;                          // running inside test harness

    let btdata = await getFromLocalStorage('BTFileText');
    if (!btdata) {
        let response = await fetch('/app/BrainTool.org');
        if (response.ok) {
            btdata = await response.text();
            chrome.storage.local.set({'BTFileText': btdata});
        } else {            
            alert('Error getting initial BT file');
            return;
        }
    }

    // also pull out subscription id if exists (=> premium)
    let BTId = await getFromLocalStorage('BTId');
    let Config = await getFromLocalStorage('Config');
    if (BTId)
	    msg["bt_id"] = BTId;
    if (Config)
	    msg["Config"] = Config;
    
    msg["from"] = "btextension";
    msg["BTFileText"] = btdata;
    window.postMessage(msg);
}
