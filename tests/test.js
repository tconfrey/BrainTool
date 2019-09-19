
QUnit.module("App tests", function() {

    QUnit.begin(function() {
        console.log("here first?");
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.";});

    QUnit.test("Read default .org file", function(assert) {
        var done = assert.async();
        AllNodes = []; BTNode.topIndex = 0;
        fetch('/app/BrainTool.org')     // fetch template file from bt server
            .then(response => {
                assert.ok(response.ok, "default file response received");
                return response.text();
            })
            .then(text => {
                console.log(text);
                assert.ok(text, "default file contents received");
                processBTFile(text);
                assert.equal(4, AllNodes.length, "default file processed");
                assert.deepEqual(AllNodes[0].text,
                                 "BrainTool is a tool",
                                 "text looks good");
                var cats = new Set(["BrainTool", "Category-Tag"]);
                assert.deepEqual(Categories, cats, "Categories look good");
                var table = generateTable();
                assert.equal(table,
                             "<table><tr data-tt-id='0'><td class='left'><span class='btTitle'>BrainTool</span></td><td class='middle'/><td><span class='btText'>BrainTool is a tool</span></td></tr><tr data-tt-id='1' data-tt-parent-id='0'><td class='left'><span class='btTitle'>Category-Tag</span></td><td class='middle'/><td><span class='btText'>They are the same</span></td></tr><tr data-tt-id='2' data-tt-parent-id='0'><td class='left'><span class='btTitle'><a href='http://www.link.com' class='btlink'>Link</a></span></td><td class='middle'/><td><span class='btText'>URL with a name and <a href='http://google.com' class='btlink'>embedded links</a> scattered about.</span></td></tr><tr data-tt-id='3' data-tt-parent-id='2'><td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>embedded links</a></span></td><td class='middle'/><td><span class='btText'></span></td></tr></table>",
                             "Table generated correctly");
                assert.deepEqual(generateOrgFile(), text, "Regenerated file text ok");

                var theOne = new BTNode(1, "Category-Tag", "They are the same", 2, 0);
                assert.deepEqual(BTNode.findFromTitle("Category-Tag"), theOne, "findFromTitle ok");
                
                done();
            });
    });


    QUnit.test("Update Row", function(assert) {
        var node = new BTNode(0, "Category-Tag", "Link: [[http://google.com][The Goog]]", 2, 0);
        assert.equal(node.displayTitle(), "Category-Tag", "Conversion w no links works");
        
        assert.equal(node.displayText(), "Link: <a href='http://google.com' class='btlink'>The Goog</a>", "Conversion w link works");

        assert.deepEqual(node.orgText(), "** Category-Tag\nLink: [[http://google.com][The Goog]]\n", "initial org text ok");
        node.title = "Category/Tag";
        node.text = "Same";
        assert.deepEqual(node.orgText(), "** Category/Tag\nSame\n", "Updated org text ok");
        node.text = "Here's a link [[http://braintool.org][BrainTool site]] and text";
        assert.deepEqual(node.displayText(), "Here's a link <a href='http://braintool.org' class='btlink'>BrainTool site</a> and text", "Conversion w link works");
        assert.deepEqual(node.orgText(), "** Category/Tag\nHere's a link [[http://braintool.org][BrainTool site]] and text\n", "Updated org text ok");
    });

    QUnit.test("Add New Tag", function(assert) {
        AllNodes = []; BTNode.topIndex = 0;
        var node = new BTNode(BTNode.topIndex++, "Category-Tag", "Link: [[http://google.com][The Goog]]", 1);
        AllNodes.push(node);
        addNewTag("foo");
        assert.equal(AllNodes.length, 2, "Tag node added ok");
        assert.deepEqual(node.HTML(), "<tr data-tt-id='0'><td class='left'><span class='btTitle'>Category-Tag</span></td><td class='middle'/><td><span class='btText'>Link: <a href='http://google.com' class='btlink'>The Goog</a></span></td></tr>", "HTML gen ok");
        assert.deepEqual(generateOrgFile(), "* Category-Tag\nLink: [[http://google.com][The Goog]]\n* foo\n\n", "Org file ok");
    });
    
    QUnit.test("Store Tab under tag", function(assert) {
        LOCALTEST = true;
        AllNodes = []; BTNode.topIndex = 0;
        storeTab("tag1", {url: "http://google.com", title: "The Goog"});
        assert.equal(AllNodes.length, 2, "tag and tab added ok");
        var node = AllNodes[0]; // newly created parent node
        assert.equal(node.childIds.size, 1, "parent knows about child");
        assert.deepEqual(generateOrgFile(), "* tag1\n\n** [[http://google.com][The Goog]]\n\n", "file regen ok");
        node = AllNodes[1]; // newly created node
        assert.deepEqual(node.HTML(), "<tr data-tt-id='1' data-tt-parent-id='0'><td class='left'><span class='btTitle'><a href='http://google.com' class='btlink'>The Goog</a></span></td><td class='middle'/><td><span class='btText'></span></td></tr>", "HTML gen looks good");
        storeTab("tag2", {url: "http://yahoo.com", title: "Yahoodlers"});
        assert.equal(AllNodes.length, 4, "second tag and tab added ok");
        storeTab("tag1", {url: "http://gdrive.com", title: "The Cloud"});
        assert.equal(AllNodes.length, 5, "tab added to first tag ok");
        assert.deepEqual(generateOrgFile(),  "* tag1\n\n** [[http://google.com][The Goog]]\n\n** [[http://gdrive.com][The Cloud]]\n\n* tag2\n\n** [[http://yahoo.com][Yahoodlers]]\n\n", "file regen ok");
    });

    QUnit.test("Delete Row/Node", function(assert) {
        LOCALTEST = true;
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 0;
        processBTFile(window.FileText);
        var table = generateTable();
        assert.equal(AllNodes.length, 4, "nodes as expected");
        deleteNode(1);
        assert.notOk(AllNodes[1], "nodes as expected after deletion");
        assert.deepEqual(BTFileText, "* BrainTool\nBrainTool is a tool\n** [[http://www.link.com][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n", "file cleaned up ok");
    });

    QUnit.test("Open Tabs", function(assert) {
        var done = assert.async();
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.braintool.org][Link]]\nURL with a name and [[http://google.com][embedded links]] scattered about.\n*** [[https://github.io][GitHub]]\n";
        assert.ok(window.FileText, "file text available");
        AllNodes = []; BTNode.topIndex = 0;
        processBTFile(window.FileText);
        var node = AllNodes[2];
        setTimeout(function () {
            // not really a unit test but still - a good visual inspection that windows are still being opened. Don't need to run every time
            // openEachWindow(node);
            done();}
                   , 4000);
    });

    QUnit.test("Text manipulation", function(assert) {
        var nodeText1 = "Word [[http://www.loink.com][Loink]] end";
        var nodeText2 = "Word [[http://www.loink.com][Loink]] and another [[http://google.com][Goog]] end";
        var nodeText3 = "Word after word then end";
        var nodeText4 = "[[http://www.loink.com][Loink]]";
        assert.equal(BTNode._displayTextVersion(nodeText1), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> end", "single link ok");
        assert.equal(BTNode._displayTextVersion(nodeText2), "Word <a href='http://www.loink.com' class='btlink'>Loink</a> and another <a href='http://google.com' class='btlink'>Goog</a> end", "double link ok");
        assert.equal(BTNode._displayTextVersion(nodeText3), "Word after word then end", "no link ok");
        assert.equal(BTNode._displayTextVersion(nodeText4), "<a href='http://www.loink.com' class='btlink'>Loink</a>", "only link ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var node = new BTNode(BTNode.topIndex++, "Category-Tag", longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string chopped ok");

        var longText = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars w [[http://link.com][a link]] n stuff"
        var node = new BTNode(BTNode.topIndex++, "Category-Tag", longText, 1);
        assert.equal(node.displayText(), "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<span class='elipse'>... </span>", "string w late link chopped ok");

        var longText = "0123456789[[http://link.com][a link]]012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789-more than 250 chars"
        var node = new BTNode(BTNode.topIndex++, "Category-Tag", longText, 1);
        assert.equal(node.displayText(), "0123456789<a href='http://link.com' class='btlink'>a link</a>012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678<span class='elipse'>... </span>", "string w early link chopped ok");
        
        var longText = "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789[[http://link.com][a link]]0123456789-more than 250 chars"
        var node = new BTNode(BTNode.topIndex++, "Category-Tag", longText, 1);
        assert.equal(node.displayText(), "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789<a href='http://link.com' class='btlink'>a link</a><span class='elipse'>... </span>", "string w split link chopped ok");

        var title = "<a href='http://www.loink.com' class='btlink'>Loink [oink]</a>";
        var node = new BTNode(BTNode.topIndex++, title, "", 1);
        assert.equal(cleanTitle(node.displayTitle()), "<a href='http://www.loink.com' class='btlink'>Loink oink</a>", "link converted ok for display");
    });

});
