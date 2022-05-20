/***
 *
 *  Main entry point for all window and tab manipulation. Listens for messages from app 
 *  (relayed by content script) and dispatches to handler. Also listens for updates from
 *  browser (tabs opened etc) and relays back to app for processing.
 *
 ***/

var config;
try {
    importScripts('config.js');
} catch (e) {
    console.log(e);
    config = {CLIENT_ID: '', API_KEY: '', FB_KEY: '', STRIPE_KEY: ''};
}

var LocalTest = false;                 // control code path during unit testing
var InitialInstall = false;            // should we serve up the welcome page
var UpdateInstall = false;                   // or the release notes page

async function getBTTabWin() {
    // read from local storage
    let p = await chrome.storage.local.get(['BTTab', 'BTWin']);
    return [p.BTTab, p.BTWin];
}

function check(msg='') {
    // check for error
    if (chrome.runtime.lastError) {
        console.log(msg + "!!Whoops, runtime error.. " + chrome.runtime.lastError.message);
    }
}

/* Document data kept in storage.local */
const storageKeys = ["BTFileText",                // golden source of BT .org text data
                     "GroupingMode",              // window/group/none user pref
                     "TabAction",                 // remember popup default action
                     "currentTabId",
                     "currentTag",                // for setting badge text
                     "currentText",
                     "groupTopic",                // topic name for current tabgroup, if any
                     "windowTopic",               // topic for current window, if any
                     "mruTime",                   // mru items used to default mru topic in popup
                     "mruTopic",
                     "newInstall",                // true/false, for popup display choice
                     "newVersion",                // used for popup to indicate an update to user
                     "permissions",               // perms granted
                     "ManagerHome",               // open in Panel or Tab
                     "ManagerLocation",           // {top, left, width, height} of panel
                     "tags"];                     // used for popup display

chrome.runtime.onUpdateAvailable.addListener(deets => {
    // Handle update. Store version so popup can inform and then upgrade
    chrome.storage.local.set({'newVersion' : deets.version});
});
chrome.runtime.onInstalled.addListener(deets => {
    // special handling for first install or new version
    if (deets.reason == 'install') {
        InitialInstall = chrome.runtime.getManifest().version;	 // let app know version
	    chrome.storage.local.set({'newInstall' : true});
        chrome.tabs.create({'url': "https://braintool.org/support/welcome"});
    }
    if (deets.reason == 'update') {
        // also clean up local storage - get all keys in use and validate against those now needed
        chrome.storage.local.get(null, (items) => {
            Object.keys(items).forEach((key) => {
                if (!storageKeys.includes(key))
                    chrome.storage.local.remove(key);
            });
        });
        UpdateInstall = deets.previousVersion;
    }
});

/***
 *
 *  Message handling. Handlers dispatched based on msg.function
 *  NB need explicit mapping, evaluating from string is blocked for security reasons
 *
 ***/
const Handlers = {
    "initializeExtension": initializeExtension,
    "openTabs": openTabs,
    "openTabGroups": openTabGroups,
    "groupAndPositionTabs": groupAndPositionTabs,
    "showNode": showNode,
    "brainZoom": brainZoom,
    "closeTab": closeTab,
    "ungroup": ungroup,
    "groupAll": groupAll
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.from != 'btwindow' && msg.from != 'popup') return;

    // NB workaround for bug in Chrome, see https://stackoverflow.com/questions/71520198/manifestv3-new-promise-error-the-message-port-closed-before-a-response-was-rece/71520415#71520415
    sendResponse();
    
    console.log(`Background received: [${msg.function}]: ${JSON.stringify(msg)}`);
    if (Handlers[msg.function]) {
        console.log("Background dispatching to ", Handlers[msg.function].name);
        Handlers[msg.function](msg, sender);
        return;
    }
    if (msg.function == 'getBookmarks' || msg.function == 'exportBookmarks') {
        // request bookmark permission prior to bookmark operations
        // NB not using the dispatch cos that looses that its user triggered and Chrome prevents

        if (LocalTest) {
            getBookmarks(); return;
        }
        chrome.permissions.request(
            {permissions: ['bookmarks']}, granted => {
                if (granted) {
                    (msg.function == 'getBookmarks') ? getBookmarks() : exportBookmarks();
                } else {
                    // send back denial 
                    chrome.tabs.sendMessage(sender.tab.id, {'function': 'loadBookmarks',
                                                    'result': 'denied'});
                }
            });
    }
    if (msg.type == 'LOCALTEST') {
        // Running under test so there is no external BT top level window
        chrome.tabs.query({'url' : '*://localhost/test*'}, tabs => {
            check();
            LocalTest = true;
        });
    }
});


/***
 *
 *  Event handling for browser events of interest
 *
 ***/

chrome.tabs.onRemoved.addListener(async (tabId, otherInfo) => {
    // listen for tabs being closed and let BT know
    const [BTTab, BTWin] = await getBTTabWin();
    if (!tabId || !BTTab) return;         // closed?
    chrome.tabs.sendMessage(BTTab, {'function': 'tabClosed', 'tabId': tabId});
    if (tabId == BTTab) setTimeout(() => suspendExtension(), 100);
});


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // listen for tabs navigating to and from BT URLs
    const [BTTab, BTWin] = await getBTTabWin();
    if (!tabId || !BTTab || (tabId == BTTab)) return;                // not set up yet or don't care
    //console.log(`TabUpdated ${tabId}, [${JSON.stringify(changeInfo)}], [${JSON.stringify(tab)}]`);
    if (changeInfo.status == 'complete') {
        chrome.tabs.sendMessage(
            BTTab, {'function': 'tabUpdated', 'tabId': tabId, 'groupId': tab.groupId,
                    'tabURL': tab.url, 'windowId': tab.windowId});
        setTimeout(function() {setBadge(tabId);}, 200);
    }
});

chrome.tabs.onActivated.addListener(async (info) => {
    // Let app know there's a new top tab
    const [BTTab, BTWin] = await getBTTabWin();
    if (!info.tabId || !BTTab) return;
    chrome.tabs.get(info.tabId, tab => {
        if (!tab) return;
        chrome.tabs.sendMessage(BTTab, {'function': 'tabActivated', 'tabId': info.tabId,
                                        'windowId': tab.windowId, 'groupId': tab.groupId});
        setTimeout(function() {setBadge(info.tabId);}, 250);
    });
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    // Let app know there's a new top tab

    // don't care about special windows like dev tools or the BT win
    check();
    const [BTTab, BTWin] = await getBTTabWin();
    if (!BTTab || windowId <= 0 || windowId == BTWin) return;              
    chrome.tabs.query({'active': true, 'windowId': windowId},tabs => {
        check();
        if (!tabs.length) return;
        chrome.tabs.sendMessage(BTTab, {'function': 'tabActivated', 'tabId': tabs[0].id});
        setTimeout(function() {setBadge(tabs[0].id);}, 200);
    });
});

chrome.windows.onBoundsChanged.addListener(async (window) => {
    // remember position of topic manager window
    const [BTTab, BTWin] = await getBTTabWin();
    if (BTWin != window.id) return;
    const location = {top: window.top, left: window.left, width: window.width, height: window.height};
    chrome.storage.local.set({'ManagerLocation': location});
});

// listen for connect and immediate disconnect => open BT panel
chrome.runtime.onConnect.addListener(async (port) => {
    
    const [BTTab, BTWin] = await getBTTabWin();
    const connectTime = Date.now();
    port.onDisconnect.addListener(() => {
        const disconnectTime = Date.now();
	    if (!BTWin) return;	                                 // might have been closed
        if ((disconnectTime - connectTime) < 500)
            chrome.windows.update(BTWin, {'focused': true}, () => {
                check();
                chrome.tabs.update(BTTab, {'active': true});
            });
    });
});

// breaking out single tab opened handling, might not be in tg
async function tabOpened(winId, tabId, nodeId, index, tgId = 0) {
    const [BTTab, BTWin] = await getBTTabWin();
    check();
    chrome.tabs.sendMessage(BTTab,
                            {'function': 'tabOpened', 'nodeId': nodeId, 'tabIndex': index,
                             'tabId': tabId, 'windowId': winId, 'tabGroupId': tgId});
    setTimeout(function() {setBadge(tabId);}, 250);
}

/***
 *
 *  Functions that do the Apps bidding
 *
 ***/

function getOpenTabs() {
    // return an array of [{winId:, tabId:, groupId:, url:}..] via promise
    
    return new Promise(resolve => {
	    let allTabs = [];
	    chrome.tabs.query({}, (tabs) => {
	        tabs.forEach((tab) =>
			             allTabs.push({'id': tab.id,
				                       'groupId': tab.groupId,
				                       'windowId': tab.windowId,
                                       'tabIndex' : tab.index,
				                       'url': tab.url}));
	        resolve(allTabs);
	    });
    });
}

async function initializeExtension(msg, sender) {
    // sender is the BTContent script. We pull out its identifiers
    const BTTab = sender.tab.id;
    const BTWin = sender.tab.windowId;
    chrome.storage.local.set({'BTTab': BTTab, 'BTWin': BTWin});

    let allTabs = await getOpenTabs();
	
    // send over gdrive app info
    chrome.tabs.sendMessage(                        
        BTTab,
        {'function': 'launchApp', 'config': config, 'client_id': config.CLIENT_ID,
	     'api_key': config.API_KEY, 'fb_key': config.FB_KEY,
	     'stripe_key': config.STRIPE_KEY,
         'initial_install': InitialInstall, 'upgrade_install': UpdateInstall,
	     'all_tabs': allTabs});

    // check to see if a welcome is called for. repeat popup setting on bt win for safety.
    if (InitialInstall || UpdateInstall) {
        const welcomePage = InitialInstall ?
              'https://braintool.org/support/welcome' :
              'https://braintool.org/support/releaseNotes';
        chrome.tabs.create({'url': welcomePage},
			               () => {
			                   chrome.windows.update(BTWin,
						                             {'focused' : true},
						                             () => check());
			               });
        InitialInstall = null; UpdateInstall = null;
    }
    updateBTIcon('', 'BrainTool', '#5E954E');
    chrome.action.setIcon({'path': 'images/BrainTool128.png'});
}

function suspendExtension() {
    // called when the BTWin/BTTab is detected to have been closed

    chrome.storage.local.set({'BTTab': 0, 'BTWin': 0});
    updateBTIcon('', 'BrainTool is not running.\nClick to start', '#e57f21');
    chrome.action.setIcon({'path': 'images/BrainToolGray.png'});
    
    chrome.tabs.query({'currentWindow': true, 'active': true}, (tabs) => {
	    if (!tabs.length || !tabs[0].id) return;		 // sometimes theres no active tab
	    const tabId = tabs[0].id;	
	    setTimeout(() => {
	        // wait for updateBTIcon to finish then show 'OFF' on top tab for 3 secs
	        chrome.action.setBadgeText({'text' : 'OFF', 'tabId': tabId});
	        setTimeout(() => chrome.action.setBadgeText({'text' : '', 'tabId': tabId}), 3000);
	    }, 500);
    });
}

function updateBTIcon(text, title, color) {
    // utility fn called when BT is opened or closed to update icon appropriately

    // set for each tab to override previous tab-specific setting
    chrome.tabs.query({}, (tabs) =>
		              {
			              tabs.forEach((tab) => {
			                  chrome.action.setBadgeText(
				                  {'text' : text, 'tabId': tab.id}, () => check());
			                  chrome.action.setTitle(
				                  {'title' : title, 'tabId': tab.id});
			                  chrome.action.setBadgeBackgroundColor(
				                  {'color' : color, 'tabId': tab.id});
			              });
		              });

    // set across all tabs
	chrome.action.setBadgeText(
		{'text' : text}, () => check());
	chrome.action.setTitle(
		{'title' : title});
	chrome.action.setBadgeBackgroundColor(
		{'color' : color});
}

function openTabs(msg, sender, tries=0) {
    // open list of {nodeId, url} pairs, potentially in new window
    
    function openTabsInWin(tabInfo, winId = null) {
        // open [{url, nodeId}]s in tab in given window
        tabInfo.forEach((tabData) => {
            const args = winId ? {'windowId': winId, 'url': tabData.url} : {'url': tabData.url};
            chrome.tabs.create(args, tab => {
                chrome.windows.update(tab.windowId, {'focused' : true});
                chrome.tabs.highlight({'windowId': tab.windowId, 'tabs': tab.index});
                tabOpened(tab.windowId, tab.id, tabData.nodeId, tab.index);
            });
        });
    }

    const newWin = msg.newWin;
    const defaultWinId = msg.defaultWinId;                                 // 0 or winId of siblings
    const [first, ...rest] = msg.tabs;
    if (newWin)
        // Create new win w first url, then iterate on rest
        chrome.windows.create({'url': first.url}, win => {
            tabOpened(win.id, win.tabs[0].id, first.nodeId, win.tabs[0].index);
            openTabsInWin(rest, win.id);
        });
    else
        // else just iterate on all adding to current window
        openTabsInWin(msg.tabs, defaultWinId);                              
}

function openTabGroups(msg, sender) {
    // open tabs in specified or new tab group, potentially in new window 

    const tabGroups = msg.tabGroups;                                    // [{tg, win, [{id, url}]},..]
    const newWinNeeded = msg.newWin;

    function openTabsInTg(winId, tgid, tabInfo) {
        // open [{url, nodeId}, ..] in window and group
        // NB since a TG can't be set on creation need to iterate on creating tabs and then grouping
        tabInfo.forEach(info => {
            chrome.tabs.create({'url': info.url, 'windowId': winId}, tab => {
                check();
                chrome.tabs.group({'tabIds': tab.id, 'groupId': tgid}, tgid => {
                    chrome.windows.update(tab.windowId, {'focused' : true});
                    chrome.tabs.highlight({'windowId': tab.windowId, 'tabs': tab.index});
                    tabOpened(winId, tab.id, info.nodeId, tab.index, tgid);
                });
            });
        });
    }
    
    tabGroups.forEach(tg => {
        // handle a {windowId, tabGroupId, 'tabGroupTabs': [{nodeId, url}]} instance
        const[first, ...rest] = tg.tabGroupTabs;
        if (newWinNeeded)
            // need to create window for first tab
            chrome.windows.create({'url': first.url}, win => {
                const newTabId = win.tabs[0].id;
                chrome.tabs.group({'tabIds': newTabId, 'createProperties': {'windowId': win.id}},
                                  tgid => {
                                      check();
                                      tabOpened(win.id, win.tabs[0].id, first.nodeId,
                                                win.tabs[0].index, tgid);
                                      openTabsInTg(win.id, tgid, rest);
                                  });
            });
        else {
            // create in existing win/tg or new tg in current win
            if (tg.tabGroupId)
                openTabsInTg(tg.windowId, tg.tabGroupId, tg.tabGroupTabs);
            else {                                                         // need to create tg
                chrome.tabs.create({'url': first.url}, tab => {
                    check();
                    chrome.tabs.group({'tabIds': tab.id,
                                       'createProperties': {'windowId': tab.windowId}},
                                      tgid => {
                                          check();
                                          tabOpened(tab.windowId, tab.id, first.nodeId,
                                                    tab.index, tgid);
                                          openTabsInTg(tab.windowId, tgid, rest);
                                      });
                });
            }
        };
    });
}


function groupAndPositionTabs(msg, sender) {
    // array of {nodeId, tabId, tabIndex} to group in tabGroupId and order

    const tabGroupId = msg.tabGroupId;
    const windowId = msg.windowId;
    const tabInfo = msg.tabInfo;
    const groupName = msg.groupName;

    // Sort left to right before moving
    tabInfo.sort((a,b) => a.tabindex < b.tabindex);
    const tabIds = tabInfo.map(t => t.tabId);
    const groupArgs = tabGroupId ?
          {'tabIds': tabIds, 'groupId': tabGroupId} : windowId ?
          {'tabIds': tabIds, 'createProperties': {'windowId': windowId}} :
          {'tabIds': tabIds};
    console.log(`groupAndposition.groupArgs: ${JSON.stringify(groupArgs)}`);
    if (!tabIds.length) return;                                       // shouldn't happen, but safe

    chrome.tabs.move(tabIds, {'index': tabInfo[0].tabIndex}, tabs => {
        // first move tabs into place
        check('groupAndPositionTabs-move');
        chrome.tabs.group(groupArgs, groupId => {
            // then group appropriately. NB this order cos move drops the tabgroup
            check('groupAndPositionTabs-group');
            chrome.tabGroups.update(groupId, {'title' : groupName});
            const theTabs = Array.isArray(tabs) ? tabs : [tabs];      // single tab?
            theTabs.forEach(t => {
                const nodeInfo = tabInfo.find(ti => ti.tabId == t.id);
                chrome.tabs.sendMessage(
                    sender.tab.id, {'function': 'tabMoved', 'tabId': t.id,
                            'nodeId': nodeInfo.nodeId, 'tabGroupId': groupId,
                            'windowId': t.windowId, 'tabIndex': t.index});
            });
        });
    });         
}

function ungroup(msg, sender) {
    // node deleted or we're not using tabgroups any more, so ungroup
    chrome.tabs.ungroup(msg.tabIds, () => check());
}

function groupAll(msg, sender) {
    // add tabs to new group, either cos pref's changed or grouped tab was opened
    chrome.tabs.group({'createProperties': {'windowId': msg.windowId}, 'tabIds': msg.tabIds}, tg => {
        check();
        chrome.tabGroups.update(tg, {'title' : msg.groupName}, tgid => {
            console.log('tabgroupd updated:', tgid);
        });
        msg.tabIds.forEach(tid => {
            chrome.tabs.get(tid, tab => {
                check();
                chrome.tabs.sendMessage(
                    sender.tab.id,
                    {'function': 'tabGrouped', 'tgId': tg, 'tabId': tid, 'tabIndex': tab.index});
            });
        });
    });
}

function showNode(msg, sender) {
    // Surface the window/tab associated with this node

    if (msg.tabId) {
        chrome.tabs.get(msg.tabId, function(tab) {
            check();
            chrome.windows.update(tab.windowId, {'focused' : true}, () => check());
            chrome.tabs.highlight({'windowId' : tab.windowId, 'tabs': tab.index},
                                  () => check());
        });
    }
    if (msg.windowId) {
        chrome.windows.update(msg.windowId, {'focused' : true}, () => check());
    }
}

function closeTab(msg, sender) {
    // Close a tab, NB tab listener will catch close and alert app

    const tabId = msg.tabId;
    chrome.tabs.remove(tabId, ()=> check()); // ignore error
}


var MarqueeEvent;                            // ptr to timeout event to allow cancellation

function setBadge(tabId) {
    // tab/window activated, set badge appropriately

    function marquee(badgeText, index) {
        if (badgeText.length < 6 || index >= badgeText.length - 2) {
            chrome.action.setBadgeText({'text' : badgeText, 'tabId': tabId}, () => check('marquee'));
        } else {            
            chrome.action.setBadgeText({'text' : badgeText.slice(index) + "   ",
                                               'tabId': tabId}, () => check('marquee'));
            MarqueeEvent = setTimeout(function() {marquee(badgeText, ++index);}, 150);
        }
    }
    if (MarqueeEvent) clearTimeout(MarqueeEvent);
    chrome.storage.local.get(['currentTag', 'currentText'], function(data) {
        if (!data.currentTag) {
            chrome.action.setBadgeText({'text' : "", 'tabId' : tabId},
					                          () => check('Resetting badge text:'));
            chrome.action.setTitle({'title' : 'BrainTool'});
        } else {
            marquee(data.currentTag, 0);
            chrome.action.setTitle({'title' : data.currentText || 'BrainTool'});
            chrome.action.setBadgeBackgroundColor({'color' : '#5E954E'});
        }
    });
}

/* Experiment w Alex's icon options /
function brainZoom(msg, sender, iteration = 0) {
    const iterationArray = ['_BrainTool_Save_Animation_01_loop.gif',
                   '_BrainTool_Save_Animation_02_loop.gif',
                   '_BrainTool_Save_Animation_03_loop.gif'];

    const path = 'images/'+iterationArray[iteration];
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
    console.log(path);
    chrome.browserAction.setIcon({'path': path, 'tabId': msg.tabId}, () => {
        // if action was Close tab might be closed by now
        if (chrome.runtime.lastError)
            console.log("!!Whoops, tab closed before Zoom.. " + chrome.runtime.lastError.message);
        else
            setTimeout(function() {brainZoom(msg, sender, ++iteration);}, 5000);
    });
}
*/

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
        chrome.action.setIcon({'path': default_icon, 'tabId': msg.tabId});
        setTimeout(function() {setBadge(msg.tabId);}, 150);
        return;
    }
    chrome.action.setIcon({'path': path, 'tabId': msg.tabId}, () => {
        // if action was Close tab might be closed by now
        if (chrome.runtime.lastError)
            console.log("!!Whoops, tab closed before Zoom.. " + chrome.runtime.lastError.message);
        else
            setTimeout(function() {brainZoom(msg, sender, ++iteration);}, 150);
    });
}

function getBookmarks() {
    // User has requested bookmark import from browser

    chrome.bookmarks.getTree(async function(itemTree){
        const [BTTab, BTWin] = await getBTTabWin();
        itemTree[0].title = "Imported Bookmarks";
        chrome.storage.local.set({'bookmarks': itemTree[0]}, function() {
            chrome.tabs.sendMessage(BTTab, {'function': 'loadBookmarks',
                                            'result': 'success'});
        });
    });
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

