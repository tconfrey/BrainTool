/***
 *
 * Test stub for app/fileManager.js. The real module pulls in the whole app (gDrive, parser,
 * messageManager...). BTAppNode only needs loadOrgFile.
 *
 ***/
'use strict';

import { record } from './callLog.js';

async function loadOrgFile(url) {
    record('loadOrgFile', url);
}

export { loadOrgFile };
