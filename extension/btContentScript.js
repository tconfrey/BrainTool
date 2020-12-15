/*
     This script is basically just a relay for messages between the app window and the extension.
     In general message are passed thru, sometimes we need to pull from local storage
*/

// Listen for messages from the App
window.addEventListener('message', function(event) {
    // Handle message from Window
    if (event.source != window)
        return;
    console.log(`Content-IN ${event.data.type} from bt.js:`, event);
    switch (event.data.type) {
    case 'tags_updated':
        // pull tags info from message and post to local storage. Popup reads from there.
        chrome.storage.local.set({'tags': event.data.text}, function() {
            console.log("tags set to " + event.data.text);
        });
        break;
    case 'nodes_updated':
        // pull node info from message and post to local storage
        chrome.storage.local.set({'nodes': event.data.text}, function() {
            console.log("nodes set");
        });
        // and let extension know bt window is set
        chrome.runtime.sendMessage({
            from: 'btwindow',
            type: 'nodes_ready',
        });
        console.count('Content-OUT:ready');
        break;
    default:
        // handle all other default type messages
        event.data["from"] = "btwindow";
        chrome.runtime.sendMessage(event.data);
    }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((msg, sender, response) => {
    // Handle messages from extension

    console.log(`Content-IN ${msg.type} from background.js:`, msg);
    switch (msg.type) {
    case 'bookmarks_imported':
        chrome.storage.local.get('bookmarks', data => {
            msg.data = data;
            window.postMessage(msg);
        });
        break;
    case 'keys':                // note that keys were received and fall thru to pass on
        WaitingForKeys = false;
    default:
        // handle all other default type messages
        window.postMessage(msg);
    }
});


// Let extension know bt window is ready to open gdrive app. Should only run once
var NotLoaded = true;
var WaitingForKeys = true;
if (!window.LOCALTEST && NotLoaded) {
    chrome.runtime.sendMessage({
        from: 'btwindow',
        type: 'window_ready',
    });
    NotLoaded = false;
    setTimeout(waitForKeys, 500);
    console.count('Content-OUT:window_ready');
}

function waitForKeys() {
    // Fail safe, if request to background script for keys failed we should try try again.
    if (!WaitingForKeys) return;                       // all good
    
    chrome.runtime.sendMessage({
        from: 'btwindow',
        type: 'window_ready',
    });
    console.count('Content-OUT:window_ready');
    setTimeout(waitForKeys, 1000);
}
