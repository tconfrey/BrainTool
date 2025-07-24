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
 * Manages the App window UI and associated logic.
 * NB Runs in context of the BT side panel, not background BT extension or helper btContent script
 * 
 ***/

'use strict'

const OptionKey = /Mac/i.test(navigator.platform) ? "Option" : "Alt";
var InitialInstall = false;
var UpgradeInstall = false;
var GroupingMode = 'TABGROUP';                            // or 'NONE'
var MRUTopicPerWindow = {};                               // map winId to mru topic
var BTTabId = null;                                       // tabId of BT
var BTWinId = null;                                       // winId of BT
var SidePanel = false;                                    // true if running in side panel => dictates how to send msgs

/***
 *
 * Opening activities
 *
 ***/

async function launchApp(msg) {
    // Launch app w data passed from extension local storage
    
    configManager.setConfigAndKeys(msg);
    InitialInstall = msg.initial_install;
    UpgradeInstall = msg.upgrade_install;                   // null or value of 'previousVersion'
    BTTabId = msg.BTTab;                                    // knowledge of self
    BTWinId = msg.BTWin;                                    // got mad knowledge of self
    SidePanel = msg.SidePanel;

    BTFileText = msg.BTFileText;
    processBTFile();                                          // create table etc
    
    // scroll to top
    $('html, body').animate({scrollTop: '0px'}, 300);

    // If a backing store file was previously established, re-set it up on this startup
    handleStartupFileConnection();

    // Get BT sub id => premium 
    // BTId in local store and from org data should be the same. local store is primary
    if (msg?.Config?.BTId) {
	    BTId = msg.Config.BTId;
        if (configManager.getProp('BTId') && (BTId != configManager.getProp('BTId')))
	        alert(`Conflicting subscription id's found! This should not happen. I'm using the local value, if there are issues contact BrainTool support.\nLocal value:${BTId}\nOrg file value:${configManager.getProp('BTId')}`);
        configManager.setProp('BTId', BTId);
    } else {
	    // get from file if not in local storage and save locally (will allow for recovery if lost)
	    if (configManager.getProp('BTId')) {
	        BTId = configManager.getProp('BTId');
	    }
    }
    
    // check for license, and if sub that its still valid else check to see if we shoudl nag
    if (BTId && await checkLicense()) updateLicenseSettings();
    if (!BTId) configManager.potentiallyNag();

    // show Alt or Option appropriately in visible text (Mac v PC)
    $(".alt_opt").text(OptionKey);

    handleInitialTabs(msg.all_tabs, msg.all_tgs);         // handle currently open tabs
    initializeNotesColumn();                              // set up notes column width based on slider saved position
    checkCompactMode();                                   // tweak display if window is narrow
    updateStats();                                        // record numlaunches etc
    UpgradeInstall && runUpgrade(msg.BTVersion);          // run any upgrade specific code

    if (!configManager.getProp('BTDontShowIntro'))
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
    if (configManager.getProp('BTExpiry') == 8640000000000000) {
        // permanant license
        $('#otp').show();
        $('#sub').hide();
        $('#portalLink').hide();
    } else {
        // time limited sub
        $('#otp').hide();
        $('#sub').show();
        $('#renewDate').text(new Date(configManager.getProp('BTExpiry')).toLocaleDateString());
    }
    $('.subId').text(BTId);
}

function updateStats() {
    // read and update various useful stats, only called at startup
    // NB before gtag calls some stats as for the previous session (eg BTSessionStartTime)
    
    // Record this launch and software version. also update version shown in ui help.
    const BTAppVersion = configManager.getProp('BTAppVersion');
    $("#BTVersion").html(`<i>(Version: ${BTAppVersion})</i>`);

    gtag('event', 'launch_'+BTAppVersion, {'event_category': 'General', 'event_label': BTAppVersion,
                             'value': 1});    
    if (InitialInstall) {
        gtag('event', 'install', {'event_category': 'General', 'event_label': InitialInstall,
                                  'value': 1});
        configManager.setStat('BTInstallDate', Date.now());
    }
    if (UpgradeInstall)
        gtag('event', 'upgrade', {'event_category': 'General', 'event_label': UpgradeInstall,
                                  'value': 1});

    // Calculate some other stat info (and do some one-time setup of installDate and numSaves)
    let stats = configManager.getProp('BTStats');
    if (!stats['BTNumSaves']) configManager.setStat('BTNumSaves', 0);
    if (!stats['BTInstallDate']) configManager.initializeInstallDate();
    configManager.incrementStat('BTNumLaunches');         // this launch counts
    stats = configManager.getProp('BTStats');
    
    const lastSessionMinutes =
          parseInt((stats['BTLastActivityTime'] - stats['BTSessionStartTime']) / 60000);
    const daysSinceInstall =
          parseInt((Date.now() - stats['BTInstallDate']) / 60000 / 60 / 24);
    const currentOps = stats['BTNumTabOperations'] || 0;
    const currentSaves = stats['BTNumSaves'] || 0;
    const lastSessionOperations = currentOps - (stats['BTSessionStartOps'] || 0);
    const lastSessionSaves = currentSaves - (stats['BTSessionStartSaves'] || 0);

    // Record general usage summary stats, they don't apply on first install
    if (!InitialInstall) {
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
    configManager.setStat('BTSessionStartTime', Date.now());
    configManager.setStat('BTSessionStartSaves', currentSaves);
    configManager.setStat('BTSessionStartOps', currentOps);

    // show message or tip. Reset counter on upgrade => new messages
    if (InitialInstall || UpgradeInstall) configManager.setProp('BTLastShownMessageIndex', 0);
    messageManager.setupMessages();
}

function handleFocus(e) {
    // BTTab comes to top
    document.activeElement.blur();                      // Links w focus interfere w BTs selection so remove
}

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

    if (GDriveConnected) {
        const lastModifiedTime = await gDriveFileManager.getBTModifiedTime();
        if (!lastModifiedTime) {
            const cb = async () => { gDriveFileManager.renewToken(); messageManager.removeWarning(); };
            messageManager.showWarning("GDrive authorization has expired. <br/>Click here to refresh now, otherwise I'll try when there's something to save.", cb);
            return;
        }
    }

    const warnNewer = await checkBTFileVersion();
    if (warnNewer) {
        const cb = async () => { refreshTable(true); messageManager.removeWarning(); };
        messageManager.showWarning("The synced version of your BrainTool file has newer data. <br/>Click here to refresh or disregard and it will be overwritten on the next save.", cb);
    }
}

async function handleInitialTabs(tabs, tgs) {
    // array of {url, id, groupid, windId} passed from ext. mark any we care about as open

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
        } else {
            node.putInGroup();                              // not grouped currently, handle creating/assigning as needed on startup
            node.groupAndPosition();
        }
        if (node.parentId && AllNodes[node.parentId]) {
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
            if (node) node.groupAndPosition();
        });
    // remember topic per window for suggestions in popup
    sendMessage({'function': 'localStore', 'data': {'mruTopics': MRUTopicPerWindow}});
    updateStatsRow();
}


function brainZoom(iteration = 0) {
    // iterate thru icons to swell the brain

    const iterationArray = ['01','02', '03','04','05','06','07','08','09','10','05','04', '03','02','01'];
    const path = '../extension/images/BrainZoom'+iterationArray[iteration]+'.png';
    
    if (iteration == iterationArray.length) {
        $("#brain").attr("src", "../extension/images/BrainTool128.png");
        return;
    }
    $("#brain").attr("src", path);
    const interval = (iteration <= 4 ? 150 : 50);
    setTimeout(function() {brainZoom(++iteration);}, interval);

}

/***
 *
 * Table handling
 *
 ***/

var ButtonRowHTML; 
var Topics = new Array();      // track topics for future tab assignment
var BTFileText = "";           // Global container for file text
var OpenedNodes = [];          // attempt to preserve opened state across refresh


async function refreshTable(fromStore = false) {
    // Clear current state and redraw table. Used after an import or on manual GDrive refresh request
    // Needed to regenerate the tabletree structures

    // First check to make sure we're not clobbering a pending write, see fileManager.
    if (savePendingP()) {
        alert('A save is currently in process, please wait a few seconds and try again');
        return;
    }
    $('body').addClass('waiting');
    
    // Remember window opened state to repopulate later
    OpenedNodes = AllNodes.filter(n => (n.tabId || n.tabGroupId));
    
    BTNode.topIndex = 1;
    AllNodes = [];

    // Either get BTFileText from file or use local copy. If file then await its return
    try {
        if (fromStore)
            await getBTFile();
        processBTFile();
    }
    catch (e) {
        console.warn('error in refreshTable: ', e.toString());
        throw(e);
    }
}


function generateTable() {
    // Generate table from BT Nodes
    var outputHTML = "<table>";
    AllNodes.forEach(function(node) {
        if (!node) return;
        outputHTML += node.HTML();
    });
    outputHTML += "</table>";
    return outputHTML;
}

function processBTFile(fileText = BTFileText) {
    // turn the org-mode text into an html table, extract Topics

    // First clean up from any previous state
    BTNode.topIndex = 1;
    AllNodes = [];
    
    try {
        parseBTFile(fileText);
    }
    catch(e) {
        alert('Could not process BT file. Please check it for errors and restart');
        $('body').removeClass('waiting');
        throw(e);
    }

    var table = generateTable();
    /*  for some reason w big files jquery was creating <table><table>content so using pure js
        var container = $("#content");
        container.html(table);
    */
    var container = document.querySelector('#content');
    container.innerHTML = table;

    $(container).treetable({ expandable: true, initialState: 'expanded', indent: 30,
                             animationTime: 1, onNodeCollapse: nodeCollapse,
                             onNodeExpand: nodeExpand}, true);

    BTAppNode.generateTopics();

    // Let extension know about model
    sendMessage({'function': 'localStore', 'data': {'topics': Topics}});
    sendMessage({'function': 'localStore', 'data': {'BTFileText': BTFileText}});
    
    // initialize ui from any pre-refresh opened state
    OpenedNodes.forEach(oldNode => {
        const node = BTNode.findFromTitle(oldNode?.title);
        if (!node) return;
        $("tr[data-tt-id='"+node.id+"']").addClass("opened");
        node.tabId = oldNode.tabId;
        node.windowId = oldNode.windowId;
        node.tabGroupId = oldNode.tabGroupId;
        node.tabIndex = oldNode.tabIndex;
        if (oldNode.tgColor) node.setTGColor(oldNode.tgColor);
        if (node.parentId && AllNodes[node.parentId] && node.windowId) {
            AllNodes[node.parentId].windowId = node.windowId;
            //AllNodes[node.parentId].tabGroupId = node.tabGroupId;
        }
    });
    
    initializeUI();
    // Give events from init time to process
    setTimeout(function () {
        AllNodes.forEach(function(node) {
            if (node?.folded)
                $(container).treetable("collapseNodeImmediate", node.id);
        });
        // set treetable animation time to 250ms. 
        // The initial 10ms above avoids this collapse happening before the nodes are rendered.
        $("#content").data("treetable").settings.animationTime = 250;
    }, 400);

    BTAppNode.populateFavicons();                         // filled in async
    configManager.updatePrefs();
    $('body').removeClass('waiting');
}


/**
 *      Column resizing functionality
 **/

function initializeNotesColumn() {
    // set position of the column resizer, read from BTNotes peoperty.
    // Above 95% snaps to 100% right aligned offset by 26px width, but when window is narrow thats >5% so 13px
    // Called from initial settings and checkCompact after window resize
    // Calls out to handleResizer,
    const notesPref = configManager.getProp('BTNotes');
    const percent = parseInt(notesPref);
    const left = (percent >= 95) ? 100 : percent;
    const offset = ($(window).width() > 260) ? 26 : 13;  // adjust for narrow windows
    $("#resizer").css('left', `calc(${left}% - ${offset}px`);
    handleResizer();
}
let Resizing = false;                                   // set while resizing in progress to avoid processing other events
function handleResizer() {
    // Resizer has been dragged, or during set up
    const left = $("#resizer").position().left + 13;
    const fullWidth = $(window).width();
    const percent = parseInt(left / fullWidth * 100);

    if (percent < 95) {
        $("#content").addClass('showNotes').removeClass('hideNotes');
        $("td.left").css("width", percent + "%");
        $("td.right").css("width", (100 - percent) + "%");
    } else {
        $("#content").addClass('hideNotes').removeClass('showNotes');
    }
}
$("#resizer").draggable({
    containment: "#newTopLevelTopic",                   // Restrict dragging within the parent div
    axis: "x",
    drag: function(e, ui) {
        Resizing = true;
        handleResizer();
    },
    stop: () => setTimeout(() => {
        const left = $("#resizer").position().left + 13;
        const fullWidth = $(window).width();
        const percent = parseInt(left / fullWidth * 100);
        configManager.setProp('BTNotes', percent);      // save the new width, BTNotes = NOTES, NONOTES or % width
        handleResizer();
        Resizing = false;
        // Update the resizer position to match the new left column width
        const newLeft = $($("td.left")[0]).width();
        $("#resizer").css('left', parseInt(newLeft - 9.5) + "px");
    }, 250),                                            // give time for resize to be processed
});
// add on entry and on exit actions to highlight the resizer
$("#newTopLevelTopic").on('mouseenter', () => $("#resizer").css("opacity", 1));
$("#newTopLevelTopic").on('mouseleave', () => $("#resizer").css("opacity", 0.5));


function displayNotesForSearch() {
    // when searching the hit might be in the hidden notes column. check for td.right and show if needed
    if ($("td.right").css("display") == "none") {
        $("td.right").css("display", "table-cell");
        $("td.left").css("width", "50%");
        $("td.right").css("width", "50%");
    }
}

/**
 *      General UI Setup
 */

function initializeUI() {
    //DRY'ing up common event stuff needed whenever the tree is modified
    console.log('Initializing UI');
    
    $("table.treetable tr").off('mouseenter');            // remove any previous handlers
    $("table.treetable tr").off('mouseleave');
    $("table.treetable tr").on('mouseenter', null, buttonShow);
    $("table.treetable tr").on('mouseleave', null, buttonHide);
    // intercept link clicks on bt links
    $("a.btlink").each(function() {
        this.onclick = handleLinkClick;
    });
    
    // double click - show associated window
    $("table.treetable tr").off("dblclick");              // remove any previous handler
    $("table.treetable tr").on("dblclick", function () {
        const nodeId = this.getAttribute("data-tt-id");
        AllNodes[nodeId].showNode();
    });
    
    // single click - select row
    $("table.treetable tr").off("click");              // remove any previous handler
    $("table.treetable tr").on("click", function (e) {
	    // first check this is not openclose button, can't stop propagation
	    if (e?.originalEvent?.target?.classList?.contains('openClose')) return;

        // select the new row
        $("tr.selected").removeClass('selected');
        $(this).addClass("selected");
        configManager.closeConfigDisplays();                    // clicking also closes any open panel
    });
    $(document).click(function(event) {
        if (event.target.nodeName === 'HTML') {
            configManager.closeConfigDisplays();                // clicking background also closes any open panel
        }
    });
    
    makeRowsDraggable();                                        // abstracted out below

    // Hide loading notice and show sync/refresh buttons as appropriate
    $("#loading").hide();
    updateSyncSettings(syncEnabled());

    // Copy buttonRow's html for potential later recreation (see below)
    if ($("#buttonRow")[0])
        ButtonRowHTML = $("#buttonRow")[0].outerHTML;

    updateStatsRow(configManager.getProp('BTTimestamp'));   // show updated stats w last save time
}
function reCreateButtonRow() {
    // For some unknown reason very occasionally the buttonRow div gets lost/deleted
    console.log("RECREATING BUTTONROW!!");
    const $ButtonRowHTML = $(ButtonRowHTML);
    $ButtonRowHTML.appendTo($("#dialog"))
}

/**
 * 
 * Drag and Drop Support
 * Both row dragging to move them in the tree and drops from the browser, or anywhere
 * to create new nodes. 
 */

function makeRowsDraggable(recalc = false) {
    // make rows draggable. refreshPositions is expensive so we only turn it on when the unfold timeout hits
    if (!makeRowsDraggable.recalcSet) {
        makeRowsDraggable.recalcSet = false;
    }
    if (makeRowsDraggable.recalcSet && recalc) return;          // recalc already on (ie refreshPosition = true)
    makeRowsDraggable.recalcSet = recalc;
    $("table.treetable tr").draggable({
        helper: function() {
            buttonHide();
            const clone = $(this).clone();
            $(clone).find('.btTitle').html('HELKP!');		    // empty clone of contents, for some reason
            $(clone).css('background-color', '#7bb07b');
            
            $("table.treetable tr").off('mouseenter');          // turn off hover behavior during drag
            $("table.treetable tr").off('mouseleave');
            return clone;
        },     
        start: dragStart,                                       // call fn below on start
        axis: "y",
        scrollSpeed: 5,
        scroll: true,
        scrollSensitivity: 100,
        cursor: "move",
        opacity: .75,
        refreshPositions: recalc,                               // needed when topics are unfolded during DnD, set in unfold timeout
        stop: function( event, ui ) {
            // turn hover bahavior back on and remove classes iused to track drag
            $("table.treetable tr").on('mouseenter', null, buttonShow);
            $("table.treetable tr").on('mouseleave', null, buttonHide);
            $("table.treetable tr").droppable("enable");
            $("tr").removeClass("hovered");
            $("td").removeClass("dropOver");
            $("td").removeClass("dropOver-pulse");
            $("tr").removeClass("dragTarget");
            $("tr").removeClass("ui-droppable-disabled");
        },
        revert: "invalid"                                       // revert when drag ends but not over droppable
    });
}

function dragStart(event, ui) {
    // Called when drag operation is initiated. Set dragged row to be full sized
    console.log("dragStart");
    const w = $(this).css('width');
    const h = $(this).css('height');
    ui.helper.css('width', w).css('height', h);
    const nodeId = $(this).attr('data-tt-id');
    const node = AllNodes[nodeId];

    $(this).addClass("dragTarget");
    makeRowsDroppable(node);
}

/* 
    Set dragover handler for content area. Needed to allow dropping from url bar.
    NB only want first (of many) firings
    */
function contentDragoverHandler(event) {
    event.preventDefault();
    if (!contentDragoverHandler.droppableInitialized) {
        console.log('#content dragover initialized');
        makeRowsDroppable();
        contentDragoverHandler.droppableInitialized = true;
    }

    // Scroll handling. Skip this event if it's too soon since the last scroll
    const now = Date.now();
    if (now - contentDragoverHandler.lastScrollTime < 50) return;
    contentDragoverHandler.lastScrollTime = now;

    const container = document.documentElement;
    const scrollSpeed = 10; // Adjust scroll speed as needed
    const scrollThreshold = 100; // Distance from edge to start scrolling

    const mouseY = event.clientY;
    if (mouseY < scrollThreshold) {
        container.scrollTop -= scrollSpeed;        // Scroll up
    } else if (mouseY > (window.innerHeight - scrollThreshold)) {
        container.scrollTop += scrollSpeed;        // Scroll down
    }
}
function contentDragleaveHandler(event) {
    console.log('#content dragleave');
    contentDragoverHandler.droppableInitialized = false;
}
$("#content").on("dragover", contentDragoverHandler);
$("#content").on("dragleave", contentDragleaveHandler);

function makeRowsDroppable(node) {
    // make rows droppable. Two parts, first handle drag from outside, then drag of tree row

    // Handled differently cos can't use JQuery and drop is a create not a move. 
    // Using dragover and dragleave to trigger jq's over and out events
    $("table.treetable tr").on("dragover", function (event) {
        event.preventDefault(); // Allow drop
        if (!$(this).data("overTriggered")) {
            $(this).data("ui-droppable")._trigger("over", event, { draggable: null });
            $(this).data("overTriggered", true);
        }
    });
    $("table.treetable tr").on("dragleave", function (event) {
        $(this).data("ui-droppable")._trigger("out", event, { draggable: null });
        $(this).data("overTriggered", false);
    });
    // This drop is creating a new node, not moving an existing one, as below. Make sure not to add multiply
    $("table.treetable tr").off("drop").on("drop", handleExternalDropEvent);

    // Handle row dragging inside table
    $("table.treetable tr").droppable({
        accept: "*",                    // Accept any draggable, so above works
        drop: function(event, ui) {
            // Remove unfold timeout and drop
            const timeout = $(this).data('unfoldTimeout');
            if (timeout) {
                clearTimeout(timeout);
                $(this).removeData('unfoldTimeout');
            }
            dropNode(event, ui);
        },
        over: function(event, ui) {
            // highlight node a drop would drop into and underline the potential position, could be at top
            $(this).children('td').first().addClass("dropOver");

            // Add timeout to unfold node if hovered for 1 second
            const dropNodeId = $(this).attr('data-tt-id');
            const dropNode = AllNodes[dropNodeId];
            if (dropNode && dropNode.folded) {
                $(this).children('td').first().addClass("dropOver-pulse");          // to indicate unfold is coming
                const timeout = setTimeout(() => {
                    dropNode.unfoldOne();
                    setTimeout(makeRowsDraggable(true), 1);                         // refresh draggable positions after unfold
                }, 2500);
                $(this).data('unfoldTimeout', timeout);
            }
        },
        out: function(event, ui) {
            // undo the above
            $(this).children('td').first().removeClass(["dropOver", "dropOver-pulse"]);

            // Remove timeout if hover wasn't long enough for it to fire
            const timeout = $(this).data('unfoldTimeout');
            if (timeout) {
                clearTimeout(timeout);
                $(this).removeData('unfoldTimeout');
            }
        }
    });

    // disable droppable for self and all descendants, can't drop into self!
    if (!node) return;
    let ids = node.getDescendantIds();
    ids.push(node.id);
    ids.forEach(id => {
        $(`tr[data-tt-id='${id}']`).droppable("disable");
    });
}

function handleExternalDropEvent(event) {
    // This drop is creating a new node, not moving an existing one
    // Initialize inProgress property first time thru
    if (typeof handleExternalDropEvent.dropInProgress === "undefined") {
        handleExternalDropEvent.dropInProgress = false;
    }    
    // Prevent multiple executions, make sure there's data
    if (handleExternalDropEvent.dropInProgress) return;
    handleExternalDropEvent.dropInProgress = true;
    
    try {
        event.preventDefault();
        let dataTransfer = event.originalEvent.dataTransfer;
        if (!dataTransfer) return;

        // Find the parent to drop under
        const dropDisplayNode = $($(".dropOver")[0]).parent();
        const dropNodeId = $(dropDisplayNode).attr('data-tt-id');
        const dropNode = AllNodes[dropNodeId];
        let parentNode;
        if (dropNode.isTopic() && !dropNode.folded ) {
            parentNode = dropNode;
        } else {
            parentNode = dropNode.parentId ? AllNodes[dropNode.parentId] : dropNode;
        }
        if (!parentNode) return;                            // no parent, no drop

        // Handle drag of web page contents, we get html
        let links = [];
        let dropUnderNode = dropDisplayNode[0];
        if (dataTransfer.getData("text/html")) {
            // Find href links, pull out the urls and titles
            const dropData = dataTransfer.getData("text/html");
            const parser = new DOMParser();
            const doc = parser.parseFromString(dropData, "text/html");
            links = doc.querySelectorAll("a");
            const description = (links.length == 1) ? dataTransfer.getData("text/plain") : "";     // Single link => use text as descr
            if (links.length == 0) {
                // No links, but we have a text/plain data transfer. Put that as text in dropNode
                const text = dataTransfer.getData("text/plain");
                dropNode.text = text;
                dropNode.redisplay();
            }
            links.forEach(link => {
                // For each link get details and create child node 
                const url = link.href;
                const title = link.textContent || link.innerText;
                const node = new BTAppNode(`[[${url}][${title}]]`, parentNode.id, description, parentNode.level + 1);
                $("table.treetable").treetable("loadBranch", parentNode.getTTNode(), node.HTML());
                node.populateFavicon();
                positionNode(node.getDisplayNode(), parentNode.id, dropUnderNode);
                dropUnderNode = node.getDisplayNode();
            });
            initializeUI();
            saveBT();
        } 
        if (!links.length && dataTransfer.getData("text/plain")) {
            // Bookmarks or address bar or just text that might have links. (NB can get same data in html)
            // send to background to populate tabIds, titles as available from tabs and bookmarks
            // bg will send saveTabs msgs as necessary, handled out of band in std saveTabs (below)
            const dropData = dataTransfer.getData("text/plain");
            console.log("URLs:", dropData);
            sendMessage({'function': 'saveDroppedURLs', 'topic': parentNode.topicPath, 
                        'dropData': dropData, 'dropNodeId': dropNodeId, 'from':'btwindow'});
        }

        // Clean up the display and reset the handler for next time
        $("table.treetable td").removeClass(["dropOver", "dropOver-pulse"]);
        $("#content").on("dragover", contentDragoverHandler);
    } catch (error) {
        console.error("Error in handleExternalDropEvent:", error);
    } finally {
        // Reset the flag after a short delay, regardless of success or error
        setTimeout(() => {
            handleExternalDropEvent.dropInProgress = false;
        }, 100);
    }
}

function dropNode(event, ui) {
    // Drop existing node w class=dragTarget below node w class=dropOver
    // NB if dropOver is expanded target becomes first child, if collapsed next sibling
    
    const dragTarget = $(".dragTarget")[0];
    if (!dragTarget) return;                                // no target, no drop
    const dragNodeId = $(dragTarget).attr('data-tt-id');
    const dragNode = AllNodes[dragNodeId];
    const dropDisplayNode = $($(".dropOver")[0]).parent();
    const dropNodeId = $(dropDisplayNode).attr('data-tt-id');
    const dropBTNode = AllNodes[dropNodeId];
    const oldParentId = dragNode.parentId;

    if (dropBTNode.isTrash() || dropBTNode.trashed) {
        // Drop into trash => delete node
        deleteNode(dragNodeId);
        return;
    }
    if (dragNode.trashed && !dropBTNode.trashed && !dropBTNode.isTrash()) {
        // Dragging a trashed node, drop into a non-trashed node => untrash it
        dragNode.untrash();
    }
    if (dropNodeId && dropBTNode) {
        // move node and any associated tab/tgs
        moveNode(dragNode, dropBTNode, oldParentId);
    }
    if (dragNode.bookmarkId || dropBTNode.bookmarkId)
        // if dragged node is on or onto bbar then it should be updated to reflect move after actions above complete
        setTimeout(() => exportBookmarksBar(), 10);
        
    if (!dropBTNode.bookmarkId)
        // => not dropping into bbar, so null out any bookmarkid
        dragNode.bookmarkId = null;
}

function moveNode(dragNode, dropNode, oldParentId, browserAction = false) {
    // perform move for DnD and keyboard move - drop Drag over Drop
    // browserAction => user dragged tab in browser window, not in topic tree
    
    const treeTable = $("#content");
    if (dropNode.isTopic() && !dropNode.folded ) {
        // drop into dropNode as first child
        dragNode.handleNodeMove(dropNode.id, 0, browserAction);
        treeTable.treetable("move", dragNode.id, dropNode.id);
        const dragTr = $(`tr[data-tt-id='${dragNode.id}']`)[0];
        $(dragTr).attr('data-tt-parent-id', dropNode.id);
    } else {
        // drop below dropNode w same parent
        const parentId = dropNode.parentId;
        if (dragNode.id == parentId) {
            console.log ("trying to drop onto self"); 
            return;
        }
        const parent = parentId ? AllNodes[parentId] : null;
        const dropNodeIndex = parent ? parent.childIds.indexOf(parseInt(dropNode.id)) : -1;
        let newIndex;
        if (oldParentId != parentId) {
            newIndex = dropNodeIndex + 1;
        } else {
            // same parent, a bit tricky. Index dropNode +1 if dragging up, but if dragging down index will shift anyway when we remove it from its current position.
            const dragNodeIndex = parent ? parent.childIds.indexOf(parseInt(dragNode.id)) : -1;
            newIndex = (dragNodeIndex > dropNodeIndex) ? dropNodeIndex + 1 : dropNodeIndex;
        }

        dragNode.handleNodeMove(parentId, parent ? newIndex : -1, browserAction);
        if (parentId) {
            const dragTr = $(`tr[data-tt-id='${dragNode.id}']`)[0];
            const dropTr = $(`tr[data-tt-id='${dropNode.id}']`)[0];
            treeTable.treetable("move", dragNode.id, parentId);
            positionNode(dragTr, parentId, dropTr);          // sort into position
        } else {
            treeTable.treetable("insertAtTop", dragNode.id, dropNode.id);
        }
    }
    
    // update tree row if oldParent is now childless
    if (oldParentId && (AllNodes[oldParentId].childIds.length == 0)) {
        const ttNode = $("#content").treetable("node", oldParentId);
        $("#content").treetable("unloadBranch", ttNode);
    }

    // update the rest of the app, backing store
    saveBT();
    BTAppNode.generateTopics();
    sendMessage({'function': 'localStore', 'data': {'topics': Topics }});
}

function positionNode(dragNode, dropParentId, dropBelow) {
    // Position dragged node below the dropbelow element under the parent
    // NB treetable does not support this so we need to use this sort method
    const newPos = $("tr").index(dropBelow);
    const treeTable = $("#content");
    const treeParent = treeTable.treetable("node", dropParentId);
    const dropNode = dropBelow[0];
    $(dragNode).attr('data-tt-parent-id', dropParentId);
    function compare(a,b) {
        if (a<b) return -1;
        if (b<a) return 1;
        return 0;
    }
    treeTable.treetable("sortBranch", treeParent,
                        function(a,b) {
                            // Compare based on position except for dragnode 
                            let aa = a.row[0];
                            let bb = b.row[0];
                            if (aa == dragNode){
                                if (bb == dropNode)
                                    return 1;
                                return (compare (newPos, $("tr").index(bb)));
                            }
                            if (bb == dragNode) {
                                if (aa == dropNode)
                                    return -1;
                                return (compare ($("tr").index(aa), newPos));
                            }
                            return (compare ($("tr").index(aa), $("tr").index(bb)));
                        });
}


// Handle callbacks on node folding, update backing store
function rememberFold() {
    // Don't want to write file too often so wait a minute before saving
    // and a second for local/fast save
    
    if (!rememberFold.fastWriteTimer)
	    rememberFold.fastWriteTimer =
	        setTimeout(() => {
	            saveBT(true, false);                 // passing in saveLocal=true to just remember fold locally
	            rememberFold.fastWriteTimer = null
	        }, 1000);
    
    if (!rememberFold.writeTimer)
	    rememberFold.writeTimer =
	        setTimeout(() => {
	            saveBT(false, false);
	            rememberFold.writeTimer = null
	        }, 1*60*1000);
}

function nodeExpand() {
    const node = AllNodes[this.id];
    const update = node.folded;
    node.folded = false;

    // set highlighting based on open child links
    if (!node.hasOpenDescendants())
        $(this.row).removeClass('opened');

    // Update File and browser
    if (update) {
        rememberFold();
        node.updateTabGroup();
    }
        
}

function nodeCollapse() {
    const node = AllNodes[this.id];
    const update = !node.folded;
    node.folded = true;

    // if any highlighted descendants highlight node on collapse
    if (node.hasOpenDescendants())
        $(this.row).addClass('opened');
    
    // Update File and browser, if collapse is not a result of a drag start
    if (update) {
        rememberFold();
        node.updateTabGroup();
    }
}

function handleLinkClick(e) {
    if (!$(this).hasClass('btlink')) return;          // not a bt link
    const nodeId = $(this).closest("tr").attr('data-tt-id');
    AllNodes[nodeId].openPage();
    e.preventDefault();
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
    if (GroupingMode == 'NONE') return;
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
        if (configManager.getProp('BTStickyTabs') == 'NOTSTICKY') return false;
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
    const node = BTAppNode.findFromTab(tabId);
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

    if (SidePanel && (winId == BTWinId)) {
        handleFocus({'reason': 'BTTab activated'});       // window w BT Sidepanel got focus
        return;
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
    if (collapsed) $("table.treetable").treetable("collapseNode", node.id);
    if (!collapsed) $("table.treetable").treetable("expandNode", node.id);
}

function tabJoinedTG(data) {
    // tab joined TG, update tab and topic nodes as appropriate
    // NB Get here when an existing page is opened in its TG as well as page moving between TGs and tabgrouping being turned on from settings.
    // known TG but unknown node => unmanaged tab dropped into managed TG => save it to the topic

    if (GroupingMode != 'TABGROUP') return;                              // don't care
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
    
    if (GroupingMode != 'TABGROUP') return;
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
	    AllNodes[node]?.unshowForSearch();
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
	if(!$(tableNode).is(':visible'))
	    node.showForSearch();				    // unfold tree etc as needed
	currentSelection && $(currentSelection).removeClass('selected');
	$(tableNode).addClass('selected');

    // Make sure row is visible
    const topOfRow = $(node.getDisplayNode()).position().top;
    const displayTop = $(document).scrollTop();
    const height = $(window).height();
    if ((topOfRow < displayTop) || (topOfRow > (displayTop + height - 100)))
	    tableNode.scrollIntoView({block: 'center'});
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
 * Row Operations
 * buttonShow/Hide, Edit Dialog control, Open Tab/Topic, Close, Delete, ToDo
 * NB same fns for key and mouse events. 
 * getActiveNode finds the correct node in either case from event
 * 
 ***/

function buttonShow(e) {
    // Show buttons to perform row operations, triggered on hover
    $(this).addClass("hovered");
    sidePanelMouseIn();     // undo mouse out from containing sidepanel, see below
    const td = $(this).find(".left");

    if ($("#buttonRow").index() < 0) {
        // Can't figure out how but sometimes after a Drag/drop the buttonRow is deleted
        reCreateButtonRow();
    }
    
    // detach and center vertically on new td
    $("#buttonRow").detach().appendTo($(td));
    const offset = $(this).offset().top;
    const rowtop = offset + 2;

    // figure out if tooltips are on and would go off bottom
    const tooltips = configManager.getProp('BTTooltips') == 'ON';
    const scrollTop = $(document).scrollTop();
    const top = rowtop - scrollTop;
    const windowHeight = $(window).height();
    const bottomGap = windowHeight - top;
    if (tooltips && bottomGap < 130)
        $("#buttonRow span").removeClass("wenk--left").addClass("wenk--right");
    else if (tooltips)
        $("#buttonRow span").removeClass("wenk--right").addClass("wenk--left");

    const node = getActiveNode(e);
    if (!node || node.trashed) return;          // don't allow operations on deleted nodes
    if (node.isTrash())
        $('#deleteRow').parent().attr('data-wenk', 'Empty Trash');
    else
        $('#deleteRow').parent().attr('data-wenk', 'Delete item (del)');

    // Open/close buttons 
    const topic = node.isTopic() ? node : AllNodes[node.parentId];
    $("#openTab").hide();
    $("#openWindow").hide();
    $("#closeRow").hide();
    if (node.countOpenableTabs()){
        $("#openTab").show();
        if (!topic?.hasOpenChildren() || (GroupingMode != 'TABGROUP')) $("#openWindow").show();       // only allow opening in new window if not already in a TG, or not using TGs
    }
    if (node.countClosableTabs()) {
        $("#closeRow").show();
    }

    // show expand/collapse if some kids of branch are not open/closed
    if ($(this).hasClass("branch")) {
        const id = this.getAttribute("data-tt-id");
        const notOpenKids = $("tr[data-tt-parent-id='"+id+"']").not(".opened");
        if (notOpenKids?.length)
            $("#expand").show();
        const openKids = $("tr[data-tt-parent-id='"+id+"']").hasClass("opened");
        if (openKids)
            $("#closeRow").show();
    }

    // allow adding children on branches or unpopulated branches (ie no links)
    if (($(this).hasClass("branch") || !$(this).find('a').length) && !node.isTrash())
        $("#addChild").show();
    else
        $("#addChild").hide();

    // only show outdent on non-top level items. don't show it on links (!isTopic) where promoting would put to top level
    if ((this.getAttribute("data-tt-parent-id")) && !((node.level == 2) && !node.isTopic()))
        $("#outdent").show();
    else
        $("#outdent").hide();
    
    $("#buttonRow").offset({top: rowtop});
    $("#buttonRow").css("z-index", "0");
    $("#buttonRow").show();        
}

function buttonHide() {
    // hide button to perform row operations, triggered on exit    
    $(this).removeClass("hovered");
    $("#buttonRow").hide();
    $("#buttonRow").detach().appendTo($("#dialog"));
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
function sidePanelMouseIn() {
    // undo mouse out from above
    if (window.mouseOutStyle) {
        document.head.removeChild(window.mouseOutStyle);
        window.mouseOutStyle = null;
    }
}

function toggleMoreButtons(e) {
    // show/hide non essential buttons
    $("#otherButtons").toggle(100, 'easeInCirc', () => {
        $("#tools").toggleClass('moreToolsOn');
        let moreToolsOn = $("#tools").hasClass('moreToolsOn');
        let hint = moreToolsOn ? "Fewer Tools" : "More Tools";
        $("#moreToolsSpan").attr('data-wenk', hint);
        configManager.setProp('BTMoreToolsOn', moreToolsOn ? 'ON' : 'OFF');
    });
    if (e) {
        e.preventDefault();		// prevent default browser behavior
        e.stopPropagation();	// stop event from bubbling up
    }
    return false;
}

function editRow(e) {
    // position and populate the dialog and open it
    const node = getActiveNode(e);
    if (!node) return;
    const duration = e.duration || 400;
    const row = $(`tr[data-tt-id='${node.id}']`)[0];
    const top = $(row).position().top - $(document).scrollTop();
    const bottom = top + $(row).height();
    const dialog = $("#dialog")[0];
    
    // populate dialog
    const dn = node.fullTopicPath();
    if (dn == node.displayTopic)
        $("#distinguishedName").hide();    
    else {
        $("#distinguishedName").show();
        const upto = dn.lastIndexOf(':');
        const displayStr = dn.substr(0, upto);
        $("#distinguishedName").text(displayStr);
        // if too long scroll to right side
        setTimeout(() => {
            const overflow = $("#distinguishedName")[0].scrollWidth - $("#distinguishedName")[0].offsetWidth;
            if (overflow > 0) $("#distinguishedName").animate({ scrollLeft: '+='+overflow}, 500);
        }, 500);
    }
    if (node.isTopic()) {
        $("#titleUrl").hide();
        $("#titleText").hide();
        $("#topic").show();        
        $("#topicName").val($("<div>").html(node.displayTopic).text());
        node.displayTopic && $("#newTopicNameHint").hide();
        node.isTrash() && $("#topicName").hide();
    } else {
        $("#titleUrl").show();
        $("#titleText").show();
        $("#titleText").val(BTAppNode.editableTopicFromTitle(node.title));
        $("#topic").hide();
        $("#titleUrl").val(node.URL);
    }
    $("#textText").val(node.text);
    $("#update").prop("disabled", true);

    // overlay grays everything out, dialog animates open on top.
    $("#editOverlay").css("display", "block");
    const fullWidth = $($("#editOverlay")[0]).width();
    const dialogWidth = Math.min(fullWidth - 66, 600);    // 63 = padding + 2xborder == visible width
    const height = dialogWidth / 1.618;                   // golden!
    /*
    const otherRows = node.isTopic() ? 100 : 120;           // non-text area room needed
    $("#textText").height(height - otherRows);           // notes field fits but as big as possible
*/
    if ((top + height + 140) < $(window).height())
        $(dialog).css("top", bottom+80);
    else
        // position above row to avoid going off bottom of screen (or the top)
        $(dialog).css("top", Math.max(10, top - height + 30));

    // Animate opening w calculated size
    $(dialog).css({display: 'flex', opacity: 0.0, height: 0, width:0})
        .animate({width: dialogWidth, height: height, opacity: 1.0},
                 duration, 'easeInCirc',
                 function () {
                     $("#textText")[0].setSelectionRange(node.text.length, node.text.length);
                     e.newTopic ? $("#topicName").focus() : $("#textText").focus();
                 });
}

$(".editNode").on('input', function() {
    // enable update button if one of the texts is edited. Avoid creating new nodes with empty titles
    if ($("#topicName").is(":visible") && (!$("#topicName").val())) return;
    $("#update").prop('disabled', false);
});

$("#editOverlay").on('mousedown', function(e) {
    // click on the backdrop closes the dialog
    if (e.target.id == 'editOverlay')
    {
        closeDialog(cancelEdit); 
        $("#buttonRow").show(100);
    }
});

function checkCompactMode() {
    // Display changes when window is narrow
    if ($(window).width() < 400) {
        $("#content").addClass('compactMode');
        $("#search").css('left', 'calc((100% - 175px) / 2)');
        $("#searchHint .hintText").css('display', 'none');
    } else {
        $("#content").removeClass('compactMode');
        $("#search").css('left', 'calc((100% - 300px) / 2)');
        $("#searchHint .hintText").css('display', 'inline');    }
    updateStatsRow();
    initializeNotesColumn();
}


$(window).resize(() => checkCompactMode());

function closeDialog(cb = null, duration = 250) {
    // animate dialog close and potentially callback when done
    const dialog = $("#dialog")[0];
    const height = $(dialog).height();
    $(dialog).css({'margin-left':'auto'});                  // see above, resetting to collapse back to center
    $(dialog).animate({width: 0, height: 0}, duration, function () {
        $("#editOverlay").css("display", "none");
        $(dialog).css({width: '88%', height: height});      // reset for next open
        dialog.close();
        if (cb) cb();
    });
}

function getActiveNode(e) {
    // Return the active node for the event, either hovered (button click) or selected (keyboard)
    const tr = (['click', 'mouseenter'].includes(e.type)) ?
          $(e.target).closest('tr')[0] : $("tr.selected")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id') || 0;
    return AllNodes[nodeId];
}

function openRow(e, newWin = false) {
    // Open all links under this row in windows per topic

    // First find all AppNodes involved - selected plus children
    const appNode = getActiveNode(e);
    if (!appNode) return;

    // Warn if opening lots of stuff
    const numTabs = appNode.countOpenableTabs();
    if (numTabs > 10)
        if (!confirm(`Open ${numTabs} tabs?`))
            return;

    if (appNode.isTopic()) {
        $("table.treetable").treetable("expandNode", appNode.id);         // unfold
	    AllNodes[appNode.id].folded = false;
        setTimeout(() => appNode.openAll(newWin), 50);
    } else
        appNode.openPage(newWin);
    
    $("#openWindow").hide();
    $("#openTab").hide();
    $("#closeRow").show();
}

function closeRow(e) {
    // close this node's tab or window
    const appNode = getActiveNode(e);  
    if (!appNode) return;
    
    $("#openWindow").show();
    $("#openTab").show();
    $("#closeRow").hide();
    appNode.closeTab();
    
    gtag('event', 'close_row', {'event_category': 'TabOperation'});
    configManager.incrementStat('BTNumTabOperations');
}

function escapeRegExp(string) {
    // stolen from https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function deleteRow(e) {
    // Delete selected node/row.
    const appNode = getActiveNode(e);
    if (!appNode) return false;
    const kids = appNode.childIds.length && appNode.isTopic();         // Topic determines non link kids
    buttonHide();

    // Special handling for Trash node
    if (appNode.isTrash()) {
        // Create a copy of the childIds array before iterating
        const childIdsToDelete = [...appNode.childIds];
        childIdsToDelete.forEach((id) => {
            deleteNode(id);
        });
        return;
    }

    // If children nodes ask for confirmation
    if (!kids || confirm('Delete whole subtree?')) {
        // Remove from UI and treetable
        deleteNode(appNode.id);
    }
}

function deleteNode(id, browserAction = false) {
    // delete node and clean up
    // firstDelete moves the item into Trash, subsequent deletes it
    // if delete was a result of browserAction, eg tabLeftTG, don't screw with tgs etc
    id = parseInt(id);                 // could be string value
    const node = AllNodes[id];
    if (!node) return;
    const wasTopic = node.isTopic();
    const openTabs = node.listOpenTabs();

    function propogateClosed(parentId) {
        // update display of all ancestor nodes as needed
        if (!parentId) return;
        const parent = AllNodes[parentId];
        const openKids = parent.hasOpenChildren();
        const openDescendants = parent.hasOpenDescendants();
        if (!openKids) {
            parent.windowId = 0;
            parent.setTGColor(null)
        }
        if (!openDescendants) $("tr[data-tt-id='"+parent.id+"']").removeClass("opened");
        // update tree row if now is childless
        if (parent.childIds.length == 0) {
            const ttNode = $("#content").treetable("node", parent.id);
            $("#content").treetable("unloadBranch", ttNode);
            $(parent.getDisplayNode()).addClass("emptyTopic");
        }
        propogateClosed(parent.parentId);                       // recurse
    }
    
    // Highlight the tab if it's open and the Topic Manager is not TAB (jarring to swap active tabs)
    // (good user experience and side effect is to update the tabs badge info
    if (!browserAction) {
        const BTHome = configManager.getProp('BTManagerHome');
        if (node.tabId && (BTHome !== 'TAB'))
            node.showNode();
        // Ungroup if topic w open tabs
        if (openTabs.length) {
            const tabIds = openTabs.map(t => t.tabId);
            callBackground({'function': 'ungroup', 'tabIds': tabIds});
        }
    }

    if (!node.trashed) {
        // Move to trash    
        propogateClosed(node.parentId);                     // Update parent display
        const treeTable = $("#content");
        const trashNode = BTAppNode.findOrCreateTrashNode();
        node.handleNodeMove(trashNode.id);
        treeTable.treetable("move", node.id, trashNode.id);
        const treeNode = $(`tr[data-tt-id='${node.id}']`)[0];
        $(treeNode).attr('data-tt-parent-id', trashNode.id);
        $(treeNode).addClass('trashed');
        node.trash();
        initializeUI();
    } else {
        // Delete from trash
        $("table.treetable").treetable("removeNode", id);    // Remove from UI and treetable
        BTNode.deleteNode(id);             // delete from model. NB handles recusion to children
    }

    if (node.bookmarkId) {
        // update bookmarks
        node.bookmarkId = 0;
        exportBookmarksBar();        // update bookmarks bar
    }
    
    // if wasTopic remove from Topics and update extension
    if (wasTopic) {
        BTAppNode.generateTopics();
        sendMessage({'function': 'localStore', 'data': {'topics': Topics }});
    }
    
    // Update File 
    saveBT();
}

function updateRow() {
    // Update this node/row after edit.
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id');
    if (!nodeId) return null;
    const node = AllNodes[nodeId];

    // Update Model
    const url = $("#titleUrl").val();
    const title = $("#titleText").val();
    const topic = $("#topicName").val();
    if (node.isTopic()) {
        const changed = (node.title != topic);
        node.title = topic;
        if (changed) node.updateTabGroup();               // update browser (if needed)
    } else
        node.replaceURLandTitle(url, title);
    node.text = $("#textText").val();

    // Update ui
    $(tr).find("span.btTitle").html(node.displayTitle());
    $(tr).find("span.btText").html(node.displayText());
    if (node.tgColor) node.setTGColor(node.tgColor);
    node.populateFavicon();                     // async, will just do its thing

    // Update File 
    saveBT();

    // Update extension
    BTAppNode.generateTopics();
    sendMessage({'function': 'localStore', 'data': {'topics': Topics }});
    node.bookmarkId && exportBookmarksBar(); // update bookmarks bar if needed

    // reset ui
    closeDialog();
    initializeUI();
}
function toDo(e) {
    // iterate todo state of selected node/row (TODO -> DONE -> '').
    const appNode = getActiveNode(e);
    if (!appNode) return false;

    appNode.iterateKeyword();                // ask node to update internals

    // Update ui and file
    const tr = $(`tr[data-tt-id='${appNode.id}']`);
    $(tr).find("span.btTitle").html(appNode.displayTitle());
    if (appNode.tgColor) appNode.setTGColor(appNode.tgColor);
    appNode.populateFavicon();                     // async, will just do its thing
    
    // Stop the event from selecting the row and line up a save
    e.stopPropagation();
    initializeUI();
    saveBT();
}

function promote(e) {
    // move node up a level in tree hierarchy
    
    const node = getActiveNode(e);
    if (!node || !node.parentId) return;                  // can't promote
    
    // collapse open subtree if any
    if (node.childIds.length)
        $("#content").treetable("collapseNode", node.id);

    // Do the move
    const newParentId = AllNodes[node.parentId].parentId;
    node.handleNodeMove(newParentId);
    $("table.treetable").treetable("promote", node.id);

    // save to file, update Topics etc
    saveBT();
    BTAppNode.generateTopics();
    sendMessage({'function': 'localStore', 'data': {'topics': Topics }});
    node.bookmarkId && exportBookmarksBar(); // update bookmarks bar if needed
}

function _displayForEdit(newNode) {
    // common from addNew and addChild below

    newNode.createDisplayNode();
    // highlight for editing
    const tr = $(`tr[data-tt-id='${newNode.id}']`);
    $("tr.selected").removeClass('selected');
    $(tr).addClass("selected");

    // scrolled into view
    const displayNode = tr[0];
	displayNode.scrollIntoView({block: 'center'});

    // position & open card editor. Set hint text appropriately
    const clientY = displayNode.getBoundingClientRect().top + 25;
    const dummyEvent = {'clientY': clientY, 'target': displayNode, 'newTopic': true};
    $("#newTopicNameHint").show();
    $("#topicName").off('keyup');
    $("#topicName").on('keyup', () => $("#newTopicNameHint").hide());
    editRow(dummyEvent);
}

function addNewTopLevelTopic() {
    // create new top level item and open edit card
    if (Resizing) return;                   // ignore during column resize
    const newNode = new BTAppNode('', null, "", 1);
    _displayForEdit(newNode);
}

function addChild(e) {
    // add new child to selected node

    // create child element
    const node = getActiveNode(e);
    if (!node) return;
    const newNode = new BTAppNode('', node.id, "", node.level + 1, true);       // true => add to front of parent's children
    _displayForEdit(newNode);

    $(node.getDisplayNode()).removeClass("emptyTopic");
    node.bookmarkId && exportBookmarksBar(); // update bookmarks bar if needed

    // Stop the event from selecting the row
    e.stopPropagation();
    initializeUI();
}

function cancelEdit() {
    // delete node if edit cancelled w empty name
    
    const tr = $("tr.selected")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id') || 0;
    const name = AllNodes[nodeId]?.title;
    if (!nodeId || name != '') return;

    deleteNode(nodeId);
}

/***
 * 
 * Option Processing
 * Imports of Bookmarks, org file, tabsOutliner json. Grouping option updates
 * 
 ***/

async function processImport(nodeId) {
    // an import (bkmark, org, tabsOutliner) has happened => save and refresh

    configManager.closeConfigDisplays();                      // close panel
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

function importSession() {
    // Send msg to result in subsequent session save
    sendMessage({'function': 'saveTabs', 'type': 'Session', 'topic': '', 'from':'btwindow'});
}

/***
 * 
 * Search support
 * 
 ***/
let ReverseSearch = false;
let SearchOriginId = 0;
$("#search_entry").on("keyup", search);
$("#search_entry").on("keydown", searchOptionKey);
$("#search_entry").on("focus", enableSearch);
$("#search_entry").on("focusout", disableSearch);
$("#searchHint").on("click", enableSearch);
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

        scrollIntoViewIfNeeded(node.getDisplayNode());
	    let highlight = $(displayNode).find("span.highlight")[0];
	    if (highlight) {
            // make sure hit is visible horizontally. NB scrollIntoView also scrolls vertically, need to reset that
            const v = $(document).scrollTop();
            highlight.scrollIntoView({'inline' : 'center'});
            $(document).scrollTop(v);
            $(displayNode).find(".left").css("text-overflow", "clip");
        }
        
	    $("#search_entry").removeClass('failed');
	    $("td").removeClass('searchLite');
        resetFilterSearch();                                // reset search filter button 
	    ExtendedSearchCB = setTimeout(() => extendedSearch(sstr, node), 200);
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
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    return $("#content tr:visible").filter(function() {
        return isInViewport(this);
    })
    .map(function() { return $(this).attr("data-tt-id")})
    .get().map((e) => AllNodes[parseInt(e)]);
}

function scrollIntoViewIfNeeded(element) {
    // Helper function to make sure search or nav to item has its row visible but only scroll if needed
    // NB needed the timeout for block:center to work
    const height = $(window).height();
    const topOfRow = $(element).position().top;
    const displayTop = $(document).scrollTop();

    if (topOfRow < displayTop || topOfRow > (displayTop + height - 200)) {
        setTimeout(() => {
            element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 0);
    }
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
    if (code === "Escape") configManager.closeConfigDisplays();

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
            configManager.toggleKeyCommands();
        } else {
            $('#keyCommands').show();
            configManager.toggleHelpDisplay();
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
    if (topicNode && (GroupingMode == 'TABGROUP')) {
        topicNode.groupOpenChildren();
    }

    initializeUI();
    saveBT();
    BTAppNode.generateTopics();
    sendMessage({'function': 'localStore', 'data': {'topics': Topics }});

}
