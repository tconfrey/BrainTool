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
    const TopicHint = document.getElementById("newTopicHint");
    let AwesomeWidget;
    let Guessed = false;                  // capture whether the topic was guessed
    let KeyCount = 0;
    let SelectionCB;

    function setup (guess, topicsMap, selectionCB) {
        // configure topic selector display. main entry point to component
        TopicsElt.innerHTML = generateTopicMap(topicsMap);
        const topics = topicsMap.map(t => t.name);

        if (guess) {
            TopicHint.style.display = "none";                      // hide hint
            TopicElt.value = guess;
            TopicElt.select();
            Guessed = true;
        }
        AwesomeWidget = new Awesomplete(TopicElt, {
	        list: topics, autoFirst: true, tabSelect: true, sort: false
        });
        TopicElt.addEventListener('awesomplete-highlight', updateSelection);
        TopicElt.addEventListener('awesomplete-close', widgetClose);
        TopicElt.addEventListener('keydown', handleTopicKeyDown);
        TopicElt.addEventListener('keyup', handleTopicKeyUp);
        TopicHint.addEventListener('click', (e) => TopicElt.focus());
        SelectionCB = selectionCB;                   // save for later
        
        const topicElts = document.querySelectorAll('.topic');
        topicElts.forEach(elt => elt.addEventListener('click', e => selectTopic(e)));

        const caretElts = document.querySelectorAll('.caret.closed');
        caretElts.forEach(elt => elt.addEventListener('click', e => toggleOpen(e)));

        SelectorElt.style.display = 'block';
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
        AwesomeWidget.evaluate();
        // might be >1 item matching, find right one.
        let index = 0;
        while (AwesomeWidget.suggestions[index].value != text) index++;
        AwesomeWidget.goto(index);
        AwesomeWidget.select();
        TopicHint.style.display = "none";                      // hide hint
        SelectionCB();                                         // done
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

    function handleTopicKeyUp(e) {
        // update table as user types to show option and its parents, or be done
        
        if (e.key == "Enter") {
            SelectionCB();
            return;
        }

        TopicHint.style.display = "none";                       // hide hint
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
        if (Guessed && (KeyCount < 2) && (e.key == "Backspace")) {
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

    function topic() {return TopicElt.value;}
    return {
        setup: setup,
        topic: topic
    }
})();
