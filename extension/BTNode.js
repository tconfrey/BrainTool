class BTNode {
    constructor(id, title, text, level, parentId) {
        this._id = id;
        this._title = title;
        this._text = text;
        this._level = level;
        this._parentId = parentId;
        this._childIds = new Set();
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

    get childIds() {
        return this._childIds;
    }

    HTML() {
        // Generate HTML for this table row
        var outputHTML = "";
        outputHTML += `<tr data-tt-id='${this._id}`;
        if (this._parentId || this._parentId === 0) outputHTML += `' data-tt-parent-id='${this._parentId}`;
        outputHTML += `'><td class='left'>${this.displayTitle()}</td><td class='middle'/>`;
        outputHTML += `<td>${this.displayText()}</td></tr>`;
        return outputHTML;
    }

    orgText() {
        // Generate org text for this node
        var outputOrg = "*".repeat(this._level) + " ";
        outputOrg += this._title + "\n";
        outputOrg += this._text + "\n";
        return outputOrg;
    }
    
    static _displayTextVersion(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        var regexStr = "\\[\\[(.*)\\]\\[(.*)\\]\\]";
        var reg = new RegExp(regexStr, "m");
        var hits;
        var outputStr = txt;
        if ((hits = reg.exec(txt)) !== null) {
            outputStr = txt.substring(0, hits.index) + "<a href='" + hits[1] + "' class='btlink'>" + hits[2] + "</a>" + txt.substring(hits.index + hits[0].length);
        }
        return outputStr;
    }
    
    displayText() {
        return BTNode._displayTextVersion(this._text);
    }
    displayTitle() {
        return BTNode._displayTextVersion(this._title);
    }

    static findFromTitle(title) {
        var n = AllNodes ? AllNodes.find(function(node) {
            return (node._title == title);}) : null;
        return n;
    }
            
}

BTNode.topIndex = 0;          // track the index of the next node to create, static class variable.

class BTChromeNode extends BTNode {
    constructor(id, title, text, level, parentId) {
        super(id, title, text, level, parentId);
        this.url = "";
        this.tabId = null;
        this.windowID = null;
    }
}
