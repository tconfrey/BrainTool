---
title: BrainTool Release Notes
description: Reverse chronological notes on recent BrainTool versions.
---

# Welcome to BrainTool 0.8!
This is a brief overview of the changes in this release.

## Support for Release Notes!
Hopefully you are seeing this page as a result of being upgraded to the new version of BrainTool. I also added a [Welcome](welcome.md) page for new installs.

## Keyboard shortcuts
To support keyboard commands I've added the notion of having an explicitly selected row. Clicking a row selects it. The selected row is shown in <span style="color:#7bb07b">dark green</span> and the element-specific shortcuts operate on it. 

Key bindings were influenced by emacs/org-mode but given that the browser absorbs lots of control characters (C-N, P, S etc) and that only a small subset of BrainTool users are emacs/org natives, I defaulted to skipping the modifier key or using Option. Commands operating on the selection are as follows:
  - n,p or arrow keys select the 'n'ext or 'p'revious row.
  - Left arrow out outdent the selection.
  - Tab expands or collapses the subrtree for a Topic row.
  - Enter toggles open/close the selections link, or all of its occurrences if its a topic.
  - t cycles the TODO state.
  - Shift up/down arrows move the selection up/down.
  - e opens the editor for the selection.
  - space surfaces the selections' tab or window if its open in the browser.
  - delete deletes the selected topic or occurrence.
  - alt-enter creates a new child Topic.

In addition there are the following general keys:
  - Opt-z undo the last deletion. (Only one level for now.) Note that previous versions of your BrainTool file are saved by Google on your GDrive.
  - Opt-b opens the BrainTool popup on the current browser tab.
  - Opt-b-b opens and selects the BrainTool side panel.

Ability to tag all a windows tabs at once.

Reworked the control tab to be static at the top of the screen and added a stats bar showing you how big your braintool is.


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
