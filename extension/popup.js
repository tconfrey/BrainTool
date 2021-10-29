/*** 
 * 
 * This code runs under the popup and controls the tag entry for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const BackgroundPage = chrome.extension.getBackgroundPage();
var CurrentTab;
var ReadOnly = false;                   // capture whether tab is already stored in BT
var Tabs;                               // tabs in current window
var newInstall = false;                 // set below, ignore some events if = true

// show Alt or Option appropriately in visible text (Mac v PC)
const OptionKey = (navigator.appVersion.indexOf("Mac")!=-1) ? "Option" : "Alt";
const altOpt = document.getElementById('alt_opt');
altOpt.textContent = OptionKey;


chrome.storage.local.get(['newInstall', 'newVersion'], val => {
    if (val['newInstall']) {
	    // This is a new install, show the welcome page
	    const welcomeDiv = document.getElementById('welcome');
	    const messageDiv = document.getElementById('message');
	    messageDiv.style.display = 'none';
	    welcomeDiv.style.display = 'block';
	    newInstall = true;
        chrome.storage.local.remove('newInstall');
	    return;
    }
    
    if (val['newVersion']) {
	    // Background has received updateAvailable, so inform user and upgrade
        const msg = document.getElementById('message');
        msg.textContent = `New Version Available. \n Upgrading BrainTool to ${val['newVersion']}...`;
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

    // Else just normal popup
    popupAction();
    chrome.runtime.connect();           // tell background popup is open
    return;
});

function popupAction () {
    // Activate popup -> populate form if app is open, otherwise open app
    
    if (BackgroundPage.BTTab)
        chrome.tabs.query(              // find active tab to open popup from
            {currentWindow: true}, list => {
                Tabs = list;
                const activeTab = list.find(t => t.active);
                popupOpen(activeTab);
            });
    else
        windowOpen();
}

document.getElementById("okButton").addEventListener('click', e => windowOpen());
function windowOpen() {
    // Called on first click on header button (or ok in welcomediv), create the BT Topic Manager

    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'block';
    chrome.tabs.query({title: "BrainTool Topic Manager"},
                      (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));}));

    // Create window, remember it and highlight it
    const version = chrome.runtime.getManifest().version;
    //const url = "https://BrainTool.org/app/";
    const url = "http://localhost:8000/app/";
    //const url = "https://BrainTool.org/versions/"+version+'/app/';
    console.log('loading from ', url);
    var wargs = {
        'url' : url,
        'type' : "panel",
	    'state' : "normal",
        'focused' : true,
        'top' : 10, 'left' : 5,
        'width' : 500, 'height' : screen.height
    };
    
    chrome.windows.getCurrent(mainwin => {
	    // resize current win to accomodate side-panel. nb state can't be 'maximized'
	    chrome.windows.update(mainwin.id, {state: 'normal', focused: false,
					                       left: 500, width: (screen.width - 500)});
	    // open BT win
	    chrome.windows.create(wargs);
    });
}

function popupOpen(tab) {
    // Get data from storage and launch popup. Topic Selector if new page, Card editor if not
    CurrentTab = tab;
    const messageElt = document.getElementById('message');
    const headingElt = document.getElementById("heading");
    headingElt.style.display = 'block';
    messageElt.style.display = 'none';
    
    // Pull data from local storage, prepopulate and open selector or card
    chrome.storage.local.get(
        ['tags', 'currentTabId', 'currentTag', 'currentText',
         'windowTopic', 'groupTopic', 'mruTopic', 'mruTime'],
        data => {

            // BT Page, just open card
            if (data.currentTag && data.currentTabId && data.currentTabId == tab.id) {
                TopicCard.setup(data.currentTag, data.currentTag, tab, data.currentText, saveCB);
                return;
            }

            // New page. Guess at topic and open selector 
            let guess = null;
            if (data.windowTopic || data.groupTopic || data.mruTopic) {
                // pre-fill to Window or Group topic, or mru if less than 3 mins old
                const now = new Date();
                const mruAge = data.mruTime ? (now - new Date(data.mruTime)) : 0;
                guess = (data.groupTopic || data.windowTopic ||
                         ((mruAge < 180000) ? data.mruTopic : ''));
            }
            TopicSelector.setup(guess, data.tags, selectedCB);
        });
}

function selectedCB(e) {
    // topic has been selected. Close selector and open topic card
    TopicSelector.close();
    let dn = e?.selectorData?.dn || "";
    const textEntered = e?.selectorData?.topicText || "";

    if (!dn)
        dn = textEntered;                                         // new topic so no dn
    else {
        const colonIndex = textEntered.indexOf(":");
        if (colonIndex > 0) dn += textEntered.substr(colonIndex); // show new subtopic and/or TODO
    }
    TopicCard.setup(textEntered, dn, CurrentTab, "", saveCB);
}

function saveCB(e, saveAndClose = false) {
    // save topic card for page
    // Call out to BT app which handles everything
    const data = e.data;
    const title = data.title;
    const text = data.text;
    const url = data.url;
    const newTopic = data.newTopic;
    const allTabs = data.saveAll;
    const tabsToStore = allTabs ? Tabs : new Array(CurrentTab); // dropping AllTabs for now
    const action = saveAndClose ? 'CLOSE' : 'GROUP';            // dropping STICK
    const BTTabId = BackgroundPage.BTTab;                       // extension global for bttab
    if (newTopic && (allTabs || (url && title))) {
        // neww a topic and either an applied url/title or alltabs
        
        let message = {'function': 'storeTabs', 'tag': newTopic, 'note': text,
                       'windowId': CurrentTab.windowId, 'tabAction': action};
        let tabsData = [];
        tabsToStore.forEach(tab => {
            // Send msg per tab to BT app for processing w text and tag info
            const tabData = {'url': tab.url, 'title': tab.title, 'tabId': tab.id};
            tabsData.push(tabData);
        });
        message.tabsData = tabsData;
        chrome.tabs.sendMessage(BTTabId, message);
        
        // now send tabopened to bt or close tab to bg. Then send group to bt as necessary
        if (action != 'CLOSE')              // if tab isn't closing animate the brain
            chrome.runtime.sendMessage(
                {'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
    }    
    window.close();
}

/*
function tabAdded() {
    // Call out to BT app which handles everything

    // value from text entry field may be tag, parent:tag, tag:keyword, parent:tag:keyword
    // where tag may be new, new under parent, or existing but under parent to disambiguate
    const newTag = document.getElementById('newtag').value;          
    if (newTag == "") return;
    let noteText = Note.value.replace(/\s+$/g, '');       // remove trailing newlines/validate
    if (noteText.startsWith('Note (or hit Return):')) noteText = '';
    const BTTabId = BackgroundPage.BTTab;                 // extension global for bttab
    const cb = document.getElementById('all');
    const allTabs = cb.checked;                           // is the All Tabs checked
    const tabsToStore = allTabs ? Tabs : new Array(CurrentTab);

    let message = {'function': 'storeTabs', 'tag': newTag, 'note': noteText,
                   'windowId': CurrentTab.windowId, 'tabAction': TabAction};
    let tabsData = [];
    tabsToStore.forEach(tab => {
        // Send msg per tab to BT app for processing w text and tag info
        const tabData = {'url': tab.url, 'title': tab.title, 'tabId': tab.id};
        tabsData.push(tabData);
    });
    message.tabsData = tabsData;
    chrome.tabs.sendMessage(BTTabId, message);
    
    // now send tabopened to bt or close tab to bg. Then send group to bt as necessary
    if (TabAction != 'CLOSE')              // if tab isn't closing animate the brain
        chrome.runtime.sendMessage(
            {'from': 'popup', 'function': 'brainZoom', 'tabId': CurrentTab.id});
    window.close();
}
*/

// Listen for messages from other components. Currently just to know to close BT popup.
chrome.runtime.onMessage.addListener((msg, sender) => {
    switch (msg.from) {
    case 'btwindow':
        if (msg.function == 'initializeExtension') {
            console.log("BT window is ready");
           // window.close();
        }
        break;
    }
    console.count("IN:"+msg.type);
});
    
