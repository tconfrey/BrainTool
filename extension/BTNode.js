class BTNode {
    constructor(id, title, parentId) {
        // TODO Level and Text move to AppNode
        this._id = id;
        this._title = title;
        this._parentId = parentId;
        this._childIds = [];
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
    
    get childIds() {
        return this._childIds;
    }
    addChild(id) {
        this._childIds.push(id);
    }
    removeChild(id) {
        let index = this._childIds.indexOf(id);
        if (index > -1)
            this._childIds.splice(index, 1);
    }

    static findFromTitle(title) {
        var n = BTNode.AllBTNodes ? BTNode.AllBTNodes.find(function(node) {
            return (node && (node.title == title));}) : null;
        return n ? n.id : null;
    }
    static AllBTNodes = [];          // track all instances
    static topIndex = 1;             // track the index of the next node to create, static class variable.
}

class BTChromeNode extends BTNode {
    // Node as seen by the extension. Knows about tabs and window ids
    constructor(id, title, parentId) {
        super(id, title, parentId);
        this.url = "";
        this.tabId = null;
        this.windowId = null;
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
}
