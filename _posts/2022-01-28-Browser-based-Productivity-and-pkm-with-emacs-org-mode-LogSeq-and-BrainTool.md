---
layout: post
title:  "Browser-based Productivity and PKM with emacs, org-mode, LogSeq and BrainTool"
description: "BrainTool is a browser bookmark tool that can act as part of a productivity and PKM system with emacs, org-mode and LogSeq"
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
image: "../../../site/postAssets/Five Tools/browserBasedProductivity.png"
---
# Browser-based Productivity and PKM with emacs, org-mode, LogSeq and BrainTool
<!--start-->
BrainTool is a free and open source browser bookmark tool that makes it easy to add notes to your bookmarks, organize them into a topic hierarchy and then use that hierarchy to open and close groups of tabs and thus control your browser. It is unique as a bookmark manager in that it is designed to interoperate as part of a larger system of personal knowledge management and productivity tools. 
<!--end-->

It achieves this interoperability by saving your data into an accessible plain text file written in the emacs standard org-mode format. Org mode is a set of plain text tools used to manage tasks, to do lists, notes, links, journal entries and almost any form of text-based information. 

Most org mode users interact with it via the emacs text editor but it can be used in any text editor and is increasingly used as a format by other tools such as the [LogSeq](https://logseq.com)<super>*</super> personal knowledge manager, the [Flat Habits](https://flathabits.com/) iOS ToDo manager and [Plain Org](https://plainorg.com/), an iOS org-mode editor.

<iframe width="560" height="315" style="border: 1px solid grey" src="https://www.youtube.com/embed/U9kg9yVMMAM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

The embedded video shows how the notes, links and todo items captured by BrainTool in your browser can be accessed and edited in org mode and then used to drive a task manager. The same plain text file is also shown synced to LogSeq and being navigated in the LogSeq user interface. 

All three tools are automatically kept in sync by virtue of using the same org mode file as backing store. Currently this requires syncing BrainTool to a Google Drive file and using the Google Sync app to sync your GDrive to a desktop folder. Emacs and LogSeq can then read and write the BrainTool data file locally. Some care needs to be taken to allow time for the local and remote files to sync before moving between tools.

If you are new to BrainTool the [other videos in this playlist]( https://youtube.com/playlist?list=PLhaw8BE1kin1D9uPrY9yF-KoBoWisbBaP) give a short introduction. 

To comment on the post reply to [this tweet](https://twitter.com/ABraintool/status/1487190355208507400?s=20&t=ZWuOkiyA2WR-26vKElz-QQ)

<br/>
<div style="display:block; font-size:80%; line-height:1.25rem; margin-bottom:0.5rem;"><super>*</super><small>LogSeq is an open source alternative to tools like Roam Research, Obsidian and Notion. Like Obsidian (and BrainTool), LogSeq saves your data in accessible plain text files, unlike Obsidian Logseq was originally built to use org mode. <br/></small></div>
