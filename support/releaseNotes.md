---
title: BrainTool Release Notes
description: Reverse chronological notes on recent BrainTool versions.
---

# Welcome to BrainTool 0.8!
This is a brief overview of the changes in this release.

## Support for Release Notes!
Hopefully you are seeing this page as a result of being upgraded to the new version of BrainTool. I also added a [Welcome](welcome.md) page for new installs, feel free to check it out. See also the general [Support](../support.md) page.

## Keyboard shortcuts
To support keyboard commands I've added the notion of having an explicitly selected row. Clicking a row selects it (also navigating Next or Previous selects the first or last row). The selected row is shown in <span style="background-color:#7bb07b">dark green</span> and the element-specific shortcuts operate on it. 

Key bindings were influenced by emacs/org-mode but given that the browser absorbs lots of control characters (Ctrl-N, P, S etc) and that only a small subset of BrainTool users are emacs/org natives, I defaulted to skipping the modifier key or using Option/Alt key instead. Commands operating on the selection are as follows:
  - Tree Navigation/Display:
    - <b>n,p or arrow keys</b> select the 'n'ext or 'p'revious row.
    - <b>left arrow</b> navigates up the tree to the selections parent Topic.
    - <b>Tab</b> expands or collapses the subtree for a Topic row.
  - Browser Control:
    - <b>Enter</b> toggles open/close the selected link in the browser, or all of its links if its a topic.
    - <b>Space</b> surfaces the selections' tab or window if it's open in the browser.
  - Tree Editing:
    - <b>Opt up/down arrows</b> move the selection up/down.
    - <b>t</b> cycles the TODO state.
    - <b>e</b> opens the editor for the selection.
    - <b>Opt left arrow</b> out outdents (promotes) the selection.
    - <b>delete</b> deletes the selected topic or occurrence.
    - <b>Opt enter</b> creates a new child Topic.

In addition there are the following general keys:
  - <b>Opt z</b> undoes the last deletion. (Only one level for now.) Note that previous versions of your BrainTool file are saved by Google on your GDrive.
  - <b>Opt-b</b> opens the BrainTool popup on the current browser tab.
  - <b>Opt-b-b</b> opens and selects the BrainTool side panel.

## Ability to tag all a windows tabs at once
See the checkbox on the BT popup.

## Stats Bar
I reworked the control tab to be static at the top of the screen and added a stats bar showing you how big your braintool is.


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
