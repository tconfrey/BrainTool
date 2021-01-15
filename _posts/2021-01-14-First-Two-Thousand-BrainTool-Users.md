---
layout: post
title:  "First Two Thousand BrainTool Users"
description: "Backstory and Observations on the first 2000 BrainTool users."
author: "Tony"
---

# The First Two Thousand BrainTool Users

[BrainTool 0.6.3](https://chrome.google.com/webstore/detail/braintool/fialfmcgpibjgdoeodaondepigiiddio) just hit the Chrome Store, so it seems like a good time to give the backstory and record some observations. 
### Backstory
My whole life I've been looking for, and thinking of building, the perfect note-taking and personal information management tool. But it was always too complicated, with too many things to track, in too many places. Revisiting my personal process with a clean slate and some time to invest in early 2019 I realized that these days almost everything I refer to is in my browser. An MVP-for-me tool was within my ability to prototype over a Summer sabbatical. The resulting Chrome extension fit my needs and allowed me to save tagged links directly into my text-based notes file.

Over the next year the prototype evolved into its current form, with hierarchical tags and notes, text-file syncing, and tab control. Recently I got some positive feedback that it was MVP for more than just me. I publicly posted a 0.5 version to the Chrome App store around Thanksgiving. 

Then I waited for all the users to find it, anxious to see if others shared my mental model of how to keep track of things.

And I waited, and waited. No surprise in retrospect, but I had assumed I'd at least get to double digit installs without resorting to bribing family members! Turns out if you build it, and 'it' is one of 2000 Chrome extensions, they will not come! So I put some energy into 'growth hacking' ... and edged toward double digits.

Then over the weekend of 12/5 I got lucky, and confused. I started getting emails, most from people having trouble installing BrainTool, one or two letting me know I'd received a review or a rating. Multiple emails an hour. There was an error message people were seeing complaining of a missing file, but the file was there. And the Web Store still said 8 downloads. 

After a while someone pointed me to the [ZDNet article by Adrian Kingsley-Hughes](https://www.zdnet.com/article/every-google-chrome-user-should-try-this/) that caused all the excitement, and I figured out the complainers were all Chromebook/Linux users. I had a bug in my package where my manifest specified BrainTool128.png and my package contained Braintool128.png (lower t). Not clear why the Google package upload did not catch this, nor why only Linux cared. But easy to fix!

After I got that fixed things settled down. Eventually the download numbers on the Store started to change. Over the next few days my download numbers went up by hundreds every day, getting bumps as the article was published in French and then Hungarian, until '1000+', then topping out after a week at its current '2000+'. And here we are!

### Some observations:
- Most of my efforts did not move the needle, but a positive review in a well-respected publication like ZDNet gave me all the early adopters I could handle.
- After the initial bump, installations dropped off rapidly. I'm now around ten a day with higher numbers of uninstalls. I assume the latter are mostly members of the early cohort realizing the tool is not what they need, I'm surprised the overall user numbers did not drop more.
- Chrome Store user data is two days behind. It seems like it's updated once or twice a day with data that is two days old. Reviews seem to arrive online randomly relative to when they are added.
- The BrainTool permissions and authorization are very scary for users. The installation asks to track browsing and then once launched the user needs to grant BrainTool access to write to their GDrive. This requires a hand-off to a Google Auth flow that can vary among users but it might ask for a Google Log-in ("I have to put in my Google password?!") and then ask for permission to read and write to their Drive. First, a lot of people missed the button asking for permission, and then many were scared away.
- BrainTool is a lot of things but right now for most users its mostly a better bookmark system. So its a head smacker as to why it never occurred to me that I should be able to import bookmarks!
- Generally feedback was very positive, although I had a few users very nicely tell me that my tool sucks! My overall conclusion is that there's clearly a user-base for BrainTool beyond just me. Of whatever number of people were exposed to Adrian's article more than two thousand were moved to install, the significant majority of those still have BT installed, and there are many vocal enthusiasts. 
- On my opening screen I inform users they are among the first and solicit constructive criticism via email rather than a bad review. I think that helped and as a nice side effect it opened up a dialog for me with a few dozen early adopters.
- Enthusiastically following up every possible interaction with an end user has paid great dividends. I got a lot of thoughtful input, help prioritizing this first point release, and even a bunch of great folks willing to manually install an early build of 0.6 and give me bug reports.

This update maxes out the visibility of the "Authorize" button, adds bookmark import and export and gives more ways to create and organize tags. It also fixes a couple of bugs reported on issues with the Drive connection and solicits for input on the other feature requests I've heard about. See the [Support page]({% link support.md %}) for my current backlog.

If you've tried BrainTool, or even just have thoughts on what the ideal personal information management tool looks like, join the conversation on the [BrainTool discussion group](https://groups.google.com/u/2/g/braintool-discussion).

Tony
