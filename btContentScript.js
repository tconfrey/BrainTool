
var tabsData;

function populateTabsList() {

    var tabsElement = document.getElementById('tabs');
    chrome.storage.local.get('tabsList', function (data) {
        tabsData = data.tabsList;
        var htmlText = "";
        for(var i=0, len=tabsData.length; i < len; i++){
            htmlText = htmlText + "<p>" + tabsData[i].title + "</p>";
            console.log(tabsData[i].title);
        }
        tabsElement.innerHTML = htmlText; 
    });
}

// Don't think I need to do this any more
//populateTabsList();

window.addEventListener('message', function(event) {
    // Handle message from Window
    if (event.source != window)
        return;
    console.log('content_script.js got message from Window:', event);
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
        break;
    case 'link_click':
        // propogate to background page to handle
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'link_click',
            nodeId: event.data.nodeId,
            url: event.data.url
        });
        break;
    case 'tag_open':
        // pass on to background
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'tag_open',
            parent: event.data.parent,
            data: event.data.data
        });
        break;
    case 'node_deleted':
        // pass on
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'node_deleted',
            nodeId: event.data.nodeId
        });
    }
    
});

chrome.runtime.onMessage.addListener((msg, sender, response) => {
    // Handle messages from extension

    console.log("Content script received msg from app:" + msg);
    switch (msg.type) {
    case 'keys':                // info about gdrive app
        window.postMessage({type: 'keys', 'client_id': msg.client_id, 'api_key': msg.api_key});
        response("cheers mate");
        break;
    case 'new_tab':             // new tab to be added to BT
        chrome.storage.local.get('tabsList', function (data) {
            var tab = data.tabsList[0];
            console.log("adding " + tab.title + " w tag [" + msg.tag + "]");
            window.postMessage({type: 'new_tab', tag: msg.tag, tab: tab});
        });
        response("cheers mate");
        break;
    case 'tab_opened':          // tab/window opened should indicate in tree
        window.postMessage({type: 'tab_opened', BTNodeId: msg.BTNodeId, BTParentId: msg.BTParentId});
        break;
    case 'tab_closed':          // tab closed, update model and display
        window.postMessage({type: 'tab_closed', BTNodeId: msg.BTNodeId});
        break;
    }
    
});
                      
debugger;


console.log("ContentScript loaded. Sending window_ready...");

// bt window is ready to open gdrive app
chrome.runtime.sendMessage({
    from: 'btwindow',
    msg: 'window_ready',
});
