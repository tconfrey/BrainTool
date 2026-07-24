/***
 *
 * Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/***
 *
 * Handles gdrive file storage interactions.
 *
 ***/
'use strict';

import { getProp, setProp } from './configManager.js';
import { t } from './i18n.js';

// Callback for fileManager state getters/setters - registered after fileManager loads
let setGDriveConnectedCallback = null;
let setBTFileTextCallback = null;
let getBTFileTextCallback = null;
let updateStatsRowCallback = null;
let updateSyncSettingsCallback = null;
let GDriveConnected = false;

// Callback for UI functions - registered after UI loads
let refreshTableCallback = null;

function registerFileManager(callbacks) {
    // Called by fileManager to register state getter/setter functions
    setGDriveConnectedCallback = (value) => {
        GDriveConnected = value;
        callbacks.setGDriveConnected(value);
    };
    setBTFileTextCallback = callbacks.setBTFileText;
    getBTFileTextCallback = callbacks.getBTFileText;
    updateStatsRowCallback = callbacks.updateStatsRow;
    updateSyncSettingsCallback = callbacks.updateSyncSettings;
}

function registerUI(callbacks) {
    // Called by fileManager to register UI functions
    refreshTableCallback = callbacks.refreshTable;
}

var gapiLoadOkay, gapiLoadFail, gisLoadOkay, gisLoadFail

// Module-level promises and state (was inside IIFE)
const gapiLoadPromise = new Promise((resolve, reject) => {
// See fileManager where apis.google.com etc are loaded, gapiLoadOkay is called from there this ensuring the lib is loaded
// when the promise is resolved.
gapiLoadOkay = resolve;
gapiLoadFail = reject;
});
const gisLoadPromise = new Promise((resolve, reject) => {
gisLoadOkay = resolve;
gisLoadFail = reject;
});

// URL of the api we need to load
var DiscoveryDocs = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Authorization scopes required by the API;
// Need to be able to create/read/write BTFile
var Scopes = 'https://www.googleapis.com/auth/drive.file';
var tokenClient = null;

async function initClient(userInitiated = false) {

    console.log("Initializing GDrive client app");
    let timeout = setTimeout(checkLoginReturned, 60000);
    try {
        // First, load and initialize the gapi.client
        await gapiLoadPromise;
        await new Promise((resolve, reject) => {
            gapi.load('client', {callback: resolve, onerror: reject});
        });
        await gapi.client.init({
            apiKey: getProp('API_KEY'),
            discoveryDocs: DiscoveryDocs
        }); 
        await gapi.client.load(DiscoveryDocs[0]);  // Load the Drive API

        // Now load the GIS client. tokenClient will be used to obtain the access token
        await gisLoadPromise;
        await new Promise((resolve, reject) => {
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: getProp('CLIENT_ID'), 
                    scope: Scopes,
                    prompt: 'consent',          // Need to ask on initial connection cos token expires
                    callback:  '',              // defined at request time in await/promise scope.
                });
                resolve();
            } catch (err) {
                reject(err);
            }
        });
        await findOrCreateBTFile(userInitiated);
    } catch (e){
        console.warn("Error in initClient:", e.toString());
        return false;
    }
}

const shouldUseGoogleDriveApi = () => {
    // or alternative fetch via url
    // return false;
    return gapi.client.drive !== undefined;
}

/**
 * A wrapper function for connecting gapi using fetch.
 * @param url
 * @returns {Promise<any>}
 * @param {boolean} jsonOrText - true if we want response.json(), other response.text() will be returned.
 */
const fetchWrapper = async (url, jsonOrText = true) => {
    
    await getAccessToken();
    // Even if token exists, it might still be expired, so the wrapper function is needed
    return getTokenAndRetryFunctionAfterAuthError(fetch, [url,{
        headers: {
            Authorization: `Bearer ${getAccessToken()}`
        }
    }]).then(resp => handleFetchResponse(resp, jsonOrText))
}
const handleFetchResponse = (response, jsonOrText=true) => {
    if (response.ok) {
        return jsonOrText ? response.json() : response.text(); // or response.text() for plain text
    } else {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
}

async function getAccessToken(forceAuth = true) {
    // Get token, optional re-auth if expired
    if (gapi.client.getToken()?.access_token) return gapi.client.getToken()?.access_token;
    if (!forceAuth) return false;

    // else token has expired or there's some kind of issue. retry and reset signinstatus
    console.warn("BT - Error Google Access Token not available. Trying to reAuth...");
    const token = await renewToken();
    if (BTFileID) updateSigninStatus(gapi.client.getToken()?.access_token !== undefined); // don't update if BTFile has not yet been read
    return token;
}

async function renewToken() {
    // The access token is missing, invalid, or expired, or not yet existed, prompt for user consent to obtain one.
    await new Promise((resolve, reject) => {
        try {
            // Settle this promise in the response callback for requestAccessToken()
            tokenClient.callback = (resp) => {
                if (resp.error !== undefined) reject(resp);
                
                // GIS has automatically updated gapi.client with the newly issued access token.
                console.log('gapi.client access token: ' + JSON.stringify(gapi.client.getToken()));
                resolve(resp);
            };
            tokenClient.error_callback = (err) => {
                console.error("Error requesting access token in renewToken: ", JSON.stringify(err));
                updateSigninStatus(false, err);
                reject(err);
            }
            let rsp = tokenClient.requestAccessToken({'prompt': ''});       // ideally don't prompt user again
            console.log("Requesting token: " + JSON.stringify(rsp));
        } catch (err) {
            updateSigninStatus(false);
            reject(err);
            console.log("Error renewing token: " + JSON.stringify(err));
        }
    });
}

async function renewTokenAndRetry(cb) {
    // The access token is missing, invalid, or expired, or not yet existed, prompt for user consent to obtain one.
    // might be a callback to call after token is renewed
    if (confirm(t('alertGdriveToken'))) {
        try {
            await renewToken();
            cb && cb();
        } catch (error) {
            // Clean up, aisle five!!! 
            console.error("Failed to renew token: ", error);
            updateSigninStatus(false, error);
        }
    } else {
        updateSigninStatus(false);
    }
}

/**
 * @param func - a function or a function generator
 * @param {any[]} args - parameters of the function
 * @returns {Promise<any>}
 * @param {boolean} isFunctionGenerated - true if this is a higher-order function that generates the main function.
 * This handles the case where the function is method of Gapi that may change after a token is granted.
 * Called from connnectAndFindFiles and the fetch wrapper
 */
async function getTokenAndRetryFunctionAfterAuthError(func, args, isFunctionGenerated = false) {
    let func_ = func;
    try {
        await getAccessToken()
        if (isFunctionGenerated) func_ = func()
        return func_(...args)
    } catch (err) {
        console.error("Error in getTokenAndRetryFunctionAfterAuthError: ", JSON.stringify(err));
    }
}

function revokeToken() {
    // Not actually ever needed, but here for completeness and testing
    let cred = gapi.client.getToken();
    if (cred !== null) {
        google.accounts.oauth2.revoke(cred.access_token, () => {console.log('Revoked: ' + cred.access_token)});
        gapi.client.setToken('');
        updateSigninStatus(false);
    }
}

async function saveBT(fileText, forceAuth = false) {
    if (setBTFileTextCallback) {
        setBTFileTextCallback(fileText);
    }
    try {
        // Save org version of BT Tree to gdrive.
        const authorized = await getAccessToken(forceAuth);
        if (authorized) writeBTFile(fileText);
    } catch(err) {
        alert(t('alertGdriveLocalSave', { err: JSON.stringify(err) }));
        updateSigninStatus(false);
        console.log("Error in saveBT:", err);
    }
}
async function authorizeGapi(userInitiated = false) {
    // called from initial launch or Connect button (=> userInitiated)
    // gapi needed to access gdrive not yet loaded => this script needs to wait

    if (getProp('BTManagerHome') == 'SIDEPANEL') {
        alert(t('alertGdriveSidepanel'));
        return null;
    }
    console.log('Loading Google API...');
    gtag('event', 'auth_initiated', {'event_category': 'GDrive'});
    if (userInitiated) {
        // implies from button click
        gtag('event', 'auth_initiated_by_user', {'event_category': 'GDrive'});
        alert(t('alertGdriveAuth'));
    }
    // Init client will async flow will ensure that gapi is loaded
    await initClient(userInitiated);
}

function checkLoginReturned() {
    // gapi.auth also sometimes doesn't return, most noteably cos of Privacy Badger
    $('body').removeClass('waiting');
    if (GDriveConnected) return;
    alert(t('alertGdriveAuthTimeout'));
}

/**
 * Find or initialize BT file at gdrive
 */
var BTFileID;
async function findOrCreateBTFile(userInitiated) {
    // on launch or explicit user 'connect to Gdrive' action (=> userInitiated)

    const files  = await connectAndFindFiles();
    if (!files?.length) {
        console.log('BrainTool.org file not found, creating..');
        await createStartingBT();
        return;
    }

    // One or more BrainTool.org files found, get the one that matches our BTFileID, or just the first
    const savedFileId = getProp('BTFileID');
    const file = files.find((f) => f.id == (savedFileId || 0)) || files[0];
    BTFileID = file.id;
    const driveTimestamp = Date.parse(file.modifiedTime);
    const newer = driveTimestamp > (getProp('BTTimestamp') || 0);
    if (userInitiated || newer) {
        // if user just initiated connection but file exists ask to import
        // or if we have a recorded version thats older than disk, ask to import
        const driveDate = new Date(driveTimestamp).toLocaleString();
        const msg = userInitiated
            ? t('confirmGdriveExists', { date: driveDate })
            : t('confirmGdriveNewer');
        if (confirm(msg)) {
            try {
                if (refreshTableCallback) await refreshTableCallback(true);
                setProp('BTTimestamp', driveTimestamp);
                
                // later in flow property save was overwriting w old data on upgrade,
                // so resave here to get disk version written to memory etc.
                const fileText = getBTFileTextCallback ? getBTFileTextCallback() : '';
                if (fileText) await gDriveFileManager.saveBT(fileText);
            }
            catch (err) {
                alert(t('alertGdriveParse', { err: JSON.stringify(err) }));
                throw(err);
            }
        }
    }
    // Update and Save FileID and save timestamp
    updateSigninStatus(true);
    updateStatsRowCallback && updateStatsRowCallback(driveTimestamp);
    setProp('BTFileID', BTFileID);
    getProp('BTTimestamp') || setProp('BTTimestamp', driveTimestamp);
} 

async function connectAndFindFiles() {
    // Connect to Drive api and search for and return potential BT files
    let response, files;
    try {
        if (shouldUseGoogleDriveApi()) {
            response = await getTokenAndRetryFunctionAfterAuthError( gapi.client.drive?.files.list, [{
                'pageSize': 1,
                'fields': "files(id, name, modifiedTime)",
                'q': "name='BrainTool.org' and not trashed"
            }]);
            files = response?.result?.files;
        }
        else {
            // Connect to GAPI using fetch as a backup method
            const url = "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name,modifiedTime)&q=name='BrainTool.org' and not trashed";
            files = await fetchWrapper(url).then(resp => resp.files);
        }
    }
    catch (err) {
        const msg = err?.result?.error?.message
            ? t('alertGdriveListErrorGoogle', { msg: err.result.error.message })
            : t('alertGdriveListError');
        alert(msg);
        console.log("Error in findOrCreateBTFile: ", JSON.stringify(err));
        updateSigninStatus(false);
        revokeToken();
        return;
    }
    setGDriveConnectedCallback && setGDriveConnectedCallback(true);
    return files;
}

async function createStartingBT() {
    // Upload current BTFileText to newly created BrainTool.org file on GDrive

    // get accessToken, pass retry cb for if not available
    const accessToken = await getAccessToken();

    var metadata = {
        'name': 'BrainTool.org',                   // Filename at Google Drive
        'mimeType': 'text/plain'                   // mimeType at Google Drive
    };

    try {
        // write BTFileText to GDrive
        var form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', getBTFileTextCallback ? getBTFileTextCallback() : '');

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
        setProp('BTFileID', BTFileID);
        const timestamp = Date.parse(responseValue.modifiedTime);
        setProp('BTTimestamp', timestamp);
        updateStatsRowCallback && updateStatsRowCallback(timestamp);
        updateSigninStatus(true);
    }
    catch(err) {
        alert(t('alertGdriveCreate', { err: JSON.stringify(err) }));
    }
}

async function getBTFile() {
    console.log('Retrieving BT file');
    if (!BTFileID) {
        alert(t('alertGdriveNoId'));
        return;
    }
    try {
        await getAccessToken();
        let fileText;
        if (shouldUseGoogleDriveApi()) {
            fileText = await gapi.client.drive.files.get({
                fileId: BTFileID,
                alt: 'media'
            }).then(resp => resp.body);
        } else {
            const url = `https://www.googleapis.com/drive/v3/files/${BTFileID}?alt=media`
            fileText = await fetchWrapper(url, false)
        }
        if (setBTFileTextCallback) {
            setBTFileTextCallback(fileText);
        }
        const remoteVersion = await getBTModifiedTime();
        setProp('BTTimestamp', remoteVersion);
    }
    catch(error) {
        console.error(`Could not read BT file. Google says: [${JSON.stringify(error, undefined, 2)}].`);
    }
}

window.LOCALTEST = false; // overwritten in test harness
var UnwrittenChangesTimer = null;
var SaveUnderway = false;
function savePendingP() {
    // Are we in the middle of saving, or just finished and bundling any subsequent changes
    return SaveUnderway || UnwrittenChangesTimer;
}

async function writeBTFile() {
    // Notification of change to save. Don't write more than once every 15 secs.
    // If timer is already set then we're waiting for 15 secs so just return.
    // If a save is not underway and its been 15 secs call _write to save
    // Else set a timer if not already set

    if (UnwrittenChangesTimer) {
        console.log("writeBTFile: change already outstanding, just exiting");
        return;
    }
    if (!SaveUnderway && new Date().getTime() > (15000 + (getProp('BTTimestamp') || 0))) {
        try {
            return await _writeBTFile();
        }
        catch(err) {
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
}

async function _writeBTFile() {
    // Write file contents into BT.org file on GDrive
    // NB Have to be careful to keep SaveUnderway up to date on all exit paths
    console.log("Writing BT file to gdrive");
    UnwrittenChangesTimer = null;
    
    BTFileID = BTFileID || getProp('BTFileID');
    if (!BTFileID) {
        alert(t('alertGdriveNoIdSave'));
        return;
    }
    
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Access token is not available");
        
        // check we're not overwriting remote file
        const warn = await checkBTFileVersion();
        if (warn && !confirm(t('confirmGdriveOverwrite')))
        return;
        
        // go about saving the file
        SaveUnderway = true;
        const metadata = {
            'name': 'BrainTool.org',                 // Filename at Google Drive
            'mimeType': 'text/plain'                 // mimeType at Google Drive
        };
        let form = new FormData();
        console.log("writing BT file. accessToken = ", accessToken);
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([getBTFileTextCallback ? getBTFileTextCallback() : ''], {type: 'text/plain'}));
        
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
                console.error("BT - error writing to GDrive");
                console.log("GAPI response:\n", JSON.stringify(res));
                return;
            }
            return res.json();
        }).then(function(val) {
            console.log(val);
            if (!val) 
                throw new Error('access token exists, but upload failed. Probably need to renew token and retry');
            const mt = Date.parse(val.modifiedTime);
            setProp('BTTimestamp', mt);
            updateStatsRowCallback && updateStatsRowCallback(mt);	     // update stats when we know successful save
        }).catch(function(err) {
            SaveUnderway = false;
            console.log("Error in writeBTFile: ", JSON.stringify(err));
            renewTokenAndRetry(_writeBTFile);
            return;
        });
    }
    catch(err) {
        SaveUnderway = false;
        alert(t('alertGdriveSaveErr'));
        console.log("Error in _writeBTFile: ", JSON.stringify(err));
        return;
    }
}


async function getBTModifiedTime() {
    // query Drive for last modified time 
    try {
        if (!BTFileID || !GDriveConnected) throw new Error("BTFileID not set or GDrive not connected");
        const token = await getAccessToken(false);
        if (!token) {
            console.log("GDrive token expired or not available, returning 0 as modified time.");
            return 0;
        }
        let response;
        if (shouldUseGoogleDriveApi()) {
            response = await gapi.client.drive.files.get({
                fileId: BTFileID,
                fields: 'version,modifiedTime'
            }).then(resp => resp.result);
        } else {
            const url = `https://www.googleapis.com/drive/v3/files/${BTFileID}?fields=version,modifiedTime`
            response = await fetchWrapper(url)
        }
        return Date.parse(response.modifiedTime);
    } catch (e) {
        const msg = e.message || e.result.error.message;
        console.error('Error reading BT file version from GDrive:', msg);
        return 0;
    }
}

async function checkBTFileVersion() {
    // is there a newer version of the btfile on Drive?

    const localVersion = getProp('BTTimestamp');
    const remoteVersion = await getBTModifiedTime();
    console.log(`Checking timestamps. local: ${localVersion}, remote: ${remoteVersion}`);
    return (remoteVersion > localVersion);
}

async function updateSigninStatus(signedIn, error=false, userInitiated = false) {
    // CallBack on GDrive signin state change
    let alertText;
    if (error) {
        alertText = "Error Authenticating with Google. Google says:\n'";
        alertText += (error.message) ? error.message : JSON.stringify(error);
        alertText += "'\n1) Restart \n2) Turn GDrive sync back on. \nOr if this is a cookie issue be aware that Google uses cookies for authentication.\n";
        alertText += "Go to 'chrome://settings/cookies' and make sure third-party cookies and popups are allowed for accounts.google.com and braintool.org. If it continues see \nbraintool.org/support";
    } else { 
    if (signedIn) {
        gtag('event', 'auth_complete', {'event_category': 'GDrive'});
        if (userInitiated) {
            saveBT();                                       // also save if newly authorized
            alertText = 'GDrive connection established. See Actions to disable.';
        }
    } else {
        alertText = "GDrive connection lost";
        }
    }
    alertText && alert(alertText);

    updateSyncSettingsCallback && updateSyncSettingsCallback(signedIn);            // common fileManager fn to show connectivity info
    setGDriveConnectedCallback && setGDriveConnectedCallback(signedIn);
    setProp('BTGDriveConnected', signedIn);
}

function haveAuth() {
// return true if we have a token
return gapi.client.getToken()?.access_token !== undefined;
}

// Export gDriveFileManager API
const gDriveFileManager = {
saveBT,
authorizeGapi,
checkBTFileVersion,
savePendingP,
getBTFile,
revokeToken,
renewToken,
haveAuth,
getAccessToken,
getBTModifiedTime, 
BTFileID,
registerFileManager,
registerUI,
gapiLoadOkay,
gapiLoadFail,
gisLoadOkay,
gisLoadFail
};

export { gDriveFileManager };
