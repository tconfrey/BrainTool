---
title: BrainTool Agent Research Access
layout: default
tagline: Share one saved research topic with a compatible browser agent
description: How BrainTool exposes a user-authorized research subtree through optional, read-only WebMCP tools.
audience: user
---

# Agent Research Access

BrainTool and your browser agent are separate tools. The BrainTool side panel remains your workspace for organizing topics, links and notes. When you want an agent to help with saved research, open Topic Manager in a regular browser tab and explicitly share one topic from there.

## Connect an agent to a BrainTool topic

1. Organize the sources you want to share beneath one BrainTool topic.
2. In the side panel, expand **Research tools (WebMCP)** and select **Open Topic Manager for agent access**.
3. In the Topic Manager tab, choose the research topic and select **Enable read access**.
4. Ask your browser agent to find the open BrainTool Topic Manager tab. An agent with browser navigation tools may first list the open tabs and then switch to that tab. Clients that expose these operations as tools commonly call them `get_open_tabs` and `go_to_tab`.
5. The agent can then discover the three BrainTool tools described below. Select **Disable read access**, edit the shared topic, reload or close the page to end the current authorization.

Opening the tab matters: current browser agents discover page tools in top-level tabs. They do not automatically attach to another extension's side panel.

## Available read-only tools

The Topic Manager exposes three read-only WebMCP operations after the user explicitly selects a topic and enables access:

- `braintool_list_topics`: discover the authorized subtree and topic references.
- `braintool_search`: search saved titles, URLs and notes.
- `braintool_read_topic`: read one topic and its immediate children.

Results identify BrainTool Topic Manager, the authorized root, pagination and navigation instructions. They contain saved data, **not retrieved web-page content**. Live session nodes and trash are excluded. Notes and long fields are bounded and truncation is explicit. Editing or rebuilding the selected subtree invalidates the scope; disable and enable again to share its new state.

The BrainTool tools do not open, close or inspect browser tabs. An agent may use its own browser navigation tools to locate the authorized Topic Manager tab. BrainTool adds no model provider, key, service or persistence. Disable access to revoke the scope and remove its tools. Page closure removes the document's registration. When native WebMCP is absent, ordinary BrainTool functionality remains independent of these optional tools.

## Privacy and boundaries

Only saved data beneath the topic you choose is available. The tools do not fetch the contents of saved web pages, inspect current browser tabs, include live sessions or expose trash. Search and read results are bounded. References expire after the selected data changes, preventing an agent from silently continuing against an outdated snapshot.

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

In Chrome 153, the locally installed extension connected to a top-level Topic Manager tab and native discovery plus all three invocations succeeded on the Welcome sample topic. The side panel correctly directed the user to that tab without registering tools inside the embedded view. A separate browser agent then demonstrated the expected first step by listing open tabs to locate BrainTool. The fixture also confirmed that a page reload removes authorization. Seventeen Node tests pass; global ESLint reports zero errors and 39 warnings in existing files.

The DOM test harness covers the unavailable API, embedded handoff and cancellation during registration. It does not simulate every browser agent. Native discovery was verified directly; end-to-end behavior still depends on the agent supporting WebMCP and being allowed to navigate to the Topic Manager tab.
