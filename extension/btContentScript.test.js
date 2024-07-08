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
*    A version of the content script to drive a set of extensions<->app message handling tests
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
        // stores topics, preferences, current tabs topic/note info etc for popup/extensions use
        try {
            await setToLocalStorage(event.data.data);
        }
        catch (e) {
            const err = chrome.runtime.lastError.message || e;
            console.warn("Error saving to storage:", err, "\nContact BrainTool support");
        }
    }
    else if (event.data.function == 'sendTestMessages') {
        // call sendMessages with name of message set
        sendTestMessages(event.data.messageSet);
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
                msg["from"] = "btextension";
                window.postMessage(msg);
                chrome.storage.local.remove('bookmarks');             // clean up space
            });
        break;
        case 'launchApp':           // set up btfiletext before passing on to app, see below
        launchAppTests(msg);
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

// Code for testing functions below

const BTFileText = 
`* BrainTool
** TG1
*** [[https://braintool.org/overview.html][Overview Page]]
*** [[https://braintool.org/posts][posts Page]]
*** [[https://braintool.org/support.html][Support Page]]
*** [[https://braintool.org/support/releaseNotes.html][Release Notes]]
** TG2
*** [[https://reddit.com][Reddit]]
*** [[https://news.ycombinator.com][Hacker News]]
*** [[https://slashdot.org][Slashdot]]
** TG3
*** [[https://www.bbc.com/news][BBC News]]
*** [[https://www.theregister.com][The Register]]
*** [[https://www.theguardian.com/us][The Guardian]]
`;
const messageSets = 
{'openTab' : [
    {"function":"tabOpened","nodeId":3,"tabIndex":3,"tabId":1,"windowId":1,"tabGroupId":0,"from":"btextension"},
    {"function":"tabActivated","tabId":1,"windowId":1,"groupId":-1,"from":"btextension"},
    {"function":"tabNavigated","tabId":1,"groupId":-1,"tabURL":"https://braintool.org/overview.html","windowId":1,"from":"btextension"},
    {"function":"tabJoinedTG","tgId":1,"tabId":1,"tabIndex":3,"from":"btextension"},
    {"function":"tabGroupCreated","tabGroupId":1,"tabGroupColor":"blue","from":"btextension"},
    {"function":"tabGroupUpdated","tabGroupId":1,"tabGroupColor":"blue","tabGroupName":"TG1","tabGroupCollapsed":false,"from":"btextension"},
],
'openTG' : [
    {"function":"tabOpened","nodeId":4,"tabIndex":4,"tabId":2,"windowId":1,"tabGroupId":1,"from":"btextension"},
    {"function":"tabOpened","nodeId":5,"tabIndex":5,"tabId":3,"windowId":1,"tabGroupId":1,"from":"btextension"}, 
    {"function":"tabActivated","tabId":2,"windowId":1,"groupId":1,"from":"btextension"},
    {"function":"tabActivated","tabId":3,"windowId":1,"groupId":1,"from":"btextension"},
    {"function":"tabNavigated","tabId":2,"groupId":1,"tabURL":"https://braintool.org/posts","windowId":1,"from":"btextension"},
    {"function":"tabNavigated","tabId":3,"groupId":1,"tabURL":"https://braintool.org/support.html","windowId":1,"from":"btextension"},
    {"function":"tabPositioned","tabId":2,"nodeId":3,"tabGroupId":1,"windowId":1,"tabIndex":3,"from":"btextension"},
    {"function":"tabPositioned","tabId":2,"nodeId":4,"tabGroupId":1,"windowId":1,"tabIndex":4,"from":"btextension"},
    {"function":"tabPositioned","tabId":3,"nodeId":5,"tabGroupId":1,"windowId":1,"tabIndex":5,"from":"btextension"},
    {"function":"tabGroupUpdated","tabGroupId":1,"tabGroupColor":"blue","tabGroupName":"TG1","tabGroupCollapsed":false,"from":"btextension"},
],
'dragTabIntoTG' : [
    {"function":"tabMoved","tabId":4,"groupId":1,"tabIndex":4,"windowId":1,"tabIndices":{"1465379101":{"index":0,"windowId":1},"1465379250":{"index":0,"windowId":1},"1":{"index":1,"windowId":1},"2":{"index":2,"windowId":1},"3":{"index":3,"windowId":1},"4":{"index":4,"windowId":1}},"tab":{"active":true,"audible":false,"autoDiscardable":true,"discarded":false,"favIconUrl":"https://braintool.org/favicon.ico?","groupId":1,"height":563,"highlighted":true,"id":4,"incognito":false,"index":4,"mutedInfo":{"muted":false},"openerTabId":1465379253,"pinned":false,"selected":true,"status":"complete","title":"BrainTool User Guide | BrainTool - Beyond Bookmarks","url":"https://braintool.org/support/userGuide.html","width":914,"windowId":1},"from":"btextension"},
    {"function":"tabMoved","tabId":4,"groupId":1,"tabIndex":3,"windowId":1,"tabIndices":{"1465379101":{"index":0,"windowId":1},"1465379250":{"index":0,"windowId":1},"1":{"index":1,"windowId":1},"2":{"index":2,"windowId":1},"3":{"index":4,"windowId":1},"4":{"index":3,"windowId":1}},"tab":{"active":true,"audible":false,"autoDiscardable":true,"discarded":false,"favIconUrl":"https://braintool.org/favicon.ico?","groupId":1,"height":563,"highlighted":true,"id":4,"incognito":false,"index":3,"mutedInfo":{"muted":false},"openerTabId":1465379253,"pinned":false,"selected":true,"status":"complete","title":"BrainTool User Guide | BrainTool - Beyond Bookmarks","url":"https://braintool.org/support/userGuide.html","width":914,"windowId":1},"from":"btextension"}
],
'navigateTabIntoTG' : [
    {"function":"tabNavigated","tabId":5,"groupId":-1,"tabURL":"https://braintool.org/support/releaseNotes.html","windowId":1,"from":"btextension"},
    {"function":"tabPositioned","tabId":2,"nodeId":3,"tabGroupId":1,"windowId":1,"tabIndex":1,"from":"btextension"},
    {"function":"tabPositioned","tabId":3,"nodeId":4,"tabGroupId":1,"windowId":1,"tabIndex":2,"from":"btextension"},
    {"function":"tabPositioned","tabId":5,"nodeId":6,"tabGroupId":1,"windowId":1,"tabIndex":3,"from":"btextension"},
    {"function":"tabGroupUpdated","tabGroupId":1,"tabGroupColor":"grey","tabGroupName":"TG1","tabGroupCollapsed":false,"from":"btextension"},
],
'storeTab' : [
    {"function":"saveTabs","topic":"new topic","note":"","close":"GROUP","type":"Tab","tabs":
    [{"url":"https://logseq.com/","windowId":1,"title":"Logseq: A privacy-first, open-source knowledge base","tabId":10,"tabIndex":1,"faviconUrl":"https://asset.logseq.com/static/img/logo.png"}],"from":"btextension"},
],
'storeTabs' : [
    {"function":"saveTabs","topic":"3 tabs","note":"","type":"TG","tabs":
    [{"url":"chrome://extensions/","windowId":1,"title":"Extensions","tabId":1,"tabIndex":0,"faviconUrl":""},
    {"url":"https://logseq.com/downloads","windowId":1,"title":"Logseq: A privacy-first, open-source knowledge base","tabId":2,"tabIndex":1,"faviconUrl":"https://asset.logseq.com/static/img/logo.png"},
    {"url":"https://blog.logseq.com/","windowId":1,"title":"Logseq Blog","tabId":3,"tabIndex":2,"faviconUrl":"https://blog.logseq.com/content/images/size/w256h256/2022/04/logseq-favicon.png"}],"from":"btextension"},
],
'storeWindow' : [
    {"function":"saveTabs","topic":"BTWindow","note":"","type":"Window","windowId":1,"tabs":
    [{"url":"https://braintool.org/support/releaseNotes","title":"BrainTool Release Notes | BrainTool - Beyond Bookmarks","tabId":14,"tabIndex":0,"faviconUrl":"https://braintool.org/favicon.ico?"},
    {"url":"https://braintool.org/support/userGuide.html","title":"BrainTool User Guide | BrainTool - Beyond Bookmarks","tabId":15,"tabIndex":1,"faviconUrl":"https://braintool.org/favicon.ico?"},
    {"url":"https://braintool.org/","title":"Go beyond Bookmarks with BrainTool, the online Topic Manager | BrainTool - Beyond Bookmarks","tabId":16,"tabIndex":2,"faviconUrl":"https://braintool.org/favicon.ico?"}],
    "from":"btextension"},
],
'storeSession' : [
    // data is of the form: {'function': 'saveTabs', 'saveType':Tab|TG|Window|Session, 'tabs': [], 'note': msg.note,  'close': msg.close}
    // tabs: [{'tabId': t.id, 'groupId': t.groupId, 'windowId': t.windowId, 'url': t.url, 'topic': topic, 'title': msg.title, favIconUrl: t.favIconUrl}]
    {"function":"saveTabs","note":"","type":"Session","tabs":
     [{"tabId":1465380078,"groupId":1197213122,"windowId":3,"tabIndex":0,"topic":"Session1:Window1","title":"Three-body problem - Wikipedia","pinned":false,"faviconUrl":"https://en.wikipedia.org/static/favicon/wikipedia.ico","url":"https://en.wikipedia.org/wiki/Three-body_problem"},
      {"tabId":1465380084,"groupId":1197213122,"windowId":3,"tabIndex":1,"topic":"Session1:Window1","title":"Coriolis force - Wikipedia","pinned":false,"faviconUrl":"https://en.wikipedia.org/static/favicon/wikipedia.ico","url":"https://en.wikipedia.org/wiki/Coriolis_force"},
    {"tabId":1465380083,"groupId":1197213122,"windowId":3,"tabIndex":2,"topic":"Session1:Window1","title":"Lagrange point - Wikipedia","pinned":false,"faviconUrl":"https://en.wikipedia.org/static/favicon/wikipedia.ico","url":"https://en.wikipedia.org/wiki/Lagrange_point"},
    {"tabId":1465380086,"groupId":-1,"windowId":4,"tabIndex":0,"topic":"Session1:Window2","title":"amazon.com curved display - Google Search","pinned":false,"faviconUrl":"https://www.google.com/favicon.ico","url":"https://www.google.com/search?q=amazon.com+curved+display&oq=amazon.com+curved+display&aqs=chrome..69i57.9182j0j1&sourceid=chrome&ie=UTF-8"},
    {"tabId":1465380087,"groupId":-1,"windowId":4,"tabIndex":1,"topic":"Session1:Window2","title":"Amazon.com: Dell Curved Gaming, ","pinned":false,"faviconUrl":"https://www.amazon.com/favicon.ico", "url":"https://www.amazon.com/Dell-Curved-Monitor-Refresh-Display/dp/B095X7RV77/ref=asc_df_B095X7RV77"},
    {"tabId":1465380088,"groupId":-1,"windowId":4,"tabIndex":2,"topic":"Session1:Window2","title":"Our 5 Best Curved Monitor For Developers ","pinned":false, "faviconUrl":"https://images.top5-usa.com/image/fetch/c_scale,f_auto/https%3A%2F%2Fd1ttb1lnpo2lvz.cloudfront.net%2F10599b72%2Ffavicon.ico", "url":"https://www.top5-usa.com/curved-monitor-for-developers"},
    {"tabId":1465380089,"groupId":-1,"windowId":4,"tabIndex":3,"topic":"Session1:Window2","title":"Amazon.com: Viotek SUW49C 49-Inch Super Ultrawide ","pinned":false,"faviconUrl":"https://www.amazon.com/favicon.ico","url":"https://www.amazon.com/dp/B07L44N45F?tag=top5-usa-20&linkCode=osi&th=1"}]
}]
};

async function launchAppTests(msg) {
    // Launchapp msg comes from extension code w GDrive app IDs
    // inject test btfile data and then just pass on to app
    // also pull out subscription id if exists (=> premium)
    let BTId = await getFromLocalStorage('BTId');
    let Config = await getFromLocalStorage('Config');
    if (BTId)
    msg["bt_id"] = BTId;
    if (Config)
    msg["Config"] = Config;
    
    msg["from"] = "btextension";
    msg["BTFileText"] = BTFileText;
    window.postMessage(msg);
}

async function sendTestMessages(messageSet) {
    // Iterate through messages and send to content script
    // Called manually from dev tools on client console with name of message set from above
    if (!messageSets[messageSet]) {
        console.error(`Message set ${messageSet} not found`);
        return;
    }
    for (const msg of messageSets[messageSet]) {
        console.log(`Content-OUT ${msg.function} to Extension:`, msg);
        window.postMessage(msg);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}
