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
    // Handle messages from bt win content script and popup
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
        if (msg.msg == 'tag_open') {
            openTag(msg.parent, msg.data);
        }
        if (msg.msg == 'node_deleted') {
            deleteNode(msg.nodeId);
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
    while ((parentNode.parent !== null) && !parentNode.windowId) {
        parentNode = AllNodes[parentNode.parent];
    }
    if (parentNode.windowId)
        // open tab in this window
        chrome.tabs.create({'windowId': parentNode.windowId, 'url': url}, function(tab) {
            BTNode.tabId = tab.id;
            BTNode.windowId = parentNode.windowId;
            BTNode.url = url;
        });
    else
        // open new window and assign windowId
        chrome.windows.create({'url': url}, function(window) {
            parentNode.windowId = window.id;
            BTNode.tabId = window.tabs[0].id;
            BTNode.windowId = window.id;
            BTNode.url = url;
        });

    // Send back message that the bt and parent nodes are opened in browser
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_opened', 'BTNodeId': BTNode.id, 'BTParentId': parentNode.id});
}

function openTag(parentId, data) {
    // passed an array of {nodeId, url} to open in top window
    var ary = data;
    var parentNode = AllNodes[parentId];
    if (!parentNode) return;                                    // shrug
    if (parentNode.windowId) {
        // for now close and re-open, shoudl be more elegant
        var win = parentNode.windowId;
        parentNode.windowId = null;
        chrome.windows.remove(win, function() {
            openTag(parentId, data); // once more from the top
        });
    } else {
        // Create array of urls to open
        var urls = []
        for (var i=0; i<ary.length; i++) {
            urls.push(ary[i].url);
            AllNodes[ary[i].nodeId].url = ary[i].url;
        }
        chrome.windows.create({'url': urls}, function(win) {
            // When done record window in local node store (also need tabs?) and send back message per tab
            var id, tab;
            parentNode.windowId = win.id;
            for (var i=0; i<ary.length; i++) {
                id = ary[i].nodeId;
                AllNodes[id].windowId = win.id;
                tab = win.tabs.find(function(element) {
                    return (compareURLs(element.url, AllNodes[id].url));
                });
                AllNodes[id].tabId = tab.id;
                chrome.tabs.sendMessage(
                    BTTab,
                    {'type': 'tab_opened', 'BTNodeId': id, 'BTParentId': parentId});
            }});
    }
}
            
                              
function deleteNode(nodeId) {
    // node was deleted in BT ui. Just do the housekeeping here

    var node = AllNodes[nodeId];
    
    // Remove node. NB deleting cos I'm using ID for array index - maybe shoudl have a level of indirection?
    delete(AllNodes[nodeId]);
    
    // Remove from parent
    var parent = node.parent;
    if ((!parent) || (!parent.children)) return;
    for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i] == node) {
            parent.children.splice(i, 1);
            break;
        }
    }
}

function moveTabToWindow(tabId, tag) {
    // Find BTNode associated w tag, move tab to its window if exists, else create it
    
    var i = 0;
    var BTNode = {};
    while ((i < AllNodes.length) && (AllNodes[i].title.fullText != tag)) i++;
    if (i == AllNodes.length) {           // Need to create new top level section
        BTNode = {'children': [], 'parent': null, 'id': AllNodes.length,
                      'windowId': null, 'tabId': null, 'url': null,
                      title: {fullText: tag, summaryText: null}
                     };
        AllNodes.push(BTNode);
    }
    
    var parentNode = AllNodes[i];
    // walk up containment to a node with a window assigned or to the top
    while ((parentNode.parent !== null) && !parentNode.windowId) {
        parentNode = AllNodes[parentNode.parent];
    }
    
    if (parentNode.windowId)
        chrome.tabs.move(tabId, {'windowId': parentNode.windowId, 'index': -1}, function(deets) {
            chrome.tabs.highlight({'windowId': parentNode.windowId, 'tabs': deets.index});
            chrome.windows.update(parentNode.windowId, {'focused': true});
        });
    else
        chrome.windows.create({'tabId': tabId}, function(window) {
            AllNodes[i].windowId = window.id;
        });

    // get tab url, then create and store new BT node
    chrome.tabs.get(tabId, function(tab) {
        BTNode = {'children': [], 'parent': i, 'id': AllNodes.length,
                  'windowId': AllNodes[i].windowId, 'tabId': tabId,
                  'url': tab.url, title: {fullText: tab.url, summaryText: null}};
        AllNodes[AllNodes.length] = BTNode;
 //       AllNodes[i].children.push(BTNode); // add to parent
        
        // Send back message that the bt and parent nodes are opened in browser
        chrome.tabs.sendMessage(
            BTTab,
            {'type': 'tab_opened', 'BTNodeId': BTNode.id, 'BTParentId': parentNode.id});
    });
}

function compareURLs(first, second) {
    // sometimes I get trailing /'s other times not, also treat http and https as the same
    first = first.replace("https", "http").replace(/\/$/, "");
    second = second.replace("https", "http").replace(/\/$/, "");
    return (first == second);
}

chrome.tabs.onRemoved.addListener((tabId, otherInfo) => {
    // listen for tabs being closed, if its a managed tab let BT know
    if (tabId == BTTab) {
        console.log("BT closed!");
        BTTab = null;
        AllNodes = [];
        return;
    }
    var node = AllNodes ? AllNodes.find(function(node) {
        return (node.tabId == tabId);}) : null;
    if (!node) return;
    node.tabId = null; node.windowId = null;
    console.log("closed tab:" + tabId);
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_closed', 'BTNodeId': node.id});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, state) => {
    // Handle a BT tab being migrated to a new url
    if (!AllNodes || !changeInfo.url) return;                 // don't care
    var node = AllNodes ? AllNodes.find(function(node) {
        return (node.tabId == tabId);}) : null;
    if (!node) return;
    if (compareURLs(node.url, changeInfo.url)) return;
    node.tabId = null; node.windowId = null;
    console.log("navigated tab:" + tabId);
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_closed', 'BTNodeId': node.id});

});

chrome.windows.onRemoved.addListener((windowId) => {
    // listen for windows being closed
    var node = AllNodes ? AllNodes.find(function(node) {
        return (node.windowId == windowId);}) : null;
    if (!node) return;
    console.log("closed window:" + windowId);
    node.windowId = null;
    chrome.tabs.sendMessage(
        BTTab,
        {'type': 'tab_closed', 'BTNodeId': node.id});
});
