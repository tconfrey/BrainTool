/* Most of the logic is contained in btContentSCript.js. Here we: 
    - set global SIDEPANEL so content script knows where to postMessage
    - open a port so extension knows when sidepanel is closed
    - set iframe src to the server url in manifest
    - wait for iframe to load before initializing, then send window.id to extension to set BTWin
    - listen for reconnect request from worker or popup
*/
const SIDEPANEL=true;

let BTPort;
(async function () {
    BTPort = await chrome.runtime.connect({name: "BTSidePanel"});
    
    // Get server url from the manifest object to set iframe src, nb need to strip trailing *'s needed in manifest
    const manifest = chrome.runtime.getManifest();
    const contentScripts = manifest.content_scripts;
    const match = contentScripts[0].matches[0];
    const localhost = match.includes('localhost');
    const version = manifest.version;
    const url = match.replace(/\*+$/, '') + (localhost ? '' : (version + '/app'));
    const iframe = document.getElementById('BTTopicManager');
    iframe.src = url;
})();

document.addEventListener('DOMContentLoaded', function() {
    const iframe = document.getElementById('BTTopicManager');

    // Query the current window
    chrome.windows.getCurrent((window) => {
        iframe.addEventListener('load', () => chrome.runtime.sendMessage({'from': 'btwindow', 'function': 'initializeExtension', 'BTWin': window.id }));
        iframe.focus();
    });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(`Content-IN ${msg.function} from: ${sender}:`, msg);
    // Handle connection request from worker or popup
    if (msg.function === 'reconnect') {
        BTPort = chrome.runtime.connect({name: "BTSidePanel"});
        sendResponse(BTPort);
    }
});