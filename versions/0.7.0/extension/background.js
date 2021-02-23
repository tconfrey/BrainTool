/***
 *
 *  Main entry point for all window and tab manipulation. Listens for messages from app 
 *  (relayed by content script) and dispatches to handler. Also listens for updates from
 *  browser (tabs opened etc) and relays back to app for processing.
 *
 ***/

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var BTTab = 0;
var BTWin = 0;
var AllNodes = [];              // array of BTNodes
var LocalTest = false;          // control code path during unit testing

function check() {
    // check for error
    if (chrome.runtime.lastError) {
        console.warn("!!Whoops, runtime error.. " + chrome.runtime.lastError.message);
    }
}

/***
 *
 *  Message handling. Handlers dispatched based on msg.function
 *  NB need explicit mapping, evaluating from string is blocked for security reasons
 *
 ***/
const Handlers = {
    "initializeExtension": initializeExtension,
    "openTab": openTab,
    "openInWindow": openInWindow,
    "openInTabGroup": openInTabGroup,
    "moveToWindow": moveToWindow,
    "moveToTabGroup": moveToTabGroup,
    "showNode": showNode,
    "brainZoom": brainZoom,
    "positionTab": positionTab,
    "closeTab": closeTab,
    "ungroupAll": ungroupAll,
    "groupAll": groupAll,
    "windowAll": windowAll,
    "exportBookmarks": exportBookmarks
};

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.from != 'btwindow' && msg.from != 'popup') return;
    
    console.log(`BTChromeNode received: [${msg.function}]: ${JSON.stringify(msg)}`);
    if (Handlers[msg.function]) {
        console.log("BTChromeNode dispatching to ", Handlers[msg.function].name);
        Handlers[msg.function](msg, sender);
        return;
    }
    if (msg.function == 'getBookmarks') {
        // request bookmark permission prior to bookmark operations
        // NB not using the dispatch cos that looses that its user triggered and Chrome prevents

        if (LocalTest) {
            getBookmarks(); return;
        }
        chrome.permissions.request(
            {permissions: ['bookmarks']}, granted => {
                if (granted) {
                    chrome.permissions.getAll(
                        rsp => chrome.storage.local.set({'permissions' : rsp.permissions}));
                    getBookmarks();
                } else {
                    // send back denial 
                    chrome.tabs.sendMessage(BTTab, {'function': 'loadBookmarks',
                                                    'result': 'denied'});
                }
            });
    }
    if (msg.type == 'LOCALTEST') {
        // Running under test so there is no external BT top level window
        chrome.tabs.query({'url' : '*://localhost/test*'}, tabs => {
            check();
            BTTab = tabs[0].id;
            console.log("Setting test mode w BTTab = " + BTTab);
            LocalTest = true;
        });
    }
});


/***
 *
 *  Event handling for browser events of interest
 *
 ***/

chrome.tabs.onRemoved.addListener((tabId, otherInfo) => {
    // listen for tabs being closed, if its a managed tab let BT know
    if (!tabId || !BTTab) return;         // 
    chrome.tabs.sendMessage(BTTab, {'function': 'tabClosed', 'tabId': tabId});
    if (tabId == BTTab) BTTab = null;
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // listen for tabs navigating to and from BT URLs
    if (!tabId || !BTTab) return;         // 
    if (changeInfo.status == 'complete') {
        chrome.tabs.sendMessage(
            BTTab, {'function': 'tabUpdated', 'tabId': tabId,
                    'tabURL': tab.url, 'windowId': tab.windowId});
        setTimeout(function() {setBadge(tabId);}, 200);
    }
});

chrome.tabs.onActivated.addListener((info) => {
    // Let app know there's a new top tab
    if (!info.tabId || !BTTab) return;         // 
    chrome.tabs.sendMessage(BTTab, {'function': 'tabActivated', 'tabId': info.tabId});
    setTimeout(function() {setBadge(info.tabId);}, 200);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    // Let app know there's a new top tab

    // don't care about special windows like dev tools or the BT win
    if (!BTTab || windowId <= 0 || windowId == BTWin) return;              
    chrome.tabs.query({'active': true, 'windowId': windowId},tabs => {
        check();
        if (!tabs.length) return;
        chrome.tabs.sendMessage(BTTab, {'function': 'tabActivated', 'tabId': tabs[0].id});
        setTimeout(function() {setBadge(tabs[0].id);}, 200);
    });
});


// listen for connect and immediate disconnect => open BT panel
chrome.runtime.onConnect.addListener((port) => {
    const connectTime = Date.now();
    port.onDisconnect.addListener(() => {
        const disconnectTime = Date.now();
        if ((disconnectTime - connectTime) < 500)
            chrome.windows.update(BTWin, {'focused': true});
    });
});



/***
 *
 *  Functions that do the Apps bidding
 *
 ***/

function initializeExtension(msg, sender) {
    // sender is the BTContent script. We pull out its identifiers
    BTTab = sender.tab.id;
    BTWin = sender.tab.windowId;

    // make set of granted permissions available to content script
    chrome.permissions.getAll(
        rsp => {chrome.storage.local.set({'permissions' : rsp.permissions});});

    // send over gdrive app info
    chrome.tabs.sendMessage(                        
        BTTab,
        {'function': 'keys', 'client_id': config.CLIENT_ID, 'api_key': config.API_KEY});
}

function openTab(msg, sender, tries=0) {
    // open url in default window
    const nodeId = msg.nodeId;
    const url = msg.URL;
    const index = msg.index;
    const windowId = msg.windowId;
    if (!url || !nodeId) return;                         // nothing to be done
    try {
        chrome.tabs.create({'url': url}, tab => {
                              check();
            chrome.windows.update(tab.windowId, {'focused' : true});
            chrome.tabs.sendMessage(
                BTTab, {'function': 'tabOpened', 'nodeId': nodeId,
                        'tabId': tab.id, 'windowId': tab.windowId});
            setTimeout(function() {setBadge(tab.id);}, 250);
        });
    }
    catch (err) {
        // try try again
        if (tries > 3) {
            chrome.windows.create({'url': url, 'left': 500}); // open anyway to be helpful
            alert("Error in BrainTool\nTry closing main BT window and restarting:[", err, "]");
            return;
        }
        setTimeout(function(){openTab(msg, null, ++tries);}, 100);
    }
}

function positionTab(msg, sender) {
    // move tab to appropriate index in window

    const tabId = msg.tabId;
    const index = msg.index;
    chrome.tabs.move(tabId, {'index': index}, () => {
        check();});
}
    
function openInWindow(msg, sender) {
    // open url(s) in specific window, msg.tabs is [{url, nodeId},..]

    // Create array of urls to open
    const windowId = msg.windowId;
    const tabs = msg.tabs;

    if (windowId) {
        chrome.windows.update(windowId, {'focused' : true});
        tabs.forEach(tabData => {
            chrome.tabs.create({'url': tabData.URL, 'windowId': windowId}, tab => {
                              check();
                chrome.tabs.sendMessage(
                    BTTab,
                    {'function': 'tabOpened', 'nodeId': tabData.nodeId,
                     'tabId': tab.id, 'windowId': tab.windowId, 'tabIndex': tab.index});
            });
        });
    }
    else {
        const urls = tabs.map(elt => elt.URL);
        chrome.windows.create({'url': urls, 'left': 500}, function(win) {
            // Send back message per tab
            let id, url, tab;
            for (const elt of tabs) {
                id = elt.nodeId;
                url = elt.URL;
                tab = win.tabs.find(function(element) {
                    return (element &&
                            element.pendingUrl &&
                            compareURLs(element.pendingUrl, url));
                });
                if (!tab) continue;
                chrome.tabs.sendMessage(
                    BTTab,
                    {'function': 'tabOpened', 'nodeId': id, 'tabId': tab.id,
                     'windowId': win.id, 'tabIndex': tab.index});
            }
        });
    }
}

function openInTabGroup(msg, sender) {
    // open url(s) in specific tabGroup, msg.tabs is [{URL, nodeId},..]

    // Create array of urls to open
    const windowId = msg.windowId;
    const tabGroupId = msg.tabGroupId;
    const tabs = msg.tabs;
    const firstOpenTab = msg.firstOpenTab || 0;
    let firstTab = true;

    if (windowId && tabGroupId && firstOpenTab)                     // insert into existing group
        // iterate thru tabs, create, add to tabgroup and send back msg
        chrome.tabs.get(firstOpenTab, firstGroupTab => {
                              check();
            const tgIndex = firstGroupTab ? firstGroupTab.index : 0;        // index into tabGroup
            tabs.forEach((tabData, i) => {
                const finalIndex = tabData.index + tgIndex + i;
                console.log('Creating tab (url, index):', tabData.URL, finalIndex);
                chrome.tabs.create(
                    {'url': tabData.URL, 'windowId': windowId, 'index': finalIndex},
                    tab => {
                              check();
                        chrome.tabs.group(
                            {'groupId': tabGroupId, 'tabIds': tab.id}, () => {
                              check();
                                if (firstTab) {
                                    // highlight one tab in case TG window is buried
                                    firstTab = false;
                                    chrome.windows.update(windowId, {'focused' : true});
                                }
                                chrome.tabs.sendMessage(
                                    BTTab,
                                    {'function': 'tabOpened', 'nodeId': tabData.nodeId,
                                     'tabId': tab.id,
                                     'windowId': tab.windowId, 'tabGroupId': tabGroupId});
                            });
                    });
            });
        });
    else {
        // need to first create tabGroup, so create first tab and nest creation of the rest
        const firstTab = tabs[0];
        chrome.tabs.create({'url': firstTab.URL}, newtab => {
                              check();
            chrome.tabs.group({createProperties: {'windowId': newtab.windowId},
                               'tabIds': newtab.id}, groupId => {
                              check();
                chrome.tabs.sendMessage(
                    BTTab,
                    {'function': 'tabOpened', 'nodeId': firstTab.nodeId, 'tabId': newtab.id,
                     'tabGroupId': groupId, 'windowId': newtab.windowId});
                tabs.forEach((t, i) => {
                    if (i == 0) return;                 // already created first one
                    chrome.tabs.create({'url': t.URL}, newnewtab => {
                              check();
                        chrome.tabs.group({'groupId': groupId, 'tabIds': newnewtab.id}, () => {
                              check();
                            chrome.tabs.sendMessage(
                                BTTab,
                                {'function': 'tabOpened', 'nodeId': t.nodeId, 'tabId': newnewtab.id,
                                 'tabGroupId': groupId, 'windowId': newnewtab.windowId});
                        });
                    });
                });
            });
        });
    }
}

function moveToWindow(msg, sender) {
    // move specified tab to window at position
    const windowId = msg.windowId;
    const tabId = msg.tabId;
    const index = msg.index;
    const nodeId = msg.nodeId;
    if (windowId)
        chrome.tabs.move(tabId, {'windowId': windowId, 'index': index},
                         tab => {
                              check();
                             chrome.tabs.sendMessage(
                                 BTTab,
                                 {'function': 'tabOpened', 'nodeId': nodeId, 'tabId': tabId,
                                  'windowId': windowId});
                         });
    else
        chrome.windows.create({'tabId': tabId, 'left': 500}, win =>
                              chrome.tabs.sendMessage(
                                  BTTab,
                                  {'function': 'tabOpened', 'nodeId': nodeId, 'tabId': tabId,
                                   'windowId': win.id}));
}

function moveToTabGroup(msg, sender) {
    // move tab to position in tabgroup
    // TODO group does not take position, need to add seperate move?
    const tabId = msg.tabId;
    const nodeId = msg.nodeId;
    const position = msg.position;
    const tabGroupId = msg.tabGroupId;
    const firstOpenTab = msg.firstOpenTab;
    const windowId = msg.windowId;
    const args = tabGroupId ? {'groupId': tabGroupId, 'tabIds': tabId} : {'tabIds': tabId};
    chrome.tabs.group(args, groupId => {
        check();
        chrome.tabs.sendMessage(
            BTTab, {'function': 'tabOpened', 'nodeId': nodeId, 'tabId': tabId,
                    'windowId': windowId, 'tabGroupId': groupId});
    });
}

function ungroupAll(msg, sender) {
    // we're not using tabgroups any more, so ungroup
    chrome.tabs.ungroup(msg.tabIds, () => check());
}

function groupAll(msg, sender) {
    // user changed to tag:TabGrouping so group
    chrome.tabs.group({'createProperties': {'windowId': msg.windowId}, 'tabIds': msg.tabIds},
                      tg => {
                          check();
                          chrome.tabs.sendMessage(
                              BTTab, {'function': 'tabsGrouped', 'tgId': tg, 'tabIds': msg.tabIds});
                      });
}

function windowAll(msg, sender) {
    // user changed to tag:window mode so move tabs to individual window

    // Need to first create the window, using the first tab and then move any others
    chrome.windows.create({tabId: msg.tabIds[0]}, win => {
        if (msg.tabIds.length > 1)
            chrome.tabs.move(msg.tabIds.slice(1), {"windowId": win.id, "index": 1},
                             () => check());
        chrome.tabs.sendMessage(BTTab, {'function': 'tabsWindowed', 'windowId': win.id,
                                        'tabIds': msg.tabIds});
    });
}

function showNode(msg, sender) {
    // Surface the window/tab associated with this node

    if (msg.tabId) {
        chrome.tabs.get(msg.tabId, function(tab) {
                              check();
            chrome.windows.update(tab.windowId, {'focused' : true});
            chrome.tabs.highlight({'windowId' : tab.windowId, 'tabs': tab.index},
                                  () => check());
        });
    }
    if (msg.windowId) {
        chrome.windows.update(msg.windowId, {'focused' : true});
    }
}

function closeTab(msg, sender) {
    // Close a tab, NB tab listener will catch close and alert app

    const tabId = msg.tabId;
    chrome.tabs.remove(tabId, ()=> check()); // ignore error
}


/* TODO collapse w version in 'btNode */
function compareURLs(first, second) {
    // sometimes I get trailing /'s other times not, also treat http and https as the same,
    // also for some reason google docs immediately redirect to the exact same url but w /u/1/d instead of /d
    // also navigation within window via # anchors is ok
    // also maybe ?var= arguments are ok? Not on many sites (eg hn) where there's a ?page=123. If needed add back in
    //.replace(/\?.*$/, "")
    
    // also if its a gmail url need to match exactly

    if (first.indexOf("mail.google.com/mail") >= 0) {
        return (first == second);
    } else {        
        first = first.replace("https", "http").replace(/\/u\/1\/d/, "/d").replace(/\/www\./, "/").replace(/#.*$/, "").replace(/\/$/, "");
        second = second.replace("https", "http").replace(/\/u\/1\/d/, "/d").replace(/\/www\./, "/").replace(/#.*$/, "").replace(/\/$/, "");
        return (first == second);
    }
}

var marqueeEvent;                            // ptr to timeout event to allow cancellation
function setBadge(tabId) {
    // tab/window activated, set badge appropriately

    function marquee(badgeText, index) {
        if (badgeText.length < 6 || index >= badgeText.length - 2) {
            chrome.browserAction.setBadgeText({'text' : badgeText, 'tabId': tabId}, () => check());
        } else {            
            chrome.browserAction.setBadgeText({'text' : badgeText.slice(index) + "   ",
                                               'tabId': tabId}, () => check());
            marqueeEvent = setTimeout(function() {marquee(badgeText, ++index)}, 150);
        }
    }
    if (marqueeEvent) clearTimeout(marqueeEvent);
    chrome.storage.local.get(['currentTag', 'currentText'], function(data) {
        if (!data.currentTag) {
            chrome.browserAction.setBadgeText({'tabId': tabId, 'text' : ""}, () => check());
            chrome.browserAction.setTitle({'title' : 'BrainTool'});
        } else {
            marquee(data.currentTag, 0);
            chrome.browserAction.setTitle({'title' : data.currentText || 'BrainTool'});
            chrome.browserAction.setBadgeBackgroundColor({'color' : '#5E954E'});
        }
    });
}


function brainZoom(msg, sender, iteration = 0) {
    // iterate thru icons to swell the brain
    const iterationArray = [0,1,2,3,4,3,2,1,0];
    const path = 'images/BrainZoom'+iterationArray[iteration]+'.png';
    const default_icon = {
        "16": "images/BrainTool16.png",
        "32": "images/BrainTool32.png",
        "48": "images/BrainTool48.png",
        "128": "images/BrainTool128.png"
    };
    
    if (iteration == iterationArray.length) {            
        chrome.browserAction.setIcon({'path': default_icon, 'tabId': msg.tabId});
        setTimeout(function() {setBadge(msg.tabId);}, 150);
        return;
    }
    chrome.browserAction.setIcon({'path': path, 'tabId': msg.tabId});
    setTimeout(function() {brainZoom(msg, sender, ++iteration);}, 150);
}

function getBookmarks() {
    // User has requested bookmark import from browser

    chrome.bookmarks.getTree(function(itemTree){
        itemTree[0].title = "Imported Bookmarks";
        chrome.storage.local.set({'bookmarks': itemTree[0]}, function() {
            chrome.tabs.sendMessage(BTTab, {'function': 'loadBookmarks',
                                            'result': 'success'});
        });
    });
}

function getDateString() {
    // return minimal date representation to append to bookmark tag
    const d = new Date();
    const mins = d.getMinutes() < 10 ? "0"+d.getMinutes() : d.getMinutes();
    return (`${d.getMonth()+1}/${d.getDate()}/${d.getYear()-100} ${d.getHours()}:${mins}`);
}

function exportBookmarks() {
    // Top level bookmark exporter
    let AllNodes;

    function exportNodeAsBookmark(btNode, parentBookmarkId) {
        // export this node and recurse thru its children
        chrome.bookmarks.create(
            {title: btNode.displayTag, url: btNode.URL, parentId: parentBookmarkId},
            (bmNode) => {
                btNode.childIds.forEach(i => {exportNodeAsBookmark(AllNodes[i], bmNode.id); });
            });
    }

    chrome.storage.local.get(['title', 'AllNodes'], data => {
        AllNodes = data.AllNodes;
        chrome.bookmarks.create({title: data.title}, bmNode => {
            // Iterate thru top level nodes exporting them
            AllNodes.forEach(n => {
                if (n && !n.parentId)
                    exportNodeAsBookmark(n, bmNode.id);
            });
            chrome.windows.create({'url': 'chrome://bookmarks/?id='+bmNode.id});
        });
    });
}



/*  TODO KEEP UNTIL TAB LOCK figureed out
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Two cases
    // - BT tabs navigating away
    // - Tab finishing loading, want to set tab badge. 
    //       Workaround for some kind of issues where I set the badge but it gets cleared somewhere else as the tab is initializing.

    if (AllNodes && changeInfo.status && changeInfo.status == 'complete') {
        const node = BTChromeNode.findFromTab(tabId);
        if (node) setBadgeTab(node.windowId, tabId);
    }
    
    // Handle a BT tab being migrated to a new url
    if (!AllNodes || !changeInfo.url) return;                 // don't care
    const url = changeInfo.url;
    const node = BTChromeNode.findFromTab(tabId);
    if (!node) {
        handlePotentialBTNode(url, tab);                    // might be a BTNode opened from elsewhere
        return;
    }
    if ((!node.URL) || compareURLs(node.URL, url)) {          // 'same' url so ignore 
	    console.log("Node:" + JSON.stringify(node) + "\nNavigated to url:" + url + "\nSeems ok!");
	    return;
    }

    // Don't let BT tabs escape! Open any navigation in a new tab
    // NB some sites redirect back which can lead to an infinite loop. Don't go back if we've just done so
    const d = new Date();
    const t = d.getTime();
    if (node.sentBackTime && ((t - node.sentBackTime) < 3000)) return;
    node.sentBackTime = t;                        // very hokey!
    try {
        console.log("Sending back Tab #", tabId);
        chrome.tabs.goBack(
            node.tabId,            // send original tab back to the BT url
	    function() {
		// on success open url in new tab,
		// if error its probably a server redirect url manipulation so capture redirected url
		if (chrome.runtime.lastError) {
                    node.title = `[[${url}][${node.displayTag}]]`;
                    const err = JSON.stringify(chrome.runtime.lastError.message);
                    console.log("BT Failed to go back: " + err) ;
                }
                else {
                    chrome.tabs.create(
                        // index is 'clamped', use 99 to put new tab to the right of any BT tabs
                        {'windowId': node.windowId, 'url': url, 'index': 99},
                        function () {
			    if (chrome.runtime.lastError) {
                                const err = JSON.stringify(chrome.runtime.lastError.message);
                                console.log("Failed to open tab, err:" + err, "\nTrying in current window");
                                chrome.tabs.create({'url': url});
                            }
			});
                }
	    });
    }
    catch (err) {
        console.log("Failed to go back from url: " + url + ", to: " + node.URL);
    }
});
*/
