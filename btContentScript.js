
var tabsData;

function populateTabsList() {

    var tabsElement = document.getElementById('tabs');
    chrome.storage.local.get('tabsList', function (data) {
        tabsData = data.tabsList;
        var htmlText = "";
        for(var i=0, len=tabsData.length; i < len; i++){
            htmlText = htmlText + "<p>" + tabsData[i].title + "</p>";
            console.log(tabsData[i].title);
        }
        tabsElement.innerHTML = htmlText; 
    });
}

populateTabsList();

window.addEventListener('message', function(event) {
    if (event.source != window)
        return;
    console.log('content_script.js got message:', event);
    switch (event.data.type) {
    case 'tags_updated':        // pull tags info from message and post to local storage
        chrome.storage.local.set({'tags': event.data.text}, function() {
            console.log("tags set to " + event.data.text);
        });
    }
});
                      
