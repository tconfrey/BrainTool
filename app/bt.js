/*** 
 * 
 * Manages the App window UI and associated logic.
 * NB Runs in context of the BT side panel, not the background BT extension or the helper btContent scripts 
 * 
 ***/
'use strict'

const tipsArray = [
    "Add ':' at the end of a topic in the popup to file under a new subtopic.",
    "Double click on a table row to highlight its open window, if any.",
    "Type ':TODO' after a topic to make the item a TODO in the BT tree.",
    "Create topics like ToRead to keep track of pages you want to come back to.",
    "Remember to Refresh if you've been editing the BrainTool.org file directly. (Also make sure your updates are sync'd to your GDrive.)",
    "Alt-b (aka Option-b) is the BrainTool accelerator key. You can change that in Chrome://extensions",
    "You can save individual gmails or google docs into the BT tree",
    "'Group', 'Stick' and 'Close' support different workflows when filing your tabs",
    "Save LinkedIn pages under specific topics to keep track of your contacts in context",
    "Use the TODO button on a row to toggle between TODO, DONE and none",
    "See BrainTool.org for the BrainTool blog and other info",
    "Check out the Bookmark import/export functions under Options!",
    "You can click on the topics shown in the BT popup instead of typing out the name",
    "Close and re-open this controls overlay to get a new tip!",
    "Double tap Alt(Option)-b, or double click the icon, to surface the BrainTool side panel",
    "When you have an Edit card open the up/down arrows will open the next/previous card",
    "Click on a row to select it then use keyboard commands. 'h' for a list of them",
    "You can also store local files and folders in BrainTool. Enter something like 'file:///users/tconfrey/Documents/' in the browser address bar",
    "Try hitting '1','2','3' etc to collapse to that level"
];

var InitialInstall = false;
var UpgradeInstall = false;
const GroupOptions = {WINDOW: 'WINDOW', TABGROUP: 'TABGROUP', NONE: 'NONE'};
var GroupingMode = GroupOptions.TABGROUP;
var GDriveConnected = false;

/***
 *
 * Opening activities
 *
 ***/

function launchApp(msg) {
    // Launch app w data passed from extension
    
    ClientID = msg.client_id;
    APIKey = msg.api_key;
    InitialInstall = msg.initial_install;
    UpgradeInstall = msg.upgrade_install;                   // null or value of 'previousVersion'
    BTFileText = msg.BTFileText;
    processBTFile(BTFileText);

    gtag('event', 'Launch', {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});
    
    if (InitialInstall || UpgradeInstall) {
        $("#tip").animate({backgroundColor: '#7bb07b'}, 5000).animate({backgroundColor: 'rgba(0,0,0,0)'}, 30000);
        if (UpgradeInstall) {
            // Need to make a one time assumption that an upgrade from prior to 0.9 is already connected
            if (UpgradeInstall.startsWith('0.8') ||
                UpgradeInstall.startsWith('0.7') ||
                UpgradeInstall.startsWith('0.6'))
                setMetaProp('BTGDriveConnected', 'true');
            gtag('event', 'Upgrade', {'event_category': 'General', 'event_label': UpgradeInstall});
        }
        if (InitialInstall) {
            gtag('event', 'Install', {'event_category': 'General'});
        }
    } else {
        addTip();
        setTimeout(closeMenu, 10000);
    }

    // If GDrive connection was previously established, re-set it up on this startup
    if (getMetaProp('BTGDriveConnected') == 'true') {
        GDriveConnected = true;
        authorizeGapi();
        gtag('event', 'GDriveLaunch', {'event_category': 'General'});
    } else {
        gtag('event', 'NonGDriveLaunch', {'event_category': 'General'});
    }
        
}

async function updateSigninStatus(signedIn, error=false) {
    // CallBack on GDrive signin state change
    if (error) {
        let msg = "Error Authenticating with Google. Google says:\n'";
        msg += (error.details) ? error.details : JSON.stringify(error);
        msg += "'\n1) Re-try the Authorize button. \n2) Restart. \nOr if this is a cookie issue be aware that Google uses cookies for authentication.\n";
        msg += "Go to 'chrome://settings/cookies' and make sure third-party cookies are allowed for accounts.google.com. If it continues see \nbraintool.org/support";
        alert(msg);
        return;
    }
    if (signedIn) {
        gtag('event', 'AuthComplete', {'event_category': 'GDrive'});
        $("#gdrive_auth").hide();                           // Hide button and add 'active' text
        $("#autoSaveLabel").text("Auto-saving is on");
        $("#gdrive_save").show();
        GDriveConnected = true;
        refreshRefresh();
        
        // Upgrades from before 0.9 to 0.9+ need to load from GDrive before first save, and then resave
        if (UpgradeInstall &&
            (UpgradeInstall.startsWith('0.8') ||
             UpgradeInstall.startsWith('0.7') ||
             UpgradeInstall.startsWith('0.6')))
        {
            alert("From BrainTool 0.9 onwards Google Drive is optional. \nYou already enabled GDrive permissions so I'm reestablishing the connection...");
            await refreshTable(true);                       // force read sync from GDrive
            saveBT();                                       // and force save back into storage
        }
        
    } else {
        alert("GDrive connection lost");
        $("#gdrive_save").hide();
        $("#gdrive_auth").show();
        GDriveConnected = false;
    }
}

function addTip() {
    // add random entry from the tipsArray
    let indx = Math.floor(Math.random() * tipsArray.length);
    $("#tip").html("<b>Tip:</b> " + tipsArray[indx]);
}


/***
 *
 * Controls controller
 *
 ***/

function toggleMenu() {
    // Toggle the visibility of the intro page, auth button and open/close icon
    if ($("#controls_screen").is(":visible")) {
        $("#controls_screen").slideUp(400, 'easeInCirc');
        $("#open_close_image").addClass('closed').removeClass('open');

        // scroll-margin ensures the selection does not get hidden behind the header
        $(".treetable tr").css("scroll-margin-top", "25px");
    } else {
        if (!toggleMenu.introMessageShown)
            toggleMenu.introMessageShown = true;            // leave tip showing and remember that it showed
        else
            addTip();                                       // display tip text after intro message has been shown
        $("#controls_screen").slideDown(400, 'easeInCirc');
        $("#open_close_image").addClass('open').removeClass('closed');
        $(".treetable tr").css("scroll-margin-top", "330px");
    }
}
function closeMenu() {
    // close the intro page if its visible
    if ($("#controls_screen").is(":visible"))
        toggleMenu();
}

function toggleOptions(dur = 400) {
    // Toggle visibility of option div
    if ($("#options").is(":visible")) {
        $("#options").hide({duration: dur, easing: 'easeInCirc'});
    } else {
        $("#options").show({duration: dur, easing: 'easeInCirc'});
    }
}

var ToggleMenuBackAfterHelp = false;      // keep track of if controls only opened to show help
function toggleHelp(dur = 400) {
    // Toggle visibility of help div
    if ($("#help").is(":visible")) {
        if (ToggleMenuBackAfterHelp) {
            ToggleMenuBackAfterHelp = false;
            toggleMenu();
            dur = 1500;
        }
        $("#help").hide({duration: dur, easing: 'easeInCirc'});
    } else {
        $("#help").show({duration: dur, easing: 'easeInCirc'});
        if (!$("#controls_screen").is(":visible")) {
            ToggleMenuBackAfterHelp = true;
            setTimeout(() => toggleMenu(), dur);
        }
    }
}

function updateStatsRow(modifiedTime = null) {
    // update #tags, urls, saves
    const numTags = AllNodes.filter(n => n?.isTag()).length;
    const numOpenTags = AllNodes.filter(n => n?.isTag() && n?.hasOpenChildren()).length;
    const numLinks = AllNodes.filter(n => n?.URL).length;
    const numOpenLinks = AllNodes.filter(n => n?.URL && n?.tabId).length;

    const numSaves = getMetaProp('BTVersion');
    $('#num_topics').text(numOpenTags ? `:${numTags + numLinks} (${numOpenLinks})` : `:${numTags + numLinks}`);
    $("#num_topics").attr('title', `${numTags + numLinks} Topic Cards, (${numOpenLinks}) open tab`);
    
    const saveTime = getDateString(modifiedTime);
    $("#gdrive_save").html(`<i><small>Saved: ${saveTime}</small></i>`);
    $('#num_saves').text(':'+numSaves);
    $("#num_saves").attr('title', `${numSaves} Saves \nLast saved: ${saveTime}`);

    if (GDriveConnected)                                    // set save icon to GDrive, not fileSave
        $("#saves").attr("src", "resources/drive_icon.png");
}

function brainZoom(iteration = 0) {
    // iterate thru icons to swell the brain
    const iterationArray = [0,1,2,3,4,3,2,1,0];
    const path = '../extension/images/BrainZoom'+iterationArray[iteration]+'.png';
    
    if (iteration == iterationArray.length) {
        $("#brain").attr("src", "../extension/images/BrainTool48.png");
        return;
    }
    $("#brain").attr("src", path);
    const interval = iteration == 4 ? 400 : 200;
    setTimeout(function() {brainZoom(++iteration);}, interval);
}

var ButtonRowHTML; 
var Tags = new Array();        // track tags for future tab assignment
var BTFileText = "";           // Global container for file text
var OpenedNodes = [];          // attempt to preserve opened state across refresh


async function refreshTable(fromGDrive = false) {
    // Clear current state and redraw table. Used after an import or on a manual GDrive refresh request

    // First check to make sure we're not clobbering a pending write, see fileManager.
    if (unwrittenChangesP()) {
        alert('A save is currently in process, please wait a few seconds and try again');
        return;
    }
    $("#refresh").prop("disabled", true);
    $('body').addClass('waiting');
    
    // Remember window opened state to repopulate later
    // TODO populate from node.opened
    OpenedNodes = [];
    $("tr.opened").each(function() {
        const id = $(this).attr("data-tt-id");
        OpenedNodes.push(AllNodes[id]);
    });
    BTNode.topIndex = 1;
    AllNodes = [];

    // Either get BTFileText from gDrive or use local copy. If GDrive then await its return
    if (fromGDrive)
        await getBTFile();
    processBTFile(BTFileText);
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


var RefreshCB = null;           // callback on refresh completion (used by bookmark import)
function processBTFile(fileText) {
    // turn the org-mode text into an html table, extract category tags
    BTFileText = fileText;      // store for future editing

    // First clean up from any previous state
    BTNode.topIndex = 1;
    AllNodes = [];
    
    parseBTFile(fileText);

    var table = generateTable();
    /*  for some reason w big files jquery was creating <table><table>content so using pure js
    var container = $("#content");
    container.html(table);
    */
    var container = document.querySelector('#content');
    container.innerHTML = table;

    $(container).treetable({ expandable: true, initialState: 'expanded', indent: 10, animationTime: 250,
                    onNodeCollapse: nodeCollapse, onNodeExpand: nodeExpand}, true);

    BTAppNode.generateTags();

    // Let extension know about model
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags}});
    window.postMessage({'function': 'localStore', 'data': {'BTFileText': BTFileText}});
    
    // initialize ui from any pre-refresh opened state
    OpenedNodes.forEach(oldNode => {
        const node = BTNode.findFromTitle(oldNode.title);
        if (!node) return;
        $("tr[data-tt-id='"+node.id+"']").addClass("opened");
        node.tabId = oldNode.tabId;
        node.windowId = oldNode.windowId;
        node.tabGroupId = oldNode.tabGroupId;
        if (node.parentId && AllNodes[node.parentId]) {
            AllNodes[node.parentId].windowId = node.windowId;
            AllNodes[node.parentId].tabGroupId = node.tabGroupId;
        }
    });
    
    initializeUI();
    // Give events from init time to process
    setTimeout(function () {
        AllNodes.forEach(function(node) {
            if (node?.folded)
                $(container).treetable("collapseNodeImmediate", node.id);
        });
    }, 200);

    updatePrefs();
    if (GDriveConnected) refreshRefresh();
    $('body').removeClass('waiting');
    if (RefreshCB) RefreshCB();                      // may be a callback registered
}

function refreshRefresh() {
    // set refresh button back on
    console.log('Refreshing Refresh');
    $("#refresh").show();
    $("#refresh").prop("disabled", false);
    $('body').removeClass('waiting');
}
    

function initializeUI() {
    //DRY'ing up common event stuff needed whenever the tree is modified
    console.log('Initializing UI');
    
    $("table.treetable tr").off('mouseenter');            // remove any previous handlers
    $("table.treetable tr").off('mouseleave');
    $("table.treetable tr").on('mouseenter', null, buttonShow);
    $("table.treetable tr").on('mouseleave', null, buttonHide);  
    $(".elipse").hover(function() {                       // show hover text on summarized nodes
        var thisNodeId = $(this).closest("tr").attr('data-tt-id');
        var htxt = AllNodes[thisNodeId].text;
        $(this).attr('title', htxt);
    });
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
        $("tr.selected").removeClass('selected');
        $(this).addClass("selected");
    });
    
    // make rows draggable    
    $("table.treetable tr").draggable({
        helper: function() {
            buttonHide();
	    
            const clone = $(this).clone();
	    $(clone).find('.btTitle').html('');		   // empty clone of contents, for some reason
	    $(clone).find('.btText').html('');		   // ..seems to screw up the mouse cursor
	    
            $("table.treetable tr").off('mouseenter');     // turn off hover behavior during drag
            $("table.treetable tr").off('mouseleave');
            return clone;
        },     
        start: dragStart,       // call fn below on start
        handle: "#move",        // use the #move button as handle
        axis: "y",
        scrollSpeed: 10,
        containment: "#content",
        cursor: "move",
        opacity: .50,
        stop: function( event, ui ) {
            // turn hover bahavior back on
            $("table.treetable tr").on('mouseenter', null, buttonShow);
            $("table.treetable tr").on('mouseleave', null, buttonHide);
            $("tr").removeClass("hovered");
            $("tr").removeClass("dropOver");
        },
        revert: "invalid"       // revert when drag ends but not over droppable
    });

    // make rows droppable
    $("tr").droppable({
        drop: function(event, ui) {
            dropNode(event, ui);
        },
        over: function(event, ui) {
            // highlight node a drop would drop into and underline the potential position
            $(this).children('td').first().addClass("dropOver");
        },
        out: function(event, ui) {
            // undo the above
            $(this).children('td').first().removeClass("dropOver");
        }
    });
    
    // Hide loading notice and show refresh button
    $("#loading").hide();
    if (GDriveConnected) $("#refresh").show();

    // Copy buttonRow's html for potential later recreation (see below)
    if ($("#buttonRow")[0])
        ButtonRowHTML = $("#buttonRow")[0].outerHTML;

    updateStatsRow();                                      // show updated stats
}

function reCreateButtonRow() {
    // For some unknown reason very occasionally the buttonRow div gets lost/deleted
    console.log("RECREATING BUTTONROW!!");
    const $ButtonRowHTML = $(ButtonRowHTML);
    $ButtonRowHTML.appendTo($("#dialog"))
}

function dragStart(event, ui) {
    // Called when drag operation is initiated. Set dragged row to be full sized
    const w = $(this).css('width');
    const h = $(this).css('height');
    ui.helper.css('width', w).css('height', h);

    $(this).addClass("dragTarget");

    // collapse open subtree if any
    const nodeId = $(this).attr('data-tt-id');
    const node = AllNodes[nodeId];
    node.dragging = true;
    if (node.childIds.length && !node.folded) {
        $("#content").treetable("collapseNode", nodeId);
    }
}

function dropNode(event, ui) {
    // Drop node w class=dragTarget below node w class=dropOver
    // NB if dropOver is expanded target becomes first child, if collapsed next sibling
    
    const dragTarget = $(".dragTarget")[0];
    const dragNodeId = $(dragTarget).attr('data-tt-id');
    const dragNode = AllNodes[dragNodeId];
    const dropNode = $($(".dropOver")[0]).parent();
    const dropNodeId = $(dropNode).attr('data-tt-id');
    const treeTable = $("#content");

    if (dropNodeId) {

        const dropBTNode = AllNodes[dropNodeId];
        const oldParentId = dragNode.parentId;
        moveNode(dragNode, dropBTNode);
        
        saveBT();
        BTAppNode.generateTags();        
        window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
        
        // update tree row if oldParent is now childless
        if (oldParentId && (AllNodes[oldParentId].childIds.length == 0)) {
            const ttNode = $("#content").treetable("node", oldParentId);
            $("#content").treetable("unloadBranch", ttNode);
        }
    }
    
    // Clean up
    dragNode.dragging = false;
    $(dragTarget).removeClass("dragTarget").removeClass("hovered", 750);
    $("td").removeClass("dropOver");
}

function moveNode(dragNode, dropNode) {
    // perform move for DnD - drop Drag over Drop
    
    const treeTable = $("#content");
    if (dropNode.isTag() && !dropNode.folded) {
        // drop into dropNode as first child
        dragNode.reparentNode(dropNode.id, 0);
        treeTable.treetable("move", dragNode.id, dropNode.id);
    } else {
        // drop below dropNode w same parent
        const parentId = dropNode.parentId;
        const parent = parentId ? AllNodes[parentId] : null;
        dragNode.reparentNode(parentId,
                              parent ?
                              parent.childIds.indexOf(parseInt(dropNode.id)) + 1 :
                              -1);
        if (parentId) {
            const dragTr = $(`tr[data-tt-id='${dragNode.id}']`)[0];
            const dropTr = $(`tr[data-tt-id='${dropNode.id}']`)[0];
            treeTable.treetable("move", dragNode.id, parentId);
            positionNode(dragTr, parentId, dropTr);          // sort into position
        } else {
            treeTable.treetable("insertAtTop", dragNode.id, dropNode.id);
        }
    }
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
    // Don't want to write file too often so wait 2 minutes after last change
    if (rememberFold.writeTimer) {
        clearTimeout(rememberFold.writeTimer);
        rememberFold.writeTimer = null;
    }
    rememberFold.writeTimer = setTimeout(saveBT, 2*60*1000);
}

function nodeExpand() {
    let update = AllNodes[this.id].folded;
    AllNodes[this.id].folded = false;

    // set highlighting based on open child links
    if (!AllNodes[this.id].hasOpenChildren())
        $(this.row).removeClass('opened');

    // Update File 
    if (update) rememberFold();
}
function nodeCollapse() {
    const node = AllNodes[this.id];
    const update = !node.folded;
    node.folded = true;

    // if any highlighted descendants highlight node on collapse
    if (node.hasOpenDescendants())
        $(this.row).addClass('opened');
    
    // Update File, if collapse is not a result of a drag start
    if (update && !node.dragging) rememberFold();
}
   

function handleLinkClick(e) {
    const nodeId = $(this).closest("tr").attr('data-tt-id');
    AllNodes[nodeId].openTab();
    e.preventDefault();
}



/***
 * 
 * Handle relayed messages from Content script. Notifications that background has done
 * something on our behalf.
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

    node.tabId = tabId;         
    node.windowId = windowId;
    AllNodes[parentId].windowId = windowId;
    if (tabGroupId) {
        AllNodes[parentId].tabGroupId = tabGroupId;
        node.tabGroupId = tabGroupId;
    }

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
    if (GroupingMode != GroupOptions.WINDOW) return;
    const expectedIndex = node.indexInParent();
    if (tabIndex != expectedIndex)
        AllNodes[parentId].repositionTabs();
}

function tabClosed(data) {
    // handle tab closed message, also used by tabUpdated when BT tab is navigated away

    function propogateClosed(parentId) {
        // node not open and recurse to parent
        if (!parentId || AllNodes[parentId].hasOpenDescendants())
            return;                          // terminate recursion
        AllNodes[parentId].windowId = 0;
        AllNodes[parentId].tabGroupId = 0;
        let parentElt = $("tr[data-tt-id='"+parentId+"']");
        parentElt.removeClass("opened");
        parentElt.addClass("hovered",
                           {duration: 1000,
                            complete: function() {
                                parentElt.removeClass("hovered", 1000);
                            }});
        // propogate up tree to dehighlight ancestors as appropriate
        propogateClosed(AllNodes[parentId].parentId);
    };

    const tabId = data.tabId;
    const node = BTAppNode.findFromTab(tabId);
    if (!node) return;
    node.tabId = 0;
    node.tabGroupId = 0;
    node.windowId = 0;
    tabActivated(data);

    // update ui and animate parent to indicate change
    $("tr[data-tt-id='"+node.id+"']").removeClass("opened", 1000);
    propogateClosed(node.parentId);
    updateStatsRow();
}

function storeTabs(data) {
    // put tab(s) under storage w given tag. tabsData is a list, could be one or all tabs in window
    // NB tagString may be tag, parent:tag, tag:keyword, parent:tag:keyword
    // where tag may be new, new under parent, or existing but under parent to disambiguate
    const tagString = data.tag;
    const note = data.note;
    const windowId = data.windowId;
    const tabAction = data.tabAction;

    // process tag and add new if doesn't exist    
    const [tag, parentTag, keyword, tagPath] = BTNode.processTagString(tagString);
    const parentNode = BTNode.findFromTagPath(tagPath) || addNewTag(tag, parentTag);
    const ttParent = $("table.treetable").treetable("node", parentNode.id);
    const tabsData = data.tabsData.reverse();
    let newNodes = [];

    // remember tag/time for potential pre-fill next time
    window.postMessage({'function': 'localStore', 'data': {'mruTopic': tagPath, 'mruTime': new Date().toJSON()}});

    tabsData.forEach(tabData => {
        // create each new node and add to tree
        const url = tabData.url;
        const title = cleanTitle(tabData.title);
        const tabId = tabData.tabId;
        if (BTAppNode.findFromTab(tabId)) return;            // ignore tabs we already have assigned
        const newNode = new BTAppNode(`[[${url}][${title}]]`, parentNode.id,
                                      note || "", parentNode.level + 1);
        newNodes.push(newNode);
        if (keyword) newNode.keyword = keyword;
        newNode.tabId = tabId;
        $("table.treetable").treetable("loadBranch", ttParent, newNode.HTML());
    });

    // sort tree based on position in parents child array
    const compare = (a,b) => (a<b) ? -1 : (b<a) ? 1 : 0;
    const childIds = parentNode.childIds;
    $("table.treetable").treetable(
        "sortBranch", ttParent, (a, b) => (compare(childIds.indexOf(a.id), childIds.indexOf(b.id))));
    
    initializeUI();
    saveBT();

    // Execute tab action (close, stick, group)
    if (tabAction == 'CLOSE') {
        newNodes.forEach(node => node.closeTab());
        return;
    }
    newNodes.forEach(node => setNodeOpen(node));            // if not closing then show as open
    if (GroupingMode == 'WINDOW') {
        // w window grouping either move to existing assigned window or just remember this one
        if (parentNode.windowId || newNodes.length == 1) {
            newNodes.forEach(node => node.group());
            newNodes[0].showNode();
        }
        else
            parentNode.windowId = windowId;
        return;
    }
    
    if (GroupingMode == 'TABGROUP')
        if (parentNode.tabGroupId) {
            if (tabAction == 'GROUP' || (windowId == parentNode.windowId))
                // even if 'stick' should group when in same window, confusing otherwise.
                newNodes.forEach(node => node.group());
            newNodes[0].showNode();
        }
        else {
            // Tell bg to create a new TG for Topic
            const tabIds = newNodes.map(node => node.tabId);
            const nodeIds = newNodes.map(node => node.id);
            window.postMessage(
                {'function': 'moveToTabGroup', 'tabIds': tabIds,
                 'nodeIds': nodeIds, 'windowId': windowId});
        }
}

function tabUpdated(data) {
    // tab updated event, could be nav away or to a BT node

    const tabId = data.tabId;
    const tabUrl = data.tabURL;
    const groupId = data.groupId;
    const windowId = data.windowId;
        
    const tabNode = BTAppNode.findFromTab(tabId);
    if (tabNode) {
        // Either completion of opening of BT tab *or* nav away of an open BT tab
        if (!BTNode.compareURLs(tabNode.URL, tabUrl)) {
            // if the url on load complete != initial => redirect, so we shoudl follow
            if (tabNode.opening) {
                // tab gets created (see tabOpened) then a status complete event gets us here
                console.log(`redirect from ${tabNode.URL} to ${tabUrl}`);
                tabNode.URL = tabUrl;
            }
            else {
                // nav away from BT tab
                data['nodeId'] = tabNode.id;
                tabClosed(data);
                window.postMessage({'function' : 'ungroup', 'tabId' : tabId});
            }
        }
        tabNode.opening = false;
        return;
    }

    const urlNode = BTAppNode.findFromURLTGWin(tabUrl, groupId, windowId);
    if (urlNode) {
        // nav into a bt node from an open tab
        data['nodeId'] = urlNode.id;
        tabOpened(data, true);
        // acknowledge nav to BT node with brain animation
        window.postMessage({'function' : 'brainZoom', 'tabId' : tabId});
        urlNode.group();                        // handle mooving tab to its group/window
        return;
    }

    // Otherwise just a new tab. Take out of BT TG if its in one owned by BT
    const tgParent = BTAppNode.findFromGroup(data.groupId);
    if (tgParent)
        window.postMessage({'function' : 'ungroup', 'tabId' : tabId});
}

function tabActivated(data) {
    // user switched to a new tab or win, fill in storage for popup's use

    const tabId = data['tabId'];
    const winId = data['windowId'];
    const groupId = data['groupId'];
    const node = BTAppNode.findFromTab(tabId);
    const winNode = BTAppNode.findFromWindow(winId);
    const groupNode = BTAppNode.findFromGroup(groupId);
    let m1, m2 = {'windowTopic': winNode ? winNode.tagPath : '',
                   'groupTopic': groupNode ? groupNode.tagPath : '', 'currentTabId' : tabId};
    if (node) 
        m1 = {'currentTag': node.tagPath, 'currentText': node.text};
    else
        m1 = {'currentTag': '', 'currentText': ''};
    window.postMessage({'function': 'localStore', 'data': {...m1, ...m2}});
    // TODO highlight this node in tree
}


function tabsWindowed(data) {
    // due to grouping change tabids are now in a window w windowId
    const windowId = data.windowId;
    const tabIds = data.tabIds;
    tabIds.forEach(tid => {
        const node = BTAppNode.findFromTab(tid);
        if (node) node.windowId = windowId;
        if (node?.parentId)
            AllNodes[node.parentId].windowId = windowId;
    });
}

function tabsGrouped(data) {
    // due to grouping change tabids are now in a group w groupId
    const tgId = data.tgId;
    const tabIds = data.tabIds;
    tabIds.forEach(tid => {
        const node = BTAppNode.findFromTab(tid);
        if (node) node.tabGroupId = tgId;
        if (node?.parentId)
            AllNodes[node.parentId].tabGroupId = tgId;
    });
}

// Utility functions for the above

function cleanTitle(text) {
    // NOTE: Regex is from https://stackoverflow.com/a/11598864
    const clean_non_printable_chars_re = /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g;
    // clean page title text of things that can screw up BT. Currently []
    return text.replace("[", '').replace("]", '').replace(clean_non_printable_chars_re, '');
}

function setNodeOpen(node) {
    // utility - set node and parent to open, propagate upwards as needed above any collapsed nodes

    function propogateOpened(parentId) {
        // recursively pass upwards adding opened class if appropriate
        if (!parentId) return;               // terminate recursion
        if ($("tr[data-tt-id='"+parentId+"']").hasClass("collapsed"))
            $("tr[data-tt-id='"+parentId+"']").addClass("opened");
        propogateOpened(AllNodes[parentId].parentId);
    };

    const parentId = node.parentId;
    $("tr[data-tt-id='"+node.id+"']").addClass("opened");
    $("tr[data-tt-id='"+parentId+"']").addClass("opened");
    propogateOpened(parentId);
}

function addNewTag(tag, parentTag = null, parentNode = null) {
    // New tag - create node and add to tree, parentNode might be known (if local creation)

    // 1) Handle case where parentTag is passed in but doesn't yet exist (ie top:bottom)
    let parentTagNode = parentNode || parentTag ? BTNode.findFromTagPath(parentTag) : null;
    if (parentTag && !parentTagNode) {
        parentTagNode = new BTAppNode(parentTag, null, "", 1);
        $("table.treetable").treetable("loadBranch", null, parentTagNode.HTML());
    }

    // 2) Create new tag and update extension
    const parentTagLevel = parentTagNode ? parentTagNode.level : 0;
    const parentTagId = parentTagNode ? parentTagNode.id : null;
    const newNode = new BTAppNode(tag, parentTagId, "", parentTagLevel+1); // name, parent, note, lvl
    BTAppNode.generateTags();
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});

    // 3) Update tree
    const n = $("table.treetable").treetable("node", parentTagId);
    $("table.treetable").treetable("loadBranch", n || null, newNode.HTML());
    return newNode;
}


/*** 
 * 
 * Row Operations
 * buttonShow/Hide, Edit Dialog control, Open Tab/Tag(Window), Close, Delete, ToDo
 * 
 ***/

function buttonShow() {
    // Show buttons to perform row operations, triggered on hover
    $(this).addClass("hovered");
    const td = $(this).find(".right")

    if ($("#buttonRow").index() < 0) {
        // Can't figure out how but sometimes after a Drag/drop the element is deleted
        reCreateButtonRow();
    }
    
    $("#buttonRow").detach().appendTo($(td));
    const offset = $(this).offset();
    $("#buttonRow").offset({top: offset.top});
    if ($(this).hasClass("opened")){
        $("#expand").hide();
        $("#collapse").show();
    }
    else {
        if ($(this).find('a').length)
            $("#expand").show();
        $("#collapse").hide();
    }
    // show expand/collapse if some kids of branch are not open/closed
    if ($(this).hasClass("branch")) {
        const id = this.getAttribute("data-tt-id");
        const notOpenKids = $("tr[data-tt-parent-id='"+id+"']").not(".opened");
        if (notOpenKids?.length)
            $("#expand").show();
        const openKids = $("tr[data-tt-parent-id='"+id+"']").hasClass("opened");
        if (openKids)
            $("#collapse").show();
    }
    // allow adding children on branches or unpopulated branches (ie no links)
    if ($(this).hasClass("branch") || !$(this).find('a').length)
        $("#addChild").show();
    else
        $("#addChild").hide();
    $("#buttonRow").show();        
}

function buttonHide() {
    // hide button to perform row operations, triggered on exit    
    $(this).removeClass("hovered");
    $("#buttonRow").hide();
    $("#buttonRow").detach().appendTo($("#dialog"));
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

    if ((top + $(dialog).height() + 60) < $(window).height())
        $(dialog).css("top", bottom+30);
    else
        // position above row to avoid going off bottom of screen
        $(dialog).css("top", top - $(dialog).height() - 20);

    // populate dialog
    const dn = node.fullTagPath();
    if (dn == node.displayTag)
        $("#dn").hide();    
    else {
        $("#dn").show();
        const upto = dn.lastIndexOf(':');
        let displayStr = dn.substr(0, upto);
        const maxLen = 50;
        if (displayStr.length > maxLen) displayStr = "..." + displayStr.substring(displayStr.length - maxLen);
        $("#distinguishedName").text(displayStr);
    }
    if (node.isTag()) {
        $("#title-url").hide();
        $("#title-text").hide();
        $("#topic").show();
        $("#topic-text").val(node.displayTag);
    } else {
        $("#title-url").show();
        $("#title-text").show();
        $("#title-text").val(node.displayTag);
        $("#topic").hide();
        $("#title-url").val(node.URL);
    }
    $("#text-text").val(node.text);
    $("#update").prop("disabled", true);

    // overlay grays everything out, dialog animates open on top.
    // NB setting margin-left auto needed to expand from center, but -left 8px looks better when expanded
    $("#content").addClass('editOverlaid');
    $("#editOverlay").css("display", "block");
    const width = $(dialog).width();
    const height = width / 1.618;                           // golden!
    $("#text-text").height(height - 140);                   // notes field fits but as big as possible
    $(dialog).css({display: 'block', opacity: 0.0, height: 0, width:0})
        .animate({width: width, height: height, opacity: 1.0, 'margin-left': 10}, duration, 'easeInCirc',
                 function () {$("#text-text").focus();});
}

$(".editNode").on('input', function() {
    // enable update button if one of the texts is edited
    $("#update").prop('disabled', false);
});

$("#editOverlay").click(function(e) {
    // click on the backdrop closes the dialog
    if (e.target.id == 'editOverlay')
    {
        closeDialog();
        $("#buttonRow").show(100);
    }
});

function closeDialog(cb = null, duration = 250) {
    // animate dialog close and potentially callback when done
    const dialog = $("#dialog")[0];
    const height = $(dialog).height();
    const width = $(dialog).width();
    $(dialog).css({'margin-left':'auto'});                  // see above, resetting to collapse back to center
    $(dialog).animate({width: 0, height: 0}, duration, function () {
        $("#editOverlay").css("display", "none");
        $(dialog).css({width: '88%', height: height});      // reset for next open
        dialog.close();
        if (cb) cb();
    });
    $("#content").removeClass('editOverlaid');
}
    

function getSelectedNode() {
    // Return the node currently highlighted or selected
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id');
    if (!nodeId) return null;
    return AllNodes[nodeId];
}

function getActiveNode(e) {
    // Return the active node for the event, either hovered (button click) or selected (keyboard)
    const tr = (e.type === 'click') ? $("tr.hovered")[0] : $("tr.selected")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id') || 0;
    return AllNodes[nodeId];
}
    

function openRow(e) {
    // Open all links under this row in windows per tag

    // First find all AppNodes involved - selected plus children
    const appNode = getActiveNode(e);
    if (!appNode) return;

    // Warn if opening lots of stuff
    const numTabs = appNode.countOpenableTabs();
    if (GroupingMode == GroupOptions.WINDOW) {
        const numWins = appNode.countOpenableWindows();
        if ((numWins > 2) || (numTabs > 10))
            if (!confirm(`Open ${numWins} windows and ${numTabs} tabs?`))
                return;
    } else
        if (numTabs > 10)
            if (!confirm(`Open ${numTabs} tabs?`))
                return;

    if (appNode.isTag())
        appNode.openAll();
    else
        appNode.openTab();
}

function closeRow(e) {
    // close this node's tab or window
    const appNode = getActiveNode(e);  
    if (!appNode) return;
    appNode.closeTab();
}

function escapeRegExp(string) {
    // stolen from https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function deleteRow(e) {
    // Delete selected node/row.
    buttonHide();
    const appNode = getActiveNode(e);
    if (!appNode) return false;
    const kids = appNode.childIds.length && appNode.isTag();         // Tag determines non link kids

    // If children nodes ask for confirmation
    if (!kids || confirm('Delete whole subtree?')) {
        $("table.treetable").treetable("removeNode", appNode.id);    // Remove from UI and treetable
        deleteNode(appNode.id);
    }   
}

function deleteNode(id) {
    //delete node and clean up
    id = parseInt(id);                 // could be string value
    const node = AllNodes[id];
    if (!node) return;
    const wasTag = node.isTag();
    
    // Highlight this node if it's open.
    // (good user experience and side effect is to update the tabs badge info
    if (node.tabId)
        node.showNode();         
    BTNode.deleteNode(id);             // delete from model. NB handles recusion to children
    
    // Update parent display
    const parent = AllNodes[node.parentId];
    if (parent) {
        const openKids = $("tr[data-tt-parent-id='"+parent.id+"']").hasClass("opened");
        if (!openKids)
            $("tr[data-tt-id='"+parent.id+"']").removeClass("opened");
        // update tree row if now is childless
        if (parent.childIds.length == 0) {
            const ttNode = $("#content").treetable("node", parent.id);
            $("#content").treetable("unloadBranch", ttNode);
        }
    }
    
    // if wasTag remove from Tags and update extension
    if (wasTag) {
        BTAppNode.generateTags();
        window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
    }
    
    // Update File 
    saveBT();
}


function updateRow() {
    // Update this node/row after edit.
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    const node = getSelectedNode();
    if (!node) return;

    // Update Model
    const url = $("#title-url").val();
    const title = $("#title-text").val();
    const topic = $("#topic-text").val();
    if (node.isTag())
        node.title = topic;
    else
        node.title = `[[${url}][${title}]]`;
    node.text = $("#text-text").val();

    // Update ui
    $(tr).find("span.btTitle").html(node.displayTitle());
    $(tr).find("span.btText").html(node.displayText());

    // Update File 
    saveBT();

    // Update extension
    BTAppNode.generateTags();    
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
    console.count('BT-OUT:tags_updated');

    // reset ui
    closeDialog();
    $("tr.selected").removeClass('selected');
    initializeUI();
}

function toDo(e) {
    // iterate todo state of selected node/row (TODO -> DONE -> '').
    const appNode = getActiveNode(e);
    if (!appNode) return false;

    appNode.iterateKeyword()                // ask node to update

    // Update ui and file
    const tr = $(`tr[data-tt-id='${appNode.id}']`);
    $(tr).find("span.btTitle").html(appNode.displayTitle());
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
    node.reparentNode(newParentId);
    $("table.treetable").treetable("promote", node.id);

    // save to file, update Tags etc
    saveBT();
    BTAppNode.generateTags();
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
}

function addChild(e) {
    // add new child to this node

    // create child element
    const node = getActiveNode(e);
    if (!node) return;
    const newnodes = AllNodes.filter(n => n && n.title.startsWith('New Tag'));
    const newName = newnodes.length ? 'New Tag'+newnodes.length : 'New Tag';
    const newNode = addNewTag(newName, node.tagPath, node);

    // and highlight it for editing
    const tr = $(`tr[data-tt-id='${newNode.id}']`);
    $("tr.selected").removeClass('selected');
    $(tr).addClass("selected");
    const clientY = tr[0].getBoundingClientRect().top + 25;
    const dummyEvent = {'clientY': clientY, 'target': tr[0]};
    editRow(dummyEvent);

    // Stop the event from selecting the row and line up a save
    e.stopPropagation();
    initializeUI();
    saveBT();
}


/***
 * 
 * Option Processing
 * Imports of Bookmarks, org file, tabsOutliner json. Grouping option updates
 * 
 ***/

function processImport(nodeName) {
    // an import (bkmark, org, tabsOutliner) has happened => save and refresh

    RefreshCB = function() {animateNewImport(nodeName);};
    saveBT();
    refreshTable();
}

function importBookmarks() {
    // Send msg to result in subsequent loadBookmarks, set waiting status and close options pane
    $('body').addClass('waiting');
    window.postMessage({'function': 'getBookmarks'});
    toggleOptions(1500);
}

function loadBookmarks(msg) {
    // handler for bookmarks_imported received when Chrome bookmarks are push to local.storage
    // nested {title: , url: , children: []}

    if (msg.result != 'success') {
        alert('Bookmark permissions denied');
        $('body').removeClass('waiting');
        return;
    }

    const importName = "Imported Bookmarks (" + getDateString() + ")";
    const importNode = new BTAppNode(importName, null, "", 1);

    msg.data.bookmarks.children.forEach(node => {
        loadBookmarkNode(node, importNode);
    });
    gtag('event', 'BookmarkImport', {'event_category': 'Import'});

    processImport(importName);                             // see above
}

function loadBookmarkNode(node, parent) {
    // load a new node from bookmark export format as child of parent BTNode and recurse on children

    if (node?.url?.startsWith('javascript:')) return; // can't handle JS bookmarklets
    
    const title = node.url ? `[[${node.url}][${node.title}]]` : node.title;
    const btNode = new BTAppNode(title, parent.id, "", parent.level + 1);
    if (btNode.level > 3)                 // keep things tidy
        btNode.folded = true;

    // handle link children, reverse cos new links go on top
    node.children.reverse().forEach(node => {
        if (node.childen) return;
        if (node?.url?.startsWith('javascript:')) return; // can't handle JS bookmarklets
        const title = node.url ? `[[${node.url}][${node.title}]]` : node.title;
        new BTAppNode(title, btNode.id, "", btNode.level + 1);
    });
    
    // recurse on non-link nodes, nb above reverse was destructive, reverse again to preserve order
    node.children.reverse().forEach(node => {
        if (!node.children) return;
        loadBookmarkNode(node, btNode);
    });
}

function animateNewImport(name) {
    // Helper for bookmark import, draw attention
    const node = BTNode.findFromTitle(name);
    if (!node) return;
    const element = $(`tr[data-tt-id='${node.id}']`)[0];
    $('html, body').animate({
        scrollTop: $(element).offset().top
    }, 750);
    $(element).addClass("attention",
                        {duration: 2000,
                         complete: function() {
                             $(element).removeClass("attention", 2000);
                         }});
    RefreshCB = null;
}
    

function exportBookmarks() {
    // generate minimal AllNodes for background to operate on
    const nodeList = AllNodes.map(n => {
        if (!n) return null;
        return {'displayTag': n.displayTag, 'URL': n.URL, 'parentId': n.parentId, 'childIds': n.childIds.slice()};
    });
    window.postMessage({'function': 'localStore',
                        'data': {'AllNodes': nodeList,
                                 title: 'BrainTool Export ' + getDateString()}});

    // wait briefly to allow local storage too be written before background tries to access
    setTimeout(() => window.postMessage({'function': 'exportBookmarks'}), 100);
    gtag('event', 'BookmarkExport', {'event_category': 'Export'});
}


function updatePrefs() {
    // update prefrences based on data read into AllNodes.metaProperties

    const groupMode = getMetaProp('BTGroupingMode');
    const $radio = $('input:radio[name=grouping]');
    if (groupMode) {
        $radio.filter(`[value=${groupMode}]`).prop('checked', true);
        GroupingMode = groupMode;
        window.postMessage({'function': 'localStore', 'data': {'GroupingMode': GroupingMode}});
	}		       
}

// Register listener for grouping mode change
$(document).ready(function () {
    if (typeof WaitingForKeys !== 'undefined') {
        // Defined in btContentScript so undefined => some issue
        alert("Something went wrong. The BrainTool app is not connected to its Chrome Extension!");
    }
    $(':radio').click(function () {
        const oldVal = GroupingMode;
        const newVal = $(this).val();
        GroupingMode = GroupOptions[newVal];
        setMetaProp('BTGroupingMode', GroupingMode);
        // Let extension know
        window.postMessage({'function': 'localStore', 'data': {'GroupingMode': GroupingMode}});

        saveBT();
        groupingUpdate(oldVal, newVal);
    });
});

function groupingUpdate(from, to) {
    // grouping has been changed, potentially update open tabs (WINDOW->NONE is ignored)
    console.log(`Changing grouping options from ${from} to ${to}`);
    if (from == 'TABGROUP' && to == 'NONE')
        BTAppNode.ungroupAll();
    if ((from == 'NONE' || from == 'WINDOW') && to == 'TABGROUP')
        BTAppNode.groupAll();
    if ((from == 'NONE' || from == 'TABGROUP') && to == 'WINDOW') {
        const numPotentialWins = AllNodes.filter(n => n.isTag() && n.windowId).length;
        if (numPotentialWins && confirm(`Also sort existing tabs into ${numPotentialWins} new windows?`))
            BTAppNode.windowAll();
    }
}



/***
 * 
 * Keyboard event handlers
 * 
 ***/

$(document).keydown(function(e) {

    const key = e.which;
    const alt = e.altKey;
    // This one doesn't need a row selected, alt-z for undo last delete
    if (alt && key === 90) {
        undo();
    }
    
    // ignore keys (except nav up/down) if edit dialog is open
    const editing = ($($("#dialog")[0]).is(':visible'));
    if (editing) {
        handleEditCardKeydown(e);
        return;
    }
    const navKeys = [78, 80, 38, 40];

    // n or down arrow, p or up arrow for up/down (w/o alt)
    let next, currentSelection = $("tr.selected")[0];
    if (!alt && navKeys.includes(key)) {
        if (currentSelection)
            next = (key == 78 || key == 40) ?
            $(currentSelection).nextAll(":visible").first()[0] :          // down
            $(currentSelection).prevAll(":visible").first()[0];           // up
        else
            // no selection => nav in from top or bottom
            next = (key == 78 || key == 40) ?
            $('#content').find('tr:visible:first')[0] :
            $('#content').find('tr:visible:last')[0];
        
        if (!next) return;
        if (currentSelection) $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
        next.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        return;
    }
    
    // h = help
    if (key === 72) {
        toggleHelp();
        e.preventDefault();
    }

    // digit 1-9, fold all at that level, expand to make those visible
    if (key > 48 && key <= 57) {
        const lvl = key - 48;   // level requested
        const tt = $("table.treetable");
        AllNodes.forEach(function(node) {
            if (!tt.treetable("node", node.id)) return;               // no such node
            if (node?.level < lvl)
                tt.treetable("expandNode", node.id);
            if (node?.level == lvl)
                tt.treetable("collapseNode", node.id);
        });
    }

    if (!currentSelection) return;
    const nodeId = $(currentSelection).attr('data-tt-id');
    const node = AllNodes[nodeId];
    if (!node) return;

    // up(38) and down(40) arrows move
    if (alt && (key === 38 || key === 40)) {
        if (node.childIds.length && !node.folded) {
            $("#content").treetable("collapseNode", nodeId);
        }
        // its already below prev so we drop below prev.prev when moving up
        const dropTr = (key === 38) ?
              $(currentSelection).prevAll(":visible").first().prevAll(":visible").first() :
              $(currentSelection).nextAll(":visible").first();
        const dropId = $(dropTr).attr('data-tt-id');
        moveNode(node, AllNodes[dropId]);
        e.preventDefault();
        return;
    }

    // enter == open or close.
    if (!alt && key === 13) {
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
    
    // tab == expand or collapse
    if (key === 9) {
        if (node.folded)
            $("table.treetable").treetable("expandNode", nodeId);
        else
            $("table.treetable").treetable("collapseNode", nodeId);
        e.preventDefault();
        return;
    }

    // t = cycle TODO state
    if (key === 84) {
        toDo(e);
    }

    // e = edit
    if (key === 69) {
        editRow(e);
        e.preventDefault();
    }

    // delete || backspace = delete
    const keyString = e.key;
    if (keyString === "Backspace" || keyString === "Delete") {
        deleteRow(e);
    }

    // opt enter = new child
    if (alt && key === 13 && node.isTag()) {
        addChild(e);
    }

    // opt <- = promote
    if (alt && key === 37) {
        promote(e);
    }

    // <- collapse open node, then nav up tree
    if (key === 37) {
        if (node.childIds.length && !node.folded) {
            $("table.treetable").treetable("collapseNode", nodeId);
            return;
        }
        if (!node.parentId) return;
        next = $(`tr[data-tt-id=${node.parentId}]`)[0];
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
    }

    // -> open node, then nav down tree
    if (key === 39) {
        if (node.folded) {
            $("table.treetable").treetable("expandNode", nodeId);
            return;
        }
        next = $(currentSelection).nextAll(":visible").first()[0];
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
    }

    // space = open tab/window
    if (key === 32) {
        node.showNode();
        e.preventDefault();
    }

});

function handleEditCardKeydown(e) {
    // subset of keydown handler applicible to card edit dialog

    const key = e.which;
    const alt = e.altKey;
    if (key == 9) {
        // restrain tabbing to within dialog
        const focused = $(":focus")[0];
        const last = $("#cancel")[0];
        const first = $($("#topic-text")[0]).is(':visible') ? $("#topic-text")[0] : $('#title-text')[0];
        if (focused == last && !e.shiftKey) {
            $(first).focus();
            e.preventDefault();
        }
        if (focused == first && e.shiftKey) {
            $(last).focus();
            e.preventDefault();
        }
        return;
    }
    if (alt && [38,40].includes(key)) {
        // alt up/down iterates rows opening cards
        const currentSelection = $("tr.selected")[0];
        const next = (key == 40) ?
              $(currentSelection).nextAll(":visible").first()[0] :          // down
              $(currentSelection).prevAll(":visible").first()[0];           // up        
        if (!next) return;
        $(currentSelection).removeClass('selected');
        $(next).addClass('selected');
        next.scrollIntoView({block: 'nearest'});
        e.preventDefault();
        closeDialog(function () {editRow({type: 'internal', duration: 100});}, 100);        
    }
}

function undo() {
    // undo last delete
    const node = BTNode.undoDelete();
    const parent = AllNodes[node.parentId];
    function updateTree(ttn, btn) {
        // recurse as needed on tree update
        $("table.treetable").treetable("loadBranch", ttn || null, btn.HTML());
        if (btn.childIds.length) {
            const n = $("table.treetable").treetable("node", btn.id);
            btn.childIds.forEach(
                (id) => updateTree(n, AllNodes[id]));
        }
    }

    // Update tree
    let n = parent ? $("table.treetable").treetable("node", parent.id) : null;
    updateTree(n, node);
    $($(`tr[data-tt-id='${node.id}']`)[0]).addClass('selected');

    initializeUI();
    saveBT();
    BTAppNode.generateTags();        
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});

}
