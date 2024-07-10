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
 * This code runs under the popup and controls the topic entry for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

var BTTab;
var CurrentTab;
var ReadOnly = false;                   // capture whether tab is already stored in BT
var Tabs;                               // tabs in current window
var newInstall = false;                 // set below, ignore some events if = true

function createWindow(wargs) {
    // Open Topic Manager, handle bounds error that happens if Mgr moved off visible screen
    try {
    chrome.windows.create(wargs, async function(window) {
        if (window)  {
            // for some reason  position is not always set correctly, so update it explicitly 
            await chrome.windows.update(window.id, 
                {'left': wargs.left, 'top': wargs.top, 'width': wargs.width, 'height' : wargs.height, 
                'focused': true, 'drawAttention': true});
            console.log('Updated window:', window);
        }
        else {
            console.warn('error in windowOpen:', chrome.runtime.lastError?.message);
            wargs.top = 50; wargs.left = 0;
            chrome.windows.create(wargs);
        }
    });
    } catch (e) {
        console.warn('error in createWindow, trying again:', e);
        wargs.top = 50; wargs.left = 0;
        chrome.windows.create(wargs);
    }
}

chrome.storage.local.get(['newInstall', 'newVersion', 'ManagerHome', 'ManagerLocation', 'Theme', 'BTTab'], async val => {
    console.log(`local storage: ${JSON.stringify(val)}`);
	const welcomeDiv = document.getElementById('welcome');
	const openingMessage = document.getElementById('openingMessage');
	const welcomeMessage = document.getElementById('welcomeMessage');
	const upgradeMessage = document.getElementById('upgradeMessage');
	const introImage = document.getElementById('introImage');
	const openingImage = document.getElementById('openingImage');
    const introTitle = document.getElementById('introTitle');
    BTTab = val.BTTab;

    if (val['Theme']) {        
        // Change theme by setting attr on document which overide a set of vars. see top of .css
        document.documentElement.setAttribute('data-theme', val['Theme']);
    }

    if (val['newInstall']) {
	    // This is a new install, show the welcome page
	    openingMessage.style.display = 'none';
	    upgradeMessage.style.display = 'none';
	    welcomeMessage.style.display = 'block';
	    openingImage.style.display = 'none';
	    introImage.style.display = 'block';
        welcomeDiv.style.display = 'block';
        introTitle.textContent = introTitle.textContent + val['newVersion'];
	    newInstall = true;
        chrome.storage.local.remove('newInstall');
        chrome.storage.local.remove('newVersion');
        document.getElementById("okButton").addEventListener('click', e => windowOpen());
	    return;
    }
    
    if (val['newVersion']) {
	    // Background has received updateAvailable, so inform user and upgrade
	    openingMessage.style.display = 'none';
        document.getElementById('upgradeVersion').textContent = val['newVersion'];
        introTitle.textContent = introTitle.textContent + val['newVersion'];
	    upgradeMessage.style.display = 'block';
	    welcomeMessage.style.display = 'none';
	    openingImage.style.display = 'block';
	    introImage.style.display = 'none';
        welcomeDiv.style.display = 'block';
        document.getElementById("okButton").addEventListener('click', e => {            
            chrome.tabs.query({title: "BrainTool Topic Manager"},
                              (tabs => {
                                  if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));
                                  chrome.storage.local.remove('newVersion');
                                  chrome.runtime.reload();
                              }));
                            });
	    return;
    }

    // Else just normal popup either in tab or side panel
    const home = val['ManagerHome'] || 'PANEL';
    const location = val['ManagerLocation'];
    await popupAction(home, location);
    chrome.runtime.connect();           // tell background popup is open
    return;
});

async function popupAction (home, location) {
    // Activate popup -> populate form if app is open, otherwise open app
    let btOpen = false;
    if (BTTab) {
        // Check if BT tab still exists
        btOpen = true;
        try {
            await chrome.tabs.get(BTTab);
        } catch (e) {
            // tab no longer exists, clear it
            chrome.storage.local.remove('BTTab');
            BTTab = null;
            btOpen = false;
        }
    }
    if (btOpen)
        chrome.tabs.query(              // find active tab to open popup from
            {currentWindow: true}, list => {
                Tabs = list;
                const activeTab = list.find(t => t.active);
                popupOpen(activeTab);
            });
    else {
        const version = chrome.runtime.getManifest().version;
        document.getElementById('introTitle').textContent = introTitle.textContent + version;
        document.getElementById('welcome').style.display = 'block';
        document.getElementById('introImage').style.display = 'none';
        document.getElementById('welcomeMessage').style.display = 'none';
        document.getElementById('upgradeMessage').style.display = 'none';
        document.getElementById("okButton").style.display = 'none';
        setTimeout(()=> windowOpen(home, location), 2000);
    }
}

async function windowOpen(home = 'PANEL', location) {
    // Called on first click on header button (or ok in welcomediv), create the BT Topic Manager
    // home == tab => create manager in a tab, PANEL => in a side panel, default
    // location {top, left, width, height} filled in by bg whenever Topic Manager is resized

    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    chrome.tabs.query({title: "BrainTool Topic Manager"},
                      (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));}));

    // Create window, remember it and highlight it
   // const url = "https://BrainTool.org/app/";
    const url = "http://localhost:8000/app/"; // versions/"+version+"/app/";
   // const url = "https://BrainTool.org/versions/"+version+'/app/';
    console.log('loading from ', url);

    // Default open in side panel
    if (home != "TAB") {
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
	        // shift current win left to accomodate side-panel. nb state can't be 'maximized'
	        if (!location) await chrome.windows.update(mainwin.id, {state: 'normal', focused: false,
                                                           left: (mainwin.left + 150)});
            createWindow(wargs);
        });
    } else {
        // open in tab
        console.log('opening in tab');
        chrome.tabs.create({'url': url});
    }
}

let Guess, Topics, OldTopic;

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
async function popupOpen(tab) {
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

    await chrome.runtime.sendMessage({'from': 'popup', 'function': 'saveTabs', 'type': saveType, 'currentWindowId': CurrentTab.windowId,
                                      'close': close, 'topic': newTopic, 'note': note, 'title': title});
    if (!close)              // if tab isn't closing animate the brain
        await chrome.runtime.sendMessage({'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
    await chrome.storage.local.set({'saveAndClose': close});
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
    console.count("IN:"+msg.type);
});
