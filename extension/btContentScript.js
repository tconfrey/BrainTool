/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



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
    // Handle message from Window, NB ignore msgs relayed from this script in listener below or fomr other windows
    if (event.data.from == "btextension") return;
    if (event.source != window && event.source.parent != window) return;

    console.log(`Content-IN ${event.data.function || event.data.type} from TopicManager@ ${event.origin} :`, event.data);
    if (event.data.function == 'localStore') {
        // stores topics, preferences, current tabs topic/note info etc for popup/extensions use
        try {
            await setToLocalStorage(event.data.data);
        }
        catch (e) {
            const err = chrome.runtime?.lastError?.message || e;
            console.warn("Error saving to storage:", err, "\nContact BrainTool support");
        }
        return;
    }
    
    /* 'Synchronous' calls */
    if (event.data.type == 'AWAIT') {
        try {
            event.data["from"] = "btwindow";
            const response = await callToBackground(event.data);
            // Send the response back to the web page
            sendMessage({from: "btextension", type: "AWAIT_RESPONSE", response: response});
        } catch (error) {
            console.error("Error sending message:", JSON.stringify(error));
        }
    }
    
    else {
        // handle all other default type messages
        event.data["from"] = "btwindow";
        chrome.runtime.sendMessage(event.data);
    }
});

// Function to send a message to the service worker and await a response
async function callToBackground(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

// sendMessage utility, communicates from contentScript to TM either in containing tab, or contained iframe (sidepanel)
function sendMessage(msg) { 
    console.log(`sending message to TopicManager:`, msg);
    const iframe = document.getElementById('BTTopicManager');       // frame to talk to
    const target = iframe ? iframe.contentWindow : window;
    target.postMessage(msg, '*');
}

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
            msg["from"] = "btextension";
            sendMessage(msg);
            chrome.storage.local.remove('bookmarks');             // clean up space
        });
        break;
    case 'launchApp':           // set up btfiletext etc before passing on to app, see below
        launchApp(msg);
        break;
    default:
        // handle all other default type messages
        msg["from"] = "btextension";
        sendMessage(msg);
    }
});

(async function () {
    // Let extension know bt window is ready. NB also sent, seperately, from sidepanel.js cos it needs to wait for iframe to load
    if (typeof SIDEPANEL === 'undefined')
        chrome.runtime.sendMessage({'from': 'btwindow', 'function': 'initializeExtension' });
})();


async function launchApp(msg) {
    // Launchapp msg comes from extension code w GDrive app IDs
    // inject btfile data into msg either from local storage or the initial .org on server
    // and then just pass on to app
    
    if (window.LOCALTEST) return;                          // running inside test harness
    console.log("launching App");
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
    if (BTId) msg["bt_id"] = BTId;
    if (Config) msg["Config"] = Config;
    msg["SidePanel"] = (typeof SIDEPANEL !== 'undefined');
    
    msg["from"] = "btextension";
    msg["BTFileText"] = btdata;
    sendMessage(msg);
}
