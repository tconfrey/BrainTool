---
title: BrainTool Release Notes
description: Reverse chronological notes on recent BrainTool versions.
layout: default
tagline: The Topic Manager for your Online Life
audience: user
---

# Welcome to BrainTool 0.9.1a
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
