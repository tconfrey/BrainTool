/***
 *
 * Test stub for app/localFileManager.js. localStorageManager keeps an in-memory map per DB.
 * getDB(name) returns the same kind of accessor the real one does - fn(mode, callback(store)) -
 * with a store that supports openCursor(), which is all BTAppNode._loadAliasesOnce uses.
 *
 ***/
'use strict';

import { record } from './callLog.js';

const dbs = new Map();                  // dbName -> Map(key -> value)

function dbData(name) {
    if (!dbs.has(name)) dbs.set(name, new Map());
    return dbs.get(name);
}

function getDB(dbName) {
    const accessor = function (mode, callback) {
        const data = dbData(dbName);
        const store = {
            openCursor() {
                const entries = [...data.entries()];
                let i = 0;
                const request = { onsuccess: null, onerror: null };
                const step = () => {
                    const entry = entries[i];
                    const cursor = entry ? {
                        key: entry[0], value: entry[1],
                        continue() { i++; setTimeout(step, 0); },
                    } : null;
                    request.onsuccess?.({ target: { result: cursor } });
                };
                setTimeout(step, 0);
                return request;
            },
        };
        callback(store);
    };
    accessor.dbName = dbName;
    return accessor;
}

async function set(key, value, dbAccessor) {
    const name = dbAccessor?.dbName;
    record('localStorageManager.set', key, value, name);
    dbData(name).set(key, value);
}
async function get(key, dbAccessor) {
    return dbData(dbAccessor?.dbName).get(key);
}
function clearStorage() {
    dbs.clear();
}

// test helper: seed a DB directly, eg seedDB('aliasDB', {aliasUrl: nodeUrl})
function seedDB(name, obj) {
    const data = dbData(name);
    Object.entries(obj).forEach(([k, v]) => data.set(k, v));
}

const localStorageManager = { set, get, clear: clearStorage, getDB };
const localFileManager = {};

export { localFileManager, localStorageManager, seedDB };
