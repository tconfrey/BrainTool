/*** 
 * 
 * Handles gdrive file storage interactions.
 * 
 ***/
'use strict';

const gDriveFileManager = (() => {

    async function saveBT(BTFileText) {
        // Save org version of BT Tree to gdrive.
        try {
            let sin = await isSignedIn();
            if (!sin)
                sin = await trySignIn();
            if (sin) {
                writeBTFile(BTFileText);
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
            GDriveConnected = true;
            try {
                await findOrCreateBTFile(userInitiated);
            }
            catch (e){
                console.warn("Error in initClient:", e.toString());
                return;
            }
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
        let response;
        try {
            response = await gapi.client.drive.files.list({
                'pageSize': 1,
                'fields': "files(id, name, modifiedTime)",
                'q': "name='BrainTool.org' and not trashed"
            });   
        }
        catch (err) {   
            let msg = "BT - error reading file list from GDrive. Check permissions and retry";
	        if (err?.result?.error?.message)
	            msg += "\nGoogle says:" + err.result.error.message;
	        alert(msg);
            console.log("Error in findOrCreateBTFile: ", JSON.stringify(err));
	        AuthObject.signOut();
            return;
        }
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
		              "BrainTool.org file already exists. Use its contents?" :
		              "BrainTool.org file is newer than browser data. Use newer?";
		        if (confirm(msg)) {
                    try {
		                await refreshTable(true);
		                Config.BTTimestamp = driveTimestamp;
                        
                        // later in flow property save was overwriting w old data on upgrade,
                        // so resave here to get disk version written to memory etc.
		                if (BTFileText) await gDriveFileManager.saveBT(BTFileText); 
                    }
                    catch (err) {
                        alert("Error parsing BrainTool.org file from GDrive:\n" + JSON.stringify(err));
                        throw(err);
                    }
		        }
	        }
	        // Update and Save Config
	        Config.BTFileID = BTFileID;
	        Config.BTTimestamp = Config.BTTimestamp || driveTimestamp;
	        window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
	        
        } else {
            console.log('BrainTool.org file not found, creating..');
            await createStartingBT();
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
	        if (callback) callback();                         // try again
            } else {
                alert("Error in (re)authorizing GDrive access.");
            }});
        return;
    }

    window.LOCALTEST = false; // overwritten in test harness
    var UnwrittenChangesTimer = null;
    var SaveUnderway = false;
    function savePendingP() {
        // Are we in the middle of saving, or just finished and bundling any subsequent changes
        return SaveUnderway || UnwrittenChangesTimer;
    }

    async function writeBTFile(BTFileText) {
        // Notification of change to save. Don't write more than once every 15 secs.
        // If timer is already set then we're waiting for 15 secs so just return.
        // If a save is not underway and its been 15 secs call _write to save
        // Else set a timer if not already set
        
        if (UnwrittenChangesTimer) {
            console.log("writeBTFile: change already outstanding, just exiting");
            return;
        }
        if (!SaveUnderway && new Date().getTime() > (15000 + (Config.BTTimestamp || 0))) {
	        try {
                return await _writeBTFile();
            }
            catch(err) {
                //alert("BT - Error accessing GDrive. Toggle GDrive authorization and retry");
                console.log("Error in writeBTFile: ", JSON.stringify(err));
	            throw(err);
            }
        } else {
            // else set a timer, if one hasn't already been set
            if (!UnwrittenChangesTimer) {
                UnwrittenChangesTimer = setTimeout(_writeBTFile, 15000);
                console.log("Holding BT file write");
            }
        }

        async function _writeBTFile() {
            // Write file contents into BT.org file on GDrive
            // NB Have to be careful to keep SaveUnderway up to date on all exit paths
            console.log("Writing BT file");
            UnwrittenChangesTimer = null;

            if (!BTFileID) {
                alert("BTFileID not set, not saving");
                return -1;
            }
            if (typeof gapi === "undefined") {           // Should not happen
	            alert("BT - Error in writeBTFile. Google API not available.");
	            return -1;
            }
            
	        // check we're not overwriting remote file
	        const warn = await checkBTFileVersion();
	        if (warn && !confirm("There's a newer BrainTool.org file on GDrive. Overwrite?\nNB changes have been made locally either way."))
	            return -1;

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
                form.append('metadata', new Blob([JSON.stringify(metadata)],
                                                 { type: 'application/json' }));
                form.append('file', new Blob([BTFileText], {type: 'text/plain'}));

                SaveUnderway = true;

                await fetch('https://www.googleapis.com/upload/drive/v3/files/'
                            + encodeURIComponent(BTFileID)
                            + '?uploadType=multipart&fields=id,version,modifiedTime',
                            {
                                method: 'PATCH', 
                                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                                body: form
                            }).then((res) => {
                                SaveUnderway = false;
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
                            }).catch(function(err) {
                                SaveUnderway = false;
		                        alert("BT - Error accessing GDrive.");
		                        console.log("Error in writeBTFile: ", JSON.stringify(err));
		                        return -1;
		                    });
            }
            catch(err) {
                SaveUnderway = false;
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
            updateSyncSettings(true);            // common fileManager fn to show connectivity info
            GDriveConnected = true;
            
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
            updateSyncSettings(false);
            GDriveConnected = false;
        }
    }

    return {
        saveBT: saveBT,
        authorizeGapi: authorizeGapi,
        checkBTFileVersion: checkBTFileVersion,
        savePendingP: savePendingP,
        getBTFile: getBTFile
    };
})();
