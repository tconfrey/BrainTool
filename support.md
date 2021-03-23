---
title: BrainTool Support and FAQ
tagline:    The Personal Information Manager for your Online Life
description: BrainTool is a way of organizing things you want to remember and get back to, using notes and nested tags. Its also a better way to control your browser.
---

There is a Google Group for discussion of issues, questions and suggestions related to BrainTool and Personal Information Management. You can access it [here](https://groups.google.com/u/2/g/braintool-discussion)

# Common BrainTool Problems
BrainTool gives you complete and full access to all the data saved in the app by writing it to a file on your Google Drive (if you have a Google account, you have Drive storage). Nothing is stored anywhere else. Ironically taking this hands-off approach to your data requires you to grant the application additional permissions after the extension is installed. This additional step of walking through the Google permission flow is the cause of confusion and some conflicts with other things going on in your browser,

## I installed the extension but I don't see anything
By default Chrome hides installed extensions under the little jigsaw piece icon on the nav bar. If the BrainTool extension installed correctly you can see it by clicking the jigsaw piece. You can pin it permanently to the nav bar by clicking the pushpin icon.

## I see 'Error Authenticating'
Google uses what are called 'third-party cookies' to store account information. These kinds of cookies are also used by various other web tracking sites. To avoid such tracking, some users disable third party cookies in their Chrome settings. If you have done so BrainTool will not be able to save your data and will fail to launch. You can add an exemption for accounts.google.com in your Chrome settings. Doing so and restarting BrainTool should solve the problem. (NB do not click the box titled 'Including Third-party cookies on this site'.)

## After clicking Authorize GDrive nothing happens
Related to the above, some security and privacy related extensions stop web pages from sending messages to third party sites, in some cases I cannot catch this as an error. Privacy Badger is an example of such a site. You will need to disable such extensions for the braintool.org url. 

## I use two computers and don't see my changes on the second one
As noted above your braintool file is stored on Google Drive in a file associated with your Google account (the file is called BrainTool.org, you can see it by visiting [drive.google.com](https://drive.google.com)). Thus you will have a single such file across any set of computers you use. If you have BrainTool running simultaneously on multiple computers you need to use the Refresh button at the bottom of the BrainTool side panel to reload the latest version of the file when you swap between computers. 


# Current Roadmap items
This list is my current near-term roadmap items, more or less in priority order. Feel free to email braintool.extension@gmail.com with your thoughts, feedback and requests; or post to the [BrainTool Discussion Group](https://groups.google.com/u/2/g/braintool-discussion). See also the BrainTool [philosophy page](https://braintool.org/overview) for the longer term perspective.

## Remove GDrive dependency
As noted in the Problems section above, Drive authentication adds an extra step to getting BT up and running. A subsequent release will remove the Drive dependency by optionally storing your information directly in browser local storage.

## Org-mode support
The BrainTool.org file is saved in an [org-mode](https://orgmode.org) syntax. In fact the original impetus behind the project was to unify my personal process of taking notes in Org with my browsing history. Currently the app faithfully retains file metadata, headlines, basic TODO states, and tags, within the file as it is read and written. Other org structures such as tables, code blocks, checkboxes etc will be lost, and whitespace may be changed. Ideally BT would work seamlessly with all org structures.

## Search
Browser search works in the side panel but does not find text in collapsed tree nodes or non-visible text. I plan to add full incremental search forward/backward functionality based on the emacs search model.

## Preferences
### BrainTool Side Window options
Default window position and size and tree font sizes should be configureable.

### New item insertion
Currently new links are added at the top of their tags list of children while new tags are added at the bottom of their parent tags list. That ordering makes sense to me personally but it should be configureable.

## Session save/restore
With the ability to tag all tabs in a window at once BT already has basic session management capabilities. Adding a simple and complete save/restore session across windows would be nice. Beyond that supporting one of more windows as part of an actively tracked session is desirable. 

## Multiple Files
Most peoples org-mode workflow involves using more than a single file. The ability to combine the contents of multiple files in the tree would be good.
