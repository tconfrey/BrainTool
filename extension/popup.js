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
    chrome.windows.create(wargs, function(window) {
        if (window) return(window);
        else {
            console.warn('error in windowOpen:', chrome.runtime.lastError?.message);
            wargs.top = 50; wargs.left = 50;
            chrome.windows.create(wargs);
        }
    });
}

chrome.storage.local.get(['newInstall', 'newVersion', 'ManagerHome', 'ManagerLocation', 'Theme', 'BTTab'], val => {
    console.log(`local storage: ${JSON.stringify(val)}`);
	const welcomeDiv = document.getElementById('welcome');
	const messageDiv = document.getElementById('message');
    BTTab = val.BTTab;
    if (val['newInstall']) {
	    // This is a new install, show the welcome page
	    messageDiv.style.display = 'none';
	    welcomeDiv.style.display = 'block';
	    newInstall = true;
        chrome.storage.local.remove('newInstall');
	    return;
    }
    
    if (val['newVersion']) {
	    // Background has received updateAvailable, so inform user and upgrade
        messageDiv.textContent = `New Version Available. \n Upgrading BrainTool to ${val['newVersion']}...`;
        chrome.storage.local.remove('newVersion');
        setTimeout(() => {            
            chrome.tabs.query({title: "BrainTool Topic Manager"},
                              (tabs => {
                                  if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));
                                  chrome.runtime.reload();
                              }));
        }, 2000);
	    return;
    }
    if (val['Theme']) {        
        // Change theme by setting attr on document which overide a set of vars. see top of .css
        document.documentElement.setAttribute('data-theme', val['Theme']);
    }

    // Else just normal popup either in tab or side panel
    const home = val['ManagerHome'] || 'PANEL';
    const location = val['ManagerLocation'];
    popupAction(home, location);
    chrome.runtime.connect();           // tell background popup is open
    return;
});

function popupAction (home, location) {
    // Activate popup -> populate form if app is open, otherwise open app
    
    if (BTTab)
        chrome.tabs.query(              // find active tab to open popup from
            {currentWindow: true}, list => {
                Tabs = list;
                const activeTab = list.find(t => t.active);
                popupOpen(activeTab);
            });
    else
        windowOpen(home, location);
}

document.getElementById("okButton").addEventListener('click', e => windowOpen());
function windowOpen(home = 'PANEL', location) {
    // Called on first click on header button (or ok in welcomediv), create the BT Topic Manager
    // home == tab => create manager in a tab, PANEL => in a side panel, default
    // location {top, left, width, height} filled in by bg whenever Topic Manager is resized

    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'block';
    chrome.tabs.query({title: "BrainTool Topic Manager"},
                      (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));}));

    // Create window, remember it and highlight it
    const version = chrome.runtime.getManifest().version;
   // const url = "https://BrainTool.org/app/";
    const url = "http://localhost:8000/app/"; // versions/"+version+"/app/";
   // const url = "https://BrainTool.org/versions/"+version+'/app/';
    console.log('loading from ', url);

    // Default open in side panel
    if (home != "TAB") {
        chrome.windows.getCurrent(mainwin => {
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
	        location || chrome.windows.update(mainwin.id, {state: 'normal', focused: false,
                                                           left: (mainwin.left + 300)});
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
const SavePage =  document.getElementById("savePage");
const SaveWindow =  document.getElementById("saveAllPages");
const SaveSession =  document.getElementById("saveAllSession");

SavePage.addEventListener('change', e => {
    if (SavePage.checked) {SaveWindow.checked = false; SaveSession.checked = false;}
    else SaveWindow.checked = true;
    updateForAll();
});
SaveWindow.addEventListener('change', e => {
    if (SaveWindow.checked) {SavePage.checked = false; SaveSession.checked = false;}
    else SavePage.checked = true;
    updateForAll();
});
SaveSession.addEventListener('change', e => {
    if (SaveSession.checked) {SavePage.checked = false; SaveWindow.checked = false;}
    else SavePage.checked = true;
    updateForAll();
});
function updateForAll(all) {
    // handle AllPages toggle
    const onePageElements = document.getElementsByClassName("onePage");
    const allPageElements = document.getElementsByClassName("allPages");
    if (SaveWindow.checked || SaveSession.checked) {
        Array.from(onePageElements).forEach(e => e.style.display = "none");
        Array.from(allPageElements).forEach(e => e.style.display = "block");
    } else  {
        Array.from(onePageElements).forEach(e => e.style.display = "block");
        Array.from(allPageElements).forEach(e => e.style.display = "none");
    }
}

function popupOpen(tab) {
    // Get data from storage and launch popup w card editor, either existing node or new
    CurrentTab = tab;
    const messageElt = document.getElementById('message');
    const saverDiv = document.getElementById("saver");
    const titleH2 = document.getElementById('title');
    saverDiv.style.display = 'block';
    messageElt.style.display = 'none';
    
    // Pull data from local storage, prepopulate and open saver
    chrome.storage.local.get(
        ['tags', 'currentTabId', 'currentTag', 'currentText',
         'currentTitle', 'mruTopics', 'saveAndClose'],
        data => {
            console.log(`title [${tab.title}], len: ${tab.title.length}, substr:[${tab.title.substr(0, 100)}]`);
            let title = (tab.title.length < 150) ? tab.title :
                tab.title.substr(0, 150) + "...";            
            titleH2.textContent = title;
            
            if (!data.saveAndClose) {
                // set up save and group as default
                SaveAndGroupBtn.classList.add("activeButton");
                SaveAndCloseBtn.classList.remove("activeButton");
            }
            
            // BT Page => just open card
            if (data.currentTag && data.currentTabId && (data.currentTabId == tab.id)) {
                OldTopic = data.currentTag;
                document.getElementById('topicSelector').style.display = 'none';
                document.getElementById('saveCheckboxes').style.display = 'none';
                TopicCard.setupExisting(tab, data.currentText,
                                        data.currentTitle, saveCB);
                return;
            }

            // New page. Guess at topic and open card
            Topics = data.tags;
            if (data.mruTopics) {
                // pre-fill to mru topic for window
                const windowId = tab.windowId;
                Guess = data.mruTopics[windowId] || '';
            }
            TopicSelector.setup(Guess, Topics, topicSelected);
            TopicCard.setupNew(tab.title, tab, cardCompleted);
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
    // save topic card for page, optionally close tab
    // Call out to BT app which handles everything
    const title = TopicCard.title();
    const note = TopicCard.note();
    const url = CurrentTab.url;
    const newTopic = OldTopic || TopicSelector.topic();
    const allTabs = SaveWindow.checked;
    const wholeSession = SaveSession.checked;
    const tabsToStore = allTabs ? Tabs : new Array(CurrentTab);

    if (wholeSession) {
        // send message to background to save whole session
        await chrome.runtime.sendMessage(
            {'from': 'popup', 'function': 'importSession', 'close': close, 'topic': newTopic});
    }
    else if (allTabs || title) {
        // need a topic and either an applied url/title or alltabs
        
        let message = {'function': 'storeTabs', 'tag': newTopic, 'note': note,
                       'windowId': CurrentTab.windowId,
                       'tabAction': close ? "CLOSE" : "GROUP"};
        let tabsData = [];
        tabsToStore.forEach(tab => {
            // Send msg per tab to BT app for processing w text, topic and title info
            const tabData = {'url': tab.url, 'title': allTabs ? tab.title : title,
                             'tabId': tab.id, 'tabIndex': tab.index, 'faviconUrl': tab.favIconUrl};
            tabsData.push(tabData);
        });
        message.tabsData = tabsData;
        await chrome.tabs.sendMessage(BTTab, message);
        
        if (!close)              // if tab isn't closing animate the brain
            await chrome.runtime.sendMessage(
                {'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
    }
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
