
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
    console.log('content_script.js got message:', event);
    switch (event.data.type) {
    case 'tags_updated':
        // pull tags info from message and post to local storage
        chrome.storage.local.set({'tags': event.data.text}, function() {
            console.log("tags set to " + event.data.text);
        });
        break;
    case 'nodes_updated':
        // pull tags info from message and post to local storage
        chrome.storage.local.set({'nodes': event.data.text}, function() {
            console.log("nodes set to " + event.data.text);
        });
        // and let extension know bt window is set
        chrome.runtime.sendMessage({
            from: 'btwindow',
            msg: 'ready',
        });
        break;
    }
});

chrome.runtime.onMessage.addListener((msg, sender, response) => {
    // Handle messages from extension

    switch (msg.type) {
    case 'new_tab':             // new tab to be added to BT
        chrome.storage.local.get('tabsList', function (data) {
            var tab = data.tabsList[0];
            console.log("adding " + tab.title + " w tag [" + msg.tag + "]");
            window.postMessage({type: 'new_tab', tag: msg.tag, tab: tab});
        });
        response("cheers mate");
    }
});
                      
