
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
        var n = AllNodes.length ?
            AllNodes.find(function(node) {
                return (node && (node.tabId == tabId));})
            :
            null;
        return n;
    }
    
    static findFromWin(winId) {
        // Return node associated w display tab
        var n = AllNodes.length ?
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
        var n = AllNodes.length ?
            AllNodes.find(function(node) {
                return (node && compareURLs(node.URL, url));})
            :
            null;
        return n;
    }
}

/* Centralized Mappings from MessageType to handler. Array of handler functions */
const Handlers = {
    "window_ready": initializeExtension,
    "nodes_updated": loadNodes,
    "link_click": openLink,
    "tag_open": openTag,
    "show_node": showNode,
    "node_deleted": deleteNode,
    "close_node": closeNode,
//    "get_bookmarks": getBookmarks,  // moved into background specific handling cos optional perms
    "export_bookmarks": exportBookmarks
};

// Set handler for extension messaging
chrome.runtime.onMessage.addListener((msg, sender) => {
    console.log(`BTChromeNode received: [${msg.type}]`);
    if (Handlers[msg.type]) {
        console.log("BTChromeNode dispatching to ", Handlers[msg.type].name);
        Handlers[msg.type](msg, sender);
    }
});
