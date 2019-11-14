class BTNode {
    constructor(id, title, text, level, parentId) {
        this._id = id;
        this._title = title;
        this._text = text;
        this._level = level;
        this._parentId = parentId;
        this._childIds = [];
        this._linkChildren = false;
        if (parentId || parentId === 0)
            AllNodes[parentId].addChild(id);
        this._folded = false;
        this.drawers = {};
        this.keyword = null;
        this.tags = [];
    }

    get id() {
        return this._id;
    }
    
    set level(l) {
        this._level = l;
    }
    get level() {
        return this._level;
    }

    set text(txt) {
        this._text = txt;
    }
    get text() {
        return this._text;
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

    set folded(f) {
        this._folded = f;
    }
    get folded() {
        return this._folded;
    }

    set linkChildren(bool) {
        this._linkChildren = bool;
    }
    get linkChildren() {
        return this._linkChildren;
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

    HTML() {
        // Generate HTML for this table row
        var outputHTML = "";
        outputHTML += `<tr data-tt-id='${this._id}`;
        if (this._parentId || this._parentId === 0) outputHTML += `' data-tt-parent-id='${this._parentId}`;
        outputHTML += `'><td class='left'><span class='btTitle'>${this.displayTitle()}</span></td><td class='middle'/>`;
        outputHTML += `<td><span class='btText'>${this.displayText()}</span></td></tr>`;
        return outputHTML;
    }

    orgDrawers() {
        // generate any required drawer text
        let drawerText = "";
        if (this.drawers) {
            const drawers = Object.keys(this.drawers);
            const reg = /:(\w*):\s*(\w*)/g;                          // regex to iterate thru props and values
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
        if (this.folded && (!this.drawers || !this.drawers.PROPERTIES))
            //need to add in the PROPERTIES drawer if we need to store the nodes folded state
            drawerText += "  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n";
        return drawerText;
    }

    orgTags(current) {
        // insert any tags padded right
        if (this.tags.length == 0) return "";
        const width = 78;                                // default for right adjusted tags
        let tags = ":";
        for (const tag of this.tags) {
            tags += tag + ":";
        }
        const padding = Math.max(width - current.length - tags.length, 1);
        return " ".repeat(padding) + tags;
    }
        

    orgText() {
        // Generate org text for this node
        var outputOrg = this._id ? "\n" : "";                           // no leading newline
        outputOrg += "*".repeat(this._level) + " ";
        outputOrg += this.keyword ? this.keyword+" " : "";              // TODO DONE etc
        outputOrg += this._title;
        outputOrg += this.orgTags(outputOrg) + "\n";                    // add in any tags
        outputOrg += this.orgDrawers();                                 // add in any drawer text
        outputOrg += this._text ? this._text + "\n" : "";
        return outputOrg;
    }

    orgTextwChildren() {
        // Generate org text for this node and its descendents
        var outputOrg = this.orgText();
        this._childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            outputOrg += AllNodes[id].orgTextwChildren();
        });
        return outputOrg;
    }
    
    static _displayTextVersion(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        var regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        var reg = new RegExp(regexStr, "mg");
        var hits;
        var outputStr = txt;
        while (hits = reg.exec(outputStr)) {
            outputStr = outputStr.substring(0, hits.index) + "<a href='" + hits[1] + "' class='btlink'>" + hits[2] + "</a>" + outputStr.substring(hits.index + hits[0].length);
        }
        return outputStr;
    }
    
    displayText() {
        var htmlText = BTNode._displayTextVersion(this._text);
        if (htmlText.length < 250) return htmlText;
        // if we're chopping the string need to ensure not splitting a link
        var rest = htmlText.substring(250);
        var reg = /.*?<\/a>/gm;                                // non greedy to get first
        var ellipse = "<span class='elipse'>... </span>";
        if (!reg.exec(rest)) return htmlText.substring(0,250)+ellipse; // no closing a tag so we're ok
        var closeIndex = reg.lastIndex;
        rest = htmlText.substring(250, 250+closeIndex);     // there is a closing a, find if there's a starting one
        reg = /<a href/gm;
        if (reg.exec(rest)) return htmlText.substring(0,250)+ellipse;  // there's a matching open so 0..250 string is clean
        return htmlText.substring(0, 250+closeIndex)+ellipse;
    }
    
    displayTitle() {
        let txt = "";
        if (this.keyword) txt += `<b>${this.keyword}: </b>`;
        return txt + BTNode._displayTextVersion(this._title);
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
        return outputStr;
    }        

    static findFromTitle(title) {
        var n = AllNodes ? AllNodes.find(function(node) {
            return (node && (node._title == title));}) : null;
        return n;
    }       
}

BTNode.topIndex = 0;          // track the index of the next node to create, static class variable.

class BTChromeNode extends BTNode {
    // Node as seen by the extension. Knows about tabs and window ids
    constructor(id, title, text, level, parentId) {
        super(id, title, text, level, parentId);
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
}

class BTLinkNode extends BTNode {
    // create a link type node for links embedded in para text - they show as children in the tree but don't generate a new node when the org file is written out, unless they are edited and given descriptive text, in which case they are written out as nodes and will be promoted to BTNodes the next time the file is read.
    constructor(id, title, text, level, parentId) {
        super(id, title, text, level, parentId);
        this._linkChildren = true;   // by definition
    }
    orgTextwChildren() {
        // only generate org text for links with added descriptive text
        if (this._text.length)
            return super.orgTextwChildren(); // call function on super class to write out,
        return "";
    }
}   
