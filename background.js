// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});

chrome.browserAction.onClicked.addListener(function () {
    var wargs = {
//        'url' : "bt.html"
        'url' : "http://localhost:8000",
        'type' : "panel",
        'top' : 10,
        'left' : 10,
        'width' : 500,
        'height' : 1100 
    }
    console.log("opening window");
    listTabs(function () // get tabs and then open bt window if not open
             {
                 if (!btwindow)
                     chrome.windows.create(wargs, windowOpen);
                 else
                     chrome.storage.local.get('tags', function(data) {
                         console.log("tags = " + data);
                     });
             }); 
});

var btwindow;
function windowOpen(window) {
    console.log("window was opened");
//    window.postMessage("hey", "*");
    btwindow = window;
}

/*
chrome.webNavigation.onCompleted.addListener(
    function() {
        alert("opened!");
        //btwindow.postMessage("hey", "*");
    },
    {url: [{urlContains : 'localhost'}]
    }
);
*/

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
