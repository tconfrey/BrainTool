---
title: BrainTool Support and FAQ
layout: default
tagline: The Topic Manager for your Online Life
description: BrainTool is a way of organizing things you want to remember and get back to, using notes and nested topics. Its also a better way to control your browser.
audience: user
---

# Information Sources
- The BrainTool [User Guide](/support/userGuide) gives a step by step intro to using BT.
- The BrainTool [Overview page](https://braintool.org/overview) discusses philosophy and direction.
- Here's a [playlist of short videos](https://youtu.be/g_843PjL8s8?list=PLhaw8BE1kin0CQFuDXrWsdC6Nzhyo9dix). they walk through the complete set of BrainTool features (note that the first one is more of an ad).
- You can post to the [BrainTool Discussion Group](https://groups.google.com/u/2/g/braintool-discussion) with feedback or questions.
- There's also the [Welcome](/support/welcome) page and the [Release Notes](/support/releaseNotes).
- And some other relevant stuff on the [blog](https://braintool.org/posts.html).

# Common BrainTool Problems
BrainTool gives you complete and full access to all the data saved in the app by optionally writing it to a file on your Google Drive (if you have a Google account, you have Drive storage). Nothing is stored anywhere else other than in your browser. Ironically taking this hands-off approach to your data requires you to grant the application additional permissions after the extension is installed to permit GDrive syncing. This additional step of walking through the Google permission flow is the cause of confusion and some conflicts with other things going on in your browser.

## I installed the extension but I don't see anything
By default Chrome hides installed extensions under the little jigsaw piece icon on the nav bar. If the BrainTool extension installed correctly you can see it by clicking the jigsaw piece. You can pin it permanently to the nav bar by clicking the pushpin icon.

## I see 'Error Authenticating' while enabling GDrive
Google uses what are called 'third-party cookies' to store account information. These kinds of cookies are also used by various other web tracking sites. To avoid such tracking, some users disable third party cookies in their Chrome settings. If you have done so BrainTool will not be able to save your data to GDrive. You can add an exemption for accounts.google.com in your Chrome settings. Doing so and restarting BrainTool should solve the problem. (NB do not click the box titled 'Including Third-party cookies on this site'.)

## After clicking Authorize GDrive nothing happens
Related to the above, some security and privacy related extensions stop web pages from sending messages to third party sites, in some cases I cannot catch this as an error. Privacy Badger is an example of such an extension. You will need to disable such extensions for the braintool.org url. 

## I use two computers and don't see my changes on the second one
As noted above, your braintool data is stored in the browser and optionally on Google Drive in a file associated with your Google account (the file is called BrainTool.org, you can see it by visiting [drive.google.com](https://drive.google.com)). Thus you will have a single such file across any set of computers you use. If you have BrainTool running simultaneously on multiple computers you need to use the Refresh button (under Options) to reload the latest version of the file when you swap between computers. 

# Some other problem
Email braintool.extension@gmail.com or post to the [BrainTool Discussion Group](https://groups.google.com/u/2/g/braintool-discussion) with feedback.
