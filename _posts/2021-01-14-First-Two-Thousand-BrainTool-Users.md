---
layout: post
title:  "First Two Thousand BrainTool Users"
description: "Backstory and Observations on the first 2000 BrainTool users."
author: "Tony"
---

BrainTool 0.6.3 just hit the Chrome Store so it seems like a good time to give the backstory and record some observations. 

I started building BrainTool in the Summer of 2019 and worked on it whenever I had time for a year or so before deciding it was worth cleaning up and making public. My whole life I've been looking for, and thinking of building, the perfect note-taking, memory-jogging, personal information management tool. Revisiting my personal process with a clean slate and some time to invest in early '19 I realized that an MVP-for-me tool would unify my online links and resources (accessed via browser) with my text- and tags-based note taking process performed in a text editor; and that such a tool was within my ability to prototype over a Summer sabbatical while rebuilding my coding muscles.

Since then in fits and starts of building a bit, then using that bit, then building more, my prototype evolved into its current shape, with hierarchical tags and notes, text-file syncing, and browser window control. Over this Summer I got some positive feedback that it was MVP for more than just me, so I put in a solid sprint to close out my punch list and publicly posted a 0.5 version to the Chrome App store around Thanksgiving. Then I waited for all the users to find it, anxious to see if others shared my mental model of how to keep track of things.

And I waited, and waited. No surprise in retrospect but I had assumed I'd get to double digit installs without resorting to bribing family members! Turns out if you build it, and 'it' is one of 2000 Chrome extensions, they will not come! So I put some energy into 'growth hacking' ... and edged toward double digits.

Then over the weekend of 12/5 I got lucky, and confused. I started getting emails, most from people having trouble installing BrainTool, one or two letting me know I'd received a review or rating. One or two an hour. But the Web Store said 8 downloads. There was an error message people were seeing complaining of a missing file, but the file was there.

After a while I figured out the complainers were all Chromebook/Linux users which was very positive in that it implied I was getting a lot of users (Store still said '8'). It was frustrating until Todd Wilson pointed out I had a bug in my package where my manifest specified BrainTool128.png and my package contained Braintool128.png (lower t). Not clear why the Google package upload did not catch this, nor why only Linux cared. But easy to fix!

After I got that fixed things settled down. Eventually the download numbers on the Store started to change. Someone pointed me to [https://www.zdnet.com/article/every-google-chrome-user-should-try-this/](ZDNet article by Adrian Kingsley-Hughes) that caused all the excitement. Over the next few days my download numbers went up by hundreds every day, getting bumps as the article was published in French and then Hungarian, until '1000+', then topping out after a week at its current '2000+'.

Some observations:
- Store users data is two days behind. It seems like it's updated once or twice a day with data that is two days old. Reviews seem to arrive online randomly relative to associated email notifications.
- After the initial bump installations dropped off rapidly. I'm now around ten a day with higher numbers of uninstalls. I assume the latter are mostly members of the early cohort realizing the tool is not what they need, I'm surprised the overall user numbers did not drop more.
- The BrainTool permissions and authorization are very scary for users. The Installation asks to track browsing and then once launched the user needs to grant BrainTool access to write to their GDrive. This requires a hand-off to a Google Auth flow that can vary among users but it might ask for a Google Log-in ("I have to put in my Google password?!") and then ask for permission to read and write to their Drive. First, a lot of people missed the button asking for permission, and then they were scared away.
- BrainTool is a lot of things but right now for most users its mostly a better bookmark system. So its a head smacker as to why it never occurred to me that I should be able to import bookmarks!
- Generally feedback was very positive, or at least phrased politely. I had a few users very nicely tell me my tool sucks! But my overall conclusion is that there's clearly a user-base for BrainTool beyond just me. Of whatever number of people were exposed to Adrian's article more than two thousand were moved to install, the significant majority of those still have BT installed, and there are many vocal enthusiasts. 
- On my opening screen I inform users they are among the first and solicit constructive criticism via email rather than a bad review. I think that helped and as a nice side effect it opened up a dialog for me with a few dozen early users.
- Enthusiastically following up every possible interaction with an end user has paid great dividends. I got a lot of thoughtful input, help prioritizing this first point release, and even a bunch of great folks willing to manually install an early build of 0.6 and give me bug reports.

My update maxes out the visibility of the "Authorize" button, adds bookmark import and export and gives more ways to create and organize tags. It also fixes a couple of bugs reported on issues with the Drive connection and solicits for input on the other feature requests I've heard about.

If you've tried BrainTool, or even just have thoughts no what the ideal personal information management tool looks like, join the conversation on the [https://groups.google.com/u/2/g/braintool-discussion](BrainTool discussion group)

Tony
