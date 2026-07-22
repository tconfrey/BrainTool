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
 * Row Operations
 * buttonShow/Hide, Edit Dialog control, Open Tab/Topic, Close, Delete, ToDo
 * NB same fns for key and mouse events. 
 * getActiveNode finds the correct node in either case from event
 * 
 ***/

'use strict';

// Import dependencies
import { AllNodes, BTNode } from './BTNode.js';
import { BTAppNode } from './BTAppNode.js';
import { SessionNodeType } from './BTSessionNode.js';
import { getProp, setProp, incrementStat } from './configManager.js';
import { callBackground } from './extensionMessaging.js';
import { saveBT } from './fileManager.js';
import { exportBookmarksBar } from './bookmarksManager.js';
import { initializeUI, scheduleOpenStateReconcile } from './tableManager.js';
import { hideSessionTree } from './sessionManager.js';

function getAllowedActions(node) {
    if (!node || typeof node.allowedRowActions !== 'function') return {};
    return node.allowedRowActions() || {};
}

function isActionAllowed(actions, action) {
    return (actions[action] === undefined) ? true : actions[action] !== false;
}

function buttonShow(e) {
    // Show buttons to perform row operations, triggered on hover
    $(this).addClass("hovered");

    // undo mouse out style that was maybe set on sidePanelMouseOut
    if (window.mouseOutStyle) {
        document.head.removeChild(window.mouseOutStyle);
        window.mouseOutStyle = null;
    }

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
    const tooltips = getProp('BTTooltips') == 'ON';
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
    const actions = getAllowedActions(node);
    if (node.isTrash())
        $('#deleteRow').parent().attr('data-wenk', 'Empty Trash');
    else
        $('#deleteRow').parent().attr('data-wenk', 'Delete item (del)');

    // The session root shows only the delete tool (CSS hides the rest); delete closes the view.
    // NB coerce to a real boolean: node.isSessionNode is undefined (not false) on app nodes, and
    // jQuery toggleClass toggles rather than removes when the 2nd arg isn't a strict boolean.
    const isSessionRoot = !!(node.isSessionNode && node.sessionType === SessionNodeType.ROOT);
    $("#buttonRow").toggleClass('sessionRootOnly', isSessionRoot);
    if (isSessionRoot) $('#deleteRow').parent().attr('data-wenk', 'Close session view');

    // Check if this is an unsaved session node (ROOT, WINDOW, or non-topic not in tree)
    const isUnsaved = node.isSessionNode && (
        (node.sessionType === SessionNodeType.ROOT) ||
        (node.sessionType === SessionNodeType.WINDOW) ||
        (!node.isTopic() && !node.isRepresentedInTopicTree())
    );

    $('#deleteRow').parent().toggle(isActionAllowed(actions, 'delete'));
    $('#star').parent().toggle(isActionAllowed(actions, 'todo'));
    $('#move').parent().toggle(isActionAllowed(actions, 'drag')).toggle(!node.isTrash());
    $('#editRow').parent().toggle(isActionAllowed(actions, 'edit')).toggle(!node.isTrash()).toggle(!isUnsaved);
    $('#tools').parent().toggle(!node.isTrash()).toggle(!isUnsaved);

    // Open/close buttons 
    const topic = node.isTopic() ? node : AllNodes[node.parentId];
    $("#openTab").hide();
    $("#openWindow").hide();
    $("#closeRow").hide();
    const canOpen = isActionAllowed(actions, 'open');
    if (canOpen && node.countOpenableTabs()){
        $("#openTab").show();
        if (isActionAllowed(actions, 'openInNewWindow') && (!topic?.hasOpenChildren() || ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP'))) $("#openWindow").show();       // only allow opening in new window if not already in a TG, or not using TGs
    }
    if (isActionAllowed(actions, 'close') && node.countClosableTabs()) {
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
    if (isActionAllowed(actions, 'addChild') && (($(this).hasClass("branch") || !$(this).find('a').length) && !node.isTrash()))
        $("#addChild").show();
    else
        $("#addChild").hide();

    // only show outdent on non-top level items. don't show it on links (!isTopic) where promoting would put to top level
    if (isActionAllowed(actions, 'promote') && (this.getAttribute("data-tt-parent-id")) && !((node.level == 2) && !node.isTopic()))
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

function toggleMoreButtons(e) {
    // show/hide non essential buttons
    $("#otherButtons").toggle(100, 'easeInCirc', () => {
        $("#tools").toggleClass('moreToolsOn');
        let moreToolsOn = $("#tools").hasClass('moreToolsOn');
        let hint = moreToolsOn ? "Fewer Tools" : "More Tools";
        $("#moreToolsSpan").attr('data-wenk', hint);
        setProp('BTMoreToolsOn', moreToolsOn ? 'ON' : 'OFF');
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
    const actions = getAllowedActions(node);
    if (!isActionAllowed(actions, 'edit')) return;
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
    const actions = getAllowedActions(appNode);
    if (!isActionAllowed(actions, 'open')) return;
    if (newWin && !isActionAllowed(actions, 'openInNewWindow')) return;

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
    const actions = getAllowedActions(appNode);
    if (!isActionAllowed(actions, 'close')) return;
    
    $("#openWindow").show();
    $("#openTab").show();
    $("#closeRow").hide();
    appNode.closeTab();
    
    gtag('event', 'close_row', {'event_category': 'TabOperation'});
    incrementStat('BTNumTabOperations');
}

function deleteRow(e) {
    // Delete selected node/row.
    const appNode = getActiveNode(e);
    if (!appNode) return false;
    const actions = getAllowedActions(appNode);
    if (!isActionAllowed(actions, 'delete')) return false;
    const kids = appNode.childIds.length && appNode.isTopic();         // Topic determines non link kids
    buttonHide();

    // Session root delete = close the live session view (non-destructive, re-openable via settings)
    if (appNode.isSessionNode && appNode.sessionType === SessionNodeType.ROOT) {
        deleteNode(appNode.id);
        return;
    }

    // Special handling for Trash node
    if (appNode.isTrash()) {
        // Create a copy of the childIds array before iterating
        const childIdsToDelete = [...appNode.childIds];
        childIdsToDelete.forEach((id) => {
            deleteNode(id);
        });
        // Hide trash row
        $(`tr[data-tt-id='${appNode.id}']`).hide();
        return;
    }

    // If children nodes ask for confirmation
    if (!kids || confirm('Delete whole subtree?')) {
        // Remove from UI and treetable
        deleteNode(appNode.id);
    }
}

let LastTrashMove = null;              // {nodeId, parentId, index} of the last move-to-Trash, for undo
function deleteNode(id, browserAction = false) {
    // delete node and clean up
    // firstDelete moves the item into Trash, subsequent deletes it
    // if delete was a result of browserAction, eg tabLeftTG, don't screw with tgs etc
    id = parseInt(id);                 // could be string value
    const node = AllNodes[id];
    if (!node) return;

    // Session root: close the whole session view rather than trashing (session nodes don't trash)
    if (node.isSessionNode && node.sessionType === SessionNodeType.ROOT) {
        hideSessionTree();
        buttonHide();
        return;
    }
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
        const BTHome = getProp('BTManagerHome');
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
        LastTrashMove = {'nodeId': id, 'parentId': node.parentId,
                         'index': AllNodes[node.parentId]?.childIds.indexOf(id) ?? -1};
        propogateClosed(node.parentId);                     // Update parent display
        const treeTable = $("#content");
        const trashNode = BTAppNode.findOrCreateTrashNode();
        $(`tr[data-tt-id='${trashNode.id}']`).show();
        node.handleNodeMove(trashNode.id);
        treeTable.treetable("move", node.id, trashNode.id);
        const treeNode = $(`tr[data-tt-id='${node.id}']`)[0];
        $(treeNode).attr('data-tt-parent-id', trashNode.id);
        $(treeNode).addClass('trashed');
        node.trash();
        initializeUI();
    } else {
        // Delete from trash
        LastTrashMove = null;                                // undo now means resurrect, not un-trash
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
    }
    
    // Update File
    saveBT();
}

function undoTrashMove() {
    // Model-level reverse of the most recent move-to-Trash, if any. Returns the restored
    // node or null. Display rebuild and file save are handled by the caller (undo() in bt.js).
    if (!LastTrashMove) return null;
    const {nodeId, parentId, index} = LastTrashMove;
    LastTrashMove = null;                                   // single level of undo
    const node = AllNodes[nodeId];
    if (!node || !node.trashed) return null;                // already emptied or moved out
    if (parentId && (!AllNodes[parentId] || AllNodes[parentId].trashed)) return null;
    node.untrash();
    node.handleNodeMove(parentId, index);
    return node;
}

function updateRow() {
    // Update this node/row after edit.
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id');
    if (!nodeId) return null;
    const node = AllNodes[nodeId];
    const actions = getAllowedActions(node);
    if (!isActionAllowed(actions, 'edit')) return null;

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
    
    const newText = $("#textText").val();
    node.text = newText;
    
    // Sync text to sister nodes (app/session nodes with matching tabId/tabGroupId)
    const sisterNodes = node.sisterNodes();
    sisterNodes.forEach(sisterNode => {
        // For tab nodes, verify URL matches before syncing
        if (!node.isTopic() && !BTNode.compareURLs(sisterNode.URL, node.URL)) {
            return;
        }
        sisterNode.text = newText;
        const sisterDisplayNode = sisterNode.getDisplayNode();
        if (sisterDisplayNode) {
            $(sisterDisplayNode).find('span.btText').html(sisterNode.displayText());
        }
    });

    // Update ui
    $(tr).find("span.btTitle").html(node.displayTitle());
    $(tr).find("span.btText").html(node.displayText());
    if (node.tgColor) node.setTGColor(node.tgColor);
    node.populateFavicon();                     // async, will just do its thing

    // Update File 
    saveBT();

    // Update extension
    BTAppNode.generateTopics();
    node.bookmarkId && exportBookmarksBar(); // update bookmarks bar if needed

    // reset ui
    closeDialog();
    initializeUI();
}

function updateToDoUI(node) {
    // Update UI for a node after todo state change
    const tr = $(`tr[data-tt-id='${node.id}']`);
    $(tr).find("span.btTitle").html(node.displayTitle());
    if (node.tgColor) node.setTGColor(node.tgColor);
    node.populateFavicon();                     // async, will just do its thing
}

function toDo(e) {
    // iterate todo state of selected node/row (TODO -> DONE -> '').
    const appNode = getActiveNode(e);
    if (!appNode) return false;
    const actions = getAllowedActions(appNode);
    if (!isActionAllowed(actions, 'todo')) return false;

    appNode.iterateKeyword();                // ask node to update internals
    
    // Update ui for this node
    updateToDoUI(appNode);
    
    // Update ui for any sister nodes (e.g., corresponding session node)
    const sisterNodes = appNode.sisterNodes();
    sisterNodes.forEach(sisterNode => {
        sisterNode.iterateKeyword();         // keep sister node in sync
        updateToDoUI(sisterNode);
    });
    
    // Stop the event from selecting the row and line up a save
    e.stopPropagation();
    initializeUI();
    saveBT();
}

function promote(e) {
    // move node up a level in tree hierarchy
    
    const node = getActiveNode(e);
    if (!node || !node.parentId) return;                  // can't promote
    const actions = getAllowedActions(node);
    if (!isActionAllowed(actions, 'promote')) return;
    
    // Do the move, but not if it would strand a leaf at the top level
    const newParentId = AllNodes[node.parentId].parentId;
    if (!node.canMoveTo(newParentId ? AllNodes[newParentId] : null)) return;

    // collapse open subtree if any
    if (node.childIds.length)
        $("#content").treetable("collapseNode", node.id);

    node.handleNodeMove(newParentId);
    $("table.treetable").treetable("promote", node.id);

    // save to file, update Topics etc
    saveBT();
    BTAppNode.generateTopics();
    scheduleOpenStateReconcile();            // repaint stale .opened blue state (bug 6829)
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
    if (Window.BrainTool && Window.BrainTool.resizing) return;  // ignore during column resize
    const newNode = new BTAppNode('', null, "", 1);
    _displayForEdit(newNode);
}

function addChild(e) {
    // add new child to selected node

    // create child element
    const node = getActiveNode(e);
    if (!node) return;
    const actions = getAllowedActions(node);
    if (!isActionAllowed(actions, 'addChild')) return;
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

let ButtonRowHTML = '';      // store button row html for re-creation if needed, set in initializeButtonRow below
function reCreateButtonRow() {
    // For some unknown reason very occasionally the buttonRow div gets lost/deleted
    console.log("RECREATING BUTTONROW!!");
    const $ButtonRowHTML = $(ButtonRowHTML);
    $ButtonRowHTML.appendTo($("#dialog"));
    attachButtonRowListeners();
}


/**
* Generate the Button Row HTML (without inline event handlers)
*/
function generateButtonRowHTML() {
    const html = `
    <div id="buttonRow" style="display: none;">
        <span id="otherButtons" style="display: none;">
            <span data-wenk="Delete item (del)" class="wenk--left">
                <img id="deleteRow" src="resources/delete.svg" class="rowButton">
            </span>
            <span data-wenk="ToDo (t)" class="wenk--left">
                <img id="star" src="resources/star.svg" class="rowButton">
            </span>
            <span data-wenk="Drag to move (m-&uarr;&darr;)" class="wenk--left">
                <img id="move" src="resources/drag.svg" class="rowButton"
                     style="cursor: move;">
            </span>
            <span data-wenk="Promote up hierarchy" class="wenk--left">
                <img id="outdent" src="resources/outdent.svg" class="rowButton">
            </span>
            <span data-wenk="Add child topic (m-enter)" class="wenk--left">
                <img id="addChild" src="resources/addSubtopic.svg" class="rowButton">
            </span>
            <span data-wenk="Edit item (e)" class="wenk--left">
                <img id="editRow" src="resources/edit.svg" class="rowButton">
            </span>
            <span data-wenk="Open in new window (w)" class="wenk--left">
                <img id="openWindow" src="resources/openWindow.svg" class="rowButton">
            </span>
        </span>
        <span id="basebuttons">      
            <span data-wenk="Open/show in browser (space)" class="wenk--left">  
                <img id="openTab" alt="Open"
                     src="resources/openTab.svg" class="rowButton openClose">
            </span>
            
            <span data-wenk="Close in browser (enter)" class="wenk--left">
                <img id="closeRow" alt="Close" class="rowButton openClose" 
                     src="resources/closeItem.svg" height="28" width="26" >
            </span>
            
            <span data-wenk="More tools" class="wenk--left" id="moreToolsSpan">
                <img id="tools" src="resources/toolsOpen.svg" class="rowButton"
                     height="28" width="26">
            </span>
        </span>
        
    </div>
    `;
    
    // Insert after #help panel using insertAdjacentHTML
    const helpPanel = document.getElementById('help');
    if (helpPanel) {
        helpPanel.insertAdjacentHTML('afterend', html);
    } else {
        // Fallback: insert at end of body
        document.body.insertAdjacentHTML('beforeend', html);
    }
}

/**
* Attach event listeners to Button Row elements
*/
function attachButtonRowListeners() {
    // Delete button
    document.getElementById('deleteRow')?.addEventListener('click', (e) => {
        deleteRow(e);
    });
    
    // ToDo button
    document.getElementById('star')?.addEventListener('click', (e) => {
        toDo(e);
    });
    
    // Promote button
    document.getElementById('outdent')?.addEventListener('click', (e) => {
        promote(e);
    });
    
    // Add child button
    document.getElementById('addChild')?.addEventListener('click', (e) => {
        addChild(e);
    });
    
    // Edit button
    document.getElementById('editRow')?.addEventListener('click', (e) => {
        editRow(e);
    });
    
    // Open in new window button
    document.getElementById('openWindow')?.addEventListener('click', (e) => {
        openRow(e, true);
    });
    
    // Open tab button
    document.getElementById('openTab')?.addEventListener('click', (e) => {
        openRow(e);
    });
    
    // Close button
    document.getElementById('closeRow')?.addEventListener('click', (e) => {
        closeRow(e);
    });
    
    // Tools/More buttons toggle
    document.getElementById('tools')?.addEventListener('click', (e) => {
        toggleMoreButtons(e);
    });
}

/**
* Initialize Button Row by generating HTML and attaching event listeners
*/
function initializeButtonRow() {
    generateButtonRowHTML();
    attachButtonRowListeners();

    // Copy buttonRow's html for potential later recreation (see below)
    if ($("#buttonRow")[0])
        ButtonRowHTML = $("#buttonRow")[0].outerHTML;

    console.log('Button row initialized with event listeners');
}

// Export public API
export { 
    buttonShow, 
    buttonHide, 
    editRow, 
    closeDialog, 
    openRow, 
    closeRow, 
    deleteRow,
    deleteNode,
    undoTrashMove,
    updateRow,
    toDo, 
    promote,
    addNewTopLevelTopic,
    addChild, 
    cancelEdit,
    initializeButtonRow,
    toggleMoreButtons
};