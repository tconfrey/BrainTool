class BTAppNode extends BTNode {
    // Centralizes all the app-only logic of reading and writing to org, creating the ui etc

/***
 *
 * Basic node accessor functions w associated logic
 *
 ***/
    constructor(title, parent, text, level) {
        super(title, parent);
        this._text = text;
        this._level = level;
        this._folded = false;
        this._keyword = null;
        this._tabId = 0;
        this._tabGroupId = 0;
        this._windowId = 0;
        this.drawers = {};
        this.tags = [];
        AllNodes[this._id] = this;
        brainZoom();
    }

    set text(txt) {
        this._text = txt;
    }
    get text() {
        return this._text;
    }
    
    set level(l) {
        this._level = l;
    }
    get level() {
        return this._level;
    }
    set tabId(id) {
        this._tabId = id;
        this._opening = false;
    }
    get tabId() {
        return this._tabId;
    }
    set tabGroupId(id) {
        this._tabGroupId = id;
    }
    get tabGroupId() {
        return this._tabGroupId;
    }
    set windowId(id) {
        this._windowId = id;
    }
    get windowId() {
        return this._windowId;
    }
    resetLevel(l) {
        // after a ui drag/drop need to reset level under new parent
        this.level = l;
        this.childIds.forEach(childId => {
            AllNodes[childId].resetLevel(l+1);
        });
    }
    get keyword() {
        return this._keyword;
    }
    set keyword(kw) {
	    this._keyword = kw;
    }
    iterateKeyword() {
        // TODO -> DONE -> ''
        switch (this._keyword) {
        case 'TODO':
            this._keyword = "DONE";
            break;
        case 'DONE':
            this._keyword = null;
            break;
        case null:
            this._keyword = "TODO";
            break;
        }
    }

    set folded(f) {
        this._folded = f;
    }
    get folded() {
        return this._folded;
    }
    
    hasOpenChildren() {
        return this.childIds.some(id => AllNodes[id].tabId);
    }
    hasOpenDescendants() {
        return (this.tabId || this.childIds.some(id => AllNodes[id].hasOpenDescendants()));
    }
    hasUnopenDescendants() {
        return ((this.URL && !this.tabId) ||
                this.childIds.some(id => AllNodes[id].hasUnopenDescendants()));
    }

/***
 *
 * UI Management
 *
 ***/

    HTML() {
        // Generate HTML for this nodes table row
        let outputHTML = "";
        outputHTML += `<tr data-tt-id='${this.id}`;
        if (this.parentId || this.parentId === 0)
            outputHTML += `' data-tt-parent-id='${this.parentId}`;
        outputHTML += `'><td class='left'><span class='btTitle'>${this.displayTitle()}</span></td>`;
        outputHTML += `<td class='right'><span class='btText'>${this.displayText()}</span></td></tr>`;
        return outputHTML;
    }

    displayText() {
        // Node text as seen in the tree. Insert ... link to text that won't fit
        const htmlText = BTAppNode._orgTextToHTML(this._text);
        if (htmlText.length < 250) return htmlText;
        
        // if we're chopping the string need to ensure not splitting a link
        const ellipse = "<span class='elipse'>... </span>";
        let rest = htmlText.substring(250);
        let reg = /.*?<\/a>/gm;                                // non greedy to get first
        if (!reg.exec(rest))
            // no closing a tag so we're ok
            return htmlText.substring(0,250)+ellipse;

        // there is a closing a, find if there's a starting one
        const closeIndex = reg.lastIndex;
        rest = htmlText.substring(250, 250+closeIndex);     
        reg = /<a href/gm;
        if (reg.exec(rest))
            // there's a matching open so 0..250 string is clean
            return htmlText.substring(0,250)+ellipse;

        // Return text to end of href
        return htmlText.substring(0, 250+closeIndex)+ellipse;
    }
    
    displayTitle() {
        // Node title as shown in tree, <a> for url. Compare to BTNode.displayTag = plain tag text
        let txt = "";
        if (this._keyword) txt += `<b>${this._keyword}: </b>`; // TODO etc
        return txt + BTAppNode._orgTextToHTML(this.title);
    }


/***
 *
 * Extension outbound interactions - calls to have extension do stuff
 *
 ***/

    showNode() {
        // highlight this nodes associated tab or window
        if (this.tabId)
            window.postMessage(
                {'function' : 'showNode', 'tabId': this.tabId});
        else if (this.windowId)
            window.postMessage(
                {'function' : 'showNode', 'windowId': this.windowId});
    }

    openTab() {
        // open this nodes url
        if (!this.URL || this._opening) return;

        // if already open, tell bg to show it
        if (this.tabId) {
            this.showNode();
            return;
        }
        this._opening = true;   // avoid opening twice w double clicks. unset in tabid setter

        // if we don't care about windowing send openTab msg
        if (GroupingMode == GroupOptions.NONE) {
            window.postMessage(
                {'function' : 'openTab', 'nodeId' : this.id, 'URL' : this.URL});
            this.showNode();
            return;
        }

        // if we do care about windowing send openInWindow
        const windowId = this.windowId || AllNodes[this.parentId].windowId;
        if (GroupingMode == GroupOptions.WINDOW)
            window.postMessage(
                {'function' : 'openInWindow', 'windowId' : windowId,
                 'tabs': [{'URL' : this.URL, 'nodeId' : this.id}] });
        if (GroupingMode == GroupOptions.TABGROUP) {
            const index = this.indexInParent();
            const tabGroupId = this.tabGroupId || AllNodes[this.parentId].tabGroupId;
            const firstOpenTab = AllNodes[this.parentId].leftmostOpenTab();
            window.postMessage(
                {'function' : 'openInTabGroup', 'firstOpenTab': firstOpenTab,
                 'tabs': [{'URL' : this.URL, 'nodeId' : this.id, 'index' : index}],
                 'tabGroupId': tabGroupId, 'windowId' : windowId});
        }
    }

    group() {
        // tell background how to move this nodes tab to its appropriate group

        const windowId = this.windowId || AllNodes[this.parentId].windowId;
        const tabId = this.tabId;
        const index = this.indexInParent();
        if (GroupingMode == GroupOptions.WINDOW)
            window.postMessage(
                {'function' : 'moveToWindow', 'windowId' : windowId,
                 'tabId' : tabId, 'index' : index, 'nodeId' : this.id});
        if (GroupingMode == GroupOptions.TABGROUP) {
            const tabGroupId = this.tabGroupId || AllNodes[this.parentId].tabGroupId;
            const firstOpenTab = AllNodes[this.parentId].leftmostOpenTab();
            window.postMessage(
                {'function' : 'moveToTabGroup', 'firstOpenTab' : firstOpenTab,
                 'tabIds' : [tabId], 'tabGroupId': tabGroupId, 'windowId' : windowId,
                 'position' : index, 'nodeIds' : [this.id]});
        }
        if (GroupingMode == GroupOptions.NONE) {
            // no grouping implemented for this case, 
        }
    }
        

    openAll() {
        // open this node and any children. NB indexing taken care of in repositionTabs

        // if we don't care about windowing just open each tab
        if (GroupingMode == GroupOptions.NONE) {
            this.openTab();
            this.childIds.forEach(nodeId => AllNodes[nodeId].openTab());
        }
        else {                      // need to open all urls in single (possibly new) window
            let urls = [];
            if (this.URL && !this.tabId) urls.push({'nodeId': this.id, 'URL': this.URL, 'index': 0});
            this.childIds.forEach(nodeId => {
                const node = AllNodes[nodeId];
                const index = node.indexInParent();
                if (node.URL && !node.tabId && !node.childIds.length)
                    urls.push({'nodeId': node.id, 'URL': node.URL, 'index': index});
            });
            if (urls.length) {
                if (GroupingMode == GroupOptions.WINDOW)
                    window.postMessage({'function' : 'openInWindow', 'tabs' : urls,
                                        'windowId': this.windowId, 'tabGroupId': this.tabGroupId});
                if (GroupingMode == GroupOptions.TABGROUP) {
                    const firstOpenTab = this.leftmostOpenTab();
                    window.postMessage({'function' : 'openInTabGroup', 'tabs' : urls,
                                        'windowId': this.windowId, 'tabGroupId': this.tabGroupId,
                                        'firstOpenTab': firstOpenTab});
                }
            }
        }

        // recurse
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (node.childIds.length) node.openAll();
        });
    }

    repositionTabs() {
        // tell background correct index in window for tab
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (!node.tabId) return;
            window.postMessage({'function': 'positionTab', 'tabId': node.tabId,
                                'index': node.indexInParent()});
        });
    }

    closeTab() {
        // Close tabs associated w this node
        if (this.tabId)
            window.postMessage({'function': 'closeTab', 'tabId': this.tabId});
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            node.closeTab();
        });
    }
    
    static ungroupAll() {
        // user has changed from TABGROUP to NONE, tell background to ungroup all BT tabs
        const tabIds = AllNodes.flatMap(n => n.tabId ? [n.tabId] : []);
        if (tabIds.length)
            if (confirm('Also ungroup open tabs?'))
                window.postMessage({'function': 'ungroupAll', 'tabIds': tabIds});
    }

    static groupAll() {
        // user has changed grouping to TabGroups so group open tabs up

        AllNodes.forEach(n => {
            if (n.hasOpenChildren()) {
                const openTabIds = n.childIds.flatMap(
                    c => AllNodes[c].tabId ? [AllNodes[c].tabId] :[]);
                window.postMessage({'function': 'groupAll', 'tabIds': openTabIds,
                                    'windowId': n.windowId});
            }
        });
    }

    static windowAll() {
        // grouping change to Window mode, so organize tags into individual windows

        AllNodes.forEach(n => {
            if (n.hasOpenChildren()) {
                const openTabIds = n.childIds.flatMap(
                    c => AllNodes[c].tabId ? [AllNodes[c].tabId] :[]);
                window.postMessage({'function': 'windowAll', 'tabIds': openTabIds});
            }
        });
    }

  
/***
 *
 * Org suppport
 *
 ***/

    orgDrawers() {
        // generate any required drawer text
        let drawerText = "";
        if (this.drawers) {
            const drawers = Object.keys(this.drawers);
            const reg = /:(\w*):\s*(\w*)/g;              // regex to iterate thru props and values
            let hits, ptext;
            for (const drawer of drawers) {
                drawerText += "  :" + drawer + ":\n";
                ptext = this.drawers[drawer];                        // of the form ":prop: val\n
                
                while (hits = reg.exec(ptext)) {
                    // Iterate thru properties handling VISIBILITY 
                    if ((drawer == "PROPERTIES") && (hits[1] == "VISIBILITY"))
                    {           // only if needed
                        if (this.folded) drawerText += "  :VISIBILITY: folded\n"; 
                    }
                    else
                        drawerText += `  :${hits[1]}: ${hits[2]}\n`;
                }
                drawerText += "  :END:\n";
            }
        }
        if (this.childIds.length && this.folded && (!this.drawers || !this.drawers.PROPERTIES))
            //need to add in the PROPERTIES drawer if we need to store the nodes folded state
            drawerText += "  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n";
        return drawerText;
    }

    orgTags(current) {
        // insert any tags padded right
        if (this.tags.length == 0) return "";
        const width = 77;                                // default for right adjusted tags
        let tags = ":";
        for (const tag of this.tags) {
            tags += tag + ":";
        }
        const padding = Math.max(width - current.length - tags.length, 1);
        return " ".repeat(padding) + tags;
    }
        

    orgText() {
        // Generate org text for this node
        let outputOrg = "*".repeat(this._level) + " ";
        outputOrg += this._keyword ? this._keyword+" " : "";              // TODO DONE etc
        outputOrg += this.title;
        outputOrg += this.orgTags(outputOrg) + "\n";                    // add in any tags
        outputOrg += this.orgDrawers();                                 // add in any drawer text
        outputOrg += this._text ? this._text + "\n" : "";
        return outputOrg;
    }

    orgTextwChildren() {
        // Generate org text for this node and its descendents
        let outputOrg = this.orgText();
        this.childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            let txt = AllNodes[id].orgTextwChildren();
            outputOrg += txt.length ? "\n" + txt : "";           // eg BTLinkNodes might not have text 
        });
        return outputOrg;
    }
    
    static _orgTextToHTML(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        let hits;
        let outputStr = txt;
        while (hits = reg.exec(outputStr)) {
            const h2 = (hits[2]=="undefined") ? hits[1] : hits[2];
            if ((hits[1].indexOf('file:') == 0) || (hits[1].indexOf('id:') == 0))       // internal org links get highlighted, but not as hrefs
                outputStr = outputStr.substring(0, hits.index) + "<span class='file-link'>" + h2 + "</span>" + outputStr.substring(hits.index + hits[0].length);
            else                
                outputStr = outputStr.substring(0, hits.index) + "<a href='" + hits[1] + "' class='btlink'>" + h2 + "</a>" + outputStr.substring(hits.index + hits[0].length);
        }
        return outputStr;
    }

/***
 *
 * Utility functions
 *
 ***/

    countOpenableTabs() {
        // used to warn of opening too many tabs
        let childCounts = this.childIds.map(x => AllNodes[x].countOpenableTabs());

        const me = (this.URL && !this.tabId) ? 1 : 0;

        let n = 0;
        if (childCounts.length)
            n = childCounts.reduce((accumulator, currentValue) => accumulator + currentValue);
        
        return n + me;
    }

    countOpenableWindows() {
        // used to warn of opening too many windows
        let childCounts = this.childIds.map(x => AllNodes[x].countOpenableWindows());

        // I'm a window if I have URL containing children
        const me = this.childIds.some(id => AllNodes[id].URL) ? 1 : 0;

        let n = 0;
        if (childCounts.length)
            n = childCounts.reduce((accumulator, currentValue) => accumulator + currentValue);
        
        return n + me;
    }

    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order

        super.reparentNode(newP, index);
        
        // Update nesting level as needed (== org *** nesting)
        const newLevel = newP ? AllNodes[newP].level + 1 : 1;
        if (this.level != newLevel)
            this.resetLevel(newLevel);
    }
    
    indexInParent() {
        // Used for tab ordering
        if (!this.parentId) return 0;
        const parent = AllNodes[this.parentId];
        const thisid = this.id;
        let index = (parent.tabId) ? 1 : 0;          // if parent has a tab it's at index 0
        parent.childIds.some(function(id) {
            if (id == thisid) return true;           // exit when we get to this node
            let n = AllNodes[id];
            if (n && n.tabId) index++;
        });
        return index;
    }

    leftmostOpenTab() {
        // used for ordering w tabGroups

        const leftId = this.childIds.find(id => AllNodes[id].tabId);
        return leftId ? AllNodes[leftId].tabId : 0;
    }

    static generateTags() {
        // Iterate thru nodes and generate array of tags and their nesting

        function tagsForNode(id) {
            // recurse over children
            if (!AllNodes[id]) return;
            if (AllNodes[id].isTag())
                Tags.push({'name' : AllNodes[id].tagPath, 'level' : AllNodes[id].level});
            for (const nid of AllNodes[id].childIds)
                tagsForNode(nid);
        }
        
        // first make sure each node has a unique tagPath
        BTNode.generateUniqueTagPaths();
        Tags = new Array();
        for (const node of AllNodes) {
            if (node && node.level == 1)
                tagsForNode(node.id);
        }
    }
    
    static findFromTab(tabId) {
        // Return node associated w display tab
        return AllNodes.find(node => node && (node.tabId == tabId));
    }
    
    static findFromURL(url) {
        // Return node associated w url, if any
        return AllNodes.find(node => node && BTNode.compareURLs(node.URL, url));
    }

    static findFromWindow(winId) {
        // find topic from win
        return AllNodes.find(node => node && node.isTag() && node.windowId == winId);
    }
    
    static findFromGroup(groupId) {
        // find topic from tab group
        return AllNodes.find(node => node && node.isTag() && node.tabGroupId == groupId);
    }
}


class BTLinkNode extends BTAppNode {
    // create a link type node for links embedded in para text - they show as children in the tree but don't generate a new node when the org file is written out, unless they are edited and given descriptive text, in which case they are written out as nodes and will be promoted to BTNodes the next time the file is read.
    constructor(title, parent, text, level, protocol) {
        super(title, parent, text, level);
        this._protocol = protocol;
    }
    
    set protocol(ptxt) {
        this._protocol = ptxt;
    }
    get protocol() {
        return this._protocol;
    }

    orgTextwChildren() {
        // only generate org text for links with added descriptive text
        if (this._text.length)
            return super.orgTextwChildren(); // call function on super class to write out,
        return "";
    }

    HTML() {
        // only generate an HTML node for http[s]: links
        // other links (eg file:) pulled in from org won't work in the context of the browser
        if (this.protocol.match('http'))
            return super.HTML();
        return "";
    }

    isTag() {
        // Link nodes are never tags
        return false;
    }
    
    get displayTag() {
        // No display tag for linknodes cos they should never be a tag
        return "";
    }
}


/* Centralized Mappings from MessageType to handler. Array of handler functions */
const Handlers = {
    "loadBookmarks": loadBookmarks,
    "tabActivated": tabActivated,
    "tabsWindowed": tabsWindowed,
    "tabsGrouped": tabsGrouped,
    "tabUpdated": tabUpdated,
    "tabOpened" : tabOpened,
    "tabClosed" : tabClosed,
    "storeTabs": storeTabs,
    "keys": processKeys
};

// Set handler for extension messaging
window.addEventListener('message', event => {
    if (event.source != window)
        return;
    // lots of {"isTrusted":true} events don't know why, get them whenever a 
    //console.count(`BTAppNode received: [${JSON.stringify(event)}]`);
    if (Handlers[event.data.function]) {
        console.log("BTAppNode dispatching to ", Handlers[event.data.function].name);
        Handlers[event.data.function](event.data);
    }
});
    
