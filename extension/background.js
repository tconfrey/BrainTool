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
*  Main entry point for all window and tab manipulation. Listens for messages from app 
*  (relayed by content script) and dispatches to handler. Also listens for updates from
*  browser (tabs opened etc) and relays back to app for processing.
*
***/

'use strict';
import {getBookmarks, getBookmarksBar, syncBookmarksBar,
        exportBookmarks, createSessionName, generateBTNodesFromBookmarks } from './bookmarkHandler.js';
import { Keys } from './config.js';

let LocalTest = false;                            // control code path during unit testing
let InitialInstall = false;                       // should we serve up the welcome page
let UpdateInstall = false;                        // or the release notes page
let BTPort = null;                                // port to side panel
let BTManagerHome = 'WINDOW';                     // default to Window
let heldMessageQueue = [];                        // queue of messages to be sent when sidepanel port is set

async function btSendMessage(msg) {
    // send message to Topic Manager in window, tab or side panel

    const [BTTab, BTWin] = await getBTTabWin();
    if (!BTTab && !BTPort) {
        console.warn(`No BTTab or BTPort, not sending: ${JSON.stringify(msg)}`);
        if (BTManagerHome === 'SIDEPANEL') {
            heldMessageQueue.push(msg);             // will retry when port is connected
        }
        return;
    }
    console.log(`Sending to BT: ${JSON.stringify(msg)}`);
    try {
        if (BTTab)
            await chrome.tabs.sendMessage(BTTab, msg);
        if (BTPort)
            await chrome.runtime.sendMessage(msg);
        check('btSendMEssage says:');
    } catch (error) {
        console.warn(`Error sending ${JSON.stringify(msg)} to BT: ${error}`);
    }
}

chrome.runtime.onConnect.addListener((port) => {
    // Listen for port connection from side panel, serves as heartbeat so we know when its closed
    if (port.name !== "BTSidePanel") return;
    BTPort = port;

    // Send any message held while the port was connecting
    heldMessageQueue.forEach(msg => btSendMessage(msg));
    heldMessageQueue = [];
    // And set disconnect behavior
    BTPort.onDisconnect.addListener(() => {
        console.log('BTPort disconnected');
        BTPort = null;
        suspendExtension();
    });
});

function setUpSidepanel() {
    // Called at startup and on suspend to set the icon bahavior (panel can only open on 'user action')
    if (BTManagerHome === 'SIDEPANEL') {
        chrome.action.setPopup({popup: ''});
        chrome.action.onClicked.addListener((tab) => {
            chrome.sidePanel.open({windowId: tab.windowId});
            chrome.action.setPopup({popup: 'popup.html'});
        });
    }
    if (BTManagerHome === 'WINDOW' || BTManagerHome === 'TAB') {
        chrome.action.setPopup({popup: 'popup.html'});
    }
}
// Immediately executing fn to re-setup side panel after worker suspension
(async function () {
    const mHome = await chrome.storage.local.get(['BTManagerHome']);
    BTManagerHome = mHome.BTManagerHome || 'WINDOW';
    if (BTManagerHome !== 'SIDEPANEL') return;
    console.log('asking sidepanel to connect...');
    try {
        const rsp = await chrome.runtime.sendMessage({'function': 'reconnect'});
        console.log('sidepanel connection:', rsp);
        if (typeof rsp === 'undefined') setUpSidepanel();
    }
    catch (e) {
        console.log('NA, setting up sidepanel');
        setUpSidepanel();
    }
})();

async function getBTTabWin(reset = false) {
    // read from local storage then cached. reset => topic mgr exit
    if (reset) {
        getBTTabWin.cachedValue = null;
        return;
    }
    if (getBTTabWin.cachedValue) {
        return getBTTabWin.cachedValue;
    }
    let p = await chrome.storage.local.get(['BTTab', 'BTWin']);
    if (p.BTTab || p.BTWin) getBTTabWin.cachedValue = [p.BTTab, p.BTWin];
    return getBTTabWin.cachedValue || [0, 0];
}
function check(msg='') {
    // check for error
    if (chrome.runtime.lastError) {
        console.log(msg + "!!Whoops, runtime error.. " + chrome.runtime.lastError.message);
    }
}

/* Document data kept in storage.local */
const storageKeys = ["BTFileText",                  // golden source of BT .org text data
                     "TabAction",                   // remember popup default action
                     "currentTabId",
                     "currentTopic",                // for setting badge text
                     "currentText",
                     "mruTopics",                   // mru items used to default mru topic in popup
                     "newInstall",                  // true/false, for popup display choice
                     "newVersion",                  // used for popup to indicate an update to user
                     "permissions",                 // perms granted
                     "Config",                      // General config values
                     "BTManagerLocation",           // {top, left, width, height} of panel
                     "topics"];                     // used for popup display

chrome.runtime.onUpdateAvailable.addListener(deets => {
    // Handle update. Store version so popup can inform and then upgrade
    chrome.storage.local.set({'newVersion' : deets.version});
});
chrome.runtime.onInstalled.addListener(deets => {
    // special handling for first install or new version
    if (deets.reason == 'install') {
        InitialInstall = chrome.runtime.getManifest().version;	 // let app know version
        chrome.storage.local.set({'newInstall' : true});
        chrome.storage.local.set({'newVersion' : InitialInstall});
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

        // Set updateInstall only if not a point release. ie 1->2 or 1.1 -> 1.2 are upgrades, 1.2 -> 1.2.1 is not
        const newVersion = chrome.runtime.getManifest().version;
        const prevVersion = deets.previousVersion;
        const [newMajor, newMinor] = newVersion.split('.').map(Number);
        const [prevMajor, prevMinor] = prevVersion.split('.').map(Number);
        if (newMajor !== prevMajor || newMinor !== prevMinor) {
            UpdateInstall = prevVersion;
        }
    }
});

// Set survey pointer on uninstall
chrome.runtime.setUninstallURL('https://forms.gle/QPP8ZREnpDgXxdav9', () => console.log('uninstall url set to https://forms.gle/QPP8ZREnpDgXxdav9'));

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
    "moveTab": moveTab,
    "ungroup": ungroup,
    "moveOpenTabsToTG": moveOpenTabsToTG,
    "updateGroup": updateGroup,
    "saveTabs": saveTabs,
    "getBookmarks": getBookmarks,
    "getBookmarksBar": getBookmarksBar,
    "exportBookmarks": exportBookmarks,
    "syncBookmarksBar": syncBookmarksBar,
    "saveDroppedURLs": saveDroppedURLs,
    "setBrowserTheme": setBrowserTheme,
};

var Awaiting = false;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if ((msg.from != 'btwindow' && msg.from != 'popup'))
        return;
    
    async function handleAwaitMessage() {
        try {
            const result = await Handlers[msg.function](msg, sender);
            sendResponse({ status: "success", message: result });
        } catch (error) {
            console.error("Error during async operation:", error);
            sendResponse({ status: "error", message: error.message });
        }
    }

    if (msg.type == "AWAIT" && Handlers[msg.function]) {
        Awaiting = true;
        console.log("Background AWAITing ", msg.function, JSON.stringify(msg));
        handleAwaitMessage();
        setTimeout(() => Awaiting = false, 500);
        return true;
    }

    // NB workaround for bug in Chrome, see https://stackoverflow.com/questions/71520198/manifestv3-new-promise-error-the-message-port-closed-before-a-response-was-rece/71520415#71520415
    sendResponse();
    console.log(`Background received: [${msg.function}]: ${JSON.stringify(msg)}`);
    if (Handlers[msg.function]) {
        console.log("Background dispatching to ", msg.function);
        Handlers[msg.function](msg, sender);
        return;
    }

    if (msg.type == 'LOCALTEST') {
            // Running under test so there is no external BT top level window
            chrome.tabs.query({'url' : '*://localhost/test*'}, tabs => {
            check();
            LocalTest = true;
        });
        return;
    }
    console.warn("Background received unhandled message!!!!: ", msg);
});


/***
*
*  Event handling for browser events of interest
*
***/
function logEventWrapper(eventName, originalFunction) {
    // wrap event handlers below to log event and args
    return function(...args) {
        console.log(`EVENT---: ${eventName}`, args);
        return originalFunction.apply(this, args);
    }
}

/* -- Tab Events -- */

chrome.tabs.onMoved.addListener(logEventWrapper("tabs.onMoved", async (tabId, otherInfo) => {
    // listen for tabs being moved and let BT know
    if (Awaiting) return;                                           // ignore events while we're awaiting our commands to take effect
    const tab = await chrome.tabs.get(tabId); check();
    if (!tab || tab.status == 'loading') return;
    const indices = await tabIndices();
    //console.log('moved event:', otherInfo, tab);
    btSendMessage({ 'function': 'tabMoved', 'tabId': tabId, 'groupId': tab.groupId,
                    'tabIndex': tab.index, 'windowId': tab.windowId, 'indices': indices, 'tab': tab});
    setTimeout(function() {setBadge(tabId);}, 200);
}));

chrome.tabs.onRemoved.addListener(logEventWrapper("tabs.onRemoved", async (tabId, otherInfo) => {
    // listen for tabs being closed and let BT know
    if (!tabId) return;
    const [BTTab, BTWin] = await getBTTabWin();
    if (!BTPort && !BTTab) return;         // closed?
    if (tabId == BTTab) {
        setTimeout(() => suspendExtension(), 100);
        console.log('BTTab closed, suspending extension');
        return;
    }
    const indices = await tabIndices();
    btSendMessage({'function': 'tabClosed', 'tabId': tabId, 'indices': indices});
}));

chrome.tabs.onUpdated.addListener(logEventWrapper("tabs.onUpdated", async (tabId, changeInfo, tab) => {
    // listen for tabs navigating to and from BT URLs or being moved to/from TGs
    if (Awaiting) return;                                           // ignore events while we're awaiting 'synchronous' commands to take effect

    const [BTTab, BTWin] = await getBTTabWin();
    if (!tabId || (!BTTab && !BTPort) || (tabId == BTTab)) return;               // not set up yet or don't care

    const indices = await tabIndices();                             // keep indicies in sync
    if (changeInfo.status == 'complete') {
        // tab navigated to/from url, add in transition info from Web Nav event, below
        const transitionData = tabTransitionData[tabId] || null;          // set in webNavigation.onCommitted event above
        setTimeout (() => delete tabTransitionData[tabId], 1000);                                // clear out for next event
        btSendMessage({ 'function': 'tabNavigated', 'tabId': tabId, 'groupId': tab.groupId, 'tabIndex': tab.index,
                        'tabURL': tab.url, 'windowId': tab.windowId, 'indices': indices, 'transitionData': transitionData,});
        setTimeout(function() {setBadge(tabId);}, 200);
        return;
    }
    if (changeInfo.groupId && (tab.status == 'complete') && tab.url) {
        // tab moved to/from TG, wait til loaded so url etc is filled in
        const tg = (tab.groupId > 0) ? await chrome.tabGroups.get(tab.groupId) : null;
        const message = {
            'function': (tab.groupId > 0) ? 'tabJoinedTG' : 'tabLeftTG',
            'tabId': tabId,
            'groupId': tab.groupId,
            'tabIndex': tab.index,
            'windowId': tab.windowId,
            'indices': indices,
            'tab': tab, 
            'tabGroupColor': tg?.color
        };
    
        // Adding a delay to allow potential tab closed event to be processed first, otherwise tabLeftTG deletes BT Node
        setTimeout(async () => { btSendMessage(message); }, 250);
        setTimeout(function() {setBadge(tabId);}, 200);
    }
}));

chrome.tabs.onActivated.addListener(logEventWrapper("tabs.onActivated", async (info) => {
    // Let app know there's a new top tab
    if (!info.tabId) return;
    chrome.tabs.get(info.tabId, tab => {
        check();
        if (!tab) return;
        btSendMessage({ 'function': 'tabActivated', 'tabId': info.tabId, 'groupId': tab.groupId});
        setTimeout(function() {setBadge(info.tabId);}, 250);
    });
}));

// Listen for webNav events to know if the user was clicking a link or typing in the URL bar etc. 
// Seems like some sites (g Reddit) trigger the history instead of Committed event. Don't know why

const tabTransitionData = {};       // map of tabId: {transitionTypes: [""..], transitionQualifiers: [""..]}
chrome.webNavigation.onCommitted.addListener(logEventWrapper("webNavigation.onCommitted", async (details) => {
    if (details?.frameId !== 0) return;
    //console.log('webNavigation.onCommitted fired:', JSON.stringify(details));
    if (!tabTransitionData[details.tabId]) {
        tabTransitionData[details.tabId] = { transitionTypes: [], transitionQualifiers: [] };
    }
    tabTransitionData[details.tabId].transitionTypes.push(details.transitionType);
    tabTransitionData[details.tabId].transitionQualifiers.push(...details.transitionQualifiers);
}));

chrome.webNavigation.onHistoryStateUpdated.addListener(logEventWrapper("webNavigation.onHistoryStateUpdated", async (details) => {
    if (details?.frameId !== 0) return;
    //console.log('webNavigation.onHistoryStateUpdated fired:', JSON.stringify(details));
    if (!tabTransitionData[details.tabId]) {
        tabTransitionData[details.tabId] = { transitionTypes: [], transitionQualifiers: [] };
    }
    tabTransitionData[details.tabId].transitionTypes.push(details.transitionType);
    tabTransitionData[details.tabId].transitionQualifiers.push(...details.transitionQualifiers);
}));

/* -- TabGroup Events -- */

chrome.tabGroups.onCreated.addListener(logEventWrapper("tabGroups.onCreated", async (tg) => {
    // listen for TG creation and let app know color etc
    btSendMessage({'function': 'tabGroupCreated', 'tabGroupId': tg.id, 'tabGroupColor': tg.color});
}));

chrome.tabGroups.onUpdated.addListener(logEventWrapper("tabGroups.onUpdated", async (tg) => {
    // listen for TG updates and let app know color etc
    if (Awaiting) return;                                            // ignore TG events while we're awaiting our commands to take effect
    btSendMessage({ 'function': 'tabGroupUpdated', 'tabGroupId': tg.id, 'tabGroupColor': tg.color, 
                    'tabGroupName': tg.title, 'tabGroupCollapsed': tg.collapsed, 'tabGroupWindowId': tg.windowId});
}));

chrome.tabGroups.onRemoved.addListener(logEventWrapper("tabGroups.onRemoved", async (tg) => {
    // listen for TG deletion
    btSendMessage({'function': 'tabGroupRemoved', 'tabGroupId': tg.id});
}));


/* --  Window Events -- */

chrome.windows.onFocusChanged.addListener(logEventWrapper("windows.onFocusChanged", async (windowId) => {
    // Let app know there's a new top tab

    // don't care about special windows like dev tools
    check();
    if (windowId <= 0) return;
    chrome.tabs.query({'active': true, 'windowId': windowId},tabs => {
        check();
        if (!tabs?.length) return;
        btSendMessage({'function': 'tabActivated', 'tabId': tabs[0].id, 'windowId': windowId});
        setTimeout(function() {setBadge(tabs[0].id);}, 200);
    });
}));

// onBoundsChanged not supported in FF
chrome.windows.onBoundsChanged && chrome.windows.onBoundsChanged.addListener(async (window) => {
    // remember position of topic manager window
    if (BTManagerHome === 'SIDEPANEL') return;          // doesn't apply
    const [BTTab, BTWin] = await getBTTabWin();
    if (BTWin != window.id) return;
    const location = {top: window.top, left: window.left, width: window.width, height: window.height};
    chrome.storage.local.set({'BTManagerLocation': location});
});

// listen for connect and immediate disconnect => open BT panel
chrome.runtime.onConnect.addListener(logEventWrapper("runtime.onConnect", async (port) => {

    if (port.name !== "BTPopup") return;
    const [BTTab, BTWin] = await getBTTabWin();
    const connectTime = Date.now();
    btSendMessage({'function': 'checkFileFreshness'});
    port.onDisconnect.addListener(() => {
        const disconnectTime = Date.now();
        if (!BTWin) return;	                                 // might have been closed
        if ((disconnectTime - connectTime) < 500)
            chrome.windows.update(BTWin, {'focused': true}, () => {
                check();
                BTTab && chrome.tabs.update(BTTab, {'active': true});
            });
    });
}));

// utility to return tabId: {tabIndex windowId} hash
async function tabIndices() {
    const tabs = await chrome.tabs.query({});
    const indices = {};
    tabs.forEach(t => indices[t.id] = {'index': t.index, 'windowId': t.windowId});
    return indices;
}

/***
 *
 *  Functions that do the Apps bidding
 *
 ***/

// breaking out single tab opened handling, might not be in tg
async function tabOpened(winId, tabId, nodeId, index, tgId = 0) {
    const indices = await tabIndices();
    btSendMessage({'function': 'tabOpened', 'nodeId': nodeId, 'tabIndex': index,
                   'tabId': tabId, 'windowId': winId, 'tabGroupId': tgId, 'indices': indices});
    setTimeout(function() {setBadge(tabId);}, 250);
}

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
                              'title': tab.title,
                              'pinned': tab.pinned,
                              'faviconUrl': tab.favIconUrl,
                              'url': tab.url}));
            resolve(allTabs);
        });
    });
}

function getOpenTabGroups() {
    // return array of [{windId, color, title, collapsed, id}]
    return new Promise(resolve => {
        chrome.tabGroups.query({}, (tgs) => {
            resolve(tgs);
        });
    });
}

async function initializeExtension(msg, sender) {
    // sender is the BTContent script. We pull out its identifiers
    const BTTab = sender.tab?.id;
    const BTWin = sender.tab?.windowId || msg.BTWin;
    console.log(`Initializing extension with BTTab: ${BTTab}, BTWin: ${BTWin}`);
    const BTVersion = chrome.runtime.getManifest().version;
    const perms = await chrome.permissions.getAll();
    chrome.storage.local.set({'BTTab': BTTab, 'BTWin': BTWin});
    getBTTabWin(true);                         // clear cache

    let allTabs = await getOpenTabs();
    let allTGs = await getOpenTabGroups();

    // send over gdrive app info
    btSendMessage(
        {'function': 'launchApp', 'client_id': Keys.CLIENT_ID,
         'api_key': Keys.API_KEY, 'fb_key': Keys.FB_KEY,
         'stripe_key': Keys.STRIPE_KEY, 'BTTab': BTTab, 'BTWin': BTWin,
         'initial_install': InitialInstall, 'upgrade_install': UpdateInstall, 'BTVersion': BTVersion,
         'all_tabs': allTabs, 'all_tgs': allTGs});

    // check to see if a welcome is called for. repeat popup setting on bt win for safety.
    if (InitialInstall || UpdateInstall) {
        const welcomePage = InitialInstall ?
              'https://braintool.org/support/welcome' :
              'https://braintool.org/support/releaseNotes';
        chrome.tabs.create({'url': welcomePage},
                           () => {
                               BTWin && chrome.windows.update(BTWin, {'focused' : true}, () => check());
                           });
        InitialInstall = null; UpdateInstall = null;
    }
    updateBTIcon('', 'BrainTool', '#59718C');      // was #5E954E
    chrome.action.setIcon({'path': 'images/BrainTool128.png'});

    getBookmarksBar();             // initialize bookmark bar
}

async function suspendExtension() {
    // called when the BTWin/BTTab/Sidepanel is detected to have been closed
    console.log("suspending service worker");

    // re query BTManagerHome, might have changed
    const mHome = await chrome.storage.local.get(['BTManagerHome']);
    BTManagerHome = mHome.BTManagerHome || 'WINDOW';

    setUpSidepanel();                           // reset sidepanel to default behavior

    chrome.storage.local.set({'BTTab': 0, 'BTWin': 0});
    getBTTabWin(true);                         // clear cache
    BTPort = null;
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

function openTabs(msg, sender) {
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
    else if (!defaultWinId) openTabsInWin(msg.tabs);                      // open in current win
    else
        // else check window exists & iterate on all adding to current window
        chrome.windows.get(defaultWinId, (w) => {
            if (!w) {
                // in rare error case win may no longer exist => set to null
                console.warn(`Error in openTabs. ${chrome.runtime.lastError?.message}`);
                openTabsInWin(msg.tabs);
            } else {
                openTabsInWin(msg.tabs, defaultWinId);
            }
        });
}

function openTabGroups(msg, sender) {
    // open tabs in specified or new tab group, potentially in new window

    const tabGroups = msg.tabGroups;                                    // [{tg, win, tgname[{id, url}]},..]
    const newWinNeeded = msg.newWin;

    function openTabsInTg(winId, tgid, tabInfo) {
        // open [{url, nodeId}, ..] in window and group
        // NB since a TG can't be set on creation need to iterate on creating tabs and then grouping
        tabInfo.forEach(info => {
            chrome.tabs.create({'url': info.url, 'windowId': winId}, tab => {
                check(); if (!tab) return;
                chrome.tabs.group({'tabIds': tab.id, 'groupId': tgid}, tgid => {
                    chrome.windows.update(tab.windowId, {'focused' : true});
                    chrome.tabs.highlight({'windowId': tab.windowId, 'tabs': tab.index});
                    tabOpened(winId, tab.id, info.nodeId, tab.index, tgid);
                });
            });
        });
    }

    tabGroups.forEach(tg => {
        // handle a {windowId, tabGroupId, groupName, 'tabGroupTabs': [{nodeId, url}]} instance
        const[first, ...rest] = tg.tabGroupTabs;
        const groupName = tg.groupName || '';

        // create in existing win/tg if tg is open (even if newWin sent)
        if (tg.tabGroupId)
        {
            openTabsInTg(tg.windowId, tg.tabGroupId, tg.tabGroupTabs);
            return;
        }
        if (newWinNeeded)
            // need to create window for first tab
            chrome.windows.create({'url': first.url}, win => {
                const newTabId = win.tabs[0].id;
                chrome.tabs.group({'tabIds': newTabId, 'createProperties': {'windowId': win.id}},
                                  tgid => {
                                      check(); if (!tgid) return;
                                      tabOpened(win.id, win.tabs[0].id, first.nodeId,
                                                win.tabs[0].index, tgid);
                                      chrome.tabGroups.update(tgid, {'title' : groupName});
                                      openTabsInTg(win.id, tgid, rest);
                                  });
            });
        else 
            // create tg in current window
            chrome.tabs.create({'url': first.url}, tab => {
                check(); if (!tab) return;
                chrome.tabs.group({'tabIds': tab.id,
                                   'createProperties': {'windowId': tab.windowId}},
                                  tgid => {
                                      check(); if (!tgid) return;
                                      tabOpened(tab.windowId, tab.id, first.nodeId,
                                                tab.index, tgid);
                                      chrome.tabGroups.update(tgid, {'title' : groupName});
                                      openTabsInTg(tab.windowId, tgid, rest);
                                  });
            });
    });
}

async function groupAndPositionTabs(msg, sender) {
    // array of {nodeId, tabId, tabIndex} to group in tabGroupId and order

    const tabGroupId = msg.tabGroupId;
    const windowId = msg.windowId;
    const tabInfo = msg.tabInfo;
    const topicId = msg.topicId;
    const groupName = msg.groupName;
    const leftmostTabIndex = msg.leftmostTabIndex || 0; // where to start placing tabs, default to 0

    // Sort left to right before moving
    tabInfo.sort((a,b) => a.tabindex < b.tabindex);
    const tabIds = tabInfo.map(t => t.tabId);
    const groupArgs = tabGroupId ?
          {'tabIds': tabIds, 'groupId': tabGroupId} : windowId ?
            {'tabIds': tabIds, 'createProperties': {'windowId': windowId}} : {'tabIds': tabIds};
    console.log(`groupAndposition.groupArgs: ${JSON.stringify(groupArgs)}`);
    if (!tabIds.length) return [];                                   // shouldn't happen, but safe

    // First, check if any tabs are in different groups and ungroup them
    // Nb called w await, so changes won't generrate events back to app
    try {
        for (const tabId of tabIds) {
            const tab = await chrome.tabs.get(tabId);
            check();
            if (!tab) continue;
            
            // If tab is already in a different group, ungroup it and regroup in the new group
            if (tab.groupId > 0 && tab.groupId !== tabGroupId) {
                console.log(`Tab ${tabId} is in group ${tab.groupId}, removing before adding to ${tabGroupId || 'new group'}`);
                await chrome.tabs.ungroup(tabId);
                check(`Ungrouping tab ${tabId} from group ${tab.groupId}`);
                const grpArgs = tabGroupId ?
                      {'tabIds': [tabId], 'groupId': tabGroupId} :
                      {'tabIds': [tabId], 'createProperties': {'windowId': windowId}};
                await chrome.tabs.group(grpArgs);
                check(`Grouping tab ${tabId} into group ${tabGroupId}`);
            }
        }
        
        // Move tabs one by one to their desired positions
        for (let i = 0; i < tabIds.length; i++) {
            await chrome.tabs.move(tabIds[i], {'index': leftmostTabIndex + i});
            check(`Moving tab ${tabIds[i]} to index ${leftmostTabIndex + i}`);
        }
        
        // After all tabs are moved, group them
        const groupId = await chrome.tabs.group(groupArgs);
        check('groupAndPositionTabs-group');
        
        // Update group title
        await chrome.tabGroups.update(groupId, {'title': groupName});
        
        // Handle group sync to TM
        const tg = await chrome.tabGroups.get(groupId);
        if (!tabGroupId) {
            // new group => send tabGroupCreated msg to link to topic
            btSendMessage({
                'function': 'tabGroupCreated', 
                'tabGroupId': groupId, 
                'topicId': topicId, 
                'tabGroupColor': tg.color
            });
        } else {
            btSendMessage({
                'function': 'tabGroupUpdated',
                'tabGroupId': groupId,
                'tabGroupColor': tg.color,
                'tabGroupName': groupName,
                'tabGroupCollapsed': tg.collapsed,
                'tabGroupWindowId': tg.windowId
            });
        }
        
        // Get updated tab information to return
        const updatedTabInfo = await getOpenTabs();
        return updatedTabInfo;
    } catch (error) {
        console.error('Error in groupAndPositionTabs:', error);
        return [];
    }
}


async function ungroup(msg, sender) {
    // node deleted, navigated or we're not using tabgroups any more, so ungroup
    await chrome.tabs.ungroup(msg.tabIds);
    check('ungroup ');
}

function moveOpenTabsToTG(msg, sender) {
    // add tabs to new group, cos pref's changed
    // send back tabJoinedTG msg per tab

    chrome.tabs.group({'createProperties': {'windowId': msg.windowId}, 'tabIds': msg.tabIds}, async (tgId) => {
        check(); if (!tgId) return;
        let tgcolor;
        chrome.tabGroups.update(tgId, {'title' : msg.groupName}, tg => {
            console.log('tabgroup updated:', tg);
            tgcolor = tg.color;
        });
        const indices = await tabIndices();
        msg.tabIds.forEach(tid => {
            chrome.tabs.get(tid, tab => {
                check(); if (!tab) return;
                btSendMessage(
                    {'function': 'tabJoinedTG', 'tabId': tid, 'groupId': tgId,
                     'tabIndex': tab.index, 'windowId': tab.windowId, 'indices': indices,
                     'tab': tab, 'tabGroupColor': tgcolor});
                // was  {'function': 'tabGrouped', 'tgId': tgId, 'tabId': tid, 'tabIndex': tab.index});
            });
        });
    });
}

async function updateGroup(msg, sender) {
    // expand/collapse or name change on topic in topic manager, reflect in browser

    await chrome.tabGroups.update(msg.tabGroupId, {'collapsed': msg.collapsed, 'title': msg.title});
    check('UpdateGroup:');
}

function signalError(type, id) {
    // send back message so TM can fix display
    btSendMessage({'function': 'noSuchNode', 'type': type, 'id': id});
}
function showNode(msg, sender) {
    // Surface the window/tab associated with this node

    if (msg.tabId) {
        chrome.tabs.get(msg.tabId, function(tab) {
            check(); 
            if (!tab) { signalError('tab', msg.tabId); return;}
            chrome.windows.update(tab.windowId, {'focused' : true}, () => check());
            chrome.tabs.highlight({'windowId' : tab.windowId, 'tabs': tab.index},
                                  () => check());
        });
    }
    else if (msg.tabGroupId) {
        chrome.tabs.query({groupId: msg.tabGroupId}, function(tabs) {
            check(); 
            if (!tabs) { signalError('tabGroup', msg.tabGroupId); return;}
            if (tabs.length > 0) {
                let firstTab = tabs[0];
                chrome.windows.update(firstTab.windowId, {'focused' : true}, () => check());
                chrome.tabs.highlight({'windowId' : firstTab.windowId, 'tabs': firstTab.index},
                                      () => check());
            }
        });
    }
    else if (msg.windowId) {
        chrome.windows.update(msg.windowId, {'focused' : true}, () => check());
    }
}

function closeTab(msg, sender) {
    // Close a tab, NB tab listener will catch close and alert app

    const tabId = msg.tabId;
    chrome.tabs.get(tabId, function(tab) {
        check(); 
        if (!tab) { signalError('tab', tabId); return;}
        chrome.tabs.remove(tabId, ()=> check()); // ignore error
    });
}

async function moveTab(msg, sender) {
    // move tab to window.index
    try {
        const tab = await chrome.tabs.get(msg.tabId);
        if (!tab) { signalError('tab', msg.tabId); return;}
        await chrome.tabs.move(msg.tabId, {'windowId': msg.windowId, 'index': msg.index});
        if (msg.tabGroupId)
            await chrome.tabs.group({'groupId': msg.tabGroupId, 'tabIds': msg.tabId});
        console.log('Success moving tab.');
    } catch (error) {
        if (error == 'Error: Tabs cannot be edited right now (user may be dragging a tab).') {
            setTimeout(() => moveTab(msg, sender), 50);
        } else {
            console.error(error);
        }
    }
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
    chrome.storage.local.get(['currentTopic', 'currentText'], function(data) {
        if (!data.currentTopic) {
            chrome.action.setBadgeText({'text' : "", 'tabId' : tabId},
                                       () => check('Resetting badge text:'));
            chrome.action.setTitle({'title' : 'BrainTool'});
        } else {        
            let title = data.currentTopic.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            marquee(title, 0);
            chrome.action.setTitle({'title' : data.currentText || 'BrainTool'});
            chrome.action.setBadgeBackgroundColor({'color' : '#59718C'});
        }
    });
}

function brainZoom(msg, sender, iteration = 0) {
    // iterate thru icons to swell the brain
    const iterationArray = ['01','02', '03','04','05','06','07','08','09','10','05','04', '03','02','01'];
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
    chrome.action.setBadgeText({'text': '', 'tabId': msg.tabId});
    chrome.action.setIcon({'path': path, 'tabId': msg.tabId}, () => {
        // if action was Close tab might be closed by now
        if (chrome.runtime.lastError)
            console.log("!!Whoops, tab closed before Zoom.. " + chrome.runtime.lastError.message);
        else
            setTimeout(function() {brainZoom(msg, sender, ++iteration);}, 150);
    });
}
async function saveDroppedURLs(msg, sender) {
    // urls were dropped into the Topic tree from the addr bar or bookmark bar or bookmarks.
    // if there are open tabs send back saveTabs msgs w title, tabId etc
    // else send back saveTabs msg with url and title populated from Bookmarks or just url if not bookmark

    // Find all urls in msg.dropData string and iterate through them
    const urlRegex = /(https?:\/\/[^\s]+|file:\/\/[^\s]+)/g;
    const urls = new Set(msg.dropData.match(urlRegex));
    if (!urls || !urls.size) return;
    const parentTopic = msg.topic;
    const tabsToSave = [];

    // find all open tabs and check if any match the urls
    const allTabs = await getOpenTabs();
    allTabs.forEach((tab) => {
        if (urls.has(tab.url)) {
            console.log(`Matching tab found for URL: ${tab.url}`);
            tab.topic = parentTopic;
            tab.tabId = tab.id;
            tabsToSave.push(tab);
            urls.delete(tab.url);                   // Remove the URL from the Set
        }
    });
    
    // If there are still urls left in the Set, we need to check bookmarks
    if (urls.size) {
        const bookmarks = [];
        for (const url of urls) {
            const match = await chrome.bookmarks.search({ 'url': url });
            if (match && match.length) bookmarks.push(match[0]);
        }    
        if (bookmarks.length) {
            const nodeObjects = await generateBTNodesFromBookmarks(bookmarks);
            nodeObjects.forEach((node) => {
                const bookmark = {
                    url: node.url,
                    title: node.title,
                    topic: node.topic ? `${parentTopic}:${node.topic}`: parentTopic,
                };
                urls.delete(node.url);                   // Remove the URL from the Set
                tabsToSave.push(bookmark);
            });
        }
    }
    
    // If there are still urls left then we can't populate info just use the url
    urls.forEach((url) => {
        const bookmark = {
            url: url,
            title: url,
            topic: parentTopic
        };
        tabsToSave.push(bookmark);
    });

    // Send the tabsToSave array back to Topic Manager
    if (tabsToSave.length) {
        btSendMessage({'function': 'saveTabs', 'tabs': tabsToSave, 
                        'dropNodeId': msg.dropNodeId, 'note':'', close: false});
    }
}

async function saveTabs(msg, sender) {
    // handle save for popup. msg.type Could be Tab, TG, Window or Session.
    // msg: {'close','topic', 'note', 'title', 'currentWindowId' }
    // Create array of appropriate tab data and send to BT window

    const currentTabs = msg.currentWindowId ? await chrome.tabs.query({'active': true, 'windowId': msg.currentWindowId}) : [];
    const currentTab = currentTabs[0]|| {} ;
    const saveType = msg.type;
    const [BTTab, BTWin] = await getBTTabWin();
    const allTabs = await getOpenTabs();                             // array of tabs
    const allTGs = await getOpenTabGroups();                         // array of tgs

    // Create a hash of TGIds to TG names
    const tgNames = {};
    allTGs.forEach(tg => tgNames[tg.id] = tg.title);
    // ditto for windowIds
    const winNames = {};
    let numWins = 1;
    allTabs.forEach(t => winNames[t.windowId] = 'Window-'+numWins++);

    // Loop thru tabs, decide based on msg.type if it should be saved and if so add to array to send to BTTab
    const tabsToSave = [];
    allTabs.forEach(t => {
        if (t.id == BTTab || t.pinned) return;
        const tab = {'tabId': t.id, 'groupId': t.groupId, 'windowId': t.windowId, 'url': t.url,
                     'favIconUrl': t.faviconUrl, 'tabIndex': t.tabIndex, 'title': t.title};
        const tgName = tgNames[t.groupId] || '';                    // might want tabgroup name as topic
        const winName = winNames[t.windowId] || '';                 // might want window name as topic
        const [topic, todo] = msg.topic.split(/:(TODO|DONE)$/, 2);  // entered topic might have trailing :TODO or :DONE. split it off
        if (saveType == 'Tab' && t.id == currentTab.id) {
            tab['topic'] = topic+(todo ? ':'+todo : '');
            tab['title'] = msg.title;                               // original or popup-edited tab title
            tabsToSave.push(tab);
        }
        if (saveType == 'TG' && t.groupId == currentTab.groupId) {
            tab['topic'] = (topic ? topic+':' : '') + tgName + (todo ? ':' + todo : '');
            tabsToSave.push(tab);
        }
        if (saveType == 'Window' && t.windowId == currentTab.windowId) {
            tab['topic'] = (tgName ? topic+':'+tgName : topic)+(todo ? ':'+todo : '');
            tabsToSave.push(tab);
        }
        if (saveType == 'Session') {
            const sessionName = createSessionName();
            tab['topic'] = (topic ? topic+":" : "📝 SCRATCH:") + sessionName + (tgName ? tgName : winName) + (todo ? ':'+todo : '');
            tabsToSave.push(tab);
        }
        if (saveType == 'Tab' && t.url == msg.url) {
            // special case for msg sent from ui in case of tab drag onto tree
            tab['topic'] = msg.topic
            tab['title'] = t.title;                               // original or popup-edited tab title
            tabsToSave.push(tab);
        }
    });
    // Send save msg
    if (tabsToSave.length) 
        btSendMessage({'function': 'saveTabs', 'saveType':saveType, 'tabs': tabsToSave, 'note': msg.note, 'close': msg.close});
    currentTab && btSendMessage({'function': 'tabActivated', 'tabId': currentTab.id });        // ensure BT selects the current tab, if there is one
}

function setBrowserTheme(msg, sender) {
    // Set the browser extension icon based on the theme preference
    // Called from bt.js when the topic manager window gains focus
    
    const isDarkTheme = msg.theme === 'DARK';
    const iconPath = isDarkTheme ? 'images/BrainToolIconLight128.png' : 'images/BrainTool128.png';
    
    chrome.action.setIcon({'path': iconPath}, () => {
        check('setBrowserTheme');
        console.log(`Icon set to ${iconPath} for ${isDarkTheme ? 'dark' : 'light'} theme`);
    });
}

// Export functions for use by other modules
export { btSendMessage };
