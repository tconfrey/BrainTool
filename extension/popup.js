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

    if (val['newInstall']) {
        // This is a new install, show the welcome page
        introTitle.textContent = introTitle.textContent + val['newVersion'];
        hideElements(['openingMessage', 'upgradeMessage', 'openingImage', 'sidepanelMessage']);
        showElements(['welcomeMessage', 'introImage', 'welcome']);
        chrome.storage.local.remove(['newInstall', 'newVersion']);
        document.getElementById("okButton").addEventListener('click', e => openTopicManager());
        return;
    }
    
    if (val['newVersion']) {
        // Background has received updateAvailable, so inform user and upgrade
        document.getElementById('upgradeVersion').textContent = val['newVersion'];
        introTitle.textContent = introTitle.textContent + val['newVersion'];
        hideElements(['openingMessage', 'welcomeMessage', 'introImage', 'sidepanelMessage']);
        showElements(['upgradeMessage', 'openingImage', 'welcome']);
        document.getElementById("okButton").addEventListener('click', e => reloadExtension());
        return;
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
    const version = manifest.version;
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
const SaveAndCloseBtn = document.getElementById("saveAndClose");
SaveAndGroupBtn.addEventListener('click', () => saveCB(false));
SaveAndCloseBtn.addEventListener('click', () => saveCB(true));

// Logic for saveTab/saveAllTabs toggle
const SaveTab =  document.getElementById("saveTab");
const SaveWindow =  document.getElementById("saveWindow");
const SaveTG =  document.getElementById("saveTG");
const SaveSession =  document.getElementById("saveAllSession");

SaveTab.addEventListener('change', e => {
    if (SaveTab.checked) {SaveWindow.checked = false; SaveSession.checked = false; SaveTG.checked = false;}
    else SaveWindow.checked = true;
    updateForSelection();
});
SaveWindow.addEventListener('change', e => {
    if (SaveWindow.checked) {SaveTab.checked = false; SaveSession.checked = false;}
    else SaveTab.checked = true;
    updateForSelection();
});
SaveTG.addEventListener('change', e => {
    if (SaveTG.checked) {SaveTab.checked = false; SaveSession.checked = false;}
    else SaveTab.checked = true;
    updateForSelection();
});
SaveSession.addEventListener('change', e => {
    if (SaveSession.checked) {SaveTab.checked = false; SaveWindow.checked = false; SaveTG.checked = false;}
    else SaveTab.checked = true;
    updateForSelection();
});
function updateForSelection() {
    // handle AllPages toggle
    const onePageElements = document.getElementsByClassName("onePage");
    const allPageElements = document.getElementsByClassName("allPages");
    const tgElements = document.getElementsByClassName("tgPages");
    if (SaveWindow.checked || SaveSession.checked) {
        Array.from(onePageElements).forEach(e => e.style.display = "none");
        Array.from(tgElements).forEach(e => e.style.display = "none");
        Array.from(allPageElements).forEach(e => e.style.display = "block");
        TopicSelector.clearGuess();
    } 
    if (SaveTG.checked) {
        Array.from(onePageElements).forEach(e => e.style.display = "none");
        Array.from(allPageElements).forEach(e => e.style.display = "none");
        Array.from(tgElements).forEach(e => e.style.display = "block");
        TopicSelector.clearGuess();
    }
    if (SaveTab.checked) {
        Array.from(tgElements).forEach(e => e.style.display = "none");
        Array.from(allPageElements).forEach(e => e.style.display = "none");
        Array.from(onePageElements).forEach(e => e.style.display = "block");
        TopicSelector.setGuess(Guess);
    }
}

/* for use escaping unicode in for topic name below */
const _textAreaForConversion = document.createElement('textarea');
function _decodeHtmlEntities(str) {
    _textAreaForConversion.innerHTML = str;
    return _textAreaForConversion.value;
}
async function openBookmarker(tab) {
    // Get data from storage and launch popup w card editor, either existing node or new, or existing but navigated
    CurrentTab = tab;
    const tg = (tab.groupId > 0) ? await chrome.tabGroups.get(tab.groupId) : null;
    const saverDiv = document.getElementById("saver");
    const titleH2 = document.getElementById('title');
    const saveTGSpan = document.getElementById('saveTGSpan');
    const saveTG = document.getElementById('saveTG');
    const saveTab = document.getElementById('saveTab');
    const saveWindow = document.getElementById('saveWindowSpan');
    const saveAs = document.getElementById('saveAs');

	document.getElementById('welcome').style.display = 'none';
    saverDiv.style.display = 'block';
    saveAs.style.display = 'none';
    if (tg) {
        // tab is part of a TG => set the saveTg checkbox to be checked
        document.getElementById('tgName').textContent = tg.title;
        saveWindow.style.display = 'none';
        saveTG.checked = true;
        saveTab.checked = false;
    } else  {
        saveTGSpan.style.display = 'none';
    }
    
    // Pull data from local storage, prepopulate and open Bookmarker
    chrome.storage.local.get(
        ['topics', 'currentTabId', 'currentTopic', 'currentText', 'tabNavigated',
         'currentTitle', 'mruTopics', 'saveAndClose'],
        data => {
            let title = (tab.title.length < 150) ? tab.title :
                tab.title.substr(0, 150) + "...";            
            titleH2.textContent = title;
            
            if (!data.saveAndClose) {
                // set up save and group as default
                SaveAndGroupBtn.classList.add("activeButton");
                SaveAndCloseBtn.classList.remove("activeButton");
            }
            
            // BT Page => just open card
            if (data.currentTopic && data.currentTabId && (data.currentTabId == tab.id)) {
                OldTopic = data.currentTopic;
                document.getElementById('topicSelector').style.display = 'none';
                document.getElementById('saveCheckboxes').style.display = 'none';
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
            TopicSelector.setup(Guess, Topics, topicSelected);
            TopicCard.setupNew(tab.title, tab, cardCompleted);
            updateForSelection();
        });
}

function topicSelected() {
    // CB from topic selector, highlight note text
    document.querySelector('#note').focus();
}
function cardCompleted() {
    // CB from enter in notes field of card
    const close = (SaveAndCloseBtn.classList.contains('activeButton')) ? true : false;
    saveCB(close);       
}

async function saveCB(close) {
    // Call out to background to do the save
    const title = TopicCard.title();
    const note = TopicCard.note();
    const newTopic = OldTopic || TopicSelector.topic();
    const saverDiv = document.getElementById("saveCheckboxes");
    let saveType;
    
    // Is the savetype selector is hidden we're editng a single tab. Otherwise use the selector
    if (window.getComputedStyle(saverDiv).display == 'none') saveType = 'Tab';
    else saveType = SaveTab.checked ? 'Tab' : (SaveTG.checked ? 'TG' : (SaveWindow.checked ? 'Window' : 'Session'));

    if ((saveType == 'Tab') && (CurrentTab.pinned)) {
        // We don't handle pinned tabs, so alert and return
        alert('BrainTool does not handle pinned tabs. Unpin the tab and try again.');
    } else {
        await chrome.runtime.sendMessage({'from': 'popup', 'function': 'saveTabs', 'type': saveType, 'currentWindowId': CurrentTab.windowId,
                                        'close': close, 'topic': newTopic, 'note': note, 'title': title});
        if (!close)              // if tab isn't closing animate the brain
            await chrome.runtime.sendMessage({'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
        await chrome.storage.local.set({'saveAndClose': close});
    }
    window.close();
}

// Listen for messages from other components. Currently just to know to close BT popup.
chrome.runtime.onMessage.addListener((msg, sender) => {
    switch (msg.from) {
    case 'btwindow':
        if (msg.function == 'initializeExtension') {
            console.log("BT window is ready");
            window.close();
        }
        break;
    }
    console.log("Popup In:"+msg);
});
