#target illustrator

var RESULT = "";
var doc = null;
var originalFilePath = null;

function exportProductionFilesV9() {
    if (app.documents.length === 0) {
        RESULT = "ERROR: Please open a document first.";
        return;
    }

    doc = app.activeDocument;

    try {
        if (!doc.saved) doc.save();
        originalFilePath = doc.fullName.fsName;
    } catch (e) {
        RESULT = "ERROR: Please save your original .ai file first.";
        return;
    }

    var docName = doc.name.replace(/\.[^\.]+$/, "");
    var cleanDocName = docName.replace(/[\/\\:*?"<>|]/g, "-");
    var pdfPresets = app.PDFPresetsList;

    if (!pdfPresets || pdfPresets.length === 0) {
        RESULT = "ERROR: No PDF presets are installed.";
        return;
    }

    var win = new Window("dialog", "Fast Export Production Files v9");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 20;

    var pnlSettings = win.add("panel", undefined, "Export Settings");
    pnlSettings.orientation = "column";
    pnlSettings.alignChildren = ["left", "top"];
    pnlSettings.margins = 15;
    pnlSettings.spacing = 10;

    pnlSettings.add("statictext", undefined, "1. Select PDF Preset:");
    var dropdownPresets = pnlSettings.add("dropdownlist", undefined, pdfPresets);

    var savedPreset = "";
    try {
        savedPreset = app.preferences.getStringPreference("TheSignPack_LastPDFPreset");
    } catch (e) {}

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
    var txtFolder = grpFolder.add("edittext", undefined, doc.path.fsName);
    txtFolder.characters = 35;

    btnFolder.onClick = function () {
        var startFolder = new Folder(doc.path.fsName);
        var selectedFolder = Folder.selectDialog("Select destination folder", startFolder);

        if (selectedFolder) {
            txtFolder.text = selectedFolder.fsName;
        }
    };

    pnlSettings.add("statictext", undefined, "3. Custom File Name:");
    var txtCustomName = pnlSettings.add("edittext", undefined, cleanDocName + " ");
    txtCustomName.characters = 35;

    var firstAbName = doc.artboards[0].name.replace(/[\/\\:*?"<>|]/g, "-");
    var txtPreview = pnlSettings.add(
        "statictext",
        undefined,
        "Preview: " + txtCustomName.text + firstAbName + ".pdf"
    );
    txtPreview.preferredSize.width = 350;

    txtCustomName.onChanging = function () {
        var currentText = txtCustomName.text;

        if (currentText === "") {
            currentText = cleanDocName + " ";
        }

        txtPreview.text = "Preview: " + currentText + firstAbName + ".pdf";
    };

    pnlSettings.add("statictext", undefined, "4. Additional Settings:");

    var chkSaveAi = pnlSettings.add("checkbox", undefined, "Also save as .ai file");
    chkSaveAi.value = true;

    var chkSaveEps = pnlSettings.add("checkbox", undefined, "Also save as .eps file");
    chkSaveEps.value = true;

    var chkDisableView = pnlSettings.add(
        "checkbox",
        undefined,
        "Prevent PDFs from opening automatically"
    );
    chkDisableView.value = false;

    var warningGroup = win.add("group");
    warningGroup.orientation = "column";
    warningGroup.alignChildren = ["center", "top"];
    warningGroup.spacing = 2;
    warningGroup.margins = [0, 5, 0, 0];
    warningGroup.add("statictext", undefined, "Processing runs in the background.");
    warningGroup.add("statictext", undefined, "(Illustrator may look frozen, but it hasn't crashed!)");
    warningGroup.add("statictext", undefined, "Please check your output folder before closing.");

    var grpButtons = win.add("group");
    grpButtons.alignment = ["center", "top"];
    grpButtons.margins = [0, 10, 0, 0];

    var btnExport = grpButtons.add("button", undefined, "Export Files");
    var btnCancel = grpButtons.add("button", undefined, "Cancel");

    btnCancel.onClick = function () {
        RESULT = "CANCELLED";
        win.close();
    };

    btnExport.onClick = function () {
        if (txtFolder.text === "") {
            RESULT = "ERROR: Select an output folder.";
            return;
        }

        var destFolder = new Folder(txtFolder.text);

        if (!destFolder.exists) {
            RESULT = "ERROR: Folder does not exist.";
            return;
        }

        if (!dropdownPresets.selection) {
            RESULT = "ERROR: No PDF preset selected (or none installed).";
            return;
        }

        var presetName = dropdownPresets.selection.text;

        try {
            app.preferences.setStringPreference("TheSignPack_LastPDFPreset", presetName);
        } catch (e) {}

        var customNameInput = txtCustomName.text;
        var saveAi = chkSaveAi.value;
        var saveEps = chkSaveEps.value;
        var preventOpening = chkDisableView.value;
        var total = doc.artboards.length;
        var exportedCount = 0;
        var prevInteractionLevel = app.userInteractionLevel;

        var layerCleanupFailures = [];
        var linkEmbedFailures = [];
        var bleedFailures = [];

        var masterTempFile = null;
        var tempAiFile = null;
        var tempDoc = null;

        function fastUnlock(layers) {
            var len = layers.length;

            for (var L = 0; L < len; L++) {
                var layer = layers[L];

                if (layer.locked) layer.locked = false;
                if (!layer.visible) layer.visible = true;

                if (layer.layers.length > 0) {
                    fastUnlock(layer.layers);
                }
            }
        }

        function removeEmptyLayers(layers) {
            for (var l = layers.length - 1; l >= 0; l--) {
                var currentLayer = layers[l];

                if (currentLayer.layers.length > 0) {
                    removeEmptyLayers(currentLayer.layers);
                }

                if (
                    currentLayer.pageItems.length === 0 &&
                    currentLayer.layers.length === 0
                ) {
                    try {
                        currentLayer.remove();
                    } catch (e) {
                        try {
                            layerCleanupFailures.push(currentLayer.name);
                        } catch (e2) {}
                    }
                }
            }
        }

        function getTrueBounds(item) {
            if (!item || item.hidden) return null;
            if (item.typename === "PathItem" && item.guides) return null;

            if (item.typename === "GroupItem") {
                if (item.clipped) {
                    for (var c = 0; c < item.pageItems.length; c++) {
                        var pi = item.pageItems[c];

                        if (pi.typename === "PathItem" && pi.clipping) {
                            return pi.geometricBounds;
                        }

                        if (
                            pi.typename === "CompoundPathItem" &&
                            pi.pathItems.length > 0 &&
                            pi.pathItems[0].clipping
                        ) {
                            return pi.geometricBounds;
                        }
                    }
                }

                var unionBounds = null;

                for (var g = 0; g < item.pageItems.length; g++) {
                    var childBounds = getTrueBounds(item.pageItems[g]);

                    if (!childBounds) continue;

                    if (!unionBounds) {
                        unionBounds = [
                            childBounds[0],
                            childBounds[1],
                            childBounds[2],
                            childBounds[3]
                        ];
                    } else {
                        if (childBounds[0] < unionBounds[0]) unionBounds[0] = childBounds[0];
                        if (childBounds[1] > unionBounds[1]) unionBounds[1] = childBounds[1];
                        if (childBounds[2] > unionBounds[2]) unionBounds[2] = childBounds[2];
                        if (childBounds[3] < unionBounds[3]) unionBounds[3] = childBounds[3];
                    }
                }

                return unionBounds;
            }

            return item.geometricBounds;
        }

        function findBleedingItems(items, abBounds) {
            var names = [];

            for (var b = 0; b < items.length; b++) {
                var item = items[b];
                var itemBounds = getTrueBounds(item);

                if (!itemBounds) continue;

                var overlaps = !(
                    itemBounds[2] < abBounds[0] ||
                    itemBounds[0] > abBounds[2] ||
                    itemBounds[1] < abBounds[3] ||
                    itemBounds[3] > abBounds[1]
                );

                if (!overlaps) continue;

                var fullyInside =
                    itemBounds[0] >= abBounds[0] &&
                    itemBounds[2] <= abBounds[2] &&
                    itemBounds[1] <= abBounds[1] &&
                    itemBounds[3] >= abBounds[3];

                if (!fullyInside) {
                    var itemName =
                        item.name && item.name !== ""
                            ? item.name
                            : item.typename;

                    names.push(itemName);
                }
            }

            return names;
        }

        function cleanupTempFiles() {
            try {
                if (
                    tempDoc &&
                    tempDoc.name &&
                    /^_temp_/.test(tempDoc.name)
                ) {
                    tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                }
            } catch (eC1) {}

            try {
                if (tempAiFile && tempAiFile.exists) {
                    tempAiFile.remove();
                }
            } catch (eC2) {}

            try {
                if (masterTempFile && masterTempFile.exists) {
                    masterTempFile.remove();
                }
            } catch (eC3) {}
        }

        win.close();
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        try {
            var originalFile = new File(originalFilePath);

            masterTempFile = new File(
                destFolder.fsName + "/_master_temp_build.ai"
            );

            if (!originalFile.copy(masterTempFile)) {
                throw new Error("Could not create the temporary master file.");
            }

            var masterDoc = app.open(masterTempFile);

            fastUnlock(masterDoc.layers);

            try {
                app.executeMenuCommand("unlockAll");
            } catch (e) {}

            try {
                app.executeMenuCommand("showAll");
            } catch (e) {}

            try {
                var tFrames = masterDoc.textFrames;

                for (var t = tFrames.length - 1; t >= 0; t--) {
                    try {
                        tFrames[t].createOutline();
                    } catch (e) {}
                }
            } catch (e) {}

            try {
                var placed = masterDoc.placedItems;

                for (var pI = placed.length - 1; pI >= 0; pI--) {
                    try {
                        placed[pI].embed();
                    } catch (eEmbed) {
                        try {
                            linkEmbedFailures.push(placed[pI].name);
                        } catch (eName) {}
                    }
                }
            } catch (ePlaced) {}

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);

            for (var i = 0; i < total; i++) {
                var abName = doc.artboards[i].name;
                var cleanArtboardName = abName.replace(/[\/\\:*?"<>|]/g, "-");

                var prefix =
                    customNameInput !== ""
                        ? customNameInput
                        : cleanDocName + " ";

                var baseFileName = prefix + cleanArtboardName;

                tempAiFile = new File(
                    destFolder.fsName + "/_temp_" + i + ".ai"
                );

                if (!masterTempFile.copy(tempAiFile)) {
                    throw new Error(
                        "Could not create a temporary file for artboard: " +
                        cleanArtboardName
                    );
                }

                tempDoc = app.open(tempAiFile);
                app.activeDocument = tempDoc;

                tempDoc.selection = null;
                tempDoc.artboards.setActiveArtboardIndex(i);

                try {
                    app.executeMenuCommand("selectallinartboard");
                    app.executeMenuCommand("hide");
                    app.executeMenuCommand("selectall");
                    app.executeMenuCommand("clear");
                    app.executeMenuCommand("showAll");
                } catch (e) {}

                try {
                    var abBounds = tempDoc.artboards[i].artboardRect;
                    var bleeding = findBleedingItems(
                        tempDoc.pageItems,
                        abBounds
                    );

                    if (bleeding.length > 0) {
                        bleedFailures.push(cleanArtboardName);
                    }
                } catch (eBleed) {}

                removeEmptyLayers(tempDoc.layers);

                var abCount = tempDoc.artboards.length;

                for (var a = abCount - 1; a >= 0; a--) {
                    if (a !== i) {
                        try {
                            tempDoc.artboards[a].remove();
                        } catch (e) {}
                    }
                }

                var pdfTargetFile = new File(
                    destFolder.fsName + "/" + baseFileName + ".pdf"
                );

                var pdfSaveOpts = new PDFSaveOptions();
                pdfSaveOpts.pDFPreset = presetName;
                pdfSaveOpts.preserveEditability = true;
                pdfSaveOpts.acrobatLayers = true;
                pdfSaveOpts.compatibility = PDFCompatibility.ACROBAT6;
                pdfSaveOpts.artboardRange = "1";
                pdfSaveOpts.viewAfterSaving = !preventOpening;

                tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

                if (saveAi) {
                    var aiTargetFile = new File(
                        destFolder.fsName + "/" + baseFileName + ".ai"
                    );

                    var aiSaveOpts = new IllustratorSaveOptions();
                    aiSaveOpts.pdfCompatible = true;

                    tempDoc.saveAs(aiTargetFile, aiSaveOpts);
                }

                if (saveEps) {
                    var epsTargetFile = new File(
                        destFolder.fsName + "/" + baseFileName + ".eps"
                    );

                    var epsSaveOpts = new EPSSaveOptions();
                    epsSaveOpts.cmykPostScript =
                        tempDoc.documentColorSpace === DocumentColorSpace.CMYK;
                    epsSaveOpts.embedAllFonts = false;
                    epsSaveOpts.preview = EPSPreview.COLORTIFF;
                    epsSaveOpts.compatibility = Compatibility.ILLUSTRATOR10;

                    try {
                        epsSaveOpts.postScript = PostScriptLevelEnum.LEVEL3;
                    } catch (ePS) {}

                    try {
                        epsSaveOpts.compatibleGradientPrinting = true;
                    } catch (eGP) {}

                    try {
                        epsSaveOpts.embedLinkedFiles = true;
                    } catch (eEL) {}

                    tempDoc.saveAs(epsTargetFile, epsSaveOpts);
                }

                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                tempDoc = null;

                tempAiFile.remove();
                tempAiFile = null;

                $.gc();

                app.activeDocument = doc;
                exportedCount++;
            }

            if (masterTempFile && masterTempFile.exists) {
                masterTempFile.remove();
            }

            masterTempFile = null;
            app.userInteractionLevel = prevInteractionLevel;
            app.activeDocument = doc;

            var doneMsg =
                "SUCCESS: Done!\n" +
                exportedCount +
                " artboards exported.";

            if (layerCleanupFailures.length > 0) {
                doneMsg +=
                    "\n\nNote: " +
                    layerCleanupFailures.length +
                    " empty layer(s) could not be removed during cleanup:\n" +
                    layerCleanupFailures.join(", ");
            }

            if (linkEmbedFailures.length > 0) {
                doneMsg +=
                    "\n\nNote: " +
                    linkEmbedFailures.length +
                    " linked file(s) could not be embedded (likely still linked in the export):\n" +
                    linkEmbedFailures.join(", ");
            }

            if (bleedFailures.length > 0) {
                doneMsg +=
                    "\n\nWarning: art extends past the artboard edge and may be clipped on:\n" +
                    bleedFailures.join("\n");
            }

           alert(doneMsg.replace("SUCCESS: ", ""));
			RESULT = doneMsg;

        } catch (error) {
            app.userInteractionLevel = prevInteractionLevel;
            cleanupTempFiles();

            try {
                app.activeDocument = doc;
            } catch (eActiveDoc) {}

            RESULT =
                "ERROR: " +
                error.message +
                "\n\nExported before the error: " +
                exportedCount +
                " of " +
                total +
                " artboards." +
                "\nTemporary files were cleaned up.";
        }
    };

    win.show();
}

try {
    exportProductionFilesV9();
} catch (e) {
    if (RESULT === "") {
        RESULT = "ERROR: Unexpected error:\n" + e.message;
    }
}

RESULT;