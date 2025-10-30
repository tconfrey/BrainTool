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
 * Simple messaging utility for communicating with browser extension.
 * Extracted to avoid circular dependencies across multiple files.
 * 
 ***/
'use strict';

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
            resolve(event.data.response);
        });
    });
}

export { sendMessage, callBackground };
