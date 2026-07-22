'use strict';

import { registerMessageHandler, requestBrowserSnapshot } from './extensionMessaging.js';
import { BTSessionNode, SessionNodeType } from './BTSessionNode.js';
import { BTAppNode } from './BTAppNode.js';
import { AllNodes } from './BTNode.js';
import { initializeUI } from './tableManager.js';
import { buttonHide } from './rowManager.js';
import { getProp, setProp } from './configManager.js';

let lastSyncErrorTime = 0;

function removeSessionSubtree() {
    // Remove the session root and all its descendants from both the treetable/DOM and AllNodes.
    const root = AllNodes.find(n => n && n.isSessionNode && n.sessionType === SessionNodeType.ROOT);
    if (!root) return;
    const tree = $("table.treetable");
    const removeRec = nodeId => {
        const node = AllNodes[nodeId];
        if (!node) return;
        node.childIds.slice().forEach(removeRec);
        if (tree?.length && tree.treetable("node", nodeId)) tree.treetable("removeNode", nodeId);
        if (node.parentId != null && AllNodes[node.parentId]) AllNodes[node.parentId].removeChild(nodeId);
        delete AllNodes[nodeId];
    };
    removeRec(root.id);
}

function hideSessionTree() {
    // Close the live session view: persist the choice so syncToBrowser stops rebuilding it,
    // then tear down the current subtree. Re-enable via showSessionTree (Settings / turning the
    // session-manager toggle back on).
    setProp('BTShowSession', 'HIDDEN');
    removeSessionSubtree();
}

function showSessionTree() {
    // Re-enable the live session view and rebuild it from a fresh browser snapshot.
    setProp('BTShowSession', 'SHOWN');
    requestBrowserSnapshot();
}

function stripURLForComparison(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch (err) {
        return url.split(/[?#]/)[0] || '';
    }
}

function clearSessionTree(rootNode) {
    // Remove any previously created session nodes beneath the session root.
    if (!rootNode?.childIds?.length) return;
    const tree = $("table.treetable");

    function removeNodeRecursive(nodeId) {
        const node = AllNodes[nodeId];
        if (!node) return;
        node.childIds.slice().forEach(removeNodeRecursive);
        if (tree?.length) tree.treetable("removeNode", nodeId);
        if (node.parentId != null && AllNodes[node.parentId]) {
            AllNodes[node.parentId].removeChild(nodeId);
        }
        delete AllNodes[nodeId];
    }

    rootNode.childIds.slice().forEach(childId => removeNodeRecursive(childId));
    rootNode.childIds.splice(0, rootNode.childIds.length);
}

function buildSessionTree(tabs = [], tabGroups = []) {
    // Create the full session tree hierarchy from the launch payload.
    if (getProp('BTShowSession') === 'HIDDEN') {
        // Session view closed by the user - honor it across reloads/launch, don't build.
        removeSessionSubtree();
        return;
    }
    const root = BTSessionNode.findOrCreateSessionRoot();
    clearSessionTree(root);
    const btTabId = getProp('BTTabId');
    const btWindowId = getProp('BTWindowId');

    const groupsById = new Map();
    tabGroups.forEach(group => {
        if (!group || group.id == null) return;
        if (btWindowId != null && group.windowId === btWindowId) return;
        groupsById.set(group.id, group);
    });

    const windows = new Map();
    const windowOrder = [];
    const groupsToCollapse = [];

    tabs.forEach(tab => {
        if (!tab || tab.windowId == null) return;
        if (btWindowId != null && tab.windowId === btWindowId) return;
        if (btTabId != null && tab.id === btTabId) return;
        let windowEntry = windows.get(tab.windowId);
        if (!windowEntry) {
            windowEntry = { tabs: [], order: windowOrder.length, windowId: tab.windowId };
            windows.set(tab.windowId, windowEntry);
            windowOrder.push(tab.windowId);
        }
        windowEntry.tabs.push(tab);
    });

    windowOrder
        .map(windowId => windows.get(windowId))
        .filter(Boolean)
        .sort((a, b) => a.order - b.order)
        .forEach(windowEntry => {
            const windowId = windowEntry.windowId;
            if (btWindowId != null && windowId === btWindowId) return;
            
            // Find the active tab for this window to append to title
            const activeTab = windowEntry.tabs.find(tab => tab.active);
            const baseWindowTitle = BTSessionNode.generateWindowTitle();
            const windowTitle = activeTab && activeTab.title 
                ? `${baseWindowTitle} - ${activeTab.title}` 
                : baseWindowTitle;
            
            const windowNode = new BTSessionNode(windowTitle, root.id, '', root.level + 1, {
                sessionType: SessionNodeType.WINDOW,
            });
            windowNode.windowId = windowId;
            windowNode.createDisplayNode();

            const tabsForWindow = windowEntry.tabs
                .slice()
                .sort((a, b) => (a.tabIndex ?? a.index ?? 0) - (b.tabIndex ?? b.index ?? 0));

            const createdGroups = new Map();

            tabsForWindow.forEach(tab => {
                if (btTabId != null && tab.id === btTabId) return;
                const groupId = tab.groupId || tab.tabGroupId || 0;
                let parentNode = windowNode;

                if (groupId > 0 && groupsById.has(groupId)) {
                    let groupNode = createdGroups.get(groupId);
                    if (!groupNode) {
                        const groupInfo = groupsById.get(groupId) || {};
                        const groupTitle = groupInfo.title || `Tab Group ${groupId}`;
                        groupNode = new BTSessionNode(groupTitle, windowNode.id, '', windowNode.level + 1, {
                            sessionType: SessionNodeType.GROUP,
                        });
                        groupNode.windowId = windowId;
                        groupNode.tabGroupId = groupId;
                        groupNode.createDisplayNode();
                        createdGroups.set(groupId, groupNode);
                        if (groupInfo?.color) {
                            groupNode.setTGColor(groupInfo.color);
                        }
                        if (groupInfo?.collapsed) {
                            groupNode.folded = true;
                            groupsToCollapse.push(groupNode.id);
                        }
                    }
                    parentNode = groupNode;
                }

                const tabTitle = tab.url ? `[[${tab.url}][${tab.title || tab.url}]]` : (tab.title || 'Untitled Tab');
                const tabNode = new BTSessionNode(tabTitle, parentNode.id, '', parentNode.level + 1, {
                    sessionType: SessionNodeType.TAB,
                });
                tabNode.tabId = tab.id;
                tabNode.windowId = windowId;
                tabNode.tabGroupId = groupId;
                tabNode.tabIndex = tab.tabIndex ?? tab.index ?? 0;
                tabNode.faviconUrl = tab.favIconUrl || tabNode.faviconUrl;
                tabNode.createDisplayNode();
                tabNode.populateFavicon();
                if (parentNode?.sessionType === SessionNodeType.GROUP) updateGroupTabIndex(parentNode);
                if (parentNode?.sessionType === SessionNodeType.GROUP) {
                    tabNode.setTGColor(parentNode.tgColor || null);
                }
            });
        });

    root.folded = false;
    const tree = $("table.treetable");
    if (tree?.length) {
        tree.treetable("expandNode", root.id);
        groupsToCollapse.forEach(groupId => tree.treetable("collapseNode", groupId));
    }
    initializeUI();
}

function indicateActiveTab(windowNode, tabList) {
    // Update window title to include active tab name and add arrow indicator to active tab's indenter
    if (!windowNode || !tabList) return;
    
    const activeTab = tabList.find(tab => tab.active);
    const baseWindowTitle = BTSessionNode.generateWindowTitle();
    const windowTitle = activeTab && activeTab.title 
        ? `${baseWindowTitle} - ${activeTab.title}` 
        : baseWindowTitle;
    
    // Update window title if it has changed
    if (windowNode.title !== windowTitle) {
        windowNode.title = windowTitle;
        const displayNode = windowNode.getDisplayNode?.();
        if (displayNode) {
            $(displayNode).find('span.btTitleText').text(windowNode.displayTopic || '');
        }
    }
    
    // Update indenter spans to show active tab with arrow
    windowNode.childIds.forEach(childId => {
        const childNode = AllNodes[childId];
        if (!childNode) return;
        
        const updateIndenterForNode = (node) => {
            if (!node || node.sessionType !== SessionNodeType.TAB) return;
            const displayNode = node.getDisplayNode?.();
            if (!displayNode) return;
            
            const $indenter = $(displayNode).find('td.left span.indenter');
            if (!$indenter.length) return;
            
            const isActiveTab = node.tabId && activeTab && node.tabId === activeTab.id;
            const currentText = $indenter.text();
            const hasArrow = currentText.includes('▬▶');
            const multiplier = node.level - 1;
            
            if (isActiveTab && !hasArrow) {
                $indenter.text('▬▶' + currentText);
                // Adjust padding to compensate for arrow width
                const newStyle = `padding-left: calc(var(--btIndentStepSize) * ${multiplier} - 8px)`;
                $indenter.attr('style', newStyle);
            } else if (!isActiveTab && hasArrow) {
                $indenter.text(currentText.replace('▬▶', ''));
                // Restore normal padding
                const newStyle = `padding-left: calc(var(--btIndentStepSize) * ${multiplier})`;
                $indenter.attr('style', newStyle);
            }
        };
        
        if (childNode.sessionType === SessionNodeType.GROUP) {
            childNode.childIds.forEach(tabId => {
                const tabNode = AllNodes[tabId];
                updateIndenterForNode(tabNode);
            });
        } else {
            updateIndenterForNode(childNode);
        }
    });
}

function syncToBrowser(tabs = [], tabGroups = []) {
    // Snapshot reconciliation algorithm:
    // 1. Build lookup maps from the snapshot for tab groups and tabs bucketed by window.
    // 2. Ensure each window, group, and tab in the snapshot exists in the session tree, reparenting as needed without reordering window nodes.
    // 3. Refresh node metadata (title, indices, favicons, group styling) and order children to mirror Chrome.
    // 4. Remove session nodes missing from the snapshot while preserving the BrainTool window/tab exclusions.
    // The implementation below follows those steps with careful tracking to avoid unnecessary DOM churn.
    if (getProp('BTShowSession') === 'HIDDEN') {
        // Session view closed by the user - don't rebuild it; tear down anything that snuck back.
        removeSessionSubtree();
        return;
    }
    const root = BTSessionNode.findOrCreateSessionRoot();
    if (!root) return;
    
    const tree = $("table.treetable");
    const btTabId = getProp('BTTabId');
    const btWindowId = getProp('BTWindowId');
    
    // --- Step 1a: Map tab groups by id for quick lookup during reconciliation.
    const groupsById = new Map();
    tabGroups.forEach(group => {
        if (!group || group.id == null) return;
        groupsById.set(group.id, group);
    });
    
    // --- Step 1b: Organize tabs by window (ignoring the BrainTool window/tab) to preserve window ordering.
    const tabsByWindow = new Map();
    tabs.forEach(tab => {
        if (!tab || tab.windowId == null) return;
        if (btWindowId != null && tab.windowId === btWindowId) return;
        if (btTabId != null && tab.id === btTabId) return;
        let entry = tabsByWindow.get(tab.windowId);
        if (!entry) {
            entry = [];
            tabsByWindow.set(tab.windowId, entry);
        }
        entry.push(tab);
    });
    
    // --- Step 1c: Prepare tracking sets to flag which existing nodes remain in the snapshot and which require re-sorting.
    const seenWindowNodeIds = new Set();
    const seenGroupNodeIds = new Set();
    const seenTabNodeIds = new Set();
    const groupsNeedingSort = new Set();
    const windowsNeedingSort = new Set();
    
    // --- Step 1d: Snapshot current window nodes for reuse instead of recreating them.
    const existingWindowNodes = new Map();
    root.childIds
    .map(id => AllNodes[id])
    .filter(node => node?.sessionType === SessionNodeType.WINDOW)
    .forEach(node => existingWindowNodes.set(node.windowId, node));
    
    // --- Utility: remove a node and all descendants from the session tree (used for deletes).
    const removeNodeRecursive = nodeId => {
        const node = AllNodes[nodeId];
        if (!node) return;
        
        // First recursively remove all children
        node.childIds.slice().forEach(childId => removeNodeRecursive(childId));
        
        // Remove from treetable's internal structure
        if (tree?.length) {
            const treeNode = tree.treetable("node", nodeId);
            if (treeNode) {
                tree.treetable("removeNode", nodeId);
            }
        }
        
        // Clean up parent relationship
        if (node.parentId != null && AllNodes[node.parentId]) {
            AllNodes[node.parentId].removeChild(nodeId);
        }
        
        // Finally delete from AllNodes
        delete AllNodes[nodeId];
    };
    
    // --- Utility helpers: mark groups/windows for final ordering work once all adjustments are known.
    const markGroupForSort = groupNode => {
        if (!groupNode || groupNode.sessionType !== SessionNodeType.GROUP) return;
        groupsNeedingSort.add(groupNode);
    };
    
    const markWindowForSort = windowNode => {
        if (!windowNode || windowNode.sessionType !== SessionNodeType.WINDOW) return;
        windowsNeedingSort.add(windowNode);
    };
    
    // --- Step 2: Traverse each window in the snapshot and reconcile its structure and metadata.
    try {
        tabsByWindow.forEach((tabList, windowId) => {
            // -- 2a: Reuse or create the window node.
            let windowNode = existingWindowNodes.get(windowId);
            
            if (!windowNode) {
                const baseWindowTitle = BTSessionNode.generateWindowTitle();
                windowNode = new BTSessionNode(baseWindowTitle, root.id, '', root.level + 1, {
                    sessionType: SessionNodeType.WINDOW,
                });
                windowNode.windowId = windowId;
                windowNode.createDisplayNode();
                existingWindowNodes.set(windowId, windowNode);
            }
            windowNode.windowId = windowId;
            seenWindowNodeIds.add(windowNode.id);
            let windowChanged = false;
            
            // -- 2b: Work through tabs in the browser-reported order to mirror Chrome's strip.
            const sortedTabs = tabList
            .slice()
            .sort((a, b) => (a.tabIndex ?? a.index ?? 0) - (b.tabIndex ?? b.index ?? 0));
            
            const groupsProcessed = new Map();
            
            sortedTabs.forEach(tab => {
                // Skip invalid entries or anything representing the BrainTool window/tab.
                if (!tab) return;
                const tabId = tab.id;
                if (tabId == null) return;
                if (btTabId != null && tabId === btTabId) return;
                
                // -- 2c: Determine the target parent node (window or tab group) for this tab.
                const groupId = tab.groupId || tab.tabGroupId || 0;
                let parentNode = windowNode;
                let groupNode = null;
                
                if (groupId > 0) {
                    // Reuse the group node if it's already handled for this window; otherwise create/realign it.
                    groupNode = groupsProcessed.get(groupId);
                    if (!groupNode) {
                        const sourceGroup = groupsById.get(groupId) || {};
                        const existingGroupNode = BTAppNode.findFromGroup(groupId, { isSession: true }) || null;
                        const previousParentId = existingGroupNode?.parentId ?? null;
                        groupNode = ensureSessionGroup(windowNode, { id: groupId, title: sourceGroup.title });
                        if (!groupNode) return;
                        groupNode.tabGroupId = groupId;
                        groupNode.windowId = windowId;
                        
                        const displayNode = groupNode.getDisplayNode?.();
                        if (sourceGroup.title && groupNode.title !== sourceGroup.title) {
                            groupNode.title = sourceGroup.title;
                        }
                        if (displayNode) {
                            $(displayNode).find('span.btTitleText').text(groupNode.displayTopic || '');
                        }
                        if (Object.prototype.hasOwnProperty.call(sourceGroup, 'color')) {
                            const desiredColor = sourceGroup.color || null;
                            if ((groupNode.tgColor || null) !== desiredColor) {
                                groupNode.setTGColor(desiredColor);
                            }
                        }
                        if (Object.prototype.hasOwnProperty.call(sourceGroup, 'collapsed')) {
                            const collapsed = !!sourceGroup.collapsed;
                            if (groupNode.folded !== collapsed && tree?.length) {
                                groupNode.folded = collapsed;
                                if (collapsed) tree.treetable("collapseNode", groupNode.id);
                                else tree.treetable("expandNode", groupNode.id);
                            } else {
                                groupNode.folded = collapsed;
                            }
                        }
                        
                        // Sync notes from corresponding app node (topic with matching tabGroupId)
                        const appNode = BTAppNode.findFromGroup(groupId, { isSession: false });
                        if (appNode && appNode.text && groupNode.text !== appNode.text) {
                            groupNode.text = appNode.text;
                            const displayNode = groupNode.getDisplayNode();
                            if (displayNode) {
                                $(displayNode).find('span.btText').html(groupNode.displayText());
                            }
                        }
                        
                        groupsProcessed.set(groupId, groupNode);
                        markWindowForSort(windowNode);
                        windowChanged = true;
                        if (previousParentId != null && previousParentId !== groupNode.parentId) {
                            const previousParent = AllNodes[previousParentId];
                            if (previousParent?.sessionType === SessionNodeType.WINDOW) {
                                markWindowForSort(previousParent);
                            } else if (previousParent?.sessionType === SessionNodeType.GROUP) {
                                markGroupForSort(previousParent);
                            }
                            windowChanged = true;
                        }
                    }
                    // Ensure the group lives under the correct window before assigning the tab to it.
                    if (groupNode.parentId !== windowNode.id) {
                        groupNode.reparentNode(windowNode.id);
                        groupNode.level = windowNode.level + 1;
                        if (tree?.length) tree.treetable("move", groupNode.id, windowNode.id);
                        markWindowForSort(windowNode);
                        windowChanged = true;
                    }
                    groupNode.windowId = windowId;
                    parentNode = groupNode;
                    seenGroupNodeIds.add(groupNode.id);
                }
                
                const tabIndex = tab.tabIndex ?? tab.index ?? 0;
                const tabURL = tab.url || '';
                const tabTitleText = tab.title || tabURL;
                const tabTitle = tabURL ? `[[${tabURL}][${tabTitleText || tabURL}]]` : (tabTitleText || 'Untitled Tab');
                let tabNode = BTAppNode.findFromTab(tabId, { isSession: true });
                
                const desiredGroupId = groupId > 0 ? groupId : 0;
                const desiredParentId = parentNode.id;
                
                if (!tabNode) {
                    // -- 2d: Create missing tab nodes, populate key metadata, and note that ordering updates are required.
                    tabNode = new BTSessionNode(tabTitle, parentNode.id, '', parentNode.level + 1, {
                        sessionType: SessionNodeType.TAB,
                    });
                    tabNode.tabId = tabId;
                    tabNode.windowId = windowId;
                    tabNode.tabGroupId = desiredGroupId;
                    tabNode.tabIndex = tabIndex;
                    tabNode.faviconUrl = tab.favIconUrl || null;
                    
                    // Sync notes from corresponding app node if it exists and URL host matches
                    const appNode = BTAppNode.findFromTab(tabId, { isSession: false });
                    if (appNode && appNode.text) {
                        const appURLKey = stripURLForComparison(appNode.URL);
                        const tabURLKey = stripURLForComparison(tabURL);
                        if (appURLKey === tabURLKey) {
                            tabNode.text = appNode.text;
                        }
                    }
                    
                    tabNode.createDisplayNode();
                    tabNode.populateFavicon();
                    
                    // Update text display after node is created
                    if (tabNode.text) {
                        const displayNode = tabNode.getDisplayNode();
                        if (displayNode) {
                            $(displayNode).find('span.btText').html(tabNode.displayText());
                        }
                    }
                    windowChanged = true;
                    if (groupNode) {
                        markGroupForSort(groupNode);
                    } else {
                        markWindowForSort(windowNode);
                    }
                } else {
                    const previousParentId = tabNode.parentId;
                    const previousGroupId = tabNode.tabGroupId || 0;
                    const previousIndex = tabNode.tabIndex ?? 0;
                    const previousFavicon = tabNode.faviconUrl || null;
                    const previousURLKey = stripURLForComparison(tabNode.URL);
                    tabNode.tabId = tabId;
                    let parentChanged = false;
                    let titleChanged = false;
                    let faviconChanged = false;
                    
                    if (tabTitle && tabNode.title !== tabTitle) {
                        tabNode.title = tabTitle;
                        titleChanged = true;
                    }
                    
                    const updatedURLKey = stripURLForComparison(tabNode.URL);
                    const hostChanged = updatedURLKey !== previousURLKey;

                    // Mirror the saved note only while the tab is on a saved page. Look up the
                    // saved app node by the tab's CURRENT url (not its stale tabId association) so
                    // the note clears when the tab navigates away and returns when it comes back.
                    const savedNode = BTAppNode.findFromURLTGWin(tabNode.URL, desiredGroupId, windowId, { isSession: false });
                    const desiredText = savedNode?.text || '';
                    if (tabNode.text !== desiredText) {
                        tabNode.text = desiredText;
                        const displayNode = tabNode.getDisplayNode();
                        if (displayNode) {
                            $(displayNode).find('span.btText').html(tabNode.displayText());
                        }
                    }
                    
                    if (tabNode.parentId !== desiredParentId) {
                        const previousParent = previousParentId != null ? AllNodes[previousParentId] : null;
                        tabNode.reparentNode(desiredParentId);
                        tabNode.level = parentNode.level + 1;
                        if (tree?.length) tree.treetable("move", tabNode.id, desiredParentId);
                        parentChanged = true;
                        windowChanged = true;
                        if (previousParent?.sessionType === SessionNodeType.GROUP) markGroupForSort(previousParent);
                        else if (previousParent?.sessionType === SessionNodeType.WINDOW) markWindowForSort(previousParent);
                        if (parentNode.sessionType === SessionNodeType.GROUP) markGroupForSort(parentNode);
                        else markWindowForSort(windowNode);
                    }
                    
                    if (tabNode.windowId !== windowId) {
                        tabNode.windowId = windowId;
                        windowChanged = true;
                    }
                    
                    if (previousGroupId !== desiredGroupId) {
                        tabNode.tabGroupId = desiredGroupId;
                        windowChanged = true;
                        if (groupNode) markGroupForSort(groupNode);
                        if (previousParentId != null) {
                            const previousParent = AllNodes[previousParentId];
                            if (previousParent?.sessionType === SessionNodeType.GROUP) markGroupForSort(previousParent);
                        }
                    }
                    
                    if (previousIndex !== tabIndex) {
                        tabNode.tabIndex = tabIndex;
                        windowChanged = true;
                        if (parentNode.sessionType === SessionNodeType.GROUP) markGroupForSort(parentNode);
                        else markWindowForSort(windowNode);
                    } else {
                        tabNode.tabIndex = tabIndex;
                    }
                    
                    const nextFavicon = tab.favIconUrl || null;
                    if (nextFavicon) {
                        if ((nextFavicon || '') !== (previousFavicon || '')) {
                            tabNode.faviconUrl = nextFavicon;
                            faviconChanged = true;
                        }
                    } else if (hostChanged) {
                        tabNode.faviconUrl = null;
                        faviconChanged = true;
                    }
                    
                    let needsFaviconRefresh = faviconChanged;
                    if (typeof tabNode.redisplay === 'function' && (titleChanged || parentChanged)) {
                        tabNode.redisplay();
                        needsFaviconRefresh = true;
                    }
                    if (needsFaviconRefresh) tabNode.populateFavicon();
                }
                
                seenTabNodeIds.add(tabNode.id);
                
                if (groupNode) {
                    tabNode.setTGColor(groupNode.tgColor || null);
                } else {
                    tabNode.setTGColor(null);
                }
            });
            
            if (windowChanged) markWindowForSort(windowNode);
        });
        
        // --- Step 3: Remove any windows/groups/tabs that disappeared from the snapshot.
        root.childIds.slice().forEach(windowNodeId => {
            const windowNode = AllNodes[windowNodeId];
            if (!windowNode || windowNode.sessionType !== SessionNodeType.WINDOW) return;
            if (btWindowId != null && windowNode.windowId === btWindowId) return;
            if (!seenWindowNodeIds.has(windowNode.id)) {
                removeNodeRecursive(windowNode.id);
                return;
            }
            
            windowNode.childIds.slice().forEach(childId => {
                const childNode = AllNodes[childId];
                if (!childNode) return;
                if (childNode.sessionType === SessionNodeType.GROUP) {
                    if (!seenGroupNodeIds.has(childNode.id)) {
                        const parentBeforeRemoval = childNode.parentId != null ? AllNodes[childNode.parentId] : null;
                        removeNodeRecursive(childNode.id);
                        if (parentBeforeRemoval?.sessionType === SessionNodeType.WINDOW) markWindowForSort(parentBeforeRemoval);
                        return;
                    }
                    childNode.childIds.slice().forEach(grandChildId => {
                        const grandChild = AllNodes[grandChildId];
                        if (!grandChild || grandChild.sessionType !== SessionNodeType.TAB) return;
                        if (btTabId != null && grandChild.tabId === btTabId) return;
                        if (!seenTabNodeIds.has(grandChild.id)) {
                            const parentBeforeRemoval = grandChild.parentId != null ? AllNodes[grandChild.parentId] : null;
                            removeNodeRecursive(grandChild.id);
                            if (parentBeforeRemoval?.sessionType === SessionNodeType.GROUP) markGroupForSort(parentBeforeRemoval);
                            else if (parentBeforeRemoval?.sessionType === SessionNodeType.WINDOW) markWindowForSort(parentBeforeRemoval);
                        }
                    });
                    if (!childNode.childIds.length) {
                        const parentBeforeRemoval = childNode.parentId != null ? AllNodes[childNode.parentId] : null;
                        removeNodeRecursive(childNode.id);
                        if (parentBeforeRemoval?.sessionType === SessionNodeType.WINDOW) markWindowForSort(parentBeforeRemoval);
                    } else {
                        markGroupForSort(childNode);
                    }
                } else if (childNode.sessionType === SessionNodeType.TAB) {
                    if (btTabId != null && childNode.tabId === btTabId) return;
                    if (!seenTabNodeIds.has(childNode.id)) {
                        const parentBeforeRemoval = childNode.parentId != null ? AllNodes[childNode.parentId] : null;
                        removeNodeRecursive(childNode.id);
                        if (parentBeforeRemoval?.sessionType === SessionNodeType.GROUP) markGroupForSort(parentBeforeRemoval);
                        else if (parentBeforeRemoval?.sessionType === SessionNodeType.WINDOW) markWindowForSort(parentBeforeRemoval);
                    }
                }
            });
        });
        
        // --- Step 4: Apply ordering fixes and metadata updates just for the nodes touched above.
        groupsNeedingSort.forEach(groupNode => {
            if (!groupNode || AllNodes[groupNode.id] !== groupNode) return;
            updateGroupTabIndex(groupNode);
            sortSessionChildrenByTabIndex(groupNode);
        });
        windowsNeedingSort.forEach(windowNode => {
            if (!windowNode || AllNodes[windowNode.id] !== windowNode) return;
            sortSessionChildrenByTabIndex(windowNode);
            
            const tabList = tabsByWindow.get(windowNode.windowId);
            if (tabList) {
                // update the active tab with indicator arrow and window with title
                indicateActiveTab(windowNode, tabList);
            }
        });
        
        // Defer initializeUI to next tick to ensure DOM is fully updated after all removals/moves
        setTimeout(() => initializeUI(), 0);
    } catch (err) {
        console.error("Error during syncToBrowser:", err);
        const now = Date.now();
        const timeSinceLastError = now - lastSyncErrorTime;
        // Only retry if it's been more than 2 seconds since the last error (prevents infinite retry loop)
        if (timeSinceLastError > 2000) {
            console.log("Retrying sync once...");
            lastSyncErrorTime = now;
            setTimeout(() => {
                requestBrowserSnapshot();
            }, 600);
        } else {
            console.error("Recent sync error detected, not retrying to avoid infinite loop");
        }
    }
}

function applySessionNodeClasses() {
    // Apply CSS classes to session nodes based on whether they're saved in the topic tree
    // For unsaved nodes, modify DOM to use colspan to span full width
    AllNodes.forEach(node => {
        if (!node?.isSessionNode) return;
        const displayNode = node.getDisplayNode();
        if (!displayNode) return;
        
        const $row = $(displayNode);
        const $leftCell = $row.find('td.left');
        const $rightCell = $row.find('td.right');
        const isInTopicTree = node.isRepresentedInTopicTree();
        
        // Apply unsaved styling to: ROOT, WINDOW, and non-topic nodes not in topic tree
        const isUnsaved = (node.sessionType === SessionNodeType.ROOT) ||
                          (node.sessionType === SessionNodeType.WINDOW) ||
                          (!node.isTopic() && !isInTopicTree);
        
        if (isUnsaved) {
            // Modify DOM: make left cell span both columns, hide right cell
            $row.addClass('unsaved');
            $leftCell.attr('colspan', '2');
            $rightCell.hide();
        } else {
            // Restore normal two-column layout
            $row.removeClass('unsaved');
            $leftCell.removeAttr('colspan');
            $rightCell.show();
        }
    });
}

function handleSyncToBrowserMessage(message) {
    const tabs = message?.tabs || [];
    const tabGroups = message?.tabGroups || [];
    syncToBrowser(tabs, tabGroups);
    applySessionNodeClasses();              // Apply display classes based on save status
    BTAppNode.setDisplayOrder();            // Display order may have changed
}

function handleSnapshotTriggeredEvent(message) {
    if (message.function == "tabNavigated") {
        const tabId = message.tabId;
        if (tabId == null) return;
        const sessionTabNode = BTAppNode.findFromTab(tabId, { isSession: true });
        if (message.tabURL == sessionTabNode?.url()) {
            console.log("tabNavigated same from/to urls, ignoring: ", message.tabURL);
            return;
        }
    }
    requestBrowserSnapshot();
}

async function handleLaunchApp(message) {
    // Handle launch by building the initial session tree.
    const tabs = message?.all_tabs || [];
    const tabGroups = message?.all_tgs || [];
    buildSessionTree(tabs, tabGroups);
}

function sortSessionChildrenByTabIndex(parentNode) {
    // Keep the rendered children ordered to match the browser tab strip.
    if (!parentNode) return;
    const tree = $("table.treetable");
    if (parentNode.sessionType === SessionNodeType.WINDOW) {
        parentNode.childIds
            .map(id => AllNodes[id])
            .filter(node => node?.sessionType === SessionNodeType.GROUP)
            .forEach(groupNode => updateGroupTabIndex(groupNode));
    }
    const children = parentNode.childIds
        .map(id => AllNodes[id])
        .filter(Boolean)
        .sort((a, b) => (a.tabIndex ?? a.tabId ?? 0) - (b.tabIndex ?? b.tabId ?? 0));
    parentNode.childIds = children.map(child => child.id);
    
    // Only move nodes that actually exist in the treetable
    const iterationOrder = (parentNode.sessionType === SessionNodeType.WINDOW)
        ? [...children].reverse()
        : children;
    
    iterationOrder.forEach(child => {
        // Verify both child and parent exist in treetable before attempting move
        const childNode = tree.treetable("node", child.id);
        const parentTreeNode = tree.treetable("node", parentNode.id);
        if (childNode && parentTreeNode) {
            tree.treetable("move", child.id, parentNode.id);
        }
    });
}

function ensureSessionWindow(windowId) {
    // Ensure a window session node exists for the provided window id.
    const root = BTSessionNode.findOrCreateSessionRoot();
    let windowNode = BTAppNode.findFromWindow(windowId, { isSession: true });
    if (!windowNode) {
        const windowTitle = BTSessionNode.generateWindowTitle();
        windowNode = new BTSessionNode(windowTitle, root.id, '', root.level + 1, {
            sessionType: SessionNodeType.WINDOW,
        });
        windowNode.windowId = windowId;
        windowNode.createDisplayNode();
        initializeUI();
    }
    return windowNode;
}

function ensureSessionGroup(windowNode, groupInfo) {
    // Ensure a tab group session node exists for the supplied window and group.
    if (!windowNode || !groupInfo || !groupInfo.id) return null;
    let groupNode = BTAppNode.findFromGroup(groupInfo.id, { isSession: true });
    if (!groupNode) {
        const groupTitle = groupInfo.title || `Tab Group ${groupInfo.id}`;
        groupNode = new BTSessionNode(groupTitle, windowNode.id, '', windowNode.level + 1, {
            sessionType: SessionNodeType.GROUP,
        });
        groupNode.windowId = windowNode.windowId;
        groupNode.tabGroupId = groupInfo.id;
        groupNode.createDisplayNode();
        if (groupInfo?.color) groupNode.setTGColor(groupInfo.color);
        if (groupInfo?.collapsed) groupNode.folded = true;
    } else {
        if (groupNode.parentId !== windowNode.id) {
            groupNode.reparentNode(windowNode.id);
            groupNode.level = windowNode.level + 1;
            const tree = $("table.treetable");
            if (tree?.length) tree.treetable("move", groupNode.id, windowNode.id);
        }
        groupNode.windowId = windowNode.windowId;
    }
    if (groupInfo?.color) groupNode.setTGColor(groupInfo.color);
    return groupNode;
}

function updateGroupTabIndex(groupNode) {
    if (!groupNode || groupNode.sessionType !== SessionNodeType.GROUP) return;
    const childIndices = groupNode.childIds
        .map(id => AllNodes[id])
        .filter(Boolean)
        .map(node => node.tabIndex)
        .filter(index => index != null);
    if (childIndices.length) {
        groupNode.tabIndex = Math.min(...childIndices);
    }
}

function removeGroupIfEmpty(groupNode) {
    if (!groupNode || groupNode.sessionType !== SessionNodeType.GROUP) return;
    if (groupNode.childIds.length) return;
    const tree = $("table.treetable");
    const parentId = groupNode.parentId;
    const parent = parentId != null ? AllNodes[parentId] : null;
    if (tree?.length) tree.treetable("removeNode", groupNode.id);
    if (parent) parent.removeChild(groupNode.id);
    delete AllNodes[groupNode.id];
}

function handleTabGroupUpdated(message) {
    const { tabGroupId, tabGroupWindowId } = message;
    if (tabGroupId == null) return;

    const windowNode = tabGroupWindowId != null ? ensureSessionWindow(tabGroupWindowId) : null;

    const groupInfo = { id: tabGroupId };
    if (Object.prototype.hasOwnProperty.call(message, 'tabGroupColor')) {
        groupInfo.color = message.tabGroupColor || null;
    }
    if (message.tabGroupName) groupInfo.title = message.tabGroupName;
    if (Object.prototype.hasOwnProperty.call(message, 'tabGroupCollapsed')) {
        groupInfo.collapsed = message.tabGroupCollapsed;
    }

    let groupNode = BTAppNode.findFromGroup(tabGroupId, { isSession: true });
    if (windowNode) {
        groupNode = ensureSessionGroup(windowNode, groupInfo) || groupNode;
    }
    if (!groupNode) return;

    if (!windowNode && Object.prototype.hasOwnProperty.call(message, 'tabGroupColor')) {
        groupNode.setTGColor(message.tabGroupColor || null);
    }

    if (groupInfo.title && groupNode.title !== groupInfo.title) {
        groupNode.title = groupInfo.title;
    }

    const displayNode = groupNode.getDisplayNode?.();
    if (displayNode) {
        $(displayNode).find('span.btTitleText').text(groupNode.displayTopic || '');
    }

    if (groupInfo.collapsed != null) {
        const tree = $("table.treetable");
        groupNode.folded = !!groupInfo.collapsed;
        if (tree?.length) {
            if (groupInfo.collapsed) tree.treetable("collapseNode", groupNode.id);
            else tree.treetable("expandNode", groupNode.id);
        }
    }
}

function initializeSessionManager() {
    // Register session manager message handlers.
    registerMessageHandler('launchApp', handleLaunchApp);
    registerMessageHandler('syncToBrowser', handleSyncToBrowserMessage);
    registerMessageHandler('tabGroupUpdated', handleTabGroupUpdated);

    [
        'tabNavigated',
        'tabMoved',
        'tabJoinedTG',
        'tabLeftTG',
        'tabGroupRemoved',
        'tabClosed',
        'tabActivated',
        'windowCreated',
    ].forEach(eventName => registerMessageHandler(eventName, handleSnapshotTriggeredEvent));
}

function syncAppNodesToBrowser(message) {
    /**
     * Synchronize app node ordering to match browser tab positions.
     * 
     * This function ensures that app nodes (the persisted topic tree) are reordered to match
     * the actual tab positions in the browser. When tabs are moved in tab groups in the browser,
     * the corresponding app nodes should be reordered to maintain consistency.
     * 
     * Algorithm:
     * 1. Build lookup maps of tabs by their IDs for efficient access
     * 2. Iterate through all tabs and find corresponding app nodes
     * 3. For each app node with a tab, compare its expected position (expectedTabIndex) 
     *    with the actual browser tab position (tabIndex)
     * 4. If positions differ, move the node to the correct position using handleNodeMove
     * 5. Set browserAction=true to prevent triggering circular browser updates
     */

    const tabs = message?.tabs || [];
    const tabGroups = message?.tabGroups || [];
    const btTabId = getProp('BTTabId');
    const btWindowId = getProp('BTWindowId');
    console.log("syncAppNodesToBrowser called with", tabs.length, "tabs and", tabGroups.length, "tab groups");
    
    // --- Step 1: Build lookup map of tabs by tab ID for efficient access
    const tabsById = new Map();
    tabs.forEach(tab => {
        if (!tab || tab.id == null) return;
        if (btWindowId != null && tab.windowId === btWindowId) return;
        if (btTabId != null && tab.id === btTabId) return;
        tabsById.set(tab.id, tab);
    });
    
    // --- Step 2: Build lookup map of tab groups by ID
    const groupsById = new Map();
    tabGroups.forEach(group => {
        if (!group || group.id == null) return;
        groupsById.set(group.id, group);
    });
    
    // --- Step 3: Track nodes that need reordering
    const nodesToReorder = [];
    
    // --- Step 4: Iterate through tabs and identify app nodes that need repositioning
    tabs.forEach(tab => {
        if (!tab || tab.id == null) return;
        if (btWindowId != null && tab.windowId === btWindowId) return;
        if (btTabId != null && tab.id === btTabId) return;
        
        // Find the app node associated with this tab
        const appNode = BTAppNode.findFromTab(tab.id, { isSession: false });
        if (!appNode) return;
        
        // Get actual browser tab position
        const actualTabIndex = tab.tabIndex ?? tab.index ?? 0;
        
        // Get expected position based on app tree structure
        const expectedTabIndex = appNode.expectedTabIndex();
        
        // If positions differ, mark for reordering
        if (actualTabIndex !== expectedTabIndex) {
            nodesToReorder.push({
                node: appNode,
                actualIndex: actualTabIndex,
                expectedIndex: expectedTabIndex,
                tabGroupId: tab.groupId || tab.tabGroupId || 0
            });
        }
    });
    
    // --- Step 5: Sort nodes by actual tab index to process in correct order
    nodesToReorder.sort((a, b) => a.actualIndex - b.actualIndex);
    
    // --- Step 6: Reorder nodes to match browser tab positions
    nodesToReorder.forEach(({ node, actualIndex, expectedIndex, tabGroupId }) => {
        const parent = node.parentId ? AllNodes[node.parentId] : null;
        if (!parent) return;
        
        // Calculate the new index position within parent's children
        // This is the position among siblings that corresponds to the browser tab order
        const currentIndexInParent = parent.childIds.indexOf(node.id);
        if (currentIndexInParent < 0) return;
        
        // Find where this node should be positioned among its siblings
        // based on the actual tab index
        let newIndexInParent = 0;
        const siblingTabs = parent.childIds
            .map(id => AllNodes[id])
            .filter(n => n && n.tabId && !n.isSessionNode);
        
        // Count how many sibling tabs come before this node's actual tab position
        siblingTabs.forEach(sibling => {
            if (sibling.id === node.id) return;
            const siblingTab = tabsById.get(sibling.tabId);
            if (!siblingTab) return;
            const siblingIndex = siblingTab.tabIndex ?? siblingTab.index ?? 0;
            if (siblingIndex < actualIndex) {
                newIndexInParent++;
            }
        });
        
        // Only move if the position actually needs to change
        if (newIndexInParent !== currentIndexInParent) {
            // Use browserAction=true to indicate this is a browser-initiated change
            // This prevents handleNodeMove from trying to update the browser
            node.handleNodeMove(parent.id, newIndexInParent, true);
            console.log(`Moved app node ${node.title} to index ${newIndexInParent} in parent ${parent.id}`);
        }
    });
    BTAppNode.setDisplayOrder();            // Display order may have changed
}

export { initializeSessionManager, syncToBrowser, syncAppNodesToBrowser, hideSessionTree, showSessionTree };
