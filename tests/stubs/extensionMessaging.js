/***
 *
 * Test stub for app/extensionMessaging.js. Mapped in via the import map in tests/nodeLogic.html.
 * sendMessage/callBackground just record what they were sent. callBackground resolves with
 * whatever setBackgroundResponse() last set (default {status: 'success'}).
 *
 ***/
'use strict';

import { record } from './callLog.js';

let backgroundResponse = { status: 'success' };

function setBackgroundResponse(rsp) {
    backgroundResponse = rsp;
}

function sendMessage(msg) {
    record('sendMessage', msg);
}

async function callBackground(msg) {
    record('callBackground', msg);
    return (typeof backgroundResponse === 'function') ? backgroundResponse(msg) : backgroundResponse;
}

function registerMessageHandler() {}
function registerMessageHandlers() {}
function unregisterMessageHandler() {}
async function requestBrowserSnapshot() { return null; }

export { sendMessage, callBackground, registerMessageHandler, registerMessageHandlers,
         unregisterMessageHandler, requestBrowserSnapshot, setBackgroundResponse };
