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
    let SaveCB;
    let ExistingCard = false;

    function setupExisting(tab, note, title, saveCB) {
        // entry point when existing page is selected.
        
        TitleElt.value = title;                                   // value, cos its a text input
        if (note) NoteElt.value = note;
        ExistingCard = true;
        
        SaveCB = saveCB;
        NoteHint.style.display = "none";                          // hide hint

        NoteElt.classList.remove("inactive");
        NoteElt.focus();
        NoteElt.setSelectionRange(NoteElt.value.length, NoteElt.value.length);
        
    }
    function setupNew(title, tab, completeCB) {
        // entry point for new page
        
        TitleElt.value = title;                                   // value, cos its a text input
        SaveCB = completeCB;
        NoteHint.addEventListener('click', (e) => NoteElt.focus());
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
