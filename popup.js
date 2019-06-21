// this code runs under the popup and controls the tag entry for adding a page to BT

'use strict';

var messageDiv = document.getElementById('message');
var tagDiv = document.getElementById('tag');
var newTag = document.getElementById('newtag');
var CurrentTab;

function windowOpen(window) {
    console.log("window was opened");
    chrome.extension.getBackgroundPage().BTTab = window.tabs[0].id;
}

var tabsData;
function getCurrentTab (callback) {
    // fill a storage variable w the tab to be stored
    chrome.tabs.query({active: true, currentWindow: true}, function(list) {
        // NB only one tab should be active and in the current window 
        chrome.storage.local.set({tabsList: list}, function() {
            CurrentTab = list[0];
            console.log("tabsList is set");                              
            if(callback) {
                callback(list);
            }
        });
    });
}

function popupAction () {
    var wargs = {
        'url' : "http://localhost:8000", // 'url' : "bt.html"
        'type' : "panel",
        'top' : 10,
        'left' : 10,
        'width' : 500,
        'height' : 1100 
    }
    var btTab = chrome.extension.getBackgroundPage() ? chrome.extension.getBackgroundPage().BTTab : null;
    // get tab info and then open bt window if not open
    getCurrentTab(function () {
        if (!btTab) {
            chrome.windows.create(wargs, windowOpen);
        }
        else {
            messageDiv.style.display = 'none';
            tagDiv.style.display = 'block';
            chrome.storage.local.get('tags', function(data) {
                var tagsArray = JSON.parse(data.tags);
                var tagsString = tagsArray.join(',&nbsp;&nbsp; ');
                console.log("tags = " + tagsString);
                var tagsArea = document.getElementById('currentTags');
                tagsArea.innerHTML = tagsString;
                var input = document.getElementById("newtag");
                new Awesomplete(input, {
	                list: tagsArray, autoFirst: true
                });
            });
        }
    }); 
}

popupAction();


// set callback on entering new tag, nb need to force blur on enter key
newTag.onkeyup = function(e) {
    if (e.which != 13) return // Enter key
    newTag.blur();
    callBT();
}


function callBT() {
    // Call out to the extension to add current tab to BT
    var nt = newTag.value;                                     // value from text entry field
    var BTTabId = chrome.extension.getBackgroundPage().BTTab;  // extension global for bttab
    
    // Send msg to BT Content script for processing w tab and tag info
    chrome.tabs.sendMessage(
        BTTabId,
        {'type': 'new_tab', 'tag': nt},
        {} , 
        function (rsp) {
            if (rsp)        // Send msg to background to perform move (cos this script ends when looses focus)
                chrome.runtime.sendMessage({
                    from: 'popup',
                    msg: 'moveTab',
                    tabId: CurrentTab.id,
                    tag: nt
                });
            else 
                alert("Must be an error! ");
            window.close();
        });
}

// Listen for messages from other components
chrome.runtime.onMessage.addListener((msg, sender) => {
    switch (msg.from) {
    case 'btwindow':
        if (msg.msg == 'ready') {
            console.log("BT window is ready");
            window.close();
        }
        break;
    }
});
    
