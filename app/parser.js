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
 * Thin wrapper on top of orga. See orga-bundle.js
 * 
 ***/
'use strict'

var AllNodes = [];
var Lines= [];

function parseBTFile(fileText) {
    // create and recursively walk orga parse tree to create bt model

    let parseTree;
    try {
        parseTree = orgaparse(fileText);
    }
    catch(e) {
        alert('Error in parsing BrainTool.org file:\n', JSON.stringify(e));
        throw(e);
    }
    Lines = generateLinesAndColumns(fileText);                 // used to pull out text content
    for (const orgaNode of parseTree.children) {
        if (orgaNode.type == "section")
            orgaSection(orgaNode, null);
    }

    // Save top level properties if any, NB parser doesn't handle correctly
    // See [[https://github.com/orgapp/orgajs/issues/82]]
    const filePropertyRegex = /(^#\+PROPERTY: .*$\n)+/m;       // multi-line match prop statements
    const match = filePropertyRegex.exec(fileText);
    if (!match) return;
    const propValRegex = /PROPERTY: (.*?) (.*)/g;
    let m;
    while ((m = propValRegex.exec(match[0])) !== null) {
        configManager.setProp(m[1], m[2]);
    }
}

function findOrCreateParentTopic(fileName, fileText) {
    // pull any BTParentTopic out of file props and get/create, otherrwise create at top level

    const filePropertyRegex = /(^#\+PROPERTY: .*$\n)+/m;       // multi-line match prop statements
    const match = filePropertyRegex.exec(fileText);
    
    const propValRegex = /PROPERTY: (.*?) (.*)/g;
    let m;
    while (match && (m = propValRegex.exec(match[0])) !== null) {
        if (m[1] == "BTParentTopic")
            return BTAppNode.findOrCreateFromTopicDN(m[2]);
    }

    return new BTAppNode(fileName, null, `Imported ${getDateString()}`, 1);
}

function insertOrgFile(fileName, fileText) {
    // Insert contents of this org filetext under the provided parent

    const parentNode = findOrCreateParentTopic(fileName, fileText);
    const parseTree = orgaparse(fileText);
    Lines = generateLinesAndColumns(fileText);
    for (const orgaNode of parseTree.children) {
        if (orgaNode.type == "section")
            orgaSection(orgaNode, parentNode);
    }
    processImport(parentNode.id);                           // bt.js fn to write and refresh 
}

function orgaSection(section, parentAppNode) {
    // Section is a Headlines, Paragraphs and contained Sections.
    // Generate BTNode per Headline from Orga nodes.
    const appNode = new BTAppNode("", parentAppNode ? parentAppNode.id : null, "", 0);
    let allText = "";
    let index = 0;
    for (const orgaChild of section.children) {
        orgaChild.indexInParent = index++; // remember order to help
        switch(orgaChild.type) {
        case "headline":
            appNode.level = parentAppNode ? parentAppNode.level + 1 : orgaChild.level;
            appNode.title = orgaText(orgaChild, appNode);
            if (orgaChild.keyword) appNode.keyword = orgaChild.keyword;
            if (orgaChild.tags) appNode.tags = orgaChild.tags;
            break;
        case "section": 
            orgaSection(orgaChild, appNode);
            break;
        case "planning":
            appNode.planning = orgaNodeRawText(orgaChild) + "\n";
            break;
        case "drawer": 
            appNode.drawers[orgaChild.name] = orgaChild.value;
            if (orgaChild.name == "PROPERTIES")
                appNode.folded = orgaChild.value.match(/:VISIBILITY:\s*folded/g) ? true : false;
            break;
        case "paragraph":
            allText += allText.length ? "\n" : "";        // add newlines between para's
            allText += orgaText(orgaChild, appNode);      // returns text but also updates appNode for contained links
            break;
        default:
            allText += allText.length ? "\n" : "";        // elements are newline seperated
            allText += orgaNodeRawText(orgaChild);
        }
    }
    appNode.text = allText;
    return appNode;
}

function orgaLinkOrgText(node) {
    // work around - orga.js includes protocol on http(s) links but not file, chrome-extension etc
    const valIncludesProtocol = node.value.search('://');
    let url = node.value;
    if (valIncludesProtocol > 0)
	    // peel off any leading 'http(s):'  NB node.value contains any leading //
	    url = node.value.substring(valIncludesProtocol + 1);
    url = node.protocol + ':' + url;
    return "[[" + url + "][" + node.description + "]]";
}

function orgaText(organode, containingNode) {
    // Return text from orga headline or para node. Both can contain texts and links
    // NB also pulling out links inside paragraphs
    let linkTitle, node, lnkNode, btString = "";
    for (const orgaChild of organode.children) {
        if (orgaChild.type == "priority") {
            btString += orgaNodeRawText(orgaChild) + ' ';
        }
        if (orgaChild.type.startsWith("text.")) {
            if (orgaChild.value.startsWith('*')) btString += ' '; // workaround. orga strips leading spaces
            btString += orgaNodeRawText(orgaChild);
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

function orgaNodeRawText(organode) {
    // return raw text for this node
    
    // orga uses 1-based indicies
    const startLine = organode.position.start.line - 1;
    let startCol =  organode.position.start.column - 1;
    const endLine = organode.position.end.line - 1;
    let endCol =  organode.position.end.column - 1;

    if (organode.type == 'table') {                       // weird orga behavior for table
        startCol--; endCol++;
    }
    let string = "";
    if (startLine == endLine)
        return Lines[startLine].substr(startCol, (endCol - startCol));
    for (let i = startLine; i <= endLine; i++) {
        if (i == startLine)
            string += Lines[i].substr(startCol);
        else if (i == endLine) {
            string += Lines[i].substr(0, endCol);
            break;                                        // done, skip adding another \n
        }
        else
            string += Lines[i];
        string += "\n";
    }
    return string;
}

function generateLinesAndColumns(filetext) {
    // return an array of the original lines and columns for use in regnerating orga

    let lines = [];
    filetext.split(/\r?\n/).forEach(line => lines.push(line));
    return lines;
    
}
