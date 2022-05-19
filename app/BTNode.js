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

    findChild(childTopic) {
        // does this topic node have this sub topic
        const childId = this.childIds.find(id => AllNodes[id].displayTag == childTopic);
        return childId ? AllNodes[childId] : null;
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
    isTopic() {
        return this.isTag();           // same thing, should refactor
    }
    
    isTopicTree() {
        // Does this nodes url match a pointer to a web .org resource that can be loaded
        // NB only use on bt urls for now. any kind oof page can end in .org.
        const reg = /.*:\/\/.*braintool.*\/.*\.org/i;
        return reg.exec(this._URL) ? true : false;
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

        const regexStr = "\\[\\[(http.*?|chrome.*?|edge.*?|brave.*?|file.*?)\\]\\[(.*?)\\]\\]";      // NB non greedy
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

    static findFromURL(url) {
        return AllNodes.find(node =>
			                 (node &&
			                  (BTNode.compareURLs(BTNode.URLFromTitle(node.title), url))));
    }
    
    static topIndex = 1;    // track the index of the next node to create, static class variable.
    
    static processTopicString(topic) {
        // Tag string passed from popup can be: tag, tag:TODO, parent:tag or parent:tag:TODO
        // return array[tagpath, TODO]

        topic = topic.trim();
        let match = topic.match(/(.*):TODO/);
        if (match)                                // topicDN:TODO form
            return [match[1], "TODO"];
        return[topic, ""];
    }

    static undoStack = [];
    static deleteNode(nodeId) {
        // Cleanly delete this node
        BTNode.undoStack = [];                     // only one level of undo, so clear each time

        function _deleteNode(nodeId) {
            const node = AllNodes[nodeId];
            if (!node) return;

            // recurse to delete children if any
            node.childIds.forEach(_deleteNode);
            
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
        // only called from ctor. suplanted by below. can't really amke uniquee without looking at all topics

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
    
    
    static generateUniqueTopicPaths() {
        // same topic can be under multiple parents, generate a unique topic Path for each node

        // First create a map from topics to array of node ids w that topic name
        let topics = {};
        let flat = true;
        let level = 1;
        AllNodes.forEach((n) => {
            if (!n) return;
            if (n.isTag()) {
                if (topics[n.displayTag]) {
                    topics[n.displayTag].push(n.id);
                    flat = false;
                }
                else
                    topics[n.displayTag] = Array(1).fill(n.id);
            }});

        // !flat => dup topic names (<99 to prevent infinite loop
        while(!flat && level < 99) {
            level++; flat = true;
            Object.entries(topics).forEach(([topic, ids]) => {
                if (ids.length > 1) {
                    // replace dups w DN of increasing levels until flat
                    delete topics[topic];
                    ids.forEach(id => {
                        let tpath = AllNodes[id].displayTag;
                        let parent = AllNodes[id].parentId;
                        for (let i = 1; i < level; i++) {
                            if (parent && AllNodes[parent]) {
                                tpath = AllNodes[parent].displayTag + ":" + tpath;
                                parent = AllNodes[parent].parentId;
                            }
                        }                        
                        if (topics[tpath]) {
                            topics[tpath].push(id);
                            flat = false;
                        }
                        else
                            topics[tpath] = Array(1).fill(id);
                    });
                }
            });
        }

        // Now walk thru map and assign unique DN to topic nodes
        Object.entries(topics).forEach(([topic, id]) => {
            AllNodes[id[0]]._tagPath = topic;
        });
        
        // Finally set topic for link nodes to parent
        AllNodes.forEach(node => {
            if (!node.isTag()) {
                if (node.parentId && AllNodes[node.parentId])
                    node._tagPath = AllNodes[node.parentId].tagPath;
                else
                    node._tagPath = node._displayTag;
            }
        });
    }
    
}
