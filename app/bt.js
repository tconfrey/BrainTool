
//NB Runs in context of BT window, not the background BT extension or the helper btContent scripts

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
var CLIENT_ID, API_KEY;

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

var ButtonRowHTML; 

var tipsArray = [
    "Type ':' when selecting a tag to add a subtag.",
    "Double click on a table row to highlight its open window, if any.",
    "Type ':TODO' after a tag to make the item a TODO in the BT tree.",
    "Create tags like ToRead to keep track of pages you want to come back to.",
    "Remember to Refresh if you've been editing the BrainTool.org file directly. (Also make sure your updates are sync'd to your GDrive.)",
    "Alt-b (aka Option-b) is the BrainTool accelerator key. You can change that in Chrome://extensions",
    "You can tag individual gmails or google docs into the BT tree",
    "BT uses org format for links: [[URL][Link Text]], both can be edited",
    "Note that clicking a link in a BT managed tab will open in a new tab because the BT tab is clamped to that specific web page."
];

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }, function(error) {
        appendPre(JSON.stringify(error, null, 2));
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        FindOrCreateBTFile();
        addTip();               // display tip text
        setTimeout(toggleMenu, 2000);
    } else {
        $("#auth_screen").show();
        $("#loading").hide();
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
    }
}

function addTip() {
    // add random entry from the tipsArray
    indx = Math.floor(Math.random() * tipsArray.length);
    $("#tip").html("<b>Tip:</b> " + tipsArray[indx]);
}

function toggleMenu() {
    // Toggle the visibility of the intro page, auth/de-auth button and open/close icon
    if ($("#auth_screen").is(":visible")) {
        $("#auth_screen").slideUp(750);
        $("#close").show();
        $("#open").hide();
    } else {
        addTip();               // display tip text
        $("#auth_screen").slideDown(750);
        $("#close").hide();
        $("#open").show();
    }
}
        

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    gapi.auth2.getAuthInstance().signOut();
}

/**
 * Append a pre element to the body containing the given message
 * as its text node. Used to display error results of the API call.
 *
 * @param {string} message Text to be placed in pre element.
 */
function appendPre(message) {
    var pre = document.getElementById('content');
    var textContent = document.createTextNode(message + '\n');
    pre.appendChild(textContent);
}

/**
 * Find or initialize BT file
 */
var fileid;
function FindOrCreateBTFile() {
    try {
        gapi.client.drive.files.list({
            'pageSize': 1,
            'fields': "files(id, name)",
            'q': "name='BrainTool.org' and not trashed"
        }).then(function(response) {
            var files = response.result.files;
            if (files && files.length > 0) {
                var file = files[0];
                fileid = file.id;
                getBTFile();
            } else {
                console.log('BrainTool.org file not found.');
                createStartingBT();
            }
        });
    }
    catch (err) {   
        alert("BT - error reading file list from GDrive. Check permissions and retry");
        console.log("Error in writeBTFile: ", JSON.stringify(err));
    }
}

function getBTFile() {
    try {
    gapi.client.drive.files.get({
        fileId: fileid,
        alt: 'media'
    }).then(
        function(response) {
            processBTFile(response.body);
        },
        function(error) {
            console.log("Error - Could not read BT file");
        });
    }
    catch(err) {
        alert("BT - error reading BT file from GDrive. Check permissions and retry");
        console.log("Error in writeBTFile: ", JSON.stringify(err));
    }
}


function createStartingBT() {
    // Read the template bt file from the server and upload to gdrive

    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
/*      'parents': ['### folder ID ###'], // Folder ID at Google Drive */
    };
    var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();
    
    fetch('/app/BrainTool.org')     // fetch template file from bt server
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.blob();
        })
        .then(blob => {
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form,
            }).then((res) => {
                return res.json();
            }).then(function(val) {
                console.log("Created ", val);
                fileid = val.id;
                getBTFile();
            });
        })
        .catch(function () {
            this.dataError = true;
        })
}

window.LOCALTEST = false; // overwritten in test harness
function writeBTFile() {
    // Write file contents into BT.org file on GDrive
    
    BTFileText = generateOrgFile();
    if (window.LOCALTEST) return;
    if (typeof gapi === "undefined") {           // eg when called from test harness
	    alert("BT - error in writeBTFile");
	    return;
    }
    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
    };
    try {
        var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
        var form = new FormData();
        console.log("writing BT file. accessToken = ", accessToken);

        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([BTFileText], {type: 'text/plain'}));

        fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(fileid) + '?uploadType=multipart',
              {
                  method: 'PATCH', 
                  headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                  body: form
              }).then((res) => {
	              if (!res.ok) {
		              alert("BT - error writing to GDrive, reuthenticating...");
		              console.log("GAPI response:\n", res);
                      gapi.auth.authorize(
                          {client_id: CLIENT_ID, scope: SCOPES, immediate: true}
                      ).then((res) => {
                          if (res.status && res.status.signed_in) {
                              writeBTFile();                        // try again
                          }});
		              return('GAPI error');
	              }
                  return res.json();
              }).then(function(val) {
                  console.log(val);
              });
    }
    catch(err) {
        alert("BT - error writing to GDrive. Check permissions and retry");
        console.log("Error in writeBTFile: ", JSON.stringify(err));
    }
}



var Tags = new Array();        // track tags for future tab assignment
var BTFileText = "";           // Global container for file text
var OpenedNodes = [];          // attempt to preserve opened state across refresh

function refreshTable() {
    // refresh from file, first clear current state
    $("#refresh").prop("disabled", true);
    $("#refresh").text('...');
    BTFileText = "";
    BTNode.topIndex = 1;
    BTNode.AllBTNodes = [];

    // Remember window opened state to repopulate later
    OpenedNodes = [];
    $("tr.opened").each(function() {
        var id = $(this).attr("data-tt-id");
        var node = AllNodes[id];
        OpenedNodes.push(node.title);
    });
    AllNodes = [];
    
    FindOrCreateBTFile();
}


function generateTable() {
    // Generate table from BT Nodes
    var outputHTML = "<table>";
    AllNodes.forEach(function(node) {
        if (!node || !node.hasWebLinks) return;
        outputHTML += node.HTML();
    });
    outputHTML += "</table>";
    return outputHTML;
}


function processBTFile(fileText) {
    // turn the org-mode text into an html table, extract category tags
    BTFileText = fileText;      // store for future editing

    // First clean up from any previous state
    BTNode.topIndex = 1;
    BTNode.AllBTNodes = [];
    AllNodes = [];
    
    parseBTFile(fileText);

    var table = generateTable(); 
    var tab = $("#content");
    tab.html(table);
    tab.treetable({ expandable: true, initialState: 'expanded', indent: 10,
                    onNodeCollapse: nodeCollapse, onNodeExpand: nodeExpand}, true);
    
    BTAppNode.generateTags();

    // Let extension know about model
    window.postMessage({ type: 'tags_updated', text: Tags});
    console.count('BT-OUT:tags_updated');
    var nodes = JSON.stringify(BTNode.AllBTNodes);    // only send the core data needed in BTNode, not AppNode
    window.postMessage({ type: 'nodes_updated', text: nodes});
    console.count('BT-OUT:nodes_updated');

    // initialize ui from any pre-refresh opened state
    var nodeId;
    OpenedNodes.forEach(function(nodeTitle) {
        nodeId = BTNode.findFromTitle(nodeTitle);
        if (!nodeId) return;
        $("tr[data-tt-id='"+nodeId+"']").addClass("opened");
    });

    // set collapsed state as per org data
    AllNodes.forEach(function(node) {
        if (node && node.folded && node.hasWebLinks) // NB no weblinks => not displayed in tree
            tab.treetable("collapseNode", node.id);
    });

    initializeUI();
    
    $("#refresh").prop("disabled", false); // activate refresh button
    $("#refresh").text("Refresh");
}

function initializeUI() {
    //DRY'ing up common event stuff needed whenever the tree is modified
    $("table.treetable tr").on('mouseenter', null, buttonShow);
    $("table.treetable tr").on('mouseleave', null, buttonHide);  
    $(".elipse").hover(function() {         // show hover text on summarized nodes
        var thisNodeId = $(this).closest("tr").attr('data-tt-id');
        var htxt = AllNodes[thisNodeId].text;
        $(this).attr('title', htxt);
    });
    // intercept link clicks on bt links
    $("a.btlink").each(function() {
        this.onclick = handleLinkClick;
    });
    
    // double click - show associated window
    $("table.treetable tr").on("dblclick", function () {
        const nodeId = this.getAttribute("data-tt-id");
        window.postMessage({ 'type' : 'show_node', 'nodeId' : nodeId});
    });
    
    // make rows draggable    
    $("tr").draggable({
        helper: function() {
            buttonHide();
            const clone = $(this).clone();
            return clone;
        },     
        start: dragStart,       // call fn below on start
        handle: "#move",        // use the #move button as handle
        axis: "y",
        scrollSpeed: 10,
        containment: "#content",
        cursor: "move",
        cursorAt: {left: 390},
        opacity: .5,
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
            if ($(this).hasClass('branch'))
                $(this).addClass("dropTarget");
            else {
                const parentId = $(this).attr('data-tt-parent-id');
                $("tr[data-tt-id='"+parentId+"']").addClass("dropTarget");
            }
        },
        out: function(event, ui) {
            // undo the above
            $(this).children('td').first().removeClass("dropOver");
            if ($(this).hasClass('branch'))
                $(this).removeClass("dropTarget");
            else {
                const parentId = $(this).attr('data-tt-parent-id');
                $("tr[data-tt-id='"+parentId+"']").removeClass("dropTarget");
            }
        }
    });
    
    // Hide loading notice and show refresh button
    $("#loading").hide();
    $("#refresh").show();

    // Copy buttonRow's html for potential later recreation (see below)
    ButtonRowHTML = $("#buttonRow")[0].outerHTML;
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
    if (AllNodes[nodeId].childIds.length) {
        const treeTable = $("#content");
        treeTable.treetable("collapseNode", nodeId);
    }
}
function dropNode(event, ui) {
    // Drop node w class=dragTarget onto node w class=dropTarget in position below class=dropOver
    console.log("dropping");
    const dragNode = $(".dragTarget")[0];
    const dropParent = $(".dropTarget")[0];
    const dropBelow = $($(".dropOver")[0]).parent();

    const dragNodeId = $(dragNode).attr('data-tt-id');
    const dropParentId = $(dropParent).attr('data-tt-id');
    const treeTable = $("#content");

    if (dropParentId) {
        // First set the correct parentage, model then tree
        const nodeIndex = $(dropBelow).index();
        const parentIndex = $(dropParent).index();
        BTAppNode.reparentNode(dropParentId, dragNodeId, nodeIndex - parentIndex);
        treeTable.treetable("move", dragNodeId, dropParentId);
        
        // Then move to correct position under parent and update file
        positionNode(dragNode, dropParent, dropBelow);
        writeBTFile();
    }
    
    // Clean up
    $(dragNode).removeClass("dragTarget").removeClass("hovered", 750);
    $(dropParent).removeClass("dropTarget");
    $("td").removeClass("dropOver");
}

function positionNode(dragNode, dropParent, dropBelow) {
    // Position dragged node below the dropbelow element under the parent
    // NB treetable does not support this so we need to use this sort method
    console.log("positioning");
    const newPos = $("tr").index(dropBelow);
    const dropParentId = $(dropParent).attr('data-tt-id');
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
                            aa = a.row[0];
                            bb = b.row[0];
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
function nodeExpand(arg) {
    console.log('Expanding ', this.id);
    let update = AllNodes[this.id].folded;
    AllNodes[this.id].folded = false;
    
    // Update File 
    if (update) writeBTFile();
}
function nodeCollapse(arg) {
    console.log('Collapsing ', this.id);
    let update = !AllNodes[this.id].folded;
    AllNodes[this.id].folded = true;
    
    // Update File 
    if (update) writeBTFile();
}
   

function handleLinkClick(e) {
    var nodeId = $(this).closest("tr").attr('data-tt-id');
    var url = $(this).attr('href');
    console.log("click on :" + $(this).text() + ", nodeId: " + nodeId);
    
    window.postMessage({ 'type': 'link_click', 'nodeId': nodeId, 'url': url });
    console.count('BT-OUT:link_click');
    e.preventDefault();
}

// Used below to ensure gapi is set up etc before trying to load file
var windowLoaded = false;
window.addEventListener('load', function() {
    windowLoaded = true;
});

//  Handle relayed messages from Content script
window.addEventListener('message', function(event) {
    // Handle message from Window
    let nodeId, parentId;
    if (event.source != window)
        return;
    console.log('bt.js got message:', event);
    console.count("BT-IN:" + event.data.type);
    switch (event.data.type) {
    case 'keys':
        if (window.LOCALTEST) return;            // running inside test harness
        console.log('Initializing gdrive app...');
        // Client ID and API key from the Developer Console, values storted offline in config.js
        CLIENT_ID = event.data.client_id;
        API_KEY = event.data.api_key;
        if (windowLoaded && (typeof gapi !== 'undefined'))
            gapi.load('client:auth2', initClient);             // initialize gdrive app
        else
            waitForGapi()
        break;
    case 'new_tab':
        storeTab(event.data.tag, event.data.tab, event.data.note);
        break;
    case 'tab_opened':
        nodeId = event.data.BTNodeId;
        parentId = event.data.BTParentId;
        AllNodes[nodeId].open = true;
        $("tr[data-tt-id='"+nodeId+"']").addClass("opened");
        $("tr[data-tt-id='"+parentId+"']").addClass("opened");
        break;
    case 'tab_closed':
        nodeId = event.data.BTNodeId;
        AllNodes[nodeId].open = false;
        parentId = AllNodes[nodeId] ? AllNodes[nodeId].parentId : 0;
        let parentElt = $("tr[data-tt-id='"+parentId+"']");

        // update ui and animate to indicate change
        $("tr[data-tt-id='"+nodeId+"']").removeClass("opened", 1000);
        if (!parentId || AllNodes[parentId].hasOpenChildren()) break;
        $("tr[data-tt-id='"+parentId+"']").removeClass("opened");
        parentElt.addClass("hovered",
                           {duration: 1000,
                            complete: function() {
                                parentElt.removeClass("hovered", 1000);
                            }});
        break;
    }
});

function waitForGapi () {
    // gapi needed to access gdrive not yet loaded this script needs to wait
    // NB shoudl probably error out sometime but there is a loading indicator showing at this point.
    if (windowLoaded && (typeof gapi !== 'undefined'))
        gapi.load('client:auth2', initClient);             // initialize gdrive app
    else {
        $("#loadingMessage").append(".");
        setTimeout(waitForGapi, 250);
    }
}

function cleanTitle(text) {
    // clean page title text of things that can screw up BT. Currently []
    return text.replace("[", '').replace("]", '').replace(/[^\x20-\x7E]/g, '');
}

function storeTab(tg, tab, note) {
    // put this tab under storage w given tag

    // process tag and add new if doesn't exist
    const [tag, parent, keyword] = BTNode.processTagString(tg);
    const existingTag = Tags.reduce((found, cur) => found || (cur.name == tag), false);
    if (!existingTag) addNewTag(tag, parent);
    
    const url = tab.url;
    const title = cleanTitle(tab.title);
    const parentNodeId = BTAppNode.findFromTag(tag);
    const parentNode = AllNodes[parentNodeId];

    const newBTNode = new BTNode(BTNode.topIndex++, `[[${url}][${title}]]`, parentNodeId);
    const newNode = new BTAppNode(newBTNode, note || "", parentNode.level + 1);
    newNode.hasWebLinks = true;                                  // since we're adding a link to the stored tab
    if (keyword) newNode.keyword = keyword;

    const n = $("table.treetable").treetable("node", parentNodeId);                // find parent treetable node
    $("table.treetable").treetable("loadBranch", n, newNode.HTML());               // and insert new row
        
    writeBTFile();              // write back out the update file text

    // update and let extension know about updated tags list as needed
    if (!existingTag) {
        BTAppNode.generateTags();
        window.postMessage({ type: 'tags_updated', text: Tags });
    }

    // Update ui components as needed - NB $(".indenter").remove() if redrawing table
    // Seems like sometime treetable hasn't completed the loadBranch so put behind a timeout
    setTimeout(function() {
        $("tr[data-tt-id='"+newNode.id+"']").addClass("opened");
        $("tr[data-tt-id='"+parentNodeId+"']").addClass("opened");
        newNode.open = true;
        initializeUI();
    }, 5);
}

function addNewTag(tag, parent) {
    // New tag - create node and add to tree

    const parentTagId = parent ? BTAppNode.findFromTag(parent) : null;
    const parentTagLevel = parentTagId ? AllNodes[parentTagId].level : 0;
    const newBTNode = new BTNode(BTNode.topIndex++, tag, parentTagId);
    const newNode = new BTAppNode(newBTNode, "", parentTagLevel+1);
    newNode.hasWebLinks = true;

    const n = $("table.treetable").treetable("node", parentTagId);                // find parent treetable node
    $("table.treetable").treetable("loadBranch", n || null, newNode.HTML());      // insert into tree
}


/* Edit Operations */
function buttonShow() {
    // Show buttons to perform row operations, triggered on hover
    $(this).addClass("hovered");
    const td = $(this).find(".right")

    if ($("#buttonRow").index() < 0) {
        // Can't figure out how sometimes after a Drag/drop the element is deleted
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
        $("#expand").show();
        $("#collapse").hide();
    }
    // show expand is not all kids of branch are open
    if ($(this).hasClass("branch")) {
        const id = this.getAttribute("data-tt-id");
        const notOpenKids = $("tr[data-tt-parent-id='"+id+"']").not(".opened");
        if (notOpenKids && notOpenKids.length)
            $("#expand").show();
    }
    $("#buttonRow").show();
}

function buttonHide() {
    // hide button to perform row operations, triggered on exit    
    $(this).removeClass("hovered");
    $("#buttonRow").hide();
    $("#buttonRow").detach().appendTo($("#dialog"));
}

$("#edit").click(function(e) {
    // position and populate the dialog and open it
    var top = e.originalEvent.clientY;
    $(this).closest("tr").addClass('selected');
    var dialog = $("#dialog")[0];
    var table = $("#content")[0];

    if ((top + $(dialog).height() + 50) < $(window).height())
        $(dialog).css("top", top+10);
    else
        // position above row to avoid going off bottom of screen
        $(dialog).css("top", top - $(dialog).height() - 50); 
    if (populateDialog()) {
        dialog.showModal();
    } else {
        $(this).closest("tr").removeClass('selected');
        alert("Error editing here, please update the org file directly and Refresh");
    }
});

$("#popup").click(function(e) {
    // click on the backdrop closes the dialog
    if (e.target.tagName === 'DIALOG')
    {
        $("#dialog")[0].close();
        $("tr.selected").removeClass('selected');
        $("#buttonRow").show(100);
    }
});

function dialogClose() {
    $('#dialog')[0].close();
    $("tr.selected").removeClass('selected');
}
    

function populateDialog() {
    // set up the dialog for use
    const tr = $("tr.selected")[0];
    const nodeId = $(tr).attr('data-tt-id');
    const appNode = AllNodes[nodeId];
    if (!appNode) return false;
    
    const titletxt = appNode.title;
    const txttxt = appNode.text;
    
    $("#title-text").val(titletxt);
    $("#text-text").val(txttxt);
    $("#update").prop("disabled", true);
    return true;
}

$("textarea").change(function() {
    $("#update").prop("disabled", true);
});
    

function openRow() {
    // Open all links under this row in windows per tag

    // First find all AppNodes involved - selected plus children
    const tr = $("tr.hovered")[0];
    const nodeId = $(tr).attr('data-tt-id');
    const appNode = AllNodes[nodeId];
    if (!appNode) return;

    const numWins = appNode.countOpenableWindows();
    const numTabs = appNode.countOpenableTabs();

    // Warn if opening lots of stuff
    if ((numWins > 2) || (numTabs > 20))
        if (!confirm(`Open ${numWins} windows and ${numTabs} tabs?`))
            return;
    
    const num_kids = appNode.childIds.length;
    if (num_kids) {
        // container node handle as such
        openEachWindow(appNode);
    }
    else {
        // individual link, open if not already
        if (!appNode.open) {
            const url = appNode.getURL();
            window.postMessage({ 'type': 'link_click', 'nodeId': nodeId, 'url': url });
            console.count('BT-OUT:link_click');
        }
    }

    // close the dialog
    $("#dialog")[0].close();
    $("tr.selected").removeClass('selected');
}

function openEachWindow(node) {
    const rowIds = [];
    const tabsToOpen = [];
    
    rowIds.push(node.id);
    node.childIds.forEach(function(childId) {
        rowIds.push(childId);
    });

    // iterate thru rows and find all links and send msg to extension to open them
    rowIds.forEach(function(id) {
        $("tr[data-tt-id='"+id+"']").find("a").each(function() {
            const url = $(this).attr('href');
            if (url == "#") return;                           // ignore the '...' hover link
            if (AllNodes[id] && !AllNodes[id].open)           // only open if not already
                tabsToOpen.push({'nodeId': id, 'url': url });
        });
    });
    
    if (tabsToOpen.length) {
        window.postMessage({ 'type': 'tag_open', 'parent': node.id, 'data': tabsToOpen});
        console.count('BT-OUT:tag_open');
    }

    if (node.childIds.length)    // iterate again and recurse for container nodes to each open their windows
        node.childIds.forEach(function(childId) {
            const child = AllNodes[childId];
            if (child.childIds.length)
                openEachWindow(child);
        });
}

function closeRow() {
    // close this node's tab or window
    const tr = $("tr.hovered")[0];
    const nodeId = $(tr).attr('data-tt-id');

    function closeNode(nodeId){    
        const appNode = AllNodes[nodeId];
        if (!appNode) return;
        window.postMessage({ 'type': 'close_node', 'nodeId': nodeId});
        console.count('BT-OUT:close_node');
        
        if (appNode.childIds.length)    // iterate again and recurse for container nodes to each open their windows
            appNode.childIds.forEach(function(childId) {
                const child = AllNodes[childId];
                if (child.childIds.length)
                    closeNode(child);
        });
        
    }
    closeNode(nodeId);
}

function escapeRegExp(string) {
    // stolen from https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function deleteRow() {
    // Delete this node/row.
    buttonHide();
    const tr = $("tr.selected")[0] || $("tr.hovered")[0];
    const nodeId = $(tr).attr('data-tt-id');
    const appNode = AllNodes[nodeId];
    if (!appNode) return false;
    const kids = appNode.childIds.length && appNode.isTag(); // Tag determines non link kids

    // If children nodes ask for confirmation
    if (!kids || confirm('Delete all?')) {
        $("table.treetable").treetable("removeNode", nodeId);          // Remove from UI and treetable
        $("#dialog")[0].close();
        deleteNode(nodeId);
    }   
}

function deleteNode(id) {
    //delete node and clean up
    id = parseInt(id);          // could be string value
    const node = AllNodes[id];
    if (!node) return;
    BTNode.deleteNode(id)       // delete from model. NB handles recusion to children
    
    // Update parent display
    const parent = AllNodes[node.parentId];
    if (parent) {
        const openKids = $("tr[data-tt-parent-id='"+parent.id+"']").hasClass("opened");
        if (!openKids)
            $("tr[data-tt-id='"+parent.id+"']").removeClass("opened");
    }
    
    // message to update BT background model
    window.postMessage({ type: 'node_deleted', nodeId: id });
    console.count('BT-OUT:node_deleted');

    // Remove from Tags and update extension
    BTAppNode.generateTags();
    window.postMessage({ type: 'tags_updated', text: Tags});
    console.count('BT-OUT:tags_updated');
    
    // Update File 
    writeBTFile();
}

$(".editNode").on('change keyup paste', function() {
    $("#update").prop('disabled', false);
});


function updateRow() {
    // Update this node/row.

    var tr = $("tr.selected")[0];
    var nodeId = $(tr).attr('data-tt-id');
    var node = AllNodes[nodeId];
    var titleText = $("#title-text").val();
    var textText = $("#text-text").val();

    // Update Model
    node.title = titleText;
    node.text = textText;
    
    // Update ui
    $(tr).find("span.btTitle").html(node.displayTitle());
    $(tr).find("span.btText").html(node.displayText());

    // Update File 
    writeBTFile();

    // Update extension
    BTAppNode.generateTags();
    window.postMessage({ type: 'tags_updated', text: Tags});
    console.count('BT-OUT:tags_updated');

    // reset ui
    $("#dialog")[0].close();
    $("tr.selected").removeClass('selected');
    initializeUI();
}

function generateOrgFile() {
    // iterate thru nodes to do the work
    var orgText = "";
    AllNodes.forEach(function (node) {
        // start at top level nodes and recurse, cos child nodes don't necessarily follow parent nodes in array
        if (node && (node.level == 1))
            orgText += node.orgTextwChildren() + "\n";
    });
    return orgText.slice(0, -1);                                      // take off final \n
}

