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
 * This code runs under the popup and controls the topic card
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const TopicCard = (() => {
    const CardElt = document.getElementById("editCard");
    const NoteElt = document.querySelector('#note');
    const TitleElt = document.querySelector('#titleInput');
    const NoteHint = document.getElementById("newNoteHint");
    const SaveAs = document.getElementById('saveAs');
    let SaveCB;
    let ExistingCard = false;

    function setupExisting(tab, note, title, tabNavigated, saveCB) {
        // entry point when existing page is selected.
        
        TitleElt.value = tab.title; //title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");      // value, cos its a text input
        if (tabNavigated) {
            NoteElt.value = "";
            SaveAs.style.display = "block";
            NoteHint.style.display = "block";                      // show hint
        } else {
            if (note) NoteElt.value = note;
            SaveAs.style.display = "none";
        }
        ExistingCard = true;
        
        SaveCB = saveCB;
        NoteHint.style.display = "none";                          // hide hint

        NoteElt.classList.remove("inactive");
        NoteElt.focus();
        NoteElt.setSelectionRange(NoteElt.value.length, NoteElt.value.length);
        
    }

    function setupNew(title, tab, saveCB) {
        // entry point for new page
        
        TitleElt.value = title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");      // value, cos its a text input
        SaveCB = saveCB;
        NoteHint.addEventListener('click', (e) => NoteElt.focus());
        SaveAs.style.display = "none";
    }

    NoteElt.onkeydown = function(e) {
        // check for any key to clear
        if (e.key == 'Tab') return;
        NoteHint.style.display = "none";                          // hide hint
    };
    NoteElt.onkeyup = function(e) {
        // key up, enter == save
        if (e.key == "Enter" && !ExistingCard) {
            done();
        }
    };

    function done() {
        // one of the close buttons
        SaveCB();
    }
    function title() { return TitleElt.value;}
    function note() {return NoteElt.value.replace(/\s+$/g, '');}  // remove trailing newlines

    return {
        title: title,
        note: note,
        setupExisting: setupExisting,
        setupNew: setupNew
    };
})();
