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
import { parseBTFile } from './parser.js';
import { sendMessage } from './extensionMessaging.js';
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
        $("td.left").css("width", percent + "%");
        $("td.right").css("width", (100 - percent) + "%");
    } else {
        $("#content").addClass('hideNotes').removeClass('showNotes');
    }

    // Initialize the draggable resizer
    initializeResizer();
    
    // Finally, align the resizer knob with the rendered left column width
    updateResizerPositionFromColumns();
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
function updateResizerPositionFromColumns() {
    // Align #resizer to the actual width of the left column (same approach as in draggable stop)
    const leftCell = $("#content td.left:visible")[0];       // NB need a visible cell
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
            Resizing = true;
            handleResizer();
        },
        stop: () => setTimeout(() => {
            const left = $("#resizer").position().left + 13;
            const fullWidth = $(window).width();
            const percent = parseInt(left / fullWidth * 100);
            setProp('BTNotes', percent);      // save the new width, BTNotes = NOTES, NONOTES or % width
            handleResizer();
            Resizing = false;
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
    $(document).click(function(event) {
        if (event.target.nodeName === 'HTML') {
            closeConfigDisplays();                // clicking background also closes any open panel
        }
    });
    
    makeRowsDraggable();                                        // abstracted out below

    // Hide loading notice and show sync/refresh buttons as appropriate
    $("#loading").hide();
    updateSyncSettings(syncEnabled());

    updateStatsRow(getProp('BTTimestamp'));   // show updated stats w last save time
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

export { 
    refreshTable, 
    processBTFile, 
    initializeNotesColumn, 
    initializeUI, 
    moveNode, 
    Resizing 
};
