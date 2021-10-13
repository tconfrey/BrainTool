---
layout: post
title:  "My BrainTool, org-mode and emacs workflow"
description: "How I personally fit BrainTool into my text-based process. Learn how to integrate emacs and orgmode with your browser."
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
---


# Adding BrainTool into an emacs & org-mode workflow

<div style="line-height:1.5; font-size:small; font-style:italic">BrainTool is a browser plugin with a tree-structured side panel showing your personal hierarchical 'Topic' list. It's easy to assign a tab, or many tabs, to a topic and add associated notes. Tabs and whole topics can be opened and closed easily, so it helps keep your tabs tidy and your research organized. Most importantly for this post, it writes all data to an org-mode formatted text file. <a href="/overview">See more details in this overview.</a></div>

I'm an ascii-text note taker. Over the years I've experimented with a paper notebook per topic, then a single big notebook for everything, then smart pens and clipboards, then scannable paper notebooks, then an iPad with Pencil or the Galaxy Note. I've played with mindmap tools and EverNote. But I've always based my development environment around emacs, so inevitably I drift back to a text buffer in emacs - I type faster than I write, my handwriting is hard to read, its easy to cut and paste and organize text, and I can search or grep to find things fast even in the middle of a conversation.
<!--more-->

I've experimented with org-mode a few times and been rebuffed by its steep learning curve. However during my recent experiment in becoming an indie hacker I've put in the time to get set up with org and to drill a set of commands into the muscle memory of my fingers. I'm not an org wizard but I've found huge value in just getting to the (non trivial) basics of todo's, tags and timestamps, interspersed among nested headings and plain old paragraph text. Adding BrainTool, which pulls in and organizes all my online resources, is (I think) a winning combination!

This post lays out the basics of my setup and how you might adopt it.
<br/>
<br/>
<img src="/site/ScreenShot.png" style="border:solid; border-width:thin;" alt="Screenshot showing BrainTool with emacs and Chrome views">
<p style="text-align:center; font-weight:bold; font-size:small">Screenshot showing BrainTool with emacs and Chrome views</p>

## Desktop Setup

It turns out I only need a few files to track everything. I keep a single long daily-log.org file with a heading for each day, tracking what I'm doing, decisions made, capturing TODO tasks etc. I take notes on calls and meetings in place under an appropriately named sub-header. I aggregate weekly and monthly summaries so I can see progress. I have a network.org file separately tracking networking interactions I want to save, with a header per person and links into the daily log file. I also have a cheatsheets file (to help me get back to those org-mode key commands) and a random-notes file. In addition to those, BrainTool's BrainTool.org file holds my entire knowledge base for topics, notes and links to resources.

All of my org-mode files live in a folder on my Google Drive. I use the Google Backup and Sync app to map the GDrive folder onto my local machine.  I generally keep BrainTool.org open in emacs so I can search it or add content. Since the BrainTool app writes to it when I'm working in the browser I turn on [auto-revert-mode](https://www.gnu.org/software/emacs/manual/html_node/emacs/Auto-Revert.html) so that emacs keeps the file up to date. I make a habit of hitting BrainTool's 'Refresh from GDrive' button whenever I swap out of emacs and into Chrome.

_Note that recent versions of BrainTool (BT) both warn if the file is out of sync and are not dependent on a GDrive link at all. You can import from and save to a local .org file, so if your corporate network does not allow GDrive  access you can still use this process_.

BT supports adding a TODO status to topics and links, so org-agenda can show a unified TODO list across all my files. As noted, I'm not (yet) a heavy user of many org features. If you are, you are not limited in your use of org features, BT is pretty good about copying through all the org markup so you can add lists, tables, blocks etc to the BrainTool.org file. BT does use drawers and properties for some meta-data (eg the folded state of the topic tree). I don't like seeing those in my notes so I have an elisp function to completely hide them on demand (hit me up if you want the code).

## Mobile Setup

Chrome does not support extensions on mobile so BrainTool itself does not run on my phone. However it is very useful to have a read-only view on your phone and to be able to tap through into saved links. To make that work I run Google's Drive Sync Android app which regularly syncs all my .org files onto the phone. I can then use the excellent Orgzly app to interact with my BrainTool resources in a read-only fashion. This has saved my bacon a few times when I needed to access something in my braintool while out and about.

## Topic Model

BT does not impose any structure on the topics you create. Personally I try to approximate Forte Labs [PARA](https://fortelabs.co/blog/para/) model - Projects, Areas, Resources and Archive. Although I add a 'T' for 'To Read' or 'To Do' (so I guess PARA+T). Those are all top level topics.

Under the Project hierarchy each of my active projects is a next level topic. To illustrate, 'BrainTool' is a project, under which I have a topic called 'Admin' where all my BT admin links live (eg the Chrome Web Store Admin page, the Google Analytics page, the BT group chat link etc). There is also a 'Press' topic capturing any press articles about BT, 'Complementary' and 'Competitive' tool topics etc. 'Kitchen Reno' is another project topic gathering all my links on cabinet makers, 3d modeling tools etc. See the screenshot above for how that looks on my screen.

Areas stands for 'areas of responsibility'. Topics under there include Finances, Health, and House; with links to google sheets, tax records, health portal logins and so on.

Under Archive I keep old projects (the kitchen project will move there very soon - thankfully!) and Resources is all over the board.

BrainTool is a work in progress and I've been using it as I build it, so my personal model is still very much in flux but thus far this general framework seems to be working for me.

## Conclusion

I like the way BT is evolving and how it fits into my personal organizational and knowledge management system. I'm hearing from users that it has value to them as a standalone tool, but in addition I think it has potential to be a shallower onramp for emacs users, like I was, who would like to start leveraging the power of org-mode. Start using BrainTool as your uber-bookmark/browser manager and then open it up in emacs to add notes, todos, tags and timestamps and thereby also drive a unified org-agenda based task tracking system.

I'd love to hear your thoughts and experiences in the [BrainTool discussion group.](https://groups.google.com/u/0/g/braintool-discussion)
