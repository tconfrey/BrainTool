// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var BTTab;
var AllNodes;

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

chrome.runtime.onMessage.addListener((msg, sender) => {
    // First, validate the message's structure.
    switch (msg.from) {
    case 'btwindow':
        if (msg.msg == 'ready') {
            console.log("BT window is ready");
            // maybe give original window focus here?
            chrome.storage.local.get('nodes', function(data) {
                AllNodes = JSON.parse(data.nodes);
                console.log("created nodes: " + AllNodes);
            });
        }
        break;
    case 'popup':
        if (msg.msg == 'moveTab') {
            var tabId = msg.tabId;
            var tag = msg.tag;
            moveTabToWindow(tabId, tag);
        }
        break;
    }
});


function moveTabToWindow (tabId, tag) {
    // Find BTNode associated w tag, move tab to its window if exists, else create it
    var i = 0;
    while ((i < AllNodes.length) && (AllNodes[i].title.fullText != tag)) i++;
    if (i == AllNodes.length) return;                           // shrug
    var BTNode = AllNodes[i];
    if (BTNode.windowId)
        chrome.tabs.move(tabId, {'windowId': BTNode.windowId, 'index': -1}, function(deets) {
            chrome.tabs.highlight({'windowId': BTNode.windowId, 'tabs': deets.index});
            chrome.windows.update(BTNode.windowId, {'focused': true});
        });
    else
        chrome.windows.create({'tabId': tabId}, function(window) {
            BTNode.windowId = window.id;
        });
}
