---
title: BrainTool Converter Utilities
description: Convery other formats to BrainTool org-mode markup
---

# Tabs Outliner Import
This tool imports from Tabs Outliner, converts to BrainTool org-mode format and imports into your BrainTool.org file.

First export your data from Tabs Outliner and save the file somewhere locally. Then select it using the file chooser below. Copy the generated org-mode version and paste it into the bottom of your BrainTool.org file.

<input type="file" name="inputfile" id="inputfile"> 
<br> 

<textarea id="output" style="border:solid; border-width: 1px; white-space: pre-wrap; width:100%;" rows="30"></textarea> 

<script src="converters.js"></script>
<script type="text/javascript"> 
document.getElementById('inputfile').addEventListener('change', function() { 

var fr=new FileReader(); 
fr.onload=function(){ 
var bt = tabsToBT(fr.result);
document.getElementById('output').textContent=bt; 
document.getElementById('output').select();
} 

fr.readAsText(this.files[0]); 
}) 
</script> 
