/*** 
 * 
 * Manages the App window UI and associated logic.
 * NB Runs in context of the BT side panel, not background BT extension or helper btContent script
 * 
 ***/

'use strict'

const OptionKey = (navigator.appVersion.indexOf("Mac")!=-1) ? "Option" : "Alt";
const tipsArray = [
    "Add ':' at the end of a topic in the popup to create a new subtopic.",
    "Double click on a table row to highlight its' open window, if any.",
    "Type ':TODO' after a topic to make the item a TODO in the BT tree.",
    "Create topics like ToRead or ToWatch to keep track of pages you want to come back to.",
    "Remember to Refresh if you've been editing the BrainTool.org file directly. (Also make sure your updates are sync'd to your GDrive.)",
    `${OptionKey}-b is the BrainTool accelerator key. You can change that in extension settings`,
    "You can save individual gmails or google docs into the BT tree.",
    "'Group', 'Stick' and 'Close' support different workflows when filing your tabs.",
    "Save LinkedIn pages under specific topics to keep track of your contacts in context.",
    "Use the TODO button on a row to toggle between TODO, DONE and none.",
    "See BrainTool.org for the BrainTool blog and other info.",
    "Check out the Bookmark import/export functions under Options!",
    "You can click on the topics shown in the BT popup instead of typing out the name.",
    "Close and re-open this controls overlay to get a new tip!",
    `Double tap ${OptionKey}-b, or double click the icon, to surface the BrainTool side panel.`,
    "When you have an Edit card open, the up/down arrows will open the next/previous card.",
    "Click on a row to select it then use keyboard commands. 'h' for a list of them.",
    "You can also store local files and folders in BrainTool. Enter something like 'file:///users/tconfrey/Documents/' in the browser address bar.",
    "Try hitting '1','2','3' etc to collapse to that level."
];

var InitialInstall = false;
var UpgradeInstall = false;
const GroupOptions = {WINDOW: 'WINDOW', TABGROUP: 'TABGROUP', NONE: 'NONE'};
var GroupingMode = GroupOptions.TABGROUP;
var GDriveConnected = false;
var Config = {};					    // general config info holder


/***
 *
 * Opening activities
 *
 ***/

async function launchApp(msg) {
    // Launch app w data passed from extension local storage
    
    ClientID = msg.client_id;
    APIKey = msg.api_key;
    FBKey = msg.fb_key;
    STRIPE_PUBLISHABLE_KEY = msg.stripe_key;
    Config = msg.Config || {};
    InitialInstall = msg.initial_install;
    UpgradeInstall = msg.upgrade_install;		    // null or value of 'previousVersion'
    BTFileText = msg.BTFileText;
    processBTFile(BTFileText);				    // create table etc

    // Get BT sub id => premium 
    // BTId in local store and from org data should be the same. local store is primary
    if (msg.bt_id) {
	BTId = msg.bt_id;
	if (!getMetaProp('BTId')) setMetaProp('BTId', BTId);
	else if (BTId != getMetaProp('BTId'))
	    alert(`Conflicting subscription id's found! This should not happen. I'm using the local value, if there are issue contact BrainTool support.\nLocal value:${BTId}\nOrg file value:${getMetaProp('BTId')}`);
    } else {
	// get from file if not in local storage and save locally (will allow for recovery if lost)
	if (getMetaProp('BTId')) {
	    BTId = getMetaProp('BTId');
	    Config.bt_id = BTId;
	    window.postMessage({'function': 'localStore', 'data': {'BTId': BTId}});
	    window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
	}
    }
    
    gtag('event', 'Launch', {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});

    // Update ui for new users
    if (InitialInstall || UpgradeInstall) {
	$("#tip").hide();
	$("#openingTips").show();
        $("#openingTips").animate({backgroundColor: '#7bb07b'}, 5000).animate({backgroundColor: 'rgba(0,0,0,0)'}, 30000);
        if (UpgradeInstall) {
            // Need to make a one time assumption that an upgrade from before 0.9 is already connected
            if (UpgradeInstall.startsWith('0.8') ||
                UpgradeInstall.startsWith('0.7') ||
                UpgradeInstall.startsWith('0.6'))
                setMetaProp('BTGDriveConnected', 'true');
            gtag('event', 'Upgrade', {'event_category': 'General', 'event_label': UpgradeInstall});
        }
        if (InitialInstall) {
            gtag('event', 'Install', {'event_category': 'General', 'event_label': InitialInstall});
        }
    } else {
        addTip();
        setTimeout(closeMenu, 3000);
    }

    // If GDrive connection was previously established, re-set it up on this startup
    if (getMetaProp('BTGDriveConnected') == 'true') {
        GDriveConnected = true;
        authorizeGapi();
        gtag('event', 'GDriveLaunch', {'event_category': 'General'});
    } else {
        gtag('event', 'NonGDriveLaunch', {'event_category': 'General'});
    }
    
    // If bookmarks have been imported remove button from controls screen (its still under options)
    if (!getMetaProp('BTLastBookmarkImport')) {
	$("#importBookmarkButton").show();
	$("#openOptionsButton").text("Other Actions");
    }

    // show Alt or Option appropriately in visible text (Mac v PC)
    $(".alt_opt").text(OptionKey);

    // If subscription exists and not expired then user is premium
    let sub = null;
    if (BTId) {
	sub = await getSub();
	if (sub) {
	    console.log('Premium subscription exists, good til:', new Date(sub.current_period_end.seconds * 1000));
	    if ((sub.current_period_end.seconds * 1000) > Date.now()) {
		// valid subscription, toggle from sub buttons to portal link
		$(".subscription_buttons").hide();
		$("#portal_row").show();
	    }
	}
    }

    // show special offer link if not subscribed and not first run
    if (!sub && !(InitialInstall || UpgradeInstall))
	$("#specialOffer").show();

    // handle currently open tabs
    handleInitialTabs(msg.all_tabs);
}

async function updateSigninStatus(signedIn, error=false, userInitiated = false) {
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
            await refreshTable(true);                       // Read previous org from GDrive
            saveBT();					    // save to record it's now synced
        }
	if (userInitiated) saveBT();			    // also save if newly authorized
    } else {
        alert("GDrive connection lost");
        $("#gdrive_save").hide();
	$("#refresh").hide();
        $("#gdrive_auth").show();
        $("#autoSaveLabel").text("Auto-saving is off");
        GDriveConnected = false;
    }
}

function addTip() {
    // add random entry from the tipsArray
    let indx = Math.floor(Math.random() * tipsArray.length);
    $("#tip").html("<b>Tip:</b> " + tipsArray[indx]);
    $("#tip").show();
}

// register for focus and check then if external file has been edited
window.onfocus = warnBTFileVersion;
async function warnBTFileVersion(e) {
    // warn in ui if there's a newer btfile on Drive
    if (!getMetaProp('BTGDriveConnected')) return; 	    // only if gdrive connected
    const warn = await checkBTFileVersion();
    if (!warn) {
	$("#stats_row").css('background-color', '#7bb07b');
	return;
    }
    const savesText = $("#num_saves").text();
    if (!savesText.includes('!')) $("#num_saves").text(savesText + '!'); 
    $("#num_saves").attr('title', 'Remote file is newer, consider refreshing'); 
    $("#saves").attr('title', 'Remote file is newer, consider refreshing');
    $("#stats_row").css('background-color', '#ffcc00');
    console.log("Newer BTFile version on GDrive, sending gtag event and warning");
    gtag('event', 'FileVersionMismatch', {'event_category': 'Error'});
}

function handleInitialTabs(tabs) {
    // array of {url, id, groupid, windId} passed from ext. mark any we care about as open
    tabs.forEach((tab) => {
	const node = BTNode.findFromURL(tab.url);
	if (!node) return;
	
        $("tr[data-tt-id='"+node.id+"']").addClass("opened");
        node.tabId = tab.id;
        node.windowId = tab.windowId;
        if (tab.groupId > 0) node.tabGroupId = tab.groupId;
        if (node.parentId && AllNodes[node.parentId]) {
            AllNodes[node.parentId].windowId = node.windowId;
            AllNodes[node.parentId].tabGroupId = node.tabGroupId;
            $("tr[data-tt-id='"+node.parentId+"']").addClass("opened");
        }
    });
}

/***
 *
 * Controls controller
 *
 ***/

function toggleMenu(event) {
    // Toggle the visibility of the welcome page
    // NB controls_screen has a min height set, need to remove during animations

    if (event && event.target == $('#search_entry')[0]) return;	// click was on search box
    
    const minHeight = $("#controls_screen").css('min-height');
    if ($("#controls_screen").is(":visible")) {
        $("#controls_screen").css('min-height',0)
	    .slideUp(400, 'easeInCirc', () => $(this).css('min-height', minHeight));
        $("#open_close_image").addClass('closed').removeClass('open');
	if (toggleMenu.introMessageShown)
	    $("#openingTips").hide();		     // if not already hidden

        // scroll-margin ensures the selection does not get hidden behind the header
        $(".treetable tr").css("scroll-margin-top", "25px");
    } else {
        toggleMenu.introMessageShown = true;         // leave tip showing and remember it showed
        addTip();                                    // display tip text after intro message shown
        $("#controls_screen").css('min-height',0)
	    .slideDown(400, 'easeInCirc', () => $(this).css('min-height', minHeight));
        $("#open_close_image").addClass('open').removeClass('closed');
        $(".treetable tr").css("scroll-margin-top", "375px");
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
    $("#num_topics").attr('title', `${numTags + numLinks} Topic Cards, (${numOpenLinks}) open tabs`);
    $("#brain").attr('title', `${numTags + numLinks} Topic Cards, (${numOpenLinks}) open tabs`);
    
    const saveTime = getDateString(modifiedTime);	    // null => current time
    $("#gdrive_save").html(`<i>Saved: ${saveTime}</i>`);
    $('#num_saves').text(':'+numSaves);
    $("#num_saves").attr('title', `${numSaves} Saves \nLast saved: ${saveTime}`);
    $("#saves").attr('title', `${numSaves} Saves \nLast saved: ${saveTime}`);

    if (GDriveConnected)                                    // set save icon to GDrive, not fileSave
    {
        $("#saves").attr("src", "resources/drive_icon.png");
	$("#stats_row").css('background-color', '#7bb07b');
    }
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

/***
 *
 * Table handling
 *
 ***/

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
    // turn the org-mode text into an html table, extract Topics
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
	// first check this is not openclose button, can't stop propagation
	if (e?.originalEvent?.target?.classList?.contains('openClose')) return;
	
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
    const dropBTNode = AllNodes[dropNodeId];
    const treeTable = $("#content");

    if (dropNodeId && dropBTNode) {
        const oldParentId = dragNode.parentId;
        moveNode(dragNode, dropBTNode, oldParentId);        
    }
    
    // Clean up
    dragNode.dragging = false;
    $(dragTarget).removeClass("dragTarget").removeClass("hovered", 750);
    $("td").removeClass("dropOver");
}

function moveNode(dragNode, dropNode, oldParentId) {
    // perform move for DnD and keyboard move - drop Drag over Drop
    
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
    
    // update tree row if oldParent is now childless
    if (oldParentId && (AllNodes[oldParentId].childIds.length == 0)) {
        const ttNode = $("#content").treetable("node", oldParentId);
        $("#content").treetable("unloadBranch", ttNode);
    }

    // update the rest of the app and backing store
    saveBT();
    BTAppNode.generateTags();        
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});        
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
    // Don't want to write file too often so wait a minute after last change for full save
    // and a second for local/fast save
    
    if (!rememberFold.fastWriteTimer)
	    rememberFold.fastWriteTimer =
	    setTimeout(() => {
	        saveBT(true);                 // passing in saveLocal=true to just remember fold locally
	        rememberFold.fastWriteTimer = null
	    }, 1000);
    
    if (!rememberFold.writeTimer)
	    rememberFold.writeTimer =
	    setTimeout(() => {
	        saveBT();
	        rememberFold.writeTimer = null
	    }, 1*60*1000);
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

    // remember tag/time for potential pre-fill in popup next time
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
    parentNode.redisplay();				     // in case changed by adding children
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
    // user switched to a new tab or win, fill in storage for popup's use and select in ui

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
    
    // Set Highlight to this node if in tree. see also similar code in keyPressHandler
    let currentSelection = $("tr.selected")[0];
    if (currentSelection) {
        const prev = $(currentSelection).attr("data-tt-id");
	AllNodes[prev].unshowForSearch();
    }
    if (!node) return;						    // nothing else to do
    if (node) {
	const tableNode = $(`tr[data-tt-id='${node.id}']`)[0];
	if(!$(tableNode).is(':visible'))
	    node.showForSearch();				    // unfold tree etc as needed
	currentSelection && $(currentSelection).removeClass('selected');
	$(tableNode).addClass('selected');
	tableNode.scrollIntoView({block: 'center'});
	$("#search_entry").val("");				    // clear search box on nav
    }	
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
    // clean page title text of things that can screw up BT. Currently []
    return text.replace("[", '').replace("]", '').replace(/[^\x20-\x7E]/g, '');
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
    parentTagNode.redisplay();				     // in case changed by adding children
    return newNode;
}


/*** 
 * 
 * Row Operations
 * buttonShow/Hide, Edit Dialog control, Open Tab/Tag(Window), Close, Delete, ToDo
 * NB same fns for key and mouse events. getActiveNode finds the correct node in either case from event
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
    const height = $(this).height();
    const rowtop = (offset.top + (height / 2) - 12);
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

    // only show outdent on non-top level items
    if (this.getAttribute("data-tt-parent-id"))
        $("#outdent").show();
    else
        $("#outdent").hide();
    
    $("#buttonRow").offset({top: rowtop});
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
    $("#otherButtons").toggle(250, 'easeInCirc', () => $(".openClose").toggle());
    e = e || window.event;
    e.preventDefault();		                        // don't propogate click
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
    const dialogHeight = $(dialog).height() || 300;	    // before initial display it's 0

    if ((top + dialogHeight + 60) < $(window).height())
        $(dialog).css("top", bottom+30);
    else
        // position above row to avoid going off bottom of screen (or the top)
        $(dialog).css("top", Math.max(10, top - dialogHeight - 20));

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
                 function () {
		     e.newTopic ? $("#topic-text").focus() : $("#text-text").focus();});
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

    if (appNode.isTag()) {
        $("table.treetable").treetable("expandNode", appNode.id);         // unfold
	AllNodes[appNode.id].folded = false;
        setTimeout(() => appNode.openAll(), 50);
    } else
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
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id');
    if (!nodeId) return null;
    const node = AllNodes[nodeId];

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
    const newnodes = AllNodes.filter(n => n && n.title.startsWith('New Topic'));
    const newName = newnodes.length ? 'New Topic'+newnodes.length : 'New Topic';
    const newNode = addNewTag(newName, node.tagPath, node);

    // and highlight it for editing
    const tr = $(`tr[data-tt-id='${newNode.id}']`);
    $("tr.selected").removeClass('selected');
    $(tr).addClass("selected");
    const clientY = tr[0].getBoundingClientRect().top + 25;
    const dummyEvent = {'clientY': clientY, 'target': tr[0], 'newTopic': true};
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
//    toggleOptions(1500);
}

function loadBookmarks(msg) {
    // handler for bookmarks_imported received when Chrome bookmarks are push to local.storage
    // nested {title: , url: , children: []}

    if (msg.result != 'success') {
        alert('Bookmark permissions denied');
        $('body').removeClass('waiting');
        return;
    }

    const dateString = getDateString().replace(':', ';');        // 12:15 => :15 is a sub topic
    const importName = "Imported Bookmarks (" + dateString + ")";
    const importNode = new BTAppNode(importName, null, "", 1);

    msg.data.bookmarks.children.forEach(node => {
        loadBookmarkNode(node, importNode);
    });
    gtag('event', 'BookmarkImport', {'event_category': 'Import'});

    // remmember this import and remove button from main control screen
    setMetaProp('BTLastBookmarkImport', dateString);
    $("#importBookmarkButton").hide();
    $("#openOptionsButton").text("Options");
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
    const dateString = getDateString().replace(':', ';');        // 12:15 => :15 is a sub topic
    window.postMessage({'function': 'localStore',
                        'data': {'AllNodes': nodeList,
                                 title: 'BrainTool Export ' + dateString}});

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
        alert("Something went wrong. The BrainTool app is not connected to its Browser Extension!");
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
 * Search support
 * 
 ***/
let ReverseSearch = false;
let SearchOriginId = 0;
function enableSearch(e) {
    // activate search mode

    // ignore if tabbed into search box from card editor
    const editing = ($($("#dialog")[0]).is(':visible'));
    if (editing) return;
    
    $("#search_entry").select();
    $("#search_buttons").show();

    // Start search from...
    let row = (ReverseSearch) ? 'last' : 'first';
    let currentSelection =  $("tr.selected")[0] || $('#content').find('tr:visible:'+row)[0];
    SearchOriginId = parseInt($(currentSelection).attr('data-tt-id'));
    
    // prevent other key actions til search is done
    $(document).unbind('keyup');
    e.preventDefault();
    e.stopPropagation();
}

function disableSearch(e = null) {
    // turn off search mode
    if (e && e.currentTarget == $("#search")[0]) return;     // don't if still in search div
    $("#search_entry").removeClass('failed');
    $("#search_entry").val('');

    // undo display of search hits
    $("span.highlight").contents().unwrap();
    $("td").removeClass('search searchLite');
    
    BTAppNode.redisplaySearchedNodes();			     // fix searchLite'd nodes
    AllNodes.forEach((n) => n.unshowForSearch());	     // fold search-opened nodes back closed
    
    // redisplay selected node to remove any scrolling, url display etc
    const selectedNodeId = $($("tr.selected")[0]).attr('data-tt-id');
    if (selectedNodeId) {
	const node = AllNodes[selectedNodeId];
	node.redisplay(true);
	node.shownForSearch = false;
        if (!node.folded) {
            $("table.treetable").treetable("collapseNode", node.id);
            $("table.treetable").treetable("expandNode", node.id);
	}
    }
    
    // turn back on other key actions, but only after this keyup, if any, is done
    setTimeout(()=>$(document).on("keyup", keyPressHandler), 500);
}

function handleSearchKeyUp(keyevent){
    // special case handling cos keypress  does not get delete key
    // and also first key when textinput still has prev content keydown gets both, need to wait till keyup
    if ((keyevent.code == 'Delete') || (keyevent.code == 'Backspace')) // || ( $("#search_entry").val().length == 1))
    {
	search({'key':'', 'startId': SearchOriginId});
    }
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
	$(document).on("keyup", keyPressHandler);
	
    return false;    
}

let SearchLiteCB = null;				      // callback to perform searchlite 
function search(keyevent) {
    // called on keypress for search_entry, could be Search or Reverse-search,
    // key is new letter pre-added or opt-s/r (search for next) or del 

    let sstr = $("#search_entry").val();
    let next = false;
    if (SearchLiteCB)					      // clear timeout if not executed
	clearTimeout(SearchLiteCB);

    // are we done?
    if (keyevent.key == 'Enter' || keyevent.key == 'Tab') {
	$("#search_buttons").hide();
	keyevent.buttonNotKey || keyevent.stopPropagation();
	keyevent.buttonNotKey || keyevent.preventDefault();   // stop keyPressHandler from getting it
	$("#search_entry").blur();			      // will call disableSearch
	return false;
    }

    // opt-s/r : drop that char code and go to next match
    if (keyevent.altKey && (keyevent.code == "KeyS" || keyevent.code == "KeyR")) {
	$("#search_entry").val(sstr);
	next = true;
	ReverseSearch = (keyevent.code == "KeyR");
	keyevent.buttonNotKey || keyevent.stopPropagation();
	keyevent.buttonNotKey || keyevent.preventDefault();   // stop opt key from displaying
    } else {
	sstr += keyevent.key;
    }
    const inc = ReverseSearch ? -1 : 1;			      // forward or reverse

    // undo effects of any previous hit
    $("span.highlight").contents().unwrap();
    $("td").removeClass('search');
    
    if (sstr.length < 1) return;                              // don't search for nothing!

    // Find where we're starting from (might be passed in from backspace key handling
    let row = (ReverseSearch) ? 'last' : 'first';
    let currentSelection =  $("tr.selected")[0] || $('#content').find('tr:visible:'+row)[0];
    let nodeId = keyevent.startId || parseInt($(currentSelection).attr('data-tt-id'));
    
    let prevNodeId = nodeId;
    if (next) {
	AllNodes[nodeId].redisplay();
	nodeId = nodeId + inc;				      // find next hit, forward/reverse
    }
    if ($("#search_entry").hasClass('failed'))
	// restart at top or bottom (reverse)
	nodeId = ReverseSearch ? AllNodes.length - 1 : 1;     

    // Do the search starting from nodeId
    let node = AllNodes[nodeId];
    while(nodeId > 0 && nodeId < AllNodes.length) {
	node = AllNodes[nodeId];
	nodeId = nodeId + inc;
	if (!node) continue;				      // AllNodes is sparse
	if (node.search(sstr)) break;
	node = null;
    }
    
    if (node) {
	if (prevNodeId != node.id)
	    AllNodes[prevNodeId].redisplay();		      // remove search formating if moving on
	$("tr.selected").removeClass('selected');
	$(node.getDisplayNode()).addClass('selected');
	node.showForSearch();				      // unfold tree etc as needed
	let highlight = $(node.getDisplayNode()).find("span.highlight")[0];
	if (highlight) highlight.scrollIntoView({'inline' : 'center'});
	node.getDisplayNode().scrollIntoView({block: 'center'});
	$("#search_entry").removeClass('failed');
	SearchLiteCB = setTimeout(() => {
	    SearchLiteCB = null;
	    $("td").removeClass('searchLite');
	    AllNodes.forEach((n) => {
		if (!n) return;
		if (n == node) return; 			      // already highlighted as selection
		n.searchLite(sstr);
	    })
	}, 200);			     
    } else {
	$("#search_entry").addClass('failed');
    }
    
    return (!next);					      // ret false to prevent entry
}

/***
 * 
 * Keyboard event handlers
 * 
 ***/
// prevent default arrow key scrolling
window.addEventListener("keydown", function(e) {
    if(["ArrowUp","ArrowDown"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
}, false);

$(document).on("keyup", keyPressHandler);
function keyPressHandler(e) {
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
    const keyCode = e.keyCode;
    const navKeys = ["KeyN", "KeyP", "ArrowUp", "ArrowDown"];
    // This one doesn't need a row selected, alt-z for undo last delete
    if (alt && code == "KeyZ") {
        undo();
    }

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
        next.scrollIntoView({block: 'nearest'});	
	$("#search_entry").val("");			      // clear search box on nav
        e.preventDefault();
	e.stopPropagation();
        return;
    }

    // s,r = Search, Reverse-search
    if (code == "KeyS" || code == "KeyR") {
	ReverseSearch = (code == "KeyR");
	enableSearch(e);
        return;
    }

    // h = help
    if (code == "KeyH") {
        toggleHelp();
        e.preventDefault();
    }

    // digit 1-9, fold all at that level, expand to make those visible
    if (keyCode > 48 && keyCode <= 57) {
        const lvl = keyCode - 48;   // level requested
        const tt = $("table.treetable");
        AllNodes.forEach(function(node) {
            if (!tt.treetable("node", node.id)) return;	      // no such node
            if (node?.level < lvl)
                tt.treetable("expandNode", node.id);
            if (node?.level == lvl)
                tt.treetable("collapseNode", node.id);
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
    
    // tab == expand or collapse
    if (code == "Tab") {
        if (node.folded)
            $("table.treetable").treetable("expandNode", nodeId);
        else
            $("table.treetable").treetable("collapseNode", nodeId);
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
    const keyString = e.key;
    if (code == "Backspace" || code == "Delete") {
        deleteRow(e);
    }

    // opt enter = new child
    if (alt && code == "Enter" && node.isTag()) {
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

    // space = open tab/window
    if (code === "Space") {
        node.showNode();
        e.preventDefault();
    }

};

function handleEditCardKeyup(e) {
    // subset of keypress handler applicible to card edit dialog, nb keyup event

    const code = e.code;
    const alt = e.altKey;
    if (code == "Tab") {
        // restrain tabbing to within dialog. Button gets focus and then this handler is called.
	// so we redirect focus iff the previous focused element was first/last
        const focused = $(":focus")[0];
        const first = $($("#topic-text")[0]).is(':visible') ? $("#topic-text")[0] : $('#title-text')[0];
	if (!focused || !$(focused).hasClass('editNode')) {
	    // tabbed out of edit dialog, force back in
	    if (!e.shiftKey)	// tabbing forward
		$(first).focus();
	    else
		$("#cancel").focus();
	}
        e.preventDefault();
        return;
    }
    if (code == "Enter") {
	// on enter move focus to text entry box
	$("#text-text").focus();
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
};

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
