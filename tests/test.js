window.LOCALTEST = true;
QUnit.config.reorder = false;
QUnit.config.testTimeout = 45000;
gtag = function() { /* I don't exist under test */};

QUnit.module("BTNode tests", function() {

    QUnit.moduleStart(function(details) {
        if (details.name != "BTNode tests") return;
        console.log("BTNode tests. Set up goes here");
        AllNodes = [];
    });

    QUnit.test("Basic BTNode Tests", function(assert) {
        const node1 = new BTNode("[[https://testing/1/2/3][Test Node]]");
        assert.equal (node1.URL, "https://testing/1/2/3", "getURL");
        const node2 = new BTNode("[[file:file.org][Test Node]]", node1.id);
        assert.equal (node2.URL, "file:file.org", "getURL w file:");
        assert.equal (node2.id, 2, "Ids managed ok");
        assert.equal (node2.parentId, 1, "parent hooked up ok");
        assert.deepEqual (node1.childIds, [2], "child hooked up ok");
	    assert.equal (node2.displayTag, "Test Node", "display Tag ok");
	
	    node2.title = "Pre [[https://testing/1/2/3][Test Node2]] and [[foo][bar]]";
	    assert.equal (node2.displayTag, "Pre Test Node2 and bar", "display Tag updated ok");
	    
	    node2.title = "Pre [[https://testing/1/2/3][]]";
	    assert.equal (node2.displayTag, "Pre https://testing/1/2/3", "display Tag defaults ok");
    });
    QUnit.test('compareURLs', function(assert) {
        assert.ok(BTNode.compareURLs('http://example.com', 'http://example.com'), 'Identical URLs should return true');
        assert.ok(BTNode.compareURLs('http://example.com', 'https://example.com'), 'URLs differing only by http/https should return true');
        assert.ok(BTNode.compareURLs('http://example.com', 'http://example.com/'), 'URLs differing only by trailing slash should return true');
        assert.ok(BTNode.compareURLs('http://docs.google.com/u/1/d/abc', 'http://docs.google.com/d/abc'), 'Google Docs URLs differing only by /u/1/d and /d should return true');
        assert.notOk(BTNode.compareURLs('http://example.com', 'http://example.org'), 'Different URLs should return false');
        assert.ok(BTNode.compareURLs('http://example.com/u/0/123#inbox', 'http://example.com/u/0/123#outbox'), 'Anything after final # should be ignored');
        assert.notOk(BTNode.compareURLs('http://example.com/u/0/123#inbox/app/456', 'http://example.com/u/0/123#outbox/app/456'), 'But only if after final /');
        assert.ok(BTNode.compareURLs('http://mail.google.com/mail/u/0/#inbox', 'http://mail.google.com/mail/u/0/#inbox'), 'Identical Gmail URLs should return true');
        assert.notOk(BTNode.compareURLs('http://mail.google.com/mail/u/0/#inbox', 'http://mail.google.com/mail/u/0/#sent'), 'Different Gmail URLs should return false');
      });
    QUnit.test("Functional BTNode Tests", function(assert) {
	    const n1 = new BTNode("Top Level");
	    const n2 = new BTNode("Second Level", n1.id);
	    const n3 = new BTNode("[[file:somefile][file link]] blah", n2.id);
	    const n4 = new BTNode("[[http://google.com][goog]] also blah", n2.id);
	    assert.ok (n3._hasWebLinks(), "file: links are web links");
	    assert.ok (n4._hasWebLinks(), "http links are web links");
	    assert.ok ((n1._hasWebLinks() && n2._hasWebLinks()), "weblinkage bubbles up to ancestors");
    });

    QUnit.test("Basic BTAppNode Tests", function(assert) {
        const an1 = new BTAppNode("Top Level", null, "AppNode 1", 1);
        const an2 = new BTAppNode("Second Level", an1.id, "AppNode 2", 2);
        const an3 = new BTAppNode("[[file:somefile][file link]] blah", an2.id, "AppNode 3", 3);
        const an4 = new BTAppNode("[[http://google.com][goog]] also blah", an2.id, "AppNode 4", 3);
        assert.equal (an4.level, 3, "Level ok");
        assert.equal (an2.parentId, an1.id, "Parenting ok");
        assert.equal (an4.URL, "http://google.com", "URL passthru ok");
        assert.equal (an4.displayTag, "goog also blah", "displayTag passthru ok");
        assert.equal (an4.displayTitle(), "<a href='http://google.com' class='btlink'>goog</a> also blah", "dispTitle");
        assert.equal (an3.level, 3, "Level ok on creation");
        an2.resetLevel(1);
        assert.equal (an3.level, 2, "Level reset ok");
        assert.notOk (an1.hasOpenChildren(), "initial open captured correctly");
        an4.tabId = 999;
        assert.ok (an2.hasOpenChildren(), "parent openChildren updated ok");
    });
});

QUnit.module("Test inbound browser update messages", function() {
    QUnit.moduleStart(async function(details) {
        if (details.name != "Test inbound browser update messages") return;
        AllNodes = [];
        await new Promise(resolve => setTimeout(resolve, 1000));         // delay to allow launchApp to run and load nodes
    });

    QUnit.test("Test inbound browser update messages", async function(assert) {
        // iterate thru messageSets defined in btContent.test.js asking content script to send them in to app
        const messageSets = ['openTab', 'openTG', 'dragTabIntoTG', 'navigateTabIntoTG', 'storeTab', 'storeTabs', 'storeWindow', 'storeSession']
        // Add a comment line below for each element of messageSets
        // openTab: single tab opened and wrapped
        // openTG: 
        // dragTabIntoTG: BT page into TG1
        // navigateTabIntoTG: 
        // storeTab: New Scratch topic w LogSeq tab
        // storeTabs: another tab under scratch
        // storeWindow: 3 more tabs under scratch
        // storeSession: new Session topic with Window subtopics with 2&3 tabs

        var done = assert.async();
        // iterate thru messagesets 
        for (const messageSet of messageSets) {
            window.postMessage({function: "sendTestMessages", "messageSet": messageSet});
            await new Promise(resolve => setTimeout(resolve, 500));         // half second delay
            assert.ok(true, "Browser says " + messageSet);
        }
    });
});

QUnit.module("Org parsing tests", function() {

    QUnit.moduleStart(async function(details) {
        if (details.name != "Org parsing tests") return;
        await new Promise(resolve => setTimeout(resolve, 1000));         // delay to allow launchApp to run and load nodes
        AllNodes = [];
    });

    QUnit.test("Basic node parse", function(assert) {
        const orgHeader = "* Top Level Header\nassociated notes";
        processBTFile(orgHeader);
        assert.equal (AllNodes.length, 2);
        assert.equal (AllNodes[1].displayTag, "Top Level Header");
        assert.equal (AllNodes[1].text, "associated notes");
    });
    
    QUnit.test("Basic tree parse", function(assert) {
        const orgTree = "* Top Level Header\nassociated notes\n\n** Next Level Header\nnext level notes";
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 3);
        assert.equal (AllNodes[1].displayTag, "Top Level Header");
        assert.equal (AllNodes[1].text, "associated notes");
        assert.equal (AllNodes[2].displayTag, "Next Level Header");
        assert.equal (AllNodes[2].text, "next level notes");
    });
    
    QUnit.test("Headline links parse", function(assert) {
        const orgTree = "* [[https://google.com][Top Level Header]]\ntop level notes";
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 2);
        assert.equal (AllNodes[1].displayTag, "Top Level Header");
        assert.equal (AllNodes[1].URL, "https://google.com");
        assert.equal (AllNodes[1].text, "top level notes");
    });
    
    QUnit.test("Headline w paras parse", function(assert) {
        const orgTree = "* [[https://google.com][Top Level Header]]\ntop level notes first line.\nsecond line";
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 2);
        assert.equal (AllNodes[1].displayTag, "Top Level Header");
        assert.equal (AllNodes[1].URL, "https://google.com");
        assert.equal (AllNodes[1].text, "top level notes first line.\nsecond line");
    });
    
    QUnit.test("Headline w tags parse", function(assert) {
        const orgTree = "* [[https://google.com][Top Level Header]]   :BrainTool:Test:\ntop level notes first line.\n\nsecond line";
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 2);
        assert.equal (AllNodes[1].tags.length, 2);
        assert.equal (AllNodes[1].tags[0], 'BrainTool');
        assert.equal (AllNodes[1].tags[1], 'Test');
        let expect = ' '.repeat(60) + ':BrainTool:Test:';
        assert.equal (expect, AllNodes[1].orgTags(' '), 'tag output test');
    });
    
    QUnit.test("Headline w drawers parse", function(assert) {
        const orgTree = "* [[https://google.com][Top Level Header]]   :BrainTool:Test:\n:PROPERTIES:\n:VISIBILITY: folded\n:OTHERPROP: none\n:END:\ntop level notes first line.\n\nsecond line\n\n* Next thing";
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 3);
        let node = AllNodes[1];
        assert.ok (node.drawers, 'drawers up');
        assert.equal (Object.keys(node.drawers).length, 1, 'key saved');
        assert.equal (node.drawers['PROPERTIES'], ':VISIBILITY: folded\n:OTHERPROP: none', 'drawers clean');
        let drawerText = node.orgDrawers();
        assert.equal (drawerText.replace(/\s/g, ""), ":PROPERTIES::VISIBILITY:folded:OTHERPROP:none:END:", 'drawer reg ok, ignoring whitespace');
    });

    QUnit.test("Output table", function(assert) {
        const orgTree =
`* Top Level
some text
|Header1|header2|
|data 1|data2|
more text
** Sub header
text `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 3);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Unprocessed elements", function(assert) {
        const orgTree =
`* Top Level
start text
#+BEGIN_SRC javascript
const parser = new Parser()
const ast = parser.parse('Hello World')
#+END_SRC
middle text
|table| heading|
|data 1|data2|
end text
------
- [x] build an awesome org-mode parser
- [ ] let people use it everywhere
- orga :: the ultimate org-mode parser
** Sub header
text `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 3);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Text Markup", function(assert) {
        const orgTree =
`* Top Level
start text
_Orga_ is +probably+ the *best* /org-mode/ ~parser~ =alive=.
** Sub header1
text
** Sub header2
text `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 4);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Tags and todos", function(assert) {
        const orgTree =
`* Top Level                      :Test:
_Orga_ is +probably+ the *best* /org-mode/ ~parser~ =alive=.

** TODO Sub header1
text
** DONE Sub header2
text `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 4);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Headline stuff", function(assert) {
        const orgTree =
`* TODO [#A] Hello World   :tag1:tag2:
DEADLINE: <2018-01-01 Mon>
:PROPERTY:
:key0: value0
:key1: value1
:END:
value text `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 2);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Timestamps in Headlines", function(assert) {
        const orgTree =
`* [2021-03-30 Tue 15:40] Men Becoming Wolves | Lapham’s Quarterly     :grasp:
para text
* <2021-03-30 Tue 15:40> Men Becoming Wolves | Lapham’s Quarterly     :grasp:
para text2 `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 3);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    QUnit.test("Spaces before *", function(assert) {
        const orgTree =
`* top 
para text
  * should be just text
para text2 `;
        processBTFile(orgTree);
        assert.equal (AllNodes.length, 2);
        const output = BTAppNode.generateOrgFile();
        assert.equal (output.replaceAll(/\s+/g, ' '), orgTree.replaceAll(/\s+/g, ' '));
    });

    
    QUnit.test("Properties", function(assert) {
        const orgTree =
`#+PROPERTY: prop1 one
#+PROPERTY: BTVersion 3
* Hello World `;
        const nextorgTree =
`#+PROPERTY: prop1 one
#+PROPERTY: BTVersion 4
* Hello World 
`;
        processBTFile(orgTree);
        assert.equal (AllNodes.metaProperties.length, 2, 'found three properties');
        assert.equal (getMetaProp('prop1'), 'one', 'correct prop value');
        const output = BTAppNode.generateOrgFile();
        assert.equal (output, nextorgTree, 'wrote back out correctly');
    });

});


QUnit.module("App tests", function() {

    QUnit.moduleStart(function(details) {
        if (details.name != "App tests") return;
        console.log("here first?");
        //GroupingMode = GroupOptions.NONE;
        window.FileText = "* TODO BrainTool\nBrainTool is a tool\n\n** Category-Tag\nThey are the same\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* Top Level 2                                             :braintool:orgmode:\n";
    });

    QUnit.test("Read default .org file", function(assert) {
        var done = assert.async();
        AllNodes = []; BTNode.topIndex = 1;
        fetch('/app/BrainTool.org')     // fetch template file from bt server
            .then(response => {
                assert.ok(response.ok, "default file response received");
                return response.text();
            })
            .then(text => {
                console.log(text);
                assert.ok(text, "default file contents received");
                processBTFile(window.FileText);
                assert.equal(AllNodes.length, 6, "default file processed");
                assert.deepEqual(AllNodes[1].text,
                                 "BrainTool is a tool",
                                 "top line text looks good");
                var tgs = [
                    {"name":"BrainTool","level":1},
                    {"name":"Category-Tag","level":2},
                    {"name":"Link","level":2},
                    {"name":"Top Level 2","level":1}
                ];
                assert.deepEqual(Tags, tgs, "Tags look good");
                var table = generateTable();
                var t2 = `<table>
<tr data-tt-id='1'>
<td class='left'><span class='btTitle'><b>TODO: </b>BrainTool</span></td>
<td class='right'><span class='btText'>BrainTool is a tool</span></td>
</tr>
<tr data-tt-id='2' data-tt-parent-id='1'>
<td class='left'><span class='btTitle'>Category-Tag</span></td>
<td class='right'><span class='btText'>They are the same</span></td>
</tr>
<tr data-tt-id='3' data-tt-parent-id='1'>
<td class='left'><span class='btTitle'><a href='http://www.link.com' class='btlink'>Link</a></span></td>
<td class='right'><span class='btText'>URL with a name and <a href='http://google.com' class='btlink'>embedded links</a> scattered about.</span></td>
</tr>
<tr data-tt-id='4' data-tt-parent-id='3'>
<td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>embedded links</a></span></td>
<td class='right'><span class='btText'></span></td>
</tr>
<tr data-tt-id='5'><td class='left'><span class='btTitle'>Top Level 2</span></td><td class='right'><span class='btText'></span></td></tr>
</table>`;
                t2 = t2.replace(/[\t\n]+/g, "");
                assert.equal(table, t2, "Table generated correctly");
                assert.equal(BTAppNode.generateOrgFile().replaceAll(/\s+/g, ''),
                             window.FileText.replaceAll(/\s+/g, ''), "Regenerated file text ok");

                assert.equal(BTNode.findFromTitle("Category-Tag"), AllNodes[2], "findFromTitle ok");

                assert.equal("                                             :braintool:orgmode:",
                             AllNodes[5].orgTags("* Top Level 2"),
                             "Tags output ok");
                done();
            });
    });


    QUnit.test("Add New Tag", function(assert) {
        AllNodes = [];
        BTNode.topIndex = 3;
        var node = new BTAppNode("Category-Tag", null, "Link: [[http://google.com][The Goog]]", 1);
        addNewTag("foo");
        assert.equal(AllNodes.length, 5, "Tag node added ok");
        assert.deepEqual(node.HTML(), "<tr data-tt-id='3'><td class='left'><span class='btTitle'>Category-Tag</span></td><td class='right'><span class='btText'>Link: <a href='http://google.com' class='btlink'>The Goog</a></span></td></tr>",  "HTML gen ok");
        assert.deepEqual(BTAppNode.generateOrgFile().trim(), "* Category-Tag\nLink: [[http://google.com][The Goog]]\n\n* foo", "Org file ok");
    });

    
    QUnit.test("Update Row", function(assert) {
        var node = new BTAppNode("Category-Tag", 1, "Link: [[http://google.com][The Goog]]", 2);
        assert.equal(node.displayTitle(), "Category-Tag", "Conversion w no links works");
        
        assert.equal(node.displayText(), "Link: <a href='http://google.com' class='btlink'>The Goog</a>", "Conversion w link works");

        assert.deepEqual(node.orgText().trim(), "** Category-Tag\nLink: [[http://google.com][The Goog]]", "initial org text ok");
        node.title = "Category/Tag";
        node.text = "Same";
        assert.deepEqual(node.orgText().trim(), "** Category/Tag\nSame", "Updated org text ok");
        node.text = "Here's a link [[http://braintool.org][BrainTool site]] and text";
        assert.deepEqual(node.displayText(), "Here's a link <a href='http://braintool.org' class='btlink'>BrainTool site</a> and text", "Conversion w link works");
        assert.deepEqual(node.orgText().trim(), "** Category/Tag\nHere's a link [[http://braintool.org][BrainTool site]] and text", "Updated org text ok");
    });
    
    QUnit.test("Store Tab under tag", function(assert) {
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 1;
        processBTFile(window.FileText);

        storeTabs({tag: "tag1", tabsData: [{url: "http://google.com", title: "The Goog", tabId:100}]});
        assert.equal(8, AllNodes.length, "tag and tab added ok");
        var node = AllNodes[6]; // newly created parent node
        assert.equal(node.childIds.length, 1, "parent knows about child");
        
        assert.deepEqual(BTAppNode.generateOrgFile().replaceAll(/\s+/g, ' '), "* TODO BrainTool\nBrainTool is a tool\n\n** Category-Tag\nThey are the same\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* Top Level 2                                             :braintool:orgmode:\n\n* tag1\n\n** [[http://google.com][The Goog]]\n".replaceAll(/\s+/g, ' '), "file regen ok");
        node = AllNodes[7]; // newly created node
        assert.deepEqual("<tr data-tt-id='7' data-tt-parent-id='6'><td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>The Goog</a></span></td><td class='right'><span class='btText'></span></td></tr>", node.HTML(), "HTML gen looks good");
        storeTabs({tag: "tag2", tabsData: [{url: "http://yahoo.com", title: "Yahoodlers",  tabId: 123}]});
        assert.equal(10, AllNodes.length, "second tag and tab added ok");
        storeTabs({tag: "tag1", tabsData: [{url: "http://gdrive.com", title: "The Cloud"}]});
        assert.equal(11, AllNodes.length, "tab added to first tag ok");
        assert.deepEqual(BTAppNode.generateOrgFile().replaceAll(/\s+/g, ' '),  "* TODO BrainTool\nBrainTool is a tool\n\n** Category-Tag\nThey are the same\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* Top Level 2                                             :braintool:orgmode:\n\n* tag1\n\n** [[http://gdrive.com][The Cloud]]\n\n** [[http://google.com][The Goog]]\n\n* tag2\n\n** [[http://yahoo.com][Yahoodlers]]\n".replaceAll(/\s+/g, ' '), "file regen ok");
    });

    QUnit.test("Delete Row/Node", function(assert) {
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 1;
        processBTFile(window.FileText);
        assert.equal(6, AllNodes.length, "nodes as expected");
        deleteNode(2);
        assert.notOk(AllNodes[2], "nodes as expected after deletion");
        BTFileText = BTAppNode.generateOrgFile();
        assert.deepEqual(BTFileText, "* TODO BrainTool\nBrainTool is a tool\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* Top Level 2                                             :braintool:orgmode:\n", "file cleaned up ok");
    });

    QUnit.test("Open Tabs", function(assert) {
        var done = assert.async();
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.braintool.org][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n*** [[https://github.io][GitHub]]\n";
        assert.ok(window.FileText, "file text available");
        AllNodes = []; BTNode.topIndex = 1;
        processBTFile(window.FileText);
        var node = AllNodes[3];
        setTimeout(function () {
            // not really a unit test but still -
            // a good visual inspection that windows are still being opened.
            // Don't need to run every time:
            
            node.openAll();
            done();}
                   , 4000);
    });

    QUnit.test("Text manipulation", function(assert) {
        var nodeText1 = "Word [[http://www.loink.com][Loink]] end";
        var nodeText2 = "Word [[http://www.loink.com][Loink]] and another [[http://google.com][Goog]] end";
        var nodeText3 = "Word after word then end";
        var nodeText4 = "[[http://www.loink.com][Loink]]";
        assert.equal(BTAppNode._orgTextToHTML(nodeText1), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> end", "single link ok");
        assert.equal(BTAppNode._orgTextToHTML(nodeText2), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> and another <a href='http://google.com' class='btlink'>Goog</a> end", "double link ok");
        assert.equal(BTAppNode._orgTextToHTML(nodeText3), "Word after word then end", "no link ok");
        assert.equal(BTAppNode._orgTextToHTML(nodeText4), "<a href='http://www.loink.com' class='btlink'>Loink</a>", "only link ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var node = new BTAppNode("Category-Tag", 1, longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string chopped ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars w [[http://link.com][a link]] n stuff"
        var node = new BTAppNode("Category-Tag", 1, longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string w late link chopped ok");

        var longText = "0123456789[[http://link.com][a link]]012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var node = new BTAppNode("Category-Tag", 1, longText, 1);
        assert.equal(node.displayText(), "0123456789<a href='http://link.com' class='btlink'>a link</a>012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678<span class='elipse'>... </span>", "string w early link chopped ok");
        
        var longText = "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789[[http://link.com][a link]]0123456789-more than 250 chars"
        var node = new BTAppNode("Category-Tag", 1, longText, 1);
        assert.equal(node.displayText(), "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<a href='http://link.com' class='btlink'>a link</a><span class='elipse'>... </span>", "string w split link chopped ok");

        var title = "<a href='http://www.loink.com' class='btlink'>Loink [oink]</a>";
        var node = new BTAppNode(title, 1, "", 1);
        assert.equal(cleanTitle(node.displayTitle()), "<a href='http://www.loink.com' class='btlink'>Loink oink</a>", "link converted ok for display");

        node.folded = true;
        assert.equal(node.orgDrawers(), "", "no drawer, no kids case ok");

        new BTAppNode("123", node.id, "", 2);
        assert.equal(node.orgDrawers(), "  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n", "no drawer w kids case ok");

        node.drawers = {"PROPERTIES": ":VISIBILITY: folded\n:OTHER: foo",
                        "DRAWER2": ":PROP: poo\n:PROP2: poop"};
        assert.equal(node.orgDrawers(), "  :PROPERTIES:\n  :VISIBILITY: folded\n  :OTHER: foo\n  :END:\n  :DRAWER2:\n  :PROP: poo\n  :PROP2: poop\n  :END:\n", "drawers and folded ok");
        
        node.drawers = {"PROPERTIES": ":OTHER: foo\n:VISIBILITY: folded",
                        "DRAWER2": ":PROP: poo\n:PROP2: poop"};
        assert.equal(node.orgDrawers(), "  :PROPERTIES:\n  :OTHER: foo\n  :VISIBILITY: folded\n  :END:\n  :DRAWER2:\n  :PROP: poo\n  :PROP2: poop\n  :END:\n", "drawers, folded different order, ok");
        
        node.folded = false;
        assert.equal(node.orgDrawers(), "  :PROPERTIES:\n  :OTHER: foo\n  :END:\n  :DRAWER2:\n  :PROP: poo\n  :PROP2: poop\n  :END:\n", "drawers not folded ok");
    });

});



QUnit.module("Extension tests", function() {

    let readyForTests = true; //false;
    QUnit.moduleStart(function(details) {
        if (details.name != "Extension tests") return;
        console.log("Extension messages");
        window.FileText2 = "* BrainTool Project\nTech and pointers for building BT.\n** Chrome\nThe main part of the app is a Chrome extension. So some resources...\n\n*** [[https://developer.chrome.com/extensions/mv2/devguide][Develop Extensions - Google Chrome]]\nOverview of the processs\n\n*** [[https://developers.chrome.com/extensions/tabs#method-create][chrome.tabs - Google Chrome]]\nTab manger functions.\n\n*** [[https://developer.chrome.com/extensions/windows][chrome.windows - Google Chrome]]\nWindow manager functions\n\n*** [[https://developer.chrome.com/extensions/runtime#method-sendMessage][chrome.runtime - Google Chrome]]\nOther useful api components.\n\n*** [[https://developer.chrome.com/webstore/publish][Publish in the Chrome Web Store]]\noverall publishing process\n\n*** [[https://www.freecodecamp.org/news/how-to-publish-your-chrome-extension-dd8400a3d53/][How To Publish Your Chrome Extension]]\n\n*** [[https://github.com/GoogleChrome/chrome-extensions-samples][chrome-app-samples/samples/gdrive at master  GoogleChrome/chrome-app-samples]]";
        
        window.postMessage({ 'type': 'LOCALTEST' });        // let extension know we're running tests
        // And update node list, nb will send nodes_updated msg, catch here as well as BTContent
        processBTFile(window.FileText2);
        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.type) {
            case 'nodes_updated':
                readyForTests = true;
                alert("Ready to run tests");
                window.removeEventListener('message', handler); // clean up
                break;
            }
        };
        window.addEventListener('message', handler);
    });
    
    let openNodeFinished = false;
    QUnit.test("Open Node", function(assert) {
        let done = assert.async();

        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.function) {
            case 'tabOpened':
                const node = event.data.nodeId;
                assert.equal(node, 3, "link click round trip");
                done();
                openNodeFinished = true;
                AllNodes[3].tabId = 0;
                window.removeEventListener('message', handler); // clean up
                break;
            }
        };
        window.addEventListener('message', handler);
        const doer = function() {
            if (readyForTests) {
                AllNodes[3].openURL();
            }
            else {
                setTimeout(doer, 250);
            }
        };
        doer();
    });
    
    let openTagFinished = false;
    QUnit.test("Open Tag", function(assert) {
        let done = assert.async();
        
        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.function) {
            case 'tabOpened':
                let openCount = AllNodes.reduce(((count, node) => node.tabId ? count+1 : count), 0);
                console.log(openCount, event.data);
                if (openCount == 7) {
                    assert.equal(7, openCount, "Tag open round trip");
                    done();
                    openTagFinished = true;
                    window.removeEventListener('message', handler); // clean up
                }
                break;
            }
        };
        window.addEventListener('message', handler);
        const doer = function() {
            if (openNodeFinished) {   
                alert('starting openTag');
                AllNodes[2].openAll();
            }
            else {
                setTimeout(doer, 250);
            }
        };
        doer();
    });

    let deleteRowFinished = false;
    QUnit.test("Delete row", function(assert) {
        let done = assert.async();
        const doer = function() {
            if (openTagFinished) {
                let trs = $("#content tr");
                let numTrs = trs.length;
                let tr = trs[3];
                $(tr).addClass("selected");
                alert("Deleting " + $($("#content tr")[3])[0].innerText);
                deleteRow({type: 'test'});
                assert.equal($("#content tr").length, numTrs - 1, 'node deletion via ui');
                deleteRowFinished = true;
                done();
            }
            else
                setTimeout(doer, 250);
        };
        doer();        
    });

    let showNodeFinished = false;
    QUnit.test("Show node", function(assert) {
        let done = assert.async();
        const doer = function() {
            if (deleteRowFinished) {
                alert("Showing Publish tab");
                AllNodes[7].showNode();
                assert.ok(true, 'show node');
                showNodeFinished = true;
                done();
            }
            else
                setTimeout(doer, 250);
        };
        doer();        
    });
    
    let closeNodeFinished = false;
    QUnit.test("Close Node Test", function(assert) {
        let done = assert.async();
        const doer = function() {
            if (showNodeFinished) {
                alert("Closing Chrome runtime tab");
                AllNodes[5].closeTab();
                // then assert what you can
                assert.ok(true, 'closed?');
                closeNodeFinished = true; // allow the next test to start
                done();
            }
            else
                setTimeout(doer, 250);
        };
        doer();        
    });
    
    let getBookmarksFinished = false;
    QUnit.test("Get Bookmarks", function(assert) {
        let done = assert.async();
        
        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.function) {
            case 'loadBookmarks':
                if (event.data.result != 'success') {
                    alert('Bookmark permissions denied');
                    break;
                }
                let numMarks = event.data.data.bookmarks.children.length;
                assert.ok(numMarks, "non-zero bookmarks sent over");
                getBookmarksFinished = true;
                window.removeEventListener('message', handler); // clean up
                done();
                break;
            }
        };
        window.addEventListener('message', handler);
        const doer = function() {
            if (closeNodeFinished) {   
                alert('starting Get Bookmarks');
                window.postMessage({ function: 'getBookmarks'});
            }
            else {
                setTimeout(doer, 250);
            }
        };
        doer();
    });


    // General model if not expecting return. see openTag above for return processing
    let templateTestFinished = false;
    let previousTestFinished = true; // should be set by previous test completing
    QUnit.test("Template Extension Test", function(assert) {
        assert.ok(true, 'it ok!');
        let done = assert.async();
        const doer = function() {
            if (previousTestFinished) {
                // Do the thing
                // then assert what you can
                assert.ok(true, 'Defaulted to OK');
                templateTestFinished = true; // allow the next test to start
                done();
            }
            else
                setTimeout(doer, 250);
        };
        doer();       
    });

    
});

QUnit.module("Inbound Message tests", function() {

    QUnit.moduleStart(function(details) {
        if (details.name != "Inbound Message tests") return;
        window.FileText3 = "* BrainTool Project\nTech and pointers for building BT.\n** Chrome\nThe main part of the app is a Chrome extension. So some resources...\n\n*** [[https://developer.chrome.com/extensions/devguide][Develop Extensions - Google Chrome]]\nOverview of the processs\n\n*** [[https://developers.chrome.com/extensions/tabs#method-create][chrome.tabs - Google Chrome]]\nTab manger functions.\n\n*** [[https://developer.chrome.com/extensions/windows][chrome.windows - Google Chrome]]\nWindow manager functions\n\n*** [[https://developer.chrome.com/extensions/runtime#method-sendMessage][chrome.runtime - Google Chrome]]\nOther useful api components.\n\n*** [[https://developer.chrome.com/webstore/publish][Publish in the Chrome Web Store]]\noverall publishing process\n\n*** [[https://www.freecodecamp.org/news/how-to-publish-your-chrome-extension-dd8400a3d53/][How To Publish Your Chrome Extension]]\n\n*** [[https://github.com/GoogleChrome/chrome-extensions-samples][chrome-app-samples/samples/gdrive at master  GoogleChrome/chrome-app-samples]]";
        
        window.postMessage({ 'type': 'LOCALTEST' });        // let extension know we're running tests
        processBTFile(window.FileText3);
    });
    
    let tabOpenedFinished = false;
    QUnit.test("Tab Opened", function(assert) {
        window.postMessage({ 'type': 'tab_opened', 'BTNodeId': 3});
        window.postMessage({ 'type': 'tab_opened', 'BTNodeId': 4});
        window.postMessage({ 'type': 'tab_opened', 'BTNodeId': 5});
        assert.ok(true, "three nodes highlighted");
    });

    
    let tabClosedFinished = false;
    QUnit.test("Tab Closed", function(assert) {
        window.postMessage({ 'type': 'tab_closed', 'BTNodeId':4});
        assert.ok(true, "now 2 nodes highlighted");
    });
    
    let saveTabFinished = false;
    QUnit.test("Save Tab", function(assert) {
        window.postMessage({ 'type': 'new_tab', 'tag': 'new tag', 'note': 'note for tag', 'url': 'http://braintool.org', 'title': 'The PIM for your online life'});
        assert.ok(true, "default to ok");
    });
    
});

