/*** 
 * 
 * Handles interactions with users Google Drive account to read and write BrainTool.org file.
 * 
 ***/

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
var CLIENT_ID, API_KEY;

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';

// Used below to ensure gapi is set up etc before trying to load the file
var WindowLoaded = false;
window.addEventListener('load', function() {
    WindowLoaded = true;
});

function processKeys(clientId, APIKey) {
    // Client ID and API key from the Developer Console, values storted offline in config.js
    if (window.LOCALTEST) return;                          // running inside test harness
    console.log('Initializing gdrive app...');
    CLIENT_ID = clientId;
    API_KEY = APIKey;
    if (WindowLoaded && (typeof gapi !== 'undefined'))
        gapi.load('client:auth2', initClient);             // initialize gdrive app
    else
        waitForGapi();
}

function initClient() {
    // Initializes the API client library and sets up sign-in state listeners
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


function waitForGapi () {
    // gapi needed to access gdrive not yet loaded => this script needs to wait
    // NB shoudl probably error out sometime but there is a loading indicator showing at this point.
    if (WindowLoaded && (typeof gapi !== 'undefined'))
        gapi.load('client:auth2', initClient);             // initialize gdrive app
    else {
        $("#loadingMessage").append(".");
        setTimeout(waitForGapi, 250);
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
 * Find or initialize BT file
 */
var BTFileID;
function FindOrCreateBTFile() {
    try {
        gapi.client.drive.files.list({
            'pageSize': 1,
            'fields': "files(id, name)",
            'q': "name='BrainTool.org' and not trashed"
        }).then(function(response) {
            const files = response.result.files;
            if (files && files.length > 0) {
                const file = files[0];         // NB assuming only one bt.org file exists
                BTFileID = file.id;
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
        fileId: BTFileID,
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
                BTFileID = val.id;
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
    const metadata = {
        'name': 'BrainTool.org', // Filename at Google Drive
        'mimeType': 'text/plain' // mimeType at Google Drive
    };
    try {
        const accessToken = gapi.auth.getToken().access_token;
        let form = new FormData();
        console.log("writing BT file. accessToken = ", accessToken);

        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([BTFileText], {type: 'text/plain'}));

        fetch('https://www.googleapis.com/upload/drive/v3/files/'
              + encodeURIComponent(BTFileID)
              + '?uploadType=multipart',
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

