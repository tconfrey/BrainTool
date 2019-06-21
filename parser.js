
var TopNodes = [];
var AllNodes = [];

function parseBTFile(fileText) {
    // turn the org-mode text into an html table, extract category tags
    BTFileText = fileText;      // store for future editing
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
    var BTNode = {'orgaNode': orgaSection, 'children': [], 'parent': null, 'id': nodeId};
    AllNodes[nodeId++] = BTNode;
    var BTChildIndex = 0;
    var orgaChild;
    for (var i = 0; i < orgaSection.children.length; i++) {
        orgaChild = orgaSection.children[i];
        if (orgaChild.type == "headline") {
            BTNode.level = orgaChild.level;
            BTNode.title = orgaText(orgaChild); // returns {fullText, summaryText}
        }
        if (orgaChild.type == "paragraph") {
            BTNode.text = orgaText(orgaChild); // returns {fullText, summaryText}
        }
        if (orgaChild.type == "section") {
            BTNode.children[BTChildIndex] = BTNodeProcessSection(orgaChild);
            BTNode.children[BTChildIndex++].parent = BTNode; // remember parent
        }
    }
    return BTNode;
}


function summarizeText(txtsAry) {
    // generate shorter version when needed
    var lnkLen = txtsAry.reduce(function(acc, cv) { return acc + (cv.desc ? cv.desc.length : 0);}, 0);
    var txtCount = txtsAry.reduce(function(acc, cv) { return acc + (cv.desc ? 0 : 1);}, 0);
    var max = 150;
    var nonLnk = 150 - lnkLen;
    var txtLen = parseInt(nonLnk / txtCount);
    var out = "";
    txtsAry.forEach(function(e) {
        if (e.desc) out += e.desc;
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
    
function orgaLinkFullText(node) {
    return "<a target='_blank' href='" + node.uri.raw + "'>" + node.desc + "</a>";
}

function orgaText(node) {
    // generate text from orga headline or para node. Both can contain texts and links
    var orgaChild;
    var fullText = "";
    var tmpText = "";
    var textsArray = [];
    for (var i = 0; i < node.children.length; i++) {
        orgaChild = node.children[i];
        if (orgaChild.type == "text") {
            fullText += orgaChild.value;
            textsArray.push({'txt': orgaChild.value});
            if (node.type == "headline") Categories.add(orgaChild.value);
        }
        if (orgaChild.type == "link") {
            tmpText += orgaLinkFullText(orgaChild);
            fullText += tmpText;
            textsArray.push({'desc': orgaChild.desc, 'txt': tmpText});
        }
    }
    return {
        'fullText': fullText,
        'summaryText': fullText.length > 120 ? summarizeText(textsArray) : ""
    };
}


function generateTable() {
    // Generate table from BT Nodes
    var outputHTML = "<table>";
    AllNodes.forEach(function(node) {
        if (!node) return;
        outputHTML += "<tr data-tt-id='" + node.id;
        if (node.parent) outputHTML += "' data-tt-parent-id='" + node.parent.id;
        outputHTML += "'><td class='left'>" + node.title.fullText + "</td>";
        if (node.text)
            outputHTML += "<td>" + (node.text.summaryText ? node.text.summaryText : node.text.fullText) + "</td></tr>";
        else
            outputHTML += "<td/></tr>";
    });
    outputHTML += "</table>";
    return outputHTML;
}
