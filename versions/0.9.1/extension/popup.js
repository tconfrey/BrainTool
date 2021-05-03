/*** 
 * 
 * This code runs under the popup and controls the tag entry for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const Note = document.getElementById('note');
const BackgroundPage = chrome.extension.getBackgroundPage();
var CurrentTab;
var AwesomeWidget;
var Defaulted = false;                  // capture whether the tag value was defaulted to window tag
var KeyCount = 0;
var ReadOnly = false;                   // capture whether tab is already stored in BT
var TabAction;                          // current GROUP|CLOSE|STICK action
var Tabs;                               // tabs in current window

chrome.storage.local.get('newVersion', val => {
    if (!val['newVersion']) {           //carry on
        popupAction();
        chrome.runtime.connect();       // tell background popup is open
    } else {
        // Background has received updateAvailable, so inform user and upgrade
        const msg = document.getElementById('message');
        msg.textContent = `New Version Available. \n Upgrading BrainTool to ${val['newVersion']}...`;
        chrome.storage.local.remove('newVersion');
        setTimeout(() => {            
            chrome.tabs.query({title: "BrainTool Chrome Extension"},
                              (tabs => {
                                  if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));
                                  chrome.runtime.reload();
                              }));
        }, 2000);
    }
});

function popupAction () {
    // Activate popup -> populate form is app is open, otherwise open app
    
    if (BackgroundPage.BTTab)
        chrome.tabs.query(              // find active tab to open popup from
            {currentWindow: true}, list => {
                Tabs = list;
                const activeTab = list.find(t => t.active);
//                document.getElementById('allLabel').textContent = "Save all unsaved tabs";
                popupOpen(activeTab);
            });
    else
        windowOpen();
}

function windowOpen() {
    // Called on first click on header button, create the BT panel window

    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    chrome.tabs.query({title: "BrainTool Chrome Extension"},
                      (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));}));

    // Create window, remember it and highlight it
    const version = chrome.runtime.getManifest().version;
    //    const url = "https://BrainTool.org/app/";
    const url = "http://localhost:8000/app/";
    console.log('loading from ', url);
    var wargs = {
        'url' : url,
        'type' : "panel",
        'top' : 10, 'left' : 5,
        'width' : 500, 'height' : 1100
    };
    chrome.windows.create(wargs, function(window) {
        console.log("window was opened");
        chrome.windows.update(window.id, {'focused' : true});
    });
}

function popupOpen(tab) {
    // Open popup ready to tag current tab
    CurrentTab = tab;
    const messageDiv = document.getElementById('message');
    const tagDiv = document.getElementById('tag');
    const newTag = document.getElementById('newtag');
    const tagsArea = document.getElementById('currentTags');
    const heading = document.getElementById('heading');
    const forms = document.getElementById('forms');
    messageDiv.style.display = 'none';
    tagDiv.style.display = 'block';

    chrome.storage.local.get('tags', function(data) {
        // array of [{name: , level:}]
        const tagsArray = data.tags;
        const tags = tagsArray.map(tag => tag.name);
        tagsArea.innerHTML = generateTagsDisplay(tagsArray);
        //newTag.value = "";
        AwesomeWidget = new Awesomplete(newTag, {
	        list: tags, autoFirst: true
        });
    });
    
    // set radio button to saved value if set, otherwise default based on grouping mode
    chrome.storage.local.get({'GroupingMode': 'TABGROUP'}, function(mode) {       
        chrome.storage.local.get({'TabAction': 'unset'}, function(action) {
            TabAction = action['TabAction'];
            let groupingMode = mode['GroupingMode'];
            if (TabAction != 'unset') {
                if (groupingMode == 'NONE' && TabAction == 'GROUP')
                    // Don't allow Group w groupingMode == NONE, default to Stick
                    TabAction = 'STICK';
            } else {
                if (groupingMode == 'NONE')
                    TabAction = 'STICK';
                else
                    TabAction = 'GROUP';
            }
            document.getElementById(TabAction).checked = true;
        });
    });
    
    // Pull currentTag from local storage and prepopulate widget
    chrome.storage.local.get(['currentTabId', 'currentTag', 'currentText', 'windowTopic', 'groupTopic', 'mruTopic', 'mruTime'], data => {
        if (data.currentTag && data.currentTabId && data.currentTabId == tab.id) {
            newTag.value = data.currentTag;
            Defaulted = true;
            ReadOnly = true;
            Note.value = data.currentText;
            Note.disabled = true;
            newTag.disabled = true;
            tagsArea.disabled = true;
            forms.style.display = 'none';
            heading.innerText = "Topic Info:";
            return;
        }
        if (data.windowTopic || data.groupTopic || data.mruTopic) {
            // pre-fill to Window or Group topic, or mru if less than 3 mins old
            const now = new Date();
            const mruAge = data.mruTime ? (now - new Date(data.mruTime)) : 0;
            const value = (data.groupTopic || data.windowTopic ||
                           ((mruAge < 180000) ? data.mruTopic : ''));
            newTag.value = value;
            if (newTag.value) Defaulted = true;
        }
    });
}

function generateTagsDisplay(tagsArray) {
    // given an array of {name:"tag", level:2} generate the display string
    let str = "<ul>";
    let level = 0;
    for (const tag of tagsArray) {
        // non unique tags are passed as a tag path, eg parentTag:childTag
        let name = tag.name.match(/(.*):(.*)/) ? tag.name.match(/(.*):(.*)/)[2] : tag.name;
        if (tag.level == 1) {          // top level always on new line
            str += "</ul>";
            if (level > tag.level)
                str += "</ul>".repeat(level - tag.level);
            str += `<ul><li><span id='${tag.name}'>${name}</span></li>`;
        }
        else {
            if (tag.level == level)
                str += `, <span id='${tag.name}'>${name}</span>`;
            else {
                if (tag.level > level)
                    str += '<ul>'.repeat(tag.level - level);
                else
                    str += '</ul>'.repeat(level - tag.level);
                str += `<li><span id='${tag.name}'>${name}</span>`;
            }
        }
        level = tag.level;
    }
    return str + '</ul>';
}


// NB don't know why but doesn't work w event directly on Note
document.onclick = function(e) {
    if (ReadOnly) return;
    if (e.target == Note)
        newTagEntered();
    if (e.target.tagName == 'SPAN') {
        // tag selected by clicking. Fill in input field and trigger selection
        const val = e.target.textContent;
        document.getElementById('newtag').value = val;
        
        document.querySelectorAll("span").forEach(function(el) {
            el.classList.remove("highlight");
        });
        
        newTagEntered();
    }
    if (e.target.id == 'submit')
        tabAdded();
};
document.getElementById('newtag').onkeydown = function(e) {
    if (e.key == "Tab") {
        newTagEntered();
        e.preventDefault();
    }
    if(e.key == ":") {          // :'s behavior is to select suggestion
        AwesomeWidget.select();
    }
};

// Capture radio button updates and remember choice
document.querySelectorAll('input[name="bta"]').forEach(
    elt => elt.addEventListener('change', function(e) {
        const newTabAction = document.querySelector('input[type="radio"]:checked').value;
        chrome.storage.local.set({'TabAction': newTabAction});
        // ToDO delete:
        TabAction = newTabAction;
    }));

function newTagEntered() {
    // handle tag selection
    if (ReadOnly) return;       // => already a BT node, ignore input
    AwesomeWidget.select();
    const tagName = document.getElementById('newtag').value;
    document.getElementById('groupLabel').title = "Group with open " + tagName + " tabs";
    Note.disabled= false;
    if (Note.value == "Note (or hit Return):")
        Note.value="";          // Remove prompt text, but not previously entered notes
    Note.focus();
}

// set callback on entering tag for tab
window.onkeyup = function(e) {
    // We previously set a default if window already has a tag. Make it easy to delete.
    // NB 2 keys cos if popup is opened via keypress it counts, opened via click does not!
    if (Defaulted && (KeyCount < 2) && (e.key == "Backspace")) {
        const newTag = document.getElementById("newtag");
        newTag.value = "";
    }
    KeyCount++;
    if (e.key != "Enter") {
        document.querySelectorAll("span").forEach(function(el) {
            el.classList.remove("highlight");
        });
        const suggestions = AwesomeWidget.isOpened ? AwesomeWidget.suggestions || [] : [];
        suggestions.forEach(function(sug) {
            document.getElementById(sug.value).classList.add("highlight");
        });
        return;    // Done, unless Enter key
    }

    // Enter in tag field selects note textarea
    if (document.activeElement.id == 'newtag') {
        newTagEntered();
        return;
    }
    // Enter in note => we're done
    tabAdded();
}

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
    
