/* BrainTool, AGPL-3.0-or-later. Explicit, session-only research sharing. */
import {AllNodes} from './BTNode.js';
import {createResearchScope} from './webmcpResearch.js';
import {registerResearchTools} from './webmcpTools.js';

const panel = document.createElement('details');
panel.id = 'webmcp-research';
const heading = document.createElement('summary');
heading.textContent = 'Research tools (WebMCP)';
const description = document.createElement('p');
description.textContent = 'Share saved topics, links and notes beneath one topic with browser agents. This grants read access only, until disabled or this page closes. Changes invalidate the shared snapshot.';
const select = document.createElement('select');
select.setAttribute('aria-label', 'Research topic to share');
const refresh = document.createElement('button');
refresh.type = 'button'; refresh.textContent = 'Refresh topics';
const enable = document.createElement('button');
enable.type = 'button'; enable.textContent = 'Enable read access';
const disable = document.createElement('button');
disable.type = 'button'; disable.textContent = 'Disable read access'; disable.disabled = true;
const status = document.createElement('p');
status.setAttribute('role', 'status');
let stop;
let pending = false;
let generation = 0;
let controller;
let activeScope;
function updateTopics() {
    if (stop || pending) return;
    select.replaceChildren();
    for (const node of AllNodes) {
        if (!node || node.isSessionNode || node.trashed || node.isTrash?.() || !node.isTopic()) continue;
        const option = document.createElement('option');
        option.value = String(node.id);
        option.textContent = `${node.displayTopic || node.title} (#${node.id})`;
        select.append(option);
    }
    enable.disabled = !document.modelContext?.registerTool || !select.options.length || !!stop;
}
function revoke() {
    stop?.(); stop = undefined;
    disable.disabled = true;
    refresh.disabled = false;
    select.disabled = false;
    status.textContent = 'Read access disabled.';
    updateTopics();
}
refresh.addEventListener('click', updateTopics);
disable.addEventListener('click', revoke);
enable.addEventListener('click', async () => {
    if (pending || stop) return;
    pending = true;
    const startedGeneration = generation;
    controller = new AbortController();
    enable.disabled = true;
    refresh.disabled = true;
    select.disabled = true;
    let scope;
    try {
        scope = createResearchScope(() => AllNodes, Number(select.value), crypto.randomUUID());
        activeScope = scope;
        stop = await registerResearchTools(document.modelContext, scope, controller);
        if (startedGeneration !== generation) { stop(); stop = undefined; return; }
        disable.disabled = false;
        refresh.disabled = true;
        select.disabled = true;
        status.textContent = 'Three read-only tools registered. Shared content is saved data, not fetched page content.';
    } catch (error) {
        scope?.revoke();
        status.textContent = startedGeneration === generation ? `Read access unavailable: ${error.message}` : 'Read access disabled.';
    } finally {
        pending = false;
        if (!stop) {
            refresh.disabled = false;
            select.disabled = false;
            updateTopics();
        }
    }
});
panel.addEventListener('toggle', () => { if (panel.open) updateTopics(); });
window.addEventListener('pagehide', () => {
    generation++;
    activeScope?.revoke();
    controller?.abort();
    stop?.();
});
window.addEventListener('pageshow', () => {
    if (generation && !pending) revoke();
});
status.textContent = document.modelContext?.registerTool ? 'Read access disabled.' : 'Native WebMCP is unavailable. BrainTool remains usable.';
panel.append(heading, description, select, refresh, enable, disable, status);
document.body.append(panel);
updateTopics();
