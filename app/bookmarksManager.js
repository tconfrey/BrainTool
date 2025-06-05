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
 * Handles bookmark stuff - import/export and bookmarks bar syncing
 * Extension send bookmarksBar data at startup and on changes. syncBookmarksBar() creates or updates the associated BTAppNodes
 * App send exportBookmarks on local changes which get synced to bar by Extension
 * exportBookmarks results in a bookmarksBarIds message which updates the bookmarkId of each BTAppNode
 * We don't bother trying to manage individual changes, we just resync the whole thing every time.
 ***/

function importBookmarks() {
    // Send msg to result in subsequent loadBookmarks, set waiting status and close options pane
    $('body').addClass('waiting');
    sendMessage({'function': 'getBookmarks'});
}

function loadBookmarks(msg) {
    // handler for bookmarks_imported received when Chrome bookmarks are push to local.storage
    // nested {title: , url: , children: []}

    if (msg.result != 'success') {
        alert('Bookmark permissions denied');
        $('body').removeClass('waiting');
        return;
    }

    const dateString = getDateString().replace(':', '∷');        // 12:15 => :15 is a sub topic
    const importName = "🔖 Bookmark Import (" + dateString + ")";
    const importNode = new BTAppNode(importName, null, "", 1);

    msg?.data?.bookmarks?.children.forEach(node => {
        loadBookmarkNode(node, importNode);
    });
    gtag('event', 'BookmarkImport', {'event_category': 'Import'});

    processImport(importNode.id);                             // saveBT etc, see background.js
}

function loadBookmarkNode(bkNode, parent) {
    // load a new bkNode from bookmark export format as child of parent BTNode and recurse on children
    // returns an array of the ids of all new bkNodes created

    if (bkNode?.url?.startsWith('javascript:')) return []; // can't handle JS bookmarklets
    
    const title = bkNode.url ? `[[${bkNode.url}][${bkNode.title}]]` : bkNode.title;
    const btNode = new BTAppNode(title, parent.id, "", parent.level + 1);
    btNode.bookmarkId = bkNode.id;                            // Store the Chrome bookmark ID
    const newNodes = [btNode.id];
    
    if (btNode.level > 2)                 // keep things tidy
        btNode.folded = true;
    if (!bkNode.children || bkNode.children.length == 0) return newNodes;

    // handle children
    bkNode.children.forEach(n => {
        let hasKids = n?.children?.length || 0;
        let isJS = n?.url?.startsWith('javascript:') || false;          // can't handle JS bookmarklets
        if (isJS) return;
        if (hasKids) {
            // recurse
            const nn = loadBookmarkNode(n, btNode);
            newNodes.push(...nn);
        } else {
            // deal with link children
            const title = n.url ? `[[${n.url}][${n.title}]]` : n.title;
            const nn = new BTAppNode(title, btNode.id, "", btNode.level + 1);
            nn.bookmarkId = n.id;                                       // Store the Chrome bookmark ID
            newNodes.push(nn.id);
        }
    });

    // return array of created nodes ids
    return newNodes;
}

function syncBookmarksBar(msg) {
    // bar has changed, sync btappnode tree to match

    const bookmarksBarNode = AllNodes.find(node => node && node.isBookmarksBar());
    if (msg.result != 'success' || !bookmarksBarNode) 
        return;

    // Set to track which bookmark IDs we've processed
    const processedIds = new Set();
    
    // recursively process folder and subfolders
    if (msg.data.bookmarksBar && msg.data.bookmarksBar.children) {
        bookmarksBarNode.bookmarkId = msg.data.bookmarksBar.id;             // Store the Chrome bookmarks bar ID
        processFolderContents(msg.data.bookmarksBar.children, bookmarksBarNode);
    }
    
    // Remove bookmarks that no longer exist and save/update
    removeUnprocessedBookmarks(bookmarksBarNode, processedIds);
    initializeUI();
    saveBT();
    
    // Helper function to process a folder's contents
    function processFolderContents(bookmarks, parentNode) {
        // Process each bookmark
        bookmarks.forEach(bookmark => {
            if (bookmark?.url?.startsWith('javascript:')) return; // Skip JS bookmarklets
            
            // Find existing node by bookmark ID
            const existingNode = BTAppNode.findFromBookmark(bookmark.id);
            
            // Update, create, or recurse based on node type
            if (existingNode) {
                // Update existing node
                syncBookmarkNode(existingNode, bookmark, parentNode.id);
                processedIds.add(existingNode.id);
                // if bookmark is a folder recurse on its children
                if (bookmark.children && bookmark.children.length > 0) {
                    processFolderContents(bookmark.children, existingNode);
                }
            } else {
                // Create new node hierarchy
                const newNodes = loadBookmarkNode(bookmark, parentNode);
                // newNodes is an array of ids, add them to the processIds set and update display
                newNodes.forEach(id => {
                    const node = AllNodes[id];
                    const parentNode = AllNodes[node.parentId];
                    $("table.treetable").treetable("loadBranch", parentNode.getTTNode(), node.HTML());
                    node.populateFavicon();
                    processedIds.add(id)
                });
            }
        });
    }
      
    function removeUnprocessedBookmarks(node, processedIds) {
        // Remove nodes with bookmark IDs that weren't processed
        [...node.childIds].forEach(childId => {
            const childNode = AllNodes[childId];
            if (!childNode) return;
            
            // Check if this node has children to process first
            if (childNode.childIds.length) {
                removeUnprocessedBookmarks(childNode, processedIds);
            }
            
            // If this node has a bookmarkId but wasn't processed, delete it
            if (childNode.bookmarkId && !processedIds.has(childNode.id)) {
                deleteNode(childNode.id);
            }
        });
    }
}

function syncBookmarkNode(node, bookmark, parentId) {
    // Sync the properties of a bookmark node with the corresponding BTAppNode
    node.title = bookmark.url ? `[[${bookmark.url}][${bookmark.title}]]` : bookmark.title;
    node.URL = bookmark.url;

    const parent = AllNodes[parentId];
    if ((parent.bookmarkId != bookmark.parentId) || (node.indexInParent() != bookmark.index)) {
        const oldParentId = node.parentId;

        // Need to find new index. 
        // Use bookmark.index to find position in parent, then find previous display node        
        // If not at position 0, find the node that should be above our target position
        let sibling = parent, newIndex = 0;
        if (bookmark.index > 0 && parent.childIds.length > 0) {
            // Try to find the sibling at the position right before our target index
            const siblingIndex = Math.min(bookmark.index - 1, parent.childIds.length - 1);
            newIndex = siblingIndex+1;
            const siblingId = parent.childIds[siblingIndex];
            sibling = AllNodes[siblingId];
        }

        // Perform the move operation
        node.handleNodeMove(parentId, newIndex);        // Update parent and index
        const nodeTr = $(`tr[data-tt-id='${node.id}']`)[0];
        const sibTr = $(`tr[data-tt-id='${sibling.id}']`)[0];
        const treeTable = $("#content");
        treeTable.treetable("move", node.id, parentId);
        positionNode(nodeTr, parentId, sibTr);          // sort into position

        // update tree row if oldParent is now childless
        if (oldParentId && (AllNodes[oldParentId].childIds.length == 0)) {
            const ttNode = $("#content").treetable("node", oldParentId);
            $("#content").treetable("unloadBranch", ttNode);
        }
    } else {
        node.redisplay();
    }
}



function animateNewImport(id) {
    // Helper for bookmark import, draw attention
    const node = AllNodes[id];
    if (!node) return;
    const element = $(`tr[data-tt-id='${node.id}']`)[0];
	element.scrollIntoView({block: 'center'});
    /*
    $('html, body').animate({
        scrollTop: $(element).offset().top
    }, 750);
*/
    $(element).addClass("attention",
                        {duration: 2000,
                         complete: function() {
                             $(element).removeClass("attention", 2000);
                         }});
}

function exportBookmarks() {
    // generate minimal AllNodes for background to operate on
    const nodeList = AllNodes.map(n => {
        if (!n) return null;
        return {'displayTopic': n.displayTopic, 'URL': n.URL, 'parentId': n.parentId, 'childIds': n.childIds.slice()};
    });
    const dateString = getDateString().replace(':', '∷');        // 12:15 => :15 is a sub topic
    sendMessage({'function': 'localStore',
                        'data': {'AllNodes': nodeList,
                                 title: 'BrainTool Export ' + dateString}});

    // wait briefly to allow local storage too be written before background tries to access
    setTimeout(() => sendMessage({'function': 'exportBookmarks'}), 100);
    gtag('event', 'BookmarkExport', {'event_category': 'Export'});
}

function exportBookmarksBar() {
    // Find bookmarks bar node, iterate and recurse on its children to generate the bookmarksNode
    // hierarchy as consumed by syncBookmarksBar on the background side
    
    const bookmarksBarNode = AllNodes.find(node => node && node.isBookmarksBar());
    if (!bookmarksBarNode) {
        console.warn("No Bookmarks Bar node found in BrainTool");
        return;
    }
    
    // Generate children array directly - don't try to modify the bookmarks bar itself
    const bookmarksBarChildren = [];
    
    // Process node and its children recursively
    function processNodes(btNode, bookmarkNodes) {
        // Add each child to the bookmarkNode's children array
        btNode.childIds.forEach(childId => {
            const childNode = AllNodes[childId];
            if (!childNode) return;
            
            // Create bookmark object based on node type (folder or link)
            const bookmark = {
                id: childNode.bookmarkId || null,
                btNodeId: childNode.id,
                title: childNode.displayTopic,
                url: childNode.URL || undefined,
                index: childNode.indexInParent()
            };
            
            // If it's a folder (no URL), prepare for children
            if (!childNode.URL) {
                bookmark.children = [];
                // Recurse for folder's children
                processNodes(childNode, bookmark.children);
            }
            
            // Add to parent's children array
            bookmarkNodes.push(bookmark);
        });
    }
    
    // Start processing from bookmarks bar node's children
    processNodes(bookmarksBarNode, bookmarksBarChildren);
    
    // Send to background for syncing with Chrome's bookmarks bar
    sendMessage({
        'function': 'localStore',
        'data': {'bookmarksBarChildren': bookmarksBarChildren}
    });
    
    // Wait briefly to allow local storage to be written before background tries to access
    setTimeout(() => sendMessage({'function': 'syncBookmarksBar'}), 100);
}

function bookmarksBarIds(msg) {
    // msg.data.idMapping  is a map of BTAppNode ids to bookmark Ids. Loop thru and update the AllNodes items
    if (msg.result !== 'success' || !msg.data || !msg.data.idMapping) {
        console.warn("Failed to receive bookmark ID mappings");
        return;
    }
    
    // Simple loop to update bookmark IDs
    for (const [btNodeId, bookmarkId] of Object.entries(msg.data.idMapping)) {
        const node = AllNodes[btNodeId];
        if (node) {
            node.bookmarkId = bookmarkId;
        }
    }
}