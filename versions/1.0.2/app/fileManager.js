/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/*** 
 * 
 * Handles local and gdrive file storage interactions. Mostly just a facade on 
 * localFileManager and gDriveFileManager
 * 
 ***/
var GDriveConnected = false;
var LocalFileConnected = false;

function syncEnabled() {
    // Is there a backing store file, local or gdrive
    return GDriveConnected || LocalFileConnected;
}

async function handleStartupFileConnection() {
    // If there's a backing store file, local or GDrive, handle reconnection etc

    let launchType = 'unsynced_launch';

    // Handle GDrive connection
    if (configManager.getProp('BTGDriveConnected')) {
        await authorizeGAPI(false);
        launchType = 'gdrive_launch';
    }

    // Handle Local connection/permissions
    const local = await localFileManager.reestablishLocalFilePermissions();
    if (local) {
        launchType = 'local_file_launch';
        updateSyncSettings(true, await localFileManager.getFileLastModifiedTime());
    }

    // fire off tracking event
    gtag('event', launchType, {'event_category': 'General'});
}

async function saveBT(localOnly = false, newContent = true) {
    // Save org version of BT Tree to local storage and potentially gdrive.
    // localOnly => don't save to GDrive backing and don't send gtag stat. Used when folding/unfolding
    // newContent => true if we're saving new content, false if just saving folded state
    // Don't force GDrive re-auth if we're just folding/unfolding

    console.log(`Writing BT to ${localOnly ? 'local only' : 'local + any remote'} Storage`);

    // BTVersion is incremented on each content change
    let currentBTVersion = parseInt(configManager.getProp('BTVersion')) || 1;
    newContent && configManager.setProp('BTVersion', currentBTVersion + 1);

    BTFileText = BTAppNode.generateOrgFile();
    if (window.LOCALTEST) return;

    window.postMessage({'function': 'localStore', 'data': {'BTFileText': BTFileText}});
    if (localOnly) return;                       // return if we're just remember folded state

    setTimeout(brainZoom, 1000);                 // swell the brain
    console.log("Recording save event and writing to any backing store");
    if (InitialInstall) {
        gtag('event', 'first_save', {'event_category': 'General'});
        InitialInstall = false;
    }

    // also save to GDrive or local file if connected and drop an event
    let event = "local_storage_save";
    if (GDriveConnected) {
        await gDriveFileManager.saveBT(BTFileText, newContent);     // if !newContent, don't force re-auth
        event = "gdrive_save";
    } else if (LocalFileConnected) {
        await localFileManager.saveBT(BTFileText);
        event = "local_file_save";
    }
    updateStatsRow();                            // update num cards etc
    messageManager.removeWarning();              // remove stale warning if any
    gtag('event', event, {'event_category': 'Save', 'event_label': 'NumNodes', 'value': AllNodes.length});
    configManager.incrementStat('BTNumSaves');
}

async function authorizeLocalFile() {
    // Called from user action button to allow filesystem access and choose BT folder
    const success = await localFileManager.authorizeLocalFile();
    if (!success) return false;

    configManager.setProp('BTGDriveConnected', false);
    configManager.setProp('BTTimestamp', await localFileManager.getFileLastModifiedTime());
    updateSyncSettings(true);
    alert('Local file sync established. See Actions to disable.');
    return true;
}

function authorizeGAPI(userInitiated) {
    // load apis and pass thru to gdrive file manager
    if (!window.gapi) {
        let gapiscript = document.createElement('script');
        gapiscript.src = 'https://apis.google.com/js/api.js';               // URL of the Google API script
        gapiscript.onload = gapiLoadOkay;
        gapiscript.onerror = gapiLoadFail;
        let gisscript = document.createElement('script');
        gisscript.src = 'https://accounts.google.com/gsi/client';          // URL of the Google GIS script
        gisscript.onload = gisLoadOkay;
        gisscript.onerror = gisLoadFail;
        document.head.appendChild(gapiscript);
        document.head.appendChild(gisscript);
    }
    gDriveFileManager.authorizeGapi(userInitiated);
}   

function savePendingP() {
    // pass to correct file manager
    if (GDriveConnected)
        return gDriveFileManager.savePendingP();
    if (LocalFileConnected)
        return localFileManager.savePendingP();
    return false;
}

async function checkBTFileVersion() {
    // pass to correct file manager
    if (GDriveConnected)
        return await gDriveFileManager.checkBTFileVersion();
    if (LocalFileConnected)
        return await localFileManager.checkBTFileVersion();
    return false;
}

async function getBTFile() {
    // pass on
    if (GDriveConnected)
        return await gDriveFileManager.getBTFile();
    if (LocalFileConnected)
        return await localFileManager.getBTFile();
    alert("No file connected");
    return "";
}

function stopSyncing() {
    // BTN CB, stop syncing wherever.
    LocalFileConnected = false;
    GDriveConnected = false;
    configManager.setProp('BTGDriveConnected', false);
    localFileManager.reset();
    updateSyncSettings();
    alert('Sync has been disabled. See Settings to re-enable.');
}


/*** 
 * 
 * UI updates. Stats, save time, icon etc
 * 
 ***/


function updateStatsRow(modifiedTime = null) {
    // update #topics, urls, saves
    const numTopics = AllNodes.filter(n => n?.isTopic()).length;
    const numLinks = AllNodes.filter(n => n?.URL).length;
    const numOpenLinks = AllNodes.filter(n => n?.URL && n?.tabId).length;

    modifiedTime = modifiedTime || configManager.getProp('BTTimestamp');
    const saveTime = getDateString(modifiedTime);

    // update Footer. take account of single column mode
    const saveInfo = $("#content").hasClass('compactMode') ? `${saveTime}` : `Last saved ${saveTime}`;
    const openInfo = $("#content").hasClass('compactMode') ? '' : `(${numOpenLinks} open)`;
    $("#footerSavedInfo").html(saveInfo);
    $("#footerItemInfo").text(`${numTopics} Topics, ${numLinks} pages`);
    $("#footerOpenInfo").html(openInfo);

    if (GDriveConnected) {                                  // set save icon to GDrive, not fileSave
        $("#footerSavedIcon").attr("src", "resources/drive_icon.png");
    }
    if (LocalFileConnected) {
        $("#footerSavedIcon").attr("src", "resources/localSaveIcon.svg");
    }
}

function updateSyncSettings(connected = false, time = null) {
    // Update the display to show/hide based on connectivity

    if (connected) {
        $("#settingsSync").hide();
        $("#settingsSyncStatus").show();
        $("#actionsSyncStatus").show();
        const filetype = GDriveConnected ? 'GDrive' : 'Local File';
        const fileLocation = GDriveConnected ? "https://drive.google.com/file/d/" + configManager.getProp('BTFileID') : "";
        $("#autoSaveLabel").text(`${filetype} sync is on.`);
        $("#fileLocation").html(`File: ${fileLocation}`);
        GDriveConnected && configManager.getProp('BTFileID') && $("#fileLocation").show();
        $("#syncType").text(filetype);
        updateStatsRow(time);                                           // last saved time etc
    }  else {
        // remote sync turned off
        $("#settingsSync").show();
        $("#settingsSyncStatus").hide();
        $("#actionsSyncStatus").hide();
        $("#settingsSyncNone").prop('checked', true);
        // Needed? Screws up launchApp flow when connection has not been established: 
        // configManager.setProp('BTTimestamp', null);
    }
}



/*** 
 * 
 * Import/export file functions
 * 
 ***/

function importOrgFile() {
    // Only way I could find to get wait cursor to show was to introduce the timeout
    $('body').addClass('waiting');
    setTimeout(() => _importOrgFile(), 100);
}    
function _importOrgFile() {
    // Import org file text from user chosen file
    const fr = new FileReader();
    const uploader = $("#org_upload")[0];
    if (!uploader.files.length) {
        $('body').removeClass('waiting');
        return;
    }
    const file = uploader.files[0];
    fr.onload = function(){
        insertOrgFile(file.name, fr.result);     // call parser to insert
        gtag('event', 'OrgImport', {'event_category': 'Import'});
    };
    fr.readAsText(file);
    this.value = null;                           // needed to re-trigger if same file selected again
}

async function loadOrgFile(url) {
    // load topic tree from web resource
    
    $('body').addClass('waiting');
    let response = await fetch(url);
    if (response.ok) {
        const btdata = await response.text();
        insertOrgFile("Import", btdata);
    } else {            
        $('body').removeClass('waiting');
        alert('Error loading Topic file');
    }
    return;
}


function importTabsOutliner() {
    // Only way I could find to get wait cursor to show was to introduce the timeout
    $('body').addClass('waiting');
    setTimeout(() => _importTabsOutliner(), 100);
}
function _importTabsOutliner() {
    // Import TabsOutliner json from user chosen file
    const fr=new FileReader();
    const uploader = $("#to_upload")[0];
    if (!uploader.files.length) {
        $('body').removeClass('waiting');
        return;
    }
    const file = uploader.files[0];
    fr.onload=function(){
        try {
            const orgForTabsO = tabsToBT(fr.result);
            insertOrgFile(file.name, orgForTabsO);
            gtag('event', 'TOImport', {'event_category': 'Import'});
        }
        catch(e) {
            console.log("Error converting TabsOutliner file");
            $('body').removeClass('waiting');
            return;
        }
    };
    fr.readAsText(file);
    this.value = null;                        // needed to re-trigger if same file selected again
}

function exportOrgFile(event) {
    // Import an org file from file
    let filetext = BTAppNode.generateOrgFile();
    filetext = 'data:text/plain;charset=utf-8,' + encodeURIComponent(filetext);
    $("#org_export").attr('href', filetext);
    gtag('event', 'OrgExport', {'event_category': 'Export'});
}
