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
*  Consolodated bookmark handling functions, including utilities used by DnD of bookmark objects into tree
*
***/

'use strict';

// Utility function to flatten the bookmark tree
function flattenBookmarkTree(tree) {
    const result = [];
    function traverse(node) {
        result.push(node);
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    tree.forEach(traverse);
    return result;
}
function findMostSpecificCommonAncestor(nodes, bookmarks) {

    if (nodes.length === 1) return nodes[0].id; // If there's only one node, return its ID
    // Build a map of nodes by ID for quick lookup
    const nodeMap = {};
    bookmarks.forEach(node => nodeMap[node.id] = node);

    // Get all ancestors for a given node
    const getAncestors = (node) => {
        const ancestors = [];
        while (node.parentId) {
            ancestors.push(node.parentId);
            node = nodeMap[node.parentId];
        }
        return ancestors.reverse(); // Reverse to get root-to-leaf order
    };

    // Get the ancestor chains for all nodes
    const allAncestors = nodes.map(node => getAncestors(node));

    // Find the most specific common ancestor
    let commonAncestor = null;
    for (let i = 0; i < allAncestors[0].length; i++) {
        const ancestor = allAncestors[0][i];
        if (allAncestors.every(ancestors => ancestors[i] === ancestor)) {
            commonAncestor = ancestor;
        } else {
            break;
        }
    }

    return commonAncestor;
}

function generateNodeObjects(nodes, bookmarks, commonAncestor) {
    // Build a map of nodes by ID for quick lookup
    const nodeMap = {};
    bookmarks.forEach(node => nodeMap[node.id] = node);

    // Generate objects with URL, title, and topic
    return nodes.map(node => {
        const topicParts = [];
        let currentNode = node;
        while (currentNode && currentNode.id !== commonAncestor) {
            if (currentNode.title && !currentNode.url) {
                topicParts.unshift(currentNode.title);
            }
            currentNode = nodeMap[currentNode.parentId];
        }
        // also deal with the common ancestor
        if (currentNode.title && !currentNode.url) {
            topicParts.unshift(currentNode.title);
        }
        return {
            url: node.url,
            title: node.title,
            topic: topicParts.length ? topicParts.join(":") : '',
        };
    });
}


function getBookmarks() {
    // User has requested bookmark import from browser

    chrome.bookmarks.getTree(async function(itemTree){
        itemTree[0].title = "Imported Bookmarks";
        chrome.storage.local.set({'bookmarks': itemTree[0]}, function() {
            btSendMessage({'function': 'getBookmarks', 'result': 'success'});
        });
    });
}

function getBookmarksBar() {
    // Collect up bar contents and send to topic manager
    
    chrome.bookmarks.getTree(async function(itemTree){
        // Find the bookmark bar by its type
        const root = itemTree[0];
        let bookmarkBarFolder = null;
        
        // Look for the bookmark bar in the children
        if (root.children) {
            // Find the child with the "bookmark-bar" type
            bookmarkBarFolder = root.children.find(child => child.folderType === 'bookmarks-bar');
        }
        
        if (bookmarkBarFolder) {
            bookmarkBarFolder.title = "Bookmarks Bar";
            btSendMessage({'function': 'bookmarksBar', 'result': 'success', 'source': 'bookmarkBar',
                            'data': {'bookmarksBar': bookmarkBarFolder}});
        }
    });
}

// Track when sync is happening to turn off associated listeners
let syncInProgress = false;

function syncBookmarksBar() {
    // Read bookmarksBar tree from local storage and sync Chrome's bookmarks bar contents to it
    
    chrome.storage.local.get(['bookmarksBarChildren'], data => {
        if (!data.bookmarksBarChildren || !Array.isArray(data.bookmarksBarChildren)) {
            console.warn("No bookmarksBarChildren data found in storage");
            btSendMessage({'function': 'syncBookmarksBar', 'result': 'error', 'message': 'No bookmark bar data'});
            return;
        }

        const bookmarkBarId = "1";          // Standard ID for Chrome's bookmark bar
        const processedIds = new Set();     // Track which bookmark IDs we've processed
        const btNodeToBookmarkMap = {};     // Map BrainTool node IDs to bookmark IDs
        syncInProgress = true;              // Set flag to prevent event handling during sync

        // Process a node and its children recursively, maintaining order
        async function processNode(node, parentId, desiredIndex) {
            try {
                let bookmarkId;
                
                // Update or create the bookmark node
                if (node.id) {
                    // Existing bookmark - update it
                    
                    await chrome.bookmarks.update(node.id, {
                        title: node.title,
                        url: node.url
                    });
                    
                    // Move the bookmark to correct parent and position
                    await chrome.bookmarks.move(node.id, { 
                        parentId,
                        index: desiredIndex 
                    });
                    
                    bookmarkId = node.id;
                } else {
                    // Create new bookmark at the specific position
                    const newBookmark = await chrome.bookmarks.create({
                        parentId: parentId,
                        title: node.title,
                        url: node.url,
                        index: desiredIndex
                    });
                    
                    bookmarkId = newBookmark.id;
                    // Update the node with the new ID
                    node.id = bookmarkId;
                }
                processedIds.add(node.id);
                // capture id mapping
                node.btNodeId && (btNodeToBookmarkMap[node.btNodeId] = bookmarkId);
                
                // Process children if they exist
                if (node.children && node.children.length > 0) {
                    // Process each child in order with its desired index
                    for (let i = 0; i < node.children.length; i++) {
                        await processNode(node.children[i], bookmarkId, i);
                    }
                }
            } catch (err) {
                console.error("Error processing bookmark node:", err, node);
            }
        }
        
        // Main execution flow
        (async () => {
            try {
                // Process each child of the bookmarks bar with its desired index
                for (let i = 0; i < data.bookmarksBarChildren.length; i++) {
                    await processNode(data.bookmarksBarChildren[i], bookmarkBarId, i);
                }
                
                // Remove any bookmarks that weren't in our data
                await removeUnprocessedNodes(bookmarkBarId);
                
                btSendMessage({'function': 'bookmarksBarIds', 'result': 'success',
                                'data': {'idMapping': btNodeToBookmarkMap}});
            } catch (error) {
                console.error("Error syncing bookmarks bar:", error);
                btSendMessage({'function': 'bookmarksBarIds', 'result': 'error', 'message': error.toString()});
            } finally {
                // Always reset flag when done, even if there was an error
                syncInProgress = false;
            }
        })();
        
        // Recursively check for and remove any unprocessed nodes
        async function removeUnprocessedNodes(parentId) {
            try {
                const children = await chrome.bookmarks.getChildren(parentId);
                
                // First, recursively process all children's children
                for (const child of children) {
                    if (!child.url) {  // If it's a folder
                        await removeUnprocessedNodes(child.id);
                    }
                }
                
                // Then check if this child itself needs to be removed
                // (do this after processing children to avoid orphaning them)
                for (const child of children) {
                    if (!processedIds.has(child.id)) {
                        try {
                            if (child.url) {
                                await chrome.bookmarks.remove(child.id);
                            } else {
                                await chrome.bookmarks.removeTree(child.id);
                            }
                        } catch (error) {
                            console.warn(`Failed to remove bookmark ${child.id}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing node ${parentId}:`, error);
            }
        }
    });
}

function exportBookmarks() {
    // Top level bookmark exporter
    let AllNodes;

    function exportNodeAsBookmark(btNode, parentBookmarkId) {
        // export this node and recurse thru its children
        chrome.bookmarks.create(
            {title: btNode.displayTopic, url: btNode.URL, parentId: parentBookmarkId},
            (bmNode) => {
                btNode.childIds.forEach(i => {exportNodeAsBookmark(AllNodes[i], bmNode.id); });
            });
    }

    chrome.storage.local.get(['title', 'AllNodes'], data => {
        AllNodes = data.AllNodes;
        chrome.bookmarks.create({title: data.title}, bmNode => {
            // Iterate thru top level nodes exporting them
            AllNodes.forEach(n => {
                if (n && !n.parentId)
                    exportNodeAsBookmark(n, bmNode.id);
            });
            chrome.windows.create({'url': 'chrome://bookmarks/?id='+bmNode.id});
        });
    });
}

function createSessionName() {
    // return a name for the current session, 'session-Mar12
    const d = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    const monthName = monthNames[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    return 'Session-' + monthName + day + ":";
}


// Debounce events since we do a full sync anyway
let bookmarkChangeTimeout;
function debouncedExportBookmarks() {
    // Skip if sync is in progress to avoid feedback loops
    if (syncInProgress) {
        console.log("Bookmark event ignored during sync operation");
        return;
    }
    
    clearTimeout(bookmarkChangeTimeout);
    bookmarkChangeTimeout = setTimeout(() => {
        getBookmarksBar();
    }, 500);               // Wait a bit after the last bookmark change before exporting
}

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    debouncedExportBookmarks();
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    debouncedExportBookmarks();
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    debouncedExportBookmarks();
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    debouncedExportBookmarks();
});

chrome.bookmarks.onChildrenReordered.addListener((id, reorderInfo) => {
    debouncedExportBookmarks();
});