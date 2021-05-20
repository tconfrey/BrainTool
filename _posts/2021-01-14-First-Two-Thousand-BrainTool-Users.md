---
layout: post
title:  "First Two Thousand BrainTool Users"
description: "Backstory and BrainTool launch"
excerpt_separator: <!--more-->
author: "Tony"
audience: "nonuser"
---

# The First Two Thousand BrainTool Users

[BrainTool 0.6.3](https://chrome.google.com/webstore/detail/braintool/fialfmcgpibjgdoeodaondepigiiddio) just hit the Chrome Store, so it seems like a good time to record some observations. 
### Backstory
My whole life I've been looking for, and thinking of building, the perfect note-taking and personal information management tool. But it was always too complicated, with too many things to track, in too many places. Revisiting my personal process with a clean slate and some time to invest in early 2019 I realized that these days almost everything I refer to is in my browser and that an MVP-for-me tool was within my ability to prototype over a Summer sabbatical. <!--more-->The resulting Chrome extension fit my needs and allowed me to save tagged links directly into my text-based notes file.

Over the next year, in fits and starts, the prototype evolved into its current form, with hierarchical tags and notes, text-file syncing, and tab control. Recently I got some positive feedback that it was MVP for more than just me and decided to send it out into the world.

### Launch
I publicly posted a 0.5 version to the Chrome App store around Thanksgiving. Then I waited for all the users to find it, eager to see if others shared my mental model for how to keep track of things.

And I waited, and waited. No surprise in retrospect, but I had assumed I'd at least get to double digit installs without resorting to bribing family members! Turns out if you build it, and "it" is one of 200,000 Chrome extensions, they will not come! So I put some energy into "growth hacking" ... and edged toward double digits.

Then over the weekend of 12/5 I got lucky, and confused. I started getting emails, most from people having trouble installing BrainTool, one or two letting me know I'd received a review or a rating. Multiple emails an hour. There was an error message people were seeing that complained of a missing file, but the file was there. And the Web Store still said 8 downloads. 

After a while someone pointed me to the [ZDNet article by Adrian Kingsley-Hughes](https://www.zdnet.com/article/every-google-chrome-user-should-try-this/) that caused all the excitement, and I figured out the error was isolated to Chromebook/Linux users. I had a typo in my package manifest. Not clear why only Linux cared, but easy to fix!

After that things settled down. Eventually the download numbers on the Store started to change. Over the next few days my download numbers went up by hundreds every day, getting bumps as the article was published in French and then Hungarian, until "1000+", then topping out after a week at "2000+".

### Beyond
Now at 2800 weekly users I'm concluding that there is a user-base for BrainTool beyond just me. Of whatever number of people were exposed to Adrian's article more than two thousand were moved to install, the significant majority of those still have BT running, and there are many vocal enthusiasts. I'm mapping a path to a more full featured 1.0 version and beyond.

The latest update maxes out the visibility of the "Authorize" button, adds bookmark import and export and gives more ways to create and organize tags. It also fixes a couple of bugs reported with the GDrive connection and solicits for input on the other feature requests I've heard about. See the [Support page]({% link support.md %}) for my current backlog.

If you've tried BrainTool, or even just have thoughts on what the ideal personal information management tool looks like, join the conversation on the [BrainTool discussion group](https://groups.google.com/u/2/g/braintool-discussion).

Tony

PS I've added some more detailed observations on the launch [here]({% post_url 2021-01-18-Observations-on-Chrome-Store-Launch %}).
