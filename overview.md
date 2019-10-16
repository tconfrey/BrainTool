# BrainTool Philosophy

BrainTool is not a tabs manager, it's a knowledge/notes/links manager that looks like a bookmark manager. Only links that are explicitly put under management show in the tree. Links are organized hierarchically under nested 'tags'. Links with the same tag are maintained within a single browser window. Its easy to assign a tag to a link you are viewing, at which point it's added to the tree and its tab moved into the same window as its fellows.
Inline-style: 
![Windows and tabs map to parent and leaf nodes](https://github.com/tconfrey/BrainTool/images/icon48.png "Parents and chldren")
<br/><br/>

But that's only a part of the tool. The BT Chrome extension is actually a browser-based view onto a plain text file represented in the text-based emacs [orgmode](http://orgmode.org) format and stored on your Google Drive. That file can be edited in any text editor, ideally emacs with org-mode.

The idea is to marry together two of the main ways I personally capture information
- in notes typed into plain text files (in my case via an emacs org-mode buffer),
- and in urls I access in Chrome, whether the results of previous research sessions or a set of Google Docs I need to reference or work on.

## Overview

At its simplest BrainTool is a way of organizing links you want to remember - kind of like a hierarchical bookmark manager. Each node in the tree has editable notes. 

From a Chrome session new links can be added to the tree and links from the tree can be opened in dedicated windows. The org file can be edited separately to edit the structure or add notes and other details. The BT tree automatically writes updates to the org file. The Refresh button will re-sync the display with any file changes.

## Security

BrainTool is comprised of a Chrome extension and a javascript Google Drive application. The app is entirely a static client-side app served from [my github account](https://github.com/tconfrey/BrainTool). On first startup the app asks your permission to create, read and write a file called BrainTool.org on your google drive. That file is used to store the window and link tree. So in use the only communicating parties are your browser and the Google Drive server, no information is stored or accessible anywhere else. The app is as secure to use as Google's infrastructure.

## Headlines, Tags and Categories
    
These are different things in org but in BT they are all the same. Every headline in the tree is a tag. Leaf nodes carry the tags of all of their ancestors. 

## Links

Links in org mode are represented as [[link url][link title]], when editing a link within the BT tree view this convention is followed.

## Known issues, future plans

- Currently the app is pretty destructive to org-mode markup. So tags, TODO's and properties get overwritten. Thats fine for basic users but unacceptable for regular org-mode users. I need to store and re-write any org-specific markup. 
- It might be good to be able to use multiple .org files and either combine or swap between them in the app (or maybe have a different BT Chrome window display per file).
- Ideally there'd be a visual correlation between the tag and its links in the tree and the corresponding open browser window.
- I should capture and display the favicon on open tabs.
- There's a built in collaboration aspect given that the drive file can be shared! I could see having common curated BrainTool file instances being a good way to share information within an organization. 
