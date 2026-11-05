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
 * Edit Dialog
 * Generates the #editOverlay backdrop, the #dialog card editor and the #permissions dialog,
 * and owns opening/populating/closing the card editor.
 *
 * This is a view module: it knows nothing about saving, deleting or the tree. What happens on
 * Update/Cancel is registered by rowManager via registerEditDialogHandlers() (callback
 * registration, same pattern as configManager.registerUI), so there's no import cycle -
 * rowManager imports this module, never the reverse.
 *
 ***/

'use strict';

import { BTAppNode } from './BTAppNode.js';

// Handlers registered by rowManager. Defaults are no-ops so the dialog is safe before registration.
const Handlers = {
    onUpdate: () => {},             // Update button clicked
    onCancel: () => {},             // dialog dismissed (Cancel, Escape, backdrop click) - after close
};

function registerEditDialogHandlers({onUpdate, onCancel} = {}) {
    if (onUpdate) Handlers.onUpdate = onUpdate;
    if (onCancel) Handlers.onCancel = onCancel;
}

function isEditDialogOpen() {
    return $("#dialog").is(':visible');
}

function openEditDialog(node, {duration = 400, newTopic = false} = {}) {
    // position and populate the dialog for node and animate it open
    const row = $(`tr[data-tt-id='${node.id}']`)[0];
    const top = $(row).position().top - $(document).scrollTop();
    const bottom = top + $(row).height();
    const dialog = $("#dialog")[0];

    // populate dialog
    const dn = node.fullTopicPath();
    if (dn == node.displayTopic)
        $("#distinguishedName").hide();
    else {
        $("#distinguishedName").show();
        const upto = dn.lastIndexOf(':');
        const displayStr = dn.substr(0, upto);
        $("#distinguishedName").text(displayStr);
        // if too long scroll to right side
        setTimeout(() => {
            const overflow = $("#distinguishedName")[0].scrollWidth - $("#distinguishedName")[0].offsetWidth;
            if (overflow > 0) $("#distinguishedName").animate({ scrollLeft: '+='+overflow}, 500);
        }, 500);
    }
    if (node.isTopic()) {
        $("#titleUrl").hide();
        $("#titleText").hide();
        $("#topic").show();
        $("#topicName").show();
        $("#topicName").val($("<div>").html(node.displayTopic).text());
        // new (unnamed) topics get the 'Name the Topic' hint until the user types
        if (newTopic) $("#newTopicNameHint").show();
        node.displayTopic && $("#newTopicNameHint").hide();
        node.isTrash() && $("#topicName").hide();
    } else {
        $("#titleUrl").show();
        $("#titleText").show();
        $("#titleText").val(BTAppNode.editableTopicFromTitle(node.title));
        $("#topic").hide();
        $("#titleUrl").val(node.URL);
    }
    $("#textText").val(node.text);
    $("#update").prop("disabled", true);

    // overlay grays everything out, dialog animates open on top.
    $("#editOverlay").css("display", "block");
    const fullWidth = $($("#editOverlay")[0]).width();
    const dialogWidth = Math.min(fullWidth - 66, 600);    // 63 = padding + 2xborder == visible width
    const height = dialogWidth / 1.618;                   // golden!
    if ((top + height + 140) < $(window).height())
        $(dialog).css("top", bottom+80);
    else
        // position above row to avoid going off bottom of screen (or the top)
        $(dialog).css("top", Math.max(10, top - height + 30));

    // Animate opening w calculated size
    $(dialog).css({display: 'flex', opacity: 0.0, height: 0, width:0})
        .animate({width: dialogWidth, height: height, opacity: 1.0},
                 duration, 'easeInCirc',
                 function () {
                     $("#textText")[0].setSelectionRange(node.text.length, node.text.length);
                     newTopic ? $("#topicName").focus() : $("#textText").focus();
                 });
}

function closeDialog(cb = null, duration = 250) {
    // animate dialog close and potentially callback when done
    const dialog = $("#dialog")[0];
    const height = $(dialog).height();
    $(dialog).css({'margin-left':'auto'});                  // see above, resetting to collapse back to center
    $(dialog).animate({width: 0, height: 0}, duration, function () {
        $("#editOverlay").css("display", "none");
        $(dialog).css({width: '88%', height: height});      // reset for next open
        dialog.close();
        if (cb) cb();
    });
}

function cancelEditDialog() {
    // close dialog then let the registered handler clean up (eg delete a new unnamed node)
    closeDialog(() => Handlers.onCancel());
}

function getEditDialogValues() {
    // current contents of the edit fields
    return {
        topic: $("#topicName").val(),
        title: $("#titleText").val(),
        url: $("#titleUrl").val(),
        text: $("#textText").val(),
    };
}

/**
 * Generate the edit overlay/dialog HTML (without inline event handlers)
 */
function generateHTML() {
    const html = `
    <div id="editOverlay">
      <dialog id="dialog">
            <div id="distinguishedName"></div>

            <div id="topic">
                <input type="text" id="topicName" class="editNode" tabindex="1" aria-label="Topic">
                <span id="newTopicNameHint" class="hint">Name the Topic</span>
            </div>
            <input type="text" id="titleText" class="editNode" tabindex="1" aria-label="Title" value='title'>
            <textarea id="titleUrl" class="editNode" tabindex="2" aria-label="URL">url</textarea>
            <textarea id="textText" class="editNode" tabindex="3" aria-label="Note"></textarea>

            <div class="buttonDiv" style="display:flex; justify-content: space-between; margin-top: 10px;">
                <button id="cancel" class="editNode" tabindex="5">Cancel</button>
                <button id="update" class="editNode" tabindex="4">Update</button>
            </div>
      </dialog>

      <dialog id="permissions" style="display:none; top: 100px">
        <p>BrainTool needs to re-establish local file access.<br/>The browser will now ask for your permission.</p>
        <button id="grant">OK</button>
      </dialog>

      <!-- #intro slideshow is generated into here by messageManager.js -->
    </div>
    `;

    // Insert after the #content table, where the markup lived in index.html
    const content = document.getElementById('content');
    if (content) {
        content.insertAdjacentHTML('afterend', html);
    } else {
        document.body.insertAdjacentHTML('beforeend', html);
    }
}

/**
 * Attach event listeners to edit dialog elements
 */
function attachListeners() {
    document.getElementById('cancel')?.addEventListener('click', () => cancelEditDialog());
    document.getElementById('update')?.addEventListener('click', () => Handlers.onUpdate());

    // enable update button if one of the texts is edited. Avoid creating new nodes with empty titles
    $(".editNode").on('input', function() {
        if ($("#topicName").is(":visible") && (!$("#topicName").val())) return;
        $("#update").prop('disabled', false);
    });

    // hide the 'Name the Topic' hint once the user starts typing
    $("#topicName").on('keyup', () => $("#newTopicNameHint").hide());

    // click on the backdrop closes the dialog
    $("#editOverlay").on('mousedown', function(e) {
        if (e.target.id == 'editOverlay') {
            cancelEditDialog();
            $("#buttonRow").show(100);
        }
    });
}

/**
 * Initialize the edit dialog by generating HTML and attaching event listeners.
 * Must run before initializeIntro (which inserts into #editOverlay) and initializeButtonRow.
 */
function initializeEditDialog() {
    generateHTML();
    attachListeners();
}

export {
    initializeEditDialog,
    registerEditDialogHandlers,
    openEditDialog,
    closeDialog,
    cancelEditDialog,
    getEditDialogValues,
    isEditDialogOpen,
};
