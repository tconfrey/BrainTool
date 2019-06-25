
//NB Runs in context of BT window, not the background BT extension or the helper btContent scripts

// Client ID and API key from the Developer Console, values storted offline in config.js
var CLIENT_ID = config.CLIENT_ID;
var API_KEY = config.API_KEY;

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

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
            //appendPre(response.body);
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

function writeBTFile() {
    // Write file contents into BT.org file on GDrive
    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
    };
    var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();

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



var Categories = new Set();     // track tags for future tab assignment
var BTFileText = "";            // Global container for file text
var parseTree;                  // orga parse results
var nodeId = 0;                 // for jquery.treetable id's

function refreshTable() {
    // refresh from file, first clear current state
    Categories = new Set();
    BTFileText = "";
    nodeId = 0;
    FindOrCreateBTFile();
}

function processBTFile(fileText) {
    // turn the org-mode text into an html table, extract category tags
    BTFileText = fileText;      // store for future editing
    parseBTFile(fileText);

    var table = generateTable();
    var tab = $("#content");
    tab.html(table);
    tab.treetable({ expandable: true, initialState: 'expanded', indent: 10 }, true);
    
    // Let extension know about model
    var tags = JSON.stringify(Array.from(Categories));
    window.postMessage({ type: 'tags_updated', text: tags});
    var nodes = JSON.stringify(AllNodes, replacer);
    window.postMessage({ type: 'nodes_updated', text: nodes});

    $(".elipse").hover(function() {
        var thisNodeId = $(this).closest("tr").attr('data-tt-id');
        var htxt = AllNodes[thisNodeId].text.fullText;
        $(this).attr('title', htxt);
    });

    // intercept link clicks on bt links
    for (var ls = document.links, numLinks = ls.length, i=0; i<numLinks; i++){
        if ($(ls[i]).hasClass('btlink'))
            ls[i].onclick= handleLinkClick;
    }
    
    function replacer(key, node) {
        // used to avoid circular references in nodes stringification
        // return id of parent instead of whole parent node
        if (key == 'parent')
            return node ? node.id : null;
        // filter out orgaNode, extension doesn't need it
        if (key == 'orgaNode')
            return undefined;
        return node;
    }
}


function handleLinkClick(e) {
    var nodeId = $(this).closest("tr").attr('data-tt-id');
    var url = $(this).attr('href');
    console.log("click on :" + $(this).text() + ", nodeId: " + nodeId);
    
    window.postMessage({ 'type': 'link_click', 'nodeId': nodeId, 'url': url });
    e.preventDefault();
}

//  Handle relayed add_tab message from Content script
window.addEventListener('message', function(event) {
    // Handle message from Window
    if (event.source != window)
        return;
    console.log('bt.js got message:', event);
    switch (event.data.type) {
    case 'new_tab':
        console.log('adding tab' + event.data.tab);
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
        AllNodes[nodeId].tabId = null;
        $("tr[data-tt-id='"+nodeId+"']").removeClass("opened");
        break;
    }
});


function storeTab(tag, tab) {
    // put this tab under storage

    // Add new tag if doesn't exist
    tag = tag.trim();
    if (!Categories.has(tag)) addNewTag(tag, tab);
    
    // find tag in table and add new row underneath it
    $(".left").each(function(i, obj) {
        if ($(this).text().trim() == tag) {
            // insert new link here
            var tr = $(this).closest('tr'); // walk up to parent row
            var ttParentId = $(tr).attr('data-tt-id');
            var newNode = generateNewNode(tab, ttParentId);
            $(tr).after(newNode);
        }
    });

    // find tag in file and add new row underneath it
    var regexStr = "^\\*+\\s*" + tag;
    var reg = new RegExp(regexStr, "m");
    var result = reg.exec(BTFileText);
    if (result) {
        var ind = result.index + result[0].length;
        var headerLevel = result[0].match(/\*+/)[0];
        var newRow = generateNewOrgRow(headerLevel, tab);
        BTFileText = BTFileText.slice(0, ind) + newRow + BTFileText.slice(ind);
    }
    
    $(".indenter").remove();    // workaround to prevent multiple expander nodes
    $("#content").treetable({ expandable: true, initialState: 'expanded', indent: 10 }, true);

    writeBTFile();              // finally write back out the update file text
}

function generateNewNode(tab, parentId) {
    // given a tab generate the tree tr row
    var url = tab.url;
    var title = tab.title;
    var newNode = "<tr data-tt-id='" + nodeId + "' data-tt-parent-id = '" + parentId + "'>";
    newNode += "<td class='left'><a target='_blank' href='" + url + "'>" + title + "</a></td></tr>";

    // also create and store btnode structure
    AllNodes[nodeId] = {id: nodeId++, children: [], parent: parentId, tabId: tab.id};

    return newNode;
}
function generateNewOrgRow(headline, tab) {
    // generatre textrow to be written back out to org file
    var url = tab.url;
    var title = tab.title;
    var newNode = "\n" + headline + "* [[" + url + "][" + title + "]]"; // add an extra * level
    return newNode;
}

function addNewTag(tag, tab) {
    // New tag, add container at bottom and put tab link under it
    var last = $("#content").find("tr").last();
    var newRows = "<tr data-tt-id='" + nodeId++ + "'><td class='left'>" + tag + "</td><td>New tag</td></tr>";
    $(last).after(newRows);

    // Add new tag to bottom of org file text
    BTFileText += "\n* " + tag;


    // Add new category and let extension know about updated tags list
    Categories.add(tag.trim());
    var tags = JSON.stringify(Array.from(Categories));
    window.postMessage({ type: 'tags_updated', text: tags });
}
    
