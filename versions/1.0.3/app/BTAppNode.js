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
 *  Centralizes all the node-related app logic of reading and writing to org, creating the ui etc
 *  
 *
 ***/

'use strict'

class BTAppNode extends BTNode {

    /***
     *
     * Basic node accessor functions w associated logic
     *
     ***/
    constructor(title, parentId, text, level, firstChild = false) {
        super(title, parentId, firstChild);
        this._text = text;
        this._level = level;
        this._folded = false;
        this._keyword = null;
        this._tabId = 0;
        this._tabGroupId = 0;
        this._windowId = 0;
        this._opening = false;

        // Three attributes of org ndes to track
        this.drawers = {};
        this.tags = [];         // the org-mode tags for this org header (ie BT Topic or link)
        this.planning = "";
        
        AllNodes[this._id] = this;
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
    }
    get tabId() {
        return this._tabId;
    }
    set tabIndex(index) {
        this._tabIndex = index;
    }
    get tabIndex() {
        return this._tabIndex;
    }
    set tabGroupId(id) {
        this._tabGroupId = id;
        if (!id) this.setTGColor(null);                   // clean up any color classes
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
    set opening(val) {
        this._opening = val;
    }
    get opening() {
        return this._opening;
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
    
    set pendingDeletion(f) {
        // indicate pending deletion on open tab
        this._pendingDeletion = f;
        const displayNode = this.getDisplayNode();
        const btTitle = $(displayNode).find('.btTitleText');
        const opacity = f ? 0.4 : 1;
        $(btTitle).css('opacity', opacity);
    }
    get pendingDeletion() {
        return this._pendingDeletion;
    }
    

    hasOpenChildren() {
        return this.childIds.filter(id => AllNodes[id].tabId).length;
    }
    hasOpenDescendants() {
        return (this.tabId || this.childIds.some(id => AllNodes[id].hasOpenDescendants()));
    }
    hasUnopenDescendants() {
        return ((this.URL && !this.tabId) ||
                this.childIds.some(id => AllNodes[id].hasUnopenDescendants()));
    }
    needsTab() {
        return (this.URL && !this.tabId);
    }
    openWindowIds() {
        // arrya of open window Ids
        const open = this.childIds.filter(id => AllNodes[id].windowId);
        return open.map(id => AllNodes[id].windowId);
    }
    findAnOpenNode() {
        // return a childId w an open tabgroup
        return this.childIds.find(id => AllNodes[id].windowId);
    }

    /***
     *
     * UI Management
     *
     ***/
    
    HTML() {
        // Generate HTML for this nodes table row
        let outputHTML = "";
        outputHTML += `<tr data-tt-id='${this.id}' `;
        if (this.parentId || this.parentId === 0)
            outputHTML += `data-tt-parent-id='${this.parentId}'`;

        let emptyTopic = (this.isTopic() && !this.childIds.length) ? "emptyTopic" : "";
        outputHTML += (this.isTopic()) ? `class='topic ${emptyTopic}' data-tt-branch='true'` : "";

        let topicClasses = (this.isTopic()) ? "btTitleText btTitle" : "btTitle";
	    
        outputHTML += `><td class='left'><span class='${topicClasses}'>${this.displayTitle()}</span></td>`;
        outputHTML += `<td class='right'><span class='btText'>${this.displayText()}</span></td></tr>`;
        return outputHTML;
    }

    displayText() {
        // escape any html entities and pass thru to static fn below
        let text = BTAppNode._decodeHtmlEntities(this._text);
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        return BTAppNode._orgTextToHTML(text);
    }
    
    /* for use escaping unicode in displayTitle below */
    static _textAreaForConversion = document.createElement('textarea');
    static _decodeHtmlEntities(str) {
        BTAppNode._textAreaForConversion.innerHTML = str;
        return BTAppNode._textAreaForConversion.value;
    }
    displayTitle() {
        // Node title as shown in tree, <a> for url.

        // handle keywords
        let keywordText = (this._keyword) ? `<span class='keyword'>${this._keyword} </span>` : ""; // TODO etc

        // escape any html entities
        let title = BTAppNode._decodeHtmlEntities(this.title);
        title = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        return BTAppNode._orgTextToHTML(title, keywordText);
    }
    
    url() {
	    // Node title as seen when its a search result
	    const reg = new RegExp("\\[\\[(.*?)\\]\\[(.*?)\\]\\]");           // NB non greedy match [[url][title]]
	    const match = this.title.match(reg);
	    return match ? match[1] : "";
    }

    getDisplayNode() {
	    // return jquery table row for node, lazy eval and cache
	    this.displayNode = this.displayNode || $(`tr[data-tt-id='${this.id}']`)[0];
        return this.displayNode;
    }

    getTTNode() {
        // return treetable node (nb not jquery node)
        return $("table.treetable").treetable("node", this.id);
    }

    unfoldOne() {
        // open this one node to show its kids but collapse kids

        // iterate thru children calling collapsenode
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (node?.isTopic()) {
                $("table.treetable").treetable("collapseNode", id);
            }
        });
        // then expand this one node
        $("table.treetable").treetable("expandNode", this.id);
    }
    unfoldAll() {
        // open this node and all children
        $("table.treetable").treetable("expandNode", this.id);
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (node?.isTopic()) node.unfoldAll();
        });
    }
    
    createDisplayNode() {
        // call out to treetable w nodes html, really its create or return. 
        // atTop is special case handling in ttable for a new top level node
        if (this.getTTNode()) return this.getTTNode();
        const atTop = (this.level == 1) ? true : false;
        const displayParent = (this.parentId) ? AllNodes[this.parentId].createDisplayNode() : null;
        $("table.treetable").treetable("loadBranch", displayParent, this.HTML(), atTop);
        return this.getTTNode();
    }

    redisplay(show=false) {
	    // regenerate content
	    const dn = this.getDisplayNode();
        let keywordText = (this._keyword) ? `<span class='keyword'>${this._keyword} </span>` : ""; // TODO etc

	    $(dn).find("span.btTitleText").html(keywordText + this.displayTopic);
	    $(dn).find("span.btText").html(this.displayText());
	    $(dn).find("span.btText").scrollTop(0);           // might have scrolled down for search
        $(dn).find(".left").scrollLeft(0);                // might have scrolled right for search
        $(dn).find(".left").css("text-overflow", "ellipsis");    // reset text overflow default
	    $(dn).find("a").each(function() {				  // reset link click intercept
	        this.onclick = handleLinkClick;
	    });
        if (this.isTopic() && this.childIds.length) $(dn).removeClass('emptyTopic');
        if (this.isTopic() && !this.childIds.length) $(dn).addClass('emptyTopic');
	    show && this.showForSearch();					  // reclose if needed
    }

    setTGColor(color = null) {
        // set color to sync w Tabgroup color
        const displayNode = this.getDisplayNode();
        if (!displayNode) return;
        this.tgColor = color;                      // remember color thru a refresh
        const colorClass = color ? 'tg'+color : null;
        const selector = this.isTopic() ? ".btTitle" : ".btTitle span.btTitleText";

        // remove any prev color and add new color or no longer shown in tg -> remove class
        $(displayNode).find(selector).removeClass(
            ['tggrey', 'tgblue', 'tgred', 'tgyellow', 'tggreen', 'tgpink',
             'tgpurple', 'tgcyan', 'tgorange']);
        if (color)
            $(displayNode).find(selector).addClass(['tabgroup', colorClass]);
        else
            $(displayNode).find(selector).removeClass('tabgroup');

        // iterate to contained nodes
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (node.tabId) node.setTGColor(color);
        });
    }

    storeFavicon() {
        // store favicon in browser local storage
        try {
            const host = this.URL.split(/[?#]/)[0];              // strip off any query or hash
            localFileManager.set(host, this.faviconUrl);
        }
        catch (e) {
            console.warn(`Error storing favicon: ${e}`);
        }
    }

    async populateFavicon() {
        // add favicon icon either from local storage or goog
        if (this.isTopic() || !this.URL) return;
        const host = this.URL.split(/[?#]/)[0];
        const favClass = (configManager.getProp('BTFavicons') == 'OFF') ? 'faviconOff' : 'faviconOn';
        const favUrl =
              this.faviconUrl ||
              await localFileManager.get(host) ||
              `https://www.google.com/s2/favicons?domain=${host}`;
        this.faviconUrl = favUrl;
        const dn = this.getDisplayNode();
        $(dn).find(`.${favClass}`).remove();                     // remove any previous set icon
        const fav = $(`<img src="${favUrl}" loading="lazy" class="${favClass}" alt="favicon">`);

        fav.on('error', function() {
            this.src = 'resources/help.png';                    // if no favicon found, use ? from help icon
            this.width = this.height = 16;
        });
        $(dn).find('.btlink').prepend(fav);
    }
    static populateFavicons() {
        // iterate thru tab nodes adding favicon icon either from local storage or goog
        // use requestIdleCallback and small batches bacause this can be costly with many nodes
        const nodes = AllNodes.filter(n => n && !n.isTopic() && n.URL);
        let index = 0;
    
        function processNextBatch(deadline) {
            let nodesProcessed = 0;
            while (index < nodes.length && deadline.timeRemaining() > 0 && nodesProcessed < 25) {
                nodes[index].populateFavicon();
                index++; nodesProcessed++;
            }
    
            if (index < nodes.length) {
                //console.log(index);
                requestIdleCallback(processNextBatch);
            }
        }
    
        requestIdleCallback(processNextBatch);
    }
    
    /***
     *
     * Search support
     *
     ***/
    
    showForSearch() {
	    // show this node in the tree cos its the search hit (might be folded)
	    const disp = this.getDisplayNode();
	    if(disp && !$(disp).is(':visible')) {
	        if (this.parentId) AllNodes[this.parentId].showForSearch();    // btnode show
	        $(disp).show();                                                // jquery node show
	        this.shownForSearch = true;
	    } 
    }

    unshowForSearch() {
	    // if this node was shown as a search result, now unshow it to get tree back to where it was
	    if (this.shownForSearch) {
	        const disp = this.getDisplayNode();
	        if (this.parentId) AllNodes[this.parentId].unshowForSearch();
	        $(disp).hide();
	        this.shownForSearch = false;
	    }
    }
    
    search(sstr) {
	    // search node for regex of /sstr/ig. update its display to show a hit (title or text)
	    
	    const reg = new RegExp(escapeRegExp(sstr), 'ig');
	    let match = false;
	    const node = this.getDisplayNode();
	    let titleStr;
        if (this.keyword && reg.test(this.keyword)) {
            titleStr = `<span class='highlight tabgroup'>${this.keyword}</span> ${this.displayTopic}`;
	        $(node).find("span.btTitleText").html(titleStr);
            match = true;
        } else if (reg.test(this.displayTopic)) {
	        titleStr = this.displayTopic.replaceAll(reg, `<span class='highlight tabgroup'>${sstr}</span>`);
	        $(node).find("span.btTitleText").html(titleStr);
	        match = true;
	    } else if (reg.test(this.url())) {
	        const hurl = this.url().replaceAll(reg, `<span class='highlight tabgroup'>${sstr}</span>`);
	        titleStr = "[" + hurl + "] <a href='" +this.url() + "'>" + this.displayTopic + "</a>";
	        $(node).find("span.btTitleText").html(titleStr);
	        match = true;
	    }
	    if (reg.test(this._text)) {
	        // show 125 chars before and after any match 
	        const index = this._text.search(reg);
	        const start = Math.max(index - 125, 0);
	        const len = this._text.length;
	        const end = Math.min(index + 125, len);
	        let textStr = this._text.substring(start, end);
	        textStr = (start > 0 ? "..." : "") + textStr + (end < len ? "..." : "");
	        textStr = textStr.replaceAll(reg, `<span class='highlight tabgroup'>${sstr}</span>`);
	        $(node).find("span.btText").html(textStr);
            setCompactMode(false);                                 // match might be hidden if single column
	        match = true;
	    }
	    if (match)
	        $(node).find("td").addClass('search');
	    
	    return match;	
    }

    static searchNodesToRedisplay = new Set();
    extendedSearch(sstr) {
	    // search node for regex of /sstr/ig. update its display to show a hit (title or text)
	    
	    const reg = new RegExp(escapeRegExp(sstr), 'ig');
	    let lmatch, rmatch;
	    const node = this.getDisplayNode();
        if (!$(node).is(":visible")) return;                 // return if not displayed
        
	    let titleStr;
	    // Look for match in title/topic, url and note
	    if (reg.test(this.displayTopic)) {
	        titleStr = this.displayTopic.replaceAll(reg, `<span class='extendedHighlight'>${sstr}</span>`);
	       // $(node).find("span.btTitle").html(titleStr);
	        $(node).find("span.btTitleText").html(titleStr);
	        lmatch = true;
	    }
	    if (!lmatch && reg.test(this.url())) {
	        // nb don't add span highlighting to url
	        lmatch = true;
	    }
	    if (reg.test(this.text)) {
	        let textStr = this.text;
	        textStr = textStr.replaceAll(reg, `<span class='extendedHighlight'>${sstr}</span>`);
	        $(node).find("span.btText").html(textStr);
	        rmatch = true;
	    }
	    
	    if (lmatch)
	        $(node).find("td.left").addClass('searchLite');
	    if (rmatch)
	        $(node).find("td.right").addClass('searchLite');
	    
	    // remember which nodes need to be redisplayed when seach ends
	    if (lmatch || rmatch) BTAppNode.searchNodesToRedisplay.add(this.id);
    }
    static redisplaySearchedNodes() {
	    // iterate thru nodes highlighted in search and redisplay

	    BTAppNode.searchNodesToRedisplay.forEach((n) => AllNodes[n].redisplay());
	    BTAppNode.searchNodesToRedisplay.clear();
    }

    static displayOrder = {};
    static setDisplayOrder() {
        // iterate through #content.tr rows and create a hash mapping the node.id to a {prev:, next:} structure 
        // used by nextDisplayNode() to iterate through nodes in display order
        BTAppNode.displayOrder = {};
        let prevNodeId = null;
        $("#content tr").each((i, node) => {
            const nodeId = $(node).attr('data-tt-id');
            BTAppNode.displayOrder[nodeId] = {
                prev: prevNodeId,
                next: null
            };
            prevNodeId && (BTAppNode.displayOrder[prevNodeId].next = nodeId);
            prevNodeId = nodeId;
        });

        // set prev of first node to last and next of last node to first to iterate around
        const firstNodeId = Object.keys(BTAppNode.displayOrder)[0];
        BTAppNode.displayOrder[firstNodeId].prev = prevNodeId;
        BTAppNode.displayOrder[prevNodeId].next = firstNodeId;
    }
    static resetDisplayOrder() {
        // Clear out the display order cache
        BTAppNode.displayOrder = {};
    }
    nextDisplayNode(reverse = false) {
        // displayOrder is the order of the nodes in the table, not in AllNodes. Used by search to know the next node to search in
        const nodeId =  reverse ? BTAppNode.displayOrder[this.id].prev : BTAppNode.displayOrder[this.id].next;
        return AllNodes[nodeId];
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
        else if (this.tabGroupId)
            window.postMessage(
                {'function' : 'showNode', 'tabGroupId': this.tabGroupId});
        else if (this.windowId)
            window.postMessage(
                {'function' : 'showNode', 'windowId': this.windowId});
    }

    async openTopicTree() {
        // this node points to a topic tree, have fileManager open and insert it
        await loadOrgFile(this.URL);

    }
    
    openPage(newWin = false) {
        // open this nodes url
        if (!this.URL || this._opening) return;

        // record stats
        gtag('event', 'openRow', {'event_category': 'TabOperation'});
        configManager.incrementStat('BTNumTabOperations');

        // if this node is a link to a topic tree load it up
        if (this.isTopicTree()) {
            if (!this.childIds.length || confirm('Re-add this topic tree?'))
                this.openTopicTree();
            return;
        }

        // if already open, tell bg to show it
        if (this.tabId) {
            this.showNode();
            return;
        }
        this.opening = true;      // avoid opening twice w double clicks. unset in tabNavigated

        const parent = this.parentId ? AllNodes[this.parentId] : null;
        if (parent?.hasOpenChildren() && (GroupingMode == 'TABGROUP')) newWin = false;       // only allow opening in new window if not already in an open TG, or not using TGs
    
        const oldWinId = parent ? parent.windowId : 0;
        // tell extension to open, then take care of grouping etc
        callBackground({'function': 'openTabs', 'newWin': newWin, 'defaultWinId': oldWinId,
                            'tabs': [{'nodeId': this.id, 'url': this.URL}]});
        
        this.showNode();
        return;
    }

    openAll(newWin = false) {
        // open this node and any children. NB order taken care of by tabOpened -> groupAndPosition

        // record stats
        gtag('event', 'openAll', {'event_category': 'TabOperation'});
        configManager.incrementStat('BTNumTabOperations');

        // if we don't care about grouping just open each tab
        if (GroupingMode == 'NONE') {
            const tabsToOpen = this.listOpenableTabs();              // [{nodeId, url}..}
            window.postMessage({'function': 'openTabs', 'tabs': tabsToOpen, 'newWin': newWin});
        }
        else {                      // need to open all urls in single (possibly new) window
            const tabGroupsToOpen = this.listOpenableTabGroups();    // [{tg, [{id, url}]},..]
            window.postMessage({'function': 'openTabGroups', 'tabGroups': tabGroupsToOpen,
                                'newWin': newWin});
        }
    }

    groupAndPosition() {
        // Topic node fn to (re)group open tabs and put them in correct order

        if (!this.isTopic() || (GroupingMode != 'TABGROUP')) return;
        let tabInfo = [];
        const myWin = this.windowId;
        const myTG = this.tabGroupId;
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (!node.tabId) return;
            this.tabGroupId = myTG || node.tabGroupId;          // tab might be moved to new TG/win
            this.windowId = myWin || node.windowId;
            const index = node?.expectedTabIndex() || 0;
            tabInfo.push({'nodeId': id, 'tabId': node.tabId, 'tabIndex': index});
        });
        window.postMessage({'function': 'groupAndPositionTabs', 'tabGroupId': this.tabGroupId,
                            'windowId': this.windowId, 'tabInfo': tabInfo,
                            'groupName': this.topicName(), 'topicId': this.id,
                        });
    }
    
    putInGroup() {
        // wrap this one nodes tab in a group
        if (!this.tabId || !this.windowId || (GroupingMode != 'TABGROUP')) return;
        const groupName = this.isTopic() ? this.topicName() : AllNodes[this.parentId]?.topicName();
        const groupId = this.isTopic() ? this.id : AllNodes[this.parentId]?.id;
        const tgId = this.tabGroupId || AllNodes[this.parentId]?.tabGroupId;
        window.postMessage({'function': 'groupAndPositionTabs', 'tabGroupId': tgId,
                            'windowId': this.windowId, 'tabInfo': [{'nodeId': this.id, 'tabId': this.tabId, 'tabIndex': this.tabIndex}],
                            'groupName': groupName, 'topicId': groupId,});
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

    updateTabGroup() {
        // set TG in browser to appropriate name/folded state
        let rsp;
        if (this.tabGroupId && this.isTopic())
            rsp = callBackground({'function': 'updateGroup', 'tabGroupId': this.tabGroupId,
                                  'collapsed': this.folded, 'title': this.topicName()});
        return rsp;
    }
        
    static ungroupAll() {
        // user has changed from TABGROUP to NONE, tell background to ungroup all BT tabs
        const tabIds = AllNodes.flatMap(n => n.tabId ? [n.tabId] : []);
        if (tabIds.length)
            if (confirm('Also ungroup open tabs?'))
                callBackground({'function': 'ungroup', 'tabIds': tabIds});
    }

    groupOpenChildren() {
        // used by groupAll, below, and after an undoDelete for individual node
        if (this.hasOpenChildren()) {
            const openTabIds = this.childIds.flatMap(
                c => AllNodes[c].tabId ? [AllNodes[c].tabId] : []);
            window.postMessage({
                'function': 'moveOpenTabsToTG', 'groupName': this.displayTopic,
                'tabIds': openTabIds, 'windowId': this.windowId
            });
        }
    }

    static groupAll() {
        // user has changed from NONE to TABGROUP, tell background to group all BT tabs
        AllNodes.forEach(n => n.groupOpenChildren());
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
            const reg = /:([\w-]*):(.*)$/gm;              // regex to grab prop and its value from each line
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
        // finally, check to see if props is empty, otherwise return
        return (drawerText == '  :PROPERTIES:\n  :END:\n') ? "" : drawerText;
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
        let outputOrg = "";
        outputOrg += "*".repeat(this._level) + " ";
        outputOrg += this._keyword ? this._keyword+" " : "";            // TODO DONE etc
        outputOrg += this.title;
        outputOrg += this.orgTags(outputOrg) + "\n";                    // add in any tags
        outputOrg += this.planning;                                     // add in any planning rows
        outputOrg += this.orgDrawers();                                 // add in any drawer text
        outputOrg += this._text ? (this._text + "\n") : "";
        
        return outputOrg;
    }

    orgTextwChildren() {
        // Generate org text for this node and its descendents
        let outputOrg = this.orgText();
        this.childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            let txt = AllNodes[id].orgTextwChildren();
            outputOrg += txt.length ? "\n" + txt : "";        // eg BTLinkNodes might not have text 
        });
        return outputOrg;
    }

    static generateOrgFile() {
        // iterate thru nodes to do the work
        let orgText = configManager.metaPropertiesToString();
        
        // find and order the top level nodes according to table position
        const topNodes = AllNodes.filter(node => node && !node.parentId);
        topNodes.sort(function(a,b) {
            const eltA = $(`tr[data-tt-id='${a.id}']`)[0];
            const eltB = $(`tr[data-tt-id='${b.id}']`)[0];
            const posA = eltA ? eltA.rowIndex : Number.MAX_SAFE_INTEGER;
            const posB = eltB ? eltB.rowIndex : Number.MAX_SAFE_INTEGER;
            return (posA - posB);
        });
        
        // iterate on top level nodes, generate text and recurse
        topNodes.forEach(function (node) {
            orgText += node.orgTextwChildren() + "\n";
        });
        return orgText.slice(0, -1);                                      // take off final \n
    }
    
    /***
     *
     * Utility functions
     *
     ***/

    
    static _orgTextToHTML(txt, keyword = "") {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        let outputStr = txt;
        let hits = reg.exec(outputStr);
        if (hits) {
            const h2 = (hits[2]=="undefined") ? hits[1] : hits[2];
            if (hits[1].indexOf('id:') == 0)             // internal org links get highlighted, but not as hrefs
                outputStr = outputStr.substring(0, hits.index) +
                "<span class='file-link'>" + h2 + "</span>" +
                outputStr.substring(hits.index + hits[0].length);
            else
                outputStr = outputStr.substring(0, hits.index) + 
               "<a href='" + hits[1] + "' class='btlink'><span class='btTitleText'>" + keyword + h2 + "</span></a>" +
                outputStr.substring(hits.index + hits[0].length);
        } else {
            outputStr = keyword + outputStr;
        }
        return outputStr;
    }

    countOpenableTabs() {
        // used to warn of opening too many tabs and show appropriate row action buttons
        let childCounts = this.childIds.map(x => AllNodes[x].countOpenableTabs());

        const me = (this.URL && !this.tabId) ? 1 : 0;

        let n = 0;
        if (childCounts.length)
            n = childCounts.reduce((accumulator, currentValue) => accumulator + currentValue);
        
        return n + me;
    }

    countClosableTabs() {
        // used to warn of opening too many tabs and show appropriate row action buttons
        let childCounts = this.childIds.map(x => AllNodes[x].countClosableTabs());

        const me = (this.tabId) ? 1 : 0;

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

    listOpenableTabs() {
        // gather up {nodeId, url} pairs for opening
        let me = this.needsTab() ? [{'nodeId': this.id, 'url': this.URL}] : [];
        let childrenURLs = this.childIds.flatMap(id => AllNodes[id].listOpenableTabs());
        return [me, ...childrenURLs].flat();
    }

    listOpenTabs() {
        // {nodeId, tabId} array for this nodes open pages
        let tabs = this._tabId ? [{'nodeId': this.id, 'tabId': this._tabId}] : [];
        this.childIds.forEach( id => {
            if (AllNodes[id] && AllNodes[id].tabId)
                tabs.push({'nodeId': id, 'tabId': AllNodes[id].tabId});
        });
        return tabs;
    }

    listOpenableTabGroups() {
        // walk containment tree, create [{tabGroupId, windowId, tabGroupTabs: [{nodeId, url}]}, {}]
        // where tgid & winid might be null => create new
        if (!this.isTopic()) return [];                     // => not tab group
        let tabGroupTabs = this.needsTab() ? [{'nodeId': this.id, 'url': this.URL}] : [];
        this.childIds.forEach((id) => {
            const node = AllNodes[id];
            if (!node.isTopic() && node.needsTab())
                tabGroupTabs.push({'nodeId': id, 'url': node.URL});
        });
        const me = tabGroupTabs.length ?
              {'tabGroupId': this.tabGroupId, 'windowId': this.windowId, 'groupName': this.topicName(),
               'tabGroupTabs': tabGroupTabs} : [];
        const subtopics = this.childIds.flatMap(id => AllNodes[id].listOpenableTabGroups());
        return [me, ...subtopics].flat();
    }
    
    handleNodeMove(newP, index = -1, browserAction = false) {
        // move node to parent at index. Parent might be existing just at new index.
        // Could be called from drag/drop/keyboard move or from tabs in tabGroups in browser
        const oldP = this.parentId;

        // update display class if needed, old Parent might now be empty, new parent is not
        if (AllNodes[oldP]?.childIds?.length == 1)
            $(`tr[data-tt-id='${oldP}']`).addClass('emptyTopic');
        $(`tr[data-tt-id='${newP}']`).removeClass('emptyTopic');

        // move the node in parental child arrays
        this.reparentNode(newP, index);
        
        // Update nesting level as needed (== org *** nesting)
        const newLevel = newP ? AllNodes[newP].level + 1 : 1;
        if (this.level != newLevel)
            this.resetLevel(newLevel);

        // if node has open tab we might need to update its tab group/position
        if (this.tabId) {
            if (newP != oldP) this.tabGroupId = AllNodes[newP].tabGroupId;
            if (!browserAction) 
                AllNodes[newP].tabGroupId ? AllNodes[newP].groupAndPosition() : this.putInGroup();
            // update old P's display node to remove open tg styling
            if (!AllNodes[oldP]?.hasOpenChildren()) {
                $("tr[data-tt-id='"+oldP+"']").removeClass("opened");
                AllNodes[oldP].setTGColor(null);
                AllNodes[oldP].tabGroupId = null;
            }
        }
    }
    
    indexInParent() {
        // Used for tab ordering
        if (!this.parentId) return 0;
        const parent = AllNodes[this.parentId];
        const thisid = this.id;
        let index = (parent.tabId) ? 1 : 0;          // if parent has a tab it's at index 0
        parent.childIds.some(id => {
            if (id == thisid) return true;           // exit when we get to this node
            let n = AllNodes[id];
            if (n && n.tabId && (n.windowId == this.windowId)) index++;
        });
        return index;
    }

    leftmostOpenTabIndex() {
        // used for ordering w tabGroups, find min tabIndex
        const leftIndex = this.childIds.reduce(
            (a, b) => Math.min(a, ((AllNodes[b].windowId == this.windowId) &&
                                   (AllNodes[b].tabIndex !== undefined))
                               ? AllNodes[b].tabIndex : 999),
            999);
        return (leftIndex < 999) ? leftIndex : 0;
    }

    expectedTabIndex() {
        if (!this.parentId) return 0;
        const parent = AllNodes[this.parentId];
        return parent.leftmostOpenTabIndex() + this.indexInParent();
    }

    static generateTopics() {
        // Iterate thru nodes and generate array of topics and their nesting

        function topicsForNode(id) {
            // recurse over children
            if (!AllNodes[id]) return;
            if (AllNodes[id].isTopic())
                Topics.push({'name' : AllNodes[id].topicPath, 'level' : AllNodes[id].level});
            for (const nid of AllNodes[id].childIds)
                topicsForNode(nid);
        }
        
        // first make sure each node has a unique topicPath
        BTNode.generateUniqueTopicPaths();
        Topics = new Array();
        $("#content tr").each(function() {
            const id = $(this).attr('data-tt-id');
            if (AllNodes[id]?.parentId == null)
                topicsForNode(id);
        });
    }
    
    static findFromTab(tabId) {
        // Return node associated w display tab
        return AllNodes.find(node => node && (node.tabId == tabId));
    }
    
    static findFromURLTGWin(url, tg, win) {
        // find node from url/TG/Window combo.
        // #1 is there a unique BT node w url
        // #2 is there a matching url in same TG or window as new tab
        const urlNodes = AllNodes.filter(node => node && BTNode.compareURLs(node.URL, url));
        if (urlNodes.length == 0) return null;
        if (urlNodes.length == 1) return urlNodes[0];
        for (const node of urlNodes) {
            let parentId = node.parentId;
            if (parentId && AllNodes[parentId] && AllNodes[parentId].tabGroupId == tg)
                return node;
        }
        for (const node of urlNodes) {
            let parentId = node.parentId;
            if (parentId && AllNodes[parentId] && AllNodes[parentId].windowId == win)
                return node;
        }
        return urlNodes[0];                                      // else just use first
    }

    static findFromWindow(winId) {
        // find topic from win
        return AllNodes.find(node => node && node.isTopic() && node.windowId == winId);
    }
    
    static findFromGroup(groupId) {
        // find topic from tab group
        return AllNodes.find(node => node && node.isTopic() && node.tabGroupId == groupId);
    }
    
    static findOrCreateFromTopicDN(topicDN) {
        // Walk down tree of topics from top, finding or creating nodes & tt display nodes
        let components = topicDN.match(/.*?:/g);
        if (components) components = components.map(c => c.slice(0, -1));          // remove :
        const topic = topicDN.match(/:/) ? topicDN.match(/.*:(.*?$)/)[1] : topicDN;
        const topTopic = (components && components.length) ? components[0] : topic;

        // Find or create top node
        let topNode = AllNodes.find(node => node && node.topicName() == topTopic);
        if (!topNode) {
            topNode = new BTAppNode(topTopic, null, "", 1);
            topNode.createDisplayNode();
        }
            
        if (!components) return topNode;
        
        // Remove, now handled first elt, Walk down rest creating as needed
        let currentNode = topNode;
        components.shift();
        components.forEach((t) => {
            let node = currentNode;
            currentNode = currentNode.findChild(t);
            if (!currentNode) {
                currentNode = new BTAppNode(t, node.id, "", node.level + 1);
                currentNode.createDisplayNode();
            }
        });

        // finally find or create the leaf node
        if (currentNode.findChild(topic))
            return currentNode.findChild(topic);
        let newLeaf = new BTAppNode(topic, currentNode.id, "", currentNode.level + 1);
        newLeaf.createDisplayNode();
        topNode.redisplay();                              // since new nodes created
        return newLeaf;
    }
    
}


class BTLinkNode extends BTAppNode {
    /***
     *
     *  Specific link type node for links embedded in para text, not as BT created headlines.
     *  they show as children in the tree but don't generate a new node when the org file is written out,
     *  unless they are edited and given descriptive text, 
     *  in which case they are written out as nodes and will be promoted to BTNodes 
     *  the next time the file is read.
     *
     ***/

    
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

    get text() {
        return this._text;
    }
    
    set text(txt) {
        // When text is added this link is promoted to a headline. To prevent a dup link
        // on next read replace the [[url][ttl]] in parent text with [url][ttl]
        // so that it no longer has link syntax.
        const parent = AllNodes[this.parentId];
        const nonLink = this._title.slice(1, -1);
        parent.text = parent.text.replace(this._title, nonLink);
        this._text = txt;
    }

    orgTextwChildren() {
        // only generate org text for links with added descriptive text
        if (this._text.length)
            return super.orgTextwChildren(); // call function on super class to write out,
        return "";
    }

    HTML() {
        // was limited to http links, internal org links will not work but file links do
        // if (this.protocol.match('http'))
        return super.HTML();
        // return "";
    }

    isTopic() {
        // Link nodes are never topics
        return false;
    }
}   

/***
 *
 *  Centralized Mappings from MessageType to handler. Array of handler functions
 *
 ***/

const Handlers = {
    "launchApp": launchApp,                 // Kick the whole thing off
    "loadBookmarks": loadBookmarks,
    "tabActivated": tabActivated,           // User nav to Existing tab
    "tabJoinedTG" : tabJoinedTG,            // a tab was dragged or moved into a TG
    "tabLeftTG" : tabLeftTG,                // a tab was dragged out of a TG
    "tabNavigated": tabNavigated,           // User navigated a tab to a new url
    "tabOpened" : tabOpened,                // New tab opened by bg on our behalf
    "tabMoved" : tabMoved,                  // user moved a tab
    "tabPositioned": tabPositioned,         // tab moved by extension
    "tabClosed" : tabClosed,                // tab closed
    "saveTabs": saveTabs,                   // popup save operation - page, tg, window or session
    "tabGroupCreated": tabGroupCreated,
    "tabGroupUpdated": tabGroupUpdated,
    "noSuchNode": noSuchNode,               // bg is letting us know we requested action on a non-existent tab or tg
};

// Set handler for extension messaging
window.addEventListener('message', event => {
    if (event.source != window || event.functionType == 'AWAIT')        // async handled below
        return;

    //console.count(`BTAppNode received: [${JSON.stringify(event)}]`);
    if (Handlers[event.data.function]) {
        console.log("BTAppNode dispatching to ", Handlers[event.data.function].name);
        Handlers[event.data.function](event.data);
    }
});

// Function to send a message to the content script and await a response
function callBackground(message) {
    return new Promise((resolve) => {
        // Listen for the response from the content script
        window.addEventListener("message", function handler(event) {
            if (event.source !== window || event.type !== 'AWAIT') {
                return;
            }
            
            if (event.data && event.data.type === "AWAIT_RESPONSE") {
                window.removeEventListener("message", handler);
                resolve(event.data.response);
            }
        });
        
        // Send the message to the content script with the page's origin as targetOrigin
        message.type = "AWAIT";
        window.postMessage(message, window.origin);
    });
}
