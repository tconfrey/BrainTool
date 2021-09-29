/*** 
 * 
 * Handles local and gdrive file storage interactions.
 * 
 ***/

async function saveBT() {
    // Save org version of BT Tree to local storage and potentially gdrive

    console.log("Writing BT to Storage");
    BTFileText = BTAppNode.generateOrgFile();
    if (window.LOCALTEST) return;

    window.postMessage({'function': 'localStore', 'data': {'BTFileText': BTFileText}});
    brainZoom();                                 // swell the brain
    
    gtag('event', 'Save', {'event_category': 'General', 'event_label': 'Count', 'value': getMetaProp('BTVersion')});

    // also save to GDrive if connected
    if (!GDriveConnected) return;
    try {
        let sin = await isSignedIn();
        if (!sin)
            sin = await trySignIn();
        if (sin) {
            writeBTFile();
        } else {
            $("#gdrive_auth").show();
            GDriveConnected = false;
            alert("Can't connect to GDrive. Changes saved locally. Try re-auth (under Options) or restarting");
        }
    }
    catch(err) {
        alert(`Changes saved locally. GDrive connection failed. Google says:\n${JSON.stringify(err)}`);
        console.log("Error in saveBT:", err);
    }
}

// Array of API discovery doc URLs for APIs used by the quickstart
var DiscoveryDocs = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
var ClientID, APIKey;

// Authorization scopes required by the API;
// Need to be able to create/read/write BTFile
var Scopes = 'https://www.googleapis.com/auth/drive.file';
//  Turns out query is supported by .file for app-created files and make approval simpler.
// https://www.googleapis.com/auth/drive.metadata.readonly';
var AuthObject = null;

async function isSignedIn () {
    // Basically just call .issignedIn but need to make sure the lib is loaded and initiailized
    const loadGapiPromise = function() {
        // Promisify the gapi load call
        return new Promise((resolve, reject) => {
            // TODO figure out error case
            gapi.load('client:auth2', (err) => {
                resolve();
            });
        });
    };
    
    if (typeof gapi === 'undefined')
        return false;                                      // if no library then not signed in
    if (AuthObject == null) {
        await loadGapiPromise();
        AuthObject = gapi.auth2.getAuthInstance({client_id: ClientID});
    }
    return AuthObject?.isSignedIn?.get() || false;
}

async function trySignIn() {
    // should be signed in but not, try to fix, shoudl not ever get here

    let sin = await isSignedIn();                          // also tries to set AuthObject
    if (sin) return true;
    if (!AuthObject) {
        alert("Error GDrive API reporting not authorized. Try reloading");
        return;
    }
    sin = await AuthObject.signIn();
    return sin;
}

function authorizeGapi(userInitiated = false) {
    // called from initial launch or Connect button (=> userInitiated)
    // gapi needed to access gdrive not yet loaded => this script needs to wait
    
    console.log('Loading Google API...');
    gtag('event', 'AuthInitiated', {'event_category': 'GDrive'});
    if (userInitiated) {
        // implies from button click
        gtag('event', 'AuthInitiatedByUser', {'event_category': 'GDrive'});
	alert("Passing you to Google to grant permissions. \nMake sure you actually check the box to allow file access.");
    }
    if (typeof gapi !== 'undefined')
        gapi.load('client:auth2', initClient(userInitiated));             // initialize gdrive app
    else {
        $("#loadingMessage").append(".");
        setTimeout(authorizeGapi, 500);
    }
}

async function initClient(userInitiated = false) {
    // Initializes the API client library and sets up sign-in state listeners

    console.log("Initializing GDrive client app");
    let timeout = setTimeout(checkLoginReturned, 60000);
    try {
        let signedin = await isSignedIn();
        
        if (!signedin) {
            console.log("Not signed in, need to load library");
	        await gapi.client.init({
                apiKey: APIKey,
                clientId: ClientID,
                discoveryDocs: DiscoveryDocs,
                scope: Scopes
	        });
        }

        signedin = await isSignedIn();                      // sets AuthObject
        
        if (!AuthObject) {
            alert("Error GDrive API reporting not authorized. Try reloading");
            return;
        }
        if (!signedin) {
            console.log("Attempting signin");
            signedin = await AuthObject.signIn();
        }
        clearTimeout(timeout);
        
        // Listen for sign-in state changes.
        AuthObject.isSignedIn.listen(updateSigninStatus);
        
        // connect w (or create) BTfile on GDrive and carry on
        setMetaProp('BTGDriveConnected', 'true');
        await findOrCreateBTFile(userInitiated);
        updateSigninStatus(AuthObject.isSignedIn.get(), false, userInitiated);
	}
    catch (err) {
        clearTimeout(timeout);
        updateSigninStatus(false, err);
    }
}

function checkLoginReturned() {
    // gapi.auth also sometimes doesn't return, most noteably cos of Privacy Badger    
    $('body').removeClass('waiting');
    if (AuthObject?.isSignedIn?.get()) return;
    alert("Google Authentication should have completed by now.\nIt may have failed due to extensions such as Privacy Badger or if 3rd party cookies are disallowed. Exampt braintool.org from blockers and allow cookies from accounts.google.com. If problems continues see \nbraintool.org/support");
}


/**
 * Find or initialize BT file at gdrive 
 */
var BTFileID;
async function findOrCreateBTFile(userInitiated) {
    // on launch or explicit user 'connect to Gdrive' action (=> userInitiated)
    try {
        let response = await gapi.client.drive.files.list({
            'pageSize': 1,
            'fields': "files(id, name, modifiedTime)",
            'q': "name='BrainTool.org' and not trashed"
        });
        
        const files = response?.result?.files;
        if (files && files.length > 0) {
            const file = files.find((f) => f.id == (Config.BTFileID || 0)) || files[0];
            BTFileID = file.id;
	    const driveTimestamp = Date.parse(file.modifiedTime);
            updateStatsRow(driveTimestamp);
	    if (userInitiated ||
		(Config?.BTTimestamp && (driveTimestamp > Config.BTTimestamp)))
	    {
		// if user just initiated connection but file exists ask to import
		// or if we have a recorded version thats older than disk, ask to import
		warnBTFileVersion();
		const msg = userInitiated ?
		      "BrainTool.org file already exists. Use it's contents?" :
		      "BrainTool.org file is newer than browser data. Use newer?";
		if (confirm(msg)) {
		    await refreshTable(true);
		    Config.BTTimestamp = driveTimestamp;
		    await saveBT(); // later in flow property save was overwriting w old data on upgrade, so resave here to get disk version written to memory etc.
		}
	    }
	    // Update and Save Config
	    Config.BTFileID = BTFileID;
	    Config.BTTimestamp = Config.BTTimestamp || driveTimestamp;
	    window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
	    
        } else {
            console.log('BrainTool.org file not found.');
            await createStartingBT();
        }
     }
    catch (err) {   
        let msg = "BT - error reading file list from GDrive. Check permissions and retry";
	if (err?.result?.error?.message)
	    msg += "\nGoogle says:" + err.result.error.message;
	alert(msg);
        console.log("Error in findOrCreateBTFile: ", JSON.stringify(err));
	AuthObject.signOut();
    }
}


async function createStartingBT() {
    // Upload current BTFileText to newly created BrainTool.org file on GDrive

    var metadata = {
        'name': 'BrainTool.org',                   // Filename at Google Drive
        'mimeType': 'text/plain'                   // mimeType at Google Drive
	    /*      'parents': ['### folder ID ###'],      // Folder ID at Google Drive */
    };
    
    // get accessToken, pass retry cb for if not available
    const accessToken = getAccessToken(createStartingBT);
    if (!accessToken) 
        return;

    try {
        // write BTFileText to GDrive
        var form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', BTFileText);

        let response = await fetch(
	    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version,modifiedTime'
	    , {
		method: 'POST',
		headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
		body: form,
            });
        let responseValue = await response.json();
        
        console.log("Created ", responseValue);
        BTFileID = responseValue.id;
	Config.BTFileID = BTFileID;
	Config.BTTimestamp = Date.parse(responseValue.modifiedTime);
	window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
        updateStatsRow(Config.BTTimestamp);
    }
    catch(err) {
        alert(`Error creating BT file on GDrive: [${JSON.stringify(err)}]`);
    }
}

async function getBTFile() {
    console.log('Retrieving BT file');
    if (!BTFileID) {
	alert("Something went wrong. BTFileID not set. Try restarting BrainTool");
	return;
    }
    try {
	let response = await gapi.client.drive.files.get({
            fileId: BTFileID,
            alt: 'media'
	});
        BTFileText = response.body;
	const remoteVersion = await getBTModifiedTime();
	Config.BTTimestamp = remoteVersion;
	window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
        updateStatsRow(Config.BTTimestamp);
    }
    catch(error) {
	console.error(`Could not read BT file. Google says: [${JSON.stringify(error, undefined, 2)}].\n Reauthenticating...`);
        reAuth(getBTFile);
    }
}


function getAccessToken(cb) {
    // Get token or die trying
    
    const accessToken = gapi.auth.getToken() ? gapi.auth.getToken().access_token : null;
    if (accessToken) 
        return accessToken;

    // else there's some kind of issue. retry
	console.error("BT - Error Google Access Token not available. Trying to reAuth...");
    reAuth(cb);
    return null;
}

function reAuth(callback) {
    // If access to gdrive fails try a reauth

    gapi.auth.authorize(
        {client_id: ClientID, scope: Scopes, immediate: true}
    ).then((res) => {
        if (res.status && res.status.signed_in) {
            console.error("reAuth succeeded. Continuing");
	    if (callback)
                callback();                         // try again
            refreshRefresh();
        } else {
            alert("Error in (re)authorizing GDrive access.");
        }});
    return;
}

window.LOCALTEST = false; // overwritten in test harness
var LastWriteTime = new Date();
var UnwrittenChangesTimer = null;
function unwrittenChangesP() {
    // if there's an outstanding timer we're waiting to bundle up changes
    return UnwrittenChangesTimer;
}

async function writeBTFile(cb) {
    // Notification of change that needs to be written
    
    // if its been 15 secs, just write out,
    if (new Date().getTime() > (15000 + (Config.BTTimestamp || 0)))
	try {
            return await _writeBTFile(cb);
        }
        catch(err) {
            //alert("BT - Error accessing GDrive. Toggle GDrive authorization and retry");
            console.log("Error in writeBTFile: ", JSON.stringify(err));
	    throw(err);
        }
    else
        // else set a timer, if one hasn't already been set
        if (!UnwrittenChangesTimer) {
            UnwrittenChangesTimer = setTimeout(_writeBTFile, 15000, cb);
            console.log("Holding BT file write");
        }

    async function _writeBTFile(cb) {
        // Write file contents into BT.org file on GDrive
        console.log("Writing BT file");

	// check we're not overwriting remote file
	const warn = await checkBTFileVersion();
	if (warn && !confirm("There's a newer BrainTool.org file on GDrive. Overwrite?\nNB changes have been made locally either way."))
	    return -1;
        
        gtag('event', 'Save', {'event_category': 'GDrive', 'event_label': 'Count',
                               'value': getMetaProp('BTVersion')});
        
        UnwrittenChangesTimer = null;
        if (!BTFileID) {
            alert("BTFileID not set, not saving");
            return -1;
        }
        
        if (window.LOCALTEST) return;
        if (typeof gapi === "undefined") {           // Should not happen
	    alert("BT - Error in writeBTFile. Google API not available.");
	    return -1;
        }
        const metadata = {
            'name': 'BrainTool.org',                 // Filename at Google Drive
            'mimeType': 'text/plain'                 // mimeType at Google Drive
        };
        try {
            // get accessToken, pass retry cb for if not available
            const accessToken = getAccessToken(writeBTFile);
            if (!accessToken) 
                return -1;

            let form = new FormData();
            console.log("writing BT file. accessToken = ", accessToken);
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([BTFileText], {type: 'text/plain'}));

            await fetch('https://www.googleapis.com/upload/drive/v3/files/'
                  + encodeURIComponent(BTFileID)
                  + '?uploadType=multipart&fields=id,version,modifiedTime',
                  {
                      method: 'PATCH', 
                      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                      body: form
                  }).then((res) => {
	              if (!res.ok) {
		          console.error("BT - error writing to GDrive, reauthenticating...");
		          console.log("GAPI response:\n", JSON.stringify(res));
                          reAuth(writeBTFile);
		          return -1;
	              }
                      return res.json();
                  }).then(function(val) {
                      console.log(val);
		      const mt = Date.parse(val.modifiedTime);
		      Config.BTTimestamp = mt;
		      window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
                      updateStatsRow(mt);	     // update stats when we know successful save
                      if (cb) cb();
                  }).catch(function(err) {
		      alert("BT - Error accessing GDrive.");
		      console.log("Error in writeBTFile: ", JSON.stringify(err));
		      return -1;
		  });
        }
        catch(err) {
            alert("BT - Error saving to GDrive.");
            console.log("Error in _writeBTFile: ", JSON.stringify(err));
	    return -1;
        }
    }
}

async function getBTModifiedTime() {
    // query Drive for last modified time 
    if (!BTFileID || !GDriveConnected) return 0;
    try {
	let response = await gapi.client.drive.files.get({
            fileId: BTFileID,
            fields: 'version,modifiedTime'
	});
	let result = response.result;
	return Date.parse(response.result.modifiedTime);
    } catch (e) {
	console.error('Error reading BT file version from GDrive:', JSON.stringify(e));
	if (e.status == 401) {
	    console.error('Auth expired, calling reAuth and continuing');
	    reAuth();
	}
	return 0;
    }
}

async function checkBTFileVersion() {
    // is there a newer version of the btfile on Drive?

    const localVersion = Config.BTTimestamp;
    const remoteVersion = await getBTModifiedTime();
    console.log(`Checking timestamps. local: ${localVersion}, remote: ${remoteVersion}`);
    return (remoteVersion > localVersion);
}


/*** 
 * 
 * Import/export file functions
 * 
 ***/

function importOrgFile() {
    // Import org file text from user chosen file
    
    const fr = new FileReader();
    const uploader = $("#org_upload")[0];
    if (!uploader.files.length) return;
    const file = uploader.files[0];
    fr.onload = function(){
        insertOrgFile(file.name, fr.result);                 // call parser to insert
        gtag('event', 'OrgImport', {'event_category': 'Import'});
    };
    fr.readAsText(file);
    this.value = null;                                       // needed to re-trigger if same file selected again
}


function importTabsOutliner() {
    // Import TabsOutliner json from user chosen file
    const fr=new FileReader();
    const uploader = $("#to_upload")[0];
    if (!uploader.files.length) return;
    const file = uploader.files[0];
    fr.onload=function(){
        const orgForTabsO = tabsToBT(fr.result);
        insertOrgFile(file.name, orgForTabsO);
        gtag('event', 'TOImport', {'event_category': 'Import'});
    };
    fr.readAsText(file);
    this.value = null;                                       // needed to re-trigger if same file selected again
}

function exportOrgFile(event) {
    // Import an org file from file
    let filetext = BTAppNode.generateOrgFile();
    filetext = 'data:text/plain;charset=utf-8,' + encodeURIComponent(filetext);
    $("#org_export").attr('href', filetext);
    gtag('event', 'OrgExport', {'event_category': 'Export'});
}
