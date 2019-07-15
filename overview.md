---
layout: Cayman
---

# BrainTool
## Philosophy

BrainTool is not a tabs manager its a knowledge/notes/links manager. Only links that are explicitly put under management show in the tree. Links are organized hierarchically under nested 'tags'. Links with the same tag are maintained within a single browser window. <br/><br/>

But that's only a part of the tool. The Chrome extension is actually a browser-based view onto a plain text file represented in the text-based emacs <a href='http://orgmode.org'>orgmode</a> format and stored on your Google Drive. That file can be edited in any text editor, ideally emacs with org-mode.
    
## Overview
    
At its simplest BrainTool is a way of organizing links you want to remember - kind of like a hierarchical bookmark manager. Each node in the tree has editable notes. 

From a Chrome session new links can be added to the tree and links from the tree can be opened in dedicated windows. The org file can be edited separately to edit the structure or add notes and other details. The BT tree automatically writes updates to the org file. The Refresh button will re-sync the display of any file changes.
    
    
## Headlines, Tags and Categories
    
    
These are different things in org but in BT they are all the same. Every headline in the tree is a tag. Leaf nodes carry the tags of all of their ancestors.
    
## Links

Links in org mode are represented as [[link url][link title]], when editing a link within the BT tree view this convention is followed.
    
