---
layout: post
title:  "FireFox News - Good, Bad & Weird"
description: Challenges found 
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
image: "../../../site/postAssets/FireFox-Screenshot.png"
---
# BrainTool on FireFox?
Recently a user let me know that someone had posted BrainTool to the FireFox Add-On store (thanks Jeff!) They just totally took the code, images, text and all the artifacts and posted it as their own! It wasn't ported and totally didn't work. So that's the weird news! I had it taken down; but it prompted me to pick up the "port to FF" task off my backlog.
<!--more-->

The good news is that as of FF 139, released last month, tabgroups are now supported, so a port finally makes sense. Also good news for me was that it looked like the chrome.* api calls could be used as is and all the other APIs I used were supported. So I started down the path by making the required manifest changes and testing things out. Also good news is that I liked the way BT looked and functioned within FireFox (screenshot below).

The bad news is that I found a number of differences and issues such that I'm putting the task back in the backlog for now :-(

<br/><img src="/site/postAssets/FireFox-Screenshot.png" alt="Buddy points" style="width: 90%; padding-left: 5%">
## Here's a brief list of the issues
This is a heads up for anyone trying something similar, as well as future me.

- **Sidebar vs Side Panel**<br/>
While they seem the same, FF's long existing sidebar feature has a different operating model in terms of persistent UI and user interaction. In the long run it could be more functional, but not an easy port. 
- **windows.onBoundsChanged**<br/>
FF does not support this event which I use to remember where you like the BT Topic Manager window placed on opening.
- **bookmarks.onChildrenReordered**<br/>
FF does not support this event meaning that bookmark bar syncing won't work out of the box.
- **ES6 (import/export)** <br/>
I've been using importScripts rather than explicit import/exports and modules. FF does not support this on Manifest V3. I've been meaning to migrate to modules anyway so I just got this one done.
- **Different manifest files**<br/>
Differences in the file formats means I need to maintain two manifests.
- **My bugs - the straw on the camels back!**<br/>
In FF the service worker (ie the process that runs the extension code) seems to get shut down much more immediately than on Chromium and sometimes the port connection between the BT extension and the topic manager does not subsequently get reestablished, so the extension basically stops working. The missing reconnect is probably some kind of bug in my connectivity management code and might be a trivial fix, but taken together with the other uncovered issues it makes the project too big to handle right now. 

I do like the way BT looks and works in FireFox though and its a frequent request, so I will get back to it. Later!


