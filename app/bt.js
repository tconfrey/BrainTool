/***
 *
 * Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/*** 
 * 
 * Manages the App window UI and associated logic.
 * NB Runs in context of the BT side panel, not background BT extension or helper btContent script
 * 
 ***/

'use strict'

// Import all dependencies
import { sendMessage, callBackground, registerMessageHandler } from './extensionMessaging.js';
import { BTNode, AllNodes } from './BTNode.js';
import { setConfigAndKeys, getProp, setProp, setStat, incrementStat, initializeInstallDate } from './configManager.js';
import { messageManager } from './messageManager.js';
import { BTAppNode, Topics } from './BTAppNode.js';
import { saveBT, syncEnabled, handleStartupFileConnection, updateStatsRow, checkBTFileVersion, setBTFileText } from './fileManager.js';
import { registerProcessImport as registerProcessImportBM } from './bookmarksManager.js';
import { checkLicense } from './subscriptionManager.js';
import { refreshTable, processBTFile, initializeNotesColumn, initializeUI, moveNode, rememberFold } from './tableManager.js';
import { deleteNode, openRow, closeRow, toDo, editRow, deleteRow, addChild, promote } from './rowManager.js';
import { registerProcessImport as registerProcessImportParser } from './parser.js';
import { closeConfigDisplays } from './applicationUI.js'
import { initializeSessionManager } from './sessionManager.js';

const OptionKey = /Mac/i.test(navigator.platform) ? "Option" : "Alt";
var UpgradeInstall = false;
var MRUTopicPerWindow = {};                               // map winId to mru topic
var BTTabId = null;                                       // tabId of BT
var BTWinId = null;                                       // winId of BT

/***
 *
 * Opening activities
 *
 ***/

async function launchApp(msg) {
    // Launch app w data passed from extension local storage
    
    // Register callbacks with dependent modules
    registerProcessImportParser(processImport);
    registerProcessImportBM(processImport);
    
    setConfigAndKeys(msg);
    setProp('InitialInstall', msg.initial_install);
    UpgradeInstall = msg.upgrade_install;                   // null or value of 'previousVersion'
    BTTabId = msg.BTTab;                                    // knowledge of self
    BTWinId = msg.BTWin;                                    // got mad knowledge of self
    setProp('BTTabId', BTTabId);
    setProp('BTWindowId', BTWinId);
    if (msg.SidePanel) setProp('BTManagerHome', 'SIDEPANEL');              // track if running in side panel

    setBTFileText(msg.BTFileText);
    processBTFile();                                          // create table etc
    
    // scroll to top
    $('html, body').animate({scrollTop: '0px'}, 300);

    // If a backing store file was previously established, re-set it up on this startup
    handleStartupFileConnection(refreshTable);

    // Get BT sub id => premium 
    // BTId in local store and from org data should be the same. local store is primary
    if (msg?.Config?.BTId) {
	    const msgBTId = msg.Config.BTId;
        if (getProp('BTId') && (msgBTId != getProp('BTId')))
	        alert(`Conflicting subscription id's found! This should not happen. I'm using the local value, if there are issues contact BrainTool support.\nLocal value:${msgBTId}\nOrg file value:${getProp('BTId')}`);
        setProp('BTId', msgBTId);
    } else {
	    // get from file if not in local storage and save locally (will allow for recovery if lost)
	    if (getProp('BTId')) {
	        setProp('BTId', getProp('BTId'));
	    }
    }
    
    // check for license, and if sub that its still valid else check to see if we shoudl nag
    if (getProp('BTId') && await checkLicense()) updateLicenseSettings();
    if (!getProp('BTId')) potentiallyNag();

    // show Alt or Option appropriately in visible text (Mac v PC)
    $(".alt_opt").text(OptionKey);

    // Udate the icon color theme
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    sendMessage({
        'function': 'setBrowserTheme', 
        'theme': isDark ? 'DARK' : 'LIGHT'
    });

    handleInitialTabs(msg.all_tabs, msg.all_tgs);         // handle currently open tabs
    setTimeout(() => sendMessage({'function': 'getBookmarksBar'}), 1);         // bookmarks bar is not saved, sync on startup, giving time for allNodes to be populated.
    initializeSearch();                                   // set up search box event handlers
    initializeNotesColumn();                              // set up notes column width based on slider saved position
    adjustForNarrowWindow();                              // tweak display if window is narrow
    updateStats();                                        // record numlaunches etc
    UpgradeInstall && runUpgrade(msg.BTVersion);          // run any upgrade specific code

    if (!getProp('BTDontShowIntro'))
        messageManager.showIntro();
}
function runUpgrade(version) {
    // Run any upgrade specific code for the given version.
    switch (version) {
    case '1.3.0':
        // First version with bookmarks bar sync. Create the special topic node
        BTAppNode.findOrCreateBookmarksBarNode();
        break;
    }
}

function updateLicenseSettings() {
    // Update UI based on license status
    
    // valid subscription, toggle from sub buttons to portal link
    $('#settingsSubscriptionAdd').hide();
    $('#settingsSubscriptionStatus').show();
    $('#youShallNotPass').hide();
    if (getProp('BTExpiry') == 8640000000000000) {
        // permanant license
        $('#otp').show();
        $('#sub').hide();
        $('#portalLink').hide();
    } else {
        // time limited sub
        $('#otp').hide();
        $('#sub').show();
        $('#renewDate').text(new Date(getProp('BTExpiry')).toLocaleDateString());
    }
    $('.subId').text(getProp('BTId'));
}

function updateStats() {
    // read and update various useful stats, only called at startup
    // NB before gtag calls some stats as for the previous session (eg BTSessionStartTime)
    
    // Record this launch and software version. also update version shown in ui help.
    const BTAppVersion = getProp('BTAppVersion');
    $("#BTVersion").html(`<i>(Version: ${BTAppVersion})</i>`);

    gtag('event', 'launch_'+BTAppVersion, {'event_category': 'General', 'event_label': BTAppVersion,
                             'value': 1});    
    if (getProp('InitialInstall')) {
        gtag('event', 'install', {'event_category': 'General', 'event_label': getProp('InitialInstall'),
                                  'value': 1});
        setStat('BTInstallDate', Date.now());
    }
    if (UpgradeInstall)
        gtag('event', 'upgrade', {'event_category': 'General', 'event_label': UpgradeInstall,
                                  'value': 1});

    // Calculate some other stat info (and do some one-time setup of installDate and numSaves)
    let stats = getProp('BTStats');
    if (!stats['BTNumSaves']) setStat('BTNumSaves', 0);
    if (!stats['BTInstallDate']) initializeInstallDate();
    incrementStat('BTNumLaunches');         // this launch counts
    stats = getProp('BTStats');
    
    const lastSessionMinutes =
          parseInt((stats['BTLastActivityTime'] - stats['BTSessionStartTime']) / 60000);
    const daysSinceInstall =
          parseInt((Date.now() - stats['BTInstallDate']) / 60000 / 60 / 24);
    const currentOps = stats['BTNumTabOperations'] || 0;
    const currentSaves = stats['BTNumSaves'] || 0;
    const lastSessionOperations = currentOps - (stats['BTSessionStartOps'] || 0);
    const lastSessionSaves = currentSaves - (stats['BTSessionStartSaves'] || 0);

    // Record general usage summary stats, they don't apply on first install
    if (!getProp('InitialInstall')) {
        gtag('event', 'total_launches', {'event_category': 'Usage', 'event_label': 'NumLaunches',
                                     'value': stats['BTNumLaunches']});
        gtag('event', 'total_saves', {'event_category': 'Usage', 'event_label': 'NumSaves',
                                     'value': stats['BTNumSaves']});
        gtag('event', 'total_tab_operations', {'event_category': 'Usage', 'event_label': 'NumTabOperations',
                                     'value': stats['BTNumTabOperations'] || 0});
        gtag('event', 'total_nodes', {'event_category': 'Usage', 'event_label': 'NumNodes',
                                     'value': AllNodes.length});
        gtag('event', 'num_session_minutes', {'event_category': 'Usage', 'event_label': 'LastSessionMinutes',
                                     'value': lastSessionMinutes});
        gtag('event', 'num_session_saves', {'event_category': 'Usage', 'event_label': 'LastSessionSaves',
                                     'value': lastSessionSaves});
        gtag('event', 'num_session_operations', {'event_category': 'Usage', 'event_label': 'LastSessionOperations',
                                     'value': lastSessionOperations});
        gtag('event', 'total_days_since_install', {'event_category': 'Usage', 'event_label': 'DaysSinceInstall',
                                     'value': daysSinceInstall});
    }

    // Overwrite data from previous session now that its recorded
    setStat('BTSessionStartTime', Date.now());
    setStat('BTSessionStartSaves', currentSaves);
    setStat('BTSessionStartOps', currentOps);

    // show message or tip. Reset counter on upgrade => new messages
    if (getProp('InitialInstall') || UpgradeInstall) setProp('BTLastShownMessageIndex', 0);
    messageManager.setupMessages();
}

function potentiallyNag() {
    // Nagging check, called on startup
    if (getProp('BTId')) return;
    const installDate = new Date(getProp('BTInstallDate'));
    const today = new Date();
    const daysSinceInstall = Math.floor((today - installDate) / (24 * 60 * 60 * 1000));
    if (daysSinceInstall > 30) {
        openTrialExpiredWarning();
        $('#settingsBackups :checkbox').prop('checked', false);
        setProp('BTBackupsOn', false);
    }
}

function openTrialExpiredWarning() {
    // show trial expired warning section and call to arms, slide tree down to accomodate
    $("#trialExpiredWarning").show();
    $("#content").css("margin-top", "220px");
}

function handleFocus(e) {
    // BTTab comes to top
    document.activeElement.blur();                      // Links w focus interfere w BTs selection so remove
    warnBTFileVersion(e);                               // check file version, warn if stale,
    // Take this opportunity to update the icon color theme
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    sendMessage({
        'function': 'setBrowserTheme', 
        'theme': isDark ? 'DARK' : 'LIGHT'
    });
}

function adjustForNarrowWindow() {
    // Display changes when window is narrow
    if ($(window).width() < 400) {
        $("#content").addClass('compactMode');
        $("#search").css('left', 'calc((100% - 175px) / 2)');
        $("#searchHint .hintText").css('display', 'none');
    } else {
        $("#content").removeClass('compactMode');
        $("#search").css('left', 'calc((100% - 300px) / 2)');
        $("#searchHint .hintText").css('display', 'inline');    
    }
    updateStatsRow();
    initializeNotesColumn();
}
$(window).resize(() => adjustForNarrowWindow());

async function checkFileFreshness() {
    // POpup has opened, shoudl we warn the file is stale?
    if (!syncEnabled()) return;
    const warnNewer = await checkBTFileVersion();
    if (warnNewer)
        sendMessage({'function': 'warnStaleFile'});
}

async function warnBTFileVersion(e) {
    // warn in ui if there's a backing file and its newer than local data or if GDrive auth has expired

    if (!syncEnabled()) return;

    const warnNewer = await checkBTFileVersion();
    if (warnNewer) {
        const cb = async () => { refreshTable(true); messageManager.removeWarning(); };
        messageManager.showWarning("The synced version of your BrainTool file has newer data. <br/>Click here to refresh or disregard and it will be overwritten on the next save.", cb);
    }
}

async function handleInitialTabs(tabs, tgs) {
    // array of {url, id, groupid, windId} passed from ext. mark any we care about as open

    const topicsToGroup = new Set();
    const tabPromises = tabs.map(async (tab) => {
	    const node = BTNode.findFromURL(tab.url) || await BTAppNode.findFromAlias(tab.url);
	    if (!node) return;

        setNodeOpen(node);                                  // set and propogate open in display
        node.tabId = tab.id;
        node.windowId = tab.windowId;
        node.tabIndex = tab.tabIndex;
        MRUTopicPerWindow[node.windowId] = node.topicPath;
        if (tab.groupId > 0) {
            node.tabGroupId = tab.groupId;
            const tg = tgs.find(tg => tg.id == tab.groupId);
            if (tg) node.setTGColor(tg.color);
        }
        if (node.parentId && AllNodes[node.parentId]) {
            (tab.groupId <= 0) && topicsToGroup.add(AllNodes[node.parentId]); // not grouped currently, handle creating/assigning as needed on startup
            AllNodes[node.parentId].windowId = node.windowId;
            AllNodes[node.parentId].tabGroupId = node.tabGroupId;
        }
    });
    await Promise.all(tabPromises);                         // wait for all to complete => node.parent.tabGroupId is set

    if (tgs)
        tgs.forEach((tg) => {
            tabGroupUpdated({'tabGroupId': tg.id, 'tabGroupColor': tg.color, 'tabGroupName': tg.title,
                            'tabGroupCollapsed': tg.collapsed, 'tabGroupWindowId': tg.windowId});
            const node = BTAppNode.findFromGroup(tg.id);
            if (node) topicsToGroup.add(node);
        });

    // now group any topics that need it
    topicsToGroup.forEach((node) => {
        node.groupAndPosition();
    });

    // remember topic per window for suggestions in popup
    setProp('mruTopics', MRUTopicPerWindow);
    updateStatsRow();
}

/***
 * 
 * Handle relayed messages from Content script. Notifications that user has done something, 
 * or background has done something on our behalf.
 * 
 ***/

function tabOpened(data, highlight = false) {
    // handle tab open message
    
    const nodeId = data.nodeId;
    const node = AllNodes[nodeId];
    const tabId = data.tabId;
    const tabGroupId = data.tabGroupId;
    const tabIndex = data.tabIndex;
    const windowId = data.windowId;
    const parentId = AllNodes[nodeId]?.parentId || nodeId;
    const currentParentWin = AllNodes[parentId].windowId;

    node.tabId = tabId;         
    node.windowId = windowId;
    node.tabIndex = tabIndex;
    node.opening = false;
    AllNodes[parentId].windowId = windowId;
    if (tabGroupId) {
        AllNodes[parentId].tabGroupId = tabGroupId;
        node.tabGroupId = tabGroupId;
    }
    updateTabIndices(data.indices)                   // make sure indicies are up to date after change
    setNodeOpen(node);    
    initializeUI();
    tabActivated(data);                             // also perform activation stuff
    
    if (highlight) {
        const row = $("tr[data-tt-id='"+nodeId+"']");
        row.addClass("hovered",
                     {duration: 1000,
                      complete: function() {
                          row.removeClass("hovered", 1000);
                      }});
    }

    // Cos of async nature can't guarantee correct position on creation, reorder if we care
    if ((getProp('BTGroupingMode') || 'TABGROUP') == 'NONE') return;
    if (windowId == currentParentWin)
        // we never automatically move tabs between windows
        AllNodes[parentId].groupAndPosition();
    else
        node.tabGroupId || node.putInGroup();      // don't group w others, just wrap in TG if not already
    return;
}

function tabClosed(data) {
    // handle tab closed message, also used by tabNavigated when BT tab is navigated away

    function propogateClosed(parentId) {
        // node not open and recurse to parent
        if (!parentId) return;                                  // terminate recursion

        const parent = AllNodes[parentId];
        // might have both last child closing but also have grandchildren
        if (!parent.hasOpenChildren()) {
            parent.windowId = 0;
            parent.tabGroupId = 0;
        }

        if (parent.hasOpenDescendants()) return;                // terminate recursion
        const parentElt = $("tr[data-tt-id='"+parentId+"']");
        parentElt.removeClass("opened");
        parentElt.addClass("hovered",
                           {duration: 1000,
                            complete: function() {
                                parentElt.removeClass("hovered", 1000);
                            }});
        // propogate up tree to dehighlight ancestors as appropriate
        propogateClosed(parent.parentId);
    };

    data.indices && updateTabIndices(data.indices)                   // make sure indicies are up to date after change
    const tabId = data.tabId;
    const node = BTAppNode.findFromTab(tabId);
    if (!node) return;
    node.tabId = 0;
    node.tabGroupId = 0;
    node.tabIndex = 0;
    node.windowId = 0;
    node.opening = false;
    node.navigated = false;
    data.tabId && tabActivated(data);

    // update ui and animate parent to indicate change
    $("tr[data-tt-id='"+node.id+"']").removeClass("opened", 1000);
    propogateClosed(node.parentId);
    updateStatsRow();

    // set parent window and tgids. handle case where tabs r open in multiple windows
    if (node.parentId && AllNodes[node.parentId]) {
        const parent = AllNodes[node.parentId];
        if (!parent.hasOpenChildren())
            AllNodes[node.parentId].tabGroupId = 0;
        else if (parent.openWindowIds().indexOf(parent.windowId) < 0) {
            const openNode = parent.findAnOpenNode();
            parent.tabGroupId = AllNodes[openNode].tabGroupId;
            parent.windowId = AllNodes[openNode].windowId;
        }
    }
    
}

function saveTabs(data) {
    // iterate thru array of tabsData and save each to BT
    // data is of the form: {'function': 'saveTabs', 'saveType':Tab|TG|Window|Session, 'tabs': [], 'note': msg.note,  'close': msg.close, 'dropNodeId': node.id}
    // tabs: [{'tabId': t.id, 'groupId': t.groupId, 'windowId': t.windowId, 'url': t.url, 'topic': topic, 'title': msg.title, favIconUrl: t.favIconUrl}] 
    // topic is potentially topic-dn:window##:TGName:TODO
    // dropNodeId is passed back from app, keeping track of the node to create dropped urls under in the tree

    console.log('saveTabs: ', data);
    if (data.from == "btwindow") return;                  // ignore our own messages
    const note = data.note;
    const close = data.close;

    // Iterate tabs and create btappNodes as needed
    const changedTopicNodes = new Set();
    data.tabs.forEach(tab=> {

        // Handle existing node case: update and return
        const existingNode = tab.tabId && BTAppNode.findFromTab(tab.tabId);
        if (existingNode && !existingNode.navigated) {
            if (note) {
                existingNode.text = note;
                existingNode.redisplay();
                
                // Update sister nodes with same text, if they haven't navigated away
                const sisterNodes = existingNode.sisterNodes();
                sisterNodes.forEach(sisterNode => {
                    if (!existingNode.isTopic() && !BTNode.compareURLs(sisterNode.URL, existingNode.URL)) {
                        return;
                    }
                    sisterNode.text = note;
                    sisterNode.redisplay();
                });
            }
            if (close) existingNode.closeTab(); 
            return;           // already saved, ignore other than making any note update
        }

        // Find or create topic, use existingNodes topic if it exists
        let topicNode, keyword, topicDN;
        if (existingNode) {
            tabClosed({"tabId": tab.tabId});      // tab navigated away, clean up
            topicNode = AllNodes[existingNode.parentId];
            topicDN = topicNode.topicPath;
        } else {
            [topicDN, keyword] = BTNode.processTopicString(tab.topic || "📝 SCRATCH");
            topicNode = BTAppNode.findOrCreateFromTopicDN(topicDN);
        }
        changedTopicNodes.add(topicNode);

        // Create and populate node
        const title = cleanTitle(tab.title);                    // get rid of unprintable characters etc
        const node = new BTAppNode(`[[${tab.url}][${title}]]`, topicNode.id, note || "", topicNode.level + 1);
        node.tabId = tab.tabId; node.windowId = tab.windowId;
        topicNode.windowId = tab.windowId;
        if (tab.groupId > 0) {                                  // groupid = -1 if not set
            node.tabGroupId = tab.groupId;
            topicNode.tabGroupId = tab.groupId;
        } else {
            node.tabGroupId = topicNode.tabGroupId;
        }
        node.faviconUrl = tab.favIconUrl; node.tabIndex = tab.tabIndex;
        if (keyword) node.keyword = keyword;

        // handle display aspects of single node
        $("table.treetable").treetable("loadBranch", topicNode.getTTNode(), node.HTML());
        if (close) node.closeTab(); else node.tabId && setNodeOpen(node);     // save and close popup operation
        node.storeFavicon(); node.populateFavicon();
        MRUTopicPerWindow[node.windowId] = topicDN;             // track mru topic per window for popup population
        if (data.dropNodeId) {
            // save is a result of an earlier drop of external urls, position appropriately. 
            // newTopNodeId is passed back from findOrCreateFromTopicDN indicating the top new node created, if any
            // so that it can be positioned under the dropNodeId
            const newNodeId = topicNode.newTopNodeId ? topicNode.id : node.id;
            const newNode = $("tr[data-tt-id='"+newNodeId+"']")[0];
            const dropNode = $("tr[data-tt-id='"+data.dropNodeId+"']")[0];
            const parentId = topicNode.newTopNodeId ? topicNode.parentId : topicNode.id;
            positionNode(newNode, parentId, dropNode);
            topicNode.newTopNodeId = 0;            // reset flag
        }
    });

    // update subtree of each changed topic node
    changedTopicNodes.forEach(node => {
        node.redisplay();
        if (!close) node.groupAndPosition();
    });

    // update topic list, sync extension, reset ui and save changes.
    BTAppNode.generateTopics();
    let lastTopicNode = Array.from(changedTopicNodes).pop();
    sendMessage({'function': 'localStore', 
                        'data': { 'topics': Topics, 'mruTopics': MRUTopicPerWindow, 'currentTopic': lastTopicNode?.topicName() || '', 'currentText': note}});
    sendMessage({'function' : 'brainZoom', 'tabId' : data.tabs[0].tabId});

    initializeUI();
    saveBT();
}


function tabPositioned(data, highlight = false) {
    // handle tab move, currently as a result of an earlier groupAndPosition - see StoreTabs and tabOpened
    
    const nodeId = data.nodeId;
    const node = AllNodes[nodeId];
    const tabId = data.tabId;
    const tabGroupId = data.tabGroupId;
    const tabIndex = data.tabIndex;
    const windowId = data.windowId;
    const parentId = AllNodes[nodeId]?.parentId || nodeId;
    const parent = AllNodes[parentId];
    
    if (!node) return;
    node.tabId = tabId;         
    node.windowId = windowId;
    node.tabIndex = tabIndex;
    node.opening = false;
    parent.windowId = windowId;
    if (tabGroupId) {
        parent.tabGroupId = tabGroupId;
        node.tabGroupId = tabGroupId;
    }
    // Update UI to reflect the node's new status
    setNodeOpen(node);
    node.setTGColor(parent.tgColor);
    updateStatsRow();
}

function tabNavigated(data) {
    // tab updated event, could be nav away or to a BT node or even between two btnodes
    // if tabs are sticky, tab sticks w original BTnode, as long as:
    // 1) it was a result of a link click or server redirect (ie not a new use of the tab like typing in the address bar) or
    // 2) its not a nav to a different btnode whose topic is open in the same window

    function stickyTab() {
        // Should the tab stay associated with the BT node
        if (getProp('BTStickyTabs') == 'NOTSTICKY') return false;
        if (!transitionData) return true;                           // single page app or nav within page
        if (transitionQualifiers.includes('from_address_bar')) 
            return false;                                           // implies explicit user nav, nb order of tests important
        if (transitionTypes.includes('auto_bookmark')) 
            return false;                                           // implies explicit user nav from bookmarks
        if (transitionTypes.some(type => ['link', 'reload', 'form_submit'].includes(type))) return true;
        if (transitionQualifiers.includes('server_redirect')) return true; 
        return false;
    }
    function closeAndUngroup() {
        data['nodeId'] = tabNode.id;
        tabClosed(data);
        callBackground({'function' : 'ungroup', 'tabIds' : [tabId]});
    }

    const tabId = data.tabId;
    const tabUrl = data.tabURL;
    const groupId = data.groupId;
    const windowId = data.windowId;
    const tabNode = BTAppNode.findFromTab(tabId);
    const urlNode = BTAppNode.findFromURLTGWin(tabUrl, groupId, windowId);
    const parentsWindow = urlNode?.parentId ? AllNodes[urlNode.parentId]?.windowId : null;
    const transitionData = data.transitionData;
    const transitionTypes = transitionData?.transitionTypes || [];
    const transitionQualifiers = transitionData?.transitionQualifiers || [];
    const sticky = stickyTab();

    if (tabNode && urlNode && (tabNode == urlNode)) return;     // nothing to see here, carry on

    if (tabNode) {
        // activity was on managed active tab
        windowId && (tabNode.windowId = windowId);
        if (!BTNode.compareURLs(tabNode.URL, tabUrl)) {
            // if the url on load complete != initial => redirect or nav away
            if (tabNode.opening) {
                // tab gets created (see tabOpened) then a status complete event gets us here
                console.log(`redirect from ${tabNode.URL} to ${tabUrl}`);
                tabNode.URL = tabUrl;                       
            }
            else {
                // Might be nav away from BT tab or maybe the tab sticks with the BT node
                if (sticky) {
                    tabNode.navigated = true;
                    tabNode.storeAlias(tabUrl);
                    tabActivated(data);         // handles updating localstorage/popup with current topic etc
                }
                else closeAndUngroup();
            }
        }
        tabNode.opening = false;
    }

    if (urlNode && (parentsWindow == windowId)) {
        // nav into a bt node from an open tab, ignore if parent/TG open elsewhere else handle like tab open
        if (tabNode && sticky) closeAndUngroup();       // if sticky we won't have closed above but if urlnode is in same window we should
        data['nodeId'] = urlNode.id;
        tabOpened(data, true);
        return;
    }
    if (urlNode && !parentsWindow && (!tabNode || !sticky)) {
        // nav into a bt node from an open tab, set open if not open elsewhere and url has not stuck to stick tabnode
        data['nodeId'] = urlNode.id;
        tabOpened(data, true);
        return;
    }
    
    // Otherwise just a new tab. Take out of BT TG if its in one owned by BT
    const tgParent = BTAppNode.findFromGroup(data.groupId);
    if (tgParent && !tabNode)
        callBackground({'function' : 'ungroup', 'tabIds' : [tabId]});
}

function tabActivated(data) {
    // user switched to a new tab or win, fill in storage for popup's use and select in ui

    const tabId = data['tabId'];
    const winId = data['windowId'];

    if (tabId == BTTabId) {
        handleFocus({'reason': 'BTTab activated'});       // special case when the tab is us!
        return;
    }

    const groupId = data['groupId'];
    const node = BTAppNode.findFromTab(tabId) || BTAppNode.findFromTab(tabId, {isSession: true});  // show in session if not saved.
    const winNode = BTAppNode.findFromWindow(winId);
    const groupNode = BTAppNode.findFromGroup(groupId);
    let m1, m2 = {'windowTopic': winNode ? winNode.topicPath : '',
                  'groupTopic': groupNode ? groupNode.topicPath : '', 'currentTabId' : tabId};
    if (node) {
        node.topicPath || BTNode.generateUniqueTopicPaths();
        changeSelected(node);            // select in tree
        m1 = {'currentTopic': node.topicPath, 'currentText': node.text, 'currentTitle': node.displayTopic, 'tabNavigated': node.navigated};
    }
    else {
        m1 = {'currentTopic': '', 'currentText': '', 'currentTitle': '', 'tabNavigated': false};
        clearSelected();
    }
    sendMessage({'function': 'localStore', 'data': {...m1, ...m2}});

    if ((getProp('BTManagerHome') == 'SIDEPANEL') && (winId == BTWinId)) {
        handleFocus({'reason': 'BTTab activated'});       // window w BT Sidepanel got focus
        return;
    }
}

function tabReplaced(data) {
    // Handle tab id changes (due to tab suspension or prerendering)
    const oldId = data.removedTabId;
    const newId = data.addedTabId;
    const node = BTAppNode.findFromTab(oldId);
    if (node) {
        node.tabId = newId;
    }
}

function tabGroupCreated(data) {
    // TG created update associated topic color as appropriate

    const tgId = data.tabGroupId;
    const color = data.tabGroupColor;
    const topicId = data.topicId;
    const node = BTAppNode.findFromGroup(tgId) || AllNodes[topicId];
    if (!node) return;                             // no node, no TG
    node.tabGroupId = tgId;
    node.setTGColor(color);
}

function tabGroupUpdated(data){
    // TG updated update associated topic as appropriate

    const tgId = data.tabGroupId;
    const windowId = data.tabGroupWindowId;
    const color = data.tabGroupColor;
    const name = data.tabGroupName;
    const collapsed = data.tabGroupCollapsed;
    const node = BTAppNode.findFromGroup(tgId);
    const displayNode = node?.getDisplayNode();
    if (!node || !displayNode) return;
    node.windowId = windowId;
    
    if (color)
        node.setTGColor(color);
    
    if (name && (name != node.title)) {
        node.title = name;
        $(displayNode).find(".btTitle").html(name);
    }
    if (collapsed === undefined) return; 
    Window.BrainTool.browserUpdate = true;        // prevent feedback loop
    if (collapsed) $("table.treetable").treetable("collapseNode", node.id);
    if (!collapsed) $("table.treetable").treetable("expandNode", node.id);
    delete Window.BrainTool.browserUpdate;
}

function tabJoinedTG(data) {
    // tab joined TG, update tab and topic nodes as appropriate
    // NB Get here when an existing page is opened in its TG as well as page moving between TGs and tabgrouping being turned on from settings.
    // known TG but unknown node => unmanaged tab dropped into managed TG => save it to the topic

    if ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP') return;                              // don't care
    const tabId = data.tabId;
    const tgId = data.groupId;
    const winId = data.windowId;
    const tab = data.tab;
    const index = data.tabIndex;
    const indices = data.indices;

    let tabNode = BTAppNode.findFromTab(tabId);
    const topicNode = BTAppNode.findFromGroup(tgId);
    if (!topicNode && !tabNode) return;                             // don't care
    const tabGroupColor = data.tabGroupColor || topicNode?.tgColor;

    if (tabNode && !topicNode) {
        // settings toggle => update parent w tg info
        const tgParent = AllNodes[tabNode.parentId];
        tabNode.windowId = winId;
        tabNode.tabGroupId = tgId;
        tgParent.tabGroupId = tgId;
        tgParent.windowId = winId;
        return;
    }

    if (!tabNode) {
        // tab dropped into managed TG => save it to the topic
        tabNode = new BTAppNode(`[[${tab.url}][${tab.title}]]`, topicNode.id,
                                    "", topicNode.level + 1);
        tabNode.tabId = tabId;
        tabNode.tabGroupId = tgId;
        tabNode.faviconUrl = tab.favIconUrl;
        $("table.treetable").treetable("loadBranch", topicNode.getTTNode(), tabNode.HTML());
        tabNode.storeFavicon();
        tabNode.populateFavicon();
        initializeUI();
        tabActivated(data);             // handles setting topic etc into local storage for popup
        changeSelected(tabNode);
        setNodeOpen(tabNode);
        positionInTopic(topicNode, tabNode, index, indices, winId);
        return;
    }

    // remaining option - tab moved within or between TGs
    tabNode.tabGroupId = tgId;
    if (tabNode.trashed && !topicNode.trashed && !topicNode.isTrash()) {
        // Moved into a non-trashed topic => untrash it
        tabNode.untrash();
    }
    // Might need to update positioning
    positionInTopic(topicNode, tabNode, index, indices, winId);
    topicNode.setTGColor(tabGroupColor);        // update topic color to match TG
}

function tabLeftTG(data) {
    // user moved tab out of TG => no longer managed => move to Trash
    
    if ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP') return;
    const tabId = data.tabId;
    const tabNode = BTAppNode.findFromTab(tabId);
    const groupId = data.groupId;
    if (!tabNode) return;
    deleteNode(tabNode.id, true);
}

function tabMoved(data) {
    // tab's position changed, ie tab index in window, or new window. 
    // NB data.indices maps tabId to index. need to reset globally since moves change other tabs

    const tabId = data.tabId;
    const tgId = data.groupId;
    let tabNode = BTAppNode.findFromTab(tabId);
    const topicNode = BTAppNode.findFromGroup(tgId);        
    const index = data.tabIndex;
    const winId = data.windowId;
    const indices = data.indices;
    const tab = data.tab;
    if (!tabNode && !topicNode) return;                                 // don't care

    if (!tabNode) {
        // known TG but unknown node => unmanaged tab dropped into managed TG => save it to the topic
        tabNode = new BTAppNode(`[[${tab.url}][${tab.title}]]`, topicNode.id,
                                "", topicNode.level + 1);
        tabNode.tabId = tabId;
        tabNode.tabGroupId = tgId;
        tabNode.faviconUrl = tab.favIconUrl;
        $("table.treetable").treetable("loadBranch", topicNode.getTTNode(), tabNode.HTML());
        tabNode.populateFavicon();
        initializeUI();
        changeSelected(tabNode);
    }

    // Now position the node within its topic.
    if (topicNode) positionInTopic(topicNode, tabNode, index, indices, winId);
}

function sidePanelMouseOut() {
    // Message from containing sidepanel, remove tooltips, hovers etc
    $("#buttonRow").hide();
    if (window.mouseOutStyle) return;           // already set
    const newStyle = '[data-wenk]:hover:after {visibility: hidden;}'
    const style = document.createElement('style');
    style.textContent = newStyle;
    document.head.appendChild(style);
    window.mouseOutStyle = style;
}

function noSuchNode(data) {
    // we requested action on a tab or tg that doesn't exist, clean up
    // NB Ideally this would trigger a re-sync of the BT tree but that's a job for later
    if (data.type == 'tab')
        tabClosed({'tabId': data.id});
    if (data.type == 'tabGroup')
        console.log(`No such tab group ${data.id}, should handle this case`);
}
        
    
// Utility functions for the above

function positionInTopic(topicNode, tabNode, index, indices, winId) {
    // Position tab node under topic node as per tab ordering in browser
    
    // first update indices and find where tabNode should go under topicNode.
    for (let [tabId, tabData] of Object.entries(indices)) {
        let n = BTAppNode.findFromTab(tabId);
        if (n) n.tabIndex = tabData.index;
    }
    let dropUnderNode = topicNode;
    const leftIndex = topicNode.leftmostOpenTabIndex();
    if (index > leftIndex) {
        for (let [tabId, tabData] of Object.entries(indices)) {
            if ((tabData.windowId == winId) && (tabData.index == (index - 1)))
                dropUnderNode = BTAppNode.findFromTab(tabId);
        }
    } 
    if (dropUnderNode?.tabGroupId != tabNode.tabGroupId) return;
    
    const dispNode = tabNode.getDisplayNode();
    const underDisplayNode = dropUnderNode.getDisplayNode();
    if ($(dispNode).prev()[0] != underDisplayNode)
        moveNode(tabNode, dropUnderNode, tabNode.parentId, true);
    tabNode.setTGColor(dropUnderNode.tgColor);
    tabNode.windowId = winId;
    updateTabIndices(indices);
}

function cleanTitle(text) {
    if (!text) return "";
    // NOTE: Regex is from https://stackoverflow.com/a/11598864
    const clean_non_printable_chars_re = /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g;
    // clean page title text of things that can screw up BT. Currently [] and non printable chars
    return text.replace("[", '').replace("]", '').replace(clean_non_printable_chars_re, '');
}

function setNodeOpen(node) {
    // utility - show as open in browser, propagate upwards as needed above any collapsed nodes

    function propogateOpened(parentId) {
        // recursively pass upwards adding opened class if appropriate
        if (!parentId) return;               // terminate recursion
        if ($("tr[data-tt-id='"+parentId+"']").hasClass("collapsed"))
            $("tr[data-tt-id='"+parentId+"']").addClass("opened");
        propogateOpened(AllNodes[parentId].parentId);
    };

    const parentId = node.parentId;
    $("tr[data-tt-id='"+node.id+"']").addClass("opened");
    AllNodes[parentId] && node.setTGColor(AllNodes[parentId].tgColor);
    $("tr[data-tt-id='"+parentId+"']").addClass("opened");
    propogateOpened(parentId);
}

function clearSelected() {
    // utility - unselect tt node if any
    const currentSelection = $("tr.selected")[0];
    if (currentSelection) {
        $("tr.selected").removeClass('selected');
        const node = $(currentSelection).attr("data-tt-id");
	    AllNodes[node.parentId]?.unshowForSearch();
    }
}

function changeSelected(node) {
    // utility - make node visible and selected, unselected previous selection

    // Unselect current selection
    const currentSelection = $("tr.selected")[0];
    clearSelected();
    if (!node) return;                          // nothing to select, we're done
    
	const tableNode =  node.getDisplayNode();
    if (!tableNode) return;
    
    const wasHidden = !$(tableNode).is(':visible');
	if(wasHidden) {
        // Make sure the containment hierarchy for this node is visible and then show it and siblings
        let parentId = node.parentId;
        $("table.treetable").treetable("collapseNode", parentId);
        $("table.treetable").treetable("expandNode", parentId);
	    AllNodes[parentId].showForSearch();				    // unfold tree etc as needed
    }
	currentSelection && $(currentSelection).removeClass('selected');
	$(tableNode).addClass('selected');

    // Make sure row is visible - if we just expanded, wait for animation to complete
    const scrollIntoViewIfNeeded = () => {
        const topOfRow = $(node.getDisplayNode()).position().top;
        const displayTop = $(document).scrollTop();
        const height = $(window).height();
        if ((topOfRow < displayTop) || (topOfRow > (displayTop + height - 190)))
            tableNode.scrollIntoView({block: 'center'});
    };
    
    if (wasHidden) {
        // Wait for expand animation to complete - get animation time from treetable settings
        const animationTime = $("#content").data("treetable")?.settings?.animationTime || 250;
        setTimeout(scrollIntoViewIfNeeded, animationTime + 50);  // +50ms buffer for safety
    } else {
        scrollIntoViewIfNeeded();
    }
    
	$("#search_entry").val("");				    // clear search box on nav
}

function updateTabIndices(indices) {
    // hash of tabId:{tabIndex, windowId} sent from background after tabMoved
    if (!indices) return;
    let tab;
    for (let [tabId, tabData] of Object.entries(indices)) {
        tab = BTAppNode.findFromTab(tabId);
        if (tab) {
            tab.tabIndex = tabData.index;
            tab.windowId = tabData.windowId;
        }
    }
}


/***
 * 
 * Option Processing
 * Imports of Bookmarks, org file, tabsOutliner json. Grouping option updates
 * 
 ***/

async function processImport(nodeId) {
    // an import (bkmark, org, tabsOutliner) has happened => save and refresh

    closeConfigDisplays();                      // close panel
    await saveBT();                                           // save w imported data
    refreshTable();                                           // re-gen treetable display
    animateNewImport(nodeId);                                 // indicate success
    sendMessage({'function': 'getBookmarksBar'});             // bookmarks bar is not saved but synced on startup, need to reload here.
}

function groupingUpdate(from, to) {
    // grouping has been changed, potentially update open tabs (WINDOW->NONE is ignored)
    console.log(`Changing grouping options from ${from} to ${to}`);
    if (from == 'TABGROUP' && to == 'NONE')
        BTAppNode.ungroupAll();
    if ((from == 'NONE') && (to == 'TABGROUP'))
        BTAppNode.groupAll();
}

/***
 * 
 * Search support
 * 
 ***/
let ReverseSearch = false;
let SearchOriginId = 0;

function initializeSearch() {
    // Initialize search box event handlers - must be called after DOM is ready
    $("#search_entry").on("keyup", search);
    $("#search_entry").on("keydown", searchOptionKey);
    $("#search_entry").on("focus", enableSearch);
    $("#search_entry").on("focusout", disableSearch);
    $("#searchHint").on("click", enableSearch);
}

function enableSearch(e) {
    // activate search mode
    // ignore if tabbed into search box from card editor
    const editing = ($($("#dialog")[0]).is(':visible'));
    if (editing) return;
    
    $("#search_entry").select();
    $(".searchButton").show();
    $("#searchHint").hide();

    // Start search from...
    let row = (ReverseSearch) ? 'last' : 'first';
    let currentSelection =  $("tr.selected")[0] || $('#content').find('tr:visible:'+row)[0];
    SearchOriginId = parseInt($(currentSelection).attr('data-tt-id'));
    
    // prevent other key actions til search is done
    $(document).unbind('keyup');
    e.preventDefault();
    e.stopPropagation();

    // Initialize cache of displayed order of nodes to search in display order
    BTAppNode.setDisplayOrder();

    // hide the todo filter, search filter button is shown when >2 chars searched
    $("#todoFilter").hide();
}

function disableSearch(e = null) {
    // turn off search mode
    // special handling if tabbed into search box from card editor to allow edit card tabbing
    const editing = ($($("#dialog")[0]).is(':visible'));
    if (editing) {
        e.code = "Tab";
        handleEditCardKeyup(e);
        return;
    } 
    // special handling if the filter button was just clicked
    if (filterSearch.isFiltered) return;
    
    $("#search_entry").removeClass('failed');
    $("#search_entry").val('');
	$(".searchButton").hide();
    $("#searchHint").show();

    // undo display of search hits
    $("span.highlight").contents().unwrap();
    $("span.extendedHighlight").contents().unwrap();
    $("td").removeClass('search searchLite');
    
    BTAppNode.redisplaySearchedNodes();                      // fix searchLite'd nodes
    AllNodes.forEach((n) => n.unshowForSearch());            // fold search-opened nodes back closed

    // Unfilter: Show all rows that were marked as hidden and hide those that were marked as visible
    $("#content tr.hidden-by-filter").removeClass("hidden-by-filter").show();
    $("#content tr.visible-by-filter").removeClass("visible-by-filter").hide();
    filterToDos(null, true);                                 // Reset any potential todo filtering in place
    filterSearch(null, true);                                // Reset any potential search filtering in place
    
    // redisplay selected node to remove any scrolling, url display etc
    const selectedNodeId = $($("tr.selected")[0]).attr('data-tt-id');
    let node, displayNode;
    if (selectedNodeId) {
	    node = AllNodes[selectedNodeId];
        displayNode = node.getDisplayNode();
	    node.redisplay(true);
	    node.shownForSearch = false;
    } else {
        // reselect previous selection if search failed
        node = AllNodes[SearchOriginId || 1];
        displayNode = node.getDisplayNode();
        $(displayNode).addClass('selected');
    }
    displayNode.scrollIntoView({block: 'center'});
    
    if (ExtendedSearchCB)                                     // clear timeout if not executed
	    clearTimeout(ExtendedSearchCB);

    // turn back on other key actions. unbind first in cas still set
    // reattach only after this keyup, if any, is done
    $(document).unbind('keyup');
    setTimeout(()=>$(document).on("keyup", keyUpHandler), 500);

    // Clear cache of displayed order of nodes to search in display order
    BTAppNode.resetDisplayOrder();

    // reset compact mode (ie no notes) which might have changed while showing matching search results
    initializeNotesColumn();

    // hide the search filter and show the todo filter button
    $("#searchFilter").hide();
    $("#todoFilter").show();
}

function searchButton(e, action) {
    // called from next/prev search buttons. construct event and pass to search
    
    let event = {
	    altKey : true,
	    code : (action == "down") ? "KeyS" : "KeyR",
	    key : (action == "exit") ? "Enter" : "",
	    buttonNotKey: true
    };
    search(event);
    e.preventDefault();
    e.stopPropagation();
    if (action == "exit")				      // turn back on regular key actions
	    $(document).on("keyup", keyUpHandler);
	
    return false;    
}
function searchOptionKey(event) {
    // swallow keydown events for opt-s/r so they don't show in input. NB keyup is still
    // triggered and caught by search below

    if ((event.altKey && (event.code == "KeyS" || event.code == "KeyR" || event.code == "Slash")) ||
        (event.code == "ArrowDown" || event.code == "ArrowUp")) {
        event.stopPropagation();
        event.preventDefault();
    }
}

let ExtendedSearchCB = null;                                  // callback to perform searchlite 
function search(keyevent) {
    // called on keyup for search_entry, could be Search or Reverse-search,
    // key is new letter or opt-s/r (search for next) or del 
    // set timeout to run a second pass extendedSearch after initial search hit is found.

    if (keyevent.code == "Escape") {
        $("#search_entry").blur();
        return false;
    }
    
    let sstr = $("#search_entry").val();
    let next = false;
    if (ExtendedSearchCB)                                     // clear timeout if not executed
	    clearTimeout(ExtendedSearchCB);

    // are we done?
    if (keyevent.key == 'Enter' || keyevent.key == 'Tab') {
	    keyevent.buttonNotKey || keyevent.stopPropagation();
	    keyevent.buttonNotKey || keyevent.preventDefault();   // stop keyHandler from getting it
	    $("#search_entry").blur();                            // will call disableSearch
	    return false;
    }

    // opt-s/r or slash : drop that char code and go to next match
    if ((keyevent.altKey && (keyevent.code == "KeyS" || keyevent.code == "KeyR" || keyevent.code == "Slash"))  ||
        (keyevent.code == "ArrowDown" || keyevent.code == "ArrowUp")) {
	    next = true;
	    ReverseSearch = (keyevent.code == "KeyR") || (keyevent.code == "ArrowUp");
	    keyevent.buttonNotKey || keyevent.stopPropagation();
	    keyevent.buttonNotKey || keyevent.preventDefault();   // stop opt key from displaying
    }

    // undo effects of any previous hit
    $("span.highlight").contents().unwrap();
    $("span.extendedHighlight").contents().unwrap();
    $("td").removeClass('search');
    $("td").removeClass('searchLite');
    
    if (sstr.length < 1) return;                              // don't search for nothing!
    if (sstr.length > 2)
        $("#searchFilter").show();
    else
        $("#searchFilter").hide();

    // Find where we're starting from (might be passed in from backspace key handling
    let row = (ReverseSearch) ? 'last' : 'first';
    let currentSelection =  $("tr.selected")[0] || $('#content').find('tr:visible:'+row)[0];
    let nodeId = keyevent.startId || parseInt($(currentSelection).attr('data-tt-id'));
    
    let prevNodeId = nodeId;
    let node = AllNodes[nodeId];
    if (next || $("#search_entry").hasClass('failed')) {
	    node.redisplay();
	    node = node.nextDisplayNode(ReverseSearch);             // find next visible node, forward/reverse w looping
    }

    // Do the search starting from node until we find a match or loop back around to where we started
    const filteringOn = filterSearch.isFiltered || filterToDos.isFiltered;
    while(node && !node.search(sstr, filteringOn)) {
        node = node.nextDisplayNode(ReverseSearch);
        if (node.id == prevNodeId)
            node = null;
    }
    
    if (node) {
        const displayNode = node.getDisplayNode();
	    if (prevNodeId != node.id)
	        AllNodes[prevNodeId].redisplay();                 // remove search formating if moving on
	    $("tr.selected").removeClass('selected');
	    $(displayNode).addClass('selected');
	    node.showForSearch();                                 // unfold tree etc as needed

        const scrolling = scrollIntoViewIfNeeded(node.getDisplayNode());
	    let highlight = $(displayNode).find("span.highlight")[0];
	    if (highlight) {
            // make sure hit is visible horizontally. NB scrollIntoView also scrolls vertically, need to reset that
            const v = $(document).scrollTop();
            highlight.scrollIntoView({'container' : 'nearest'});
            $(document).scrollTop(v);
            $(displayNode).find(".left").css("text-overflow", "clip");
        }
        
	    $("#search_entry").removeClass('failed');
	    $("td").removeClass('searchLite');
        resetFilterSearch();                                // reset search filter button 
        const waitTime = scrolling ? 1000 : 200;            // wait til scroll completes to see visible rows for extendedSearch
	    ExtendedSearchCB = setTimeout(() => extendedSearch(sstr, node), waitTime);
    } else {
	    $("#search_entry").addClass('failed');
	    $("tr.selected").removeClass('selected');
    }
    
    return (!next);                                           // ret false to prevent entry
}

function rowsInViewport() {
    // Helper for extendedSearch to only search visible rows
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        );
    }
    
    return $("#content tr:visible").filter(function() {
        return isInViewport(this);
    })
    .map(function() { return $(this).attr("data-tt-id")})
    .get().map((e) => AllNodes[parseInt(e)]);
}


function scrollIntoViewIfNeeded(element) {
    // Helper function to make sure search or nav to item has its row visible but only scroll if needed. return whether will scroll
    // NB needed the timeout for block:center to work
    const height = $(window).height();
    const topOfRow = $(element).position().top;
    const displayTop = $(document).scrollTop();

    if (topOfRow < displayTop || topOfRow > (displayTop + height - 200)) {
        setTimeout(() => {
            element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 0);
        return true;
    }
    return false;
}

function extendedSearch(sstr, currentMatch) {
    // do extended search showing other hits on any visible nodes

    const nodesToSearch = rowsInViewport();

	nodesToSearch.forEach((n) => {
		if (!n || n == currentMatch) return;
		n.extendedSearch(sstr);
    });
}

function searchAll() {
    // Show all matches for current search string in extendedSearch fashion (current hit is already noted)
    // Used by filterSearch (below)
    const sstr = $("#search_entry").val();
    const selectedDisplayNode = $("tr.selected")[0];
    const selectedAppNodeId = $(selectedDisplayNode).attr('data-tt-id');

    // loop thru allNodes calling nodes extendedSearch fn
    AllNodes.forEach((n) => {
        if (!n || n.id == selectedAppNodeId) return;
        n.extendedSearch(sstr, true);               // force visible to show all hits
    })
}
function showSelected() {
    // factored out cos used in both filters below. make sure the selected row is visible after filtering
    const selectedKeywordRow = $("#content tr.selected");
    if (selectedKeywordRow.length > 0) {
        // If the row is not already visible, call showForSearch on the row's node
        if (!selectedKeywordRow.is(":visible")) {
            const nodeId = selectedKeywordRow.attr("data-tt-id");
            if (nodeId && AllNodes[nodeId]) {
                AllNodes[nodeId].showForSearch();
            }
        }
        scrollIntoViewIfNeeded(selectedKeywordRow[0]);
    }
}
function filterSearch(e, forceOff = false) {
    // toggle showing only all search hits in the tree, if forceOff don't act as a toggle (eg number key entered)

    if (forceOff && !filterSearch.isFiltered) return;          // already off, just return
    if (filterSearch.isFiltered) {
        // Unfilter: Show all rows that were marked as hidden and hide those that were marked as visible
        $("#content tr.visible-by-filter").removeClass("visible-by-filter").hide();
        $("#content tr.hidden-by-filter").removeClass("hidden-by-filter").show();
        showSelected();
        // Toggle the state and icon and complete search
        filterSearch.isFiltered = !filterSearch.isFiltered;
        $('#searchFilter').attr('src', 'resources/filter.svg');
        disableSearch();
    } else {
        // First find all search hits
        searchAll();
        // now mark all currently visible rows, hide them, then show rows with search hits
        $("#content tr:visible").addClass("hidden-by-filter").hide();
        $("#content td.searchLite").closest("tr").addClass("visible-by-filter").show();
        $("tr.selected").show();
        // Toggle the state and icon
        $('#searchFilter').attr('src', 'resources/filter-depressed.svg');
        filterSearch.isFiltered = !filterSearch.isFiltered;
        // Focus on the search box after above finishes
        setTimeout(()=> {
            const searchEntry = $("#search_entry");
            const length = searchEntry.val().length;
            searchEntry.focus();
            searchEntry[0].setSelectionRange(length, length);
        }, 100);
    }
}
function resetFilterSearch() {
    // reset the search filter to off without changing display (allows multiple searches)
    filterSearch.isFiltered = false;
    $('#searchFilter').attr('src', 'resources/filter.svg');
}
filterSearch.isFiltered = false;        // Initialize the isFiltered attribute

function filterToDos(e, forceOff = false) {
    // toggle showing only ToDos in the tree

    if (forceOff && !filterToDos.isFiltered) return;          // already off, just return
    if (filterToDos.isFiltered) {
        // Unfilter: Show all rows that were marked as hidden and hide those that were marked as visible, note the order
        $("#content tr.visible-by-filter").removeClass("visible-by-filter").hide();
        $("#content tr.hidden-by-filter").removeClass("hidden-by-filter").show();
        $("#todoFilter").attr('src', 'resources/star-transparent.svg');
        showSelected();
    } else {
        // Filter: Mark all currently visible rows, hide them, then show rows with span.keyword
        $("#content tr:visible").addClass("hidden-by-filter").hide();
        $("#content span.keyword").closest("tr").addClass("visible-by-filter").show();
        $("#todoFilter").attr('src', 'resources/star-depressed.svg');
    }
    // Toggle the state
    filterToDos.isFiltered = !filterToDos.isFiltered;
}
filterToDos.isFiltered = false;     // Initialize the isFiltered attribute

/***
 * 
 * Keyboard event handlers
 * 
 ***/
// prevent default space/arrow key scrolling and element tabbing on table (not in card edit fields)
window.addEventListener("keydown", function(e) {
    if ($($("#dialog")[0]).is(':visible')) {
        // ignore keydown if card editing. keyup gets event
        return;
    }
    if ($("#search_entry").is(":focus")) return;
    if(["ArrowUp","ArrowDown","Space", "Tab", "Enter"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    // up/down nav here to allow for auto repeat
    const alt = e.altKey;
    const code = e.code;
    const navKeys = ["KeyN", "KeyP", "ArrowUp", "ArrowDown"];

    // n or down arrow, p or up arrow for up/down (w/o alt)
    let next, currentSelection = $("tr.selected")[0];
    if (!alt && navKeys.includes(code)) {
        if (currentSelection)
            next = (code == "KeyN" || code == "ArrowDown") ?
            $(currentSelection).nextAll(":visible").first()[0] :          // down or
            $(currentSelection).prevAll(":visible").first()[0];           // up
        else
            // no selection => nav in from top or bottom
            next = (code == "KeyN" || code == "ArrowDown") ?
            $('#content').find('tr:visible:first')[0] :
            $('#content').find('tr:visible:last')[0];
        
        if (!next) return;
        if (currentSelection) $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
        scrollIntoViewIfNeeded(next);

	    $("#search_entry").val("");			      // clear search box on nav
        e.preventDefault();
	    e.stopPropagation();
        return;
    }
}, false);

// Copy handler: when the user triggers Copy, copy the selected node (and its children) as org text
$(document).on('copy', function(e) {
    try {
        // Mirror keyUpHandler conditions: ignore while editing or when typing in search
        const editing = ($($("#dialog")[0]).is(':visible'));
        if (editing || $("#search_entry").is(":focus")) return; // allow default copy

        const currentSelection = $("tr.selected")[0];
        if (!currentSelection) return; // nothing selected; let default run
        const nodeId = $(currentSelection).attr('data-tt-id');
        const node = AllNodes[nodeId];
        if (!node || !node.orgTextwChildren) return;

        const orgText = node.orgTextwChildren();

        // Prefer the clipboardData from the copy event
        if (e.originalEvent && e.originalEvent.clipboardData) {
            e.originalEvent.clipboardData.setData('text/plain', orgText);
            e.preventDefault();
            return;
        }
        if (e.clipboardData) {
            e.clipboardData.setData('text/plain', orgText);
            e.preventDefault();
            return;
        }

        // Fallback to async Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(orgText).catch(() => {/* ignore */});
            // Can't prevent default reliably here without event clipboardData; best effort
            return;
        }

        // Last-resort fallback using a temporary textarea and execCommand
        const ta = document.createElement('textarea');
        ta.value = orgText;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch (_) { /* ignore */ }
        document.body.removeChild(ta);
    } catch (_) {
        // Fail silently; allow default copy behavior
    }
});

$(document).on("keyup", keyUpHandler);
function keyUpHandler(e) {
    // dispatch to appropriate command. NB key up event

    // ignore keys (except nav up/down) if edit dialog is open
    const editing = ($($("#dialog")[0]).is(':visible'));
    if (editing) {
        handleEditCardKeyup(e);
        return;
    }

    // searchMode takes precidence and is detected on the search box input handler
    if ($("#search_entry").is(":focus"))
	    return;
    
    const alt = e.altKey;
    const code = e.code;
    const key = e.key;
    const navKeys = ["KeyN", "KeyP", "ArrowUp", "ArrowDown"];
    // This one doesn't need a row selected, alt-z for undo last delete
    if (alt && code == "KeyZ") {
        undo();
    }

    // escape closes any open config/help/setting panel
    if (code === "Escape") closeConfigDisplays();

    let next, currentSelection = $("tr.selected")[0];
    // Pageup/down move selection to top visible row, nb slight delay for scroll to finish
    if (currentSelection && (code == "PageUp" || code == "PageDown")) {
        setTimeout(() => {
            let topRow = Array.from($("#content tr")).find(r => r.getBoundingClientRect().y > 60);
            $(currentSelection).removeClass('selected');
            $(topRow).addClass('selected');
        }, 100);
    }

    // s,r = Search, Reverse-search
    if (code == "KeyS" || code == "KeyR" || key == "/") {
	    ReverseSearch = (code == "KeyR");
	    enableSearch(e);
        return;
    }

    // h, ? = help
    if (code == "KeyH" || key == "?") {
        if ($('#help').is(':visible') && !$('#keyCommands').is(':visible')) {
            toggleKeyCommands();
        } else {
            $('#keyCommands').show();
            toggleHelpDisplay();
        }
        e.preventDefault();
    }

    // digit 1-9, fold all at that level, expand to make those visible
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    if (digits.includes(key)) {
        const lvl = digits.indexOf(key) + 1;   // level requested
        const tt = $("table.treetable");
        filterToDos(e, true);                             // turn off todo filter if on
        filterSearch(e, true);                            // turn off search filter if on
        AllNodes.forEach(function(node) {
            if (!tt.treetable("node", node.id)) return;	      // no such node
            if (node?.level < lvl)
                tt.treetable("expandNode", node.id);
            if (node?.level >= lvl)
                tt.treetable("collapseNode", node.id);
            if (node?.level > lvl)
                $(node.getDisplayNode()).hide();
            else
                $(node.getDisplayNode()).show();
        });
        rememberFold();                                       // save to storage
    }

    if (!currentSelection) return;
    const nodeId = $(currentSelection).attr('data-tt-id');
    const node = AllNodes[nodeId];
    if (!node) return;

    // up(38) and down(40) arrows move
    if (alt && (code == "ArrowUp" || code == "ArrowDown")) {
        if (node.childIds.length && !node.folded) {
            $("#content").treetable("collapseNode", nodeId);
        }
        // its already below prev so we drop below prev.prev when moving up
        const dropTr = (code == "ArrowUp") ?
              $(currentSelection).prevAll(":visible").first().prevAll(":visible").first() :
              $(currentSelection).nextAll(":visible").first();
        const dropId = $(dropTr).attr('data-tt-id');
	    const dropNode = AllNodes[dropId];
        if (dropNode) moveNode(node, dropNode, node.parentId);
        currentSelection.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        return;
    }

    // enter == open or close.
    if (!alt && code == "Enter") {
        if (node.childIds.length) {
            if (node.hasUnopenDescendants())
                openRow(e);
            else
                closeRow(e);
        } else {
            if (node.URL && !node.tabId)
                openRow(e);
            if (node.tabId)
                closeRow(e);
        }
    }
    
    // tab == cycle thru expand1, expandAll or collapse a topic node
    if (code == "Tab") {
        if (node.isTopic()) {
            if (node.folded) {
                node.unfoldOne();                   // BTAppNode fn to unfold one level & remember for next tab
                keyUpHandler.lastSelection = currentSelection;
            } else {
                if (currentSelection == keyUpHandler.lastSelection) {
                    node.unfoldAll();               // BTAppNode fn to unfold all levels, reset lastSelection so next tab will fold
                    keyUpHandler.lastSelection = null;
                } else {
                    $("table.treetable").treetable("collapseNode", nodeId);
                }
            }
            rememberFold();                         // save to storage
        }
        e.preventDefault();
        return;
    }

    // t = cycle TODO state
    if (code == "KeyT") {
        toDo(e);
    }

    // e = edit
    if (code == "KeyE") {
        editRow(e);
        e.preventDefault();
    }

    // delete || backspace = delete
    if (code == "Backspace" || code == "Delete") {
        // Find next (or prev if no next) row, delete, then select next
        const next = $(currentSelection).nextAll(":visible").first()[0] ||
              $(currentSelection).prevAll(":visible").first()[0];
        deleteRow(e);
        $(next).addClass('selected');
        next.scrollIntoView({block: 'nearest'});	
    }

    // opt enter = new child
    if (alt && code == "Enter" && node.isTopic()) {
        addChild(e);
    }

    // opt <- = promote
    if (alt && code == "ArrowLeft") {
        promote(e);
    }

    // <- collapse open node, then nav up tree
    if (!alt && code == "ArrowLeft") {
        if (node.childIds.length && !node.folded) {
            $("table.treetable").treetable("collapseNode", nodeId);
            return;
        }
        if (!node.parentId) return;
        next = $(`tr[data-tt-id=${node.parentId}]`)[0];
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
        next.scrollIntoView({block: 'nearest'});
    }

    // -> open node, then nav down tree
    if (code == "ArrowRight") {
        if (node.folded) {
            $("table.treetable").treetable("expandNode", nodeId);
            return;
        }
        next = $(currentSelection).nextAll(":visible").first()[0];
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
    }

    // space = open tab, w/alt-space => open in new window
    if (code === "Space" || code === "KeyW") {
        const newWin = alt || code === "KeyW";
        (node.childIds.length) ? node.openAll(newWin) : node.openPage(newWin);
        e.preventDefault();
    }
};

function handleEditCardKeyup(e) {
    // subset of keyUpHandler applicible to card edit dialog, nb keyup event

    const code = e.code;
    const alt = e.altKey;
    if (code == "Tab") {
        // restrain tabbing to within dialog. Button gets focus and then this handler is called.
	    // so we redirect focus iff the previous focused element was first/last
        const focused = $(":focus")[0];
        const first = $($("#topicName")[0]).is(':visible') ? $("#topicName")[0] : $('#titleText')[0];
	    if (!focused || !$(focused).hasClass('editNode')) {
	        // tabbed out of edit dialog, force back in
            console.log("setting focus");
	        if (!e.shiftKey)	// tabbing forward
		        $(first).focus();
	        else
		        $("#cancel").focus();
	    }
        e.preventDefault();
	    e.stopPropagation();
        return;
    }
    if (code == "Enter") {
	    // on enter move focus to text entry box
	    $("#textText").focus();
	    e.preventDefault();
	    e.stopPropagation();
    }
    if (alt && ["ArrowUp","ArrowDown"].includes(code)) {
        // alt up/down iterates rows opening cards
        const currentSelection = $("tr.selected")[0];
        const next = (code == "ArrowDown") ?
              $(currentSelection).nextAll(":visible").first()[0] :          // down
              $(currentSelection).prevAll(":visible").first()[0];           // up        
        if (!next) return;
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
        next.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        closeDialog(function () {editRow({type: 'internal', duration: 100});}, 100);        
    }
    if (code === "Escape") closeDialog(cancelEdit);    // escape out of edit then check need 4 cancel
};

function undo() {
    // undo last delete
    const node = BTNode.undoDelete();
    if (!node) return;                          // nothing to undo
    const parent = AllNodes[node.parentId];
    function updateTree(ttn, btn) {
        // recurse as needed on tree update

        btn.displayNode = null;        // remove cached html value
        $("table.treetable").treetable("loadBranch", ttn || null, btn.HTML());
        if (btn.childIds.length) {
            const n = $("table.treetable").treetable("node", btn.id);
            btn.childIds.forEach(
                (id) => updateTree(n, AllNodes[id]));
        }
        btn.populateFavicon();
    }

    // Update tree
    let n = parent ? $("table.treetable").treetable("node", parent.id) : null;
    updateTree(n, node);
    $($(`tr[data-tt-id='${node.id}']`)[0]).addClass('selected');
    node.tgColor && node.setTGColor(node.tgColor);
    // find nodes topic, either itself or its parent. if tabgrouping is on call topicnode.groupOpenChildren
    const topicNode = node.isTopic() ? node : AllNodes[node.parentId];
    if (topicNode && ((getProp('BTGroupingMode') || 'TABGROUP') == 'TABGROUP')) {
        topicNode.groupOpenChildren();
    }

    initializeUI();
    saveBT();
    BTAppNode.generateTopics();
}

registerMessageHandler('launchApp', launchApp);
registerMessageHandler('tabActivated', tabActivated);
registerMessageHandler('tabJoinedTG', tabJoinedTG);
registerMessageHandler('tabLeftTG', tabLeftTG);
registerMessageHandler('tabNavigated', tabNavigated);
registerMessageHandler('tabOpened', tabOpened);
registerMessageHandler('tabMoved', tabMoved);
registerMessageHandler('tabPositioned', tabPositioned);
registerMessageHandler('tabClosed', tabClosed);
registerMessageHandler('tabReplaced', tabReplaced);
registerMessageHandler('saveTabs', saveTabs);
registerMessageHandler('tabGroupCreated', tabGroupCreated);
registerMessageHandler('tabGroupUpdated', tabGroupUpdated);
registerMessageHandler('noSuchNode', noSuchNode);
registerMessageHandler('mouseOut', sidePanelMouseOut);
registerMessageHandler('checkFileFreshness', checkFileFreshness);
initializeSessionManager();

// Export functions that are called from inline HTML event handlers or by applicationUI or tableManager
export { 
    searchButton, filterSearch, filterToDos,
    syncEnabled, updateStatsRow, groupingUpdate
};

