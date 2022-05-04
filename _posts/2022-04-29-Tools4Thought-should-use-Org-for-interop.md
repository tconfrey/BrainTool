---
layout: post
title:  "Tools for Thought should use org-mode for Interop"
description: "Tools for Thought need a standard for data interoperability. Here's why it should be org-mode"
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
image: "../../../site/postAssets/org-interop.png"
---
# Tools for Thought need a standard for data interoperability. It should be org-mode

## What are Tools for Thought
<!--start-->
 Tools for Thought is a general term for software applications that help us capture, process, store, and retrieve all of the stuff we need to absorb in our information-overloaded lives. The Tools For Thought (#TfT) space is exploding, with new products becoming available every day. Journaling tools, task managers, outliners, and networked note-taking apps are all tools for thought. Second brain app is another term used for these kinds of tools.
 <!--end-->

## Why do Tools for Thought need data interoperability
 No one tool does it all. People need to be able to use multiple productivity and personal knowledge management tools (heres [Paco's opinion](https://medium.datadriveninvestor.com/why-duplicating-data-in-2-apps-of-your-pkm-is-not-a-drama-if-your-workflow-is-well-defined-791d8630f88c)). People also want to share subsets of their second brain content with others. Tools in the space continually appear, evolve and disappear. For these and other reasons there should be a base level of interoperability between tools in the #TfT space.

 Interoperability needs an understanding of the things we're describing and the language or format we're using to do so. For #TfTs those things include paragraphs of marked up text, outline hierarchies, dates, tasks, tags, lists, tables, pointers to external resources (eg bookmarks) and internal links/relationships. Formats include XML, JSON and just plain text.

## Options for an interop format
 Over time there have been many efforts to standardize how we exchange information, and information about information, (semantic web, XML/WSDL, RDF, OWL etc), but none successfully addressing the semantics required to describe the set of #TfT entities above.

 Markdown was defined in 2004 as a human readable markup language, it has been adopted by a number of note taking and [Zettlekasten](https://virtuwise.com/zettlekasten-method/) tools such as [Obsidian](https://obsidian.md/) and [Bear](https://bear.app). It is an obvious option for an interop format. But it only covers a subset of the semantics and has been extended inconsistently across applications, so much so that there is now an effort ([CommonMark](https://commonmark.org)) to re-standardize the variants. Markdown does not have good developer support and has other deficiencies as outlined by @kmelve [here](https://www.smashingmagazine.com/2022/02/thoughts-on-markdown/).

 Dave Winer has [advocated using OPML](http://scripting.com/2021/12/19/152625.html?title=followingMyTweetsInDrummer#a153247), a long-standing XML-based hierarchy/outline description. But again, small semantic footprint. 
 
 <table><tr><td style="border:none; padding-left:0px">Most tools use proprietary formats and app-specific APIs, but there are efforts underway to define new models. <a href="https://github.com/portabletext/portabletext">Portable Text</a> and <a href="https://github.com/CondeNast/atjson">atJSON</a> are JSON specifications targeted at the space. There are also a number of other <a href="https://talk.fission.codes/t/tools-for-thought-atjson-as-a-potential-format-for-interchange/1880">build-something-new</a> proposals.</td><td style="border:none; width: 60%"> <img src="https://imgs.xkcd.com/comics/standards.png" alt="xkcd N+1 standards"> </td></tr></table>

 While there are plenty of interesting options, XML and JSON based formats all have the disadvantage of not being human readable, and anything new is going to take time to evolve. So is there something existing that fits the bill? Turns out there is, it's Org-mode!

## Org-mode for interop
[Org-mode](https://orgmode.org), developed in 2003, was "designed for notes, planning, and authoring" as a module inside the [emacs text editor](https://www.gnu.org/software/emacs). It is both an application running inside emacs, controlled with keyboard commands, and a plain text markup language for describing content. It has broad adoption within the emacs community and has been continuously refined as a personal text-based #TfT by productivity and process savants for decades. In its current state [org-mode syntax](https://orgmode.org/worg/dev/org-syntax.html) can model all the listed aspects needed for #TfT interop. In addition it is at least as human readable as markdown, [see Voit](https://karl-voit.at/2017/09/23/orgmode-as-markup-only/).

There are an increasing number of [tools using org-mode outside emacs](#f1).  Org-mode has strong developer tool support, and there are a number of [parsers available](#f2). Rather than reinvent the wheel, build something proprietary, or adopt an inferior solution, I recommend companies in the #TfT space look at adopting Org for interoperability between tools and, ideally, as a user-accessible data store.
 <br/><br/><br/>
![org-mode for #TfT interop](../../../site/postAssets/org-interop.png)
<br/><br/>
### Why don't #TfTs already use org-mode
 Well actually some do! Obviously the original org-mode/emacs combo qualifies as a #TfT, but in addition the popular [LogSeq](https://loogseq.com) app reads and writes Org, as does BrainTool. That said, Org, living in the self-contained emacs ecosystem, has an enormously steep learning curve for the outsider and so has never been widely known. Plus, until recently the only definition of org syntax was embodied in the emacs lisp code running the Org application (as noted above this is no longer the case).

## What would it look like to use org-mode for interop
From an end user perspective using Org for #TfT interop would look like having a repository of plain text files stored somewhere and giving various applications access to those files to perform their specific function. A 'task' created in my journaling app should then show up in my task manager. When I mark it complete in the task manager, it should also show as complete when I revisit my journal (perhaps with annotations as to when it was completed). See [this demo](https://braintool.org/2022/01/28/Browser-based-Productivity-and-pkm-with-emacs-org-mode-LogSeq-and-BrainTool.html) for an example of the same tasks being usable across BrainTool, emacs/org and Logseq.

Org-mode covers a lot of ground and not every application needs all of those entity types. The minimal bar for an application to be 'Org compliant' is that it read and write plain text without screwing up any embedded Org markup. From this perspective any plain text editor is level zero compliant and could be used to edit Org-based #TfT content. 

Karl Voit has proposed ['OrgDown'](https://gitlab.com/publicvoit/orgdown/-/tree/master) which is a model for defining increasing subsets of Org as conforming to different levels of compliance. Thus far only an OD-1 level is defined. Personally I would prefer to see a more granular enumerated list of OrgDown entity types for which applications can demonstrate support. See the [addendum](#addendum) below for one take at such a list.
<hr/>
Have thoughts? Drop a comment on the [https://twitter.com/tconfrey/status/1521934272617136131](Twitter thread)
<hr/>
<a name="addendum"></a>
#### Addendum: Proposed Org syntax components
<table>
<tr><td><b>OD-item</b></td><td><b>Description</b></td></tr>
<tr><td>OD-0</td><td>Read and write plain text preserving any markup.</td></tr>
<tr><td>OD-Outlines </td><td>Nested outlines/headers with paragraph text.</td></tr>
<tr><td>OD-Markup </td><td>Basic text markup (bold, italic etc).</td></tr>
<tr><td>OD-ListsAndCheckboxes </td><td>Bulleted and numbered lists. Lists of checkbox items.</td></tr>
<tr><td>OD-EscapesAndComments </td><td>Sections not subject to interpretation as markup. Meta comments not intended to be interpreted by an application.</td></tr>
<tr><td>OD-Tables </td><td>Basic table formatting.</td></tr>
<tr><td>OD-Links </td><td>
    1) One-directional <br/>
    2) Bidirectional.</td></tr>
<tr><td>OD-Tasks </td><td> 1) Basic todo/done toggle<br/>
    2) Configurable lifecycle.</td></tr>
<tr><td>OD-Tags </td><td>Tag assignment to outline headers with inheritance along the outline hierarchy. </td></tr>

<tr><td>OD-Properties </td><td>Name value pairs of meta-data properties associated with an outline or file. Useful for app-specific content.</td></tr>
</table>
<hr/>
<a name="f1"></a>
#### Org-Mode tools outside Emacs
- [https://BrainTool.org](https://BrainTool.org)
- [https://logseq.com](https://logseq.com)
- [https://plainorg.org](https://plainorg.org)
- [https://orgzly.com](https://orgzly.com)
- [https://flathabits.com](https://flathabits.com)
- [https://beorg.app](https://beorg.app)
- [https://easyorgmode.com](https://easyorgmode.com)
- [https://organice.200ok.ch](https://organice.200ok.ch)
- [https://orgro.org](https://orgro.org)
    
    
<a name="f2"></a>
#### Org-Mode Parsers
- [https://github.com/200ok-ch/org-parser](https://github.com/200ok-ch/org-parser)
- [https://github.com/orgapp/orgajs](https://github.com/orgapp/orgajs)
- [https://hackage.haskell.org/package/org-mode](https://hackage.haskell.org/package/org-mode)
- [https://github.com/logseq/mldoc](https://github.com/logseq/mldoc)
<hr/>
