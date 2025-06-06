/***
 *
 * Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
 *
 * This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
 * See the LICENSE file contained with this project.
 *
 ***/



/***
 *
 *  Base model for a BrainTool node. Keeps track of containment and relationships
 *  Tree creation functions
 *
 ***/

'use strict'

const ReservedWords = {'TODO': 'Todo', 'DONE': 'Done'};             // can't name topics these org-mode reserved words

class BTNode {
    constructor(title, parentId = null, firstChild = false) {

        const _title = this.sanitizeTitle(title);
        this._id = BTNode.topIndex++;
        this._title = _title;
        this._parentId = parentId;
        this._URL = BTNode.URLFromTitle(_title);
	    this._displayTopic = BTNode.displayNameFromTitle(_title);
        this._childIds = [];
        this._topicPath = '';
        if (parentId && AllNodes[parentId]) {
            AllNodes[parentId].addChild(this._id, false, firstChild);   // add to parent, index not passed, firstChild => front or back
        }
        // Global instance store. Check existence so staticBase, below, works.
        // NB Entries could be overwritten by derived class ctor:
        if (typeof AllNodes !== 'undefined') AllNodes[this._id] = this;    
    }

    sanitizeTitle(title) {
        if (ReservedWords[title]) {
            alert(`${title} is a reserved word in org-more, using ${ReservedWords[title]} instead`);
            return ReservedWords[title];
        }
        return title;
    }

    get id() {
        return this._id;
    }
    
    set title(ttl) {
        const _ttl = this.sanitizeTitle(ttl);
        this._title = _ttl;
        const url = BTNode.URLFromTitle(_ttl);         // regenerate URL when title is changed
        if (this._URL && !url) throw "URL cannot be set to null from non-null!!!";
        this._URL = url;
	    this._displayTopic = BTNode.displayNameFromTitle(_ttl);
    }
    get title() {
        return this._title;
    }
    get URL() {
        return this._URL;
    }
    set URL(url) {
        if (this._URL && !url) throw "URL cannot be set to null from non-null!!!";
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
        if (index !== false)
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

    findTopicChild(childTopic) {
        // does this topic node have this sub topic
        const childId = this.childIds.find(id => (AllNodes[id].isTopic () && (AllNodes[id].topicName() == childTopic)));
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

    topicName () {
        // return the topic name for this node
        if (this.isTopic())
            return (this.URL) ? BTNode.editableTopicFromTitle(this.title) : this.title;
        return AllNodes[this.parentId].topicName();
    }
    
    isTopicTree() {
        // Does this nodes url match a pointer to a web .org resource that can be loaded
        // NB only use on bt urls for now. any kind oof page can end in .org.
        const reg = /.*:\/\/.*braintool.*\/.*\.org/i;
        return reg.exec(this._URL) ? true : false;
    }
    
    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order
        function arrayMoveElt(ary, from, to) {
            // utility to move element within array
            const elt = ary[from];
            ary.splice(from, 1);
            ary.splice(to, 0, elt);
        }
        // throw an exception if newP = oldP
        if (newP == this._id) throw "reparentNode: setting self to parent!";
    
        const oldP = this.parentId;
        if (!oldP && !newP) return;             // nothing to do
        if (oldP === newP) {
            // Special case: new parent is the same as the old parent
            const parentNode = AllNodes[oldP];
            const oldIndex = parentNode.childIds.indexOf(this._id);
            arrayMoveElt(parentNode.childIds, oldIndex, index);
        } else {
            // either old or newP might be null, ie at top level
            oldP && AllNodes[oldP].removeChild(this.id);
            this.parentId = newP;
            newP && AllNodes[newP].addChild(this.id, index);
        }
    }
    indexInParent() {
        // return the index of this node in its parent
        if (!this.parentId) return -1;
        const parent = AllNodes[this.parentId];
        return parent.childIds.indexOf(this.id);
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
        let match = this.title.match(/(.*?)\[\[(.*?)\]\[(.*?)\]\](.*?)/);
        if (match) {
            //was: this.title = this.title.replace(match[1], newURL).replace(match[2], newTitle);
            this.title = `${match[1]}[[${newURL}][${newTitle}]]${match[4]}`;
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

        if (!first || !second) return null;
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
        if (ReservedWords[topic]) topic = ReservedWords[topic];  // can't name topics these org-mode reserved words
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
        const myTopic = this.isTopic() ? this.topicName() : '';
        if (this.parentId && AllNodes[this.parentId])
            return AllNodes[this.parentId].fullTopicPath() + ':' + myTopic;
        else
            return myTopic;
    }
    
    static generateUniqueTopicPaths() {
        // same topic can be under multiple parents, generate a unique topic Path for each node

        // First create a map from topics to array of node ids w that topic name
        let topics = {};
        let flat = true;
        let level = 1;
        AllNodes.forEach((n) => {
            if (!n) return;
            const topicName = n.topicName();
            if (n.isTopic()) {
                if (topics[topicName]) {
                    topics[topicName].push(n.id);
                    flat = false;
                }
                else
                    topics[topicName] = Array(1).fill(n.id);
            }});

        // !flat => dup topic names (<99 to prevent infinite loop
        while(!flat && level < 99) {
            level++; flat = true;
            Object.entries(topics).forEach(([topic, ids]) => {
                if (ids.length > 1) {
                    // replace dups w DN of increasing levels until flat
                    delete topics[topic];
                    ids.forEach(id => {
                        let tpath = AllNodes[id].topicName();
                        let parent = AllNodes[id].parentId;
                        for (let i = 1; i < level; i++) {
                            if (parent && AllNodes[parent]) {
                                tpath = AllNodes[parent].topicName() + ":" + tpath;
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
                    node._topicPath = BTNode.editableTopicFromTitle(node.title);    // no parent but not topic, use [[][title part]]
            }
        });
    }
    
}
