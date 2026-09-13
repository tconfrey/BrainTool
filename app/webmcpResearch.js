/* BrainTool, AGPL-3.0-or-later. Optional read-only research projection. */

const visible = node => node && !node.isSessionNode && !node.trashed && !node.isTrash?.();

/** A human grants one subtree. Any rebuild or edit revokes its references.
 * No page fetching, browser-tab access, writes, or persistent permissions.
 */
export function createResearchScope(getNodes, rootId, nonce) {
    if (typeof nonce !== 'string' || !nonce) throw new Error('A unique scope nonce is required');
    let revoked = false;
    const collect = () => {
        const nodes = getNodes();
        const root = nodes[rootId];
        if (!visible(root) || !root.isTopic()) throw new Error('Scope unavailable');
        const result = [], seen = new Set(), pending = [root];
        while (pending.length) {
            const node = pending.pop();
            if (!visible(node) || seen.has(node.id)) continue;
            seen.add(node.id);
            if (seen.size > 10000) throw new Error('Scope exceeds 10000 nodes; choose a smaller topic');
            result.push(node);
            for (const id of [...node.childIds].reverse()) {
                const child = nodes[id];
                if (child?.parentId === node.id) pending.push(child);
            }
        }
        return result;
    };
    const project = node => ({id: node.id, parentId: node.parentId,
        title: String(node.displayTopic ?? node.title), url: String(node.URL || ''),
        note: String(node.text || ''), topic: !!node.isTopic()});
    const original = collect();
    const records = original.map(project);
    const signature = JSON.stringify(records);
    function check() {
        if (revoked) throw new Error('Scope revoked; ask the human to enable it again');
        let current;
        try { current = collect(); }
        catch (error) { revoked = true; throw error; }
        if (current.length !== original.length || current.some((node, i) => node !== original[i]) ||
            JSON.stringify(current.map(project)) !== signature) {
            revoked = true;
            throw new Error('Scope changed; ask the human to enable it again');
        }
    }
    const ref = id => `${nonce}:${id}`;
    function page(items, offset = 0, limit = 10) {
        if (!Number.isInteger(offset) || offset < 0 || offset > items.length ||
            !Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Invalid pagination');
        return {application: 'BrainTool Topic Manager', scope: nonce,
            authorizedRoot: {reference: ref(rootId), title: records[0].title.slice(0, 512)},
            access: 'read-only saved subtree', source: 'saved_brainTool_data', retrievedPageContent: false,
            navigation: 'Use braintool_read_topic with a topic reference; use nextOffset for the next page. Changes require human reauthorization.',
            total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null,
            items: items.slice(offset, offset + limit).map(item => ({
                reference: ref(item.id), title: item.title.slice(0, 512),
                url: item.url.slice(0, 2048), savedNote: item.note.slice(0, 2048),
                truncated: item.title.length > 512 || item.url.length > 2048 || item.note.length > 2048,
                topic: item.topic}))};
    }
    return {
        revoke() { revoked = true; },
        list({offset, limit} = {}) { check(); return page(records.filter(n => n.topic), offset, limit); },
        search({query, offset, limit} = {}) {
            check();
            if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('Query must contain 1–200 characters');
            const term = query.toLocaleLowerCase();
            return page(records.filter(n => `${n.title}\n${n.url}\n${n.note}`.toLocaleLowerCase().includes(term)), offset, limit);
        },
        read({reference, offset, limit} = {}) {
            check();
            const topic = records.find(n => n.topic && ref(n.id) === reference);
            if (!topic) throw new Error('Unknown or stale topic reference');
            return {topic: page([topic]).items[0], ...page(records.filter(n => n.parentId === topic.id), offset, limit)};
        }
    };
}
