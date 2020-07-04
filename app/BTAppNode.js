class BTAppNode {
    // Centralizes all the app-only logic of reading and writing to org, creating the ui etc

    constructor(btnode, text, level) {
        this._btnode = btnode;
        this._text = text;
        this._level = level;
        this._linkChildren = false;
        this._folded = false;
        this._keyword = null;
        this.drawers = {};
        this.tags = [];
        AllNodes[btnode.id] = this;
    }

    get id() {
        return this._btnode.id;
    }

    set text(txt) {
        this._text = txt;
    }
    get text() {
        return this._text;
    }
    set level(l) {
        this._level = l;
    }
    get level() {
        return this._level;
    }
    get parentId() {
        return this._btnode.parentId;
    }
    set parentId(id) {
        this._btnode.parentId = id;
    }
    get title() {
        return this._btnode.title;
    }
    set title(ttl) {
	this._btnode.title = ttl;
    }
    get keyword() {
        return this._keyword;
    }
    set keyword(kw) {
	    this._keyword = kw;
    }

    // Child functions just pass thru to contained btnode
    get childIds() {
        return this._btnode.childIds;
    }
    addChild(id, index= -1) {
        this._btnode.addChild(id, index);
    }
    removeChild(id) {
        this._btnode.removeChild(id);
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

    getURL() {
        return this._btnode.getURL();
    }

    
    displayTag() {
        return this._btnode.displayTag();
    }
    
    HTML() {
        // Generate HTML for this table row
        var outputHTML = "";
        outputHTML += `<tr data-tt-id='${this._btnode.id}`;
        if (this._btnode.parentId || this._btnode.parentId === 0) outputHTML += `' data-tt-parent-id='${this._btnode.parentId}`;
        outputHTML += `'><td class='left'><span class='btTitle'>${this.displayTitle()}</span></td>`;
        outputHTML += `<td class='right'><span class='btText'>${this.displayText()}</span></td></tr>`;
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
        if (this.childIds.length && this.folded && (!this.drawers || !this.drawers.PROPERTIES))
            //need to add in the PROPERTIES drawer if we need to store the nodes folded state
            drawerText += "  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n";
        return drawerText;
    }

    orgTags(current) {
        // insert any tags padded right
        if (this.tags.length == 0) return "";
        const width = 77;                                // default for right adjusted tags
        let tags = ":";
        for (const tag of this.tags) {
            tags += tag + ":";
        }
        const padding = Math.max(width - current.length - tags.length, 1);
        return " ".repeat(padding) + tags;
    }
        

    orgText() {
        // Generate org text for this node
        let outputOrg = "*".repeat(this._level) + " ";
        outputOrg += this._keyword ? this._keyword+" " : "";              // TODO DONE etc
        outputOrg += this._btnode.title;
        outputOrg += this.orgTags(outputOrg) + "\n";                    // add in any tags
        outputOrg += this.orgDrawers();                                 // add in any drawer text
        outputOrg += this._text ? this._text + "\n" : "";
        return outputOrg;
    }

    orgTextwChildren() {
        // Generate org text for this node and its descendents
        let outputOrg = this.orgText();
        this._btnode.childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            let txt = AllNodes[id].orgTextwChildren();
            outputOrg += txt.length ? "\n" + txt : "";           // eg BTLinkNodes might not have text 
        });
        return outputOrg;
    }
    
    static _displayTextVersion(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        let hits;
        let outputStr = txt;
        while (hits = reg.exec(outputStr)) {
            const h2 = (hits[2]=="undefined") ? hits[1] : hits[2];
            outputStr = outputStr.substring(0, hits.index) + "<a href='" + hits[1] + "' class='btlink'>" + h2 + "</a>" + outputStr.substring(hits.index + hits[0].length);
        }
        return outputStr;
    }
    
    displayText() {
        var htmlText = BTAppNode._displayTextVersion(this._text);
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
        if (this._keyword) txt += `<b>${this._keyword}: </b>`; // TODO etc
        return txt + BTAppNode._displayTextVersion(this._btnode.title);
    }

    isTag() {
        // Logic to decide if this node can be used to tag web pages => is it a parent of nodes w links
        if (!this.linkChildren) return false;
        const children = this.childIds;
        if (children.length == 0) return false;
        for (const id of children) {
            if (AllNodes[id] && AllNodes[id].linkChildren)
                return true;
        }
        return false;
    }

    static generateTags() {
        // Iterate thru nodes and generate array of tags and their nesting
        
        Tags = new Array();
        for (const node of AllNodes) {
            if (node && node.isTag())
                Tags.push({'name' : node.displayTag(), 'level' : node.level});
        }
    }
    
    static findFromTag(tag) {
        var n = AllNodes.find(node => (node && (node.displayTag() == tag)));
        return n ? n.id : null;
    }


}


class BTLinkNode extends BTAppNode {
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
