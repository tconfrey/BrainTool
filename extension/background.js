// Runs in the background chrome extension process. Messages out to popup code running in toolbar and
// to BT app code running in a web page and served from a remote server.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file, when I create one.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var BTTab = 0;
var BTWin;
// var ManagedTabs = [];           // global, used by popup to recognize BT tabs
var AllNodes = [];              // array of BTNodes
var OpenLinks = new Object();   // hash of node name to tab id
var OpenNodes = new Object();   // hash of node name to window id
var TabAction = 'pop';          // default operation on tagged tab (pop, hide, close, set by popup)
var LocalTest = false;          // control code path during unit testing

chrome.runtime.onMessage.addListener((msg, sender) => {
    // Handle messages from bt win content script and popup
    // NB legacy - generic messaging to the extension is now handled in BTChromeNode

    if (msg.from != 'btwindow') return;
    
    if (msg.type == 'LOCALTEST') {
        // Running under test so there is no external BT top level window
        chrome.tabs.query({'url' : '*://localhost/test*'},
                          function(tabs) {
                              BTTab = tabs[0].id;
                              console.log("Setting test mode w BTTab = " + BTTab);
                              LocalTest = true;
                          });
    }
    if (LocalTest && msg.type == 'get_bookmarks') {      // don't check permissions under test
        getBookmarks();
    }
    if (msg.type == 'get_bookmarks') {
        // request bookmark permission prior to bookmark operations
        // NB not using the dispatch cos that looses that its user triggered and Chrome prevents
        chrome.permissions.request(
            {permissions: ['bookmarks']},
            function(granted) {
                if (granted) {
                    chrome.permissions.getAll(
                        rsp => {chrome.storage.local.set(
                            {'permissions' : rsp.permissions});}
                    );
                    getBookmarks();
                } else {
                    // send back denial 
                    chrome.tabs.sendMessage(BTTab, {'function': 'loadBookmarks',
                                                    'result': 'denied'});
                }
            });
    }
});

function openTab(msg, sender, tries=0) {
    // open url in default window
    const nodeId = msg.nodeId;
    const url = msg.URL;
    const index = msg.index;
    const windowId = msg.windowId;
    if (!url || !nodeId) return;                         // nothing to be done
    try {
        chrome.tabs.create({'url': url}, tab => {
            chrome.tabs.sendMessage(
                BTTab, {'function': 'tabOpened', 'nodeId': nodeId,
                        'tabId': tab.id, 'windowId': tab.windowId});
        });
        console.log('Tab Opened:', url);
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
    chrome.tabs.move(tabId, {'index': index});
}
    
function openInWindow(msg, sender) {
    // open url(s) in specific window, msg.tabs is [{url, nodeId},..]

    // Create array of urls to open
    const windowId = msg.windowId;
    const tabs = msg.tabs;

    if (windowId)
        tabs.forEach(tabData => {
            chrome.tabs.create({'url': tabData.URL, 'windowId': windowId}, tab => {
                chrome.tabs.sendMessage(
                    BTTab,
                    {'function': 'tabOpened', 'nodeId': tabData.nodeId,
                     'tabId': tab.id, 'windowId': tab.windowId, 'tabIndex': tab.index});
            });
        });
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

    if (windowId && tabGroupId)                           // should always be both or none
        // iterate thru tabs, create, add to tabgroup and send back msg
        chrome.tabs.get(firstOpenTab, firstGroupTab => {
            const tgIndex = firstGroupTab ? firstGroupTab.index : 0;        // index into tabGroup
            tabs.forEach((tabData, i) => {
                const finalIndex = tabData.index + tgIndex + i;
                console.log('Creating tab (url, index):', tabData.URL, finalIndex);
                chrome.tabs.create(
                    {'url': tabData.URL, 'windowId': windowId, 'index': finalIndex},
                    tab => {
                        console.log('Created tab (url, index):', tab.pendingUrl, tab.index);
                        chrome.tabs.group(
                            {'groupId': tabGroupId, 'tabIds': tab.id}, () => {
                                console.log('grouped tab (url, index):', tab.pendingUrl, tab.index);
                                chrome.tabs.sendMessage(
                                    BTTab,
                                    {'function': 'tabOpened', 'nodeId': tabData.nodeId,
                                     'tabId': tab.id,
                                     'windowId': tab.windowId, 'tabGroupId': tabGroupId})});
                    });
            });
        });
    else {
        // need to first create tabGroup, so create first tab and nest creation of the rest
        const firstTab = tabs[0];
        chrome.tabs.create({'url': firstTab.URL}, newtab => {
            chrome.tabs.group({createProperties: {'windowId': newtab.windowId},
                               'tabIds': newtab.id}, groupId => {
                chrome.tabs.sendMessage(
                    BTTab,
                    {'function': 'tabOpened', 'nodeId': firstTab.nodeId, 'tabId': newtab.id,
                     'tabGroupId': groupId, 'windowId': newtab.windowId});
                tabs.forEach((t, i) => {
                    if (i == 0) return;                 // already created first one
                    chrome.tabs.create({'url': t.URL}, newnewtab => {
                        chrome.tabs.group({'groupId': groupId, 'tabIds': newnewtab.id}, () => {
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
        chrome.tabs.move(tabId, {'windowId': windowId, 'index': index}, tab =>
                         chrome.tabs.sendMessage(
                             BTTab,
                             {'function': 'tabOpened', 'nodeId': nodeId, 'tabId': tabId,
                              'windowId': windowId}));
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
    chrome.tabs.group(args, groupId =>
                      chrome.tabs.sendMessage(
                          BTTab, {'function': 'tabOpened', 'nodeId': nodeId, 'tabId': tabId,
                                  'windowId': windowId, 'tabGroupId': groupId}));
}

function showNode(msg, sender) {
    // Surface the window/tab associated with this node

    if (msg.tabId) {
        chrome.tabs.get(msg.tabId, function(tab) {
            chrome.windows.update(tab.windowId, {'focused' : true});
            chrome.tabs.highlight({'windowId' : tab.windowId, 'tabs': tab.index});
        });
    }
    if (msg.windowId) {
        chrome.windows.update(msg.windowId, {'focused' : true});
    }
}

function closeTab(msg, sender) {
    // Close a tab, NB tab listener will catch close and alert app

    const tabId = msg.tabId;
    chrome.tabs.remove(tabId, ()=>void chrome.runtime.lastError); // ignore error
}

/*
// TODO remove
function moveTabToTag(tabId, tabNode, tagNode) {
    // Find BTNode associated w tag, move tab to its window if exists, else create it

    if (tagNode.windowId) {
        // window exists => move tab. New tabs go on the left (and top in the tree)
        chrome.tabs.move(tabId, {'windowId': tagNode.windowId, 'index': 0},
                         function(deets) {
                             if (TabAction == 'pop') {
                                 // If default pop action, pop BT tab and then new tab to top
                                 chrome.windows.update(BTWin, {'focused': true});
                                 chrome.tabs.highlight(
                                     {'windowId': tagNode.windowId, 'tabs': deets.index}
                                 );
                                 chrome.windows.update(tagNode.windowId, {'focused': true});
                             }
                         });
    } else {
        // need to create new window
        const args = {'tabId': tabId, 'left': 500}; 
        if (TabAction != 'pop') args.focused = false;
        chrome.windows.create(args, window => {
            tagNode.windowId = window.id;
            OpenNodes[tagNode.title] = window.id;      // remember this node is open
        });
    }
    tabNode.tabId = tabId;
    OpenLinks[tabNode.title] = tabId;                  // remember this link is open
    
    // Send back message that the link and tag nodes are opened in browser
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_opened', 'BTNodeId': tabNode.id});
    console.count('tab_opened');
}
*/

function initializeExtension(msg, sender) {
    // sender is the BTContent script. We pull out its identifiers
    // Since we're restarting close windows and clear out the cache of opened nodes

    // make set of granted permissions available to content script
    chrome.permissions.getAll(
        rsp => {chrome.storage.local.set({'permissions' : rsp.permissions});});

    BTTab = sender.tab.id;
    BTWin = sender.tab.windowId;
    chrome.tabs.sendMessage(                        // send over gdrive app info
        BTTab,
        {'function': 'keys', 'client_id': config.CLIENT_ID, 'api_key': config.API_KEY});

    // TODO not needed?
    const tabIds = Object.values(OpenLinks);       // OpenLinks maps open link urls to tabIds
    if (tabIds.length) {
        alert("Closing BrainTool controlled windows!");
        console.log("Restarting Extension");
        chrome.tabs.remove(tabIds);
    }    
    OpenLinks = new Object();
    OpenNodes = new Object();
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

chrome.tabs.onRemoved.addListener((tabId, otherInfo) => {
    // listen for tabs being closed, if its a managed tab let BT know
    
    chrome.tabs.sendMessage(BTTab, {'function': 'tabClosed', 'tabId': tabId});
    if (tabId == BTTab) BTTab = null;
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // listen for tabs navigating to and from BT URLs

    console.log(`tabs.onUpdated:[id:${tabId}, url:${tab.url}, changeinfo:${JSON.stringify(changeInfo)}]`);
    if (changeInfo.status == 'complete')
        chrome.tabs.sendMessage(
            BTTab, {'function': 'tabUpdated', 'tabId': tabId,
                    'tabURL': tab.url, 'windowId': tab.windowId});
});
/*
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

chrome.tabs.onActivated.addListener((info) => {
    // Update badge and hover text if a BT window has opened or surfaced 
    setTimeout(function() {setBadgeTab(info.windowId, info.tabId);}, 150);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
    // Update badge
    setTimeout(function() {setBadgeWin(windowId);}, 50);
});


function setBadgeTab(windowId, tabId) {
    // Badge text should reflect BT tag, color indicates if this tab is in BT, hover text has more info
    const node = BTChromeNode.findFromWin(windowId);

    if (!node) {
        chrome.browserAction.setBadgeText({'text' : "", 'tabId' : tabId});
        chrome.browserAction.setTitle({'title' : 'BrainTool'});
        chrome.storage.local.set({currentTag: ""});
        return;
    }
    
    let openChildren = 0;
    let isBTTab = (node.tabId == tabId);
    let countsAsKid = node.childIds.slice();
    countsAsKid.push(node.id);
    for (const cid of countsAsKid) {
        if (AllNodes[cid] && AllNodes[cid].tabId) openChildren++;
        if (AllNodes[cid].tabId == tabId) isBTTab = true;
    }
    const displayName = node.displayTag;
    if (isBTTab) { // One of ours, green highlight and Tag text
        chrome.browserAction.setBadgeBackgroundColor({'color' : '#6A6', 'tabId' : tabId});
        chrome.browserAction.setBadgeText({'text' : displayName.substring(0,3),
                                           'tabId' : tabId});
    } else { // unmanaged, blue w ? for tag
        chrome.browserAction.setBadgeBackgroundColor({'color' : '#66A', 'tabId' : tabId});
        chrome.browserAction.setBadgeText({'text' : "??", 'tabId' : tabId});
    }
    chrome.browserAction.setTitle({'title' : `Tag:${displayName}\n${openChildren} open tabs`});

    // Store current windows tag for use by pop to default any new tab name
    chrome.storage.local.set({currentTag: displayName});
}

function setBadgeWin(windowId) {
    // Badge hover text shows for active window
    const node = BTChromeNode.findFromWin(windowId);
    
    if (!node) {
        chrome.browserAction.setTitle({'title' : 'BrainTool'});
        chrome.storage.local.set({currentTag: ""});
        return;
    }
    
    let openChildren = 0;
    for (const cid of node.childIds) {
        if (AllNodes[cid] && AllNodes[cid].tabId) openChildren++;
    }    
    const displayName = node.displayTag;
    chrome.browserAction.setTitle({'title' : `Tag:${displayName}\n${openChildren} open tabs`});
    // Store current windows tag for use by pop to default any new tab name
    chrome.storage.local.set({currentTag: displayName});

}
/*
function handlePotentialBTNode(url, tab) {
    // Check to see if this url belongs to a btnode and if so:
    // if its already open, just highlight, else open as such, even if not opened from BT App

    const node = BTChromeNode.findFromURL(url);
    const tabId = tab.id;
    if (!node) return;
    if (node.windowId && node.tabId) {
        // node already open elsewhere. Delete this tab and find and highlight BT version
        console.log(url + " already open, just highlighting it");
        const index = indexInParent(node.id);
        chrome.tabs.highlight({'windowId': node.windowId, 'tabs': index},
                              function(win) {
                                  chrome.tabs.get(tabId, function(tab) {
                                      chrome.tabs.remove(tabId);});
                                  chrome.windows.update(node.windowId, {'focused': true});
                              });
        return;
    }
    // 'parentNode' is the tagged node w dedicated window. Could be node if it has a url
    const parentNode = (node.isTag()) ? node : AllNodes[node.parentId] || node;
    if (parentNode.windowId) {
        // move tab to parent
        const index = indexInParent(node.id);
        node.windowId = parentNode.windowId;
        chrome.tabs.move(tabId, {'windowId' : parentNode.windowId, 'index' : index},
                         function(tab) {
                             chrome.tabs.highlight({'windowId': parentNode.windowId, 'tabs': index},
                                                   function(win) {
                                                       chrome.windows.update(parentNode.windowId, {'focused': true});
                                                   });
                         });
    } else {
        chrome.windows.create({"tabId": tabId, 'left': 500},
                              function(window) {
                                  node.windowId = window.id;
                                  parentNode.windowId = window.id;
                              });
    }
    
    node.tabId = tabId;
    OpenLinks[node.title] = node.tabId;
    ManagedTabs.push(tabId);

    // Send back message that the bt and parent nodes are opened in browser
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_opened', 'BTNodeId': node.id});
    console.count('tab_opened');
}
*/

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
    
    chrome.bookmarks.create({title: 'BrainTool Export ' + getDateString()}, bmNode => {
        // Iterate thru top level nodes exporting them
        AllNodes.forEach(n => {
            if (n && !n.parentId)
                exportNodeAsBookmark(n, bmNode.id);
        });
        chrome.windows.create({'url': 'chrome://bookmarks/?id='+bmNode.id});
    });
}

function exportNodeAsBookmark(btNode, parentBookmarkId) {
    // export this node and recurse thru its children

    chrome.bookmarks.create({title: btNode.displayTag, url: btNode.URL,
                             parentId: parentBookmarkId},
                            function(bmNode) {
                                btNode.childIds.forEach(i => {
                                    exportNodeAsBookmark(AllNodes[i], bmNode.id);
                                });
                            });
}
