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
 * Simple messaging utility for communicating with browser extension.
 * Extracted to avoid circular dependencies across multiple files.
 * 
 ***/
'use strict';

const messageHandlers = new Map();
let dispatchInitialized = false;

function getTimestamp() {
    // Return current time as HH:MM:SS:mmm
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return ` at: ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function ensureDispatchListener() {
    if (dispatchInitialized) return;
    window.addEventListener('message', async event => {
        if (event.source != window && event.source != window.parent) return;            // not our business
        const data = event?.data;
        if (!data || data.type === 'AWAIT' || data.type === 'AWAIT_RESPONSE') return;  // handled elsewhere
        const fn = data.function;
        if (!fn) return;

        const handlers = messageHandlers.get(fn);
        if (!handlers || handlers.length === 0) return;

        console.log(`App received (${fn}):`, data, getTimestamp());
        for (const handler of handlers) {
            try {
                await handler(data);
            } catch (err) {
                console.error(`BT message handler error for ${fn}`, err);
            }
        }
    });
    dispatchInitialized = true;
}

function registerMessageHandler(messageName, handler) {
    if (!messageName || typeof handler !== 'function') return;
    ensureDispatchListener();
    const handlers = messageHandlers.get(messageName) || [];
    if (!handlers.includes(handler)) handlers.push(handler);
    messageHandlers.set(messageName, handlers);
}

function registerMessageHandlers(mapping = {}) {
    Object.entries(mapping).forEach(([name, handler]) => registerMessageHandler(name, handler));
}

function unregisterMessageHandler(messageName, handler) {
    const handlers = messageHandlers.get(messageName);
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
    if (!handlers.length) messageHandlers.delete(messageName);
}

function sendMessage(message) {
    // Send message to extension via contained content script or side panel container
    // Check if SIDEPANEL is set on the window (set by sidePanel.js when in side panel mode)
    const dest = window.SIDEPANEL ? window.parent : window;
    dest.postMessage(message, '*');
}

// Function to send a message to the content script or side panel and await a response
function callBackground(message) {
    return new Promise((resolve) => {
        // Send the message to the content script
        message.type = "AWAIT";
        sendMessage(message);

        // Listen for the response from the content script
        window.addEventListener("message", function handler(event) {
            if (event?.data?.type !== 'AWAIT_RESPONSE')   return;                          // async handled above
            if (event.source != window && event.source != window.parent)  return;           // not our business            
            window.removeEventListener("message", handler);
            requestBrowserSnapshot();                                                       // Make sure session state gets updated
            resolve(event.data.response);
        });
    });
}

let snapshotRequestTimerId = null;

function requestBrowserSnapshot() {
    // Ask the background script to capture a fresh browser snapshot for reconciliation.
    if (snapshotRequestTimerId) {
        console.log("Snapshot request pending - swallowing duplicate request.");
        return;
    }
    sendMessage({ from: 'btwindow', function: 'syncBrowserSnapshot' });
    snapshotRequestTimerId = setTimeout(() => {
        snapshotRequestTimerId = null;
    }, 500);
}

export { sendMessage, callBackground, registerMessageHandler, registerMessageHandlers, unregisterMessageHandler, requestBrowserSnapshot };
