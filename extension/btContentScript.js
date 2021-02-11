/*
     This script is basically just a relay for messages between the app window and the extension.
     In general message are passed thru, sometimes we need to pull from local storage
*/

// Listen for messages from the App
window.addEventListener('message', function(event) {
    // Handle message from Window
    if (event.source != window || event.data.from == "btextension")
        return;
    console.log(`Content-IN ${event.data.function} from bt.js:`, event);
    switch (event.data.type) {
    case 'tags_updated':
        // pull tags info from message and post to local storage. Popup reads from there.
        chrome.storage.local.set({'tags': event.data.text});
        break;
    case 'grouping_mode_updated':
        // default grouping mode changed, save to storage
        chrome.storage.local.set({'GroupingMode': event.data.mode});
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

    console.log(`Content-IN ${msg.function} from background.js:`, msg);
    switch (msg.function) {
    case 'loadBookmarks':
        chrome.storage.local.get('bookmarks', data => {
            msg.data = data;
            window.postMessage(msg);
        });
        chrome.storage.local.remove('bookmarks');             // clean up space
        break;
    case 'keys':                // note that keys were received and fall thru to pass on
        WaitingForKeys = false;
        chrome.storage.local.get('permissions', perms => {
            // If we have bookmark permission enable export button, (import triggers request)
            let btn = document.getElementById("export_button");
            if (perms.permissions.includes('bookmarks'))               
                btn.disabled = false;
        });
    default:
        // handle all other default type messages
        msg["from"] = "btextension";
        window.postMessage(msg);
    }
});


// Let extension know bt window is ready to open gdrive app. Should only run once
var NotLoaded = true;
var WaitingForKeys = true;
if (!window.LOCALTEST && NotLoaded) {
    chrome.runtime.sendMessage({
        from: 'btwindow',
        function: 'initializeExtension',
    });
    NotLoaded = false;
    setTimeout(waitForKeys, 500);
    console.count('Content-OUT:initializeExtension');
}

function waitForKeys() {
    // Fail safe, if request to background script for keys failed we should try try again.
    if (!WaitingForKeys) return;                       // all good
    
    chrome.runtime.sendMessage({
        from: 'btwindow',
        function: 'initializeExtension',
    });
    console.count('Content-OUT:initializeExtension');
    setTimeout(waitForKeys, 1000);
}
