/***
 *
 *  Base model for a BrainTool node. Keeps track of containment and relationships
 *  Tree creation functions
 *
 ***/

'use strict'

class BTNode {
    constructor(title, parentId = null) {
        this._id = BTNode.topIndex++;
        this._title = title;
        this._parentId = parentId;
        this._URL = BTNode.URLFromTitle(title);
	    this._displayTag = BTNode.displayTagFromTitle(title);
        this._childIds = [];
        this._tagPath = '';
        this.generateUniqueTagPath();
        if (parentId && AllNodes[parentId]) {
            AllNodes[parentId].addChild(this._id, -1, this._URL != "");
        }
        // Global instance store. Check existence so staticBase, below, works.
        // NB Entries could be overwritten by derived class ctor:
        if (typeof AllNodes !== 'undefined') AllNodes[this._id] = this;    
    }

    get id() {
        return this._id;
    }
    
    set title(ttl) {
        this._title = ttl;
        this._URL = BTNode.URLFromTitle(ttl);         // regenerate URL when title is changed
	    this._displayTag = BTNode.displayTagFromTitle(ttl);
    }
    get title() {
        return this._title;
    }
    get URL() {
        return this._URL;
    }
    set URL(url) {
        this._URL = url;
    }
    get displayTag() {
	    return this._displayTag;
    }
    get tagPath() {
        return this._tagPath;
    }

    set parentId(i) {
        this._parentId = i;
    }
    get parentId() {
        return this._parentId;
    }

    get childIds() {
        return this._childIds;
    }
    addChild(id, index = -1, isURL = false) {
        if (index < 0) {
            if (isURL)          // add to front
                this._childIds.unshift(parseInt(id));
            else
                this._childIds.push(parseInt(id));
        }
        else
            this._childIds.splice(index, 0, parseInt(id));
    }
    removeChild(id) {
	let index = this._childIds.indexOf(parseInt(id));
        if (index > -1)
            this._childIds.splice(index, 1);
    }

    // only used in isTag
    _hasWebLinks() {
	// Calculate on demand since it may change based on node creation/deletion
	if (this.URL) return true;
	return this.childIds.some(id => AllNodes[id]._hasWebLinks);
    }

    isTag() {
        // Is this node used as a tag => has webLinked children
        return (this.level == 1) || (!this.URL) || this.childIds.some(id => AllNodes[id]._hasWebLinks);
    }
    
    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order
        
        const oldP = this.parentId;
        if (oldP)
            AllNodes[oldP].removeChild(this.id);
        this.parentId = newP;
        if (newP)
            AllNodes[newP].addChild(this.id, index);
    }
    
    static URLFromTitle(title) {
        // pull url from title string (which is in org format: "asdf [[url][label]] ...")
        // nb find http(s), file:/// and chrome: urls

        const regexStr = "\\[\\[(http.*?|chrome.*?|file.*?)\\]\\[(.*?)\\]\\]";      // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        const hits  = reg.exec(title);
        return hits ? hits[1] : "";        
    }

    static displayTagFromTitle(title) {
        // Visible tag for this node. Pull tags out, use url if no tag
        let outputStr = title.replace(/\[\[(.*?)\]\[(.*?)\]\]/gm, (match, $1, $2) =>
				      {return $2 || $1;});
        return outputStr;
    }


    static compareURLs(first, second) {
        // sometimes I get trailing /'s other times not, also treat http and https as the same,
        // also google docs immediately redirect to the exact same url but w /u/1/d instead of /d
        // also navigation within window via # anchors is ok
        // also maybe ?var= arguments are ok? Not on many sites (eg hn) where there's a ?page=123.
        //              => .replace(/\?.*$/, "")
        // also if its a gmail url need to match exactly

        if (first.indexOf("mail.google.com/mail") >= 0) {
            return (first == second);
        } else {        
            first = first.replace("https", "http").replace(/\/u\/1\/d/, "/d").replace(/\/www\./, "/").replace(/#.*$/, "").replace(/\/$/, "");
            second = second.replace("https", "http").replace(/\/u\/1\/d/, "/d").replace(/\/www\./, "/").replace(/#.*$/, "").replace(/\/$/, "");
            return (first == second);
        }
    }

    static findFromTitle(title) {
        return AllNodes.find(node => (node && (node.title == title)));
    }

    static findFromTagPath(tagPath) {
        // NB currently only handles parent:child, not more levels, will return first found match
        const components = BTNode.processTagString(tagPath);
        const tag = components[0];
        const parent = components[1];
        if (!parent)
            return AllNodes.find(node => node && node.displayTag == tag);
        const potentialMatches = AllNodes.filter(node => node.displayTag == tag);
        return potentialMatches.find(node => node.parentId && AllNodes[node.parentId].displayTag == parent);
    }
    
    static topIndex = 1;    // track the index of the next node to create, static class variable.
    
    static processTagString(tag) {
        // Tag string passed from popup can be: tag, tag:TODO, parent:tag or parent:tag:TODO
        // return array[tag, parent, TODO, tagpath]

        tag = tag.trim();
        let match = tag.match(/(.*):(.*):TODO/);
        if (match)                                // parent:tag:TODO form
            return [match[2], match[1], "TODO", match[1]+':'+match[2]];
        match = tag.match(/(.*):TODO/);
        if (match)                                // tag:TODO form
            return [match[1], null, "TODO", match[1]];
        match = tag.match(/(.*):(.*)/);
        if (match)                                // parent:tag form
            return [match[2], match[1], null, match[1]+':'+match[2]];
        
        return [tag, null, null, tag];
    }

    static undoStack = [];
    static deleteNode(nodeId) {
        // Cleanly delete this node
        BTNode.undoStack = [];                     // only one level of undo, so clear each time

        function _deleteNode(nodeId) {
            const node = AllNodes[nodeId];
            if (!node) return;

            // recurse to delete children if any
            [...node.childIds].forEach(_deleteNode);
            
            // Remove from parent
            const parent = AllNodes[node.parentId];
            if (parent)
                parent.removeChild(nodeId);

            BTNode.undoStack.push(node);
            delete(AllNodes[nodeId]);
        }
        _deleteNode(nodeId);
    }

    static undoDelete() {
        // read back in the undo list
        if (!BTNode.undoStack.length) return;
        let node, topNode = BTNode.undoStack[BTNode.undoStack.length -1];
        while (BTNode.undoStack.length) {
            node = BTNode.undoStack.pop();
            AllNodes[node.id] = node;
            if (node.parentId && AllNodes[node.parentId])
                AllNodes[node.parentId].addChild(node.id);
        }
        return topNode;
    }
            
    fullTagPath() {
        // distinguished name for this node
        const myTag = this.isTag() ? this.displayTag : '';
        if (this.parentId && AllNodes[this.parentId])
            return AllNodes[this.parentId].fullTagPath() + ':' + myTag;
        else
            return myTag;        
    }
    
    generateUniqueTagPath() {
        // same tag can be under multiple parents, generate a unique tagPath

        if (!this.isTag()) {
            if (this.parentId && AllNodes[this.parentId])
                this._tagPath = AllNodes[this.parentId].tagPath;
            else
                this._tagPath = this._displayTag;
            return;
        }
                
        if (this.displayTag == "") {
            this._tagPath = this._displayTag;
            return;
        }
        const sameTag = AllNodes.filter(nn => nn && nn.isTag() && nn.displayTag == this.displayTag);
        if (sameTag.length == 1) {
            // unique
            this._tagPath = this._displayTag;
            return;
        }
        sameTag.forEach(function(nn) {
            const parentTag = AllNodes[nn.parentId] ? AllNodes[nn.parentId].displayTag : "";
            nn._tagPath = parentTag + ":" + nn.displayTag;
        });
    }
        
    static generateUniqueTagPaths() {
        // same tag can be under multiple parents, generate a unique tagPath for each node
        AllNodes.forEach(function(n) {
            if (!n) return;
            n.generateUniqueTagPath();
        });
    }


            
}
