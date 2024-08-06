---
layout: post
title:  "The Best Tabs Outliner Alternative"
description: BrainTool is the best alternative to Tabs Outliner
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
image: "../../../site/postAssets/BT-TO.png"
---
# BrainTool 1.0 is the best Tabs Outliner Alternative
<!--start-->
Tabs Outliner is a venerable and highly functional browser extension for managing tabs and sessions. It's tree structure and side panel display were an inspiration during BrainTool's early development. BrainTool is different than Tabs Outliner, however the two tools have significant overlap and many Tabs Outliner users have found that BrainTool is the better tool for their workflow. Google is in the process of discontinuing support for its Manifest V2 extension infrastructure and Tabs Outliner is looking moribund. Tabs Outliner users should evaluate BrainTool. 
 <!--end-->
 
 UPDATE AUGUST 2024: Tabs Outliner has been updated to MV3. However if you are user of Tabs Outliner then BrainTool might still be of interest.
 
![TabsOutliner and BrainTool](../../../site/postAssets/BT-TO.png)
## The Pending Deadline
Chrome browser extensions are built using a set of exposed APIs and run in a controlled sandbox environment. BrainTool was built on 'Manifest V2'. For a number of years Google has been tying to enforce the use of the 'Manifest V3' version of its browser api's and extension infrastructure, reportedly for security and performance reasons. An initial conversion deadline last year failed after developers revolted and pointed out that the V3 API could not support the needs of many very highly used extensions (most particularly ad blockers and other content filters).

To their credit Google retrenched and worked with developers, pushing out the deadline to this year. Well that deadline is [now upon us](https://www.theverge.com/2024/5/30/24168057/google-chrome-extension-change-manifest-v3-ad-blockers). The June version of Chrome's 'canary' build (a pre-release version available to developers, or anyone, wanting to try it out) turns off support for extensions running on V2. That canary version will soon make it into production, at which point Google will start turning off V2 extensions for swaths of users. Exactly when or how that will happen is not public, maybe not even decided yet. 

Tabs Outliner is one of many highly used and successful extensions that have been on the Chrome Extension Store for years with no updates or signs of support. Thats a success story in many ways, but users of those extensions are now at risk of loosing access to the tool and associated data. Having put in the work to migrate BrainTool I can report that it was a non-trivial effort. (Albeit a good forcing function for me to release BrainTool 1.0!) I received input on a pre-release candidate from a number of Tabs Outliner users and have put some effort into smoothing the migration path.

## Tabs Outliner Vs BrainTool operating model
![TO hierarchy](../../../site/postAssets/TO-hierarchy.png)

Tabs Outliner shows a dense tree with Window nodes containing Tab nodes representing your currently open windows and tabs. Sessions can be saved - the tree will show saved sessions alongside the live one. There are also pure notes nodes and visual separators of various kinds. When tabs are opened from other tabs they are nested in the tree creating a deep structure. Tab groups are ignored and search uses the browser search which only operates on visible text.

![BT hierarchy](../../../site/postAssets/BT-Hierarchy.png)

BrainTool focuses on helping you build a curated tree of online resources and then using that tree to subsequently find, open and close tabs and tabgroups with ease. The tree hierarchy is composed of Topics, which are groupings or categories into which you organize tabs. It has explicit topic/sub-topic/sub-sub-topic semantics. Adding notes is encouraged, full text incremental search makes it easy to find things and all functionality is available via keyboard commands. BrainTool does not (currently) have a live view of windows and tabs and does not save anything unless it's explicitly added via the Bookmarker tool. In 1.0 BT makes heavy use of browser tab groups to reflect its topic structure in the browser. Using plain text [org-mode](https://orgmode.org) as its storage format allows BT to interact with other productivity tools.  

## How to Migrate from Tabs Outliner to BrainTool

1. Clean up!
- In my useage Tabs Outliner saved a lot of spurious tabs and windows and sessions that I subsequently just left in the tree. If you are going to try migrating to BrainTool I recommend reviewing your current tree and deleting anything you obviously don't need to save. 

2. Export from Tabs Outliner
- From the Tabs Outliner bottom menu click the Settings item.
- If you haven't previously done so enable the Google Drive Backup Controls. This is required to unlock the export function. 
- Scroll down to the Export heading and select "Export Tree to File"
- This should create a <date>.tree file in your Downloads folder.
3. [Install BrainTool](https://chromewebstore.google.com/detail/braintool-beyond-bookmark/fialfmcgpibjgdoeodaondepigiiddio) and set up your high level structure
- BrainTool comes with a small default Topic hierarchy but this is a good opportunity to review how you are categorizing your online resources and define your initial working Topic hierarchy. 
4. Import to BT
- Open BT and click Actions. There's an option for Tabs Outliner under Import. Find the file saved above from your Downloads folder and import it. A version of the TO tree should be created in your BrainTool tree.
5. Drag/drop/move and organize your tabs. Some useful features:
   - The number keys will expand, or collapse, the BrainTool tree to the corresponding depth. The tab key cycles the expanded state of the selected node.
   - M-up/down will move the selected node, and any children, up or down in the tree.
   - M-left arrow will promote the selected node up the hierarchy.
6. Give it some time 
- BrainTool is not complicated but, like Tabs Outliner, takes a little getting used to. 

## BrainTool verses Other Alternatives

<table><tr><td style="width: 50%; border:none; padding-left: 40px; padding-right: 100px; text-align: justify;">
There are many (many, many) tools that are, or claim to be, some combination of tabs and session managers or bookmarkers or other takes on browser productivity tools. See <a href="https://braintool.org/2022/03/10/Five-tools-for-browser-productivity.html">here</a> and <a href="https://alternativeto.net/software/tabs-outliner">here</a> for some descriptions and reviews. None, that I'm aware of, are an exact match for Tabs Outliner and there are many different approaches, but IMHO BrainTool has one of the most similar mindset. In addition: 
</td><td style="border:none">
<img src="../../../site/postAssets/Five Tools/meme.png" alt="is mindblowing" style="height: 450px; border:solid; border-color: lightgrey; border-width: 1px; padding: 5px">
</td></tr></table>

 - BrainTool is [source available](https://github.com/tconfrey/BrainTool).
 - BrainTool imports from Tabs Outliner.
 - BrainTool also imports/exports bookmarks and org-mode files and syncs to a local plain text file you can edit. 
 - Google Drive sync is also supported for multi-computer syncing.
 - While not as dense as TO, BrainTool fits a lot of information and structure into its display, unlike visual bookmarking tools like [RainDrop](https://raindrop.io) or sharing tools like [Toby](https://www.gettoby.com/).
 
## In Conclusion
Its not yet clear how the Manifest V3 migration will progress but now is a good time to check out BrainTool 1.0 running on MV3. It's fully usable free and can even be used in parallel with Tabs Outliner. 
