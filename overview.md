# BrainTool Philosophy

BrainTool is not a tabs manager, it's a knowledge/notes/links manager that looks like a bookmark manager. Only links that are explicitly put under management show in the tree. Links are organized hierarchically under nested 'tags'. Links with the same tag are maintained within a single browser window. Its easy to assign a tag to a link you are viewing (click the BT icon in the toolbar and use the autocomplete shown to input a tag name), at which point it's added to the tree and its tab moved into the same window as its fellows.
<br/><br/>
<img src="/site/bt-screenshot1.png" style="border:solid; border-width:thin;">
<br/><br/>
<img src="/site/bt-screenshot4.png" style="border:solid; width:50%; border-width:thin;">
<br/><br/>

But that's only a part of the tool. The BT Chrome extension is actually a browser-based view onto a plain text file represented in the text-based emacs [orgmode](http://orgmode.org) format and stored on your Google Drive. That file can be edited in any text editor, ideally emacs with org-mode.
<br/><br/>
<img src="/site/bt-screenshot2.png" style="border:solid; border-width:thin;">

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

All url links in the .org file are shown as leaf nodes in the tree under their appropriate tag. Links in org-mode are represented as [[link url][link title]], when editing a link within the BT tree view this convention is followed.

## Editing

<img src="/site/bt-screenshot3.png" style="border:solid; width:50%; height:50%; float:left; border-width:thin; margin-right: 10px;">

The text and displayed link name can be edited within the extension window by clicking on the button in the middle column - kindof a janky ui but good enough until I find the time to improve my front-end skills. The popup also offers an accelerator to open all links for a given tag (they will open in a single dedicated Chrome window.)

The whole thing can also be edited in any text editor. As noted the key feature of BT is the integration with my org-mode note taking process. My personal setup is to have my Google Drive mounted locally on my laptop and to have the BrainTool.org file open in emacs where I update notes under the appropriate tag headings and edit the overall tree structure as needed. The Drive app is pretty good about rapidly synchronizing any edits. After an edit I hit the Refresh button in the tree to sync the display. Before editing in emacs I need to remember to M-x revert-buffer to pull in any new changes from the app. This sounds like a lot of overhead but I'm generally working in one place or the other and the quick sync is pretty seamless (plus emacs will tell me before overwriting the file on Drive if it has changed).

For a non org-mode user who wants to have greater control over the tree and its contents the org syntax is pretty minimally invasive. See [this tutorial](https://orgmode.org/worg/org-tutorials/org4beginners.html) for a minimal intro to emacs and org to give emacs a whirl. Or use your editor of choice noting to retain the *, ** header hierarchy and the [[url][display text]] structure for links.

## Navigation
The tree shows the current open state of links and tags via highlighting. Click on a link to open it or to bring its already-opened Chrome window to the top.

One thing I struggled with is how to handle navigation away from an opened BT window. I settled on intercepting the tabs navigation and redirecting to a new tab, leaving the original tab showing the page linked to from BT. This seems most intuitive to me given the tools operating model of not trying to track all windows and navigation but to capture only explicitly tagged pages which are intended to be added to my knowledge base.

## Known issues, future plans

- Currently the app is pretty destructive to org-mode markup. Tags, TODO's and properties get overwritten. That's fine for basic users but unacceptable for regular org-mode users. I need to store and re-write any org-specific markup. 
- It might be good to be able to reference multiple .org files and either combine or swap between them in the app.
- Ideally there'd be a more visual correlation between the BrainTool tree and the corresponding open browser windows. Extensions offer minimal customization options but I could add a badge to the toolbar button.
- I should support extension preferences to define the backing file name and the BT window screen location and dimensions. 
- There's a built in collaboration aspect given that the drive file can be shared! I could see having common curated BrainTool file instances being a good way to share information within an organization.
- My long term vision is that each link and note can have multiple tags and that the tool supports searching and reorganizing by different tag hierarchies.
