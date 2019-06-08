
window.addEventListener("load", function() {
    // ideally would load file here
    var sel = document.getElementById('fileSelector');
    sel.onchange= function() {
        console.log(this.files);
        // grab the first item in the FileList object and pass it to the function
        loadFileEntry(this.files[0]);
    }

    // populate tabs list
//    listTabs();
});

// for files, read the text content into the textarea
function loadFileEntry(file) {
    // generate a new FileReader object
    var reader = new FileReader();
    var contents = document.getElementById('contents');

    // inject an image with the src url
    reader.onload = function(event) {
        console.log(reader.result);
        contents.innerHTML = reader.result;
    }

    // when the file is read it triggers the onload event above.
    reader.readAsText(file);
}


//-------------------------------  Copied from Sample code -------------------------------

// Client ID and API key from the Developer Console
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
        signoutButton.style.display = 'block';
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
 * as its text node. Used to display the results of the API call.
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
        'q': "name='BrainTool.org and not trashed'"
    }).then(function(response) {
        var files = response.result.files;
        if (files && files.length > 0) {
            appendPre('File:');
            var file = files[0];
            appendPre(file.name + ' (' + file.id + ')');
            fileid = file.id;
            getBTFile();
        } else {
            appendPre('BrainTool.org file not found.');
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
            appendPre(response.body);
        },
        function(error) {
            console.log("Error - Could not read BT file");
        });
}


function createStartingBT () {
    // Read the template bt file from the server and upload to gdrive

    var metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
/*      'parents': ['### folder ID ###'], // Folder ID at Google Drive */
    };
    var accessToken = gapi.auth.getToken().access_token; // Here gapi is used for retrieving the access token.
    var form = new FormData();
    
    fetch('/BrainTool.org')
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
