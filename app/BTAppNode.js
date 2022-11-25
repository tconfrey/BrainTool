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
    constructor(title, parentId, text, level) {
        super(title, parentId);
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
        this.tags = [];
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
	    let childlessTop = "";
        outputHTML += `<tr data-tt-id='${this.id}' `;
        if (this.parentId || this.parentId === 0)
            outputHTML += `data-tt-parent-id='${this.parentId}'`;
	    else if ((this.level == 1) && (this.childIds.length == 0))
	        childlessTop = 'childlessTop';

        outputHTML += (this.isTopic()) ? "class='topic'" : "";
	    
        outputHTML += `><td class='left ${childlessTop}'><span class='btTitle'>${this.displayTitle()}</span></td>`;
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
        if (this._keyword) txt += `<span class='keyword'>${this._keyword} </span>`; // TODO etc
        return txt + BTAppNode._orgTextToHTML(this.title);
    }
    
    url() {
	    // Node title as seen when its a search result
	    const reg = new RegExp("\\[\\[(.*?)\\]\\[(.*?)\\]\\]");           // NB non greedy
	    const match = this.title.match(reg);
	    return match ? match[1] : "";
    }

    getDisplayNode() {
	    // return jquery table row for node
	    return $(`tr[data-tt-id='${this.id}']`)[0];
    }

    getTTNode() {
        // return treetable node (nb not jquery node)
        return $("table.treetable").treetable("node", this.id);
    }
    
    createDisplayNode(atTop = false) {
        // call out to treetable w nodes html, really its create or return
        if (this.getTTNode()) return this.getTTNode();
        let displayParent = (this.parentId) ? AllNodes[this.parentId].createDisplayNode() : null;
        $("table.treetable").treetable("loadBranch", displayParent, this.HTML(), atTop);
        return this.getTTNode();
    }

    redisplay(show=false) {
	    // regenerate content
	    const dn = this.getDisplayNode();
	    $(dn).find("span.btTitle").html(this.displayTitle());
	    $(dn).find("span.btText").html(this.displayText());
	    $(dn).find("span.btText").scrollTop(0);           // might have scrolled down for search
	    $(dn).find("a").each(function() {				  // reset link click intercept
	        this.onclick = handleLinkClick;
	    });
	    show && this.showForSearch();					  // reclose if needed
	    if (this.childIds.length)                         // set correctly
	        $(dn).children('.left').removeClass('childlessTop');
    }

    setTGColor(color = null) {
        // set color to sync w Tabgroup color
        const displayNode = this.getDisplayNode();
        if (!displayNode) return;
        this.tgColor = color;                      // remember color thru a refresh
        const colorClass = color ? 'tg'+color : null;
        const selector = this.isTopic() ? ".btTitle" : ".btTitle a";

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

    async populateFavicon() {
        // add favicon icon either from local storage or goog
        if (this.isTopic() || !this.URL) return;
        const host = this.URL.split(/[?#]/)[0];
        const favClass = (configManager.getProp('BTFavicons') == 'ON') ? 'faviconOn' : 'faviconOff';
        const favUrl =
              this.faviconUrl ||
              await localFileManager.get(host) ||
              `https://www.google.com/s2/favicons?domain=${host}`;
        this.faviconUrl = favUrl;
        const dn = this.getDisplayNode();
        $(dn).find(`.${favClass}`).remove();                     // remove any previous set icon
        const fav = $(`<img src="${favUrl}" loading="lazy" class="${favClass}">`);
        $(fav).insertBefore($(dn).find('.btTitle'));
    }

    static async populateFavicons() {
        // iterate thru nodes adding favicon icon either from local storage or goog
        AllNodes.forEach(async n => {
            if (!n || n.isTopic() || !n.URL) return;
            n.populateFavicon();
        });
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
            titleStr = `<b class='highlight'>${this.keyword}</b> ${this.displayTag}`;
	        $(node).find("span.btTitle").html(titleStr);
            match = true;
        } else if (reg.test(this.displayTag)) {
	        titleStr = this.displayTag.replaceAll(reg, `<span class='highlight'>${sstr}</span>`);
	        $(node).find("span.btTitle").html(titleStr);
	        match = true;
	    } else if (reg.test(this.url())) {
	        const hurl = this.url().replaceAll(reg, `<span class='highlight'>${sstr}</span>`);
	        titleStr = "[" + hurl + "] <a href='" +this.url() + "'>" + this.displayTag + "</a>";
	        $(node).find("span.btTitle").html(titleStr);
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
	        textStr = textStr.replaceAll(reg, `<span class='highlight'>${sstr}</span>`);
	        $(node).find("span.btText").html(textStr);
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
	    if (reg.test(this.displayTag)) {
	        titleStr = this.displayTag.replaceAll(reg, `<span class='highlight'>${sstr}</span>`);
	        $(node).find("span.btTitle").html(titleStr);
	        lmatch = true;
	    }
	    if (!lmatch && reg.test(this.url())) {
	        // nb don't add span highlighting to url
	        lmatch = true;
	    }
	    if (reg.test(this.text)) {
	        let textStr = this.text;
	        textStr = textStr.replaceAll(reg, `<span class='highlight'>${sstr}</span>`);
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
        this.opening = true;      // avoid opening twice w double clicks. unset in tabUpdated

        const oldWinId = (this.parentId) ? AllNodes[this.parentId].windowId : 0;
        // tell extension to open when tabOpened message comes back we take care of grouping etc
        window.postMessage({'function': 'openTabs', 'newWin': newWin, 'defaultWinId': oldWinId,
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
            if (!node.tabId ||
                (node.windowId && node.windowId != myWin) ||
                (node.tabGroupId && node.tabGroupId != myTG))
                return;
            
            const index = node?.expectedTabIndex() || 0;
            tabInfo.push({'nodeId': id, 'tabId': node.tabId, 'tabIndex': index});
        });
        window.postMessage({'function': 'groupAndPositionTabs', 'tabGroupId': this.tabGroupId,
                            'windowId': this.windowId, 'tabInfo': tabInfo,
                            'groupName': this.displayTag});
    }
    
    putInGroup() {
        // wrap this one nodes tab in a group
        if (!this.tabId || !this.windowId) return;
        const groupName = this.isTopic() ? this.displayTag : AllNodes[this.parentId]?.displayTag;
        window.postMessage({'function': 'groupAll', 'groupName': groupName,
                            'tabIds': [this.tabId], 'windowId': this.windowId});
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

    createTabGroup() {
        // create tg from topic node w children
        if (!this.hasOpenChildren()) return;
        const openTabIds = this.childIds.flatMap(
            c => AllNodes[c].tabId ? [AllNodes[c].tabId] :[]);
        window.postMessage({'function': 'groupAll', 'groupName': this.displayTag,
                            'tabIds': openTabIds, 'windowId': this.windowId});
    }

    updateTabGroup() {
        // set TG in browser to appropriate name/folded state
        if (this.tabGroupId && this.isTopic())
            window.postMessage({'function': 'updateGroup', 'tabGroupId': this.tabGroupId,
                                'collapsed': this.folded, 'title': this.title});
    }
        
    static ungroupAll() {
        // user has changed from TABGROUP to NONE, tell background to ungroup all BT tabs
        const tabIds = AllNodes.flatMap(n => n.tabId ? [n.tabId] : []);
        if (tabIds.length)
            if (confirm('Also ungroup open tabs?'))
                window.postMessage({'function': 'ungroup', 'tabIds': tabIds});
    }

    static groupAll() {
        // user has changed grouping to TabGroups so group open tabs up

        AllNodes.forEach(n => {
            if (n.hasOpenChildren()) {
                const openTabIds = n.childIds.flatMap(
                    c => AllNodes[c].tabId ? [AllNodes[c].tabId] :[]);
                window.postMessage({'function': 'groupAll', 'groupName': n.displayTag,
                                    'tabIds': openTabIds, 'windowId': n.windowId});
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
        let orgText = metaPropertiesToString(AllNodes.metaProperties);
        
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
            if (node && (node.level == 1))
                orgText += node.orgTextwChildren() + "\n";
        });
        return orgText.slice(0, -1);                                      // take off final \n
    }
    
    /***
     *
     * Utility functions
     *
     ***/

    
    static _orgTextToHTML(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        let hits;
        let outputStr = txt;
        while (hits = reg.exec(outputStr)) {
            const h2 = (hits[2]=="undefined") ? hits[1] : hits[2];
            if (hits[1].indexOf('id:') == 0)             // internal org links get highlighted, but not as hrefs
                outputStr = outputStr.substring(0, hits.index) +
                "<span class='file-link'>" + h2 + "</span>" +
                outputStr.substring(hits.index + hits[0].length);
            else
                outputStr = outputStr.substring(0, hits.index) +
                "<a href='" + hits[1] + "' class='btlink'>" + h2 + "</a>" +
                outputStr.substring(hits.index + hits[0].length);
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
              {'tabGroupId': this.tabGroupId, 'windowId': this.windowId,
               'tabGroupTabs': tabGroupTabs} : [];
        const subtopics = this.childIds.flatMap(id => AllNodes[id].listOpenableTabGroups());
        return [me, ...subtopics].flat();
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
        BTNode.generateUniqueTopicPaths();
        Tags = new Array();
        $("#content tr").each(function() {
            const id = $(this).attr('data-tt-id');
            if (AllNodes[id]?.level == 1)
                tagsForNode(id);
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
        return AllNodes.find(node => node && node.isTag() && node.windowId == winId);
    }
    
    static findFromGroup(groupId) {
        // find topic from tab group
        return AllNodes.find(node => node && node.isTag() && node.tabGroupId == groupId);
    }
    
    static findOrCreateFromTopicDN(topicDN) {
        // Walk down tree of topics from top, finding or creating nodes & tt display nodes
        let components = topicDN.match(/.*?:/g);
        if (components) components = components.map(c => c.slice(0, -1));          // remove :
        const topic = topicDN.match(/:/) ? topicDN.match(/.*:(.*?$)/)[1] : topicDN;
        const topTopic = (components && components.length) ? components[0] : topic;

        // Find or create top node
        let topNode = AllNodes.find(node => node && node.displayTag == topTopic);
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

    isTag() {
        // Link nodes are never tags
        return false;
    }
}   

/***
 *
 *  Centralized Mappings from MessageType to handler. Array of handler functions
 *
 ***/

const Handlers = {
    "loadBookmarks": loadBookmarks,
    "importSession": importSession,
    "tabActivated": tabActivated,
    "tabGrouped": tabGrouped,
    "tabUpdated": tabUpdated,
    "tabOpened" : tabOpened,
    "tabMoved" : tabMoved,
    "tabClosed" : tabClosed,
    "storeTabs": storeTabs,
    "launchApp": launchApp,
    "tabGroupCreated": tabGroupCreated,
    "tabGroupUpdated": tabGroupUpdated,
    "tabPositioned": tabPositioned
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

