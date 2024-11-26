/* Most of the logic is contained in btContentSCript.js. Here we: 
    - set global SIDEPANEL so we know where to postMessage
    - open a port so extension knows when sidepanel is closed
    - wait for iframe to load before initializing, then send window.id to extension to set BTWin
*/
const SIDEPANEL=true;

let BTPort;
(async function () {
    BTPort = await chrome.runtime.connect({name: "BTSidePanel"});
})();

document.addEventListener('DOMContentLoaded', function() {
    const iframe = document.getElementById('BTTopicManager');

    // Query the current window
    chrome.windows.getCurrent((window) => {
        iframe.addEventListener('load', () => chrome.runtime.sendMessage({'from': 'btwindow', 'function': 'initializeExtension', 'BTWin': window.id }));
    });
});