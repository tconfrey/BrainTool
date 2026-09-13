# Optional Topic Manager research tools

The Topic Manager exposes three read-only WebMCP operations after the user explicitly selects a topic and enables access in **Research tools (WebMCP)**:

- `braintool_list_topics`: discover the authorized subtree and topic references.
- `braintool_search`: search saved titles, URLs and notes.
- `braintool_read_topic`: read one topic and its immediate children.

Results identify BrainTool Topic Manager, the authorized root, pagination and navigation instructions. They contain saved data, **not retrieved web-page content**. Live session nodes and trash are excluded. Notes and long fields are bounded and truncation is explicit. Editing or rebuilding the selected subtree invalidates the scope; disable and enable again to share its new state.

No browser tab is opened, closed or inspected. No model provider, key, service or persistence is added. Disable access to revoke the scope and remove its tools. Page closure removes the document's registration. When native WebMCP is absent, ordinary BrainTool functionality remains independent of these optional tools.

## Local checks

From the repository root:

```sh
npm run test:webmcp
npm ci --ignore-scripts
npm run lint
python -m http.server 8768 --bind 127.0.0.1
```

Open `http://127.0.0.1:8768/tests/webmcp-browser.html`. This fixture uses real BTNode objects with synthetic data, not an installed extension or personal data. Enable the research root, discover tools and invoke the list. Change the saved evidence and confirm the next invocation fails; disable access and confirm discovery returns an empty list.

The September 2026 [WebMCP draft](https://webmachinelearning.github.io/webmcp/) uses `document.modelContext` and registration with an AbortSignal. The Chrome instance tested accepted serialized arguments for `executeTool`, while rejecting object arguments. The fixture includes an explicit checkbox for that observed older calling convention. This does not alter production tool callbacks or implement a WebMCP polyfill.

In Chrome 153, the locally installed extension connected to the Topic Manager and native discovery plus all three invocations succeeded on the Welcome sample topic. The fixture also confirmed that a page reload removes authorization. Sixteen Node tests pass; global ESLint reports zero errors and 39 warnings in existing files.

Open `http://localhost:8768/tests/webmcp-iframe.html` to compare cross-origin frames. Native registration was rejected without delegation and discovery plus invocation succeeded with `allow="tools 'src'"`. The side-panel iframe delegates that feature only to its source. Explicit subtree authorization remains necessary. The DOM test harness covers unavailable API and cancellation during registration; it does not simulate native browser permissions.

Actual extension side-panel/iframe validation, a full application run without WebMCP, and independent agent-client selection on the installed Topic Manager remain pending. Do not interpret the fixture or native API calls as proof of those paths.
