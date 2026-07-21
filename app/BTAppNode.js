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
 *  Centralizes all the node-related app logic of reading and writing to org, creating the ui etc
 *  
 *
 ***/

'use strict'

import { BTNode, AllNodes } from './BTNode.js';
import { getProp, incrementStat, metaPropertiesToString } from './configManager.js';
import { sendMessage, callBackground } from './extensionMessaging.js';
import { localStorageManager } from './localFileManager.js';
import { loadOrgFile } from './fileManager.js';

var Topics = [];                                                                                // track topics for future tab assignment
const specialTopics = ['📝 SCRATCH', '🗑️ TRASH', '🔖 BOOKMARKS BAR', '🌐 CURRENT SESSION'];
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
        this._bookmarkId = 0;
        this._tabGroupId = 0;
        this._windowId = 0;
        this._opening = false;
        this.aliases = new Set();                 // Set of alias URLs that map to this node's URL

        // Three attributes of org ndes to track
        this.drawers = {};
        this.tags = [];         // the org-mode tags for this org header (ie BT Topic or link)
        this.planning = "";
        
        AllNodes[this._id] = this;
    }

    allowedRowActions() {
        // Row action defaults; specialized nodes override to disable operations
        return {
            open: true,
            openInNewWindow: true,
            close: true,
            delete: true,
            addChild: true,
            promote: true,
            edit: true,
            todo: true,
            drag: true,
        };
    }

    canAcceptDrop(node) {
        // Can the dragged node be dropped beneath this node?
        if (!node) return false;

        // Drop into trash deletes the dragged node. Session nodes are views of browser state
        // and aren't deletable, so they can't be trashed.
        if (this.isTrash() || this.trashed) return !node.isSessionNode;

        // Only topics live at the top level, so leaves need a topic parent. A drop below a top
        // level node that isn't an expanded topic lands at the top level - cf determineDropBehavior.
        const dropInto = this.isTopic() && !this.folded;
        if (!dropInto && !this.parentId && !node.isTopic()) return false;

        // Session nodes dropped into the app tree are saved as new appNodes, or re-filed if
        // already saved (see saveSessionNodeToApp in tableManager): only TABs and GROUPs qualify.
        if (node.isSessionNode) return node.canBeDroppedInTopicTree();
        return true;
    }

    canMoveTo(parentNode) {
        // Only topics live at the top level, leaf nodes must have a topic parent
        if (!parentNode) return this.isTopic();
        return true;
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
    get bookmarkId() {
        return this._bookmarkId;
    }
    set bookmarkId(id) {
        this._bookmarkId = id;
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
        const different = (this.level == l) ? false : true;
        if (!different) return;
        this.level = l;
        
        const displayNode = this.getDisplayNode?.();
        if (!displayNode) return;
        const $indenter = $(displayNode).find('td.left span.indenter');
        if (!$indenter.length) return;
        
        // update padding
        const newStyle = `padding-left: calc(var(--btIndentStepSize) * ${this.level - 1})`;
        $indenter.attr('style', newStyle);
        
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
    
    rowClassList() {
        const classes = [];
        if (this.isTopic()) {
            classes.push('topic');
            if (!this.childIds.length) classes.push('emptyTopic');
        }
        return classes;
    }

    titleSpanClassList() {
        const classes = this.isTopic() ? ['btTitleText', 'btTitle'] : ['btTitle'];
        if (specialTopics.includes(this.title)) classes.push('specialTopic');
        if (this.trashed) classes.push('trashed');
        return classes;
    }

    HTML() {
        // Generate HTML for this nodes table row
        let outputHTML = "";
        outputHTML += `<tr data-tt-id='${this.id}' `;
        if (this.parentId || this.parentId === 0)
            outputHTML += `data-tt-parent-id='${this.parentId}'`;

        const rowClasses = this.rowClassList();
        if (rowClasses.length) outputHTML += ` class='${rowClasses.join(' ')}'`;
        if (this.isTopic()) outputHTML += ` data-tt-branch='true'`;

        const titleClasses = this.titleSpanClassList().join(' ');
	    
        outputHTML += `><td class='left'><span class='${titleClasses}'>${this.displayTitle()}</span></td>`;
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
        let keywordText = (this._keyword) ? `<span class='keyword ${this._keyword}'>${this._keyword} </span>` : ""; // TODO etc

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

    isTrash() {
        // is this node the trash node?
        return (this.title == "🗑️ TRASH");
    }

    trash() {
        // move this node to the trash
        if (this.isTrash()) return;
        this.trashed = true;
        const displayNode = this.getDisplayNode();
        $(displayNode).addClass('trashed');                  // add class to display node
        // iterate on child nodes
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            node && node.trash();
        });
    }

    untrash() {
        // opposite of trash fn above, set node and descendants to not trashed
        if (this.isTrash()) return;
        this.trashed = false;
        const displayNode = this.getDisplayNode();
        $(displayNode).removeClass('trashed');                  // add class to display node
        // iterate on child nodes
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            node && node.untrash();
        });
    }

    isBookmarksBar() {
        // is this node the bookmarks bar node?
        return (this.title == "🔖 BOOKMARKS BAR");
    }
    isOnBookmarksBar() {
        // is this node on the bookmarks bar?
        return (this.isBookmarksBar() || (this.parentId && AllNodes[this.parentId]?.isOnBookmarksBar()));
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
        
        // For top-level app nodes, we need to insert after session nodes
        if (this.level == 1 && !this.isSessionNode) {
            // Find the last displayed session node by looking at actual DOM order
            let lastSessionRow = null;
            $("#content tr").each(function() {
                const nodeId = $(this).attr('data-tt-id');
                const node = AllNodes[nodeId];
                if (node && node.isSessionNode) {
                    lastSessionRow = this;
                }
            });
            
            if (lastSessionRow) {
                // Insert after the last session node found in the table
                $(this.HTML()).insertAfter(lastSessionRow);
                const tree = $("table.treetable").data("treetable");
                tree.loadRows($(this.getDisplayNode()));
                return this.getTTNode();
            }
            // Fallback: if no session nodes, use atTop=true
            $("table.treetable").treetable("loadBranch", null, this.HTML(), true);
            return this.getTTNode();
        }
        
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
        if (this.isTopic() && this.childIds.length) $(dn).removeClass('emptyTopic');
        if (this.isTopic() && !this.childIds.length) $(dn).addClass('emptyTopic');
        show && this.showForSearch();				  // reclose if needed
    }

    setTGColor(color = null) {
        // set color to sync w Tabgroup color
        const displayNode = this.getDisplayNode();
        if (!displayNode) return;
        this.tgColor = color;                      // remember color thru a refresh
        const colorClass = color ? 'tg'+color : null;
        const titleSelector = this.isTopic() ? ".btTitle" : ".btTitle span.btTitleText";
        const row = $(displayNode);

        const colorClasses = ['tggrey', 'tgblue', 'tgred', 'tgyellow', 'tggreen', 'tgpink',
             'tgpurple', 'tgcyan', 'tgorange'];

        row.removeClass(colorClasses.concat('tabgroup'));
        $(displayNode).find(titleSelector).removeClass(colorClasses.concat('tabgroup'));

        if (color) {
            row.addClass(['tabgroup', colorClass]);
            $(displayNode).find(titleSelector).addClass(['tabgroup', colorClass]);
        }

        // iterate to contained nodes
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (node.tabId) node.setTGColor(color);
        });
    }

    static getFaviconDB;
    static getAliasDB;
    static _aliasesLoaded = false;                // one-time hydration flag
    static _aliasesLoadPromise = null;            // in-flight loader promise (dedupe concurrent calls)
    static {
        BTAppNode.getFaviconDB = localStorageManager.getDB('faviconDB');
        BTAppNode.getAliasDB = localStorageManager.getDB('aliasDB');
    }
    static async _loadAliasesOnce() {
        // First-time read of the alias DB: populate each node's aliases Set with all alias URLs
        if (BTAppNode._aliasesLoaded) return;
        if (BTAppNode._aliasesLoadPromise) return BTAppNode._aliasesLoadPromise;

        // Build a map from canonical node URL -> array of nodes for quick lookup
        const urlToNodes = new Map();
        AllNodes.forEach(n => {
            if (!n || !n.URL) return;
            const arr = urlToNodes.get(n.URL) || [];
            arr.push(n);
            urlToNodes.set(n.URL, arr);
        });

        BTAppNode._aliasesLoadPromise = new Promise((resolve) => {
            try {
                // Use a read-only transaction and iterate the entire store via a cursor
                BTAppNode.getAliasDB('readonly', (store) => {
                    const request = store.openCursor();
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            const aliasURL = cursor.key;
                            const nodeURL = cursor.value;
                            const nodes = urlToNodes.get(nodeURL);
                            if (nodes && nodes.length) {
                                nodes.forEach(node => node.aliases.add(aliasURL));
                            }
                            cursor.continue();
                        } else {
                            // finished
                            BTAppNode._aliasesLoaded = true;
                            resolve();
                        }
                    };
                    request.onerror = () => {
                        console.warn('Error iterating aliasDB');
                        BTAppNode._aliasesLoaded = true;   // avoid retry storms; can be reset if needed
                        resolve();
                    };
                });
            } catch (e) {
                console.warn(`Error loading alias DB: ${e}`);
                BTAppNode._aliasesLoaded = true;
                resolve();
            }
        });

        return BTAppNode._aliasesLoadPromise;
    }
    storeAlias(aliasURL) {
        // store an alias to this nodes actual saved url. Used with sticky navigation
        try {
            // Update in-memory set first
            this.aliases.add(aliasURL);
            // Persist mapping aliasURL -> node URL in alias DB
            localStorageManager.set(aliasURL, this.URL, BTAppNode.getAliasDB);
        }
        catch (e) {
            console.warn(`Error storing alias: ${e}`);
        }
    }
    static async findFromAlias(url, { isSession = false } = {}) {
        // find the node, if any, for which this url is an alias for the actual url
        try {
            // On first use, hydrate alias Sets for all nodes from the DB
            await BTAppNode._loadAliasesOnce();
            // Fast in-memory lookup thereafter
            return AllNodes.find(n => n && n.aliases && n.aliases.has(url) && (!!n.isSessionNode === isSession));
        }
        catch (e) {
            console.warn(`Error finding alias: ${e}`);
        }
    }
    storeFavicon() {
        // store favicon in browser local storage
        try {
            const host = this.URL.split(/[?#]/)[0];              // strip off any query or hash
            localStorageManager.set(host, this.faviconUrl, BTAppNode.getFaviconDB);
        }
        catch (e) {
            console.warn(`Error storing favicon: ${e}`);
        }
    }

    async populateFavicon() {
        // add favicon icon either from local storage or goog
        if (this.isTopic() || !this.URL) return;
        const host = this.URL.split(/[?#]/)[0];
        const favClass = (getProp('BTFavicons') == 'OFF') ? 'faviconOff' : 'faviconOn';
        const favUrl =
              this.faviconUrl ||
              await localStorageManager.get(host, BTAppNode.getFaviconDB) ||
              `https://www.google.com/s2/favicons?domain=${host}`;
        this.faviconUrl = favUrl;
        const dn = this.getDisplayNode();
        $(dn).find(`.${favClass}`).remove();                     // remove any previous set icon
        const fav = $(`<img src="${favUrl}" loading="lazy" class="${favClass}" alt="favicon">`);

        fav.on('error', function() {
            this.src = 'resources/help.png';                    // if no favicon found, use ? from help icon
            this.width = this.height = 16;
        });
        let iconTarget = $(dn).find('.btlink').first();
        if (!iconTarget.length) iconTarget = $(dn).find('.btTitle span.btTitleText').first();
        if (!iconTarget.length) return;
        iconTarget.prepend(fav);
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
        // nb show/unshow are also called to show/unshow the active tab in the tree
	    const disp = this.getDisplayNode();
	    if(disp && !$(disp).is(':visible')) {
	        if (this.parentId) AllNodes[this.parentId].showForSearch();    // btnode show
	        $(disp).show();                                                // jquery node show
	        this.shownForSearch = true;
	    } 
    }

    unshowForSearch() {
	    // if this node was shown as a search result, now unshow it to get tree back to where it was.
	    if (this.shownForSearch) {
	        const disp = this.getDisplayNode();
	        if (this.parentId) AllNodes[this.parentId].unshowForSearch();
            this.redisplay();                                       // reset any search horiz scrolling
	        $(disp).hide();
	        this.shownForSearch = false;
	    }
    }
    
    static escapeRegExp(string) {
        // stolen from https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    search(sstr, filteringOn = false) {
	    // search node for regex of /sstr/ig. update its display to show a hit (title or text)

	    const reg = new RegExp(BTAppNode.escapeRegExp(sstr), 'ig');
	    let match = false;
	    let titleStr;
	    const node = this.getDisplayNode();

        // if filtering is in use only search nodes with visible-by-filter attribute
        if (filteringOn && !$(node).hasClass('visible-by-filter')) return false;
        
        if (this.keyword && reg.test(this.keyword)) {
            titleStr = `<span class='highlight tabgroup'>${this.keyword}</span> ${this.displayTopic}`;
	        $(node).find("span.btTitleText").html(titleStr);
            match = true;
        } else if (reg.test(this.displayTopic)) {
            const keywordText = (this.keyword) ? `<span class='keyword'>${this._keyword} </span>` : ""; // TODO etc
	        titleStr = this.displayTopic.replaceAll(reg, `<span class='highlight tabgroup'>${sstr}</span>`);
	        $(node).find("span.btTitleText").html(keywordText + titleStr);
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
            BTAppNode.displayNotesForSearch();                                 // match might be hidden if single column
	        match = true;
	    }
	    if (match)
	        $(node).find("td").addClass('search');
	    
	    return match;	
    }

    static searchNodesToRedisplay = new Set();
    extendedSearch(sstr, forceVisible = false) {
	    // search node for regex of /sstr/ig. update its display to show a hit (title or text)

	    const reg = new RegExp(BTAppNode.escapeRegExp(sstr), 'ig');
	    let lmatch, rmatch;
	    const node = this.getDisplayNode();
        if (!forceVisible && !$(node).is(":visible")) return;                 // return if not displayed
        
	    let titleStr;
	    // Look for match in title/topic, url and note
	    if (reg.test(this.displayTopic)) {
            const keywordText = (this.keyword) ? `<span class='keyword'>${this._keyword} </span>` : ""; // TODO etc
	        titleStr = this.displayTopic.replaceAll(reg, `<span class='extendedHighlight'>${sstr}</span>`);
	        $(node).find("span.btTitleText").html(keywordText + titleStr);
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
        let firstNodeId = null;
        $("#content tr").each((i, node) => {
            const nodeId = $(node).attr('data-tt-id');
            if (i === 0) firstNodeId = nodeId;  // capture the actual first displayed node
            BTAppNode.displayOrder[nodeId] = {
                prev: prevNodeId,
                next: null
            };
            prevNodeId && (BTAppNode.displayOrder[prevNodeId].next = nodeId);
            prevNodeId = nodeId;
        });

        // set prev of first node to last and next of last node to first to iterate around
        if (firstNodeId && prevNodeId) {
            BTAppNode.displayOrder[firstNodeId].prev = prevNodeId;
            BTAppNode.displayOrder[prevNodeId].next = firstNodeId;
        }
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
            sendMessage(
                {'function' : 'showNode', 'tabId': this.tabId});
        else if (this.tabGroupId)
            sendMessage(
                {'function' : 'showNode', 'tabGroupId': this.tabGroupId});
        else if (this.windowId)
            sendMessage(
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
        incrementStat('BTNumTabOperations');

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
        if (parent?.hasOpenChildren() && ((getProp('BTGroupingMode') || 'TABGROUP') == 'TABGROUP')) newWin = false;       // only allow opening in new window if not already in an open TG, or not using TGs
    
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
        incrementStat('BTNumTabOperations');

        // if we don't care about grouping just open each tab
        if ((getProp('BTGroupingMode') || 'TABGROUP') == 'NONE' || this.isTrash()) {
            const tabsToOpen = this.listOpenableTabs();              // [{nodeId, url}..}
            sendMessage({'function': 'openTabs', 'tabs': tabsToOpen, 'newWin': newWin});
        }
        else {                      // need to open all urls in single (possibly new) window
            const tabGroupsToOpen = this.listOpenableTabGroups();    // [{tg, [{id, url}]},..]
            sendMessage({'function': 'openTabGroups', 'tabGroups': tabGroupsToOpen,
                                'newWin': newWin});
        }
    }

    async groupAndPosition(left = 0) {
        // Topic node fn to (re)group open tabs and put them in correct order
        // If caller has required info it can tell us the index of leftmost tab.

        if (!this.isTopic() || ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP') || this.trashed) return;
        let tabInfo = [];
        const myWin = this.windowId;
        const myTG = this.tabGroupId;
        let newLeft = Number.MAX_SAFE_INTEGER;
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (!node.tabId) return;
            this.tabGroupId = myTG || node.tabGroupId;          // tab might be moved to new TG/win
            this.windowId = myWin || node.windowId;
            newLeft = Math.min(node?.expectedTabIndex(), newLeft);
            const index = node?.expectedTabIndex() || 0;
            tabInfo.push({'nodeId': id, 'tabId': node.tabId, 'tabIndex': index});
        });
        const result = await callBackground(
            {'function': 'groupAndPositionTabs', 'tabGroupId': this.tabGroupId,
            'windowId': this.windowId, 'tabInfo': tabInfo,
            'groupName': this.topicName(), 'topicId': this.id,
            'leftmostTabIndex': left || newLeft } );
        console.log(`groupAndPositionTabs for ${this.topicName()} returned ${JSON.stringify(result.message)}`);

        // Update the tab indices in AllNodes based on the returned array of tabIds and their window indices
        if (Array.isArray(result.message)) {
            result.message.forEach(entry => {
                const node = BTAppNode.findFromTab(entry.id);
                node && (node.tabIndex = entry.tabIndex);
            });
        }
    }
    
    putInGroup() {
        // wrap this one nodes tab in a group
        if (!this.tabId || !this.windowId || ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP') || this.trashed) return;
        const groupName = this.isTopic() ? this.topicName() : AllNodes[this.parentId]?.topicName();
        const groupId = this.isTopic() ? this.id : AllNodes[this.parentId]?.id;
        const tgId = this.tabGroupId || AllNodes[this.parentId]?.tabGroupId;
        callBackground({'function': 'groupAndPositionTabs', 'tabGroupId': tgId,
                            'windowId': this.windowId, 'tabInfo': [{'nodeId': this.id, 'tabId': this.tabId, 'tabIndex': this.tabIndex}],
                            'groupName': groupName, 'topicId': groupId,});
    }
    
    closeTab() {
        // Close tabs associated w this node
        if (this.tabId)
            sendMessage({'function': 'closeTab', 'tabId': this.tabId});
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            node.closeTab();
        });
    }

    async updateTabGroup() {
        // set TG in browser to appropriate name/folded state. browserUpdate is set when expand/collapse came from browser
        let rsp;
        if (this.tabGroupId && this.isTopic() && !Window.BrainTool.browserUpdate)
            rsp = await callBackground({'function': 'updateGroup', 'tabGroupId': this.tabGroupId,
                                  'collapsed': this.folded, 'title': this.topicName()});
        if (rsp?.status == 'error') this.tabGroupId = 0; // if error, reset tabGroupId
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
            sendMessage({
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
        if ((this.childIds.length || (this.level == 1)) && this.folded && (!this.drawers || !this.drawers.PROPERTIES))
            //need to add in the PROPERTIES drawer if we need to store the nodes folded state. only care about top items if childless
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
        if (this.isSessionNode) return "";
        let outputOrg = this.orgText();
        if (this.isTrash() || this.isBookmarksBar()) return outputOrg;       // don't save these
        this.childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            if (AllNodes[id].isSessionNode) return;
            let txt = AllNodes[id].orgTextwChildren();
            outputOrg += txt.length ? "\n" + txt : "";        // eg BTLinkNodes might not have text 
        });
        return outputOrg;
    }

    static generateOrgFile() {
        // iterate thru nodes to do the work
        let orgText = metaPropertiesToString();
        
        // find and order the top level nodes according to table position
        const topNodes = AllNodes.filter(node => node && (node.parentId == null) && !node.isSessionNode);
        topNodes.sort(function(a,b) {
            const eltA = $(`tr[data-tt-id='${a.id}']`)[0];
            const eltB = $(`tr[data-tt-id='${b.id}']`)[0];
            const posA = eltA ? eltA.rowIndex : Number.MAX_SAFE_INTEGER;
            const posB = eltB ? eltB.rowIndex : Number.MAX_SAFE_INTEGER;
            return (posA - posB);
        });
        
        // iterate on top level nodes, generate text and recurse
        topNodes.forEach(function (node) {
            if (node.isSessionNode) return;
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
    
    static displayNotesForSearch() {
        // when searching the hit might be in the hidden notes column. check for td.right and show if needed
        if ($("td.right").css("display") == "none") {
            $("td.right").css("display", "table-cell");
            $("td.left").css("width", "50%");
            $("td.right").css("width", "50%");
        }
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
        // Important: syncs browser tabs is DnD was on topic manager (ie browserAction)

        if (!newP || !AllNodes[newP]) {
            console.log(`BTNode.handleNodeMove: No parent ${newP} for node ${this}. Top level node?`);
        }
        const oldP = this.parentId;
        const oldParent = AllNodes[oldP];
        const newParent = newP ? AllNodes[newP] : null;
        const origIndex = this.tabIndex || Number.MAX_SAFE_INTEGER;

        // update display class if needed, old Parent might now be empty, new parent is not
        if (oldParent?.childIds?.length == 1)
            $(`tr[data-tt-id='${oldP}']`).addClass('emptyTopic');
        newP && $(`tr[data-tt-id='${newP}']`).removeClass('emptyTopic');

        // move the node in parental child arrays
        this.reparentNode(newP, index);
        
        // Update nesting level as needed (== org *** nesting)
        const newLevel = newParent ? newParent.level + 1 : 1;
        if (this.level != newLevel)
            this.resetLevel(newLevel);

        // if node has open tab we might need to update its tab group/position
        // NB Can't left align w dragged tab, need to left align w its new tg, *but* if its left whole tg will slide left by one
        if (this.tabId) {
            const newPleftmost = newParent.leftmostOpenTabIndex();
            const newLeft = (origIndex < newPleftmost) ? newPleftmost - 1 : newPleftmost;
            if (newP != oldP) this.tabGroupId = newParent.tabGroupId;
            if (!browserAction && !newParent.isTrash()) {
                if (newParent.tabGroupId) {
                    newParent.groupAndPosition(newLeft);
                    newParent.tgColor && this.setTGColor(newParent.tgColor); // inherit color from new parent
                } else if (!this.isSessionNode) {
                    this.putInGroup();
                }
            }
            // update old P's display node to remove open tg styling
            if (!oldParent?.hasOpenChildren()) {
                $("tr[data-tt-id='"+oldP+"']").removeClass("opened");
                oldParent.setTGColor(null);
                // oldParent.tabGroupId = null;     // breaks when tg dragged out of window
            }
        }
    }
    
    tabIndexInParent() {
        // Used for tab ordering, only counts open, tabbed, nodes
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
        return parent.leftmostOpenTabIndex() + this.tabIndexInParent();
    }

    static generateTopics() {
        // Iterate thru nodes and generate array of topics and their nesting

        function topicsForNode(id) {
            // recurse over children
            if (!AllNodes[id] || AllNodes[id].isSessionNode) return;
            if (AllNodes[id].isTrash()) return;                  // don't include trash
            if (AllNodes[id].isTopic())
                Topics.push({'name' : AllNodes[id].topicPath, 'level' : AllNodes[id].level});
            for (const nid of AllNodes[id].childIds)
                topicsForNode(nid);
        }
        
        // first make sure each node has a unique topicPath
        BTNode.generateUniqueTopicPaths();
        Topics.length = 0;                                               // clear array
        $("#content tr").each(function() {
            const id = $(this).attr('data-tt-id');
            if (AllNodes[id]?.parentId == null && !AllNodes[id]?.isSessionNode)
                topicsForNode(id);
        });
        
        // Update extension with new topics
        sendMessage({'function': 'localStore', 'data': {'topics': Topics }});
    }
    
    static findFromTab(tabId, { isSession = false } = {}) {
        // Return node associated w display tab
        return AllNodes.find(node => node && (node.tabId == tabId) && (!!node.isSessionNode === isSession));
    }
    static findFromBookmark(bookmarkId, { isSession = false } = {}) {
        // Return node associated w display tab
        return AllNodes.find(node => node && (node.bookmarkId == bookmarkId) && (!!node.isSessionNode === isSession));
    }
    
    sisterNodes() {
        // Return list of nodes with the same tabId or tabGroupId (e.g., appNode and corresponding sessionNode)
        // For tab nodes: find by tabId
        // For topic/group nodes: find by tabGroupId
        if (this.isTopic()) {
            // Topic/Group nodes: match by tabGroupId
            if (!this.tabGroupId) return [];
            const sisterNode = this.isSessionNode 
                ? BTAppNode.findFromGroup(this.tabGroupId, { isSession: false })
                : BTAppNode.findFromGroup(this.tabGroupId, { isSession: true });
            return sisterNode ? [sisterNode] : [];
        } else {
            // Tab nodes: match by tabId
            if (!this.tabId) return [];
            return AllNodes.filter(node => 
                node && 
                node.id !== this.id && 
                node.tabId === this.tabId
            );
        }
    }
    
    static findFromURLTGWin(url, tg, win, { isSession = false } = {}) {
        // find node from url/TG/Window combo.
        // #1 is there a unique BT node w url
        // #2 if the url is saved under several (eg same-named) topics, prefer one already open
        // #3 is there a matching url in same TG or window as new tab
        const urlNodes = AllNodes.filter(node => node && (!!node.isSessionNode === isSession) && BTNode.compareURLs(node.URL, url));
        if (urlNodes.length == 0) return null;
        if (urlNodes.length == 1) return urlNodes[0];

        // When the same url lives under multiple topics, prefer the one(s) whose topic already
        // has an open tab so a nav/open joins the active topic instead of an arbitrary duplicate
        // (bug 5804). If none are open, fall through to the original TG/window/first logic unchanged.
        const openNodes = urlNodes.filter(node => AllNodes[node.parentId]?.hasOpenChildren());
        const candidates = openNodes.length ? openNodes : urlNodes;

        for (const node of candidates) {
            let parentId = node.parentId;
            if (parentId && AllNodes[parentId] && AllNodes[parentId].tabGroupId == tg)
                return node;
        }
        for (const node of candidates) {
            let parentId = node.parentId;
            if (parentId && AllNodes[parentId] && AllNodes[parentId].windowId == win)
                return node;
        }
        return candidates[0];                                   // else just use first (open one if any)
    }

    static findFromWindow(winId, { isSession = false } = {}) {
        // find WINDOW node from windowId
        if (isSession) {
            // For session nodes, must be a WINDOW type node with this windowId
            return AllNodes.find(node => 
                node && 
                node.isSessionNode && 
                node.sessionType === 'WINDOW' && 
                node.windowId == winId
            );
        } else {
            // For app nodes, find topic with this windowId
            return AllNodes.find(node => 
                node && 
                !node.isSessionNode && 
                node.isTopic() && 
                node.windowId == winId
            );
        }
    }
    
    static findFromGroup(groupId, { isSession = false } = {}) {
        // find topic from tab group
    return AllNodes.find(node => node && (!!node.isSessionNode === isSession) && node.isTopic() && node.tabGroupId == groupId);
    }
    
    static findOrCreateFromTopicDN(topicDN) {
        // Walk down tree of topics from top, finding or creating nodes & tt display nodes
        let components = topicDN.match(/.*?:/g);
        if (components) components = components.map(c => c.slice(0, -1));          // remove :
        const topic = topicDN.match(/:/) ? topicDN.match(/.*:(.*?$)/)[1] : topicDN;
        const topTopic = (components && components.length) ? components[0] : topic;

        // Find or create top node
        let topNode = AllNodes.find(node => node && !node.isSessionNode && (node.topicName() == topTopic) && (node.isTopic()));
        let newTopNodeId;
        if (!topNode) {
            topNode = new BTAppNode(topTopic, null, "", 1);
            topNode.createDisplayNode();
            newTopNodeId = topNode.id;
        }
            
        if (!components) {
            topNode.newTopNodeId = newTopNodeId
            return topNode;
        }
        
        // Remove, now handled first elt, Walk down rest creating as needed
        let currentNode = topNode;
        components.shift();
        components.forEach((t) => {
            let node = currentNode;
            currentNode = currentNode.findTopicChild(t);
            if (!currentNode) {
                currentNode = new BTAppNode(t, node.id, "", node.level + 1);
                currentNode.createDisplayNode();
                newTopNodeId = newTopNodeId || currentNode.id;
            }
        });

        // finally find or create the leaf node
        if (currentNode.findTopicChild(topic))
            return currentNode.findTopicChild(topic);
        let newLeaf = new BTAppNode(topic, currentNode.id, "", currentNode.level + 1);
        newTopNodeId = newTopNodeId || newLeaf.id;
        newLeaf.createDisplayNode();
        topNode.redisplay();                              // since new nodes created
        newLeaf.newTopNodeId = newTopNodeId;
        return newLeaf;
    }

    static findOrCreateTrashNode() {
        // Find or create the trash node
        let trashNode = AllNodes.find(node => node && (node.isTrash()));
        if (!trashNode) {
            trashNode = new BTAppNode("🗑️ TRASH", null, "Deleted items. The Delete button empties this Topic.", 1);
            trashNode.createDisplayNode();
            trashNode.redisplay();
        }
        return trashNode;
    }
    static findOrCreateBookmarksBarNode() {
        // Find or create the bookmarks bar node
        let bookmarksBarNode = AllNodes.find(node => node && (node.isBookmarksBar()));
        if (!bookmarksBarNode) {
            bookmarksBarNode = new BTAppNode("🔖 BOOKMARKS BAR", null, "Synced to your browser bookmarks bar contents.", 1);
            bookmarksBarNode.createDisplayNode();
            bookmarksBarNode.redisplay();            
            $("table.treetable").treetable("collapseNode", bookmarksBarNode.id);            // start closed
        }
        return bookmarksBarNode;
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

// Note: sendMessage() is now defined in extensionMessaging.js
// This avoids circular dependencies across multiple files

export { BTAppNode, BTLinkNode, Topics };
