
QUnit.module("App tests", function() {

    QUnit.begin(function() {
        console.log("here first?");
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.link.com][Link]]\nURL with a name";});

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
                assert.equal(3, AllNodes.length, "default file processed");
                assert.deepEqual(AllNodes[0].text,
                                 "BrainTool is a tool",
                                 "text looks good");
                var cats = new Set(["BrainTool", "Category-Tag"]);
                assert.deepEqual(Categories, cats, "Categories look good");
                var table = generateTable();
                assert.equal(table,
                             "<table><tr data-tt-id='0'><td class='left'>BrainTool</td><td class='middle'/><td>BrainTool is a tool</td></tr><tr data-tt-id='1' data-tt-parent-id='0'><td class='left'>Category-Tag</td><td class='middle'/><td>They are the same</td></tr><tr data-tt-id='2' data-tt-parent-id='0'><td class='left'><a href='http://www.link.com' class='btlink'>Link</a></td><td class='middle'/><td>URL with a name</td></tr></table>",
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
        assert.deepEqual(node.HTML(), "<tr data-tt-id='0'><td class='left'>Category-Tag</td><td class='middle'/><td>Link: <a href='http://google.com' class='btlink'>The Goog</a></td></tr>", "HTML gen ok");
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
        assert.deepEqual(node.HTML(), "<tr data-tt-id='1' data-tt-parent-id='0'><td class='left'><a href='http://google.com' class='btlink'>The Goog</a></td><td class='middle'/><td></td></tr>", "HTML gen looks good");
        storeTab("tag2", {url: "http://yahoo.com", title: "Yahoodlers"});
        assert.equal(AllNodes.length, 4, "second tag and tab added ok");
        storeTab("tag1", {url: "http://gdrive.com", title: "The Cloud"});
        assert.equal(AllNodes.length, 5, "tab added to first tag ok");
        assert.deepEqual(generateOrgFile(),  "* tag1\n\n** [[http://google.com][The Goog]]\n\n** [[http://gdrive.com][The Cloud]]\n\n* tag2\n\n** [[http://yahoo.com][Yahoodlers]]\n\n", "file regen ok");
    });

    QUnit.test("Delete Row/Node", function(assert) {
        assert.ok(window.FileText, "file text still available");
        AllNodes = []; BTNode.topIndex = 0;
        processBTFile(window.FileText);
        var table = generateTable();
        assert.equal(AllNodes.length, 3, "nodes as expected");
        deleteNode(1);
        assert.notOk(AllNodes[1], "nodes as expected after deletion");
        assert.deepEqual(BTFileText, "* BrainTool\nBrainTool is a tool\n** [[http://www.link.com][Link]]\nURL with a name\n", "file cleaned up ok");
    });

    QUnit.test("Open Tabs", function(assert) {
        var done = assert.async();
        window.FileText = "* BrainTool\nBrainTool is a tool\n** Category-Tag\nThey are the same\n** [[http://www.braintool.org][Link]]\nURL with a name\n*** [[https://github.io][GitHub]]\n";
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

});
