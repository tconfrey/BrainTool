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
        "Add ':' at the end of a topic in the BT Saver to create a new subtopic.",
        "Double click on a table row to highlight its' open window, if any.",
        "Type ':TODO' after a topic to make the item a TODO in the BT tree.",
        "Create topics like ToRead or ToWatch to keep track of pages you want to come back to.",
        "Remember to Refresh if you've been editing the BrainTool.org file directly. <br/>(Also make sure your updates are sync'd to your GDrive.)",
        `${OptionKey}-b is the BrainTool accelerator key. You can change that in extension settings`,
        "You can save individual gmails or google docs into the BT tree.",
        "Save LinkedIn pages under specific topics to keep track of your contacts in context.",
        "Use the TODO (star) button on a row to toggle between TODO, DONE and none.",
        "See BrainTool.org for the BrainTool blog and other info.",
        "Check out the Bookmark import/export functions under Actions",
        "You can click on the topics shown in the Saver instead of typing out the name.",
        "Close and re-open this controls overlay to get a new tip!",
        `Double tap ${OptionKey}-b, or double click the icon, to surface the BrainTool side panel.`,
        "When you have an Edit card open, the up/down arrows will open the next/previous card.",
        "Click on a row to select it then use keyboard commands. 'h' for a list of them.",
        "You can also store local files and folders in BrainTool. <br/>Enter something like 'file:///users/tconfrey/Documents/' in the browser address bar.",
        "Try hitting '1','2','3' etc to collapse the tree to that level.",
        "Import public topic trees and useful links from braintool.org/topicTrees.",
        "Try the new DARK theme. It's under Actions."
    ];
    const messageArray = [
        "A preview version of Local file syncing is now available. See Settings.<br/>NB GDrive syncing must be off (see Actions).",
        "See the <a target='_blank' href='https://braintool.org/support/releaseNotes.html'>release notes</a> for a list of recent changes."
    ];
    let Warning = false, Message = false, lastShownMessageIndex = 0;

    
    function showTip() {
        // add random entry from the tipsArray

        // First make sure ui is set correctly (prev might have been warning)
        if (Message) removeMessage();
        $("#messageTitle").html('<b>Tip:</b>');
        $("#messageNext").show();
        $("#messageClose").show();
        $("#messageContainer").css("cursor", "auto");
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
    
    function showWarning(message) {
        // change message container to show warning message (eg stale file from warnBTFileVersion)
        if (Message) removeMessage();
        $("#messageTitle").html('<b>Warning!</b>');
        $("#message").html(`<b>${message}</b>`);
        $("#messageNext").hide();
        $("#messageClose").hide();
        $("#messageContainer").css("cursor", "pointer");
        $("#messageContainer").addClass('warning');
        $("#messageContainer").click(async e => {
            refreshTable(true);
            removeWarning();
        });
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

    return {
        setupMessages: setupMessages,
        showMessage: showMessage,
        hideMessage: hideMessage,
        showWarning: showWarning,
        removeWarning: removeWarning
    };
})();

    
