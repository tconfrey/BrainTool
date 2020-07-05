# BrainTool Philosophy

BrainTool is a knowledge/notes/links/browser manager. While browsing you 'tag' web pages via the BrainTool Chrome plugin to store them in your personal braintool file. Tags provide a grouping for sets of web pages, they are nested in a hierarchy and have attached notes. Each tag is represented by a node in the tree shown on the BrainTool side-panel, and within Chrome by a dedicated window with tabs for tagged links. The side-panel indicates which links are currently open in a tab and allows fast access to open or access the page.

<br/>
<img src="/site/bt-screenshot1.png" style="border:solid; border-width:thin;">

By tagging links and capturing your notes about them you are building up a knowledge base. BrainTool stores that knowledge base in a plain-text file saved to your Google Drive. As you tag pages, and add notes in Chrome and in the BrainTool side-panel, a file called BrainTool.org is kept updated. That file is regular text but structured in an [org-mode](http://orgmode.org) format.

The text file can be edited in any text editor, ideally emacs with org-mode. At least for me, the tool's creator, it unites two of the main ways I capture information - in plain text notes typed into an emacs editor, and via links to relevant web pages.

<br/>
<br/><br/>
<img src="/site/bt-screenshot4.png" style="border:solid; width:50%; border-width:thin;">
<br/><br/>
<img src="/site/bt-screenshot2.png" style="border:solid; border-width:thin;">

## Overview

At its simplest BrainTool is a way of organizing links you want to remember - kind of like a hierarchical bookmark manager. Each node in the tree has editable notes. 

From a Chrome session new links can be added to the tree and links from the tree can be opened in dedicated windows. The org file can be edited separately to edit the structure or add notes and other details. The BT tree automatically writes updates to the org file. The Refresh button will re-sync the display with any file changes.

## Security

BrainTool is comprised of a Chrome extension and a javascript Google Drive application. The app is entirely a static source-available client-side app served from [my github account](https://github.com/tconfrey/BrainTool). On first startup the app asks your permission to create, read and write a file called BrainTool.org on your google drive. That file is used to store the window and link tree. So in use the only communicating parties are your browser and the Google Drive server, no information is stored or accessible anywhere else. The app is as secure to use as Google's infrastructure.

## Headlines, Tags and Categories
    
These are different things in org but in BT they are all the same. Every headline in the tree is a tag. Leaf nodes carry the tags of all of their ancestors. 

## Links

All url links in the .org file are shown as leaf nodes in the tree under their appropriate tag. Links in org-mode are represented as [[link url][link title]]. When editing a link within the BT tree view this convention is followed.

## Editing

<img src="/site/bt-screenshot3.png" style="border:solid; width:50%; height:50%; float:left; border-width:thin; margin-right: 10px;">

The text and displayed link name can be edited within the extension window. The whole thing can also be edited in any text editor. As noted the key feature of BT is the integration with an org-mode note taking process. My personal setup is to have my Google Drive mounted locally on my laptop and to have the BrainTool.org file open in emacs where I update notes under the appropriate tag headings and edit the overall tree structure as needed. The Drive app is pretty good about rapidly synchronizing any edits. After an edit hit the Refresh button in the tree to sync the display. This sounds like extra overhead but I'm generally working in one place or the other and the quick sync is pretty seamless (plus emacs will tell me before overwriting the file on Drive if it has changed).

For a non org-mode user who wants to have greater control over the tree and its contents the org syntax is pretty minimally invasive. See [this tutorial](https://orgmode.org/worg/org-tutorials/org4beginners.html) for a minimal intro to emacs and org to give emacs a whirl. Or use your editor of choice noting to retain the *, ** header hierarchy and the [[url][display text]] structure for links.

## Navigation
The tree shows the current open state of links and tags via highlighting. Click on a link to open it or to bring its already-opened Chrome window to the top. Double click any highlighted row to go to that window or tab.

One thing I struggled with is how to handle navigation away from an opened BT window. I settled on intercepting the tabs navigation and redirecting to a new tab, leaving the original tab showing the page linked to from BT. This seems most intuitive to me given the tools operating model of not trying to track all windows and navigation but to capture only explicitly tagged pages which are intended to be added to my knowledge base.

## Known issues, future plans

- It might be good to be able to reference multiple .org files and either combine or swap between them in the app.
- I should support extension preferences to define the BT window screen location and dimensions. 
- There's a built in collaboration aspect given that the drive file can be shared! I could see having common curated BrainTool file instances being a good way to share information within an organization.
- My long term vision is that each link and note can have multiple tags and that the tool supports searching and reorganizing by different tag hierarchies. I'm investigating the use of [org-roam](https://org-roam.readthedocs.io/en/master/)
