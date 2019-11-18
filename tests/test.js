window.LOCALTEST = true;
QUnit.config.reorder = false;


QUnit.module("App tests", function() {

    QUnit.begin(function() {
        console.log("here first?");
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.";
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
                processBTFile(text);
                assert.equal(AllNodes.length, 12, "default file processed");
                assert.deepEqual(AllNodes[1].text,
                                 "BrainTool is a tool",
                                 "text looks good");
                var tgs = new Set(["BrainTool", "Link"]);
                assert.deepEqual(Tags, tgs, "Tags look good");
                var table = generateTable();
                assert.equal(table,
                             "<table><tr data-tt-id='1'><td class='left'><span class='btTitle'><b>TODO: </b>BrainTool</span></td><td class='middle'/><td><span class='btText'>BrainTool is a tool</span></td></tr><tr data-tt-id='3' data-tt-parent-id='1'><td class='left'><span class='btTitle'><a href='http://www.link.com' class='btlink'>Link</a></span></td><td class='middle'/><td><span class='btText'>URL with a name and <a href='http://google.com' class='btlink'>embedded links</a> scattered about.</span></td></tr><tr data-tt-id='4' data-tt-parent-id='3'><td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>embedded links</a></span></td><td class='middle'/><td><span class='btText'></span></td></tr></table>",
                             "Table generated correctly");
                assert.equal(generateOrgFile(), text, "Regenerated file text ok");

                assert.equal(BTNode.findFromTitle("Category-Tag"), 2, "findFromTitle ok");

                assert.equal("                                             :braintool:orgmode:",
                             AllNodes[5].orgTags("* Top Level 2"),
                             "Tags output ok");
                done();
            });
    });


    QUnit.test("Add New Tag", function(assert) {
        AllNodes = []; BTNode.topIndex = 3;
        var btnode = new BTNode(2, "Category-Tag", 1); 
        var node = new BTAppNode(btnode, "Link: [[http://google.com][The Goog]]", 1);
        addNewTag("foo");
        assert.equal(AllNodes.length, 4, "Tag node added ok");
        assert.deepEqual(node.HTML(), "<tr data-tt-id='2' data-tt-parent-id='1'><td class='left'><span class='btTitle'>Category-Tag</span></td><td class='middle'/><td><span class='btText'>Link: <a href='http://google.com' class='btlink'>The Goog</a></span></td></tr>",  "HTML gen ok");
        assert.deepEqual(generateOrgFile(), "* Category-Tag\nLink: [[http://google.com][The Goog]]\n\n* foo\n", "Org file ok");
    });

    
    QUnit.test("Update Row", function(assert) {
        var btnode = new BTNode(100, "Category-Tag", 1); 
        var node = new BTAppNode(btnode, "Link: [[http://google.com][The Goog]]", 2);
        assert.equal(node.displayTitle(), "Category-Tag", "Conversion w no links works");
        
        assert.equal(node.displayText(), "Link: <a href='http://google.com' class='btlink'>The Goog</a>", "Conversion w link works");

        assert.deepEqual(node.orgText(), "** Category-Tag\nLink: [[http://google.com][The Goog]]\n", "initial org text ok");
        node.title = "Category/Tag";
        node.text = "Same";
        assert.deepEqual(node.orgText(), "** Category-Tag\nSame\n", "Updated org text ok");
        node.text = "Here's a link [[http://braintool.org][BrainTool site]] and text";
        assert.deepEqual(node.displayText(), "Here's a link <a href='http://braintool.org' class='btlink'>BrainTool site</a> and text", "Conversion w link works");
        assert.deepEqual(node.orgText(), "** Category-Tag\nHere's a link [[http://braintool.org][BrainTool site]] and text\n", "Updated org text ok");
    });
    
    QUnit.test("Store Tab under tag", function(assert) {
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 1;
        processBTFile(window.FileText);

        storeTab("tag1", {url: "http://google.com", title: "The Goog"});
        assert.equal(7, AllNodes.length, "tag and tab added ok");
        var node = AllNodes[3]; // newly created parent node
        assert.equal(node._btnode.childIds.length, 1, "parent knows about child");
        
        assert.deepEqual(generateOrgFile(), "* BrainTool\nBrainTool is a tool\n\n** Category-Tag\nThey are the same\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* tag1\n\n** [[http://google.com][The Goog]]\n", "file regen ok");
        node = AllNodes[4]; // newly created node
        assert.deepEqual("<tr data-tt-id='4' data-tt-parent-id='3'><td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>embedded links</a></span></td><td class='middle'/><td><span class='btText'></span></td></tr>", node.HTML(), "HTML gen looks good");
        storeTab("tag2", {url: "http://yahoo.com", title: "Yahoodlers"});
        assert.equal(9, AllNodes.length, "second tag and tab added ok");
        storeTab("tag1", {url: "http://gdrive.com", title: "The Cloud"});
        assert.equal(10, AllNodes.length, "tab added to first tag ok");
        assert.deepEqual(generateOrgFile(),  "* BrainTool\nBrainTool is a tool\n\n** Category-Tag\nThey are the same\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n\n* tag1\n\n** [[http://google.com][The Goog]]\n\n** [[http://gdrive.com][The Cloud]]\n\n* tag2\n\n** [[http://yahoo.com][Yahoodlers]]\n", "file regen ok");
    });

    QUnit.test("Delete Row/Node", function(assert) {
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 1;
        processBTFile(window.FileText);
        assert.equal(5, AllNodes.length, "nodes as expected");
        deleteNode(2);
        assert.notOk(AllNodes[2], "nodes as expected after deletion");
        assert.deepEqual(BTFileText, "* BrainTool\nBrainTool is a tool\n\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n", "file cleaned up ok");
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
            
            //openEachWindow(node);
            done();}
                   , 4000);
    });

    QUnit.test("Text manipulation", function(assert) {
        var nodeText1 = "Word [[http://www.loink.com][Loink]] end";
        var nodeText2 = "Word [[http://www.loink.com][Loink]] and another [[http://google.com][Goog]] end";
        var nodeText3 = "Word after word then end";
        var nodeText4 = "[[http://www.loink.com][Loink]]";
        assert.equal(BTAppNode._displayTextVersion(nodeText1), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> end", "single link ok");
        assert.equal(BTAppNode._displayTextVersion(nodeText2), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> and another <a href='http://google.com' class='btlink'>Goog</a> end", "double link ok");
        assert.equal(BTAppNode._displayTextVersion(nodeText3), "Word after word then end", "no link ok");
        assert.equal(BTAppNode._displayTextVersion(nodeText4), "<a href='http://www.loink.com' class='btlink'>Loink</a>", "only link ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var btnode = new BTNode(101, "Category-Tag", 1);
        var node = new BTAppNode(btnode, longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string chopped ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars w [[http://link.com][a link]] n stuff"
        var btnode = new BTNode(101, "Category-Tag", 1);
        var node = new BTAppNode(btnode, longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string w late link chopped ok");

        var longText = "0123456789[[http://link.com][a link]]012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var btnode = new BTNode(101, "Category-Tag", 1);
        var node = new BTAppNode(btnode, longText, 1);
        assert.equal(node.displayText(), "0123456789<a href='http://link.com' class='btlink'>a link</a>012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678<span class='elipse'>... </span>", "string w early link chopped ok");
        
        var longText = "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789[[http://link.com][a link]]0123456789-more than 250 chars"
        var btnode = new BTNode(101, "Category-Tag", 1);
        var node = new BTAppNode(btnode, longText, 1);
        assert.equal(node.displayText(), "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<a href='http://link.com' class='btlink'>a link</a><span class='elipse'>... </span>", "string w split link chopped ok");

        var title = "<a href='http://www.loink.com' class='btlink'>Loink [oink]</a>";
        var btnode = new BTNode(101, title, 1);
        var node = new BTAppNode(btnode, "", 1);
        assert.equal(cleanTitle(node.displayTitle()), "<a href='http://www.loink.com' class='btlink'>Loink oink</a>", "link converted ok for display");

        node.folded = true;
        assert.equal(node.orgDrawers(), "  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n", "no drawer case ok");

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

/*

QUnit.module("Extension tests", function() {

    QUnit.begin(function() {
        console.log("Extension messages");
        window.FileText = "* BrainTool Project\nTech and pointers for building BT.\n** Chrome\nThe main part of the app is a Chrome extension. So some resources...\n\n*** [[https://developer.chrome.com/extensions/devguide][Develop Extensions - Google Chrome]]\nOverview of the processs\n\n*** [[https://developers.chrome.com/extensions/tabs#method-create][chrome.tabs - Google Chrome]]\nTab manger functions.\n\n*** [[https://developer.chrome.com/extensions/windows][chrome.windows - Google Chrome]]\nWindow manager functions\n\n*** [[https://developer.chrome.com/extensions/runtime#method-sendMessage][chrome.runtime - Google Chrome]]\nOther useful api components.\n\n*** [[https://developer.chrome.com/webstore/publish][Publish in the Chrome Web Store]]\noverall publishing process\n\n*** [[https://www.freecodecamp.org/news/how-to-publish-your-chrome-extension-dd8400a3d53/][How To Publish Your Chrome Extension]]\n\n*** [[https://github.com/GoogleChrome/chrome-app-samples/tree/master/samples/gdrive][chrome-app-samples/samples/gdrive at master  GoogleChrome/chrome-app-samples]]";
        
        window.postMessage({ 'type': 'LOCALTEST' });        // let extension know we're running tests
    });
    
    let openNodeFinished = false;
    QUnit.test("Open Node", function(assert) {
        var done = assert.async();
        processBTFile(window.FileText);

        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.type) {
            case 'tab_opened':
                const node = event.data.BTNodeId;
                assert.equal(nodeId, node, "link click round trip");
                done();
                openNodeFinished = true
                window.removeEventListener('message', handler); // clean up
                break;
            }
        };
        window.addEventListener('message', handler);
                
        const nodeId = 3, url = "https://developer.chrome.com/extensions/devguide";
        window.postMessage({ 'type': 'link_click', 'nodeId': nodeId, 'url': url });
    });

    let openTagFinished = false;
    QUnit.test("Open Tag", function(assert) {
        var done = assert.async();
        let counter = 0;
        
        const handler = function(event) {
            // Handle message from Window
            if (event.source != window)
                return;
            switch (event.data.type) {
            case 'tab_opened':
                if (++counter == 7) {
                    assert.equal(7, counter, "Tag open round trip");
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
                openEachWindow(AllNodes[2]);
            }
            else {
                setTimeout(doer, 250);
            }
        }
        doer();
    });
    
    QUnit.test("Delete row", function(assert) {
        var done = assert.async();
        const doer = function() {
            if (openTagFinished) {
                var trs = $("tr");
                var tr = trs[3];
                $(tr).addClass("selected");
                $("#dialog")[0].showModal();
                deleteRow();
                assert.equal($("tr").length, trs.length - 1, 'node deletion via ui');
                done();
            }
            else
                setTimeout(doer, 250);
        };
        doer();        
    });
    
});
                                

*/
