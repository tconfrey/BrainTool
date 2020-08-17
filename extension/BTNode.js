class BTNode {
    constructor(title, parentId = null) {
        this._id = BTNode.topIndex++;
        this._title = title;
        this._parentId = parentId;
        this._URL = BTNode.URLFromTitle(title);
	    this._displayTag = BTNode.displayTagFromTitle(title);
        this._childIds = [];
        this._isOpen = false;
        if (parentId && AllNodes[parentId]) {
            AllNodes[parentId].addChild(this._id);
        }
        // Global instance store. Check existence so staticBase, below, works.
        // NB Entries could be overwritten by derived class ctor:
        if (typeof AllNodes !== 'undefined') AllNodes[this._id] = this;    
    }
    static baseNode = new BTNode('');

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
    get displayTag() {
	    return this._displayTag;
    }

    set parentId(i) {
        this._parentId = i;
    }
    get parentId() {
        return this._parentId;
    }

    set isOpen(val) {
        // Track whether node is open (highlighted in tree and w an existing tab
        this._isOpen = val;
    }
    get isOpen() {
        return this._isOpen;
    }

    get hasWebLinks() {
	    // Calculate on demand since it may change based on node creation/deletion
	    if (this.URL) return true;
	    return this.childIds.some(id => AllNodes[id].hasWebLinks);
    }

    get childIds() {
        return this._childIds;
    }
    addChild(id, index = -1) {
        if (index < 0)
            this._childIds.push(parseInt(id));
        else
            this._childIds.splice(index, 0, parseInt(id));
    }
    removeChild(id) {
        let index = this._childIds.indexOf(parseInt(id));
        if (index > -1)
            this._childIds.splice(index, 1);
    }
    allDescendents() {
        // return an array of all children and all their children etc
        let ids = [this._id];
        this.childIds.forEach(function (id) {
            ids.push(AllNodes[id].allDescendents());
        });
        return ids.flat(Infinity);
    }

    isTag() {
        // Is this node used as a tag => has webLinked children
        return this.childIds.some(id => AllNodes[id].hasWebLinks);
    }

    toBTNode() {
        // Generic fn to return this objects properties
        let props = {};
        let keys = Object.keys(BTNode.baseNode);
        for (let i =0; i< keys.length; i++){
            props[keys[i]] = this[keys[i]];
        }
        return props;
    }
    
    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order
        
        const oldP = this.parentId;
        if (oldP)
            AllNodes[oldP].removeChild(this.id);
        this.parentId = newP;
        AllNodes[newP].addChild(this.id, index);
    }
    
    static URLFromTitle(title) {
        // pull url from title string (which is in org format: "asdf [[url][label]] ...")
        // nb only find http urls, purposely ignore file: links
        const regexStr = "\\[\\[(http.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
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


    static findFromTitle(title) {
        var n = AllNodes.length ? AllNodes.find(function(node) {
            return (node && (node.title == title));}) : null;
        return n ? n.id : null;
    }

    static reset() {
        // Called when reloading nodes etc
        AllNodes = [];
        BTNode.topIndex = 1;
    }
    
    static topIndex = 1;    // track the index of the next node to create, static class variable.

    
    static processTagString(tag) {
        // Tag string passed from popup can be: tag, tag:TODO, parent:tag or parent:tag:TODO
        // return array[tag, parent, TODO]
        tag = tag.trim();
        let match = tag.match(/(.*):(.*):TODO/);
        if (match)                                // parent:tag:TODO form
            return [match[2], match[1], "TODO"];
        match = tag.match(/(.*):TODO/);
        if (match)                                // tag:TODO form
            return [match[1], null, "TODO"];
        match = tag.match(/(.*):(.*)/);
        if (match)                                // parent:tag form
            return [match[2], match[1], null];
        
        return [tag, null, null];
    }

    static deleteNode(nodeId) {
        // Cleanly delete this node

        const node = AllNodes[nodeId];
        if (!node) return;

        // recurse to delete children if any
        const children = [...node.childIds];
        children.forEach(BTNode.deleteNode);
        
        // Remove from parent
        const parent = AllNodes[node.parentId];
        if (parent)
            parent.removeChild(nodeId);

        delete(AllNodes[nodeId]);
    
    }
}

class BTChromeNode extends BTNode {
    // Node as seen by the extension. Knows about tabs and window ids

    constructor(title = '', parentId = null, btobj = null) {
	    // Trivial ctor and 'assign' allow us to clone the base node created on the app side
        // while adding new ChromeNode behavior.
	    super(title, parentId);
        if (btobj)
            Object.assign(this, btobj);
        this._tabId = null;
        this._windowId = null;
        AllNodes[this._id] = this;
    }

    get tabId() {
	    return this._tabId;
    }
    set tabId(id) {
	    this._tabId = id;
    }

    get windowId() {
	    return this._windowId;
    }
    set windowId(id) {
	    this._windowId = id;
    }
    
    managedTabs(){
        // return an array of open tab ids for this node and its descendants
        let nids = this.allDescendents();
        nids = nids.filter(nid => AllNodes[nid].tabId).map(nid => AllNodes[nid].tabId);
        return nids;
    }
    
    static findFromTab(tabId) {
        // Return node associated w display tab
        var n = AllNodes ?
            AllNodes.find(function(node) {
                return (node && (node.tabId == tabId));})
            :
            null;
        return n;
    }
    
    static findFromWin(winId) {
        // Return node associated w display tab
        var n = AllNodes ?
            AllNodes.find(function(node) {
                return (node && (node.windowId == winId));})
            :
            null;
        // Both leaves and parent node have the windowId set, we want the parent if both exist
        if (n && n.parentId && AllNodes[n.parentId] && (AllNodes[n.parentId].windowId == winId))
            return AllNodes[n.parentId];
        return n;
    }

    static findFromURL(url) {
        // Does url belong to an existing BTChromeNode?
        var n = AllNodes ?
            AllNodes.find(function(node) {
                return (node && compareURLs(node.URL, url));})
            :
            null;
        return n;
    }
}
