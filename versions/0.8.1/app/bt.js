/*** 
 * 
 * Manages the App window UI and associated logic.
 * NB Runs in context of BT window, not the background BT extension or the helper btContent scripts 
 * 
 ***/

const authorizeButton = document.getElementById('authorize_button');

const tipsArray = [
    "Add ':' at the end of a tag to create a new subtag.",
    "Double click on a table row to highlight its open window, if any.",
    "Type ':TODO' after a tag to make the item a TODO in the BT tree.",
    "Create tags like ToRead to keep track of pages you want to come back to.",
    "Remember to Refresh if you've been editing the BrainTool.org file directly. (Also make sure your updates are sync'd to your GDrive.)",
    "Alt-b (aka Option-b) is the BrainTool accelerator key. You can change that in Chrome://extensions",
    "You can tag individual gmails or google docs into the BT tree",
    "'Group', 'Stick' and 'Close' support different workflows when filing your tabs",
    "Tag LinkedIn pages into projects to keep track of your contacts",
    "Use the TODO button on a row to toggle between TODO, DONE and ''",
    "See BrainTool.org for the BrainTool blog and other info",
    "Check out the Bookmark import/export functions under Options!",
    "You can click on the tags shown in the BT popup instead of typing out the name",
    "Double tap Alt(Option)-b to surface the BrainTool side panel"
];

var FirstUse = true;
var InitialLoad = true;         // track whether app is loading BT file for first time
const GroupOptions = {WINDOW: 'WINDOW', TABGROUP: 'TABGROUP', NONE: 'NONE'};
var GroupingMode = GroupOptions.WINDOW;

function updateSigninStatus(isSignedIn, error=false) {
    // CallBack on GDrive signin state change
    if (error) {
        let msg = "Error Authenticating with Google. Google says:<br/><i>'";
        msg += (error.details) ? error.details : JSON.stringify(error);
        msg += "'</i><br/>If this is a cookie issue be aware that Google uses cookies for authentication.";
        msg += "<br/>Go to 'chrome://settings/content/cookies' and make sure third-party cookies are allowed for accounts.google.com. Then retry. If it continues see \nbraintool.org/support";
        $("#loadingMessage").html(msg);
        closeMenu();
        return;
    }
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        $("#options_button").show();
        $("#authDiv").addClass("notImportant");
        if (FirstUse) {
            $("#intro_text").slideUp(750);
            $("#tip").animate({backgroundColor: '#7bb07b'}, 3000).animate({backgroundColor: 'rgba(0,0,0,0)'}, 3000);
            setTimeout(closeMenu, 30000);
        } else {
            addTip();
            setTimeout(closeMenu, 10000);
        }
        findOrCreateBTFile();
    } else {
        $("#controls_screen").show();
        $("#intro_text").slideDown(750);
        $("#loading").hide();
        $("#options_button").hide();
        $("#options").hide();
        $("#authDiv").addClass("important");
        authorizeButton.style.display = 'block';
    }
}

function addTip() {
    // add random entry from the tipsArray
    let indx = Math.floor(Math.random() * tipsArray.length);
    $("#tip").html("<b>Tip:</b> " + tipsArray[indx]);
}

function toggleMenu() {
    // Toggle the visibility of the intro page, auth button and open/close icon
    if ($("#controls_screen").is(":visible")) {
        $("#controls_screen").slideUp(750);
        $("#close").show();
        $("#open").hide();

        // scroll-margin ensures the selection does not get hidden behind the header
        $(".treetable tr").css("scroll-margin-top", "25px");
    } else {
        if (FirstUse)
            FirstUse = false;
        else
            addTip();               // display tip text on subsequent views
        $("#controls_screen").slideDown(750);
        $("#close").hide();
        $("#open").show();
        $(".treetable tr").css("scroll-margin-top", "330px");
    }
}
function closeMenu() {
    // close the intro page if its visible
    if ($("#controls_screen").is(":visible"))
        toggleMenu();
}

function toggleOptions(dur = 500) {
    // Toggle visibility of option div
    if ($("#options").is(":visible")) {
        $("#options").hide({duration: dur, easing: 'swing'});
    } else {
        $("#options").show({duration: dur, easing: 'swing'});
    }
}

var ToggleMenuBackAfterHelp = false;      // keep track of if controls only opened to show help
function toggleHelp(dur = 500) {
    // Toggle visibility of help div
    if ($("#help").is(":visible")) {
        if (ToggleMenuBackAfterHelp) {
            ToggleMenuBackAfterHelp = false;
            toggleMenu();
            dur = 1500;
        }
        $("#help").hide({duration: dur, easing: 'swing'});
    } else {
        $("#help").show({duration: dur, easing: 'swing'});
        if (!$("#controls_screen").is(":visible")) {
            ToggleMenuBackAfterHelp = true;
            setTimeout(() => toggleMenu(), dur);
        }
    }
}

function updateStatsRow() {
    // update #tags, urls, saves

    const numTags = AllNodes.filter(n => n && n.isTag()).length;
    const numOpenTags = AllNodes.filter(n => n && n.isTag() && n.hasOpenChildren()).length;
    const numLinks = AllNodes.filter(n => n && n.URL).length;
    const numOpenLinks = AllNodes.filter(n => n && n.URL && n.tabId).length;
    const numSaves = getMetaProp('BTVersion');
    $('#num_tags').text(numOpenTags ? `:${numTags} (${numOpenTags})` : `:${numTags}`);
    $('#num_links').text(numOpenLinks ? `:${numLinks} (${numOpenLinks})` : `${numLinks}`);
    $('#num_saves').text(':'+numSaves);
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


function refreshTable() {
    // refresh from file, first clear current state

    // First check to make sure we're not clobbering a pending write, see gdriveManager.
    if (UnwrittenChanges) {
        alert('A save is currently in process, please wait a few seconds and try again');
        return;
    }
    $("#refresh").prop("disabled", true);
    $("#refresh").text('...');
    $('body').addClass('waiting');
    
    BTFileText = "";
    BTNode.topIndex = 1;

    // Remember window opened state to repopulate later
    // TODO populate from node.opened
    OpenedNodes = [];
    $("tr.opened").each(function() {
        const id = $(this).attr("data-tt-id");
        OpenedNodes.push(AllNodes[id]);
    });
    AllNodes = [];
    
    getBTFile();
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
    if (InitialLoad) {
        toggleMenu();
        InitialLoad = false;
    }
    
    BTFileText = fileText;      // store for future editing

    // First clean up from any previous state
    BTNode.topIndex = 1;
    AllNodes = [];
    
    parseBTFile(fileText);

    var table = generateTable(); 
    var tab = $("#content");
    tab.html(table);
    tab.treetable({ expandable: true, initialState: 'expanded', indent: 10,
                    onNodeCollapse: nodeCollapse, onNodeExpand: nodeExpand}, true);

    BTAppNode.generateTags();

    // Let extension know about model
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags}});
    
    // initialize ui from any pre-refresh opened state
    OpenedNodes.forEach(oldNode => {
        const node = BTNode.findFromTitle(oldNode.title);
        if (!node) return;
        $("tr[data-tt-id='"+node.id+"']").addClass("opened");
        node.tabId = oldNode.tabId;
        node.windowId = oldNode.windowId;
        node.tabgroupId = oldNode.tabgroupId;
        if (node.parentId && AllNodes[node.parentId]) {
            AllNodes[node.parentId].windowId = node.windowId;
            AllNodes[node.parentId].tabgroupId = node.tabgroupdId;
        }
    });

    // set collapsed state as per org data
    AllNodes.forEach(function(node) {
        if (node && node.folded && node.hasWebLinks) // NB no weblinks => not displayed in tree
            tab.treetable("collapseNode", node.id);
    });

    initializeUI();
    updatePrefs();
    refreshRefresh();
    if (RefreshCB) RefreshCB();                      // may be a callback registered
}

function refreshRefresh() {
    // set refresh button back on
    console.log('Refreshing Refresh');
    $("#refresh").prop("disabled", false); // activate refresh button
    $("#refresh").text("Refresh");
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
    $("tr").draggable({
        helper: function() {
            buttonHide();
            const clone = $(this).clone();
            $(clone).addClass("dragClone");                // green highlight is confusing
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
        opacity: .20,
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
    $("#refresh").show();

    // Copy buttonRow's html for potential later recreation (see below)
    if ($("#buttonRow")[0])
        ButtonRowHTML = $("#buttonRow")[0].outerHTML;

    updateStatsRow();                            // show updated stats
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
        
        writeBTFile();
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
    const db = dropBelow[0];
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
                                if (bb == db)
                                    return 1;
                                return (compare (newPos, $("tr").index(bb)));
                            }
                            if (bb == dragNode) {
                                if (aa == db)
                                    return -1;
                                return (compare ($("tr").index(aa), newPos));
                            }
                            return (compare ($("tr").index(aa), $("tr").index(bb)));
                        });
}
    

// Handle callbacks on node folding, update backing store
function nodeExpand() {
    console.log('Expanding ', this.id);
    let update = AllNodes[this.id].folded;
    AllNodes[this.id].folded = false;

    // set highlighting based on open child links
    if (!AllNodes[this.id].hasOpenChildren())
        $(this.row).removeClass('opened');

    // Update File 
    if (update) writeBTFile();
}
function nodeCollapse() {
    console.log('Collapsing ', this.id);
    const node = AllNodes[this.id];
    const update = !node.folded;
    node.folded = true;

    // if any highlighted descendants highlight node on collapse
    if (node.hasOpenDescendants())
        $(this.row).addClass('opened');
    
    // Update File, if collapse is not a result of a drag start
    if (update && !node.dragging) writeBTFile();
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


function cleanTitle(text) {
    // clean page title text of things that can screw up BT. Currently []
    return text.replace("[", '').replace("]", '').replace(/[^\x20-\x7E]/g, '');
}

function openNode(node) {
    // set node and parent to open, propagate upwards as needed above any collapsed nodes

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

function tabOpened(data, highlight = false) {
    // handle tab open message
    
    const nodeId = data.nodeId;
    const node = AllNodes[nodeId];
    const tabId = data.tabId;
    const tabGroupId = data.tabGroupId;
    const tabIndex = data.tabIndex;
    const windowId = data.windowId;
    const parentId = AllNodes[nodeId].parentId || nodeId;
    const indexInParent = node.indexInParent();

    node.tabId = tabId;         
    node.windowId = windowId;
    AllNodes[parentId].windowId = windowId;
    if (tabGroupId) {
        AllNodes[parentId].tabGroupId = tabGroupId;
        node.tabGroupId = tabGroupId;
    }

    openNode(node);    
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
    const expectedIndex = AllNodes[nodeId].indexInParent();
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
        if (parentElt.hasClass('collapsed'))
            // propogate up to a node which will be seen
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
    // put tab(s) under storage w given tag. tabsData is a list, could be on or all tabs in window
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
    writeBTFile();

    // Execute tab action (close, stick, group)
    if (tabAction == 'CLOSE') {
        newNodes.forEach(node => node.closeTab());
        return;
    }
    newNodes.forEach(node => openNode(node));            // if not closing then show as open
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
            if (tabAction == 'GROUP')
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
    const newNode = new BTAppNode(tag, parentTagId, "", parentTagLevel+1);
    BTAppNode.generateTags();
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});

    // 3) Update tree
    const n = $("table.treetable").treetable("node", parentTagId);
    $("table.treetable").treetable("loadBranch", n || null, newNode.HTML());
    return newNode;
}

function tabUpdated(data) {
    // tab updated event, could be nav away or to a BT node

    const tabId = data.tabId;
    const tabUrl = data.tabURL;
    const groupId = data.groupId;
        
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

    const urlNode = BTAppNode.findFromURL(tabUrl);
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
        if (node && node.parentId)
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
        if (node && node.parentId)
            AllNodes[node.parentId].tabGroupId = tgId;
    });
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
        if (notOpenKids && notOpenKids.length)
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
    const node = activeNode(e);
    if (!node) return;
    const row = $(`tr[data-tt-id='${node.id}']`)[0];
    const top = $(row).position().top - $(document).scrollTop();
    const dialog = $("#dialog")[0];

    if ((top + $(dialog).height() + 50) < $(window).height())
        $(dialog).css("top", top+50);
    else
        // position above row to avoid going off bottom of screen
        $(dialog).css("top", top - $(dialog).height() - 20);

    // populate dialog
    $("#tag-path").text(node.fullTagPath());
    $("#title-text").val(node.displayTag);
    if (node.isTag())
        $("#title-url").hide();
    else {
        $("#title-url").show();
        $("#title-url").val(node.URL);
    }
    $("#text-text").val(node.text);
    $("#update").prop("disabled", true);
    dialog.showModal();
}

$(".editNode").on('input', function() {
    // enable update button if one of the texts is edited
    $("#update").prop('disabled', false);
});

$("#popup").click(function(e) {
    // click on the backdrop closes the dialog
    if (e.target.tagName === 'DIALOG')
    {
        $("#dialog")[0].close();
        $("#buttonRow").show(100);
    }
});

function dialogClose() {
    $('#dialog')[0].close();
}
    

function selectedNode() {
    // Return the node currently highlighted or selected
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id');
    if (!nodeId) return null;
    return AllNodes[nodeId];
}

function activeNode(e) {
    // Return the active node for the event, either hovered (button click) or selected (keyboard)
    const tr = (e.type === 'click') ? $("tr.hovered")[0] : $("tr.selected")[0];
    if (!tr) return null;
    const nodeId = $(tr).attr('data-tt-id') || 0;
    return AllNodes[nodeId];
}
    

function openRow(e) {
    // Open all links under this row in windows per tag

    // First find all AppNodes involved - selected plus children
    const appNode = activeNode(e);
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
    const appNode = activeNode(e);  
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
    const appNode = activeNode(e);
    if (!appNode) return false;
    const kids = appNode.childIds.length && appNode.isTag();         // Tag determines non link kids

    // If children nodes ask for confirmation
    if (!kids || confirm('Delete all?')) {
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
    writeBTFile();
}


function updateRow() {
    // Update this node/row after edit.
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    const node = selectedNode();
    if (!node) return;

    // Update Model
    const url = $("#title-url").val();
    const title = $("#title-text").val();
    if (node.isTag())
        node.title = title;
    else
        node.title = `[[${url}][${title}]]`;
    node.text = $("#text-text").val();

    // Update ui
    $(tr).find("span.btTitle").html(node.displayTitle());
    $(tr).find("span.btText").html(node.displayText());

    // Update File 
    writeBTFile();

    // Update extension
    BTAppNode.generateTags();    
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
    console.count('BT-OUT:tags_updated');

    // reset ui
    $("#dialog")[0].close();
    $("tr.selected").removeClass('selected');
    initializeUI();
}

function toDo(e) {
    // iterate todo state of selected node/row (TODO -> DONE -> '').
    const appNode = activeNode(e);
    if (!appNode) return false;

    appNode.iterateKeyword()                // ask node to update

    // Update ui and file
    const tr = $(`tr[data-tt-id='${appNode.id}']`);
    $(tr).find("span.btTitle").html(appNode.displayTitle());
    initializeUI();
    writeBTFile();
}

function promote(e) {
    // move node up a level in tree hierarchy
    
    const node = activeNode(e);
    if (!node || !node.parentId) return;                  // can't promote
    
    // collapse open subtree if any
    if (node.childIds.length)
        $("#content").treetable("collapseNode", node.id);

    // Do the move
    const newParentId = AllNodes[node.parentId].parentId;
    node.reparentNode(newParentId);
    $("table.treetable").treetable("promote", node.id);

    // save to file, update Tags etc
    writeBTFile();
    BTAppNode.generateTags();
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});
}

function addChild(e) {
    // add new child to this node

    // create child element
    const node = activeNode(e);
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
    writeBTFile();
}

function generateOrgFile() {
    // iterate thru nodes to do the work
    let orgText = metaPropertiesToString(AllNodes.metaProperties);
    
    // find and order the top level nodes according to table position
    const topNodes = AllNodes.filter(node => node && !node.parentId);
    topNodes.sort(function(a,b) {
        const eltA = $(`tr[data-tt-id='${a.id}']`)[0];
        const eltB = $(`tr[data-tt-id='${b.id}']`)[0];
        const posA = eltA ? eltA.rowIndex : Number.MAX_SAFE_INTEGER;
        const posB = eltB ? eltB.rowIndex : Number.MAX_SAFE_INTEGER;
        return (posA - posB);
    });
    
    // iterate on top level nodes, generate text and recurse
    topNodes.forEach(function (node) {
        if (node && (node.level == 1))
            orgText += node.orgTextwChildren() + "\n";
    });
    return orgText.slice(0, -1);                                      // take off final \n
}

/***
 * 
 * Option Processing
 * RN just Bookmarks
 * 
 ***/

function importBookmarks() {
    // pull in Chrome bookmarks and insert into All Nodes for subsequent save
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

    RefreshCB = function() {animateNewBookmark(importName);};
    writeBTFile(refreshTable);

    $("#export_button").prop('disabled', false);           // allow export after import 
}

function loadBookmarkNode(node, parent) {
    // load a new node from bookmark export format as child of parent BTNode and recurse on children

    if (node.url && node.url.startsWith('javascript:')) return; // can't handle JS bookmarklets
    
    const title = node.url ? `[[${node.url}][${node.title}]]` : node.title;
    const btNode = new BTAppNode(title, parent.id, "", parent.level + 1);
    if (btNode.level > 3)                 // keep things tidy
        btNode.folded = true;

    // handle link children, reverse cos new links go on top
    node.children.reverse().forEach(node => {
        if (node.childen) return;
        if (node.url && node.url.startsWith('javascript:')) return; // can't handle JS bookmarklets
        const title = node.url ? `[[${node.url}][${node.title}]]` : node.title;
        new BTAppNode(title, btNode.id, "", btNode.level + 1);
    });
    
    // recurse on non-link nodes, nb above reverse was destructive, reverse again to preserve order
    node.children.reverse().forEach(node => {
        if (!node.children) return;
        loadBookmarkNode(node, btNode);
    });
}

function animateNewBookmark(name) {
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
    
function getDateString() {
    // return minimal date representation to append to bookmark tag
    const d = new Date();
    const mins = d.getMinutes() < 10 ? "0"+d.getMinutes() : d.getMinutes();
    return (`${d.getMonth()+1}/${d.getDate()}/${d.getYear()-100} ${d.getHours()}:${mins}`);
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

        writeBTFile(groupingUpdate(oldVal, newVal));
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
        if (confirm(`Also sort existing tabs into ${numPotentialWins} new windows?`))
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
    
    // ignore keys if edit dialog is open
    if ($($("#dialog")[0]).is(':visible')) return;

    // n or down arrow, p or up arrow for up/down (w/o alt)
    let next, currentSelection = $("tr.selected")[0];
    if (!alt && [78, 80, 38, 40].includes(key)) {
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

    // delete = delete
    if (key === 8) {
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
    writeBTFile();
    BTAppNode.generateTags();        
    window.postMessage({'function': 'localStore', 'data': {'tags': Tags }});

}
