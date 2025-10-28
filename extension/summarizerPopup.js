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
 * This code communicates an install, new version or need to open the Topic Manager 
 * and otherwise runs the Bookmarker which controls the topic entry for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

// Utilities to show/hide array of elements
function showElements(elementIds) {
    elementIds.forEach(elementId => {
        document.getElementById(elementId).style.display = 'block';
    });
}
function hideElements(elementIds) {
    elementIds.forEach(elementId => {
        document.getElementById(elementId).style.display = 'none';
    });
}
  
// Popup is launched from scratch on each invocation, So we need to figure out the situation and populate the display appropriately.
// 0. if TM is in the sidepanel check that its open and if not do the needful
// 1. New install => show welcome page
// 2. New version => show upgrade page
// 3. Launch of Topic Manager => show launch splash and open in tab or window
// NB this code doesn't run on side panel opening, see sidePanel.js and logic in suspendExtension in bg
// 4. Normal Bookmarker opening => populate based on:
//    a. existing BT item => only show note update
//    b. new tab => show topic selector and note entry
//    c. tab in tg => select to greate new topic or use tg name

const contextVariables = ['newInstall', 'newVersion', 'Theme', 'BTTab', 'BTManagerHome', 'BTManagerLocation'];
chrome.storage.local.get(contextVariables, async val => {
    console.log(`local storage: ${JSON.stringify(val)}`);

    const home = val['BTManagerHome'] || 'WINDOW';

    // 0. Handle Sidepanel case
    if (home === 'SIDEPANEL') {
        let sidePanelOpen = false;
        try {
            const rsp = await chrome.runtime.sendMessage({'function': 'reconnect'});
            if (typeof rsp === 'object') sidePanelOpen = true;
            console.log('sidepanel open', sidePanelOpen);
        }
        catch (e) {
            console.log('sidepanel not open');
        }
        if (!sidePanelOpen) {
            hideElements(['openingMessage', 'welcomeMessage', 'introImage', 'openingImage', 'upgradeMessage']);
            document.getElementById("okButton").addEventListener('click', async (e) => {
                const window = await chrome.windows.getCurrent();
                chrome.sidePanel.open({windowId: window.id});
            });
            val['BTTab'] && chrome.tabs.remove(val['BTTab']);        // close tab if its open
            return;
        }
    }

    const introTitle = document.getElementById('introTitle');
    if (val['Theme']) {        
        // Change theme by setting attr on document which overide a set of vars. see top of .css
        document.documentElement.setAttribute('data-theme', val['Theme']);
    }

    // Else launching Topic Mgr if its not open, or just normal bookmarker
    let topicManagerTab = null;
    if (val['BTTab']) {
        try {
            topicManagerTab = await chrome.tabs.get(val['BTTab']);
            !topicManagerTab && chrome.storage.local.remove('BTTab');
        } catch (e) {
            // tab no longer exists, clear it
            chrome.storage.local.remove('BTTab');
        }
    }
    if (topicManagerTab || (home === 'SIDEPANEL')) {
        // Topic Manager is open, so just run the bookmarker
        populateBookmarker();
        return;
    }
    
    // Last case - need to re-open Topic Manager with home and location values
    const location = val['BTManagerLocation'];
    
    // Show the splash notice for two seconds and open the topic mgr
    const version = chrome.runtime.getManifest().version;
    introTitle.textContent = introTitle.textContent + version;
    hideElements(['welcomeMessage', 'introImage', 'upgradeMessage', 'okButton', 'sidepanelMessage']);
    showElements(['welcome', 'openingMessage']);
    setTimeout(() => openTopicManager(home, location), 2000);
    return;
});

function reloadExtension() {            
    chrome.tabs.query({title: "BrainTool Topic Manager"},
        (tabs => {
            if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));
            chrome.storage.local.remove('newVersion');
            chrome.runtime.reload();
        })
    );
}

  
function openTopicManager(home = 'WINDOW', location) {
    // Create the BT Topic Manager. Note browser side panel opening is handled onclick on the BT icon, see SIDEPANEL.
    // home == tab => create manager in a tab, WINDOW => in a side panel window, default
    // location {top, left, width, height} filled in by bg whenever Topic Manager is resized
    
    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    chrome.tabs.query(
        {title: "BrainTool Topic Manager"},
        (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));})
        );
    
    // Get server url from the manifest object, add '${version}/app' unless local. nb manifest needs app/* so need to strip *
    const manifest = chrome.runtime.getManifest();
    const contentScripts = manifest.content_scripts;
    const match = contentScripts[0].matches[0];
    const localhost = match.includes('localhost');
    let version = manifest.version;
    // version is x.y.z or x.y, need to strip off the .z if present
    const parts = version.split('.');
    if (parts.length > 2) version = parts.slice(0, 2).join('.');

    const url = match.replace(/\*+$/, '') + (localhost ? '' : (version + '/app'));

    console.log('loading from ', url);
    
    // Default open in side window
    if (home == "WINDOW") {
        chrome.windows.getCurrent(async mainwin => {
            // create topic manager window where last placed or aligned w current window left/top
            const wargs = location ? {
                'url' : url,
                'type' : "panel",
                'state' : "normal",
                'focused' : true,
                'top' : location.top, 'left' : location.left,
                'width' : location.width, 'height' : location.height
            } : {
                'url' : url,
                'type' : "panel",
                'state' : "normal",
                'focused' : true,
                'top' : mainwin.top, 'left' : mainwin.left,
                'width' : 500, 'height' : mainwin.height
            };
            // shift current win left to accomodate side-panel before creating TM. nb only shift normal windows, its wierd if the window is maximized
            if ((!location) && (mainwin.state == 'normal'))
                await chrome.windows.update(mainwin.id, {focused: false, left: (mainwin.left + 150)});
            createTopicManagerWindow(wargs);
        });
    }

    if (home == "TAB") {
        // open in tab
        console.log('opening in tab');
        chrome.tabs.create({'url': url});
    }
}

function createTopicManagerWindow(wargs) {
    // Open Topic Manager, handle bounds error that happens if Mgr moved off visible screen
    chrome.windows.create(wargs, async function(window) {
        if (window)  {
            // for some reason  position is not always set correctly, so update it explicitly 
            await chrome.windows.update(window.id, {'left': wargs.left, 'top': wargs.top, 'width': wargs.width, 'height' : wargs.height, 
                'focused': true, 'drawAttention': true});
            console.log('Updated window:', window);
        } else {
            console.warn('error creating Topic Manager:', chrome.runtime.lastError?.message);
            wargs.top = 50; wargs.left = 0;
            wargs.width = Math.min(screen.width, wargs.width);
            wargs.height = Math.min((screen.height - 50), wargs.height);
            console.warn('Adjusting window bounds and re-creating Topic Manager:', wargs);
            chrome.windows.create(wargs, async function(window2) {
                if (!window2) {
                    alert('Error creating the TopicManager window. Chrome says:' + chrome.runtime.lastError?.message + '\n Using a tab instead...');
                    chrome.tabs.create({'url': wargs.url});
                }
            });
        }
    });
}
// 4. Bookmarker Management from here on

async function populateBookmarker() {
    // Find tab info and open bookmarker
    
    chrome.runtime.connect({name: 'BTPopup'});           // tell background popup is open
    chrome.tabs.query({currentWindow: true}, list => {
        const activeTab = list.find(t => t.active);
        openBookmarker(activeTab);
    });
}


let Guess, Topics, OldTopic, CurrentTab;

// Set up button cbs
const SaveAndGroupBtn = document.getElementById("saveAndGroup");
SaveAndGroupBtn.addEventListener('click', () => saveCB(false));

// Set up summary button cb
const GenerateSummaryBtn = document.getElementById("generateSummary");
const SummaryStatus = document.getElementById("summaryStatus");
GenerateSummaryBtn.addEventListener('click', generateSummary);


/* for use escaping unicode in for topic name below */
const _textAreaForConversion = document.createElement('textarea');
function _decodeHtmlEntities(str) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/html");
    return doc.documentElement.textContent;
}
/* old version, FF linter complained
function _decodeHtmlEntities(str) {
    _textAreaForConversion.innerHTML = str;
    return _textAreaForConversion.value;
}
*/
async function openBookmarker(tab) {
    // Get data from storage and launch popup w card editor, either existing node or new, or existing but navigated
    CurrentTab = tab;
    const tg = (tab.groupId > 0) ? await chrome.tabGroups.get(tab.groupId) : null;
    const saverDiv = document.getElementById("saver");
    const titleH2 = document.getElementById('title');

	document.getElementById('welcome').style.display = 'none';
    saverDiv.style.display = 'block';
    
    // Pull data from local storage, prepopulate and open Bookmarker
    chrome.storage.local.get(
        ['topics', 'currentTabId', 'currentTopic', 'currentText', 'tabNavigated',
         'currentTitle', 'mruTopics', 'saveAndClose'],
        data => {
            let title = (tab.title.length < 60) ? tab.title :
                tab.title.substr(0, 60) + "...";
            titleH2.textContent = title;
            
            // BT Page => just open card
            if (data.currentTopic && data.currentTabId && (data.currentTabId == tab.id)) {
                OldTopic = data.currentTopic;
                TopicCard.setupExisting(tab, data.currentText,
                                        data.currentTitle, data.tabNavigated, saveCB);
                return;
            }

            // New page. create topic list (handling unicode), guess at topic and open card
            Topics = data.topics.map(topic => ({
                ...topic,
                name: _decodeHtmlEntities(topic.name)
            }));
            if (data.mruTopics) {
                // pre-fill to mru topic for window
                const windowId = tab.windowId;
                Guess = data.mruTopics[windowId] || '';
            }
            TopicCard.setupNew(tab.title, tab, cardCompleted);
        });
}

function topicSelected() {
    // CB from topic selector, highlight note text
    document.querySelector('#note').focus();
}
function cardCompleted() {
    // CB from enter in notes field of card
    if (Warned) return;    // don't save if file is out of date
    const close = (SaveAndCloseBtn.classList.contains('activeButton')) ? true : false;
    saveCB(close);       
}

async function generateSummary(event) {
    // Generate AI summary via background script (following Google alt-texter pattern)
    // Background script has proper user gesture context for AI model download
    if (!CurrentTab) {
        console.error('No current tab for summary generation');
        return;
    }
    
    const noteElt = document.querySelector('#note');
    const previousText = noteElt.value;
    
    try {
        // Update button state
        GenerateSummaryBtn.disabled = true;
        GenerateSummaryBtn.textContent = 'Generating...';
        SummaryStatus.textContent = 'Processing...';
        
        // Request background script to generate summary
        // Background script runs outside popup context where AI APIs work properly
        const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_SUMMARY',
            tabId: CurrentTab.id
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // Populate note field with summary
        noteElt.value = response.summary;
        GenerateSummaryBtn.textContent = 'Regenerate Summary';
        SummaryStatus.textContent = '';
        
        // Focus on note field for editing
        noteElt.focus();
        noteElt.setSelectionRange(noteElt.value.length, noteElt.value.length);
        
    } catch (error) {
        console.error('Summary generation failed:', error);
        
        // Show user-friendly error message
        let errorMsg = error.message;
        if (errorMsg.includes('Cannot access protected browser pages')) {
            errorMsg = 'Cannot summarize browser pages (chrome://, about:, etc.). Please try on a regular webpage.';
        } else if (errorMsg.includes('Could not extract page content')) {
            errorMsg = 'Unable to extract content from this page. Try a different page with article text.';
        }
        
        SummaryStatus.textContent = errorMsg;
        GenerateSummaryBtn.textContent = 'Generate Summary';
        
        // Restore previous text if there was an error
        noteElt.value = previousText;
    } finally {
        GenerateSummaryBtn.disabled = false;
    }
}

async function saveCB(close) {
    // Call out to background to do the save
    const title = TopicCard.title();
    const note = TopicCard.note();
    const newTopic = OldTopic || TopicSelector.topic();
        await chrome.runtime.sendMessage({'from': 'popup', 'function': 'saveTabs', 'type': 'Tab', 'currentWindowId': CurrentTab.windowId,
            'close': close, 'topic': newTopic, 'note': note, 'title': title});
        if (!close)              // if tab isn't closing animate the brain
            await chrome.runtime.sendMessage({'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
        await chrome.storage.local.set({'saveAndClose': close});

    window.close();
}

// Listen for messages from other components. Currently just to know to close BT popup or warn the file is out of date
let Warned = false;
chrome.runtime.onMessage.addListener((msg, sender) => {
    switch (msg.from) {
    case 'btwindow':
        if (msg.function == 'initializeExtension') {
            console.log("BT window is ready");
            window.close();
        }
        if (msg.function == 'warnStaleFile') {
            document.getElementById('warning').style.display = 'block';
            document.getElementById('saveAndClose').disabled = true;
            document.getElementById('saveAndGroup').disabled = true;
            Warned = true;
        }
        break;
    }
    console.log("Popup In:"+msg);
});
