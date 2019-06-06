
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
