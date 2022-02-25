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
    const SaveBtn = CardElt.querySelector("#save");
    const SaveCloseBtn = CardElt.querySelector("#saveAndClose");
    let NewTopic;
    let SaveCB;
    let SaveAll = false;
    let ExistingCard = false;

    function setupExisting(topic, tab, note, title, saveCB) {
        // entry point when existing page is selected.
        
        NewTopic = topic;
        DNElt.textContent = topic;
        TitleElt.value = title || tab.title;            // value, cos its a text input
        URLElt.textContent = tab.url;
        if (note) NoteElt.textContent = note;
        ExistingCard = true;

        // show DN row, turn off All Tabs selector
        const dnRow = document.getElementById('dn');
        dnRow.style.display = "table-row";
        const allTabs = document.getElementById("allTabs");
        allTabs.style.display = "none";
        
        SaveCB = saveCB;
        SaveBtn.addEventListener('click', (event) => saveCard(event));
        SaveCloseBtn.addEventListener('click', (event) => saveCard(event, true));
        SaveBtn.disabled = true;
        SaveCloseBtn.disabled = true;

        CardElt.style.display = 'block';
        NoteElt.classList.remove("inactive");
        NoteElt.focus();
        NoteElt.setSelectionRange(NoteElt.value.length, NoteElt.value.length);
        
    }
    function setupNew(tab, completeCB) {
        // entry point for new page
        
        const buttonDiv = CardElt.querySelector('#buttonDiv');
        const dnRow = document.getElementById('dn');
        dnRow.style.display = "none";
        buttonDiv.style.display = "none";
        TitleElt.value = tab.title;            // value, cos its a text input
        URLElt.textContent = tab.url;
        
        SaveCB = completeCB;
        CardElt.style.display = 'block';
        NoteElt.focus();
    }

    NoteElt.onkeydown = function(e) {
        // check for any key to clear
        if (e.key == 'Tab') return;
        SaveBtn.disabled = false;
        SaveCloseBtn.disabled = false;

        if (NoteElt.value.startsWith("Note (or just hit Enter)")) {
            NoteElt.textContent = "";
            NoteElt.classList.remove("inactive");
        }
    }
    NoteElt.onkeyup = function(e) {
        // key up, enter == save
        if (e.key == "Enter" && !ExistingCard) {
            saveCard(e);
        }
    };
    TitleElt.oninput = function(e) {
        // title change => something to save
        SaveBtn.disabled = false;
        SaveCloseBtn.disabled = false;
    }        

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
            CardElt.classList.add('stack');
        } else {
            SaveAll = false;
            TitleElt.disabled = false;
            TitleElt.value = TitleValue;
            URLElt.value = URLValue;
            CardElt.classList.remove('stack');
        }
        NoteElt.focus();
    }

    function saveCard(e, close = false) {
        // one of the close buttons

        let text = NoteElt.value;
        if (!ExistingCard)
            text = text.replace(/\n/g, "");               // remove newline that triggered save
        const data = {title: TitleElt.value,
                      text: text,
                      url: URLElt.value,
                      newTopic: NewTopic,
                      saveAll: SaveAll,
                      close: close
                     };
        e.data = data;
        SaveCB(e, close);
    }

    document.getElementById('cardClose').addEventListener('click', e => window.close());
    document.getElementById('selectAll').addEventListener('change', e => selectAll(e));

    
    // This messy stuff is cos the slider widget i used didn't show focus properly
    document.getElementById('selectAll')
        .addEventListener('focus', e =>
                          document.getElementById('selectAllDiv').classList.add('focused'));
    document.getElementById('selectAll')
        .addEventListener('blur', e =>
                          document.getElementById('selectAllDiv').classList.remove('focused'));
    
    
    return {
        setupExisting: setupExisting,
        setupNew: setupNew
    }
})();
