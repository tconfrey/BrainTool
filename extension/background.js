// Runs in the background chrome extension process. Messages out to popup code running in toolbar and
// to BT app code running in a web page and served from a remote server.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file, when I create one.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var BTTab;
var BTWin;
var ManagedTabs = [];           // global, used by popup to recognize BT tabs
var AllNodes = [];              // array of BTNodes
var OpenLinks = new Object();   // hash of node name to tab id
var OpenNodes = new Object();   // hash of node name to window id
var TabAction = 'pop';          // default operation on tagged tab (pop, hide, close, set by popup)

chrome.runtime.onMessage.addListener((msg, sender) => {
    // Handle messages from bt win content script and popup
    // NB legacy - generic messaging to the extension is now handled in BTChromeNode
    console.count("\n\nBackground.js-IN:" + msg.type);
    switch (msg.from) {
    case 'btwindow':
        if (msg.type == 'node_reparented') {
            AllNodes[msg.nodeId].reparentNode(msg.parentId, msg.index);
        }
        if (msg.type == 'LOCALTEST') {
            // Running under test so there is no external BT top level window
            chrome.tabs.query({'url' : '*://localhost/test*'},
                              function(tabs) {
                                  BTTab = tabs[0].id;
                                  console.log("Setting test mode w BTTab = " + BTTab);
                              });
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
                        chrome.tabs.sendMessage(BTTab, {'type': 'bookmarks_imported',
                                                        'result': 'denied'});
                    }
                });
        }
        break;
    case 'popup':
        // two cases add_tab and add_move_tab. Common stuff is here
        let [tag, parent, keyword, tagPath] = BTNode.processTagString(msg.tag);

        // Create top level parent if needed
        let parentId = null;
        if (parent && !BTNode.findFromTagPath(parent))
        {
            let parentNode = new BTChromeNode(parent);
            parentId = parentNode.id;
        }
        // create tag node if needed and then the node itself
        const tagNodeId = BTNode.findFromTagPath(tagPath);
        const tagNode = tagNodeId ? AllNodes[tagNodeId] : new BTChromeNode(tag, parentId);
        const tabNode = new BTChromeNode(msg.title, tagNode.id);
            
        if (msg.type == 'add_move_tab') {
            if (BTChromeNode.findFromTab(msg.tabId)) {                // if already owned duplicate
                chrome.tabs.duplicate(msg.tabId, function(newTab) {
                    moveTabToTag(newTab.id, tabNode, tagNode);
                });
            } else {
                moveTabToTag(msg.tabId, tabNode, tagNode);
            }
        }
        break;
    }
});

function indexInParent(nodeId) {
    // for tab ordering
    let id = parseInt(nodeId);
    let kid = AllNodes[id];
    let parent = kid ? AllNodes[kid.parentId] : null;
    if (!kid || !parent) return 0;
    let index = (parent.tabId) ? 1 : 0;         // if parent has a tab it's at index 0
    parent.childIds.some(function(id) {
        if (id == nodeId) return true;          // exit when we get to this node
        let n = AllNodes[id];
        if (n && n.tabId) index++;
    });
    return index;
}

function deleteNode(msg, sender) {
    // First remove from list of managed tabs
    let mtabs = AllNodes[msg.nodeId].managedTabs();
    mtabs.forEach(tabId => {
        const index = ManagedTabs.indexOf(tabId);
        if (index !== -1) ManagedTabs.splice(index, 1);
    });
    BTNode.deleteNode(msg.nodeId);
}
    
function loadNodes(msg, sender) {
    // Called on startup or refresh
    // (and as a last resort when link msgs are received but nodes are somehow out of sync)
    chrome.storage.local.get('nodes', function(data) {
        const nodes = JSON.parse(data.nodes);
        BTNode.reset();
        nodes.forEach(function(node) {
            if (!node) return;                                        // nodes array can be sparse
            const chromeNode = new BTChromeNode('', null, node);
            
            // restore open state w tab and window ids. preserves state across refreshes
            // These are object structures indexed by _title
            chromeNode.tabId = OpenLinks[node._title] ? OpenLinks[node._title] : null; 
            chromeNode.windowId = OpenNodes[node._title] ? OpenNodes[node._title] : null;
        });
    });
}
function openLink(msg, sender, tries=0) {
    // handle click on a link - open in appropriate window
    // TODO Refactor to just take nodeId and use nodes url, why would they be different?
    const nodeId = msg.nodeId;
    const url = msg.url;
    try {
        var node = AllNodes[nodeId];
        if (node && node.tabId && node.windowId) {
            // tab exists just highlight it
            showNode(nodeId);
            return;
        }

        // if this node *is* a parentNode or if no parent (ie top level) open as its own window
        var parentNode = AllNodes[node.parentId];
        if (node.isTag() || !parentNode) parentNode = node;

        var index = (parentNode === node) ? 0 : indexInParent(nodeId);
        if (parentNode.windowId)
            // open tab in this window
            chrome.tabs.create({'windowId': parentNode.windowId,
                                'index': index, 'url': url},
                               function(tab) {
                                   node.tabId = tab.id;
                                   ManagedTabs.push(node.tabId);
                                   node.windowId = parentNode.windowId;
                                   OpenLinks[node.title] = node.tabId;
                                   showNode(nodeId);
                               });
        else
            // open new window and assign windowId
            chrome.windows.create({'url': url, 'left': 500},
                                  function(window) {
                                      parentNode.windowId = window.id;
                                      OpenNodes[parentNode.title] = window.id;
                                      node.tabId = window.tabs[0].id;
                                      ManagedTabs.push(node.tabId);
                                      node.windowId = window.id;
                                      OpenLinks[node.title] = node.tabId;
                                  });
        // Send back message that the bt and parent nodes are opened in browser
        chrome.tabs.sendMessage(
            BTTab,
            {'type': 'tab_opened', 'BTNodeId': node.id, 'BTParentId': parentNode.id});
        console.count('tab_opened');
    }
    catch (err) {
        // try refreshing data structures from storage and try again
        if (tries > 3) {
            chrome.windows.create({'url': url, 'left': 500}); // open anyway to be helpful
            alert("Error in BrainTool\nTry closing main BT window and restarting:[", err, "]");
            return;
        }
        if (tries) {
            // send msg to bt to reload nodes into local storage
            chrome.tabs.sendMessage(BTTab, {'type': 'error_restore_nodes'});
            console.count('error_restore_nodes');
        }
        loadNodes();
        setTimeout(function(){openLink({nodeId: nodeId, url: url}, null, ++tries);}, 100);
    }
}

function openTag(msg, sender) {
    // passed an array of {nodeId, url} to open in top window

    const parentId = msg.parent;
    const ary = msg.data;
    const parentNode = AllNodes[parentId];
    if (!parentNode) return;                                    // shrug
    if (parentNode.windowId) {
        // open one by one in parent. NB reverse is a bit hooky to address indexInParent when tabs are about to be opened async
        for (const elt of ary.reverse())
            openLink(elt.nodeId, elt.url);
    } else {
        // Create array of urls to open
        const urls = ary.map(elt => elt.url);
        chrome.windows.create({'url': urls, 'left': 500}, function(win) {
            // When done record in local node store and send back message per tab
            let id, tab, node;
            console.log("openTag->windows.create cb, tabs:" + JSON.stringify(win.tabs));
            parentNode.windowId = win.id;
            OpenNodes[parentNode.title] = win.id;
            for (const elt of ary) {
                id = elt.nodeId;
                node = AllNodes[id];
                node.windowId = win.id;

                // NB tabs might not be loaded at this point, handlePotentialBTNode will catch it later
                tab = win.tabs.find(function(element) {
                    return (element &&
                            element.pendingUrl &&
                            compareURLs(element.pendingUrl, AllNodes[id].URL));
                });
                if (!tab) continue;
                
                node.tabId = tab.id;
                OpenLinks[node.title] = node.tabId;
                ManagedTabs.push(node.tabId);
                chrome.tabs.sendMessage(
                    BTTab,
                    {'type': 'tab_opened', 'BTNodeId': id, 'BTParentId': parentId});
                console.count('tab_opened'); 
            }
        });
    }
}

function showNode(msg, sender) {
    // Surface the window/tab associated with this node

    const node = AllNodes[msg.nodeId];
    
    if (node && node.tabId) {
        // nb convert from tabId to offset index
        // nb,nb tabs.highlight should do the job
        //       but sometimes the window does not get focus so do that explicitly
        chrome.tabs.get(node.tabId, function(tab) {
            chrome.windows.update(tab.windowId, {'focused' : true});
            chrome.tabs.highlight({'windowId' : tab.windowId, 'tabs': tab.index});
        });
        return;
    }
    if (node && node.windowId) {
        chrome.windows.update(node.windowId, {'focused' : true});
        return;
    }
    if (node && node.childIds.length)
        // no window/tab, but children => open first child
        showNode(node.childIds[0]);
}

function closeNode(msg, sender) {
    // Close this nodes window or tabid. NB tabs have a tab id and window id, windows only have win id

    const node = AllNodes[msg.nodeId];
    if (node && node.tabId){
        chrome.tabs.remove(node.tabId);
        // and remove from list of managed tabs
        var index = ManagedTabs.indexOf(node.tabId);
        if (index !== -1) ManagedTabs.splice(index, 1);
        return;
    }
    if (node && node.windowId) {
        chrome.windows.remove(node.windowId);
    }
}

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
        {'type': 'tab_opened', 'BTNodeId': tabNode.id, 'BTParentId': tagNode.id});
    console.count('tab_opened');
}

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
        {'type': 'keys', 'client_id': config.CLIENT_ID, 'api_key': config.API_KEY});
    
    const tabIds = Object.values(OpenLinks);       // OpenLinks maps open link urls to tabIds
    if (tabIds.length) {
        alert("Closing BrainTool controlled windows!");
        console.log("Restarting Extension");
        chrome.tabs.remove(tabIds);
    }
    
    OpenLinks = new Object();
    OpenNodes = new Object();
}


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

function parentUpdate(nodeId) {
    // If as a result of a close/nav this tabs/nodes parent is now empty of BT nodes update app
    const parent = AllNodes[nodeId];
    // if no parent or parent is open, doesn't matter if kids are not
    if (!parent || parent.tabId) return;  
    
    let numKids = 0;
    parent.childIds.forEach(function(childId) {
        if (AllNodes[childId].tabId)
            numKids++;
    });
    if (!numKids) {
        parent.windowId = null;         // no tabs => no longer a BT window
        delete OpenNodes[parent.title];
        chrome.tabs.sendMessage(
            BTTab,
            {'type': 'tab_closed', 'BTNodeId': parent.id});
    }
    // NB Design choice - not leaving the parents windowId set
    // which would have any new tabs opened from this parent in this window
    // I think it makes more sense to reset the window state
}


chrome.tabs.onRemoved.addListener((tabId, otherInfo) => {
    // listen for tabs being closed, if its a managed tab let BT know
    if (tabId == BTTab) {
        console.log("BT closed!");
        BTTab = null;
        AllNodes = [];
        // Reset open nodes and links
        OpenLinks = new Object();
        OpenNodes = new Object();
        return;
    }

    const node = BTChromeNode.findFromTab(tabId);
    if (!node) return;

    delete OpenLinks[node.title];
    node.tabId = null; node.windowId = null;
    // and remove from list of managed tabs
    var index = ManagedTabs.indexOf(tabId);
    if (index !== -1) ManagedTabs.splice(index, 1);
    
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_closed', 'BTNodeId': node.id});

    if (node.isTag())          // if this is a parent node w link then its its own window
        parentUpdate(node.id);
    else
        parentUpdate(node.parentId);
});

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
        {'type': 'tab_opened', 'BTNodeId': node.id, 'BTParentId': parentNode.id});
    console.count('tab_opened');
}

function getBookmarks() {
    // User has requested bookmark import from browser

    chrome.bookmarks.getTree(function(itemTree){
        itemTree[0].title = "Imported Bookmarks";
        chrome.storage.local.set({'bookmarks': itemTree[0]}, function() {
            chrome.tabs.sendMessage(BTTab, {'type': 'bookmarks_imported',
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
