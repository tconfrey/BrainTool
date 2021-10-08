---
title: BrainTool Welcome page
layout: default
tagline: The Topic Manager for your Online Life
description: Welcome to BrainTool - Organize the things you want to remember and get back to, control your browser, focus your attention.
audience: user
---

# Welcome to BrainTool!

We're very glad to have you as a new user. This page should help you get up and running on some things that might not be immediately obvious.

## Tool bar icon
Kick things off by clicking the BrainTool icon. The first time it launches the tool, subsequently it opens the popup window that allows you to save the current tab. BTW you can also activate the popup with the accelerator key which is set to Option-b (Alt-b on PC). Hitting the b twice (Opt-b-b), or double clicking the icon, will surface the BrainTool side panel if it's hidden.

NB, by default Chrome hides new extensions under the jigsaw piece icon on the top right of its window. You can pin the BrainTool icon to your browser toolbar by clicking the puzzle piece and hitting the pin next to the BT icon. 
<br/>
<img src="/site/initialInstall.png" alt="initial install" style="border:solid; border-width:thin; width:70%;">

## Initial BrainTool tree
BrainTool is a ['Topic Manager'](https://braintool.org/2021/05/15/Organizing-your-life-with-a-Topic-Manager.html), designed to allow you to categorize and manage all of the topics you need to keep track of. It comes with an example organizational hierarchy to give you an idea of how it can be used. Any of those contents may be deleted. It's up to you to create your own hierarchy.

## Support and more Info
Ideally BT is intuitive to use but it's pretty feature rich and not everything is obvious (for example keyboard accelerators), so check out the videos and documentation on the [main page](https://braintool.org) and the brief [User Guide](userGuide). For troubleshooting see the [Support page](../support). If that does not help reach out on the [Discussion Group](https://groups.google.com/u/2/g/braintool-discussion). To see the changes in the latest release see the [Release Notes page](releaseNotes.md).

Also check out [this special offer](../pricing.md) in advance of BrainTool 1.0 dropping.

## Security and Permissions
The BrainTool (BT) philosophy is to have the absolute minimum set of permissions and data access necessary to maintain your braintool organizer file and perform browser actions on your behalf; and to be completely transparent about what its doing.

On first install you will have granted the extension 'tabs' and 'storage' permissions, needed to provide BrainTools tab management functionality and to save your data locally. You will also be told you are allowing communication with the braintool.org web site. This is to allow the BT application code to be downloaded into the sidepanel. While it's not clear from the warning, you should know that braintool.org is entirely a static site with code served from public github repository. No data is uploaded or saved anywhere on the site. The site is not even capable of receiving data.

Your braintool data is stored on the browser locally and, optionally, in plain text [org-mode](https://orgmode.org) format in a file called BrainTool.org. To store the file you need to give the application permission to read and write that file. The Authorize button can be accessed by clicking Options. The file is saved to the Google Drive folder associated with your Google account and accessible only by being logged in to your Google account. So if you trust Google, then your data is safe.
