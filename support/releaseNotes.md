---
title: BrainTool Release Notes
description: Reverse chronological notes on recent BrainTool versions.
layout: default
tagline: The Topic Manager for your Online Life
audience: user
---

# Welcome to BrainTool 0.9.9

Inching closer to 1.0! I'm getting such great feedback from users that I can't resist the temptation to incorporate the improvements before closing on 1.0. See [Pricing](../pricing.md) for a special offer for pre-1.0 subscribers.

## New Look and Feel including a Dark Mode
I completely revamped the BT fonts and color palette and added a dark mode - the most requested feature.

## Re-organized Saver Tool
I made another iteration on whats been called the bookmarker or popup to make it easier to understand while keeping it fast and efficient for both mouse and keyboard users. Additionally, any number of nested new topics can now be created from the Saver e.g. setting the topic to Animal:Vertebrate:Mammal:Carnivore:Canid:Dog:Hound:Beagle will create 8 levels of topic if they don't already exist.

## Compact Mode
Another highly requested feature. Shrinking the Topic Manager to less than 350 pixels wide hides the notes column for a highly compact and information dense display of your saved topics and pages.

## "Open in New Window" Tool
You can now open a page, or complete topic, in a new window. The previous mapping of topics to windows has been removed as being too complicated. You can choose to have BT manage your tabs, grouping them into tab groups, or not, thus leaving them wherever you or the browser puts them. BT will no longer confuse you by moving tabs between windows.

## "Add Top Level Topic" Tool
Available at the top of the Topic Manager. Hopefully this one is self-explanatory.

## Topic Manager window remembers its position
The Topic Manager now opens with the same size and position as it had when it was last closed.

## GDrive Refresh Button
If you have GDrive syncing turned on, the Refresh button is now available in the top toolbar whenever BT detects that there is a newer file available.

## Topic Tree imports
A correctly formatted org-mode file will now import its contents into the appropriate nesting in the tree. See [these topic trees](../topicTrees) as an example.

## Other Usability and Misc Improvements
I removed the counter for number of saves (top right) because its no longer part of the [pricing model](../pricing). Lots of improvements were made in areas like the card editor, the initial topic tree, the initial placement of the topic manager etc.


# BrainTool 0.9.8
## New Bookmarker 
To address some confusion and to make the 'popup' more usable I've re-designed it from the ground up and done some rebranding. I'm now calling the popup 'Bookmarker'. Clicking the BT icon (or Opt/alt-b) now opens the Bookmarker showing the note card for the page with the Notes field selected. You can still just hit enter to move on without adding a note, for speed. This new card editor also allows you to edit the page title and it's where you can select to save all tabs or just the active one.

On exit the card editor opens the topic selector. This was also reworked to show a clearer view of your topic hierarchy. The hierarchy starts partially open and subtopics can be opened, closed and selected with your mouse. Auto complete works as before, just start typing. The previous 'Group', 'Stick', 'Close' options have been reduced to a selector for 'Group' or 'Close'. The selector remembers its start and defaults to that the next time around.

## Skip the Topic!
By popular demand I added a 'Scratch' topic. If you leave the topic selector empty the page (or pages) will be added under the Scratch topic. This means you can save a page, or all pages in the window, by bringing up the Bookmarker and hitting Enter twice, the first creates the note card with an empty note, the second saves the page under Scratch.

## Update existing note cards in the Bookmarker
With this new bookmarker design I was able to add the ability to edit the notes and title for existing saved pages. Opening the Bookmarker for a page already saved to BT will open it's note card and save any updates. (NB changing its topic still needs to be done in the Topic Manager.)

## Side Panel is now Topic Manager and can run in a tab
The term 'Side Panel' did not make sense to folks so its been renamed to Topic Manager. Based on a suggestion from Crimson K and validation from Timothy, I added an option for the Topic Manager to run in a browser tab rather than the current side panel. Its not optimized for this form factor and for me it works better as a panel off to the side of my browser tabs but it seemed worth adding to support a full-page-on-top type setup. From Options, change 'Topic Manager in:' from 'Side Panel' to 'Tab', wait a few seconds for it to save, then close the Topic Manager. When you relaunch, the Topic Manager will open in a regular browser tab. If you use it in this mode I'd be interested in feedback over in the discussion group.

## Performance Improvements
Thanks to Timothy for stressing BT with his six thousand plus bookmarks! A small tweak to avoid a low level recalculation of layout for every table row added resulted in a significant speed up on first start with a big braintool.org file. Search got similar performance attention and should now be snappier.

## Search Improvements
Thanks to Peter for his detailed feedback on Search. Improvements include better key handling on Linux, being able to 'escape' key out of search, restoring previous selection on failed search and a few other bug fixes.

## Space key
Also based on Peter's feedback, the space key will now open a tab for the selected item if its not already open, and highlight it if it is open.

## BT Icon State
Thanks to feedback from Richard, the BT toolbar icon now properly indicates when the Topic Manager is closed and thus BT is not operational.

# BrainTool 0.9.7
## Search
Yay! I added the incremental search I've wanted for a long time. See the new [User Guide](./userGuide) for details, or just try playing with it and let me know what you think. There's also a [brief demo](https://www.youtube.com/watch?v=TVaIQHoxxZU) on YouTube.

## Best effort mapping of open tabs to saved links on startup
When you first launch BrainTool it will attempt to find any tabs which you have already saved into your braintool.org file and show them as open in the tree. Note that since some web sites do an invisible redirect, which changes the URL, some matches may not be shown.

## Selection in tree now tracks highlighted tab in browser
As you navigate tabs in the browser any matching row in the BT tree will be selected (and scrolled into view).

## Minor onboarding updates and usability updates
- I trimmed the initial BrainTool.org file contents to be less overwhelming.
- The initial first-click popup now explains the side panel and popup.
- When the side panel is closed the popup icon now shows an indication that BT is not running.

## Bug fixes 
- BT now saves correctly on keyboard number based folding and keyboard row moves. 
- Topic nodes with no links are now placed correctly in the hierarchy. 
- (BTW Thanks to Richard for detailed bug reports on these two issues.)
- Better handling of Google Drive versioning should remove spurious warnings about a newer file version existing. These were caused by the 0.9.6 feature that warns if the synced GDrive file has been changed external to BT.
- Tab navigation now works correctly on the topic card editor.

## [New User Guide](./userGuide)
Its a first pass I'd appreciate feedback.

# BrainTool 0.9.6

## Cleaner more minimal UI
Based on the results of a comprehensive review by a panel of designers and UX folks I've moved to a cleaner more minimal UI with bigger buttons, more spacing and clearer backgrounds. 
## Improved onboarding process
Combined with the general UI improvements I overhauled the installation and getting started process to try to address areas where new users were getting confused and to get them up and running with less effort.
## Support for Edge and Brave browsers
Edge users can get BrainTool at the Edge store. Brave users can install from the Chrome store. Unfortunately Firefox does not support the tab groups function BT needs and has other incompatibilities that made it too onorous for me to support it in this release. Vivaldi (installable via the Chrome store) works with Topic mapping set to 'Windows'.
## Added support for subscription memberships and coupons
In advance of the 1.0 version of BrainTool I needed to put some structure in place to allow me to charge for premium subscriptions. See the in-app coupon offer!
## Version warnings for synced Google Drive file
If you've chosen to sync to a Drive file BrainTool now checks before saving, and on getting focus, whether there's a more recent version than the one you are viewing and if so provides an alert (if saving) or warning.

# BrainTool 0.9.1a
This is a minor update with some Side Panel improvements (no change to the core extension). The header row now shows GDrive connected state and, on hover, the latest save time. The Edit Card popup has been cleaned up quite a bit and now allows tabbing through fields and navigation to next/previous cards with Alt/Option arrow keys. Other popups were tweaked for consistency. Finally, the 'Refresh from Gdrive' button has been moved inside the Options panel.

See below for release notes from 0.9.0 and previous versions. 

# BrainTool 0.9.1
Org mode import fixes.

# BrainTool 0.9.0
## File Import/Export
In addition to Chrome Bookmarks, 0.9 adds the ability to import from a TabsOutliner export and also to import a text file with org-mode markup. Heading, paragraph text and contained http(s) links are extracted and represented in the tree.

In addition to exporting to Bookmarks you can now also export an org file.

## org-mode Support
This version upgrades to version 2 of the very handy [orga.js](https://github.com/orgapp/orgajs) org parser by [@xiaoxinghu](https://github.com/orgapp/orgajs/commits?author=xiaoxinghu). BrainTool should now retain any org markup in the BrainTool.org file (or an imported file). BT stores app data using headers for Topics, headers with links for topic occurrences (ie links) and paragraph text for notes. Other constructs such as lists, tables, blocks etc will just be shown in plain text in the tree and written back out as such.

The idea here is to allow BrainTool to become an integral part of a text and org-based note taking and productivity workflow.

## Removed GDrive Dependency
The need to perform the GDrive permission workflow on the initial install made the whole thing overly complicated for people. With the new ability to upload and download the file manually I decided to decouple the GDrive permissions.

By default BT now stores your data in Chrome local storage. This should be resilient across browser sessions on a single Chrome instance. Its still advisable to also write to the BrainTool.org file on your GDrive but not necessary. If you currently have the GDrive app connected you can disconnect it from Settings on the [GDrive web page](https://drive.google.com).

## Other Minor Improvements
 * New Keyboard commands - entering 1 through 9 now collapses the tree to the numbered level (e.g. hit '2' to show just the top two levels of the tree)
 * URLS of the form file:/// are now supported, type something like file:///users/tconfrey/Documents/ into Chrome's address bar and save it into your BT tree! 
 * Tree folding and unfolding now has a slight animation to help maintain your bearings.
 * The popup now has some descriptive hover text and an explicit 'Save' button which does the same thing as just hitting Enter in the Notes field.


# BrainTool 0.8.1

This BrainTool point release has a few changes you might notice:
  - Improvements to navigation with the right and left arrow functions to open and close nodes while navigating the tree.
  - Showing the topic's full parentage in the topic editor popup.
  - Better pre-fills for the topic to use in the popup.
  - Improvements to keeping tabs assigned to tab groups properly during navigation.
Thanks to Richard and Matti for their bug reports, suggestions and feedback on the above.

<hr/>

# BrainTool 0.8.0

## Support for Release Notes!
Hopefully you are seeing this page as a result of being upgraded to the new version of BrainTool. I also added a [Welcome](welcome.md) page for new installs, feel free to check it out. See also the general [Support](../support.md) page.

## Keyboard shortcuts
To support keyboard commands I've added the notion of having an explicitly selected row. Clicking a row selects it (also navigating Next or Previous selects the first or last row). The selected row is shown in <span style="background-color:#7bb07b">dark green</span> and the selection-specific shortcuts operate on it. 

Key bindings were influenced by emacs/org-mode but given that the browser absorbs lots of control characters (Ctrl-N, P, S etc) and that only a small subset of BrainTool users are emacs/org natives, I defaulted to skipping the Control key. Commands operating on the selection are as follows:
  - Tree Navigation/Display:
    - <b>n, p or up/down arrow keys</b> select the 'n'ext or 'p'revious row.
    - <b>left arrow</b> collapse the selection, if expanded, then navigates up the tree to the selections parent Topic.
    - <b>right arrow</b> expand the selection, if collapsed, then navigates down the tree to the selections children.
    - <b>Tab</b> expands or collapses the subtree for a Topic row.
  - Browser Control:
    - <b>Space</b> surfaces the selections' tab or window if it's open in the browser. (NB you also get this by double clicking a row.)
    - <b>Enter</b> toggles open/close the selected links tab in the browser, or all of its tabs if its a Topic.
  - Tree Editing:
    - <b>Opt-up/down arrows</b> move the selection up/down.
    - <b>t</b> cycles the TODO state.
    - <b>e</b> opens the editor for the selection.
    - <b>Opt-left arrow</b> outdents (promotes) the selection.
    - <b>delete</b> deletes the selected topic or occurrence.
    - <b>Opt-enter</b> creates a new child Topic.

In addition there are the following general keys:
  - <b>h</b> Keyboard commands can be shown any time by typing 'h'.
  - <b>Opt-z</b> undoes the last deletion. (Only one level for now.) Note that previous versions of your BrainTool file are saved by Google on your GDrive.
  - <b>Opt-b</b> opens the BrainTool popup on the current browser tab.
  - <b>Opt-b-b</b> opens and selects the BrainTool side panel.

## Ability to tag all a windows tabs at once
See the checkbox on the BT popup.

## Stats Bar
I reworked the Options menu to be static at the top of the screen and added a stats bar showing you how big your braintool is.

<hr/>
# BrainTool 0.7
In addition here's what happened in 0.7.


- New grouping options were introduced. 
    - Window, as before one window per Topic. 
    - Tab Group - a tab group per Topic. 
    - None - no active grouping, tabs are created in place.
- NB the TabGroup api is not fully supported in the production version of Chrome so tab group names are not synced with Topic names.
- New Topic insert button. Add a sub topic under any topic.
- Support for topics with no links to occurrences.
- Updated icons. 
- The BT toolbar badge scrolls to show full tag name and shows notes on hover and in the popup (read-only).
- double-tap option-b to surface BT window
