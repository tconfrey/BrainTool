/***
 *
 * Handles gdrive file storage interactions.
 *
 ***/
'use strict';
var gapiLoadOkay, gapiLoadFail, gisLoadOkay, gisLoadFail

const gDriveFileManager = (() => {
    const gapiLoadPromise = new Promise((resolve, reject) => {
        gapiLoadOkay = resolve;
        gapiLoadFail = reject;
    });
    const gisLoadPromise = new Promise((resolve, reject) => {
        gisLoadOkay = resolve;
        gisLoadFail = reject;
    });

    // Array of API discovery doc URLs for APIs used by the quickstart
    var DiscoveryDocs = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

    // Authorization scopes required by the API;
    // Need to be able to create/read/write BTFile
    var Scopes = 'https://www.googleapis.com/auth/drive.file';
    //  Turns out query is supported by .file for app-created files and make approval simpler.
    // https://www.googleapis.com/auth/drive.metadata.readonly';
    var tokenClient = null;
    async function getToken(err, shouldThrowError = false, callback) {
        if ((getAccessToken() === null) || (err?.result.error.code == 401 || (err?.result.error.code == 403) &&
            (err?.result.error.status == "PERMISSION_DENIED"))) {
            // The access token is missing, invalid, or expired, or not yet existed, prompt for user consent to obtain one.
            await new Promise((resolve, reject) => {
                try {
                    // Settle this promise in the response callback for requestAccessToken()
                    tokenClient.callback = (resp) => {
                        if (resp.error !== undefined) {
                            reject(resp);
                        }
                        // GIS has automatically updated gapi.client with the newly issued access token.
                        console.log('gapi.client access token: ' + JSON.stringify(gapi.client.getToken()));
                        resolve(resp);
                        setMetaProp('BTGDriveConnected', 'true');
                        GDriveConnected = true;
                        // Todo: handle userInitiated parameter
                        updateSigninStatus(true, false);
                        if (callback)
                            callback()
                    };
                    tokenClient.requestAccessToken();
                } catch (err) {
                    updateSigninStatus(false, err)
                    reject(err)
                    console.log(err)
                }
            });
        } else {
            // todo: check if err should be passed as second argument here?
            updateSigninStatus(false)
            // Errors unrelated to authorization: server errors, exceeding quota, bad requests, and so on.
            if (shouldThrowError)
                throw new Error(err);
        }
    }

    /**
     * This function replaces AuthObject.signOut
     */
    function revokeToken() {
        let cred = gapi.client.getToken();
        if (cred !== null) {
            google.accounts.oauth2.revoke(cred.access_token, () => {console.log('Revoked: ' + cred.access_token)});
            gapi.client.setToken('');
            GDriveConnected = false;
        }
    }
    /**
     * This is a replacement of previous gDriveFileManager.reAuth function
     * @param func - a function or a function generator
     * @param {any[]} args - parameters of the function
     * @returns {Promise<any>}
     * @param {boolean} isFunctionGenerated - true if this is a higher-order function that generates the main function.
     * This handles the case where the function is method of Gapi that may change after a token is granted.
     */
    async function getTokenAndRetryFunctionAfterAuthError(func, args, isFunctionGenerated = false) {
        let func_ = func;
        try {
            if (isFunctionGenerated) func_ = func()
            return func_(...args)
        } catch (err) {
            await getToken(err, true)
            if (isFunctionGenerated) func_ = func()
            return func_(...args)
        }
    }
    async function saveBT(BTFileText) {
        try {
            // Save org version of BT Tree to gdrive.
            await getTokenAndRetryFunctionAfterAuthError(writeBTFile, [BTFileText]);
        } catch(err) {
            // TODO: haven't figure out where to put the following commented error handler yet
            // $("#gdrive_auth").show();
            // GDriveConnected = false;
            // alert("Can't connect to GDrive. Changes saved locally. Try re-auth (under Options) or restarting");
            alert(`Changes saved locally. GDrive connection failed. Google says:\n${JSON.stringify(err)}`);
            console.log("Error in saveBT:", err);
        }
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
        // Init client will async flow will ensure that gapi is loaded
        (async () => await initClient(userInitiated))()
    }

    async function initClient(userInitiated = false) {
        console.log("Initializing GDrive client app");
        try {
            // First, load and initialize the gapi.client
            await gapiLoadPromise;
            await new Promise((resolve, reject) => {
                // NOTE: the 'auth2' module is no longer loaded.
                gapi.load('client', {callback: resolve, onerror: reject});
            });
            await gapi.client.init({
                // NOTE: OAuth2 'scope' and 'client_id' parameters have moved to initTokenClient().
            }).then(function() {  // Load the Calendar API discovery document.
                gapi.client.load(DiscoveryDocs[0])
            });

            // Now load the GIS client
            await gisLoadPromise;
            await new Promise((resolve, reject) => {
                try {
                    // tokenClient = google.accounts.oauth2.initTokenClient({
                    //     client_id: configManager.getProp('CLIENT_ID'),
                    //     scope: Scopes,
                    //     prompt: '',
                    //     callback: '',  // defined at request time in await/promise scope.
                    // });
                    // Sample Google Cloud project of toannc, will delete this commented code later
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: '983923593855-0qe7mbkqe76266h417g0fi983h40t1gj.apps.googleusercontent.com',
                        scope: Scopes, //'https://www.googleapis.com/auth/calendar.readonly',
                        prompt: '',
                        callback: '',  // defined at request time in await/promise scope.
                    });
                    resolve();
                } catch (err) {
                    reject(err);
                    return false;
                }
            });
            GDriveConnected = true;
            // toannc: updateSigninStatus is not done here, but instead moved into gDriveFileManager.getToken()
            await findOrCreateBTFile(userInitiated)
        } catch (e){
            // toannc: updateSigninStatus is not done here, but instead moved into gDriveFileManager.getToken()
            console.warn("Error in initClient:", e.toString());
            return false;
        }
    }
    function checkLoginReturned() {
        // gapi.auth also sometimes doesn't return, most noteably cos of Privacy Badger
        // toannc: now GIS is used instead of gapi.auth, so this function might not be needed
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
            response = await getTokenAndRetryFunctionAfterAuthError(() => gapi.client.drive?.files.list, [{
                'pageSize': 1,
                'fields': "files(id, name, modifiedTime)",
                'q': "name='BrainTool.org' and not trashed"
            }], true);
        }
        catch (err) {
            let msg = "BT - error reading file list from GDrive. Check permissions and retry";
            if (err?.result?.error?.message)
                msg += "\nGoogle says:" + err.result.error.message;
            alert(msg);
            console.log("Error in findOrCreateBTFile: ", JSON.stringify(err));
            // revokeToken()
            return;
        }
        const files = response?.result?.files;
        if (files && files.length > 0) {
            const savedFileId = configManager.getProp('BTFileID');
            const file = files.find((f) => f.id == (savedFileId || 0)) || files[0];
            BTFileID = file.id;
            const driveTimestamp = Date.parse(file.modifiedTime);
            updateStatsRow(driveTimestamp);
            if (userInitiated ||
                (configManager.getProp('BTTimestamp') &&
                    (driveTimestamp > configManager.getProp('BTTimestamp')))
            )
            {
                // if user just initiated connection but file exists ask to import
                // or if we have a recorded version thats older than disk, ask to import
                const msg = userInitiated ?
                    "BrainTool.org file already exists. Use its contents?" :
                    "BrainTool.org file is newer than browser data. Use newer?";
                if (confirm(msg)) {
                    try {
                        await refreshTable(true);
                        configManager.setProp('BTTimestamp', driveTimestamp);
                        messageManager.removeWarning(); // warning may have been set, safe to remove

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
            // Update and Save FileID and save timestamp
            configManager.setProp('BTFileID', BTFileID);
            configManager.getProp('BTTimestamp') ||
            configManager.setProp('BTTimestamp', driveTimestamp);

        } else {
            console.log('BrainTool.org file not found, creating..');
            await createStartingBT();
        }
    }


    async function createStartingBT() {
        // Upload current BTFileText to newly created BrainTool.org file on GDrive

        // get accessToken, pass retry cb for if not available
        const accessToken = getAccessToken(createStartingBT);
        if (!accessToken)
            return;

        var metadata = {
            'name': 'BrainTool.org',                   // Filename at Google Drive
            'mimeType': 'text/plain'                   // mimeType at Google Drive
            /*      'parents': ['### folder ID ###'],      // Folder ID at Google Drive */
        };

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
                }
            );
            let responseValue = await response.json();

            console.log("Created ", responseValue);
            BTFileID = responseValue.id;
            configManager.setProp('BTFileID', BTFileID);
            const timestamp = Date.parse(responseValue.modifiedTime);
            configManager.setProp('BTTimestamp', timestamp);
            updateStatsRow(timestamp);
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
            configManager.setProp('BTTimestamp', remoteVersion);
        }
        catch(error) {
            console.error(`Could not read BT file. Google says: [${JSON.stringify(error, undefined, 2)}].\n Reauthenticating...`);
            // Todo: check if this could cause infinite loop
            getToken(getBTFile);
        }
    }


    function getAccessToken(cb) {
        // Get token or die trying
        const accessToken = gapi.client.getToken()?.access_token ? gapi.client.getToken().access_token : null;
        if (accessToken)
            return accessToken;

        // else there's some kind of issue. retry
        console.error("BT - Error Google Access Token not available. Trying to reAuth...");
        if (cb)
            getToken(undefined, undefined, cb)
        return null;
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
        if (!SaveUnderway && new Date().getTime() > (15000 + (configManager.getProp('BTTimestamp') || 0))) {
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
            console.log("Writing BT file to gdrive");
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
                        // reAuth(writeBTFile);
                        return -1;
                    }
                    return res.json();
                }).then(function(val) {
                    console.log(val);
                    const mt = Date.parse(val.modifiedTime);
                    configManager.setProp('BTTimestamp', mt);
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
                getToken(e)
            }
            return 0;
        }
    }

    async function checkBTFileVersion() {
        // is there a newer version of the btfile on Drive?

        const localVersion = configManager.getProp('BTTimestamp');
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
                saveBT();                                       // save to record it's now synced
            }
            if (userInitiated) {
                saveBT();                                       // also save if newly authorized
                alert('GDrive connection established. See Actions to disable.');
            }
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
