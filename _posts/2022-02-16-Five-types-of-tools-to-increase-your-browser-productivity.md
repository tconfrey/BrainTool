---
layout: post
title:  "Five types of tools to increase your browser productivity"
description: "I describe Tabs managers, session managers, bookmark managers, task managers and personal knowledge managers"
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
---
# Five types of tools to improve your browser productivity

We're all spending more and more time working in a browser. We sit with a bunch of tabs open, trying to keep up with the deluge of information inflow. It can be overwhelming. All those tabs are distracting and slow down your computer; but each one is an open loop - an article to read, a todo item, an inbox, a video to skim or study deeply. Without someplace safe to save them we might loose them. Even with some place safe, restoring the context will take time and mental effort. So we leave them open.

BrainTool is a lightweight second brain tool designed to make working in a browser more efficient. It is part of an ecosystem of browser extensions and web apps that have sprung up recently to address aspects of these problems. This article is a survey of the five main classes of tools within that ecosystem. The examples are not meant to be exhaustive, nor are they endorsements - I mostly just use BrainTool!
<!--more-->

## Tabs Managers and Session Managers
The two major symptoms of the too-many-tabs problem are human and computer overload. Tabs managers address these symptoms by making it easy to close a bunch of tabs such that you can get them back later (easing mental overload), or by suspending/deactivating tabs such that they stop using resources (easing computer overload). 

[One Tab](https://www.one-tab.com/) turns all the tabs in a window into a single new tab with links to each previous tabs content. [Tab Suspender](https://chrome.google.com/webstore/detail/tab-suspender/fiabciakcmgepblmdkmemdbbkilneeeh) replaces inactive tabs with a static image of the tabs contents.

A step up in terms of complexity are session managers which save and manage sets of tabs geared to a particular purpose. [Session Buddy](https://chrome.google.com/webstore/detail/session-buddy/edacconmaakjimmfgnblocblbcdcpbko) lets you see and manage open tabs, to save sets of tabs into a named session and to restore previous sessions. [Tabs Outliner](https://chrome.google.com/webstore/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl) shows a side panel window with a hierarchical representation of sessions, windows and tabs with associated notes. Live and historical sessions are intermingled.

Worth noting here is the 'Tab Groups' feature in most modern browsers. [Tab groups](https://blog.google/products/chrome/manage-tabs-with-google-chrome/) provide a visual color-coded and named grouping of tabs which can be collapsed to save space in the tab row. They can be considered an in-browser session.

BrainTool can fill the role of a session manager with tree functionality similar to TabsOutliner and the ability to save and restore sets of annotated tabs. By default BT groups tabs for a topic into a tab group.

## Bookmark Managers
While tabs and session managers are oriented around browser tabs and windows, bookmark managers focus on the contents of the tabs, helping you keep track of your information where it lives, outside the browser. Obviously the default bookmarker is the browser built-in, but those have not kept pace with the increasing complexity of our online lives.

There are many approaches to bookmarkers with different primary purposes and varying organizational and retrieval schemes. Here are some common flavors.

### Organizers
The basic function of a bookmark manager is to help you organize your stuff. Organizers generally have a dedicated tab with some representation of bookmarks in various groupings or nested categories. [Bookmark Ninja](https://www.bookmarkninja.com/) aims to make your bookmarks available on all your platforms. [Partizion](https://www.partizion.io/) offers distinct workspaces and [Webcull](https://webcull.com/#) creates folders and stacks against a customizable background.

### Visual Bookmarkers
These tools give you a visual clipping or other representation of each bookmarked web page. These visual cards are then organized as a set. [Raindrop](Https://raindrop.io/pro/buy) and [Mymind](Https://mymind.com/) are examples of these kinds of tools (see [this informative video](https://www.youtube.com/watch?v=BoyUM99M_R0) if you are trying to choose between them).

### Highlighters
Highlighter tools aid research and add a personalization layer by capturing highlighting and annotations on web pages.  [Diigo](https://www.diigo.com/index) provides annotation, highlighting and web 'sticky notes'. [LINER](https://getliner.com/upgrade) is a highlighter extension that uses crowd sourced highlights to augment search results.

### Read Later Tools
Some bookmark-type tools focus on maintaining and accessing a reading list. [Pocket](https://getpocket.com/premium?ep=1) and [Instapaper](https://www.instapaper.com/) have distraction-free reading modes, and store a permanent copy of your articles with your notes and annotations.

### Sharing Bookmarkers
Shared and social bookmarks have been a thing since the legendary [del.icio.us](https://en.wikipedia.org/wiki/Delicious_(website)) in the early 2000's. [PInterest](https://www.pinterest.com/) is a more modern incarnation. For smaller group purposes sharing bookmarkers are focused on team productivity and knowledge sharing. [Tagpacker](https://tagpacker.com/) creates tag packs to share. [Toby](https://www.gettoby.com/product) has shared team collections and workspaces. [Workona](https://workona.com/) adds shared files and tasks with a project focus.

There are no doubt other ways to categorize bookmarkers and many of the examples above have features in multiple categories. BrainTool is an organizing bookmark manager, it supports an infinitely nested topic tree with drag and drop organization with a focus on efficiency, keyboard navigation and search.

### Special Mention - Task Managers
An open tab is often just a placeholder for an associated to-do item, so while they are not strictly browser tools it's worth mentioning task managers such as [Workflowy](https://workflowy.com/) and [Todoist](https://todoist.com/). These organizer type tools can help siphon off and organize the underlying task associated with an open tab so you can close it (the 'task' may be as simple as 'come back and read this').

BrainTool supports assigning a TODO status to any topic or page, re-finding TODO items and subsequently marking them as DONE or closing them out.

## Personal Knowledge Management Tools
If bookmark managers help you manage and organize your online information sources and resources, PKM tools help you manage and organize... everything - notes, journal entries, thoughts, to-dos, contacts, books, papers, research, recipes, watch lists, etc. The original PKM tools like [Evernote](https://evernote.com/) and [OneNote](https://www.microsoft.com/en-us/microsoft-365/onenote/digital-note-taking-app) use a notes and notebooks model, more recent tools like [Roam Research](https://roamresearch.com/) and [LogSeq](https://logseq.com/) are based on a bidirectional linking model, enabling the generation of knowledge graphs. Of necessity these tools are more complex, with a steep learning curve that discourages casual users.

Given its ability to create a searchable hierarchy of topics with notes and links, BrainTool can be seen as a lightweight PKM tool. Since it saves your data in org-mode syntax* BT can also be used as a browser front end integrated with more extensive PKM tools such as LogSeq or [emacs/org](https://orgmode.org).

