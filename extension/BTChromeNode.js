
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
const Handlers =
      [
          {
              "msg": "get_bookmarks",
              "handler": getBookmarks
          }, 
          {
              "msg": "window_ready",
              "handler": initializeExtension
          },
          {
              "msg": "nodes_ready",
              "handler": loadNodes
          },
          {
              "msg": "link_click",
              "handler": openLink
          },
          {
              "msg": "tag_open",
              "handler": openTag
          },
          {
              "msg": "show_node",
              "handler": showNode
          },
          {
              "msg": "node_deleted",
              "handler": deleteNode
          }
      ];

// Set handler for extension messaging
chrome.runtime.onMessage.addListener((msg, sender) => {
    console.count(`\nChrome Runtime, Message Manager received: [${msg.msg}]`);
    Handlers.forEach(handler => {
        if (handler["msg"] == msg.msg) {
            console.log("Message Manager dispatching to ", handler["handler"].name);
            handler["handler"](msg, sender);
        }
    });
});
