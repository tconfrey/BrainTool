---
title: BrainTool User Guide
layout: default
tagline: The Topic Manager for your Online Life
description: BrainTool is a way of organizing things you want to remember and get back to, using notes and nested tags. Its also a better way to control your browser.
audience: user
---

# User Guide
BrainTool is a 'Topic' Manager. Topics are the basic unit of organization. The BrainTool side-panel shows your topic hierarchy and provides tools for editing and curating your topics. The BrainTool browser popup lets you quickly assign a topic to any web page or resource that you want to keep track of.
<div class="row">
<div class="cell left">
<img src="/site/sidePanel.png" alt="side-panel" style="border:solid; border-width:thin; width:80%">
</div>
<div class="cell right">
<img src="/site/popup.png" alt="popup" style="border:solid; border-width:thin; width: 80%">
</div>
</div>

A topic is a category or a tag or any way you want to group a set of links. Topics can be nested inside each other. All topics and links have associated notes. By making it easy to quickly save a web page under a specific topic and drop in a text note, BrainTool allows you to build up your own topic map - a map of all of the information you want to keep track of.

Getting your links and notes into BT is easy but once there they give you a unique ability to control your browser and navigate your online resources. From the side-panel you can open and close individual links or all links for a topic; and you can see which links are open and pop any one to the top. Everything is controllable via keyboard controls as well as the mouse. This ability to navigate sites and tabs from the side-panel can greatly improve your browser workflow.

Finally, all of the above takes place in the browser. But BrainTool doesn't want to lock all this valuable information away! Underlying what you see on the screen is a plain text based representation. You can turn on a continuous sync to a Google Drive file or manually save versions of your topic map. Beyond just being a backup this allows you to access and edit your notes and links in any text editor. 


## Installation
<div class="row">
<div class="cell left" style="text-align:justify">
Install BrainTool from the <a href="https://chrome.google.com/webstore/detail/braintool-beyond-bookmark/fialfmcgpibjgdoeodaondepigiiddio">Chrome</a> or <a href="https://microsoftedge.microsoft.com/addons/detail/braintool-beyond-bookma/igibjpnabjgljgnfajjpapocagidmeol">Edge</a> store. You will need to grant permissions for BT to see your browsing history and access your bookmarks. This puts a small extension inside your browser and adds the BT icon. The icon shows on your browser bar or, on Chrome, under the generic extension 'puzzle-piece' icon. You can, and should, pin the icon to your browser bar using the push-pin icon.
</div>
<div class="cell right">
<img src="/site/initialInstall.png" alt="Install" style="border:solid; border-width:thin; width:90%; margin-left:2rem;">
</div>
</div>
BrainTool is launched by clicking the icon, or using the Alt/Option-b keyboard accelerator. On first click it will open the BT Side-panel. The side-panel comes pre-populated with a default set of topics. You can add your own data into this structure or create your own. On the first launch BT will re-size your current browser window to make room for the side-panel. This is a one-time operation to make sure you see the side-panel, you should feel free to re-arrange your windows as you see fit.

## Assigning a Topic - the Popup
<div class="row">
<div class="cell left" style="text-align:justify">
To save the current web page to BrainTool just hit the icon or keyboard accelerator. This will open the BT Popup with the Topic field selected. The Popup shows an overview of your current known topics. You can select one with your mouse or just start typing. Auto-complete will show possible topic options, hit enter to select. If BT has a good guess as to the topic it might be pre-populated. In this case either just hit enter to use it, or delete to clear out the suggestion. 
</div>
<div class="cell right">
<img src="/site/BT-popup.gif" alt="popup" style="border:solid; border-width:thin; width:90%; margin-left:2rem;">
</div>
</div>

If a topic name is not unique the auto-complete will show a colon:separated hierarchy. Typing in an unknown topic will create a new one at the top level. Entering an existing topic followed by a colon:subtopic creates a new subtopic under that parent topic.

After the topic is entered the Notes field will be selected. If you don't want to enter a note just hit enter again. There's a checkbox to allow you to assign the topic to all tabs in the current window that do not yet have one.

The final aspect of the popup controls what happens after you've saved the page. You can close the tab, leave it as is, or move it into a tab group or window with other pages of the same topic.

## The Side-Panel
Once you have a set of pages saved into your personal braintool you can use the side-panel to control the browser. You can select the side-panel as you would any other browser window, or use the accelerator Alt/Option-b-b (ie hit b twice) to pop it into focus.

The side-panel shows your topic hierarchy in an expandable table. The small triangles next to topics allows you to expand or collapse the hierarchy. Links that are open in a tab show in pale green as do topics which have one or more of their links open.

Hovering your mouse over a row in the table reveals a set of buttons that perform operations on that row. As shown, right to left, the operations are as follows:
<img src="/site/rowButtons.png" alt="Row Buttons" style="width:80%; margin-left:5rem;">
- **Delete:** delete the row's link or topic. If it's a topic also delete all its children, in the latter case a confirmation warning will be shown.
- **Open/Close:** open the link in a tab or all the topics links in a set of tabs or close links if open. See Options below for details on groupings - tabs for a topic can be separated into tab groups or dedicated windows.
- **Edit:** Show the Topic card associated with each entry. This allows you to change the topic's title or a links label or url, as well as to edit the notes for the item.
- **More/Fewer Tools:** Expand to show the full set of tool buttons, or shrink to show the summary set.
- **TODO:** Each item in the table can be assigned as a TODO or DONE. This button toggles between the TODO states.
- **Add Child:** Create a new child topic under this one and open its Topic card.
- **Outdent:** Move a node up the topic hierarchy.
- **Move:** Allow the node to be dragged elsewhere in the hierarchy and dropped into a new position. If it's a topic node all its children will be moved along with it.
All these tools can also be accessed using keyboard accelerators.

## Keyboard Accelerators
<div class="row">
<div class="cell left">
<img src="/site/keyboardAccelerators.png" alt="Key commands" style="border:solid; border-width:thin; width:90%; margin-right:2rem;">
</div>
<div class="cell right">
BrainTool is designed to allow you to work more efficiently in your browser. One way of speeding up your work is to use the keyboard accelerators. Accelerators can access all the tools described above, as well as navigating and searching through the tree. Hitting 'h' will show all the available keyboard commands.
<br/><br/>
One thing to note here is that BT has the notion of a 'selection', which is the table row that is currently selected. This is the one on which keyboard commands will operate. It is shown in dark green in the tree.
</div>
</div>
## Search
*Search will be available soon*

Alt/Opt-s is the Search accelerator, or just click into the search box. As you type the next matching row will be selected and shown with matching text highlighted, searching downward from the current selected row (or the top row is there is no selection).

Hitting Alt/Opt-s again will select the next matching row. If search hits the bottom row without a match the search box will show in pale red. Hitting Opt-s again will loop the search around to the top row.

Alt/Opt-r is Reverse search, it works like search but searches upward from the selection (or from the bottom row). At any point you can use -s or -r to find the next or previous match.

Hitting Enter exits search leaving you with the selected row which you can then operate on (eg open in a browser window by hitting enter again, or edit by typing 'e').

Note that search will find matches in the link title, link url and your notes, in open as well as hidden rows. The url, which is usually not displayed, will be shown if its the only match in the row.

## Options, Import, Export and Syncing
The green bar at the top of the side-panel houses the search input and the stats bar, which shows details on your topic cards and saves. Clicking into the bar will open the Welcome card which shows useful links and tips and any BrainTool announcements. Note that after the first launch the Welcome card shows briefly every time you re-open BT and then closes automatically. On first launch it will wait for you to close it to give you a chance to orient yourself.

From the Welcome card there's a button to import your bookmarks. It's a good idea to do this early in your use of BT and then to organize your bookmarked links into your topic hierarchy. After a first import the button is moved inside the Tools and Options card which is also accessible from the Welcome card.

<div class="row">
<div class="cell left">
<img src="/site/welcomeCard.png" alt="side-panel" style="border:solid; border-width:thin; width:80%">
</div>
<div class="cell right">
<img src="/site/optionsCard.png" alt="popup" style="border:solid; border-width:thin; width: 80%">
</div>
</div>

There are a number of Import and Export tools. You can import from browser bookmarks, an org-mode text file or an exported file from the TabsOutliner extension. You can export your topic hierarchy back out to browser bookmarks or to a local org-mode format text file. If org-mode and TabsOutliner are not familiar to you don't worry about it, they are not important!

A controllable option on the card determines how BT topics are shown in browser windows, tabs groups and tabs. The default, Tab Groups, uses the new tab group functionality in Chrome and Edge (as well as Brave and some other Chromium-based browsers) to give a visual indication in the browser of which tabs are associated with the same topic. Tab Groups can be named and colored by right clicking on the tab group indicator in the browser. (Unfortunately the ability to automatically name or color the tab group is not available to the BT extension.)

The alternatives to Tab Group grouping are to open each topic's tabs in separate Windows or do Nothing and open tabs wherever the browser puts them automatically (as it would with any new link you open).

Next there is the option to link your personal braintool topic map to a file associated with a Google Drive account. If you have a Google account you can walk through an authorization step to allow BT to write all your data into a file you can access via Drive (in addition to saving it in browser storage). Note that if you do edit the file externally you will need to manually sync it back into BT via the 'Refresh from File' button. If you use multiple browsers or machines with the same Google account you can share your braintool topics across them (again with a manual sync to import changes made elsewhere).

Finally you have the option to upgrade to a Premium version of BrainTool based on a monthly or annual subscription. See the [pricing](../pricing) page for details.

