/*** 
 * 
 * Handles interactions with users Google Drive account to read and write BrainTool.org file.
 * 
 ***/

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
var CLIENT_ID, API_KEY;

// Authorization scopes required by the API;
// Need to be able to create/read/write BTFile
var SCOPES = 'https://www.googleapis.com/auth/drive.file';
//  Turns out query is supported by .file for app-created files and make approavl simpler.
// https://www.googleapis.com/auth/drive.metadata.readonly';

// Used below to ensure gapi is set up etc before trying to load the file
var WindowLoaded = false;
window.addEventListener('load', function() {
    WindowLoaded = true;
});


function processKeys(data) {
    // Client ID and API key from the Developer Console, values storted offline in config.js
    const clientId = data.client_id;
    const APIKey = data.api_key;
    
    if (window.LOCALTEST) return;                          // running inside test harness
    console.log('Loading Google API...');
    CLIENT_ID = clientId;
    API_KEY = APIKey;
    if (WindowLoaded && (typeof gapi !== 'undefined'))
        gapi.load('client:auth2', initClient);             // load auth lib & initialize gdrive app
    else
        waitForGapi();
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

var InitClientReturned = false;
function initClient() {
    // Initializes the API client library and sets up sign-in state listeners
    console.log("Initializing GDrive client app");
    setTimeout(checkInitClientReturned, 10000);
    try {
	    gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: DISCOVERY_DOCS,
            scope: SCOPES
	    }).then(function () {
            InitClientReturned = true;
            if (!gapi.auth2 || !gapi.auth2.getAuthInstance()) {
                alert("Error GDrive API reporting not authorized. Try reloading");
                return;
            }
            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

            // Handle the initial sign-in state.
            if (gapi.auth2.getAuthInstance().isSignedIn.get())
                FirstUse = false;
            
            updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
            authorizeButton.onclick = handleAuthClick;
//            signoutButton.onclick = handleSignoutClick;
	    }, function(error) {
            InitClientReturned = true;
            updateSigninStatus(false, error);
            alert (`Error initializing GDrive API: \n[${JSON.stringify(error, undefined, 2)}]`);
	    });
    }
    catch (err) {
        InitClientReturned = true;
	    alert(`Error in initClient: [${JSON.stringify(err)}]`);
    }
}
function checkInitClientReturned() {
    // The gapi.client.init promise sometimes just never completes
    if (InitClientReturned) return;
    alert("GDrive API initialization never returned. Trying again");
    initClient();
}

var authClickReturned;
function handleAuthClick(event) {
    // Sign in the user upon button click.
    console.log("Signing in user");
    authClickReturned = false;
    $('body').addClass('waiting');
    setTimeout(checkAuthClickReturned, 25000);
    try {
        gapi.auth2.getAuthInstance().signIn().then(
            function() {
                authClickReturned = true;
                $('body').removeClass('waiting');
                console.log('User signed in');
            }, function(err) {
                authClickReturned = true;
                $('body').removeClass('waiting');
                alert(`Error signing in: [${JSON.stringify(err.error)}]`);
            });
    }
    catch (err) {
        authClickReturned = true;
        $('body').removeClass('waiting');
        alert(`Error signing in: \n[${JSON.stringify(err)}]`);
    }
}
function checkAuthClickReturned() {
    // gapi.auth also sometimes doesn't return, most noteably cos of Privacy Badger
    if (authClickReturned) return;
    
    $('body').removeClass('waiting');
    alert("Google Authentication failed to complete!\nThis can be due to extensions such as Privacy Badger or if 3rd party cookies are disallowed. If it continues see \nbraintool.org/support");
}


function handleSignoutClick(event) {
    // Sign out the user upon button click.
    console.log("Signing out user");
    try {
        gapi.auth2.getAuthInstance().signOut().then(
            function() {
                console.log('User signed out');
            }, function(err) {
                alert(`Error signing out: [${JSON.stringify(err.error)}]`);
            });
    }
    catch (err) {
        alert(`Error signing out: \n[${JSON.stringify(err)}]`);
    }
}


/**
 * Find or initialize BT file
 */
var BTFileID;
function findOrCreateBTFile() {
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
        console.log("Error in findOrCreateBTFile: ", JSON.stringify(err));
    }
}

function getBTFile() {
    console.log('Retrieving BT file');
    try {
	    gapi.client.drive.files.get({
            fileId: BTFileID,
            alt: 'media'
	    }).then(
            function(response) {
		        processBTFile(response.body);
            },
            function(error) {
		        console.log("Error in getBTFile - Could not read BT file:", JSON.stringify(error));
		        alert(`Could not read BT file. Google says: [${JSON.stringify(error, undefined, 2)}].\n Reauthenticating...`);
                reAuth(getBTFile);
            });
    }
    catch(err) {
        alert("BT - error reading BT file from GDrive. Check permissions and retry");
        console.log("Error in getBTFile: ", JSON.stringify(err));
    }
}


function createStartingBT() {
    // Read the template bt file from the server and upload to gdrive

    var metadata = {
        'name': 'BrainTool.org',                   // Filename at Google Drive
        'mimeType': 'text/plain'                   // mimeType at Google Drive
	/*      'parents': ['### folder ID ###'],      // Folder ID at Google Drive */
    };
    
    // get accessToken, pass retry cb for if not available
    const accessToken = getAccessToken(createStartingBT);
    if (!accessToken) 
        return;

    // fetch template file from bt server and write to GDrive
    var form = new FormData();    
    fetch('/app/BrainTool.org')                    
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
        .catch(function (err) {
            alert(`Error creating initial BT file template: [${JSON.stringify(err)}]`);
        })
}

function getAccessToken(cb) {
    // Get token or die trying
    
    const accessToken = gapi.auth.getToken() ? gapi.auth.getToken().access_token : null;
    if (accessToken) 
        return accessToken;

    // else there's some kind of issue. retry
	alert("BT - Error Google Access Token not available. Trying to reAuth...");
    if (cb)
        reAuth(cb);
    return null;
}

function reAuth(callback) {
    // If access to gdrive fails try a reauth

	gapi.auth.authorize(
        {client_id: CLIENT_ID, scope: SCOPES, immediate: true}
	).then((res) => {
        if (res.status && res.status.signed_in) {
            alert("reAuth succeeded. Continuing");
			if (callback)
                callback();                         // try again
            refreshRefresh();
        } else {
            console.log("Error in reAuth.");
        }});
    return;
}

window.LOCALTEST = false; // overwritten in test harness
var lastWriteTime = new Date();
var unwrittenChanges = null;
function writeBTFile(cb) {
    // Notification of change that needs to be written

    // if its been 15 secs, just write out,
    if (new Date().getTime() > (15000 + lastWriteTime.getTime()))
        _writeBTFile(cb);
    else
        // else set a timer, if one hasn't already been set
        if (!unwrittenChanges) {
            unwrittenChanges = setTimeout(_writeBTFile, 15000, cb);
            console.log("Holding BT file write");
        }

    function _writeBTFile(cb) {
        // Write file contents into BT.org file on GDrive
        console.log("Writing BT file");
        lastWriteTime = new Date();
        unwrittenChanges = null;
        
        BTFileText = generateOrgFile();
        if (window.LOCALTEST) return;
        if (typeof gapi === "undefined") {           // Should not happen
	        alert("BT - Error in writeBTFile. Google API not available.");
	        return;
        }
        const metadata = {
            'name': 'BrainTool.org',                 // Filename at Google Drive
            'mimeType': 'text/plain'                 // mimeType at Google Drive
        };
        try {
            // get accessToken, pass retry cb for if not available
            const accessToken = getAccessToken(writeBTFile);
            if (!accessToken) 
                return;

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
		                  alert("BT - error writing to GDrive, reauthenticating...");
		                  console.log("GAPI response:\n", JSON.stringify(res));
                          reAuth(writeBTFile);
		                  return('GAPI error');
	                  }
                      return res.json();
                  }).then(function(val) {
                      console.log(val);
                      if (cb) cb();
                  });
        }
        catch(err) {
            alert("BT - Error accessing GDrive. Toggle GDrive authorization and retry");
            console.log("Error in writeBTFile: ", JSON.stringify(err));
        }
    }
}

