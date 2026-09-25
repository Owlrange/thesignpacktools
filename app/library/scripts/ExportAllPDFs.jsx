#target illustrator

var RESULT = "";
var doc = null;
var originalFilePath = null;

function main() {
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
    var cleanDocName = docName.replace(/[/\\:*?"<>|]/g, "-");
    var pdfPresets = app.PDFPresetsList;

    if (!pdfPresets || pdfPresets.length === 0) {
        RESULT = "ERROR: No PDF presets are installed.";
        return;
    }

    var win = new Window("dialog", "Fast Export Production Files v10");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 20;

    var pnlSettings = win.add("panel", undefined, "Export Settings");
    pnlSettings.orientation = "column";
    pnlSettings.alignChildren = ["left", "top"];
    pnlSettings.margins = 15;
    pnlSettings.spacing = 8;

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
        if (selectedFolder) txtFolder.text = selectedFolder.fsName;
    };

    pnlSettings.add("statictext", undefined, "3. Custom File Name:");
    var txtCustomName = pnlSettings.add("edittext", undefined, cleanDocName + " ");
    txtCustomName.characters = 35;

    pnlSettings.add("statictext", undefined, "4. Artboards:");
    var grpSelection = pnlSettings.add("group");
    grpSelection.orientation = "column";
    grpSelection.alignChildren = ["fill", "top"];

    var selectionButtons = grpSelection.add("group");
    selectionButtons.alignment = "center";

    var btnSelectAll = selectionButtons.add("button", undefined, "Select All");
    var btnSelectNone = selectionButtons.add("button", undefined, "Select None");

    var list = grpSelection.add("listbox", undefined, undefined, {multiselect: true});
    list.preferredSize = [360, 220];

    for (var i = 0; i < doc.artboards.length; i++) {
        var item = list.add("item", doc.artboards[i].name);
        item.artboardIndex = i;
        item.selected = true;
    }

    var counter = grpSelection.add(
        "statictext",
        undefined,
        doc.artboards.length + " of " + doc.artboards.length + " selected"
    );

    function getSelectedIndices() {
        var selection = list.selection;
        var result = [];

        if (!selection) return result;

        if (!(selection instanceof Array)) selection = [selection];

        for (var s = 0; s < selection.length; s++) {
            result.push(selection[s].artboardIndex);
        }

        result.sort(function(a, b) { return a - b; });
        return result;
    }

    function updateCounter() {
        counter.text = getSelectedIndices().length + " of " +
            doc.artboards.length + " selected";
        updatePreview();
    }

    btnSelectAll.onClick = function () {
        for (var a = 0; a < list.items.length; a++) {
            list.items[a].selected = true;
        }
        updateCounter();
    };

    btnSelectNone.onClick = function () {
        for (var a = 0; a < list.items.length; a++) {
            list.items[a].selected = false;
        }
        updateCounter();
    };

    list.onChange = updateCounter;

    pnlSettings.add("statictext", undefined, "5. Additional Settings:");

    var chkGroup = pnlSettings.add(
        "checkbox",
        undefined,
        "Group selected artboards into one file"
    );
    chkGroup.value = false;

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

    pnlSettings.add("statictext", undefined, "6. Folder Organization:");
    var FOLDER_MODE_OPTIONS = [
        "No subfolders",
        "One folder per artboard",
        "One folder per file type"
    ];
    var dropdownFolderMode = pnlSettings.add(
        "dropdownlist",
        undefined,
        FOLDER_MODE_OPTIONS
    );
    dropdownFolderMode.selection = 0;
    dropdownFolderMode.preferredSize.width = 300;

    pnlSettings.add(
        "statictext",
        undefined,
        "7. Bleed (inches) - art inside this won't trigger the edge warning:"
    );
    var grpBleed = pnlSettings.add("group");
    var txtBleed = grpBleed.add("edittext", undefined, "0");
    txtBleed.characters = 8;

    try {
        var detectedBleed = doc.documentBleedOffset;
        if (detectedBleed && detectedBleed.top > 0) {
            txtBleed.text =
                String(Math.round((detectedBleed.top / 72) * 1000) / 1000);
        }
    } catch (eBleedDetect) {}

    var txtPreview = pnlSettings.add("statictext", undefined, "");
    txtPreview.preferredSize.width = 400;

    function cleanName(name) {
        return name.replace(/[/\\:*?"<>|]/g, "-");
    }

    function getPrefix() {
        var value = txtCustomName.text;
        if (value === "") value = cleanDocName + " ";
        return value;
    }

    function updatePreview() {
        var selected = getSelectedIndices();
        var prefix = getPrefix();

        if (selected.length === 0) {
            txtPreview.text = "Preview: No artboards selected";
            return;
        }

        if (chkGroup.value) {
            txtPreview.text = "Preview: " + prefix + "Grouped.pdf";
        } else {
            var firstName = cleanName(doc.artboards[selected[0]].name);
            txtPreview.text = "Preview: " + prefix + firstName + ".pdf";
        }
    }

    txtCustomName.onChanging = updatePreview;
    chkGroup.onClick = updatePreview;
    updatePreview();

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
        RESULT = "WARNING: Operation cancelled.";
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

        var selectedIndices = getSelectedIndices();

        if (selectedIndices.length === 0) {
            RESULT = "ERROR: Select at least one artboard.";
            return;
        }

        var presetName = dropdownPresets.selection.text;

        try {
            app.preferences.setStringPreference("TheSignPack_LastPDFPreset", presetName);
        } catch (e) {}

        var customNameInput = txtCustomName.text.replace(/[/\\:*?"<>|]/g, "-");
        var groupSelected = chkGroup.value;
        var saveAi = chkSaveAi.value;
        var saveEps = chkSaveEps.value;
        var preventOpening = chkDisableView.value;
        var folderMode = dropdownFolderMode.selection
            ? dropdownFolderMode.selection.index
            : 0;

        var bleedInches = parseFloat(txtBleed.text);
        if (isNaN(bleedInches) || bleedInches < 0) bleedInches = 0;
        var bleedPts = bleedInches * 72;

        var total = selectedIndices.length;
        var exportedCount = 0;
        var prevInteractionLevel = app.userInteractionLevel;

        var layerCleanupFailures = [];
        var linkEmbedFailures = [];
        var bleedFailures = [];
        var epsCount = 0;

        var masterTempFile = null;
        var tempAiFile = null;
        var tempDoc = null;

        function fastUnlock(layers) {
            for (var L = 0; L < layers.length; L++) {
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

                if (currentLayer.pageItems.length === 0 &&
                    currentLayer.layers.length === 0) {
                    try {
                        currentLayer.remove();
                    } catch (e) {
                        try { layerCleanupFailures.push(currentLayer.name); } catch (e2) {}
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

                        if (pi.typename === "CompoundPathItem" &&
                            pi.pathItems.length > 0 &&
                            pi.pathItems[0].clipping) {
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
                            childBounds[0], childBounds[1],
                            childBounds[2], childBounds[3]
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
                var itemBounds = getTrueBounds(items[b]);
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
                    names.push(
                        items[b].name && items[b].name !== ""
                            ? items[b].name
                            : items[b].typename
                    );
                }
            }

            return names;
        }

        function cleanupTempFiles() {
            try {
                if (tempDoc) {
                    tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                    tempDoc = null;
                }
            } catch (e1) {}

            try {
                if (tempAiFile && tempAiFile.exists) tempAiFile.remove();
            } catch (e2) {}

            try {
                if (masterTempFile && masterTempFile.exists) masterTempFile.remove();
            } catch (e3) {}
        }

        function buildPdfOptions() {
            var opts = new PDFSaveOptions();
            opts.pDFPreset = presetName;
            opts.preserveEditability = true;
            opts.acrobatLayers = true;
            opts.compatibility = PDFCompatibility.ACROBAT7;
            opts.viewAfterSaving = !preventOpening;
            return opts;
        }

        function buildEpsOptions(targetDoc, useArtboards, artboardRange) {
            var opts = new EPSSaveOptions();

            opts.cmykPostScript =
                targetDoc.documentColorSpace === DocumentColorSpace.CMYK;
            opts.embedAllFonts = false;
            opts.preview = EPSPreview.COLORTIFF;

            // Do not hardcode EPS compatibility. Illustrator's modern
            // default is required for Large Canvas documents.
            if (useArtboards) {
                opts.saveMultipleArtboards = true;
                opts.artboardRange = artboardRange || "";
            }

            try { opts.postScript = PostScriptLevelEnum.LEVEL3; } catch (e1) {}
            try { opts.compatibleGradientPrinting = true; } catch (e2) {}
            try { opts.embedLinkedFiles = true; } catch (e3) {}

            return opts;
        }

        function getOrCreateFolder(parentFolder, name) {
            var folder = new Folder(parentFolder.fsName + "/" + name);
            if (!folder.exists && !folder.create()) {
                throw new Error("Could not create folder: " + folder.fsName);
            }
            return folder;
        }

        function getDestinationFolders(baseName) {
            var artboardDestFolder = destFolder;

            if (folderMode === 1) {
                artboardDestFolder = getOrCreateFolder(destFolder, baseName);
            }

            return {
                artboard: artboardDestFolder,
                pdf: folderMode === 2
                    ? getOrCreateFolder(destFolder, "PDF")
                    : artboardDestFolder,
                ai: folderMode === 2
                    ? getOrCreateFolder(destFolder, "AI")
                    : artboardDestFolder,
                eps: folderMode === 2
                    ? getOrCreateFolder(destFolder, "EPS")
                    : artboardDestFolder
            };
        }

        function getBaseName(index) {
            var abName = cleanName(doc.artboards[index].name);
            var prefix = customNameInput !== "" ? customNameInput : cleanDocName + " ";
            return prefix + abName;
        }

        function getGroupedBaseName() {
            var prefix = customNameInput !== "" ? customNameInput : cleanDocName + " ";
            return prefix + "Grouped";
        }

        function isolateSingleArtboard(targetDoc, index) {
            targetDoc.selection = null;
            targetDoc.artboards.setActiveArtboardIndex(index);

            try {
                app.executeMenuCommand("selectallinartboard");
                app.executeMenuCommand("hide");
                app.executeMenuCommand("selectall");
                app.executeMenuCommand("clear");
                app.executeMenuCommand("showAll");
            } catch (e) {}
        }

        function keepSelectedArtboards(targetDoc, indices) {
            /*
             * Selected artwork is hidden one artboard at a time.
             * After all selected artboards are hidden, all remaining
             * visible artwork belongs to unselected artboards and can
             * be removed. The selected artwork is then shown again.
             */
            for (var s = 0; s < indices.length; s++) {
                targetDoc.selection = null;
                targetDoc.artboards.setActiveArtboardIndex(indices[s]);

                try {
                    app.executeMenuCommand("selectallinartboard");
                    app.executeMenuCommand("hide");
                } catch (e) {}
            }

            try {
                targetDoc.selection = null;
                app.executeMenuCommand("selectall");
                app.executeMenuCommand("clear");
                app.executeMenuCommand("showAll");
            } catch (e) {}
        }

        function removeUnselectedArtboards(targetDoc, indices) {
            var keep = {};
            for (var k = 0; k < indices.length; k++) keep[indices[k]] = true;

            for (var a = targetDoc.artboards.length - 1; a >= 0; a--) {
                if (!keep[a]) {
                    try {
                        targetDoc.artboards[a].remove();
                    } catch (e) {}
                }
            }
        }

        function checkBleedForIndices(targetDoc, indices) {
            for (var b = 0; b < indices.length; b++) {
                var originalIndex = indices[b];

                try {
                    var bounds = targetDoc.artboards[originalIndex].artboardRect;
                    var bleeding = findBleedingItems(targetDoc.pageItems, bounds);

                    if (bleeding.length > 0) {
                        bleedFailures.push(
                            cleanName(doc.artboards[originalIndex].name)
                        );
                    }
                } catch (e) {}
            }
        }

        function prepareMaster() {
            var originalFile = new File(originalFilePath);

            masterTempFile = new File(
                destFolder.fsName + "/_master_temp_build.ai"
            );

            if (!originalFile.copy(masterTempFile)) {
                throw new Error("Could not create the temporary master file.");
            }

            var masterDoc = app.open(masterTempFile);
            fastUnlock(masterDoc.layers);

            try { app.executeMenuCommand("unlockAll"); } catch (e1) {}
            try { app.executeMenuCommand("showAll"); } catch (e2) {}

            try {
                var tFrames = masterDoc.textFrames;
                for (var t = tFrames.length - 1; t >= 0; t--) {
                    try { tFrames[t].createOutline(); } catch (e3) {}
                }
            } catch (e4) {}

            try {
                var placed = masterDoc.placedItems;

                for (var pI = placed.length - 1; pI >= 0; pI--) {
                    try {
                        placed[pI].embed();
                    } catch (eEmbed) {
                        try { linkEmbedFailures.push(placed[pI].name); } catch (eName) {}
                    }
                }
            } catch (ePlaced) {}

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);
        }

        function exportSingle(index) {
            var cleanArtboardName = cleanName(doc.artboards[index].name);
            var baseFileName = getBaseName(index);
            var folders = getDestinationFolders(cleanArtboardName);

            tempAiFile = new File(
                destFolder.fsName + "/_temp_" + index + ".ai"
            );

            if (!masterTempFile.copy(tempAiFile)) {
                throw new Error(
                    "Could not create a temporary file for artboard: " +
                    cleanArtboardName
                );
            }

            tempDoc = app.open(tempAiFile);
            app.activeDocument = tempDoc;

            isolateSingleArtboard(tempDoc, index);

            try {
                var rawBounds = tempDoc.artboards[index].artboardRect;
                var abBounds = [
                    rawBounds[0] - bleedPts,
                    rawBounds[1] + bleedPts,
                    rawBounds[2] + bleedPts,
                    rawBounds[3] - bleedPts
                ];
                var bleeding = findBleedingItems(tempDoc.pageItems, abBounds);
                if (bleeding.length > 0) {
                    bleedFailures.push(cleanArtboardName);
                }
            } catch (eBleed) {}

            removeEmptyLayers(tempDoc.layers);

            for (var a = tempDoc.artboards.length - 1; a >= 0; a--) {
                if (a !== index) {
                    try { tempDoc.artboards[a].remove(); } catch (e) {}
                }
            }

            var pdfTargetFile = new File(
                folders.pdf.fsName + "/" + baseFileName + ".pdf"
            );

            var pdfSaveOpts = buildPdfOptions();
            pdfSaveOpts.artboardRange = "1";
            tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

            if (saveAi) {
                var aiTargetFile = new File(
                    folders.ai.fsName + "/" + baseFileName + ".ai"
                );

                var aiSaveOpts = new IllustratorSaveOptions();
                aiSaveOpts.pdfCompatible = true;
                tempDoc.saveAs(aiTargetFile, aiSaveOpts);
            }

            if (saveEps) {
                var epsTargetFile = new File(
                    folders.eps.fsName + "/" + baseFileName + ".eps"
                );

                tempDoc.saveAs(
                    epsTargetFile,
                    buildEpsOptions(tempDoc, false, "1")
                );
                epsCount++;
            }

            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            tempDoc = null;

            tempAiFile.remove();
            tempAiFile = null;

            $.gc();
            app.activeDocument = doc;
            exportedCount++;
        }

        function exportGrouped() {
            var groupedBaseName = getGroupedBaseName();
            var folders = getDestinationFolders("Grouped");

            // In grouped mode there is one output file per format, so
            // "One folder per artboard" falls back to the main destination.
            if (folderMode === 1) {
                folders.pdf = destFolder;
                folders.ai = destFolder;
                folders.eps = destFolder;
            }

            tempAiFile = new File(destFolder.fsName + "/_temp_grouped.ai");

            if (!masterTempFile.copy(tempAiFile)) {
                throw new Error("Could not create the temporary grouped file.");
            }

            tempDoc = app.open(tempAiFile);
            app.activeDocument = tempDoc;

            keepSelectedArtboards(tempDoc, selectedIndices);

            // Check each selected artboard against its bleed-expanded bounds
            // before deleting the unselected artwork/artboards.
            for (var bi = 0; bi < selectedIndices.length; bi++) {
                var originalIndex = selectedIndices[bi];
                try {
                    var rawBounds = tempDoc.artboards[originalIndex].artboardRect;
                    var abBounds = [
                        rawBounds[0] - bleedPts,
                        rawBounds[1] + bleedPts,
                        rawBounds[2] + bleedPts,
                        rawBounds[3] - bleedPts
                    ];
                    var bleeding = findBleedingItems(tempDoc.pageItems, abBounds);
                    if (bleeding.length > 0) {
                        bleedFailures.push(cleanName(doc.artboards[originalIndex].name));
                    }
                } catch (eBleed) {}
            }

            removeEmptyLayers(tempDoc.layers);
            removeUnselectedArtboards(tempDoc, selectedIndices);

            var pdfTargetFile = new File(
                folders.pdf.fsName + "/" + groupedBaseName + ".pdf"
            );

            var ranges = [];
            for (var r = 1; r <= tempDoc.artboards.length; r++) {
                ranges.push(String(r));
            }

            var pdfSaveOpts = buildPdfOptions();
            pdfSaveOpts.artboardRange = ranges.join(",");
            tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

            if (saveAi) {
                var aiTargetFile = new File(
                    folders.ai.fsName + "/" + groupedBaseName + ".ai"
                );

                var aiSaveOpts = new IllustratorSaveOptions();
                aiSaveOpts.pdfCompatible = true;
                tempDoc.saveAs(aiTargetFile, aiSaveOpts);
            }

            if (saveEps) {
                var epsTargetFile = new File(
                    folders.eps.fsName + "/" + groupedBaseName + ".eps"
                );

                var epsSaveOpts = buildEpsOptions(
                    tempDoc,
                    true,
                    ranges.join(",")
                );

                // This is the scripted equivalent of checking
                // "Use Artboards" in File > Save As > EPS.
                epsSaveOpts.saveMultipleArtboards = true;
                epsSaveOpts.artboardRange = ranges.join(",");

                tempDoc.saveAs(epsTargetFile, epsSaveOpts);
                epsCount++;
            }

            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            tempDoc = null;

            tempAiFile.remove();
            tempAiFile = null;

            $.gc();
            app.activeDocument = doc;

            exportedCount = selectedIndices.length;
        }

        win.close();
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        try {
            prepareMaster();

            if (groupSelected) {
                exportGrouped();
            } else {
                for (var n = 0; n < selectedIndices.length; n++) {
                    exportSingle(selectedIndices[n]);
                }
            }

            if (masterTempFile && masterTempFile.exists) {
                masterTempFile.remove();
            }
            masterTempFile = null;

            app.userInteractionLevel = prevInteractionLevel;
            app.activeDocument = doc;

            var doneMsg;

            if (groupSelected) {
                doneMsg =
                    "SUCCESS: Done!\n" +
                    selectedIndices.length +
                    " selected artboards exported as grouped file(s)" +
                    (saveEps ? " including multi-artboard EPS" : "") +
                    ".";
            } else {
                doneMsg =
                    "SUCCESS: Done!\n" +
                    selectedIndices.length +
                    " selected artboards exported.";
            }

            if (saveEps && !groupSelected) {
                doneMsg += "\n" + epsCount + " EPS file(s) created.";
            }

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
                    " linked file(s) could not be embedded:\n" +
                    linkEmbedFailures.join(", ");
            }

            if (bleedFailures.length > 0) {
                doneMsg +=
                    "\n\nWarning: art extends past the artboard edge and may be clipped on:\n" +
                    bleedFailures.join("\n");
            }

            RESULT = doneMsg;

        } catch (error) {
            app.userInteractionLevel = prevInteractionLevel;
            cleanupTempFiles();

            try { app.activeDocument = doc; } catch (eActiveDoc) {}

            RESULT =
                "ERROR: " +
                error.message +
                "\n\nExported before the error: " +
                exportedCount +
                " of " +
                total +
                " selected artboards." +
                "\nTemporary files were cleaned up.";
        }
    };

    win.show();
}

try {
    main();
} catch (e) {
    if (RESULT === "") {
        RESULT = "ERROR: Unexpected error:\n" + e.message;
    }
}

RESULT;