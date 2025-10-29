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

export { sendMessage };
