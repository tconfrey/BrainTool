class BTAppNode extends BTNode {
    // Centralizes all the app-only logic of reading and writing to org, creating the ui etc

    constructor(title, parent, text, level) {
        super(title, parent);
        this._text = text;
        this._level = level;
        this._folded = false;
        this._keyword = null;
        this.drawers = {};
        this.tags = [];
        AllNodes[this._id] = this;
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
    resetLevel(l) {
        // after a ui drag/drop need to reset level under new parent
        this.level = l;
        this.childIds.forEach(childId => {
            AllNodes[childId].resetLevel(l+1);
        });
    }
    get keyword() {
        return this._keyword;
    }
    set keyword(kw) {
	    this._keyword = kw;
    }

    set folded(f) {
        this._folded = f;
    }
    get folded() {
        return this._folded;
    }
    
    hasOpenChildren() {
        return this.childIds.some(id => AllNodes[id].isOpen);
    }
    
    HTML() {
        // Generate HTML for this nodes table row
        let outputHTML = "";
        outputHTML += `<tr data-tt-id='${this.id}`;
        if (this.parentId || this.parentId === 0)
            outputHTML += `' data-tt-parent-id='${this.parentId}`;
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
        outputOrg += this.title;
        outputOrg += this.orgTags(outputOrg) + "\n";                    // add in any tags
        outputOrg += this.orgDrawers();                                 // add in any drawer text
        outputOrg += this._text ? this._text + "\n" : "";
        return outputOrg;
    }

    orgTextwChildren() {
        // Generate org text for this node and its descendents
        let outputOrg = this.orgText();
        this.childIds.forEach(function(id) {
            if (!AllNodes[id]) return;
            let txt = AllNodes[id].orgTextwChildren();
            outputOrg += txt.length ? "\n" + txt : "";           // eg BTLinkNodes might not have text 
        });
        return outputOrg;
    }
    
    static _orgTextToHTML(txt) {
        // convert text of form "asdf [[url][label]] ..." to "asdf <a href='url'>label</a> ..."

        const regexStr = "\\[\\[(.*?)\\]\\[(.*?)\\]\\]";           // NB non greedy
        const reg = new RegExp(regexStr, "mg");
        let hits;
        let outputStr = txt;
        while (hits = reg.exec(outputStr)) {
            const h2 = (hits[2]=="undefined") ? hits[1] : hits[2];
            if (hits[1].indexOf('file:') == 0)
                outputStr = outputStr.substring(0, hits.index) + "<span class='file-link'>" + h2 + "</span>" + outputStr.substring(hits.index + hits[0].length);
            else                
                outputStr = outputStr.substring(0, hits.index) + "<a href='" + hits[1] + "' class='btlink'>" + h2 + "</a>" + outputStr.substring(hits.index + hits[0].length);
        }
        return outputStr;
    }
    
    displayText() {
        // Node text as seen in the tree. Insert ... link to text that won't fit
        const htmlText = BTAppNode._orgTextToHTML(this._text);
        if (htmlText.length < 250) return htmlText;
        
        // if we're chopping the string need to ensure not splitting a link
        const ellipse = "<span class='elipse'>... </span>";
        let rest = htmlText.substring(250);
        let reg = /.*?<\/a>/gm;                                // non greedy to get first
        if (!reg.exec(rest))
            // no closing a tag so we're ok
            return htmlText.substring(0,250)+ellipse;

        // there is a closing a, find if there's a starting one
        const closeIndex = reg.lastIndex;
        rest = htmlText.substring(250, 250+closeIndex);     
        reg = /<a href/gm;
        if (reg.exec(rest))
            // there's a matching open so 0..250 string is clean
            return htmlText.substring(0,250)+ellipse;

        // Return text to end of href
        return htmlText.substring(0, 250+closeIndex)+ellipse;
    }
    
    displayTitle() {
        // Node title as shown in tree, <a> for url. Compare to BTNode.displayTag = plain tag text
        let txt = "";
        if (this._keyword) txt += `<b>${this._keyword}: </b>`; // TODO etc
        return txt + BTAppNode._orgTextToHTML(this.title);
    }
    
    countOpenableTabs() {
        // used to warn of opening too many tabs
        let childCounts = this.childIds.map(x => AllNodes[x].countOpenableTabs());

        const me = (this.URL && !this.isOpen) ? 1 : 0;

        let n = 0;
        if (childCounts.length)
            n = childCounts.reduce((accumulator, currentValue) => accumulator + currentValue);
        
        return n + me;
    }

    countOpenableWindows() {
        // used to warn of opening too many windows
        let childCounts = this.childIds.map(x => AllNodes[x].countOpenableWindows());

        const me = this.isTag() ? 1 : 0;

        let n = 0;
        if (childCounts.length)
            n = childCounts.reduce((accumulator, currentValue) => accumulator + currentValue);
        
        return n + me;
    }

    reparentNode(newP, index = -1) {
        // move node from existing parent to new one, optional positional order

        super.reparentNode(newP, index);
        
        // Update nesting level as needed (== org *** nesting)
        const newLevel = AllNodes[newP].level + 1;
        if (this.level != newLevel)
            this.resetLevel(newLevel);

        // message to update BT background model
        window.postMessage(
            { type: 'node_reparented', nodeId: this.id, parentId: newP, index: index });
        console.count('BT-OUT:node_deleted');

    }

    static generateTags() {
        // Iterate thru nodes and generate array of tags and their nesting
        
        Tags = new Array();
        for (const node of AllNodes) {
            if (node && node.isTag())
                Tags.push({'name' : node.displayTag, 'level' : node.level});
        }
    }
    
    static findFromTag(tag) {
        var n = AllNodes.find(node => (node && (node.displayTag == tag)));
        return n ? n.id : null;
    }


}


class BTLinkNode extends BTAppNode {
    // create a link type node for links embedded in para text - they show as children in the tree but don't generate a new node when the org file is written out, unless they are edited and given descriptive text, in which case they are written out as nodes and will be promoted to BTNodes the next time the file is read.
    constructor(title, parent, text, level, protocol) {
        super(title, parent, text, level);
        this._protocol = protocol;
    }
    
    set protocol(ptxt) {
        this._protocol = ptxt;
    }
    get protocol() {
        return this._protocol;
    }

    orgTextwChildren() {
        // only generate org text for links with added descriptive text
        if (this._text.length)
            return super.orgTextwChildren(); // call function on super class to write out,
        return "";
    }

    HTML() {
        // only generate an HTML node for http[s]: links
        // other links (eg file:) pulled in from org won't work in the context of the browser
        if (this.protocol.match('http'))
            return super.HTML();
        return "";
    }
    
    get displayTag() {
        // No display tag for linknodes cos they should never be a tag
        return "";
    }
}

