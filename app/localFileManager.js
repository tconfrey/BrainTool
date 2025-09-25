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
 * Handles local file storage interactions.
 * 
 ***/
'use strict';

const localStorageManager = (() => {

    // The following is pulled from https://github.com/jakearchibald/idb-keyval
    // Seems its the only way to persist the filehandle across sessions (needs deep clone)
    // See https://stackoverflow.com/questions/65928613
    // ------------------------------------------------

    function promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            // @ts-ignore - file size hacks
            request.oncomplete = request.onsuccess = () => resolve(request.result);
            // @ts-ignore - file size hacks
            request.onabort = request.onerror = () => reject(request.error);
        });
    }
    function createStore(dbName, storeName) {
        const request = indexedDB.open(dbName);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        const dbp = promisifyRequest(request);
        return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
    }
    let defaultGetStoreFunc;
    function defaultGetStore() {
        if (!defaultGetStoreFunc) {
            defaultGetStoreFunc = createStore('keyval-store', 'keyval');
        }
        return defaultGetStoreFunc;
    }
    const DBs = [];
    function getDB(dbName) {
        const match = DBs.find((db) => db.name === dbName);
        if (match) {
            return match.getStore;
        }
        const db = {
            name: dbName,
            getStore: createStore(dbName, dbName),
        };
        DBs.push(db);
        return db.getStore;
    }
    /**
     * Get a value by its key.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    function get(key, customStore = defaultGetStore()) {
        return customStore('readonly', (store) => promisifyRequest(store.get(key)));
    }
    /**
     * Set a value with a key.
     *
     * @param key
     * @param value
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    function set(key, value, customStore = defaultGetStore()) {
        return customStore('readwrite', (store) => {
            store.put(value, key);
            return promisifyRequest(store.transaction);
        });
    }
    /**
     * Delete a particular key from the store.
     *
     * @param key
     * @param customStore Method to get a custom store. Use with caution (see the docs).
     */
    function del(key, customStore = defaultGetStore()) {
        return customStore('readwrite', (store) => {
            store.delete(key);
            return promisifyRequest(store.transaction);
        });
    }
    function clear(customStore = defaultGetStore()) {
        return customStore('readwrite', (store) => {
            store.clear();
            return promisifyRequest(store.transaction);
        });
    }

    return {
        set: set,
        get: get,
        clear: clear,
        getDB: getDB
    };
})();

// ------------------------------------------------


const localFileManager = (() => {

    let LocalDirectoryHandle, LocalFileHandle, BackupDirectoryHandle;
    let savePending = false;
    async function saveBT(BTFileText) {
        // Save BT file to local file for which permission was granted
        console.log('writing to local file');
        savePending = true;
        if (!LocalFileHandle)
            LocalFileHandle = await authorizeLocalFile();
        
        // Create a FileSystemWritableFileStream to write to.
        const writable = await LocalFileHandle.createWritable();
        // Write the contents of the file to the stream.
        await writable.write(BTFileText);
        // Close the file and write the contents to disk.
        await writable.close();
        savePending = false;
        configManager.setProp('BTTimestamp', Date.now());
    }

    function savePendingP() {
        return savePending;
    }

    async function authorizeLocalFile() {
        // Called from user action button to allow filesystem access and choose BT folder
        if (typeof window.showSaveFilePicker !== "function") {
            alert("Sorry, local file saving is not supported on your browser (NB Brave has a flag to enable, open brave://flags and toggle 'File System Access API')");
            return null;
        }
        if (SidePanel) {
            alert("Local file saving cannot be initiated from Sidepanel view. \n\nPlease set the Topic Manager Location to Window or Tab to perform this action.");
            return null;
        }

        alert("Choose where you want to store your BrainTool file");
        const options = {startIn: 'documents', create: true};
        LocalDirectoryHandle = await window.showDirectoryPicker(options);
        if (!LocalDirectoryHandle) {
            alert('Cancelling Local File sync');
            return null;
        }

        let fileExists = false;
        try {
            for await (const entry of LocalDirectoryHandle.values()) {
                console.log(entry.kind, entry.name);
                if (entry.name == 'BrainTool.org')  {
                    LocalFileHandle = entry;
                    fileExists = true;
                    break;
                }
            }
            if (!LocalFileHandle)
                LocalFileHandle =
                await LocalDirectoryHandle.getFileHandle('BrainTool.org', { create: true });
        } catch (err) {
            console.log(err);
            alert('Error accessing local file, cancelling sync');
            return null;
        }
        LocalFileConnected = true;                             // used in fileManager facade
        if (fileExists && confirm("BrainTool.org file already exists. Click OK to use its contents"))
		    await refreshTable(true);
	    
        const content = BTAppNode.generateOrgFile();
	    saveBT(content);                                        // Either way do a save to sync everything up
        
        localStorageManager.set('localFileHandle', LocalFileHandle);               // store for subsequent sessions
        localStorageManager.set('localDirectoryHandle', LocalDirectoryHandle);     // store for subsequent sessions
        return LocalFileHandle;
    }

    async function reestablishLocalFilePermissions() {
        // Called at startup. if there's a file handle (=> local storage option) set up perms

        LocalFileHandle = await localStorageManager.get('localFileHandle');
        if (!LocalFileHandle) return false;
        
        if ((await LocalFileHandle.queryPermission({mode: 'readwrite'})) !== 'granted') {
            // Request permission if needed
            // Need to show prompt and wait for response before asking for perms

            // show request re-using edit dialog overlay
            $("#dialog").hide();
            $("#permissions").show();
            $("#editOverlay").css("display", "block");

            // wait for click on grant button
            let p = new Promise(function (resolve, reject) {
                var listener = async () => {
                    $("#editOverlay").off('click', listener);
                    try {
                        await LocalFileHandle.requestPermission({mode: 'readwrite'});
                        resolve(event);
                    } catch (error) {
                        alert('Error requesting file permission:', JSON.stringify(error));
                        reject(error);
                    }
                };
                $("#grant").on('click', listener);
                $("#editOverlay").on('click', listener);
            });
            await p;

            // hide request overlay
            $("#dialog").show();
            $("#permissions").hide();
            $("#editOverlay").css("display", "none");
        }

        // check if newer version on disk
        LocalFileConnected = true;
        const newerOnDisk = await checkBTFileVersion();
        if (newerOnDisk && confirm("Synced BrainTool.org file on disk is newer than browser data. \nHit Cancel to ignore or OK to load newer. \nUse newer?")) {
            try {
		        await refreshTable(true);
            }
            catch (err) {
                alert("Error parsing BrainTool.org file from local file:\n" + JSON.stringify(err));
                throw(err);
            }
        }
        return true;
    }

    async function getBTFile() {
        // read file data
        const file = await LocalFileHandle.getFile();
        const contents = await file.text();
        
		configManager.setProp('BTTimestamp', file.lastModified);
        BTFileText = contents;
    }

    async function getFileLastModifiedTime() {            
        // get the file instance and extract its lastmodified timestamp
        if ((await LocalFileHandle.queryPermission({mode: 'readwrite'})) !== 'granted')
            return 0;
        const file = await LocalFileHandle.getFile();
        return file.lastModified;
    }
            
    async function checkBTFileVersion() {
        // is there a newer version of the btfile on Drive?

        const remoteVersion = await getFileLastModifiedTime() || 0;
        const localVersion = configManager.getProp('BTTimestamp') || 0;
        console.log(`Checking timestamps. local: ${localVersion}, remote: ${remoteVersion}`);
        return (remoteVersion > localVersion);
    }

    async function getLocalFileHandle() {
        return LocalFileHandle || await localStorageManager.get('localFileHandle');
    }
    async function getLocalDirectoryHandle() {
        return LocalDirectoryHandle || await localStorageManager.get('localDirectoryHandle');
    }
    
    async function getBackupDirectoryHandle() {
        return BackupDirectoryHandle || await localStorageManager.get('backupDirectoryHandle');
    }

    function reset() {
        // utility to clear out memory of localFileHandle. Called when sync turned off.
        localStorageManager.clear();
        LocalFileHandle = null;
        LocalDirectoryHandle = null;
    }

    async function initiateBackups() {
        // find or create the BT-Backups folder
        try {
            LocalDirectoryHandle = LocalDirectoryHandle || await getLocalDirectoryHandle();
            const backupDirectoryHandle = await LocalDirectoryHandle.getDirectoryHandle('BT-Backups', {create: true});
            if (!backupDirectoryHandle) {
                alert('Error creating BT-Backups folder');
                return;
            }
            BackupDirectoryHandle = backupDirectoryHandle;
            localStorageManager.set('backupDirectoryHandle', BackupDirectoryHandle);
            alert(`Backups will be stored in "${BackupDirectoryHandle.name}" under "${LocalDirectoryHandle.name}"`);
        } catch (err) {
          alert('Error accessing BT-Backups folder');
          throw err;
        }
    }

    async function createBackup(name) {
        // Copy current live BrainTool.org file into the backups folder and name it 'name'
        BackupDirectoryHandle = BackupDirectoryHandle || await getBackupDirectoryHandle();
        const file = await LocalFileHandle.getFile();
        const stream = await file.stream();
        const backupFileHandle = await BackupDirectoryHandle.getFileHandle(name, {create: true});
        const writable = await backupFileHandle.createWritable();
        await stream.pipeTo(writable);
        return name;
    }

    async function deleteBackup(name) {
        // find the named file in the backups directory and delete it
        BackupDirectoryHandle = BackupDirectoryHandle || await getBackupDirectoryHandle();
        await BackupDirectoryHandle.removeEntry(name);
    }

    return {
        saveBT: saveBT,
        authorizeLocalFile: authorizeLocalFile,
        checkBTFileVersion: checkBTFileVersion,
        reestablishLocalFilePermissions: reestablishLocalFilePermissions,
        savePendingP: savePendingP,
        getBTFile: getBTFile,
        getLocalFileHandle: getLocalFileHandle,
        getLocalDirectoryHandle: getLocalDirectoryHandle,
        getFileLastModifiedTime: getFileLastModifiedTime,
        reset: reset,
        initiateBackups: initiateBackups,
        createBackup: createBackup,
        deleteBackup: deleteBackup
    };
})();

        
