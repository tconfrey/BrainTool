var AllNodes = [];

function parseBTFile(fileText) {
    // crearte and recursively walk orga parse tree to create bt model
    const parseTree = orgaparse(fileText);
    for (const orgaNode of parseTree.children) {
        if (orgaNode.type == "section")
            orgaSection(orgaNode, null);
    }
}

function orgaSection(section, parentAppNode) {
    // Section is a Headlines, Paragraphs and contained Sections. Generate BTNode per Headline from Orga nodes
    const appNode = new BTAppNode("", parentAppNode ? parentAppNode.id : null, "", 0);
    let allText = "";
    for (const orgaChild of section.children) {
        if (orgaChild.type == "headline") {
            appNode.level = orgaChild.level;
            appNode.title = orgaText(orgaChild, appNode);
            if (orgaChild.keyword) appNode.keyword = orgaChild.keyword;
            appNode.tags = orgaChild.tags;
            appNode.drawers = orgaDrawers(orgaChild);
            if (appNode.drawers.PROPERTIES)
                appNode.folded = appNode.drawers.PROPERTIES.match(/:VISIBILITY:\s*folded/g) ? true : false;
            else
                appNode.folded = false;
        }
        if (orgaChild.type == "paragraph") {
            allText += allText.length ? "\n\n" : "";      // add newlines between para's
            allText += orgaText(orgaChild, appNode);      // returns text but also updates appNode
        }
        if (orgaChild.type == "section") {
            var childAppNode = orgaSection(orgaChild, appNode);
        }
    }
    appNode.text = allText;
    return appNode;
}

function orgaDrawers(node) {
    // Look for org mode drawer w VISIBILITY property for folded state
    var orgaChild;
    var drawers = {};
    for (var i = 0; i < node.children.length; i++) {
        orgaChild = node.children[i];
        if (orgaChild.type == "drawer" && orgaChild.name && orgaChild.value) {
            drawers[orgaChild.name] = orgaChild.value;
        }
    }
    return drawers;
}

function orgaLinkOrgText(node) {
    return "[[" + node.uri.raw + "][" + node.desc + "]]";
}

function orgaText(orgnode, containingNode) {
    // generate text from orga headline or para node. Both can contain texts and links
    // NB also pulling out any keywords (TODO, DONE etc) for display
    let linkTitle, node, lnkNode, btString = "";
    for (const orgaChild of orgnode.children) {
        if (orgaChild.type == "text") {
            btString += orgaChild.value;
        }
        if (orgaChild.type == "link") {
            linkTitle = orgaLinkOrgText(orgaChild);
            btString += linkTitle;

            if (orgnode.type == "paragraph") {
                // This is a link inside text, not a tag'd link. So special handling w BTLinkNode.
                lnkNode = new BTLinkNode(linkTitle, containingNode.id, "", containingNode.level+1, orgaChild.uri.protocol);
            }
        }
    }
    return btString;
}
