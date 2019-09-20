
var TopNodes = [];
var AllNodes = [];

function parseBTFile(fileText) {
    // turn the org-mode text into an html table, extract category tags
    parseTree = orgaparse(fileText);
    var orgaNode;
    var BTNodes = new Array;
    var BTNodeIndex = 0;
    for (var i = 0; i<parseTree.children.length; i++) {
        orgaNode = parseTree.children[i];
        if (orgaNode.type == "section")
           BTNodes[BTNodeIndex++] = BTNodeProcessSection(orgaNode);
    }
    TopNodes = BTNodes;
    return BTNodes;
}

function BTNodeProcessSection(orgaSection) {
    // Section is a Headlines, Paragraphs and contained Sections. Generate BTNode per Headline from Orga nodes
    var node = new BTNode(BTNode.topIndex, "", "", 0, null);
    AllNodes[BTNode.topIndex++] = node;
    var BTChildIndex = 0;
    var orgaChild;
    var allText = "";
    for (var i = 0; i < orgaSection.children.length; i++) {
        orgaChild = orgaSection.children[i];
        if (orgaChild.type == "headline") {
            node.level = orgaChild.level;
            node.title = orgaText(orgaChild);
            node.folded = orgaFolded(orgaChild);
        }
        if (orgaChild.type == "paragraph") {
            allText += allText.length ? "\n\n" : "";      // add newlines between para's
            allText += orgaText(orgaChild);
            BTLinkProcessPara(orgaChild, node);           // pull out any embedded links and make them tree nodes
        }
        if (orgaChild.type == "section") {
            var childNode = BTNodeProcessSection(orgaChild);
            childNode.parentId = node.id;               // remember parent
            node.childIds.add(childNode.id);
        }
    }
    node.text = allText;
    return node;
}

function orgaFolded(node) {
    // Look for org mode drawer w VISIBILITY property for folded state
    var orgaChild;
    for (var i = 0; i < node.children.length; i++) {
        orgaChild = node.children[i];
        if (orgaChild.type == "drawer" && orgaChild.name == "PROPERTIES" && orgaChild.value) {
            if (orgaChild.value.match(/:VISIBILITY:\s*folded/g))
                return true;
        }
    }
    return false;
}

function orgaLinkOrgText(node) {
    return "[[" + node.uri.raw + "][" + node.desc + "]]";
}

function orgaText(node) {
    // generate text from orga headline or para node. Both can contain texts and links
    var orgaChild;
    var origText = ""
    for (var i = 0; i < node.children.length; i++) {
        orgaChild = node.children[i];
        if (orgaChild.type == "text") {
            origText += orgaChild.value;
            if (node.type == "headline") Categories.add(orgaChild.value);
        }
        if (orgaChild.type == "link") {
            origText += orgaLinkOrgText(orgaChild);
        }
    }
    return origText;
}

function BTLinkProcessPara(para, node) {
    // Pull any child links out and create BTNodes
    var orgaChild, btnode, title;
    for (var i = 0; i < para.children.length; i++) {
        orgaChild = para.children[i];
        if (orgaChild.type == "link") {
            title = orgaLinkOrgText(orgaChild);
            btnode = new BTLinkNode(BTNode.topIndex, title, "", node.level+1, node.id);
            AllNodes[BTNode.topIndex++] = btnode;
        }
    }
}
            
    

function generateTable() {
    // Generate table from BT Nodes
    var outputHTML = "<table>";
    AllNodes.forEach(function(node) {
        if (!node) return;
        outputHTML += node.HTML();
    });
    outputHTML += "</table>";
    return outputHTML;
}


/*

function summarizeText(txtsAry) {
    // generate shorter version when needed
    var lnkLen = txtsAry.reduce(function(acc, cv) { return acc + (cv.desc ? cv.desc.length : 0);}, 0);
    var txtCount = txtsAry.reduce(function(acc, cv) { return acc + (cv.desc ? 0 : 1);}, 0);
    var max = 150;
    var nonLnk = 150 - lnkLen;
    var txtLen = parseInt(nonLnk / txtCount);
    var out = "";
    txtsAry.forEach(function(e) {
        if (e.desc) out += e.txt;       // link
        else {
            if (e.txt.length <= txtLen) out += e.txt;
            else {
                var end = txtLen        // walk up to next space before chopping
                while ((e.txt[end++] !== ' ') && (end < e.txt.length)) {};
                out += e.txt.substring(0,end) + "<span class='elipse'>... </span>";
            }
        }
    });
    return out;
}
*/
