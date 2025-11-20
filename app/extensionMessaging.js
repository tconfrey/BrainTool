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

        console.log(`BT message received (${fn}):`, data);
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
            sendMessage({ from: 'btwindow', function: 'syncBrowserSnapshot' });             // Make sure session state gets updated
            resolve(event.data.response);
        });
    });
}

export { sendMessage, callBackground, registerMessageHandler, registerMessageHandlers, unregisterMessageHandler };
