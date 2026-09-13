import {BTNode, AllNodes} from '../app/BTNode.js';

// Ground truth belongs to the fixture, not to the production classifier.
export const pages = [
    {path: 'shared.html', categories: ['Education', 'Memory'], state: 'read', claim: 'Caching can reuse computation.'},
    {path: 'shared.html?language=en', categories: ['Education'], state: 'read', claim: 'An explicit URL variant; preserve the original.'},
    {path: 'counterpoint.html', categories: ['Memory'], state: 'read', claim: 'Caching alone cannot preserve a changed instruction.'},
    {path: 'missing.html', categories: ['Memory'], state: 'unavailable', claim: 'Not read; no conclusions about its content.'},
    {path: 'unread.html', categories: ['Education'], state: 'discovered', claim: 'Discovered but not yet reviewed.'}
];

export function researchFixture() {
    AllNodes.length = 0;
    const root = new BTNode('Website research');
    root.text = 'Question: when is caching useful? Keep conflicting evidence and missing pages visible.';
    const topics = Object.fromEntries(['Education', 'Memory'].map(name => [name, new BTNode(name, root.id)]));
    for (const page of pages) {
        for (const category of page.categories) {
            const node = new BTNode(`[[http://127.0.0.1:8768/tests/research-site/${page.path}][${page.path}]]`, topics[category].id);
            node.text = `Review state: ${page.state}. ${page.claim}`;
        }
    }
    new BTNode('Unshared human workspace');
    return {root, topics};
}
