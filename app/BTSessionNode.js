'use strict';

import { callBackground, sendMessage } from './extensionMessaging.js';
import { BTAppNode } from './BTAppNode.js';
import { AllNodes } from './BTNode.js';
import { getProp } from './configManager.js';
import { requestBrowserSnapshot } from './sessionManager.js';

const SessionNodeType = Object.freeze({
    ROOT: 'ROOT',
    WINDOW: 'WINDOW',
    GROUP: 'GROUP',
    TAB: 'TAB',
});

class BTSessionNode extends BTAppNode {
    static nextWindowIndex = 1;

    constructor(title, parentId = null, text = '', level = 1, options = {}) {
        super(title, parentId, text, level, options.firstChild);
        this.isSessionNode = true;
        this.sessionType = options.sessionType || SessionNodeType.TAB;
    }

    static generateWindowTitle() {
        return `Window ${BTSessionNode.nextWindowIndex++}`;
    }

    static findOrCreateSessionRoot() {
        const existing = AllNodes.find(
            node => node && node.isSessionNode && node.sessionType === SessionNodeType.ROOT,
        );
        if (existing) return existing;

        const root = new BTSessionNode('🌐 CURRENT SESSION', null, '', 1, {
            sessionType: SessionNodeType.ROOT,
        });
        root.folded = true;
        root.createDisplayNode();
        return root;
    }

    allowedRowActions() {
        return {
            open: false,
            openInNewWindow: false,
            close: true,
            delete: false,
            addChild: false,
            promote: false,
            edit: true,
            todo: true,
            drag: true,
        };
    }

    rowClassList() {
        const classes = super.rowClassList().filter(cls => cls !== 'emptyTopic');       // session nodes are never empty
        if (!classes.includes('sessionNode')) classes.push('sessionNode');
        if (this.isRepresentedInTopicTree()) classes.push('inTopicTree');
        return classes;
    }

    titleSpanClassList() {
        const classes = super.titleSpanClassList();
        if (!classes.includes('sessionTitle')) classes.push('sessionTitle');
        return classes;
    }

    isRepresentedInTopicTree() {
        switch (this.sessionType) {
        case SessionNodeType.TAB:
            if (!this.tabId) return false;
            return !!BTAppNode.findFromTab(this.tabId, { isSession: false });
        case SessionNodeType.GROUP:
            if (!this.tabGroupId) return false;
            return !!BTAppNode.findFromGroup(this.tabGroupId, { isSession: false });
        default:
            return false;
        }
    }

    redisplay(show=false) {
        const tree = $("table.treetable");
        if (!tree?.length) {
            super.redisplay(show);
            if (!this.isTopic()) this.populateFavicon();
            return;
        }

        tree.treetable("removeNode", this.id);
        this.displayNode = null;

        const parentNode = (this.parentId || this.parentId === 0) ? AllNodes[this.parentId] : null;
        parentNode?.createDisplayNode();

        this.createDisplayNode();
        if (this.isTopic()) {
            if (this.folded) tree.treetable("collapseNode", this.id);
            else tree.treetable("expandNode", this.id);
        }

        super.redisplay(show);
        if (!this.isTopic()) this.populateFavicon();
        this.setTGColor(this.tgColor ?? null);

        this.childIds.forEach(childId => {
            const child = AllNodes[childId];
            child?.redisplay(false);
        });
    }

    
    setTGColor(color = null) {
        super.setTGColor(color);
        const displayNode = this.getDisplayNode();
        if (!displayNode) return;
        const row = $(displayNode);
        const colorClasses = ['tggrey', 'tgblue', 'tgred', 'tgyellow', 'tggreen', 'tgpink', 'tgpurple', 'tgcyan', 'tgorange'];
        const inTopicTree = this.isRepresentedInTopicTree();
        if (!inTopicTree && !this.isTopic()) {
            const selector = this.isTopic() ? '.btTitle' : '.btTitle span.btTitleText';
            $(displayNode).find(selector).removeClass([...colorClasses, 'tabgroup']);
        }
    }

    isBottomTabInGroup() {
        // Check if this TAB is the last child in a GROUP
        // Used to determine if dropping below this TAB should act as sibling to the parent GROUP
        if (this.sessionType !== SessionNodeType.TAB) return false;
        
        const parent = this.parentId ? AllNodes[this.parentId] : null;
        if (!parent || parent.sessionType !== SessionNodeType.GROUP) return false;
        
        // Check if this node is the last child of the parent GROUP
        const lastChildId = parent.childIds[parent.childIds.length - 1];
        return lastChildId === this.id;
    }

    canAcceptDrop(targetNode) {
        // targetNode is being dragged can it be dropped onto this node?
        if (!targetNode) return false;
        
        // ==== SESSION-TO-SESSION DROPS (moving existing session nodes) ====
        if (targetNode.isSessionNode) {
            switch (this.sessionType) {
                case SessionNodeType.ROOT:
                    // ROOT accepts any session node type (TAB/GROUP create new window)
                    return true;
                
                case SessionNodeType.WINDOW:
                    // WINDOW accepts GROUP and TAB
                    return targetNode.sessionType === SessionNodeType.GROUP || 
                           targetNode.sessionType === SessionNodeType.TAB;
                
                case SessionNodeType.GROUP:
                    if (this.folded) {
                        // Collapsed GROUP: acts as sibling, accepts GROUP/TAB 
                        return targetNode.sessionType === SessionNodeType.GROUP || 
                               targetNode.sessionType === SessionNodeType.TAB;
                    } else {
                        // Expanded GROUP: accepts TAB into the group
                        return targetNode.sessionType === SessionNodeType.TAB;
                    }
                
                case SessionNodeType.TAB:
                    // TAB accepts TAB for repositioning - check if this TAB's parent can accept the target TAB
                    if (targetNode.sessionType == SessionNodeType.WINDOW) return false;
                    
                    const thisParent = this.parentId ? AllNodes[this.parentId] : null;
                    if (!thisParent || !thisParent.isSessionNode) return false;
                    
                    // if this is the bottom tabNode in a group then allow groupa and tabs -> peers to parent group
                    const isBottomTab = this.isBottomTabInGroup();
                    if (isBottomTab) {
                        return targetNode.sessionType === SessionNodeType.GROUP || 
                               targetNode.sessionType === SessionNodeType.TAB;
                    }
                    // Check if this TAB's parent can accept the dragged TAB
                    return thisParent.canAcceptDrop(targetNode);
                
                default:
                    return false;
            }
        }
        
        // ==== APP-NODE-TO-SESSION DROPS (opening unopened items) ====
        if (targetNode.tabId) return false;  // Already open, can't drop
        
        switch (this.sessionType) {
            case SessionNodeType.ROOT:
                // ROOT accepts any unopened item/topic (opens in new window)
                return true;
            
            case SessionNodeType.WINDOW:
                // WINDOW accepts any unopened item/topic
                return true;
            
            case SessionNodeType.GROUP:
                if (this.folded) {
                    // Collapsed GROUP: acts as sibling to window, check parent's ability to accept
                    const parentNode = this.parentId ? AllNodes[this.parentId] : null;
                    if (!parentNode || !parentNode.isSessionNode) return false;
                    
                    // Parent must be WINDOW to accept any appNode
                    return parentNode.sessionType === SessionNodeType.WINDOW;
                } else {
                    // Expanded GROUP: only accepts single items matching this group's topic
                    if (targetNode.isTopic()) return false;
                    
                    const itemParent = targetNode.parentId ? AllNodes[targetNode.parentId] : null;
                    if (!itemParent) return false;
                    
                    // Item's parent topic must match group's title
                    return this.title === itemParent.title;
                }
            
            case SessionNodeType.TAB:
                // TAB accepts drops based on its parent
                const parentNode = this.parentId ? AllNodes[this.parentId] : null;
                if (!parentNode || !parentNode.isSessionNode) return false;
                
                if (parentNode.sessionType === SessionNodeType.WINDOW) {
                    // TAB in WINDOW: accepts any appNode (topics or items)
                    return true;
                } else if (parentNode.sessionType === SessionNodeType.GROUP) {
                    // If this is the bottom tab in the group, allow any appNode as sibling to parent group
                    const isBottomTab = this.isBottomTabInGroup();
                    if (isBottomTab) {
                        return true;  // Accept any appNode (will open as sibling to the group in the window)
                    }
                    
                    // TAB in GROUP (not bottom): only accepts items matching group's topic
                    if (targetNode.isTopic()) return false;
                    
                    const itemParent = targetNode.parentId ? AllNodes[targetNode.parentId] : null;
                    if (!itemParent) return false;
                    
                    return parentNode.title === itemParent.title;
                }
                
                return false;
            
            default:
                return false;
        }
    }


    canMoveTo(parentNode) {
        if (this.sessionType === SessionNodeType.ROOT) return false;
        if (!parentNode) return false;
        if (!parentNode.isSessionNode) return false;        // will handle sessionNodes dropped into app hierarchy here

        switch (parentNode.sessionType) {
        case SessionNodeType.ROOT:
            return true;                                    // anything can drop into the top level. Tab/group => new window created to hold it
        case SessionNodeType.WINDOW:
            return (this.sessionType === SessionNodeType.GROUP) || (this.sessionType === SessionNodeType.TAB);
        case SessionNodeType.GROUP:
            return this.sessionType === SessionNodeType.TAB;
        default:
            return false;
        }
    }

    orgText() {
        return '';
    }

    orgTextwChildren() {
        return '';
    }

    storeAlias() {
        return;
    }

    async groupAndPosition(left = 0) {
        // Topic node fn to (re)group open tabs and put them in correct order
        // If caller has required info it can tell us the index of leftmost tab.

        if (!this.isTopic() || ((getProp('BTGroupingMode') || 'TABGROUP') != 'TABGROUP') || this.trashed) return;
        let tabInfo = [];
        const myWin = this.windowId;
        const myTG = this.tabGroupId;
        let newLeft = Number.MAX_SAFE_INTEGER;
        this.childIds.forEach(id => {
            const node = AllNodes[id];
            if (!node.tabId) return;
            this.tabGroupId = myTG || node.tabGroupId;          // tab might be moved to new TG/win
            this.windowId = myWin || node.windowId;
            newLeft = Math.min(node?.expectedTabIndex(), newLeft);
            const index = node?.expectedTabIndex() || 0;
            tabInfo.push({'nodeId': id, 'tabId': node.tabId, 'tabIndex': index});
        });
        const result = await sendMessage(
            {'function': 'groupAndPositionTabs', 'tabGroupId': this.tabGroupId,
            'windowId': this.windowId, 'tabInfo': tabInfo,
            'groupName': this.topicName(), 'topicId': this.id,
            'leftmostTabIndex': left || newLeft } );
        setTimeout(() => sendMessage({ from: 'btwindow', function: 'syncBrowserSnapshot' }), 100);
    }

    async updateTabGroup() {
        // set TG in browser to appropriate name/folded state
        let rsp;
        if (this.tabGroupId && this.isTopic())
            rsp = await sendMessage({'function': 'updateGroup', 'tabGroupId': this.tabGroupId,
                                  'collapsed': this.folded, 'title': this.topicName()});
        if (rsp?.status == 'error') this.tabGroupId = 0; // if error, reset tabGroupId
        return rsp;
    }

    handleNodeMove(newP, index = -1, browserAction = false) {
        const oldTabGroupId = this.tabGroupId;
        const oldWindowId = this.windowId;
        super.handleNodeMove(newP, index, browserAction);
        //super.handleNodeMove(newP, index, true);        // set browserAction to avoid duplicate tab moves in browser

        if (this.sessionType === SessionNodeType.GROUP) {
            if (!this.tabGroupId || browserAction) return;

            const newParent = newP ? AllNodes[newP] : null;
            if (!newParent || newParent.isTrash()) return;

            const windowNode = newParent.sessionType === SessionNodeType.WINDOW
                ? newParent
                : (newParent.sessionType === SessionNodeType.GROUP ? AllNodes[newParent.parentId] : null);
            if (!windowNode) return;

            this.windowId = windowNode.windowId || this.windowId;

            const groupTabs = this.childIds
                .map(id => AllNodes[id])
                .filter(node => node?.sessionType === SessionNodeType.TAB);
            if (!groupTabs.length) return;

            const flattenedTabs = [];
            windowNode.childIds.forEach(childId => {
                const node = AllNodes[childId];
                if (!node) return;
                if (node.sessionType === SessionNodeType.GROUP) {
                    node.childIds.forEach(tabId => {
                        const tabNode = AllNodes[tabId];
                        if (tabNode?.sessionType === SessionNodeType.TAB) flattenedTabs.push(tabNode);
                    });
                } else if (node.sessionType === SessionNodeType.TAB) {
                    flattenedTabs.push(node);
                }
            });

            const firstTabNode = groupTabs[0];
            let targetIndex = flattenedTabs.findIndex(node => node.id === firstTabNode.id);
            if (targetIndex < 0) targetIndex = flattenedTabs.length;

            this.tabIndex = targetIndex;
            groupTabs.forEach((tabNode, offset) => {
                tabNode.windowId = this.windowId;
                tabNode.tabGroupId = this.tabGroupId;
                tabNode.tabIndex = targetIndex + offset;
            });

            callBackground({
                'function': 'moveTabGroup',
                'tabGroupId': this.tabGroupId,
                'windowId': this.windowId,
                'index': targetIndex
            });
            return;
        }

        if (!this.tabId || browserAction) return;

        const newParent = newP ? AllNodes[newP] : null;
        if (!newParent || newParent.isTrash()) return;
        if (newParent.tabGroupId) {
            // Group placements rely on base handling
            this.windowId = newParent.windowId || this.windowId;
            this.tabGroupId = newParent.tabGroupId;
            requestBrowserSnapshot();
            return;
        }

        const windowNode = newParent.sessionType === SessionNodeType.WINDOW
            ? newParent
            : (newParent.sessionType === SessionNodeType.GROUP ? AllNodes[newParent.parentId] : null);
        if (!windowNode) return;

        this.windowId = windowNode.windowId || oldWindowId;
        this.tabGroupId = 0;

        if (oldTabGroupId && oldTabGroupId > 0) {
            sendMessage({ 'function': 'ungroup', 'tabIds': [this.tabId] });
        }

        const flattenedTabs = [];
        windowNode.childIds.forEach(childId => {
            const node = AllNodes[childId];
            if (!node) return;
            if (node.sessionType === SessionNodeType.GROUP) {
                node.childIds.forEach(tabId => {
                    const tabNode = AllNodes[tabId];
                    if (tabNode?.sessionType === SessionNodeType.TAB) flattenedTabs.push(tabNode);
                });
            } else if (node.sessionType === SessionNodeType.TAB) {
                flattenedTabs.push(node);
            }
        });

        let targetIndex = flattenedTabs.findIndex(node => node.id === this.id);
        if (targetIndex < 0) targetIndex = flattenedTabs.length;

        this.tabIndex = targetIndex;
        this.setTGColor(null);

        sendMessage({
            'function': 'moveTab',
            'tabId': this.tabId,
            'windowId': this.windowId,
            'index': targetIndex
        });                             // NB subsequent tabMoved event will trigger snapshot request
    }

    isSessionRoot() {
        return this.sessionType === SessionNodeType.ROOT;
    }
}

export { BTSessionNode, SessionNodeType };
