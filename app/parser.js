/*** 
 * 
 * Thin wrapper on top of orga. See orga-bundle.js
 * 
 ***/

var AllNodes = [];
var Lines = [];

function parseBTFile(fileText) {
    // create and recursively walk orga parse tree to create bt model
    const parseTree = orgaparse(fileText);
    for (const orgaNode of parseTree.children) {
        if (orgaNode.type == "section")
            orgaSection(orgaNode, null);
    }

    // save top level properties if any, parser returns a str or array of strs
    if (!$.isEmptyObject(parseTree.properties)) {
        if ($.isArray(parseTree.properties))
            AllNodes.metaProperties = parseTree.properties;
        else
            //AllNodes.metaProperties = parseTree.properties.split();
            AllNodes.metaProperties = parseTree.properties['property'].split();
    } else
        AllNodes.metaProperties = [];

    // Save raw lines for future output
    Lines = generateLinesAndColumns(fileText);
}

function orgaSection(section, parentAppNode) {
    // Section is a Headlines, Paragraphs and contained Sections. Generate BTNode per Headline from Orga nodes. Saved all contained orgaNodes for output
    const appNode = new BTAppNode("", parentAppNode ? parentAppNode.id : null, "", 0);
    let allText = "";
    for (const orgaChild of section.children) {
        if (orgaChild.type == "headline") {
            appNode.level = orgaChild.level;
            appNode.title = orgaText(orgaChild, appNode);
            if (orgaChild.keyword) appNode.keyword = orgaChild.keyword;
            if (orgaChild.tags) appNode.tags = orgaChild.tags;
        }
        if (orgaChild.type == "paragraph") {
            allText += allText.length ? "\n\n" : "";      // add newlines between para's
            allText += orgaText(orgaChild, appNode);      // returns text but also updates appNode
        }
        if (orgaChild.type == "section") {
            orgaSection(orgaChild, appNode);
        }
        if (orgaChild.type == "drawer") {
            appNode.drawers[orgaChild.name] = orgaChild.value;
            if (orgaChild.name == "PROPERTIES")
                appNode.folded = orgaChild.value.match(/:VISIBILITY:\s*folded/g) ? true : false;
        }
        appNode.orgaNodes.push(orgaChild);                // save all the organodes
    }
    appNode.text = allText;
    return appNode;
}

function orgaLinkOrgText(node) {
    return "[[" + node.value + "][" + node.description + "]]";
}

function orgaText(organode, containingNode) {
    // Return text from orga headline or para node. Both can contain texts and links
    // NB also pulling out any keywords (TODO, DONE etc) for display
    let linkTitle, node, lnkNode, btString = "";
    for (const orgaChild of organode.children) {
        if (orgaChild.type.startsWith("text.")) {
            btString += orgaChild.value;
        }
        if (orgaChild.type == "link") {
            linkTitle = orgaLinkOrgText(orgaChild);
            btString += linkTitle;

            if (organode.type == "paragraph") {
                // This is a link inside text, not a tag'd link. So special handling w BTLinkNode.
                lnkNode = new BTLinkNode(linkTitle, containingNode.id, "", containingNode.level+1, orgaChild.protocol);
            }
        }
    }
    return btString;
}

function metaPropertiesToString(ary) {
    // return the string to be used to output meta properties to .org file
    // obj is as captured in original parse, either a string or array of strings
    if (!ary || !ary.length) return "";
    let str = "";
    let metaprops = [];

    if (!getMetaProp('BTVersion'))
        ary.push('BTVersion 0');
    ary.forEach(function(st) {
        const version = st.match(/BTVersion (\d+)/);
        if (version)                            // increment version
            st = "BTVersion " + (parseInt(version[1]) + 1);
        str += "#+PROPERTY: " + st + "\n";
        metaprops.push(st);
    });
    AllNodes.metaProperties = metaprops;        // update AllNodes for next time around
    return str;
}

function getMetaProp(prop) {
    // return the value of the meta property if it exists
    const reg = new RegExp(`${prop} (\\w+)`);
    let val = '';
    if (!AllNodes.metaProperties || !AllNodes.metaProperties.length) return val;
    AllNodes.metaProperties.forEach(propStr => {
	    let match = propStr.match(reg);
	    if (match) val = match[1];
    });
    return val;
}

function setMetaProp(prop, val) {
    // set or change the value of the meta property
    const reg = new RegExp(`${prop} (\\w+)`);
    const index = AllNodes.metaProperties.findIndex(propStr => propStr.match(reg));
    if (index > -1)
        AllNodes.metaProperties[index] = `${prop} ${val}`;
    else
        AllNodes.metaProperties.push(`${prop} ${val}`);
}

function generateLinesAndColumns(filetext) {
    // return an array of the original lines and columns for use in regnerating orga

    let lines = [];
    filetext.split(/\r?\n+/).forEach(line => lines.push(line));
    return lines;
                                     
}

function orgaNodeRawText(organode) {
    // return raw text for this node
    
    // orga gives 1 indexed line and I guess counts the new line in col?!
    const startLine = organode.position.start.line - 1;
    const startCol =  organode.position.start.column - 2;
    const endLine = organode.position.end.line - 1;
    const endCol =  organode.position.end.column - 2;
    let string = "";
    if (startLine == endLine)
        return Lines[startLine].substr(startCol, (endCol - startCol));
    for (let i = startLine; i <= endLine; i++) {
        if (i == startLine)
            string += Lines[i].substr(startCol);
        else if (i == endLine)
            string += Lines[i].substr(0, endCol);
        else
            string += Lines[i];
    }
    return string;
}
