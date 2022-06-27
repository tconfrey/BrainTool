/*** 
 * 
 * Handles local file storage interactions.
 * 
 ***/
'use strict';

const localFileManager = (() => {

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
    // ------------------------------------------------

    let LocalDirectoryHandle, LocalFileHandle;
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
            alert("Sorry, local file saving is not supported on your browser (eg Brave)");
            return null;
        }
        alert("Choose where you want to store your BrainTool file");
        const options = {startIn: 'documents', create: true};
        LocalDirectoryHandle = await window.showDirectoryPicker(options);
        if (!LocalDirectoryHandle) {
            console.log('Local File access denied');
            return null;
        }
        let fileExists = false;
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
        
        LocalFileConnected = true;                             // used in fileManager facade
        if (fileExists &&
            confirm("BrainTool.org file already exists. Click OK to use its contents")) {
		    await refreshTable(true);
	    } else {
	        // else do a save to sync everything up
	        const content = BTAppNode.generateOrgFile();
	        saveBT(content);
	    }
        
        set('localFileHandle', LocalFileHandle);               // store for subsequent sessions
        set('localDirectoryHandle', LocalDirectoryHandle);     // store for subsequent sessions
        return LocalFileHandle;
    }

    async function reestablishLocalFilePermissions() {
        // Called at startup. if there's a file handle (=> local storage option) set up perms

        LocalFileHandle = await get('localFileHandle');
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
                    await LocalFileHandle.requestPermission({mode: 'readwrite'});
                    resolve(event);
                };
                $("#grant").on('click', listener);
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
        if (newerOnDisk && confirm("BrainTool.org file is newer on disk. Use newer?")) {
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

    function getLocalFileHandle() {
        return LocalFileHandle;
    }

    function reset() {
        // utility to clear out memory of localFileHandle
        del('localFileHandle');
        del('localDirectoryHandle');
    }

    return {
        saveBT: saveBT,
        authorizeLocalFile: authorizeLocalFile,
        checkBTFileVersion: checkBTFileVersion,
        reestablishLocalFilePermissions: reestablishLocalFilePermissions,
        savePendingP: savePendingP,
        getBTFile: getBTFile,
        getLocalFileHandle: getLocalFileHandle,
        getFileLastModifiedTime: getFileLastModifiedTime,
        reset: reset
    };
})();

        
