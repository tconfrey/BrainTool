---
title: BrainTool Converter Utilities
description: Convery other formats to BrainTool org-mode markup
---

# Tabs Outliner Import
This tool imports from Tabs Outliner, converts to BrainTool org-mode format and selects the text ready for import into your BrainTool.org file.

First export your data from Tabs Outliner and save the file somewhere locally. Then select it using the file chooser below. Copy the generated org-mode version text and paste it into the bottom of your BrainTool.org file.

NB Your BrainTool.org file is stored on your Google Drive available [here](https://drive.google.com) (assuming you have the extension installed and granted file permissions). It's a plain text file so you'll need to either sync it locally and use a text editor, which is what I do (using the Google Drive Sync app and emacs) or hook up a GDrive app like [Text Editor](https://texteditor.co/).

Tabs Outliner import will be supported directly from inside BrainTool by the upcoming 1.0 release.


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
