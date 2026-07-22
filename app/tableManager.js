/**
 * Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 * tableManager.js
 * Handles table generation, UI initialization, drag and drop, and node positioning
 */

'use strict';

import { getProp, setProp } from './configManager.js';
import { closeConfigDisplays, updatePrefs } from './applicationUI.js';
import { messageManager } from './messageManager.js';
import { AllNodes, BTNode } from './BTNode.js';
import { BTAppNode, Topics } from './BTAppNode.js';
import { BTSessionNode, SessionNodeType } from './BTSessionNode.js';
import { parseBTFile } from './parser.js';
import { sendMessage, callBackground, registerMessageHandler, requestBrowserSnapshot } from './extensionMessaging.js';
import { getBTFile, getBTFileText, savePendingP, saveBT, updateSyncSettings, syncEnabled, updateStatsRow } from './fileManager.js';
import { buttonShow, buttonHide, deleteNode } from './rowManager.js';
import { exportBookmarksBar } from './bookmarksManager.js';

/***
 *
 * Table handling
 *
 ***/

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
    AllNodes.length = 0;  // Clear the array without reassigning

    // Either get BTFileText from file or use local copy. If file then await its return
    try {
        if (fromStore)
            await getBTFile();
        processBTFile();
        messageManager.removeWarning(); // warning may have been set, safe to remove
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

function processBTFile(fileText = getBTFileText()) {
    // turn the org-mode text into an html table, extract Topics

    // First clean up from any previous state
    BTNode.topIndex = 1;
    AllNodes.length = 0;  // Clear the array without reassigning
    
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
    setProp('BTFileText', getBTFileText());
    
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
    reconcileOpenStateCSS();          // paint the full open-tab ancestor chain, not just tab/tg-owning nodes (bug 6829)
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
    updatePrefs();
    $('body').removeClass('waiting');
}


/**
 *      Column resizing functionality
 **/

function initializeNotesColumn() {
    // Initialize column widths from saved BTNotes (percent). If not numeric, use a sensible default.
    // Then align the resizer to the actual left column width to match draggable stop behavior.
    const notesPref = getProp('BTNotes');
    let percent = parseInt(notesPref);
    if (!Number.isFinite(percent)) percent = 50;

    if (percent < 95) {
        $("#content").addClass('showNotes').removeClass('hideNotes');
        // Exclude unsaved session rows from width changes - they're controlled by CSS
        $("tr:not(.unsaved) td.left").css("width", percent + "%");
        $("tr:not(.unsaved) td.right").css("width", (100 - percent) + "%");
    } else {
        $("#content").addClass('hideNotes').removeClass('showNotes');
    }

    // Initialize the draggable resizer
    initializeResizer();
    
    // Finally, align the resizer knob with the rendered left column width
    updateResizerPositionFromColumns();
}

function handleResizer() {
    // Resizer has been dragged, or during set up
    const left = $("#resizer").position().left + 13;
    const fullWidth = $(window).width();
    const percent = parseInt(left / fullWidth * 100);

    if (percent < 95) {
        $("#content").addClass('showNotes').removeClass('hideNotes');
        // Exclude unsaved session rows from width changes 
        $("tr:not(.unsaved) td.left").css("width", percent + "%");
        $("tr:not(.unsaved) td.right").css("width", (100 - percent) + "%");
    } else {
        $("#content").addClass('hideNotes').removeClass('showNotes');
    }
}
function updateResizerPositionFromColumns() {
    // Align #resizer to the actual width of the left column (same approach as in draggable stop)
    // NB need a visible cell, not a session node which don't have the right column
    const leftCell = $("#content tr:not(.sessionNode) td.left:visible")[0];       
    if (!leftCell) return;
    const leftWidth = $(leftCell).width();
    if (leftWidth == null) return;
    $("#resizer").css('left', parseInt(leftWidth - 9.5) + "px");
}

function initializeResizer() {
    // Initialize the draggable resizer - must be called after DOM is ready
    $("#resizer").draggable({
        containment: "#newTopLevelTopic",                   // Restrict dragging within the parent div
        axis: "x",
        drag: function(e, ui) {
            Window.BrainTool.resizing = true;
            handleResizer();
        },
        stop: () => setTimeout(() => {
            const left = $("#resizer").position().left + 13;
            const fullWidth = $(window).width();
            const percent = parseInt(left / fullWidth * 100);
            setProp('BTNotes', percent);      // save the new width, BTNotes = NOTES, NONOTES or % width
            handleResizer();
            delete Window.BrainTool.resizing;
            // Update the resizer position to match the new left column width
            updateResizerPositionFromColumns();
        }, 250),                                            // give time for resize to be processed
    });
    // add on entry and on exit actions to highlight the resizer
    $("#newTopLevelTopic").on('mouseenter', () => $("#resizer").css("opacity", 1));
    $("#newTopLevelTopic").on('mouseleave', () => $("#resizer").css("opacity", 0.5));
}

/**
 *      General UI Setup
 */

function initializeUI() {
    //DRY'ing up common event stuff needed whenever the tree is modified
    console.log('Initializing UI');
    if (Window.BrainTool && Window.BrainTool.dragging) return;   // skip if drag in progress
    
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
        closeConfigDisplays();                    // clicking also closes any open panel
    });
    
    makeRowsDraggable();                                        // abstracted out below

    // Hide loading notice and show sync/refresh buttons as appropriate
    $("#loading").hide();
    updateSyncSettings(syncEnabled());

    updateStatsRow(getProp('BTTimestamp'));   // show updated stats w last save time
    Window.BrainTool = {};                    // currently used to track dragging only
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
        distance: 5,                                            // pixels mouse must move before drag starts
        delay: 100,                                             // ms to wait before initiating drag (helps single/double-clicks)
        stop: function( event, ui ) {
            // turn hover bahavior back on and remove classes iused to track drag
            $("table.treetable tr").on('mouseenter', null, buttonShow);
            $("table.treetable tr").on('mouseleave', null, buttonHide);
            // Only enable droppable on rows that have been initialized as droppable
            $("table.treetable tr").each(function() {
                if ($(this).data('ui-droppable')) {
                    $(this).droppable("enable");
                }
            });
            $("tr").removeClass("hovered");
            $("td").removeClass("dropOver");
            $("td").removeClass("dropOver-pulse");
            $("tr").removeClass("dragTarget");
            $("tr").removeClass("ui-droppable-disabled");
            Window.BrainTool.dragging = false;
        },
        revert: "invalid"                                       // revert when drag ends but not over droppable
    });
}

function dragStart(event, ui) {
    // Called when drag operation is initiated. Set dragged row to be full sized
    console.log("dragStart");
    Window.BrainTool.dragging = true;
    const w = $(this).css('width');
    const h = $(this).css('height');
    ui.helper.css('width', w).css('height', h);
    const nodeId = $(this).attr('data-tt-id');
    const node = AllNodes[nodeId];

    if (node?.allowedRowActions && node.allowedRowActions().drag === false) {
        event.preventDefault();
        return false;
    }

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
        accept: function(draggable) {
            // Check if the drop target can accept the dragged node
            const dropNodeId = $(this).attr('data-tt-id');
            const dropNode = AllNodes[dropNodeId];
            
            const dragNodeId = $(draggable).attr('data-tt-id');
            const dragNode = AllNodes[dragNodeId];
            
            if (!dropNode || !dragNode) return true;  // Let other validation handle it
            
            // Use canAcceptDrop for validation
            return dropNode.canAcceptDrop(dragNode);
        },
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
            // highlight node a drop would drop below and underline the potential position, could be at top
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
        if (parentNode.isSessionNode) {
            $("table.treetable td").removeClass(["dropOver", "dropOver-pulse"]);
            $("#content").on("dragover", contentDragoverHandler);
            return;
        }

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

// ====================================
// Helper functions for opening app nodes in browser
// ====================================

function openAppNodeInWindow(appNode, windowId, index = null) {
    // Open an app node (topic or link) in a specific browser window
    // Optional index parameter specifies the tab position (leftmost tab if opening multiple)
    if (appNode.isTopic()) {
        // Open all children as tab group(s) in this window
        const tabGroupsToOpen = appNode.listOpenableTabGroups();
        if (tabGroupsToOpen.length > 0) {
            sendMessage({
                'function': 'openTabGroups',
                'tabGroups': tabGroupsToOpen,
                'windowId': windowId,
                'newWin': false,
                'index': index  // Position of first tab in first group
            });
        }
    } else {
        // Open single tab in this window (will create/use appropriate tab group)
        callBackground({
            'function': 'openTabs',
            'tabs': [{'nodeId': appNode.id, 'url': appNode.URL}],
            'defaultWinId': windowId,
            'newWin': false,
            'index': index  // Position for this tab
        });
    }
}

function openAppNodeInTabGroup(appNode, tabGroupId, windowId) {
    // Open an app node (link only) in a specific tab group
    // Topics are not allowed in tab groups (validation should prevent this)
    if (appNode.isTopic()) {
        console.warn('Cannot drop topic into tab group');
        return;
    }
    
    callBackground({
        'function': 'openTabs',
        'tabs': [{'nodeId': appNode.id, 'url': appNode.URL}],
        'tabGroupId': tabGroupId,
        'windowId': windowId,
        'newWin': false
    });
}

function openAppNodeInBrowser(appNode, sessionNode) {
    // Open an unopened app node in the browser based on where it's dropped in the session tree
    // This is called when dragging an app node (without tabId) into the session tree
    
    const sessionType = sessionNode.sessionType;
    
    if (sessionType === SessionNodeType.ROOT) {
        // Drop into root → open in new window
        if (appNode.isTopic()) {
            appNode.openAll(true);  // true = new window
        } else {
            appNode.openPage(true);  // true = new window
        }
        return;
    }
    
    if (sessionType === SessionNodeType.WINDOW) {
        // Drop into window → open in that window
        const windowId = sessionNode.windowId;
        if (!windowId) {
            console.warn('Session window has no windowId');
            return;
        }
        
        openAppNodeInWindow(appNode, windowId);
        return;
    }
    
    if (sessionType === SessionNodeType.GROUP) {
        // Check if group is collapsed (drop as sibling) or expanded (drop into group)
        if (sessionNode.folded) {
            // Collapsed group - treat as drop below it (sibling under parent window)
            const parentNode = sessionNode.parentId ? AllNodes[sessionNode.parentId] : null;
            if (!parentNode || !parentNode.isSessionNode) {
                console.warn('Group has no valid parent');
                return;
            }
            
            if (parentNode.sessionType === SessionNodeType.WINDOW) {
                const windowId = parentNode.windowId;
                if (!windowId) {
                    console.warn('Parent window has no windowId');
                    return;
                }
                
                openAppNodeInWindow(appNode, windowId);
            }
            return;
        }
        
        // Expanded group - drop into tab group → open tab in that specific group
        const tabGroupId = sessionNode.tabGroupId;
        const windowId = sessionNode.windowId;
        
        if (!tabGroupId || !windowId) {
            console.warn('Session group missing IDs');
            return;
        }
        
        openAppNodeInTabGroup(appNode, tabGroupId, windowId);
        return;
    }
    
    if (sessionType === SessionNodeType.TAB) {
        // Tab node - check immediate parent to determine behavior
        const parentNode = sessionNode.parentId ? AllNodes[sessionNode.parentId] : null;
        if (!parentNode || !parentNode.isSessionNode) {
            console.warn('Tab node has no valid parent');
            return;
        }
        
        if (parentNode.sessionType === SessionNodeType.WINDOW) {
            // Parent is Window - open in that window
            const windowId = parentNode.windowId;
            if (!windowId) {
                console.warn('Parent window has no windowId');
                return;
            }
            
            openAppNodeInWindow(appNode, windowId);
        } else if (parentNode.sessionType === SessionNodeType.GROUP) {
            // Check if this is the bottom tab in the group
            if (sessionNode.isBottomTabInGroup()) {
                // Open as sibling to the group in the window (positioned after this tab)
                const windowId = parentNode.windowId;
                if (!windowId) {
                    console.warn('Parent window has no windowId');
                    return;
                }
                const targetIndex = sessionNode.tabIndex + 1;  // Position after this tab
                openAppNodeInWindow(appNode, windowId, targetIndex);
            } else {
                // Normal case: open into the group
                const tabGroupId = parentNode.tabGroupId;
                const windowId = parentNode.windowId;
                
                if (!tabGroupId || !windowId) {
                    console.warn('Parent group missing IDs');
                    return;
                }
                
                openAppNodeInTabGroup(appNode, tabGroupId, windowId);
            }
        }
        return;
    }
}

// ====================================
// Saving session nodes dropped into the app tree
// ====================================

let SessionSaveHandler = null;
function registerSessionSaveHandler(fn) {
    // bt.js registers saveTabs here at startup, avoiding a tableManager -> bt.js import cycle
    SessionSaveHandler = fn;
}

function sessionTabData(node, topic, groupId = 0) {
    // Build a saveTabs tab entry from a session TAB node.
    // groupId defaults to 0: passing the tab's real group would make saveTabs adopt,
    // and then rename, the group the tab happens to be sitting in.
    const titleMatch = node.title?.match(/\[\[.*?\]\[(.*?)\]\]/);
    return {'tabId': node.tabId, 'groupId': groupId, 'windowId': node.windowId,
            'url': node.URL, 'title': titleMatch ? titleMatch[1] : (node.title || node.URL),
            'favIconUrl': node.faviconUrl, 'tabIndex': node.tabIndex,
            'note': node.text, 'topic': topic};
}

function saveSessionNodeToApp(dragNode, dropBTNode) {
    // Dropping a session node into the app tree files it under the drop target's topic - the
    // mirror of openAppNodeInBrowser above. Never a move: the session node itself is not touched,
    // sisterNode linkage and text sync take over once its appNode exists. An unsaved node is
    // saved as new appNode(s), an already saved one has its existing appNode re-filed.
    if (!SessionSaveHandler) return;
    const { newParent } = determineDropBehavior(dropBTNode);
    const topicPath = newParent?.topicPath || '';

    const savedNode = dragNode.topicTreeNode();
    if (savedNode) {
        // Already saved => re-file its appNode under the new topic rather than saving again
        // (saveTabs would no-op on the known tabId). moveNode handles the tree move, the
        // browser regrouping via handleNodeMove, and the file save.
        if (savedNode.id == dropBTNode.id) return;          // dropped on its own appNode
        moveNode(savedNode, dropBTNode, savedNode.parentId);
    }
    else if (dragNode.sessionType === SessionNodeType.TAB && dragNode.tabId) {
        // Single tab: standard save semantics. groupAndPosition wraps the tab in a new group
        // named for the topic, or moves it into the topic's existing group if it has open tabs.
        // A tab needs a topic to live under, so a top level drop (no newParent) is a no-op -
        // an empty topicPath would otherwise fall through to saveTabs' 📝 SCRATCH default.
        if (!newParent) return;
        SessionSaveHandler({'saveType': 'Tab', 'tabs': [sessionTabData(dragNode, topicPath)],
                            'close': false, 'dropNodeId': dropBTNode.id});
    }
    else if (dragNode.sessionType === SessionNodeType.GROUP) {
        // Tab group: create a subtopic named for the group with a leaf per contained tab.
        // The real groupId is passed so the new topic adopts the tabgroup (colors, sister
        // linkage); grouping:false so the browser tabs are not rearranged. Since grouping is
        // suppressed the tabGroupUpdated event that normally delivers the color never fires,
        // so pass the color we already have from the session node.
        const topic = topicPath ? `${topicPath}:${dragNode.title}` : dragNode.title;
        const tabs = dragNode.childIds.map(id => AllNodes[id])
              .filter(node => node?.sessionType === SessionNodeType.TAB && node.tabId)
              .map(node => sessionTabData(node, topic, dragNode.tabGroupId));
        if (!tabs.length) return;
        SessionSaveHandler({'saveType': 'TG', 'tabs': tabs, 'close': false,
                            'grouping': false, 'tabGroupColor': dragNode.tgColor || null,
                            'dropNodeId': dropBTNode.id});
    }
    else return;                                            // WINDOW/ROOT drags are rejected in canAcceptDrop

    requestBrowserSnapshot();                               // refresh session rows w inTopicTree styling
    if (dropBTNode.bookmarkId || newParent?.bookmarkId)
        setTimeout(() => exportBookmarksBar(), 10);         // dropped into bookmarks bar topic => resync the bar
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

    // Handle drop of unopened appNode into session tree
    if (!dragNode.isSessionNode && dropBTNode.isSessionNode && !dragNode.tabId) {
        openAppNodeInBrowser(dragNode, dropBTNode);
        return;
    }

    // Handle drop of unsaved session node into app tree => save it, session node doesn't move
    if (dragNode.isSessionNode && !dropBTNode.isSessionNode) {
        saveSessionNodeToApp(dragNode, dropBTNode);
        return;
    }

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

// ====================================
// MOVE NODE - Refactored into specialized handlers
// ====================================

function moveNode(dragNode, dropNode, oldParentId, browserAction = false) {
    // Dispatch to appropriate handler based on node types
    const dragIsSession = dragNode.isSessionNode;
    const dropIsSession = dropNode.isSessionNode;
    
    if (dragIsSession && dropIsSession) {
        moveSessionToSession(dragNode, dropNode, oldParentId, browserAction);
    } else if (!dragIsSession && !dropIsSession) {
        moveAppToApp(dragNode, dropNode, oldParentId, browserAction);
    } else {
        // session<->app transitions are conversions, not moves - handled in dropNode
        console.warn("moveNode: session<->app drop should have been intercepted in dropNode");
        return;
    }
    
    // Common post-move cleanup
    cleanupAfterMove(oldParentId);
    saveBT();
    BTAppNode.generateTopics();
    scheduleOpenStateReconcile();                   // repaint stale .opened blue state (bug 6829)
}

// ====================================
// Common helper functions
// ====================================

function determineDropBehavior(dropNode) {
    // Returns { isDropInto, newParent }
    const isDropInto = dropNode.isTopic() && !dropNode.folded;
    const newParent = isDropInto ? dropNode : (dropNode.parentId ? AllNodes[dropNode.parentId] : null);
    return { isDropInto, newParent };
}

function calculateNewIndex(dragNode, dropNode, parent, oldParentId) {
    // Calculate the index where dragNode should be inserted under parent
    const dropNodeIndex = parent ? parent.childIds.indexOf(parseInt(dropNode.id)) : -1;
    
    if (oldParentId !== parent?.id) {
        // Different parent: insert after dropNode
        return dropNodeIndex + 1;
    } else {
        // Same parent: account for removal shifting indices
        const dragNodeIndex = parent ? parent.childIds.indexOf(parseInt(dragNode.id)) : -1;
        return (dragNodeIndex > dropNodeIndex) ? dropNodeIndex + 1 : dropNodeIndex;
    }
}

function performTreeMove(dragNode, dropNode, parentId, newIndex, browserAction) {
    // Execute the tree table move and positioning
    const treeTable = $("#content");
    const dragTr = $(`tr[data-tt-id='${dragNode.id}']`)[0];
    const dropTr = $(`tr[data-tt-id='${dropNode.id}']`)[0];
    
    dragNode.handleNodeMove(parentId, newIndex, browserAction);
    
    if (parentId) {
        treeTable.treetable("move", dragNode.id, parentId);
        if (dragTr && dropTr) {
            positionNode(dragTr, parentId, dropTr);
        }
    } else {
        treeTable.treetable("insertAtTop", dragNode.id, dropNode.id);
    }
    
    if (dragTr) {
        $(dragTr).attr('data-tt-parent-id', parentId);
    }
}

function cleanupAfterMove(oldParentId) {
    // Clean up empty parent nodes after a move
    if (!oldParentId) return;
    
    const treeTable = $("#content");
    const oldParentNode = AllNodes[oldParentId];
    
    if (!oldParentNode || oldParentNode.childIds.length > 0) {
        // Parent still has children or doesn't exist
        if (oldParentNode && oldParentNode.childIds.length === 0 && !oldParentNode.isSessionNode) {
            const ttNode = treeTable.treetable("node", oldParentId);
            if (ttNode) treeTable.treetable("unloadBranch", ttNode);
        }
        return;
    }
    
    // Empty session GROUP nodes should be removed (mirrors Chrome behavior)
    if (oldParentNode.isSessionNode && oldParentNode.sessionType === SessionNodeType.GROUP) {
        const grandParentId = oldParentNode.parentId;
        const grandParent = grandParentId != null ? AllNodes[grandParentId] : null;
        const parentTreeNode = treeTable.treetable("node", oldParentNode.id);
        
        if (parentTreeNode) treeTable.treetable("removeNode", oldParentNode.id);
        if (grandParent) grandParent.removeChild(oldParentNode.id);
        delete AllNodes[oldParentNode.id];
    }
}

// ====================================
// Open-state (blue "has open tab") reconciliation
// ====================================

let openStateReconcileTimer = null;
function scheduleOpenStateReconcile(delay = 500) {
    // Debounced repaint of the .opened CSS state after a move. Delayed so any browser
    // regrouping/tab events the move kicked off settle before we repaint (mirrors the 500ms
    // requestBrowserSnapshot window). A single pending sweep covers a burst of moves.
    if (openStateReconcileTimer) return;
    openStateReconcileTimer = setTimeout(() => {
        openStateReconcileTimer = null;
        reconcileOpenStateCSS();
        reconcileSessionIndents();
    }, delay);
}

function reconcileSessionIndents() {
    // Recompute the indent (indenter paddingLeft) for every session-tree row. treetable's
    // move() reparents a node but never re-render()s it, and the session drop-into path relies
    // solely on that move() (no sortBranch re-indent pass like the app path), so a dragged
    // session node and its descendants keep their old depth's indent. Reassert it from each
    // treetable node's live level() - mirrors what render() does (jquery.treetable.js:252).
    const tt = $("#content");
    AllNodes.forEach(node => {
        if (!node || !node.isSessionNode) return;
        const ttNode = tt.treetable("node", node.id);
        if (ttNode?.indenter?.[0])
            ttNode.indenter[0].style.paddingLeft =
                "calc(var(--btIndentStepSize) * " + ttNode.level() + ")";
    });
}

function reconcileOpenStateCSS() {
    // Repaint the .opened ("has an open tab") blue state across the whole topic tree in a
    // single O(n) pass (~8ms @ 10k nodes). handleNodeMove only clears the immediate old parent
    // and only when the moved node itself holds a tab, so dragging a topic (or a deep subtree)
    // with an open tab out from under a parent left the old ancestors stale-blue - bug 6829.
    // Model-driven (AllNodes), so folded/collapsed rows resolve correctly; only rows actually in
    // the DOM get repainted, which is exactly what we want (collapsed rows keep their class hidden,
    // and expand/collapse recompute their own state - see nodeExpand/nodeCollapse).
    const rowMap = new Map();
    document.querySelectorAll("#content tr[data-tt-id]").forEach(
        r => rowMap.set(parseInt(r.getAttribute('data-tt-id')), r));

    const openMemo = new Map();
    function hasOpen(id) {
        if (openMemo.has(id)) return openMemo.get(id);
        const node = AllNodes[id];
        if (!node) return false;
        openMemo.set(id, false);                          // in-progress guard against cycles
        const open = !!node.tabId || node.childIds.some(cid => hasOpen(cid));
        openMemo.set(id, open);
        return open;
    }

    rowMap.forEach((row, id) => {
        const node = AllNodes[id];
        if (!node || node.isSessionNode) return;          // session tree manages its own styling
        const open = hasOpen(id);
        row.classList.toggle('opened', open);
        // drop stale tab-group tint on a topic that no longer has an open tab of its own
        if (!open && node.isTopic() && node.tgColor && !node.hasOpenChildren())
            node.setTGColor(null);
    });
}

// ====================================
// Session-to-Session moves
// ====================================

function moveSessionToSession(dragNode, dropNode, oldParentId, browserAction) {
    const treeTable = $("#content");
    const { isDropInto, newParent } = determineDropBehavior(dropNode);
    
    // Special case: bottom TAB in GROUP - adjust parent to WINDOW instead of GROUP
    let adjustedParent = newParent;
    if (dropNode.sessionType === SessionNodeType.TAB && dropNode.isBottomTabInGroup()) {
        // Get the grandparent (WINDOW) instead of parent (GROUP)
        const groupParent = newParent;  // This is the GROUP
        adjustedParent = groupParent?.parentId ? AllNodes[groupParent.parentId] : null;
    }
    
    // Check canMoveTo with the adjusted parent
    if (!dragNode.canMoveTo(adjustedParent)) return;
    
    // Special case: SESSION ROOT should never be treated as drop-into, always as parent
    const isSessionRoot = dropNode.sessionType === SessionNodeType.ROOT;
    
    if (isDropInto && !isSessionRoot) {
        // Drop into expanded topic as first child (but not ROOT)
        dragNode.handleNodeMove(dropNode.id, 0, browserAction);
        treeTable.treetable("move", dragNode.id, dropNode.id);
        const dragTr = $(`tr[data-tt-id='${dragNode.id}']`)[0];
        if (dragTr) $(dragTr).attr('data-tt-parent-id', dropNode.id);
        return;
    }
    
    // Drop below node as sibling (or into ROOT as child)
    let parentId = dropNode.parentId;
    let parent = parentId ? AllNodes[parentId] : null;
    let dropReference = dropNode;  // Node to use for index calculation
    
    // Special case: dropping into/below ROOT means into ROOT
    if (isSessionRoot) {
        parentId = dropNode.id;
        parent = dropNode;
    }
    
    // Apply the adjusted parent if dropping below bottom TAB in GROUP
    if (adjustedParent && adjustedParent !== newParent) {
        parentId = adjustedParent.id;
        parent = adjustedParent;
        // Use the GROUP (original parent) as reference since it's a child of adjusted WINDOW
        dropReference = newParent;  // newParent is the GROUP
    }
    
    if (dragNode.id === parentId) {
        console.log("trying to drop onto self");
        return;
    }
    
    const sessionRoot = parent?.sessionType === SessionNodeType.ROOT ? parent : null;
    const newIndex = calculateNewIndex(dragNode, dropReference, parent, oldParentId);
    
    // Check if we need to create a new window (TAB/GROUP dropped into ROOT)
    const needsNewWindow = !browserAction && 
                          dragNode.isSessionNode && 
                          sessionRoot && 
                          dragNode.sessionType !== SessionNodeType.WINDOW;
    
    if (needsNewWindow) {
        createSessionNode(dragNode, dropNode, sessionRoot, newIndex, browserAction);
    } else {
        performTreeMove(dragNode, dropNode, parentId, parent ? newIndex : -1, browserAction);
    }
}

function createSessionNode(dragNode, dropNode, sessionRoot, newIndex, browserAction) {
    // Create and position sessionNode in the tree at appropriate index. then create window in browser
    const treeTable = $("#content");
    const windowTitle = BTSessionNode.generateWindowTitle();
    const createdWindowNode = new BTSessionNode(windowTitle, sessionRoot.id, '', sessionRoot.level + 1, {
        sessionType: SessionNodeType.WINDOW,
    });
    createdWindowNode.windowId = 0;
    createdWindowNode.tabGroupId = 0;
    createdWindowNode.createDisplayNode();
    
    // Position the window node
    const currentIndex = sessionRoot.childIds.indexOf(createdWindowNode.id);
    if (currentIndex > -1 && currentIndex !== newIndex) {
        sessionRoot.childIds.splice(currentIndex, 1);
        const insertIndex = Math.min(newIndex, sessionRoot.childIds.length);
        sessionRoot.childIds.splice(insertIndex, 0, createdWindowNode.id);
    }
    
    treeTable.treetable("move", createdWindowNode.id, sessionRoot.id);
    const windowTr = $(`tr[data-tt-id='${createdWindowNode.id}']`)[0];
    const dropTrRef = $(`tr[data-tt-id='${dropNode.id}']`)[0];
    if (windowTr && dropTrRef) positionNode(windowTr, sessionRoot.id, dropTrRef);
    
    // Move dragNode into the new window
    const effectiveBrowserAction = true;  // browserAction || createdWindow
    performTreeMove(dragNode, dropNode, createdWindowNode.id, 0, effectiveBrowserAction);
    
    // Handle browser window creation
    createBrowserWindow(dragNode, createdWindowNode);
}

function createBrowserWindow(dragNode, windowNode) {
    // Create actual browser window with tabs from the session node
    // Uses background.js to move existing tabs to a new window
    
    const originalGroupId = (dragNode.sessionType === SessionNodeType.GROUP) ? dragNode.tabGroupId : 0;
    const originalGroupColor = dragNode.tgColor;
    const originalGroupCollapsed = dragNode.folded;
    
    const tabNodes = (dragNode.sessionType === SessionNodeType.GROUP)
        ? dragNode.childIds.map(id => AllNodes[id]).filter(node => node?.sessionType === SessionNodeType.TAB)
        : [dragNode];
    
    const tabIds = tabNodes.map(node => node?.tabId).filter(id => Number.isInteger(id));
    
    if (!tabIds.length) return;
    
    // Reset window/tab info - will be updated by browser events after move
    tabNodes.forEach((tabNode, idx) => {
        if (!tabNode) return;
        tabNode.windowId = 0;
        tabNode.tabIndex = idx;
        if (dragNode.sessionType !== SessionNodeType.GROUP) tabNode.tabGroupId = 0;
    });
    dragNode.windowId = 0;
    if (dragNode.sessionType !== SessionNodeType.GROUP) {
        dragNode.tabGroupId = 0;
        dragNode.setTGColor(null);
    }
    
    // Call background script to move tabs to new window
    callBackground({
        'function': 'moveTabsToNewWindow',
        'tabIds': tabIds,
        'preserveGroup': dragNode.sessionType === SessionNodeType.GROUP,
        'groupTitle': dragNode.sessionType === SessionNodeType.GROUP ? dragNode.title : null,
        'groupColor': originalGroupColor,
        'groupCollapsed': originalGroupCollapsed
    }).then(response => {
        if (!response || response.status !== 'success') {
            console.warn('moveTabsToNewWindow failed', response?.message);
            return;
        }
        
        const result = response.message || {};
        if (result.windowId) {
            windowNode.windowId = result.windowId;
            dragNode.windowId = result.windowId;
            tabNodes.forEach((tabNode, idx) => {
                if (!tabNode) return;
                tabNode.windowId = result.windowId;
                tabNode.tabIndex = idx;
            });
        }
        
        if (dragNode.sessionType === SessionNodeType.GROUP && result.tabGroupId) {
            dragNode.tabGroupId = result.tabGroupId;
            tabNodes.forEach(tabNode => { 
                if (tabNode) tabNode.tabGroupId = result.tabGroupId; 
            });
            if (originalGroupColor) dragNode.setTGColor(originalGroupColor);
        }
        
        // Browser events will trigger snapshot which updates the UI
        setTimeout(() => {
            requestBrowserSnapshot();
        }, 100);
    }).catch(err => {
        console.error('moveTabsToNewWindow error:', err);
    });
}

// ====================================
// App-to-App moves
// ====================================

function moveAppToApp(dragNode, dropNode, oldParentId, browserAction) {
    // Standard app tree movement
    const { isDropInto, newParent } = determineDropBehavior(dropNode);
    
    if (!dragNode.canMoveTo(newParent)) return;
    
    if (isDropInto) {
        // Drop into expanded topic as first child
        performTreeMove(dragNode, dropNode, dropNode.id, 0, browserAction);
    } else {
        // Drop below node as sibling
        const parentId = dropNode.parentId;
        const parent = parentId ? AllNodes[parentId] : null;
        const newIndex = calculateNewIndex(dragNode, dropNode, parent, oldParentId);
        performTreeMove(dragNode, dropNode, parentId, parent ? newIndex : -1, browserAction);
    }
}

function positionNode(dragNode, dropParentId, dropBelow) {
    // Position dragged node below the dropbelow element under the parent
    // NB treetable does not support this so we need to use this sort method
    const treeTable = $("#content");
    if (!dropParentId) {
        // Top level node. There's no parent branch to sort within - treetable("node", null) is
        // undefined and sortBranch would throw - so insert directly, as performTreeMove does.
        treeTable.treetable("insertAtTop", $(dragNode).attr('data-tt-id'),
                            $(dropBelow).attr('data-tt-id'));
        return;
    }
    const newPos = $("tr").index(dropBelow);
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

export {
    refreshTable,
    processBTFile,
    initializeNotesColumn,
    initializeUI,
    moveNode,
    positionNode,
    registerSessionSaveHandler,
    rememberFold,
    scheduleOpenStateReconcile,
};
