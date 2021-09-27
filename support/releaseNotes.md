---
title: BrainTool Release Notes
description: Reverse chronological notes on recent BrainTool versions.
layout: default
tagline: The Topic Manager for your Online Life
audience: user
---

# Welcome to BrainTool 0.9.7
Inching closer to 1.0! I liked the new search feature so much that I wanted to release it asap. So instead of going straight to 1.0 I'm releasing a 0.9.7. See [Pricing](../pricing.md) for a special offer for pre 1.0 subscribers.

## Search
Yay! I added the incremental search I've wanted for a long time. See the new [User Guide](./userGuide) for details, or just try playing with it and let me know what you think.

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
