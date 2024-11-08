/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/*** 
 * 
 * Handles posting messages to the tip panel
 * Tips, Messages, Warnings
 * 
 * 
 ***/
'use strict';

const messageManager = (() => {
    const tipsArray = [
        "Add ':' at the end of a topic in the Bookmarker to create a new subtopic.",
        "Double click on a table row to go to it's tab or tabgroup, if it's open.",
        "Type ':TODO' after a topic in the Bookmarker to make the item a TODO in the BT tree.",
        "Create topics like ToRead or ToWatch to keep track of pages you want to come back to.",
        "You'll need to Refresh if you've been editing the BrainTool.org file directly.",
        `${OptionKey}-b is the BrainTool accelerator key. You can change that in the browsers extension settings`,
        "Save LinkedIn pages under specific topics to keep track of your contacts in context.",
        "Use the TODO (star) button on a row to toggle between TODO, DONE and none.",
        "See BrainTool.org for the BrainTool blog and other info.",
        "Follow <a target='_blank' href='https://twitter.com/ABraintool'>@ABrainTool</a> on X and other socials!",
        "Check out the Bookmark import/export functions under Actions",
        "You can click on the topics shown in the Bookmarker instead of typing out the name.",
        "Use the forward (>>) button on the right to cycle through tips",
        `Double tap ${OptionKey}-b, or double click the toolbar icon, to surface the Topic Manager.`,
        `When you have an Edit card open, the ${OptionKey}-up/down arrows will open the next/previous card.`,
        "Click on a row to select it then use keyboard commands. 'h' for a list of them.",
        "You can also store local files and folders in BrainTool. <br/>Enter something like 'file:///users/tconfrey/Documents/' in the browser address bar.",
        "Try hitting '1','2','3' etc to collapse the tree to that level.",
        "Import public topic trees and useful links from braintool.org/topicTrees.",
        "Try the DARK theme. It's under Settings.",
        "Tab cycles a selected topic from collapsed, to showing children, to showing all descendants.",
        "<span class='emoji'>&#128512;</span> You can use emojis to <span class='emoji'>&#127774;</span> brighten up your topic names. <span class='emoji'>&#128079; &#128736;</span>"
    ];
    const messageArray = [
        "Welcome to the BrainTool 1.1!<br/>See the <a target='_blank' href='https://braintool.org/support/releaseNotes.html'>release notes</a> for a list of changes.",
        "Local file backups are now available. See Settings.<br/>NB GDrive syncing must be off (see Actions)."
    ];
    const introSlidesArray = [
        `<p>This window is the <b>Topic Manager</b>.</p><p>It allows you to open and close tabs, tab groups, and browser windows, organize them into nested <b>Topics</b> and find them again when you need them.</p><img class="introImage" src="resources/slide1.png"/>`,
        `<p>The BrainTool <b>Bookmarker</b> tool lives in the browser bar.</p><p>It allows you to save the current tab, tab group, window or session under a named <b>Topic</b>, along with an optional note.</p><p>Pin it for easy access.</p><img class="introImage" src="resources/slide2.png"/>`,
        `<p>Use BrainTool to organize all the tabs you want to save and come back to. Hover over a row for tools to open and close groups of tabs, add notes and todo's or edit the topic hierarchy.</p><img class="introImage" src="resources/slide3.png"/>`,
        `<p>Everything is kept in plain text in a private local file that you own and can edit, or under your personal Google Drive account for cloud access.</p><img class="introImage" src="resources/slide4.png"/>`,
        `<p>See Search, Settings and Actions in the Header and Help below. Watch for Messages, Warnings and Tips on startup.</p><img class="introImage" src="resources/slide5.png"/>`,
        `<p>Those are the basics. See the Help section and linked manuals and tutorial videos for more.</p><p>Now lets get started organizing your online life!</p><p>We've set you up with a sample <b>Topic</b> hierarchy. You might want to also pull in your bookmarks or save your current session (either one can be done later).</p>`
    ];
    
    let Warning = false, Message = false, lastShownMessageIndex = 0, lastShownSlideIndex = 0;

    
    function showTip() {
        // add random entry from the tipsArray

        // First make sure ui is set correctly (prev might have been warning)
        if (Message) removeMessage();
        $("#messageTitle").html('<b>Tip:</b>');
        $("#messageNext").show();
        $("#messageClose").show();
        $("#messageContainer").css("cursor", "auto");
        $("#messageContainer").addClass('tip');
        $("table.treetable").css("margin-bottom", "80px");

        // Then show random tip
        const index = Math.floor(Math.random() * tipsArray.length);
        $("#message").html(tipsArray[index]);
        $("#messageContainer").show();
    }

    function hideMessage() {
        // remove message window, readjust table accordingly
        $("table.treetable").css("margin-bottom", "30px");
        $('#messageContainer').hide();
    }
    
    function showWarning(message, clickHandler) {
        // change message container to show warning message (eg stale file from warnBTFileVersion) and do something on click
        if (Message) removeMessage();
        $("#messageTitle").html('<b>Warning!</b>');
        $("#message").html(`<b>${message}</b>`);
        $("#messageNext").hide();
        $("#messageClose").hide();
        $("#messageContainer").css("cursor", "pointer");
        $("#messageContainer").addClass('warning');
        $("#messageContainer").on('click', clickHandler);
        $("#messageContainer").show();
        Warning = true;
    }

    function removeWarning () {
        if (!Warning) return;                       // nothing to remove
        $("#messageContainer").hide();
        $("#messageContainer").removeClass('warning');
        $("#messageContainer").off('click');            // remove this handler
        Warning = false;
    };

    function showMessage() {
        // change message container to show informational message (eg new feature available)
        if (lastShownMessageIndex >= messageArray.length) {
            showTip();
            return;
        }
        const message = messageArray[lastShownMessageIndex];
        $("#messageTitle").html('<b>Message</b>');
        $("#message").html(message);
        $("#messageContainer").addClass('message');
        $("#messageContainer").show();
        configManager.setProp('BTLastShownMessageIndex', ++lastShownMessageIndex);
        Message = true;
    }
    function removeMessage() {
        if (!Message) return;
        $("#messageContainer").hide();
        $("#messageContainer").removeClass('message');
        Message = false;
    };
        
        
    // show message/tip on startup
    function setupMessages() {
        lastShownMessageIndex = configManager.getProp('BTLastShownMessageIndex') || 0;
        if (lastShownMessageIndex < messageArray.length) {
            showMessage();
        } else
            showTip();
    };


    function showIntro() {
        // Show intro slides
        showSlide();
        $("#editOverlay").css("display", "block");
        $("#dialog").css("display", "none");
        $("#intro").css("display", "block");
    }

    function hideIntro() {
        // Hide intro slides
        $("#editOverlay").css("display", "none");
        $("#intro").css("display", "none");
    }

    function showSlide() {
        // Inject html for current slide index
        if (lastShownSlideIndex == 0) $("#introPrev").hide();
        else $("#introPrev").show();
        $("#slide").html(introSlidesArray[lastShownSlideIndex]);
        if (lastShownSlideIndex == (introSlidesArray.length - 1)) {
            $("#introNext").hide();
            $("#introButtons").css("display", "flex");
        } else {
            $("#introNext").show();
            // Show 'don't show again' footer after 2nd slide or after initial install
            if (!InitialInstall || (lastShownSlideIndex >= 2)) $("#slideFooter").show();
            $("#introButtons").css("display", "none");
        }
        $("#slideNum").text(lastShownSlideIndex+1);
    }

    function nextSlide() {
        lastShownSlideIndex += 1;
        showSlide();
    }

    function prevSlide() {
        lastShownSlideIndex -= 1;
        showSlide();
    }

    function dontShowIntro() {
        // Set a flag to not show intro again, indicate checked
        configManager.setProp('BTDontShowIntro', true);
        $("#dontShow").show();
        $("#slideFooter").css("color", "lightgrey");
    }
    function bookmarksIntro() {
        // Close slides and Import bookmarks
        hideIntro();
        importBookmarks();
    }
    function sessionIntro() {
        // Close slides and Import bookmarks
        hideIntro();
        importSession();
    }

    return {
        setupMessages: setupMessages,
        showMessage: showMessage,
        hideMessage: hideMessage,
        showWarning: showWarning,
        removeWarning: removeWarning,
        showIntro: showIntro,
        hideIntro: hideIntro,
        nextSlide: nextSlide,
        prevSlide: prevSlide,
        dontShowIntro: dontShowIntro,
        bookmarksIntro: bookmarksIntro,
        sessionIntro: sessionIntro
    };
})();

    
