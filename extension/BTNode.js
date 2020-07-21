class BTNode {
    constructor(id, title, parentId) {
        this._id = id;
        this._title = title;
        this._parentId = parentId;
        this._childIds = [];
        this._open = false;
        if (parentId && BTNode.AllBTNodes[parentId]) {
            BTNode.AllBTNodes[parentId].addChild(id);
        }
        BTNode.AllBTNodes[id] = this;
    }

    get id() {
        return this._id;
    }
    
    set title(ttl) {
        this._title = ttl;
    }
    get title() {
        return this._title;
    }

    set parentId(i) {
        this._parentId = i;
    }
    get parentId() {
        return this._parentId;
    }

    set open(val) {
        // Track whether node is open (highlighted in tree and w an existing tab
        this._open = val;
    }
    get open() {
        return this._open;
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

    getURL() {
        // pull url from title string (which is in org format: "asdf [[url][label]] ...")
        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        const hits  = reg.exec(this._title);
        return hits ? hits[1] : "";        
    }

    displayTag() {
        // Visible tag for this node
        var regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        var reg = new RegExp(regexStr, "mg");
        var hits;
        var outputStr = this._title;
        while (hits = reg.exec(outputStr)) {
            outputStr = outputStr.substring(0, hits.index) + hits[2] + outputStr.substring(hits.index + hits[0].length);
        }
        if (outputStr == "undefined") outputStr = this.getURL(); // if no tag text use url
        return outputStr;
    }


    static findFromTitle(title) {
        var n = AllNodes.length ? AllNodes.find(function(node) {
            return (node && (node.title == title));}) : null;
        return n ? n.id : null;
    }
    static AllBTNodes = [];          // track all instances
    static topIndex = 1;             // track the index of the next node to create, static class variable.

    
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

    static reparentNode(newP, node, index = -1) {
        // move node from pre parent to new one, optional positional order
        
        const oldP = AllNodes[node].parentId;
        AllNodes[node].parentId = newP;
        AllNodes[oldP].removeChild(node);
        AllNodes[newP].addChild(node, index);
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

        delete(BTNode.AllBTNodes[nodeId]);
        delete(AllNodes[nodeId]);
    
    }
}

class BTChromeNode extends BTNode {
    // Node as seen by the extension. Knows about tabs and window ids
    constructor(id, title, parentId) {
        super(id, title, parentId);
        this.tabId = null;
        this.windowId = null;
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
                return (node && compareURLs(node.getURL(), url));})
            :
            null;
        return n;
    }
}
