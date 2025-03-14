---
title: BrainTool Philosophy
layout: default
tagline: The Topic Manager for your Online Life
description: BrainTool goes beyond bookmarks to organize the things you want to remember and get back to. Free and private. Download now!
audience: nonuser
---
## BrainTool Vision
While working online you should be able to easily capture and categorize all the tasks, information and knowledge you want to keep track of, get back to it when you need it and edit it as part of your personal information space. Having a system you can trust allows you to close out tabs, avoid distraction and stay focused.

Work these days generally takes place in a proliferation of browser tabs. Increasingly knowledge workers are using task managers and personal knowledge management tools to keep track of notes and tasks and ideas. BrainTool unifies these two information spaces making it easy to organize all of your browseable information resources into a set of related 'Topics' and to capture to-dos and free-form notes on those topics within your personal organizational system.

The long term vision for BrainTool is to be the tool your brain needs to keep track of all of your information. It will expand to offer a beautiful and satisfying in-place note taking and curation environment, full content search, productivity tools, and content sharing.

## General Philosophy
- BrainTool uses *your* data with *your* permission to provide tools to manage, organize and access everything you do in a browser. Your data is stored in a human-readable plain text format that you own and have complete control over. 

- BrainTool endeavors to be a fantastic standalone tool but also to work well with other text-based workflows and to readily integrate with an ecosystem of information management and productivity tools.

- There's a free version of BrainTool because I initially built it for myself using free software and resources to do so, so it seems nice to share! Subscriptions and purchases are cheap because I want a lot of people to use it.

- Some companies give software away for free and make money off collecting and selling user data. With a subscription or purchase you are funding BrainTool's development and continued improvement, and keeping your data to yourself.

## Security
BrainTool is comprised of a browser extension and a JavaScript web application. The app is entirely a static, source-available, client-side app served from [a public software repository](https://github.com/tconfrey/BrainTool). Your data is stored in browser memory or optionally in a file called BrainTool.org, locally, or on your Google Drive. No information is stored or accessible anywhere else. (See also the [official privacy policy.](./BrainToolPrivacyPolicy.pdf))

## Product Overview
The BrainTool browser extension is a knowledge/notes/links/browser manager. While browsing use the Bookmarker to assign a Topic to web pages you want to save and optionally add a note. Topics, links and associated notes are stored in your personal braintool file. 

Topics provide a way of organizing your information. Think of BrainTool as the index into your personal information space. Each topic is represented by a node in the tree shown on the BrainTool Topic Manager, and within the browser by a dedicated window or tab group, with tabs for saved links. 

The Topic Manager is your central controller. With drag and drop and powerful keyboard commands it allows you to organize and annotate your topic tree, and to operate your browser - opening, closing and navigating between tabs and windows with ease.

<img src="/media/ReleaseCandidate-TG.png" alt="Tab Groups">

By organizing links and capturing your notes about them you are mapping your personal information space. BrainTool stores that information space in a plain-text file. As you save pages and add notes a file called BrainTool.org is kept updated. That file is regular text but structured in the public [org-mode](http://orgmode.org) format. The text file can be edited in any text editor but ideally in emacs with org-mode.

<img src="/site/ScreenShot.png" style="border:solid; border-width:thin;" alt="Screenshot showing BrainTool with emacs and Chrome views">

<!--
# <A href="#concepts">Concepts</A>
BrainTool (BT) is loosely based on the semantic web idea of [Topic Maps](https://ontopia.net/topicmaps/materials/tao.html) which define a 'TAO' of information: _Topics_ as an organizational unit, _Associations_ between topics, and _Occurrences_ of information about a topic. There's a more detailed treatment of [using Topic Maps to manage your online life.]({% post_url 2021-05-15-Browser-Productivity-with-a-Topic-Manager%})

## Topics
Topics are the basic unit of organization. A project you are working on can be a topic. An area of responsibility can be a topic (eg Home Finances). As can a set of resources you want to keep track of (eg web sites related to programming Chrome Extensions). Every parent node in the BT Topic Manager is a topic.

## Associations
Associations are links capturing a relationship between topics. Currently in BT the only associations are containment relationships between a topic and its subtopics. In the longer term bidirectional links will capture other kinds of association.

## Occurrences
Occurrences of information about a topic are the things you save and capture into your braintool file. That includes all of your saved pages as well as the notes associated with a page or topic.
-->

## Roadmap
There will always be a fully functional, free and open source version of BrainTool with a continuously evolving and improving feature set. The following is not intended to be complete or in priority order, [feedback is appreciated](https://groups.google.com/u/0/g/braintool-discussion).

*Note that BrainTool is intended to help you actively curate an information space, it is not meant to passively observe or capture all of the random information that flows through your browser.*

- **Alternative Backends**: While the current app allows on-demand local file export and a continuously synced local or Google Drive file with automated backups, it would be nice to support different storage back ends.
- **In-Page Highlighting**: Some similar tools find value in allowing the user to capture text from within a saved page, this might make sense for BrainTool also.
- **Notes Editor**: The current BT text editing capabilities are pretty basic. Given that it's all just text, emacs or any other text editor can be used. That said, it is a goal for BT to allow note taking in-place within the browser via some kind of simple but beautiful and highly satisfying editor tool.
- **Org Functions**: Org-mode itself provides a good roadmap for BrainTool's potential feature set. Org is a massively functional but highly complex personal organizational tool. BrainTool could provide an intuitive overlay for a subset of Orgs most important functionality - TODO lists, journaling, agendas etc.
- **Deep Search**: Searching the full text of your links and notes is fully supported. Longer term it will be possible to crawl the actual contents of all of your saved pages, to augment browser search and maybe even to pre-prompt or customize an LLM to provide a conversational interface to your personal information space.
- **Tags and Bi-Directional Linking**: In addition to containment it should be possible to model other kinds of relationships between topics and to tag information occurrences as being relevant to multiple topics.
- **Multi-file Support**: It should be possible to save, share and sync individual topic tree files. For example a 'Recipes' topic could point to a dedicated recipes.org file which is loaded on demand and maintained collaboratively. 
- **Topic Tree Repository**: BrainTool will host best-practice topic trees and templates around common areas such as 'Productivity Tools', 'Knowledge Management', 'Wedding Organizer', 'Trip Planner' etc. See some early examples [here](https://braintool.org/topicTrees/).
<br/><br/>