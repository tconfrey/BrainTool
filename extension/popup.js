/*** 
 * 
 * This code runs under the popup and controls the tag entry for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const Note = document.getElementById('note');
var CurrentTab;
var AwesomeWidget;

function popupAction (bgPage) {
    // Activate popup -> open bt window if not open, otherwise populate tag entry form

    const btTab = bgPage.BTTab;                              // BT tab if open already
    if (!btTab) {
        windowOpen();
    } else {
        getCurrentTab(function (tab) {
            const messageDiv = document.getElementById('message');
            const tagDiv = document.getElementById('tag');
            messageDiv.style.display = 'none';
            tagDiv.style.display = 'block';
            console.log("this tab:", tab.id, "\n ManagedTabs:", btTab.ManagedTabs);
            if (bgPage.ManagedTabs && bgPage.ManagedTabs.includes(CurrentTab.id)) {
                ReadOnly = true;
            }
            // should be set, but default to be safe
            const tabAction = bgPage ? bgPage.TabAction || 'pop' : 'pop';
            chrome.storage.local.get('tags', function(data) {
                // array of [{name: , level:}]
                const tagsArray = data.tags;
                const tags = tagsArray.map(tag => tag.name);
                const newTag = document.getElementById('newtag');
                const tagsArea = document.getElementById('currentTags');
                tagsArea.innerHTML = generateTagsDisplay(tagsArray);
                newTag.value = "";
                AwesomeWidget = new Awesomplete(newTag, {
	                list: tags, autoFirst: true
                });
                // set radio button
                document.getElementById(tabAction).checked = true;
                // Pull currentTag from local storage and prepopulate widget
                chrome.storage.local.get('currentTag', function(data) {
                    newTag.value = data.currentTag;
                    Defaulted = true;
                    if (ReadOnly) {
                        Note.value = "This tab is already under BT control";
                        Note.disabled = true;
                        newTag.disabled = true;
                    }
                });
            });
        }); 
    }
}

function windowOpen() {
    // Called on first click on header button, create the BT panel window

    // First check for existing BT Tab eg error condition or after an Extension restart.
    // Either way best thing is to kill it and start fresh.
    chrome.tabs.query({title: "BrainTool Chrome Extension"},
                      (tabs => {if (tabs.length) chrome.tabs.remove(tabs.map(tab => tab.id));}));

    // Create window, remember it and highlight it
    const version = chrome.runtime.getManifest().version;
    var wargs = {
<<<<<<< HEAD
        //'url' : "http://localhost:8000/app", // "https://tconfrey.github.io/BrainTool/app",
        'url' : "https://BrainTool.org/app", 
=======
        'url' : "http://localhost:8000/app/versions/"+version,
        //'url' : "https://BrainTool.org/app/versions/"+version, 
>>>>>>> 890763c... new versioning scheme. creating a versions/0.6.0 sub directory so extension can ask for code specific to its version.
        'type' : "panel",
        'top' : 10, 'left' : 10,
        'width' : 500, 'height' : 1100
    };
    chrome.windows.create(wargs, function(window) {
        console.log("window was opened");
        chrome.windows.update(window.id, {'focused' : true});
    });
}


function getCurrentTab (callback =  null) {
    // fill a storage variable w the tab to be stored
    chrome.tabs.query({active: true, currentWindow: true}, function(list) {
        // NB only one tab should be active and in the current window 
        chrome.storage.local.set({tabsList: list}, function() {
            CurrentTab = list[0];
            if(callback) {
                callback(list[0]);
            }
        });
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


var Defaulted = false;                  // capture whether the tag value was defaulted to window tag
var KeyCount = 0;
var ReadOnly = false;                   // capture whether tab is already stored in BT => should not edit here


chrome.runtime.getBackgroundPage(function(bgp) {
    if (bgp)
        popupAction(bgp);
    else
        alert ("BT Background page not initialized, try again");
});

// NB don't know why but doesn't work w event directly on Note
document.onclick = function(e) {
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

// Capture radio button updates and update background page
document.querySelectorAll('input[name="bta"]').forEach(
    elt => elt.addEventListener('change', function(e) {
        const newTabAction = document.querySelector('input[type="radio"]:checked').value;
        const bgPage = chrome.extension.getBackgroundPage();
        if (bgPage)
            bgPage.TabAction = newTabAction;
    }));

function newTagEntered() {
    // handle tag selection
    if (ReadOnly) return;       // => already a BT node, ignore input
    AwesomeWidget.select();
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
    // Call out to BT app to inform of new node, then update the bckground script

    // value from text entry field may be tag, parent:tag, tag:keyword, parent:tag:keyword
    // where tag may be new, new under parent, or existing but under parent to disambiguate
    const nt = document.getElementById('newtag').value;          
    if (nt == "") return;
    const noteText = Note.value;
    const bgPage = chrome.extension.getBackgroundPage();
    const BTTabId = bgPage.BTTab;                 // extension global for bttab
    const tabAction = bgPage.TabAction;           // pop|close|hide from radio btn in popup
    const message = {'type': 'new_tab', 'tag': nt, 'note': noteText};

    // Remember this tab is a BT managed tab
    let mTabs = bgPage.ManagedTabs;
    mTabs.push(CurrentTab.id);
    bgPage.ManagedTabs = mTabs;
    
    // Send msg to BT app for processing w text and tag info, then update bg
    chrome.tabs.sendMessage(
        BTTabId,
        message, 
        function (rsp) {
            if (tabAction == 'close')
                chrome.tabs.remove(CurrentTab.id);
            if (rsp) {
                // Send msg to background to perform appropriate add node or add & move action.
                // Move may pop or not. (NB this script ends when looses focus.)
                const msgType = (tabAction == 'close') ? 'add_tab' : 'add_move_tab';
                chrome.runtime.sendMessage({
                    from: 'popup',
                    msg: msgType,
                    tabId: CurrentTab.id,
                    tag: nt,
                    title: `[[${CurrentTab.url}][${CurrentTab.title}]]`
                });
            }
            else // Shouldn't get here
                alert("Error in tabAdded!");
            window.close();
        });
}

// Listen for messages from other components. Currently just to know to close BT popup.
chrome.runtime.onMessage.addListener((msg, sender) => {
    switch (msg.from) {
    case 'btwindow':
        if (msg.msg == 'window_ready') {
            console.log("BT window is ready");
            window.close();
        }
        break;
    }
    console.count("IN:"+msg.msg);
});
    
