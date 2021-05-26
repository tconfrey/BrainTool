---
title: BrainTool Converter Utilities
description: Convery other formats to BrainTool org-mode markup
layout: default
audience: nonuser
---

# Tabs Outliner Import
Tabs Outliner import is now supported directly from inside BrainTool, see Import under Options. This tool takes a Tabs Outliner export and converts it to org-mode format (as used by BrainTool and many other productivity apps) for use elsewhere.

Export your data from Tabs Outliner and save the file somewhere locally. Then select it using the file chooser below. The resulting org-mode formatted data can then be copied into any text file.


<input type="file" name="inputfile" id="inputfile"> 
<br> 

<textarea id="output" style="border:solid; border-width: 1px; white-space: pre-wrap; width:100%;" rows="30">BrainTool org-mode format will be placed here.</textarea> 

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
