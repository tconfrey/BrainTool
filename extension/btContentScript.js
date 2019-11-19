// This script is basically just a relay for messages between the app window and the extension.

// Listen for messages from the App
window.addEventListener('message', function(event) {
    // Handle message from Window
    if (event.source != window)
        return;
    console.log('content_script.js got message from Window:', event);
    console.count("Content-IN:"+event.data.type);
    switch (event.data.type) {
    case 'tags_updated':
        // pull tags info from message and post to local storage
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
            msg: 'ready',
        });
        console.count('Content-OUT:ready');
        break;
    case 'link_click':
        // propogate to background page to handle
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'link_click',
            nodeId: event.data.nodeId,
            url: event.data.url
        });
        console.count('Content-OUT:link_click');
        break;
    case 'tag_open':
        // pass on to background
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'tag_open',
            parent: event.data.parent,
            data: event.data.data
        });
        console.count('Content-OUT:tag_open');
        break;
    case 'node_deleted':
        // pass on
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'node_deleted',
            nodeId: event.data.nodeId
        });
        console.count('Content-OUT:node_deleted');
        break;
    case 'show_node':
        // pass on
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'show_node',
            nodeId: event.data.nodeId
        });
        console.count('Content-OUT:node_deleted');
        break;
    case 'LOCALTEST':
        // pass on
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'LOCALTEST',
        });
    }
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((msg, sender, response) => {
    // Handle messages from extension

    console.log("Content script received msg from app:" + msg);
    console.count("Content-IN:"+msg.type);
    switch (msg.type) {
    case 'keys':                // info about gdrive app
        window.postMessage({type: 'keys', 'client_id': msg.client_id, 'api_key': msg.api_key});
        response("cheers mate");
        console.count('Content-OUT:keys');
        break;
    case 'new_tab':             // new tab to be added to BT
        chrome.storage.local.get('tabsList', function (data) {
            var tab = data.tabsList[0];
            console.log("adding " + tab.title + " w tag [" + msg.tag + "]");
            window.postMessage({type: 'new_tab', tag: msg.tag, tab: tab});
            console.count('Content-OUT:new_tab');
        });
        response("cheers mate");
        break;
    case 'tab_opened':          // tab/window opened should indicate in tree
        window.postMessage({type: 'tab_opened', BTNodeId: msg.BTNodeId, BTParentId: msg.BTParentId});
        console.count('Content-OUT:tab_open');
        break;
    case 'tab_closed':          // tab closed, update model and display
        window.postMessage({type: 'tab_closed', BTNodeId: msg.BTNodeId});
        console.count('Content-OUT:tab_closed');
        break;
    }
});


// Let extension know bt window is ready to open gdrive app
if (!window.LOCALTEST) {
    chrome.runtime.sendMessage({
        from: 'btwindow',
        msg: 'window_ready',
    });
    console.count('Content-OUT:window_ready');
}
