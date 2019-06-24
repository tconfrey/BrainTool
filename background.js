// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var BTTab;
var AllNodes;                   // array of {parent, children[], id, windowId, tabId, text: {fullText, summaryText}}

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
        if (msg.msg == 'link_click') {
            openNode(msg.nodeId, msg.url);
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

function openNode(nodeId, url) {
    // handle click on a link - open in appropriate window
    var BTNode = AllNodes[nodeId];
    if (BTNode.tabId && BTNode.windowId) {
        chrome.tabs.highlight({'windowId': BTNode.windowId, 'tabs': BTNode.tabId});
        chrome.windows.update(BTNode.windowId, {'focused': true});
        return;
    }
    var parentNode = BTNode;
    // walk up containment to a node with a window assigned or to the top
    while (parentNode.parent && !parentNode.windowId) {
        parentNode = AllNodes[parentNode.parent];
    }
    if (parentNode.windowId)
        // open tab in this window
        chrome.tabs.create({'windowId': parentNode.windowId, 'url': url}, function(tab) {
            BTNode.tabId = tab.id;
            BTNode.windowId = parentNode.windowId;
        });
    else
        // open new window and assign windowId
        chrome.windows.create({'url': url}, function(window) {
            parentNode.windowId = window.id;
            BTNode.tabId = window.tabs[0].id;
            BTNode.windowId = window.id;
        });

    // Send back message that the bt and parent nodes are opened in browser
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_opened', 'BTNodeId': BTNode.id, 'BTParentId': parentNode.id});
}
           

function moveTabToWindow (tabId, tag) {
    // Find BTNode associated w tag, move tab to its window if exists, else create it
    var i = 0;
    while ((i < AllNodes.length) && (AllNodes[i].title.fullText != tag)) i++;
    if (i == AllNodes.length) return;                           // shrug
    
    var sectionNode = AllNodes[i];
    var parentNode = sectionNode;
    // walk up containment to a node with a window assigned or to the top
    while (parentNode.parent && !parentNode.windowId) {
        parentNode = AllNodes[parentNode.parent];
    }
    
    if (parentNode.windowId)
        chrome.tabs.move(tabId, {'windowId': parentNode.windowId, 'index': -1}, function(deets) {
            chrome.tabs.highlight({'windowId': parentNode.windowId, 'tabs': deets.index});
            chrome.windows.update(parentNode.windowId, {'focused': true});
        });
    else
        chrome.windows.create({'tabId': tabId}, function(window) {
            sectionNode.windowId = window.id;
        });

    // create and store new BT node
    var BTNode = {'children': [], 'parent': sectionNode, 'id': AllNodes.length,
                  'windowId': sectionNode.windowId, 'tabId': tabId};
    AllNodes.push(BTNode);

    // Send back message that the bt and parent nodes are opened in browser
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_opened', 'BTNodeId': BTNode.id, 'BTParentId': parentNode.id});
}
