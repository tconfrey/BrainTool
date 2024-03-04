/***
 *
 *  Base model for a BrainTool node. Keeps track of containment and relationships
 *  Tree creation functions
 *
 ***/

'use strict'

class BTNode {
    constructor(title, parentId = null, firstChild = false) {
        this._id = BTNode.topIndex++;
        this._title = title;
        this._parentId = parentId;
        this._URL = BTNode.URLFromTitle(title);
	    this._displayTopic = BTNode.displayNameFromTitle(title);
        this._childIds = [];
        this._topicPath = '';
        this.generateUniqueTopicPath();
        if (parentId && AllNodes[parentId]) {
            AllNodes[parentId].addChild(this._id, false, firstChild);   // add to parent, index not passed, firstChild => front or back
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
	    this._displayTopic = BTNode.displayNameFromTitle(ttl);
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
    get displayTopic() {
	    return this._displayTopic;
    }
    get topicPath() {
        return this._topicPath;
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
    addChild(id, index, firstChild = false) {
        if (index)
            this._childIds.splice(index, 0, parseInt(id));
        else if (firstChild)
            this._childIds.unshift(parseInt(id));
        else
            this._childIds.push(parseInt(id));
    }
    removeChild(id) {
	    let index = this._childIds.indexOf(parseInt(id));
        if (index > -1)
            this._childIds.splice(index, 1);
    }

    findChild(childTopic) {
        // does this topic node have this sub topic
        const childId = this.childIds.find(id => AllNodes[id].displayTopic == childTopic);
        return childId ? AllNodes[childId] : null;
    }
    
    getDescendantIds() {
        // return a list of all the descendant node ids
        let descendants = [];

        function dfs(node) {
            for (let childId of node._childIds) {
                let childNode = AllNodes[childId];
                if (childNode) {
                    descendants.push(childNode._id);
                    dfs(childNode);
                }
            }
        }

        dfs(this);

        return descendants;
    }

    // only used in isTopic
    _hasWebLinks() {
	    // Calculate on demand since it may change based on node creation/deletion
	    if (this.URL) return true;
	    return this.childIds.some(id => AllNodes[id]._hasWebLinks);
    }

    isTopic() {
        // Is this node used as a topic => has webLinked children
        return (this.level == 1) || (!this.URL) || this.childIds.some(id => AllNodes[id]._hasWebLinks);
    }
    
    isTopicTree() {
        // Does this nodes url match a pointer to a web .org resource that can be loaded
        // NB only use on bt urls for now. any kind oof page can end in .org.
        const reg = /.*:\/\/.*braintool.*\/.*\.org/i;
        return reg.exec(this._URL) ? true : false;
    }
    
    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order
        
        // throw an exception if newP = oldP
        if (newP == this._id) throw "reparentNode: setting self to parent!";

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
    
    static displayNameFromTitle(title) {
        // Visible title for this node. Pull displayed title out, use url if none

        // first escape any html entities
        title = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let outputStr = title.replace(/\[\[(.*?)\]\[(.*?)\]\]/gm, (match, $1, $2) =>
				                      {return $2 || $1;});
        return outputStr;
    }

    static editableTopicFromTitle(title) {
        // Just return the [[][title]] part of the title
        let match = title.match(/\[\[.*\]\[(.*)\]\]/);
        return match ? match[1] : '';
    }
    
    replaceURLandTitle(newURL, newTitle) {
        // replace the [[url][title]] part of the title with newTitle preserving any other text before/after
        let match = this.title.match(/\[\[(.*?)\]\[(.*?)\]\]/);
        if (match) {
            this.title = this.title.replace(match[1], newURL).replace(match[2], newTitle);
        }
        return this.title;
    }


    static compareURLs(first, second) {
        // sometimes I get trailing /'s other times not, also treat http and https as the same,
        // also google docs immediately redirect to the exact same url but w /u/1/d instead of /d
        // also navigation within window via # anchors is ok, but note not #'s embedded earlier in the url (eg http://sdf/#asdf/adfasdf)
        // also maybe ?var= arguments are ok? Not on many sites (eg hn) where there's a ?page=123.
        //              => .replace(/\?.*$/, "")

        // Define an array of transformations for cases where differnt URLs should be considered the same BTNode
        // Each transformation is an array where the first element is the regular expression and the second element is the replacement.
        const transformations = [
            [/https/g, "http"],             // http and https are the same
            [/\/u\/1\/d/g, "/d"],           // google docs weirdness 
            [/\/www\./g, "/"],              // www and non-www are the same
            [/#(?!.*\/).*$/g, ""],          // ignore # anchors that are not at the end of the url
            [/\/$/g, ""]                    // ignore trailing /
        ];

        if (first.indexOf("mail.google.com/mail") >= 0) {
            // if its a gmail url need to match exactly
            return (first == second);
        } else {        
            // Apply each transformation to the URLs.
            for (const [regex, replacement] of transformations) {
                first = first.replace(regex, replacement);
                second = second.replace(regex, replacement);
            }
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
        // Topic string passed from popup can be: topic, topic:TODO, parent:topic or parent:topic:TODO
        // return array[topicpath, TODO]

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

            // recurse to delete children if any. NB copy array cos the remove below changes it
            const childIds = node.childIds.slice();
            for (let cid of childIds) {
                _deleteNode(cid);
            };
            
            // Remove from parent
            const parent = AllNodes[node.parentId];
            if (parent)
                parent.removeChild(nodeId);

            BTNode.undoStack.push(node);
            console.log('deleteing id=', nodeId);
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
    
    fullTopicPath() {
        // distinguished name for this node
        const myTopic = this.isTopic() ? this.displayTopic : '';
        if (this.parentId && AllNodes[this.parentId])
            return AllNodes[this.parentId].fullTopicPath() + ':' + myTopic;
        else
            return myTopic;        
    }
    
    generateUniqueTopicPath() {
        // same topic can be under multiple parents, generate a unique topicPath
        // only called from ctor. suplanted by below. can't really amke uniquee without looking at all topics

        if (!this.isTopic()) {
            if (this.parentId && AllNodes[this.parentId])
                this._topicPath = AllNodes[this.parentId].topicPath;
            else
                this._topicPath = this._displayTopic;
            return;
        }
        
        if (this.displayTopic == "") {
            this._topicPath = this._displayTopic;
            return;
        }
        const sameTopic = AllNodes.filter(nn => nn && nn.isTopic() && nn.displayTopic == this.displayTopic);
        if (sameTopic.length == 1) {
            // unique
            this._topicPath = this._displayTopic;
            return;
        }
        sameTopic.forEach(function(nn) {
            const parentTag = AllNodes[nn.parentId] ? AllNodes[nn.parentId].displayTopic : "";
            nn._topicPath = parentTag + ":" + nn.displayTopic;
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
            if (n.isTopic()) {
                if (topics[n.displayTopic]) {
                    topics[n.displayTopic].push(n.id);
                    flat = false;
                }
                else
                    topics[n.displayTopic] = Array(1).fill(n.id);
            }});

        // !flat => dup topic names (<99 to prevent infinite loop
        while(!flat && level < 99) {
            level++; flat = true;
            Object.entries(topics).forEach(([topic, ids]) => {
                if (ids.length > 1) {
                    // replace dups w DN of increasing levels until flat
                    delete topics[topic];
                    ids.forEach(id => {
                        let tpath = AllNodes[id].displayTopic;
                        let parent = AllNodes[id].parentId;
                        for (let i = 1; i < level; i++) {
                            if (parent && AllNodes[parent]) {
                                tpath = AllNodes[parent].displayTopic + ":" + tpath;
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
            AllNodes[id[0]]._topicPath = topic;
        });
        
        // Finally set topic for link nodes to parent
        AllNodes.forEach(node => {
            if (!node.isTopic()) {
                if (node.parentId && AllNodes[node.parentId])
                    node._topicPath = AllNodes[node.parentId].topicPath;
                else
                    node._topicPath = node._displayTopic;
            }
        });
    }
    
}
