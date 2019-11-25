
//NB Runs in context of BT window, not the background BT extension or the helper btContent scripts

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
var CLIENT_ID, API_KEY;

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');

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
      //  signoutButton.style.display = 'block';
        FindOrCreateBTFile();
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
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

function getBTFile() {
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


function createStartingBT() {
    // Read the template bt file from the server and upload to gdrive

    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
/*      'parents': ['### folder ID ###'], // Folder ID at Google Drive */
    };
    var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();
    
    fetch('/BrainTool.org')     // fetch template file from bt server
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
    if (typeof gapi === "undefined") return;           // eg when called from test harness
    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
    };
    var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();
    console.log("writing BT file");

    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([BTFileText], {type: 'text/plain'}));

    fetch('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(fileid) + '?uploadType=multipart',
          {
              method: 'PATCH', 
              headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
              body: form
          }).then((res) => {
              return res.json();
          }).then(function(val) {
              console.log(val);
          });
}



var Tags = new Set();          // track tags for future tab assignment
var BTFileText = "";           // Global container for file text
var OpenedNodes = [];          // attempt to preserve opened state across refresh

function refreshTable() {
    // refresh from file, first clear current state
    $("#refresh").prop("disabled", true);
    $("#refresh").text('...');
    Tags = new Set();
    BTFileText = "";
    BTNode.topIndex = 1;
    BTNode.AllBTNodes = [];

    // Remember window opened state to repopulate later
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
        if (!node || !node.linkChildren) return;
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

    // Let extension know about model
    var tags = JSON.stringify(Array.from(Tags));
    window.postMessage({ type: 'tags_updated', text: tags});
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
        if (node && node.folded && node.linkChildren) // NB no linkChildren => not displayed in tree
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

//  Handle relayed messages from Content script
window.addEventListener('message', function(event) {
    // Handle message from Window
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
        gapi.load('client:auth2', initClient);             // initialize gdrive app
        break;
    case 'new_tab':
        storeTab(event.data.tag, event.data.tab);
        break;
    case 'tab_opened':
        var nodeId = event.data.BTNodeId;
        var parentId = event.data.BTParentId;
        $("tr[data-tt-id='"+nodeId+"']").addClass("opened");
        $("tr[data-tt-id='"+parentId+"']").addClass("opened");
        break;
    case 'tab_closed':
        var nodeId = event.data.BTNodeId;
        $("tr[data-tt-id='"+nodeId+"']").removeClass("opened");
        break;
    }
});

function cleanTitle(text) {
    // clean page title text of things that can screw up BT. Currently []
    return text.replace("[", '').replace("]", '').replace(/[^\x20-\x7E]/g, '');
}


function storeTab(tag, tab) {
    // put this tab under storage w given tag

    // Add new tag if doesn't exist
    tag = tag.trim();
    if (!Tags.has(tag)) addNewTag(tag);
    
    const url = tab.url;
    const title = cleanTitle(tab.title);
    const parentNodeId = BTNode.findFromTitle(tag);
    const parentNode = AllNodes[parentNodeId];

    const newBTNode = new BTNode(BTNode.topIndex++, `[[${url}][${title}]]`, parentNodeId);
    const newNode = new BTAppNode(newBTNode, "", parentNode.level + 1);

    const n = $("table.treetable").treetable("node", parentNodeId);                // find parent node
    $("table.treetable").treetable("loadBranch", n, newNode.HTML());               // and insert new row
        
    writeBTFile();              // write back out the update file text
    
    // Update ui components as needed - NB $(".indenter").remove() if redrawing table
    // Seems like sometime treetable hasn't completed the loadBranch so put behind a timeout
    setTimeout(function() {
        $("tr[data-tt-id='"+newNode.id+"']").addClass("opened");
        $("tr[data-tt-id='"+parentNodeId+"']").addClass("opened");
        initializeUI();
    }, 5);
}

function addNewTag(tag) {
    // New tag - create node and add container at bottom
    tag = tag.trim();

    const newBTNode = new BTNode(BTNode.topIndex++, tag, null);
    const newNode = new BTAppNode(newBTNode, "", 1);

    $("table.treetable").treetable("loadBranch", null, newNode.HTML());              // insert into tree

    // Add new category and let extension know about updated tags list
    Tags.add(tag);
    var tags = JSON.stringify(Array.from(Tags));
    window.postMessage({ type: 'tags_updated', text: tags });
    console.count('BT-OUT:tags_updated');
}


/* Edit Operations */
function buttonShow() {
    // Show button to perform row operations, triggered on hover
    var td = $(this).find(".middle")
    $("#button").detach().appendTo($(td));
    $("#button").show(100);
}
function buttonHide() {
    // hide button to perform row operations, triggered on exit
    $("#button").hide();
    $("#button").detach().appendTo($("#dialog")); // was append"body"
}

$("#button").click(function(e) {
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
        $("#button").show(100);
    }
});

function populateDialog() {
    // set up the dialog for use
    const tr = $("tr.selected")[0];
    const nodeId = $(tr).attr('data-tt-id');
    const appNode = AllNodes[nodeId];
    if (!appNode) return false;
    
    const titletxt = appNode.title;
    const txttxt = appNode.text;
    const kids = appNode.childIds.length;
    
    $("#title-text").val(titletxt);
    $("#text-text").val(txttxt);
    $("#delete").prop("disabled", kids);
    $("#update").prop("disabled", true);
    $("#open").prop("disabled", !kids);
    return true;
}

$("textarea").change(function() {
    $("#update").prop("disabled", true);
});
    

function openRow() {
    // Open all links under this row in windows per tag

    // First find all AppNodes involved - selected plus children
    const tr = $("tr.selected")[0];
    const nodeId = $(tr).attr('data-tt-id');
    const appNode = AllNodes[nodeId];
    if (!appNode) return;

    openEachWindow(appNode);

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


function escapeRegExp(string) {
    // stolen from https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function deleteRow() {
    // Delete this node/row. NB only callable if no children
    var tr = $("tr.selected")[0];
    var nodeId = $(tr).attr('data-tt-id');
    $(tr).remove();                                   // remove from ui - easy!
    $("#dialog")[0].close();
    deleteNode(nodeId);
}
function deleteNode(id) {
    //delete node and clean up
    id = parseInt(id);          // could be string value
    var node = AllNodes[id];

    // Remove from parent
    var parent = AllNodes[node.parentId];
    if (parent)
        parent._btnode.removeChild(id);
    
    // Remove node. NB deleting cos I'm using ID for array index - maybe should have a level of indirection?
    delete(AllNodes[id]);

    // message to update BT background model
    window.postMessage({ type: 'node_deleted', nodeId: id });
    console.count('BT-OUT:node_deleted');
    
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

