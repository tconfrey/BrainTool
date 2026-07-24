/***
*
* Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
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

import { getProp, setProp } from './configManager.js';
import { sendMessage } from './extensionMessaging.js';
import { importBookmarks } from './bookmarksManager.js';
import { t, getTipsArray, getMessagesArray, getIntroSlidesArray } from './i18n.js';

// Resolved at display time so language changes apply after initI18n
function tipsArray() { return getTipsArray(); }
function messageArray() { return getMessagesArray(); }
function introSlidesArray() { return getIntroSlidesArray(); }

let Warning = false, Message = false, lastShownMessageIndex = 0, lastShownSlideIndex = 0;


function showTip() {
    // add random entry from the tipsArray
    
    // First make sure ui is set correctly (prev might have been warning)
    if (Message) removeMessage();
    $("#messageTitle").html(`<b>${t('tip')}</b>`);
    $("#messageNext").show();
    $("#messageClose").show();
    $("#messageContainer").css("cursor", "auto");
    $("#messageContainer").addClass('tip');
    $("table.treetable").css("margin-bottom", "80px");
    
    // Then show random tip
    const tips = tipsArray();
    const index = Math.floor(Math.random() * tips.length);
    $("#message").html(tips[index]);
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
    $("#messageTitle").html(`<b>${t('warning')}</b>`);
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
    const messages = messageArray();
    if (lastShownMessageIndex >= messages.length) {
        showTip();
        return;
    }
    const message = messages[lastShownMessageIndex];
    $("#messageTitle").html(`<b>${t('message')}</b>`);
    $("#message").html(message);
    $("#messageContainer").addClass('message');
    $("#messageContainer").show();
    setProp('BTLastShownMessageIndex', ++lastShownMessageIndex);
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
    lastShownMessageIndex = getProp('BTLastShownMessageIndex') || 0;
    if (lastShownMessageIndex < messageArray().length) {
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
    const slides = introSlidesArray();
    $("#slide").html(slides[lastShownSlideIndex]);
    if (lastShownSlideIndex == (slides.length - 1)) {
        $("#introNext").hide();
        $("#introButtons").css("display", "flex");
    } else {
        $("#introNext").show();
        // Show 'don't show again' footer after 2nd slide or after initial install
        if (!getProp('InitialInstall') || (lastShownSlideIndex >= 2)) $("#slideFooter").show();
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
    setProp('BTDontShowIntro', true);
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

    // Send msg to result in subsequent session save
    sendMessage({'function': 'saveTabs', 'type': 'Session', 'topic': '', 'from':'btwindow'});
}

// Export public API (was previously returned from IIFE)
const messageManager = {
    setupMessages,
    showMessage,
    hideMessage,
    showWarning,
    removeWarning,
    showIntro,
    hideIntro,
    nextSlide,
    prevSlide,
    dontShowIntro,
    bookmarksIntro,
    sessionIntro
};

/**
* Generate the Message Container HTML (without inline event handlers)
*/
function generateMessageContainerHTML() {
    const html = `
    <div id="messageContainer">
        <img id="messageClose" src="resources/closeTip.png" height="14" width="14" />
        <div id="messageTitle"><b>${t('tipOfDay')}</b></div>
        <div id="message"></div>
        <img id="messageNext" src="resources/nextTip.png" height="18" width="18" />
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

/**
* Attach event listeners to Message Container elements
*/
function attachMessageContainerListeners() {
    // Close button
    document.getElementById('messageClose')?.addEventListener('click', () => {
        messageManager.hideMessage();
    });
    
    // Next tip button
    document.getElementById('messageNext')?.addEventListener('click', () => {
        messageManager.showMessage();
    });
}

/**
* Initialize Message Container by generating HTML and attaching event listeners
*/
function initializeMessageContainer() {
    generateMessageContainerHTML();
    attachMessageContainerListeners();
    console.log('Message container initialized with event listeners');
}

/**
* Generate the Intro slideshow HTML (without inline event handlers)
*/
function generateIntroHTML() {
    const html = `
      <div id="intro" style="display:none">
        <div class="topBanner" id="slideHeader">
          <img id="headerImage" src="resources/headerImage.png" height="100%" />
          <div id="introTitle">${t('welcomeTitle')}</div>
          <div id="introSubtitle">${t('slideOf', { n: '<span id="slideNum">1</span>' })}</div>
          <img id="introClose" src="resources/close.png" height="17" width="20" />
        </div>
        <div id="slide"><!-- Filled in by messageManager --></div>
        <div id="introButtons">
          <div id="bookmarksIntro" class="introButton">${t('importBookmarks')}</div>
          <div id="sessionIntro" class="introButton">${t('importSession')}</div>
          <div id="justIntro" class="introButton">${t('justGetStarted')}</div>
        </div>
        <div id="introNext" class="introNavButton">${t('next')}
          <img id="introNext-" src="resources/nextSlide.png" height="18" width="18" />
        </div>
        <div id="introPrev" class="introNavButton">&nbsp;&nbsp;&nbsp;${t('previous')}
          <img id="introPrev-" src="resources/prevSlide.png" height="18" width="18" />
        </div>
        <div id="slideFooter">${t('dontShowSlideshow')}
          <img id="dontShow" src="resources/actionsIconLight.png" height="15" width="15" />
        </div>
      </div>
    `;
    
    // Insert at end of #editOverlay
    const editOverlay = document.getElementById('editOverlay');
    if (editOverlay) {
        editOverlay.insertAdjacentHTML('beforeend', html);
    } else {
        console.error('Cannot find #editOverlay to insert intro slideshow');
    }
}

/**
* Attach event listeners to Intro slideshow elements
*/
function attachIntroListeners() {
    // Close button
    document.getElementById('introClose')?.addEventListener('click', () => {
        messageManager.hideIntro();
    });
    
    // Import bookmarks button
    document.getElementById('bookmarksIntro')?.addEventListener('click', () => {
        messageManager.bookmarksIntro();
    });
    
    // Import session button
    document.getElementById('sessionIntro')?.addEventListener('click', () => {
        messageManager.sessionIntro();
    });
    
    // Just get started button
    document.getElementById('justIntro')?.addEventListener('click', () => {
        messageManager.hideIntro();
    });
    
    // Next slide button
    document.getElementById('introNext')?.addEventListener('click', () => {
        messageManager.nextSlide();
    });
    
    // Previous slide button
    document.getElementById('introPrev')?.addEventListener('click', () => {
        messageManager.prevSlide();
    });
    
    // Don't show again footer
    document.getElementById('slideFooter')?.addEventListener('click', () => {
        messageManager.dontShowIntro();
    });
}

/**
* Initialize Intro slideshow by generating HTML and attaching event listeners
*/
function initializeIntro() {
    generateIntroHTML();
    attachIntroListeners();
    console.log('Intro slideshow initialized with event listeners');
}

export { messageManager, initializeMessageContainer, initializeIntro };
