#target illustrator

var RESULT = "";
var doc = app.activeDocument;
var originalFilePath = null;

function exportProductionFilesV9() {
    if (app.documents.length === 0) {
		RESULT = "ERROR: Please open a document first.";
		throw new Error();
        return;
    }

    

    try {
        if (!doc.saved) doc.save();
        originalFilePath = doc.fullName.fsName;
    } catch (e) {
		RESULT = "ERROR: Please save your original .ai file first.";
		throw new Error();
        return;
    }

    var docName = doc.name.replace(/\.[^\.]+$/, ''); 
    var cleanDocName = docName.replace(/[\/\\:*?"<>|]/g, '-');
    var pdfPresets = app.PDFPresetsList;

    var win = new Window("dialog", "Fast Export Production Files v9");
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.margins = 20;

    var pnlSettings = win.add("panel", undefined, "Export Settings");
    pnlSettings.orientation = "column"; pnlSettings.alignChildren = ["left", "top"]; pnlSettings.margins = 15; pnlSettings.spacing = 10;

    pnlSettings.add("statictext", undefined, "1. Select PDF Preset:");
    var dropdownPresets = pnlSettings.add("dropdownlist", undefined, pdfPresets);
    
    var savedPreset = "";
    try {
        savedPreset = app.preferences.getStringPreference("TheSignPack_LastPDFPreset");
    } catch(e) {}

    var presetIndex = 0;
    for (var p = 0; p < pdfPresets.length; p++) {
        if (pdfPresets[p] === savedPreset) {
            presetIndex = p;
            break;
        }
    }
    dropdownPresets.selection = presetIndex;
    dropdownPresets.preferredSize.width = 300;

    pnlSettings.add("statictext", undefined, "2. Output Folder:");
    var grpFolder = pnlSettings.add("group");
    var btnFolder = grpFolder.add("button", undefined, "Browse...");
    var txtFolder = grpFolder.add("edittext", undefined, doc.path.fsName); txtFolder.characters = 35; 

    btnFolder.onClick = function() {
        var startFolder = new Folder(doc.path.fsName);
        var selectedFolder = Folder.selectDialog("Select destination folder", startFolder);
        if (selectedFolder) txtFolder.text = selectedFolder.fsName;
    };

    pnlSettings.add("statictext", undefined, "3. Custom File Name:");
    var txtCustomName = pnlSettings.add("edittext", undefined, cleanDocName + " ");
    txtCustomName.characters = 35;

    var firstAbName = doc.artboards[0].name.replace(/[\/\\:*?"<>|]/g, '-');
    var txtPreview = pnlSettings.add("statictext", undefined, "Preview: " + txtCustomName.text + firstAbName + ".pdf");
    txtPreview.preferredSize.width = 350; // Forces the preview box to be wide enough
    
    txtCustomName.onChanging = function() {
        var currentText = txtCustomName.text;
        if (currentText === "") currentText = cleanDocName + " ";
        txtPreview.text = "Preview: " + currentText + firstAbName + ".pdf";
    };

    pnlSettings.add("statictext", undefined, "4. Additional Settings:");
    var chkSaveAi = pnlSettings.add("checkbox", undefined, "Also save as .ai file");
    chkSaveAi.value = false;
    
    var chkDisableView = pnlSettings.add("checkbox", undefined, "Prevent PDFs from opening automatically");
    chkDisableView.value = false; 

    var warningGroup = win.add("group");
    warningGroup.orientation = "column";
    warningGroup.alignChildren = ["center", "top"];
    warningGroup.spacing = 2;
    warningGroup.margins = [0, 5, 0, 0];
    warningGroup.add("statictext", undefined, "Processing runs in the background.");
    warningGroup.add("statictext", undefined, "(Illustrator may look frozen, but it hasn't crashed!)");
    warningGroup.add("statictext", undefined, "Please check your output folder before closing.");

    var grpButtons = win.add("group"); grpButtons.alignment = ["center", "top"]; grpButtons.margins = [0, 10, 0, 0];
    var btnExport = grpButtons.add("button", undefined, "Export Files"); 
    var btnCancel = grpButtons.add("button", undefined, "Cancel");

    btnCancel.onClick = function() { win.close(); }

    btnExport.onClick = function() {
        if (txtFolder.text === "") { RESULT = "ERROR: Select an output folder."; throw new Error(); return; }
        var destFolder = new Folder(txtFolder.text);
        if (!destFolder.exists) { RESULT = "ERROR: Folder does not exist."; throw new Error(); return; }
        
        var presetName = dropdownPresets.selection.text;
        try { app.preferences.setStringPreference("TheSignPack_LastPDFPreset", presetName); } catch(e) {}

        var customNameInput = txtCustomName.text;
        var saveAi = chkSaveAi.value;
        var preventOpening = chkDisableView.value;
        var total = doc.artboards.length;
        var exportedCount = 0;

        win.close(); 

        var originalFile = new File(originalFilePath);
        var prevInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; 

        function fastUnlock(layers) {
            var len = layers.length;
            for (var L = 0; L < len; L++) {
                var layer = layers[L];
                if (layer.locked) layer.locked = false;
                if (!layer.visible) layer.visible = true;
                if (layer.layers.length > 0) fastUnlock(layer.layers);
            }
        }

        function removeEmptyLayers(layers) {
            for (var l = layers.length - 1; l >= 0; l--) {
                var currentLayer = layers[l];
                if (currentLayer.layers.length > 0) {
                    removeEmptyLayers(currentLayer.layers);
                }
                if (currentLayer.pageItems.length === 0 && currentLayer.layers.length === 0) {
                    try { currentLayer.remove(); } catch(e) {}
                }
            }
        }

        try {
            var masterTempFile = new File(destFolder.fsName + "/_master_temp_build.ai");
            originalFile.copy(masterTempFile);
            var masterDoc = app.open(masterTempFile);
            
            fastUnlock(masterDoc.layers);
            try { app.executeMenuCommand('unlockAll'); } catch(e) {}
            try { app.executeMenuCommand('showAll'); } catch(e) {}
            
            try {
                var tFrames = masterDoc.textFrames;
                if (tFrames.length > 0) {
                    for (var t = tFrames.length - 1; t >= 0; t--) {
                        try { tFrames[t].createOutline(); } catch(e) {}
                    }
                }
            } catch(e) {}

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);

            for (var i = 0; i < total; i++) {
                var abName = doc.artboards[i].name;
                var cleanArtboardName = abName.replace(/[\/\\:*?"<>|]/g, '-'); 
                
                var prefix = (customNameInput !== "") ? customNameInput : (cleanDocName + " ");
                var baseFileName = prefix + cleanArtboardName;
                
                var tempAiFile = new File(destFolder.fsName + "/_temp_" + i + ".ai");
                masterTempFile.copy(tempAiFile); 
                
                var tempDoc = app.open(tempAiFile);
                app.activeDocument = tempDoc; 
                
                tempDoc.selection = null;
                tempDoc.artboards.setActiveArtboardIndex(i);
                
                try {
                    app.executeMenuCommand('selectallinartboard'); 
                    app.executeMenuCommand('hide');                
                    app.executeMenuCommand('selectall');           
                    app.executeMenuCommand('clear');               
                    app.executeMenuCommand('showAll');             
                } catch(e) {}

                removeEmptyLayers(tempDoc.layers);
                
                var abCount = tempDoc.artboards.length;
                for (var a = abCount - 1; a >= 0; a--) {
                    if (a !== i) {
                        try { tempDoc.artboards[a].remove(); } catch(e){}
                    }
                }
                
                var pdfTargetFile = new File(destFolder.fsName + "/" + baseFileName + ".pdf");
                var pdfSaveOpts = new PDFSaveOptions();
                pdfSaveOpts.pDFPreset = presetName;
                pdfSaveOpts.preserveEditability = true; 
                pdfSaveOpts.acrobatLayers = true;
                pdfSaveOpts.compatibility = PDFCompatibility.ACROBAT6;
                pdfSaveOpts.artboardRange = "1"; 
                pdfSaveOpts.viewAfterSaving = !preventOpening;
                
                tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

                if (saveAi) {
                    var aiTargetFile = new File(destFolder.fsName + "/" + baseFileName + ".ai");
                    var aiSaveOpts = new IllustratorSaveOptions();
                    aiSaveOpts.pdfCompatible = true;
                    tempDoc.saveAs(aiTargetFile, aiSaveOpts);
                }
                
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                tempAiFile.remove();
                
                $.gc(); 
                
                app.activeDocument = doc;
                exportedCount++;
            }
            
            masterTempFile.remove();

            app.userInteractionLevel = prevInteractionLevel; 
			RESULT = "SUCCESS: Done!\n" + exportedCount + " artboards exported.";
        } catch (error) {
			throw new Error();
		}
    };
    win.show();
}


try{

    exportProductionFilesV9();


}
catch(e){

    if(RESULT == ""){

		RESULT =
		"Erro inesperado:\n" +
		e.message;

	}

}

RESULT;