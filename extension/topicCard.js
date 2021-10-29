/*** 
 * 
 * This code runs under the popup and controls the topic card
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const TopicCard = (() => {
    const CardElt = document.getElementById("topicCard");
    const NoteElt = CardElt.querySelector('#text-text');
    const TitleElt = CardElt.querySelector('#title-text');
    const DNElt = CardElt.querySelector('#distinguishedName');
    const URLElt = CardElt.querySelector('#title-url');
    let NewTopic;
    let SaveCB;
    let SaveAll = false;

    function setup(selection, dn, tab, note, saveCB) {
        // entry point when topic is selected. selection is selected topic name
        
        const DN = dn || selection;
        NewTopic = selection;
        DNElt.textContent = DN;
        TitleElt.value = tab.title;            // value, cos its a text input
        URLElt.textContent = tab.url;
        if (note) NoteElt.textContent = note;
        
        SaveCB = saveCB;
        document.getElementById('save').addEventListener('click', (event) => save(event));
        document.getElementById('saveAndClose').addEventListener('click', (event) => save(event, true));

        const topicCardElt = document.getElementById('topicCard');
        topicCardElt.style.display = 'block';
        NoteElt.focus();
    }

    NoteElt.onkeydown = function(e) {
        // check for Enter to be done, or any key to clear
        if (NoteElt.value.startsWith("Note (or just hit Enter)")) {
            NoteElt.textContent = "";
            NoteElt.classList.remove("inactive");
        }
        if (e.key == "Enter")
            save(e);
    };

    let TitleValue, URLValue;
    function selectAll(e) {
        // toggle save all unsaved tabs v just the selected one
        if (e.currentTarget.checked) {
            SaveAll = true;
            TitleValue = TitleElt.value;
            URLValue = URLElt.value;
            URLElt.value = "";
            TitleElt.value = "";
            TitleElt.disabled = true;
        } else {
            SaveAll = false;
            TitleElt.disabled = false;
            TitleElt.value = TitleValue;
            URLElt.value = URLValue;
        }        
    }

    function save(e, close = false) {
        // one of the close buttons
        const data = {title: TitleElt.value,
                      text: NoteElt.value,
                      url: URLElt.value,
                      newTopic: NewTopic,
                      saveAll: SaveAll
                     };
        e.data = data;
        SaveCB(e, close);
    }

    document.getElementById('cardClose').addEventListener('click', e => window.close());
    document.getElementById('selectAll').addEventListener('change', e => selectAll(e));
    return {
        setup: setup
    }
})();
