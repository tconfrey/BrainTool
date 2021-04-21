---
layout: post
title:  "My BrainTool, org-mode and emacs workflow"
description: "How I personally fit BrainTool into my text-based process."
excerpt_separator: <!--more-->
author: "Tony"
---


# Adding BrainTool into a text-based workflow

_BrainTool is a browser plugin with a tree-structured side panel showing your personal hierarchical 'Topic' list. It's easy to assign a tab, or many tabs, to a topic and add associated notes. Tabs and whole topics can be opened or closed easily so it helps keep your tabs tidy and your research organized. Most importantly it writes all data to an org-mode text file. [See More](/overview)_

I'm a ascii text-based note taker. Over the years I've experimented with a paper notebook per topic, then a single big notebook for everything, then smart pens and clipboards, then scannable paper notebooks, then an iPad with Pencil or the Galaxy Note. I've played with mindmap tools and EverNote. But I've always based my development environment around emacs so inevitably I drift back to a text buffer in emacs - my handwriting is hard to read, I type faster than I write, its easy to cut and paste and organize, and I can search and find things fast even in the middle of a conversation.
<!--more-->

I experimented with org-mode a few times and was rebuffed me with its steep learning curve. But during my recent experiment in becoming an indie hacker I've put in the time to get set up with org and to work a set of commands into my muscle memory. I'm not an org wizard but there's huge value in just getting to the (non trivial) basics of todo's, tags and timestamps, interspersed among nested headings and plain old paragraph text. Adding BrainTool, which pulls in and organizes all my online resources, is (I think) a winning combination!

This post lays out the basics of my setup.

## Desktop Setup

It turns out I only need a few files to track everything I need. I keep a single long daily-log.org file with a heading for each day, tracking what I'm doing, decisions made, capturing TODO tasks etc. I aggregate weekly and monthly summaries so I can see progress. I have a network.org file separately tracking networking interactions with a header per person and links into the daily log file. And I have a cheatsheets file (to help me get back to those org-mode key commands) and a random-notes file. In addition to these, BrainTool's BrainTool.org file holds my entire knowledge base for topics, notes and links to resources.

All of the above files live in a folder on my Google Drive. I use the Google Backup and Sync app to map the GDrive folder onto my local machine.  I generally keep BrainTool.org open in emacs so I can search it or add content. I turn on [auto-revert-mode](https://www.gnu.org/software/emacs/manual/html_node/emacs/Auto-Revert.html) so that emacs keeps the file up to date as the BrainTool app writes to it when I'm working in the browser and I'm in the habit of hitting the 'Refresh from GDrive' button whenever I swap out of emacs and into Chrome.

BrainTool (BT) supports adding a TODO status to topics or links, so org-agenda can show a unified TODO list. As noted, I'm not a heavy user of most org features but BT is pretty good about copying through all the org markup so you can add lists, tables, blocks etc if that's your thing. BT does use drawers and properties for some meta-data (eg the folded state of the topic tree). I don't like seeing those in my notes so I have an elisp function to hide them on demand (hit me up if you want the code).

## Mobile Setup

Chrome does not support extensions on mobile so BrainTool itself does not run on my phone. However it is very useful to have a read-only view on your phone and to be able to tap through to saved links. To make that work I run Google's Drive Sync app which regularly syncs all my .org files onto the phone. I can then use the excellent Orgzly Android app to interact with my BrainTool resources. This has saved my bacon a few times when I needed to access something in my braintool while out and about.

## Topic Model

BT does not impose any structure on the topics you create. Personally I try to approximate Forte Labs [PARA](https://fortelabs.co/blog/para/) model - Projects, Areas, Resources and Archive. Although I add a 'T' for 'To Read' or 'To Do' (so I guess PARA+T).

In my Project hierarchy each of my active projects is a top level topic. 'BrainTool' is a project under which I have a topic called 'Admin' where all my BT admin links live (eg my Chrome Web Store Admin page, my Google Analytics page, the BT group chat link etc). I also have a 'Press' topic capturing any press articles about BT. 'Kitchen Reno' is another project topic gathering all my links cabinet makers, 3d modeling tools etc.

Areas stands for 'areas of responsibility'. Topics there include Finances, Health, and House with links to google sheets, tax records, health portal login etc.

Under Archive I keep old projects (the kitchen project will move there very soon - thankfully!) and Resources is all over the board.

BrainTool is a work in progress and I've been using it as I build it, so my personal model is still very much in flux. 

## Conclusion

I'm very much liking the way BT is evolving and how it fits into my personal organizational and knowledge management system.

In addition I think it has potential to be a shallower onramp for emacs users who would like to start leveraging the power of org-mode. Start using BrainTool as your uber-bookmark/browser manager and then open it up in emacs to add notes, todos, tags and timestamps and thereby also drive a unified org-agenda based task tracking system.

I'd love to hear your thoughts and experiences on the [BrainTool discussion group](https://groups.google.com/u/0/g/braintool-discussion)
