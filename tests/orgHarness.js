// Shared helpers for org round-trip tests. Loads the real app modules (no stubs).
//
// bt.js must be the first app module evaluated: the app modules have circular imports
// (parser -> BTAppNode -> fileManager -> parser ...) and only resolve cleanly in the
// order the app itself uses, with bt.js as the entry point. Importing it also registers
// message handlers, which is harmless here because there's no extension to talk to.
import '../app/bt.js';
import { parseBTFile, insertOrgFile, registerProcessImport } from '../app/parser.js';
import { AllNodes, BTNode } from '../app/BTNode.js';
import { BTAppNode } from '../app/BTAppNode.js';
import { setConfigAndKeys } from '../app/configManager.js';

function resetModel() {
    // Same reset tableManager.processBTFile does, plus a fresh Config so #+PROPERTY
    // values from one fixture don't leak into the next.
    BTNode.topIndex = 1;
    AllNodes.length = 0;
    setConfigAndKeys({ Config: {} });
    // An import with a BTParentTopic creates topics through the UI (createDisplayNode), so give
    // it an empty, initialised treetable like tableManager.processBTFile does.
    const table = window.$ && $('#content');
    if (table && table.length && $.fn.treetable) {
        table.empty();
        table.treetable({ expandable: true, initialState: 'expanded', indent: 30 }, true);
    }
}

function loadAndSave(text) {
    // File load path (tableManager.processBTFile -> parser.parseBTFile) followed by the
    // save path (fileManager.saveBT -> BTAppNode.generateOrgFile). No table is rendered,
    // so generateOrgFile keeps top level nodes in model order.
    resetModel();
    parseBTFile(text);
    return BTAppNode.generateOrgFile();
}

function importAndSave(fileName, text) {
    // Import path (fileManager.importOrgFile -> parser.insertOrgFile). bt.js registers
    // processImport, which saves and redraws the UI; swap in a no-op for the test.
    resetModel();
    let importedId = null;
    registerProcessImport(id => { importedId = id; });
    insertOrgFile(fileName, text);
    return { parent: AllNodes[importedId], orgText: BTAppNode.generateOrgFile() };
}

async function fetchText(path) {
    const rsp = await fetch(path, { cache: 'no-store' });
    if (!rsp.ok) throw new Error(`Could not fetch ${path}: ${rsp.status}`);
    return rsp.text();
}

export { resetModel, loadAndSave, importAndSave, fetchText, AllNodes, BTAppNode };
