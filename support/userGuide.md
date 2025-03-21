---
title: BrainTool User Guide
layout: default
tagline: The Topic Manager for your Online Life
description: BrainTool organizes things you want to remember and get back to, using notes and nested tags. It's a better way to control your browser.
audience: user
---

# User Guide
BrainTool is a 'Topic' Manager for your tabs. Topics are the basic unit of organization. The BrainTool Topic Manager shows your topic hierarchy and provides tools for editing and curating your topics. The BrainTool Bookmarker lets you quickly assign a topic to any web page or resource that you want to keep track of.
<div class="row">
<div class="cell left">
<img src="/site/TopicManager.png" alt="side-panel" style="width:80%">
</div>
<div class="cell right">
<img src="/site/Bookmarker.png" alt="popup" style="width: 80%">
</div>
</div>

A topic is a category or a tag or any grouping of a set of web pages. Topics can be nested inside each other to any depth. All topics and saved pages have associated notes. By making it quick and easy to save a web page under a specific topic and drop in a text note, BrainTool allows you to build up your own topic map - a map of all of the information you want to keep track of.

Getting your links and notes into BT is easy, but once there they give you a unique ability to control your browser and navigate your online resources. From the Topic Manager you can open and close individual pages or all pages for a topic, as well as see which pages are open and pop any one to the top. Everything is controllable via keyboard commands in addition to the mouse. This ability to navigate sites and tabs from the Topic Manager can greatly improve your browser workflow.

Finally, all of the above takes place in the browser. But BrainTool doesn't want to lock all this valuable information away! Underlying what you see on the screen is a plain text based representation. You can turn on a continuous sync to a local or Google Drive file or manually save versions of your topic map. Beyond just being a backup this allows you to access and edit your notes and links in any text editor. 


## Installation
<div class="row">
<div class="cell left" style="text-align:justify">
Install BrainTool from the <a href="https://chrome.google.com/webstore/detail/braintool-beyond-bookmark/fialfmcgpibjgdoeodaondepigiiddio">Chrome</a> or <a href="https://microsoftedge.microsoft.com/addons/detail/braintool-beyond-bookma/igibjpnabjgljgnfajjpapocagidmeol">Edge</a> store. You will need to grant permissions for BT to see your browsing history and access your bookmarks. This puts a small extension inside your browser and adds the BT icon. The icon shows on your browser bar or, on Chrome, under the generic extension 'puzzle-piece' icon. You can, and should, pin the icon to your browser bar using the push-pin icon.
</div>
<div class="cell right">
<img src="/site/initialInstall.png" alt="Install" style="width:90%; margin-left:2rem;">
</div>
</div>
BrainTool is launched by clicking the icon, or using the Alt/Option-b keyboard accelerator. On first click it will open the Topic Manager which comes pre-populated with a default set of topics. You can add your data into this structure or create your own. On the first launch BT will shift your current browser window to make room for the Topic Manager. This is a one-time operation to make sure you see the side-panel, you should feel free to re-arrange your windows as you see fit. The Topic Manager will re-open in the position it was last closed from.

## Assigning a Topic - the Bookmarker
<div class="row">
<div class="cell left" style="text-align:justify">
To save the current web page into BrainTool just hit the icon or keyboard accelerator. This will open the BT Bookmarker with the Topic field selected. 
<br/><br/>
The topic selector shows an overview of your current topics in a navigable tree. You can select one with your mouse or just start typing. Auto-complete will show possible topic options. Hit enter to select. If BT has a good guess as to the topic it might be pre-populated. In this case either just hit enter to use it, or delete to clear out the suggestion. 
<br/><br/>
Then add a note or just hit Enter. You can also edit the page title which is how the page will be identified in the topic tree. There are also options to allow you to save all the currently unsaved tabs in a tab group, window, or entire browser session.
</div>
<div class="cell right">
<img src="/site/SaverSuggestions10.png" alt="popup" style="width:75%; margin-left:2rem;">
</div>
</div>

If a topic name is not unique the auto-complete will show a colon:separated hierarchy. Typing in an unknown topic will create a new one at the top level. Entering an existing topic followed by a colon:subtopic creates a new subtopic under that parent topic (EG Projects:My new project). Topic names can have spaces. If you leave the topic blank (ie just hit enter) the page will be assigned to the generic 'Scratch' topic.

Hitting Enter will save the page into your topic map and close the Bookmarker. You can choose to close the page(s) after saving or leave it open grouped with its peers of the same topic.

You can also drag a URL from the url bar and drop it under a topic in the Topic Manager to save an open tab without using the Bookmarker.
## The Topic Manager
Once you have a set of pages saved into your personal braintool you can use the Topic Manager to control the browser. You can select it as you would any other browser window, or double click the icon or use the accelerator Alt/Option-b-b (ie hit b twice) to pop it into focus.

The Topic Manager shows your topic hierarchy in an expandable table. The triangles next to topics allows you to expand or collapse the hierarchy. Pages that are open in a tab are highlighted as are topics which have one or more of their pages open. If an open topic is hidden under a collapsed parent the parent is shown in blue text.

Hovering your mouse over a row in the table reveals a set of buttons that perform operations on that row. As shown below, right to left, the operations are as follows:

<img src="/site/rowButtons.png" alt="Row Buttons" style="width:80%; margin-left:5rem;">
- **More/Fewer Tools:** Expand to show the full set of tool buttons, or shrink to show the summary set.
- **Close:** Close an open tab or all open tabs for a topic.
- **Open Tab:** Open the page in a tab or all the topics pages in a tab group, or a set of tabs.
- **Open in Window:** Open in a new browser window. This can be useful to separate out groups of tabs.
- **Edit:** Show the Topic card associated with each entry. This allows you to change the topic's title or a pages label or url, as well as to edit the notes for the item.
- **Add Child:** Create a new child topic under this one and open its Topic card.
- **Promote:** Move an item up the topic hierarchy.
- **Move:** Allow the item to be dragged elsewhere in the hierarchy and dropped into a new position. If it's a topic all its children will be moved along with it.
- **TODO:** Each item in the table can be assigned as a TODO or DONE. This button toggles between the TODO states. Adding :TODO after the Topic name when saving from Bookmarker will create the item as a TODO. Note also that the star (⭐️) icon in the search bar filters to show all of your TODOs.
- **Delete:** Delete the page or topic. If it's a topic also delete all its children. In the latter case a confirmation warning will be shown.

Note not all tools apply to every item and so not all will be shown every time. All the tools can also be accessed using keyboard accelerators.

## Keyboard Accelerators
<div class="row">
<div class="cell left">
<img src="/site/Help.png" alt="Key commands" style="width:none; border: none">
</div>
<div class="cell right">
BrainTool is designed to allow you to work more efficiently in your browser. One way of speeding up your work is to use the keyboard accelerators. Accelerators can access all the tools described above, as well as navigating and searching through the tree. Hitting 'h' will show all the available keyboard commands.
<br/><br/>
One thing to note here is that BT has the notion of a 'selection', which is the table row that is currently selected. This is the one on which keyboard commands will operate. It is shown in green in the tree.
</div>
</div>
## Search

s is the Search accelerator, or just click into the search box. As you type the next matching row will be selected and shown with matching text highlighted, searching downward from the current selected row (or the top row if there is no selection).

Hitting Alt/Opt-s, or down arrow, will select the next matching row. If search hits the bottom row without a match the search box will show in pale red. Hitting Down/Opt-s again will loop the search around to the top row.

R is Reverse search, it works like search but searches upward from the selection (or from the bottom row). At any point you can use up/down or alt-s/-r to find the next or previous match.

Hitting Enter exits search leaving you with the selected row which you can then operate on (eg open in a browser window by hitting enter again, or edit by typing 'e').

Note that search will find matches in the link title, link url and your notes, in open as well as hidden rows. The url, which is usually not displayed, will be shown if its the only match in the row.

In addition to the key commands, buttons for Up, Down and eXit are shown next to the search box and can be used when search is active. Additionally after three search characters have been entered the funnel icon filters the table to only show matching rows.

There's also a brief demo video on [this blog post]({% post_url 2021-10-06-Control-Your-Browser-with-the-Keyboard%}) (using an older version of the UI).

## Drag and Drop Organization
Items in the tree can be dragged to new positions just by selecting the item and moving it. An indicator bar will show the drop location. Dragging past the top or bottom of the tree will scroll. Hovering over a collapsed topic for a couple of seconds will expand that topic to allow you to drop your item inside. You can further expand sub-topics to drop an item anywhere in your tree. Dropping below an expanded topic will make the item a child of that topic. Dropping below a collapsed topic will make the item a sibling of that topic, ie they will have the same parent topic. 

## Settings and Actions
Settings control the configuration of your BrainTool. Actions are system-wide operations. The settings and actions panels can be accessed from the relevant buttons in the top right of the Topic Manager.
<div class="row">
<div class="cell left">
<img src="/site/Settings.png" alt="side-panel" style="width:none; border: none">
</div>
<div class="cell right">
<img src="/site/Actions.png" alt="popup" style="width: none; border: none">
</div>
</div>

## Actions
There are a number of Import and Export tools. You can import from browser bookmarks, an org-mode text file or an exported file from the TabsOutliner extension. You can export your topic hierarchy back out to browser bookmarks or to a local org-mode format text file. If org-mode and TabsOutliner are not familiar to you don't worry about it, they are not important! (Note that importing can take some time if you have a lot of data.)

If file syncing is enabled (see below) Actions also shows a button allowing a file refresh and another to turn syncing off.

## Settings
Via the 'Topic Manager Location:' selector you can change the default location of the Topic Manager such that it opens in a standard browser tab rather than the standalone window or in the browser Sidepanel. To effect the change, toggle the setting, then close and re-open the Topic Manager. 

Next there is the option to link your personal braintool topic map to a file on your local machine, or associated with a Google Drive account. If you have a Google account you can walk through an authorization step to allow BT to write all your data into a file you can access via Drive (in addition to saving it in browser storage). Alternatively you can sync to a local file which can then subsequently also be saved to DropBox, github or some other cloud storage. 

Note that you can only sync to one external file source. The GDrive option has the advantage that you can use the same synced file on different machines, browsers or accounts. Also Google will automatically keep incremental versions of your BrainTool file which can help with recovery if you overwrite or delete your data. The disadvantage is that Google requires *frequent* re-authorizations via a popup. The Local File saving has the option to 'Keep Backups' which will keep the last three versions, plus versions for the last three days of activity and a version for each of the last three months.

If you edit the file externally, or via BrainTool on another browser or machine, BT will warn you that your data is out of date the next time the Topic Manager gets focus and will offer to refresh from the external version.  You can also use the 'Refresh from File' button in the Actions panel at any point.

The next few Settings control various BT display customizations:
- Use the Dark Mode theme
- Show favicons for saved pages
- Use the new Compact Mode to fit more on the screen
- Use a larger font size.
- Turn off the display of tooltips.

The 'Use Tabgroups?' option determines whether BT tabs are grouped by tab groups or opened as individual tabs wherever the browser puts them. The default, Tab Groups, uses the recent tab group functionality in Chrome and Edge (as well as Brave and some other Chromium-based browsers) to give a visual indication in the browser of which tabs are associated with the same topic. Tab Groups can be named and colored by right clicking on the tab group indicator in the browser. 

Finally you have the option to upgrade to a 'Supporter' version of BrainTool based on a monthly or annual subscription or one-time purchase. The BT licensing model is one license per human user, used across any number of environment. This section shows your license key if you've made a purchase or installed in in this browser. If not it has a link allowing you to paste in your license code froma previous purchase.

Hitting one of the purchase buttons will redirect you to the third-party Stripe payment system. After your purchase you should be redirected back to the Topic Manager with the license code in place. 

<div class="row">
<div class="cell left">
After the 30 day trial period the display customization settings are locked for non supporters and a friendly solicitation  message is shown on startup. See the <a href="../pricing">Pricing</a> page for details.
<br/><br/>
<img src="/site/CollatoralMaterial/trialExpired.png" alt="side-panel" style="border:solid; border-width:thin; width:90%">
</div>
<div class="cell right">
<img src="/site/CollatoralMaterial/ThouShallNotPass.png" alt="side-panel" style="border:none; width:90%">
</div>
</div>

A cautionary note on the above, due to browser security restrictions, the purchasing and file backup workflows cannot be initiated when running in the browser side panel. Unfortunately the necessary popups and permissions dialogs cannot be displayed. You will need to jump back to Window or Tab mode to make these changes.

# Warnings, Messages and Tips
The BT Message pane is shown each time the Topic Manager is invoked. It shows a Warning if there is a file version mismatch, a Message if there's something new to bring to your attention or else a random tip on the use of BT. The pane can be closed using the button the left. Messages and tips can be cycled through using the More ('>>') button on the right.

Here are all the tips for reference. Send suggestions for inclusion to braintool.extension@gmail.com and maybe they'll end up in the app!

- Add ':' at the end of a topic in the BT Bookmarker to create a new subtopic.
- Double click on a table row to highlight its' open window, if any.
- Type ':TODO' after a topic in the BT Bookmarker to make the item a TODO in the BT tree.
- Create topics like ToRead or ToWatch to keep track of pages you want to come back to.
- Remember to Refresh if you've been editing the BrainTool.org file directly.
- Alt/Option-b is the BrainTool accelerator key. You can change that in extension settings
- You can save individual gmails or google docs into the BT tree.
- Save LinkedIn pages under specific topics to keep track of your contacts in context.
- Use the TODO (⭐️) button on a row to toggle between TODO, DONE and none.
- See BrainTool.org for the BrainTool blog and other info.
- Follow <a target='_blank' href='https://twitter.com/ABraintool'>@ABrainTool</a> on Twitter!
- Check out the Bookmark import/export functions under Actions
- You can click on the topics shown in the Bookmarker instead of typing out the name.
- Use the forward (>>) button on the right to cycle through tips
- Double tap ${OptionKey}-b, or double click the toolbar icon, to surface the BrainTool side panel.
- When you have an Edit card open, the ${OptionKey}-up/down arrows will open the next/previous card.
- Click on a row to select it then use keyboard commands. 'h' for a list of them.
- You can also store local files and folders in BrainTool. <br/>Enter something like users/tconfrey/Documents/' in the browser address bar.
- Try hitting '1','2','3' etc to collapse the tree to that level.
- Import public topic trees and useful links from braintool.org/topicTrees.
- Try the new DARK theme. It's under Settings.
- Tab cycles a selected topic from collapsed, to showing children, to showing all descendants.
- <span class='emoji'>&#128512;</span> You can use emojis to <span class='emoji'>&#127774;</span> brighten up your topic names. <span class='emoji'>&#128079; &#128736;</span>

# Advanced Topics
Ideally BrainTool is intuitive and just makes sense, however due to its operating model spanning tabs, tab groups, and bookmarks, there are some corner cases which may cause confusion.

## Tab Groups
In BT tab groups are used to show which BT topic a tab is part of. Chrome has recently rolled out some changes to the way tab groups work that conflict with BrainTools useage. Specifically these relate to Chrome's saving of tab groups and their display on the bookmark bar, with both these features being defaulted to on. This functionality is not available to extensions and so BrainTool is aware only of tab groups with open browser tabs. 

This means, for example, that when BT opens a new tab for a topic and displays it in a tab group, that tab group shows up in the bookmark bar and gets saved to your google account. If you close the tab group it is still saved in your bookmark bar. If you then re-open the item from BT, it will again put it into a new tab group named after the items topic, thus you will have two tab groups of the same name in your bookmark bar - confusing!

Relatedly, when you close tabs, BT marks them as closed but they are still part of the topic. In Chrome when you close a tab it is deleted from the saved tab group. So the items in a Chrome saved tab group end up being completely different from the items saved under a topic in BT. A side effect of this is that when you close the last tab in a tab group, Chrome will warn you that it is about to delete the tab group, which since it has the same name as the BT Topic can be concerning.

Unless you are using tab groups for other purposes the best approach is to turn off the display of tab groups in the bookmarks bar (right click on the bookmarks bar for the option). Also, check "Don't warn again" on the popup that warns about tab group deletion.

If you need the Chrome tab group functionality its best to turn off BT's tab group usage under Settings.

## Sticky Tabs
One challenge in the design of BT is what constitutes a unique saved item, or web place. With the modern web, what you consider a single item saved, eg a analytics dashboard in an app, might have many different urls. BT handles this by 'sticking' an item to the tab as it navigates and trying to be smart about recognizing when you've navigated away to a different unique web place. 

When you open the Bookmarker for an already saved item you get the option to update the items notes. But when you open a page from BT and then navigate to a different page via in-page links you might want to save that page as a new item. In this latter case you'll be warned that you are saving a new item. The original item will be marked as closed in the Topic Manager, and a new item will be created and saved into the same topic as the original item.

When BT concludes that a page navigation was to a new web place, eg if you type a url in the address bar or click a bookmark bar link, it will mark the original BT item as closed and move the tab out of the associated tab group.

# What Next?
For more information see the [FAQ and How-to page](../support) or reach out on the [BrainTool discussion group](https://groups.google.com/u/0/g/braintool-discussion).

If you are finding BT useful, tell a friend!