/*** 
 * 
 * Handles local and gdrive file storage interactions. Mostly just a facade on 
 * localFileManager and gDriveFileManager
 * 
 ***/

// TODO sink these into gDrive manager
var ClientID, APIKey;

function syncEnabled() {
    // Is there a backing store file, local or gdrive
    return GDriveConnected || localFileManager.getLocalFileHandle();
}

async function handleStartupFileConnection() {
    // If there's a backing store file, local or GDrive, handle reconnection etc

    let launchType = 'NonGDriveLaunch';

    // Handle GDrive connection
    if (getMetaProp('BTGDriveConnected') == 'true') {
        GDriveConnected = true;
        gDriveFileManager.authorizeGapi();
        launchType = 'GDriveLaunch';
    }

    // Handle Local connection/permissions
    const local = await localFileManager.reestablishLocalFilePermissions();
    if (local) {
        launchType = 'localFileLaunch';
        updateSyncSettings(true, await localFileManager.getFileLastModifiedTime());
    }

    // fire off tracking event
    gtag('event', launchType, {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});
}

async function saveBT(localOnly = false) {
    // Save org version of BT Tree to local storage and potentially gdrive.
    // localOnly => don't save to GDrive backing and don't send gtag stat. Used when folding/unfolding

    console.log(`Writing BT to ${localOnly ? 'local' : 'remote'} Storage`);
    BTFileText = BTAppNode.generateOrgFile();
    if (window.LOCALTEST) return;

    window.postMessage({'function': 'localStore', 'data': {'BTFileText': BTFileText}});
    if (localOnly) return;                       // return if we're just remember folded state

    brainZoom();                                 // swell the brain
    updateStatsRow();                            // update num cards etc
    console.log("Recording save event and writing to any backing store");
    if (InitialInstall) {
        gtag('event', 'FirstSave', {'event_category': 'General'});
        InitialInstall = false;
    } else {        
    }

    // also save to GDrive or local file if connected and drop an event
    if (GDriveConnected) {
        gDriveFileManager.saveBT(BTFileText);
        gtag('event', 'GDriveSave', {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});
        return;
    }
    if (localFileManager.getLocalFileHandle()) {
        localFileManager.saveBT(BTFileText);
        gtag('event', 'LocalSave', {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});
        return;
    }
    gtag('event', 'InternalSave', {'event_category': 'General', 'event_label': 'NumNodes', 'value': AllNodes.length});
}

async function authorizeLocalFile() {
    // Called from user action button to allow filesystem access and choose BT folder
    const success = await localFileManager.authorizeLocalFile();
    if (!success) return;

    setMetaProp('BTGDriveConnected', 'false');
    Config.BTTimestamp = await localFileManager.getFileLastModifiedTime();
    window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
    updateSyncSettings(true);
}

function authorizeGAPI(userInitiated) {
    // just pass thru
    gDriveFileManager.authorizeGapi(userInitiated);
}   

function savePendingP() {
    // pass to correct file manager
    if (GDriveConnected)
        return gDriveFileManager.savePendingP();
    if (localFileManager.getLocalFileHandle())
        return localFileManager.savePendingP();
    return false;
}

async function checkBTFileVersion() {
    // pass to correct file manager
    if (GDriveConnected)
        return await gDriveFileManager.checkBTFileVersion();
    if (localFileManager.getLocalFileHandle())
        return await localFileManager.checkBTFileVersion();
    return false;
}

async function getBTFile() {
    // pass on
    if (GDriveConnected)
        return await gDriveFileManager.getBTFile();
    if (localFileManager.getLocalFileHandle())
        return await localFileManager.getBTFile();
    alert("No file connected");
    return "";
}


function updateSyncSettings(connected = false, time = null) {
    // Update the display to show/hide based on connectivity

    if (connected) {
        $("#syncSettings").hide();
        $("#saveToFile").hide();
        $("#fileInfo").show();
        const filetype = GDriveConnected ? 'GDrive' : 'Local';
        $("#autoSaveLabel").text(`${filetype} sync on.`);
        updateStatsRow(time);                                           // last saved time etc
    }  else {
        $("#syncSettings").show();
        $("#saveToFile").show();
        $("fileInfo").hide();
        $("#autoSaveLabel").text("Auto-saving is off");
    }
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
        insertOrgFile(file.name, fr.result);     // call parser to insert
        gtag('event', 'OrgImport', {'event_category': 'Import'});
    };
    fr.readAsText(file);
    this.value = null;                           // needed to re-trigger if same file selected again
}

async function loadOrgFile(url) {
    // load topic tree from web resource
    
    let response = await fetch(url);
    if (response.ok) {
        const btdata = await response.text();
        insertOrgFile("Import", btdata);
    } else {            
        alert('Error loading Topic file');
    }
    return;
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
