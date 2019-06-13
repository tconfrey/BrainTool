// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onInstalled.addListener(function() {});
var btwindow;

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
        }
    }
});
