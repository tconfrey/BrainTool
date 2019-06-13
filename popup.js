// this code runs under the popup and controls the tag entry for adding a page to BT

'use strict';

var messageDiv = document.getElementById('message');
var tagDiv = document.getElementById('tag');


function windowOpen(window) {
    console.log("window was opened");
    chrome.extension.getBackgroundPage().btwindow = window;
}

var tabsData;
function listTabs (callback) {
    // fill a storage variable w the tab set
    chrome.windows.getCurrent({populate : true, windowTypes : ['normal']},
                          function (window) {
                              var list = window.tabs;
                              /*
                              for(var i=0;i<window_list.length;i++) {
                                  list = list.concat(window_list[i]);
                                  list = list.concat(window_list[i].tabs);
                              }
                              */
                              console.log(list);
                              tabsData = list;
                              
                              chrome.storage.local.set({tabsList: list}, function() {
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
    console.log("popup acting...");
    var btwin = chrome.extension.getBackgroundPage().btwindow;
    listTabs(function () // get tabs and then open bt window if not open
             {
                 if (!btwin) {
                     chrome.windows.create(wargs, windowOpen);
                 }
                 else {
                     messageDiv.style.display = 'none';
                     tagDiv.style.display = 'block';
                     chrome.storage.local.get('tags', function(data) {
                         var tagsArray = JSON.parse(data.tags);
                         var tagsString = tagsArray.join();
                         console.log("tags = " + tagsString);
                         var tagsArea = document.getElementById('currentTags');
                         tagsArea.innerHTML = tagsString;
                     });
                 }
             }); 
}

popupAction();
