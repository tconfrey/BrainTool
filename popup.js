// this code runs under the popup and controls the tag entry for adding a page to BT

'use strict';

var messageDiv = document.getElementById('message');
var tagDiv = document.getElementById('tag');
var newTag = document.getElementById('newtag');


function windowOpen(window) {
    console.log("window was opened");
    chrome.extension.getBackgroundPage().btwindow = window;
}

var tabsData;
function listTabs (callback) {
    // fill a storage variable w the tab to be stored
    chrome.tabs.query({active: true, currentWindow: true}, function(list) {

     // NB only one tab should be active and in the current window 
        chrome.storage.local.set({tabsList: list}, function() {
            console.log("tabsList is set");                              
            if(callback) {
                callback(list);
            }
        });
    });

    /* Commenting out all tabs storage in favor of current tab
    chrome.windows.getCurrent({populate : true, windowTypes : ['normal']},
                          function (window) {
                              var list = window.tabs;
                              
                              for(var i=0;i<window_list.length;i++) {
                                  list = list.concat(window_list[i]);
                                  list = list.concat(window_list[i].tabs);
                              }
                              
                              console.log(list);
                              tabsData = list;
                              
                              chrome.storage.local.set({tabsList: list}, function() {
                                  console.log("tabsList is set");                              
                                  if(callback) {
                                      callback(list);
                                  }
                              });
                             
                          });
    */
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
    var btwin = chrome.extension.getBackgroundPage().btwindow;
    listTabs(function () // get tab info and then open bt window if not open
             {
                 if (!btwin) {
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
    var btwin = chrome.extension.getBackgroundPage().btwindow; // extension global for bt window
    var tabId = btwin.tabs[0].id;                              // only one tab

    // Send msg to BT Content script for processing w tab and tag info
    chrome.tabs.sendMessage(
        tabId,
        {'type': 'new_tab', 'tag': nt},
        {} , 
        function (rsp) {
            if (rsp)
                console.log(rsp);
            else
                console.log("Must be an error! ");
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
    }
});
