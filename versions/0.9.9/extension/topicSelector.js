/*** 
 * 
 * This code runs under the popup and controls the topic seclection for adding a page to BT.
 * Trying to keep it minimal. No jQuery etc.
 * 
 ***/
'use strict';

const TopicSelector = (() => {
    const TopicsElt = document.getElementById('currentTopics');
    const TopicElt = document.getElementById('topic');
    const SelectorElt = document.getElementById("topicSelector");
    const CardElt = document.getElementById("topicCard");
    const ButtonDiv = SelectorElt.querySelector('#buttonDiv');
//    const SaveBtn = SelectorElt.querySelector("#save");
//    const SaveCloseBtn = SelectorElt.querySelector("#saveAndClose");
    let AwesomeWidget;
    let Defaulted = false;                  // capture whether the topic was defaulted to window topic
    let KeyCount = 0;
    let SelectionCB;
    let CardData;
    let SaveAndClose = true;


    function setup (guess, topicsMap, cardData, saveAndClose, selectionCB) {
        // configure topic selector display. main entry point to component
        TopicsElt.innerHTML = generateTopicMap(topicsMap);
        SaveAndClose = saveAndClose;
        if (saveAndClose)
            document.getElementById("saveOption").checked = true;
        const topics = topicsMap.map(t => t.name);

        if (guess) {
            TopicElt.value = guess;
            Defaulted = true;
        }
        AwesomeWidget = new Awesomplete(TopicElt, {
	        list: topics, autoFirst: true, tabSelect: true, sort: false
        });
        TopicElt.addEventListener('awesomplete-highlight', updateSelection);
        TopicElt.addEventListener('awesomplete-close', widgetClose);
        TopicElt.addEventListener('keydown', handleTopicKeyDown);
        TopicElt.addEventListener('keyup', handleTopicKeyUp);
//        SaveBtn.addEventListener('click', (event) => topicSelected(event));
//        SaveCloseBtn.addEventListener('click', (event) => topicSelected(event, true));
        SelectionCB = selectionCB;                   // save for later
        CardData = cardData;
        
        const topicElts = document.querySelectorAll('.topic');
        topicElts.forEach(elt => elt.addEventListener('click', e => selectTopic(e)));

        const caretElts = document.querySelectorAll('.caret.closed');
        caretElts.forEach(elt => elt.addEventListener('click', e => toggleOpen(e)));

        CardElt.style.display = 'none';
        SelectorElt.style.display = 'block';
//        ButtonDiv.style.display = 'Flex';
        TopicElt.focus();
    }

    function generateTopicMap(topicsArray) {
        // given array of {name:"tag", level:2} generate the display string (name "tag1:tag1" allowed)
        const openCaret = `<span class='caret open' style='cursor: auto; opacity: 25%'>&nbsp;</span>`;
        const closedCaret = `<span class='caret closed'>&nbsp;</span>`;
        const noCaret = `<span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>`;
        let str = "";
        let index = 1;
        let fullPath = [];                           // keep track of parentage
        topicsArray.forEach(topic => {
            const level = topic.level;
            const name = topic.name;
            const visible = (level > 2) ? "display:none;" : "";
            const bg = (level == 1) ? "lightgrey" : "";
            const nextTopic = topicsArray[index++];
            const nextTopicLevel = nextTopic?.level || 0;
            fullPath[level] = name;
            const dn = fullPath.slice(1, level+1).join(':');
            let caret;
            // top level always opencaret, >2 no caret, ==2 no caret if no kids
            if (level > 2)
                caret = noCaret;
            else if (level == 1)
                caret = openCaret;
            else if (nextTopicLevel <= level)
                caret = noCaret;
            else
                caret = closedCaret;
            str += `<p style="padding-left: ${(level-1) * 20}px; ${visible}" class="${bg}" id="${name}" dn="${dn}" level="${level}">${caret}<span class="topic">${name}</span></p>`;
        });
        return str;
    }

    function updateSelection(h) {
        // called on highlight event, shows corresponding item in table as selected
        // nb see keyUp event below for highlighting of all matches
        const selection = h?.text?.value || "";
        document.querySelectorAll("p").forEach(function(elt) {
            if (elt.textContent.trim() == selection)
                elt.classList.add('selected');
            else
                elt.classList.remove('selected');
        });
    };
    function widgetClose(e) {
        // widget closed maybe cos no matches
        const nomatch = (e?.reason == 'nomatches');
        if (nomatch)            
            document.querySelectorAll("p").forEach(function(elt) {
                elt.classList.remove('selected');
            });
    }

    function selectTopic(e) {
        // select this row based on click. copy into widget and trigger appropriate events
        const topic = e.target;
        const text = topic.textContent;
        TopicElt && (TopicElt.value = text);
        TopicElt.focus();
        AwesomeWidget.evaluate();
        AwesomeWidget.select();
    }

    function toggleOpen(e) {
        // click event on caret to open/close subtree. NB only for level 2 topics
        const caret = e.target;
        const topicSpan = caret.nextSibling;
        const open = caret.classList.contains('open');
        const pRow = topicSpan.parentElement;
        const level = pRow.getAttribute("level");

        let nRow = pRow;
        while ((nRow = nRow.nextSibling) && (parseInt(nRow.getAttribute("level")) > level))
            nRow.style.display = open ? "none" : "block";

        if (open) {
            caret.classList.remove('open');
            caret.classList.add('closed');
        } else {
            caret.classList.remove('closed');
            caret.classList.add('open');
        }
    }

    function handleTopicKeyDown(e) {
        // special key handling and resetting that selection not yet made
        if (e.key == ":") {
            AwesomeWidget.select();
            return;
        }
        if (e.key == "Enter") {
            AwesomeWidget.select();
            return;
        }
    }

    function topicSelected(e) {
        // topic selected in widget
        const topic = TopicElt.value;
        const selectedRow = TopicsElt.querySelector('.selected');
        const dn = selectedRow?.getAttribute('dn');
        CardData.newTopic = topic; CardData.dn = dn;
        CardData.close = SaveAndClose;
        e.data = CardData;
        SelectionCB(e);
    }

    function handleTopicKeyUp(e) {
        // update table as user types to show option and its parents, or be done
        
        if (e.key == "Enter") {
            topicSelected(e);
            return;
        }
        
        const exposeLevel = 2; 
        document.querySelectorAll("p").forEach(function(elt) {
            if (elt.classList.contains("highlight"))
                elt.classList.remove("highlight");
            if (elt.getAttribute("level") && parseInt(elt.getAttribute("level")) > exposeLevel)
                elt.style.display = "none";
            else
                elt.style.display = "block";
        });

        if (!AwesomeWidget.isOpened) return;
        
        // We previously set a default if window already has a tag. Make it easy to delete.
        // NB 2 keys cos if popup is opened via keypress it counts, opened via click does not!
        if (Defaulted && (KeyCount < 2) && (e.key == "Backspace")) {
            TopicElt.value = "";
            AwesomeWidget.evaluate();
            return;
        }
        KeyCount++;

        // highlight suggestions in table
        const suggestions =  AwesomeWidget.suggestions || [];
        suggestions.forEach(function(sug) {
	        const elt = document.getElementById(sug.value);
            if (!elt) return;
            elt.classList.add("highlight");
            elt.style.display = "block";
            if (parseInt(elt.getAttribute("level")) > exposeLevel)
                showParent(elt);
        });
    }

    function showParent(elt) {
        // show parent Topic to elts, recurse until top ie level = 1
        const level = parseInt(elt.getAttribute("level"));
        let prev = elt;
        // walk up tree to elt w lower level (=> parent)
        while (prev && parseInt(prev.getAttribute("level")) >= level)
            prev = prev.previousSibling;
        prev.style.display = "block";
        // Keep going until up to level 2
        if (parseInt(prev.getAttribute("level")) > 1)
            showParent(prev);
    }

    function saveOptionChanged(e) {
        // Save & Group <-> Save & Close

        SaveAndClose = e.currentTarget.checked;
        TopicElt.focus();
        chrome.storage.local.set({'saveAndClose': SaveAndClose});
    }
    
    document.getElementById('saveOption').addEventListener('change', e => saveOptionChanged(e));
    document.getElementById('selectorClose').addEventListener('click', e => window.close());

    // This messy stuff is cos the slider widget i used didn't show focus properly
    document.getElementById('saveOption')
        .addEventListener('focus', e =>
                          document.getElementById('saveOptionDiv').classList.add('focused'));
    document.getElementById('saveOption')
        .addEventListener('blur', e =>
                          document.getElementById('saveOptionDiv').classList.remove('focused'));

    return {
        setup: setup
    }
})();
