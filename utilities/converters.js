/***
 *
 * Conversion utilities. Currently just from TabsOutliner json format
 * 
 ***/

// 0) Export from Tabs Outliner to a local file
// 1) Paste the code below as a Code Snippet in Chrome Dev Tools
// 2) Copy the Tabs Outliner exported file contents between the `backticks` in the TabsOutlinerExport variable
// 3) Run the snippet
// 4) Copy the output into your BrainTool.org file and save it (either replacing everything or appending the new nodes)
// 5) Refresh, or rerun, BrainTool

const TabsOutlinerExport = ``;
function tabsToBT(tabsStr) {
    // take a TO export str and output a BT orgmode equivalent
    const tabsJson = JSON.parse(tabsStr);
    const lastIndex = tabsJson.length - 1;
    let node, title, BTText = "";
    tabsJson.forEach((elt, ind) => {
        if (!ind || ind == lastIndex) return;   // ignore first and last elements, TO seems to use them for some special purpose 
        const info = elt[1];
        const nesting = elt[2];
        // Handle window/container type elements
        if (info.type && (info.type == 'win' || info.type == 'savedwin')) {
            node = '*'.repeat(nesting.length);
            title = (info.marks && info.marks.customTitle) ? info.marks.customTitle : 'Window';
            node += ` ${title}\n`;
            BTText += node;
        }
        // Handle tab/link type elements
        if (info.data && info.data.url) {
            node = '*'.repeat(nesting.length);
            title = (info.marks && info.marks.customTitle) ? info.marks.customTitle : info.data.title;
            node += ` [[${info.data.url}][${title}]]\n`;
            BTText += node;
        }
    });
    console.log("Copy this text to your BrainTool.org file:\n");
    console.log(BTText);
}
tabsToBT(TabsOutlinerExport);
