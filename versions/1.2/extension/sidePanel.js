/* Most of the logic is contained in btContentSCript.js. Here we: 
    - set global SIDEPANEL so content script knows where to postMessage
    - open a port so extension knows when sidepanel is closed
    - set iframe src to the server url in manifest
    - wait for iframe to load before initializing, then send window.id to extension to set BTWin
    - add listeners for mouseleave/out events, let the app know
    - set background color based on theme
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
    let version = manifest.version;
    // version is x.y.z or x.y, need to strip off the .z if present
    const parts = version.split('.');
    if (parts.length > 2) version = parts.slice(0, 2).join('.');
    
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

    // add listeners on mouse leave/out. its hard to capture these from inside the iframe
    iframe.addEventListener('mouseleave', () => sendMessage({function: 'mouseOut'}) );
    window.addEventListener('mouseout', () => sendMessage({function: 'mouseOut'}) );

    // set backgrond color base on dark/light mode
    chrome.storage.local.get(['Theme'], async val => {
        if (val['Theme'] === 'DARK') {
            document.body.style.backgroundColor = '#2D2D2D';
        } else {
            document.body.style.backgroundColor = '#whitesmoke';
        }
    });
});

// add listener on mouse out
window.addEventListener('mouseout', (e) => {
    console.log('--SP --mouse out');
    sendMessage({function: 'mouseOut'});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(`Content-IN ${msg.function} from: ${sender}:`, msg);
    // Handle connection request from worker or popup
    if (msg.function === 'reconnect') {
        BTPort = chrome.runtime.connect({name: "BTSidePanel"});
        sendResponse(BTPort);
        return true;                        // Indicate that sendResponse will be called asynchronously
    }
});