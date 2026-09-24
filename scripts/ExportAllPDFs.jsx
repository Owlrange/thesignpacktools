#target illustrator

// ============================================================
//  Export All PDFs 1.9
//  Changes from 1.8:
//   - Bug fix: PDF export was scaled down 10x on Large Canvas
//     documents when opened in Acrobat (or any spec-compliant PDF
//     reader), even though Illustrator itself showed it at the
//     right size. Root cause: pdfSaveOpts.compatibility was
//     hardcoded to PDFCompatibility.ACROBAT6 (PDF 1.5) — one
//     version too old for PDF's UserUnit key, which is what
//     records a Large Canvas document's true 10x scale, and isn't
//     supported before PDF 1.6. Without it, the exported PDF's
//     literal page size came out 10x too small, and only
//     Illustrator's own internal awareness of the document
//     papered over it. Bumped to PDFCompatibility.ACROBAT7 (PDF
//     1.6), which supports UserUnit.
//   - Bleed field now defaults to 0 (was 0.125in).
//   - "Include artboard name in file name" now defaults OFF
//     (was ON).
//   - Bug fix: the edge-overhang warning was flagging art that was
//     actually fully clipped to the artboard, in two ways: (1) it
//     was checking every item in the document at every nesting
//     level instead of just top-level ones, so an item already
//     accounted for correctly as part of a clipped group got
//     checked again on its own using its raw, un-clipped bounds;
//     (2) even after fixing that, a clip path's geometricBounds and
//     the artboard's own artboardRect can disagree by a razor-thin
//     floating-point rounding amount (seen: ~1e-12pt) even when
//     they're meant to be the exact same edge — worse on Large
//     Canvas docs where values get scaled internally. A small
//     tolerance (0.05pt) now absorbs that noise without masking any
//     real overhang.
//
//  Changes from 1.7:
//   - Bug fix: EPS export was scaled down 10x on Large Canvas
//     documents, even though a manual File > Save As of the same
//     file came out correct. Root cause: this script hardcoded
//     epsSaveOpts.compatibility to Compatibility.ILLUSTRATOR10, a
//     legacy EPS format spec that predates Large Canvas mode
//     entirely. A manual Save As never sets this and just uses
//     Illustrator's current/modern default, which is why it
//     worked. The line is now removed so the script's EPS export
//     falls back to the same default a manual Save As would use.
//
//  Changes from 1.6:
//   - New: "Bleed" input field (default 0.125in, editable per
//     job since bleed varies by file). Art that extends past the
//     artboard but stays within this bleed amount no longer
//     triggers the edge-overhang warning; only real overhang past
//     the bleed itself gets flagged. Best-effort auto-detection
//     from the document pre-fills the field when available, but
//     nothing here writes bleed to the file or changes the actual
//     export in any way — it only affects the warning check.
//
//  Changes from 1.5.5:
//   - New: "Folder Organization" dropdown with three modes:
//     No subfolders (default, same as before), One folder per
//     artboard (each sign's PDF/AI/EPS grouped together), or
//     One folder per file type (separate PDF/AI/EPS folders,
//     only created for formats you're actually exporting).
//     Folders are created automatically if missing.
//
//  Changes from 1.5:
//   - Bug fix: custom file name text is now sanitized for
//     illegal filesystem characters (previously only the
//     document/artboard names were)
//   - Bug fix: duplicate artboard names (Illustrator allows
//     this) are now detected before export and warned about,
//     same as the existing artboard-name-off collision warning
//   - New: lightweight progress palette shows "Exporting X of Y:
//     [artboard name]" with a centered text-drawn progress bar
//     (ScriptUI's native progressbar control renders solid black
//     and never visibly fills under Illustrator's dark theme, so
//     a block-character bar is used instead)
//   - New toggle: "Include artboard name in file name",
//     defaulting to ON (checked = same behavior as before).
//     When OFF, only the custom name is used for the filename.
//   - If the toggle is OFF and the document has more than one
//     artboard, a confirm dialog warns before export starts that
//     every artboard's files will share the same name and
//     overwrite each other, letting you cancel or continue.
//
//  Changes from 1.4:
//   - EPS now exports at PostScript Level 3 with Compatible
//     Gradient and Gradient Mesh Printing enabled
//   - All linked files are embedded into the master temp doc
//     before any PDF/AI/EPS is exported, so nothing stays
//     linked in the exported files (PDF/AI have no per-format
//     "embed links" flag, so this is done at the document level)
//   - Any link that fails to embed is now listed in the final
//     summary instead of silently staying linked
//   - New: after each artboard is isolated, any art that
//     partially bleeds past the artboard edge is flagged in the
//     final summary (won't stop the export). Clipping masks are
//     respected — a big image clipped down to a small shape
//     won't trigger a false warning, only the visible clipped
//     area is checked. Items entirely outside the artboard are
//     not flagged.
//
//  Changes from 1.4 (1.3 -> 1.4):
//   - Added "Also save as .eps file" option, alongside the
//     existing .ai option; both default to checked
//   - Guard added: clicking Export with no PDF preset selected
//     (or none installed) now shows a clear alert instead of
//     throwing an unhandled error
//
//  Changes from 1.2.8:
//   - Temp files (_master_temp_build.ai / _temp_N.ai) are cleaned
//     up even when the export fails partway through
//   - Layers that could not be removed during cleanup are listed
//     in the final message instead of failing silently
//
//  MAINTENANCE NOTE: this script relies on Illustrator's own
//  'selectallinartboard' menu command to isolate each artboard's
//  content. Adobe has changed this command's behavior between
//  versions before. After ANY Illustrator update, spot-check one
//  exported PDF against the source file before trusting a batch.
// ============================================================

function exportProductionFilesV9() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var originalFilePath = "";

    try {
        if (!doc.saved) doc.save();
        originalFilePath = doc.fullName.fsName;
    } catch (e) {
        alert("Please save your original .ai file first.");
        return;
    }

    var docName = doc.name.replace(/\.[^\.]+$/, ''); 
    var cleanDocName = docName.replace(/[\/\\:*?"<>|]/g, '-');
    var pdfPresets = app.PDFPresetsList;

    var win = new Window("dialog", "Export All PDFs 1.9");
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
    
    txtCustomName.onChanging = function() { updatePreview(); };

    function updatePreview() {
        var currentText = txtCustomName.text.replace(/[\/\\:*?"<>|]/g, '-');
        if (currentText === "") currentText = cleanDocName + " ";
        var suffix = (typeof chkIncludeArtboardName !== "undefined" && !chkIncludeArtboardName.value)
            ? "" : firstAbName;
        txtPreview.text = "Preview: " + currentText + suffix + ".pdf";
    }

    pnlSettings.add("statictext", undefined, "4. Additional Settings:");
    var chkSaveAi = pnlSettings.add("checkbox", undefined, "Also save as .ai file");
    chkSaveAi.value = true;

    var chkSaveEps = pnlSettings.add("checkbox", undefined, "Also save as .eps file");
    chkSaveEps.value = true;

    var chkDisableView = pnlSettings.add("checkbox", undefined, "Prevent PDFs from opening automatically");
    chkDisableView.value = false; 

    var chkIncludeArtboardName = pnlSettings.add("checkbox", undefined, "Include artboard name in file name");
    chkIncludeArtboardName.value = false;
    chkIncludeArtboardName.onClick = function() { updatePreview(); };
    updatePreview(); // refresh the preview text now that the default changed

    pnlSettings.add("statictext", undefined, "5. Folder Organization:");
    var FOLDER_MODE_OPTIONS = ["No subfolders", "One folder per artboard", "One folder per file type"];
    var dropdownFolderMode = pnlSettings.add("dropdownlist", undefined, FOLDER_MODE_OPTIONS);
    dropdownFolderMode.selection = 0; // default: no subfolders, current behavior
    dropdownFolderMode.preferredSize.width = 300;

    pnlSettings.add("statictext", undefined, "6. Bleed (inches) \u2014 art inside this won't trigger the edge warning:");
    var grpBleed = pnlSettings.add("group");
    var txtBleed = grpBleed.add("edittext", undefined, "0");
    txtBleed.characters = 8;

    // Best-effort auto-detect: Illustrator doesn't reliably expose the
    // Document Setup bleed value to scripting across all versions/files,
    // so this only pre-fills the field when it CAN be read — the field
    // stays editable either way, and nothing here writes bleed to the
    // file or affects the actual export in any way. It only decides
    // where the "acceptable" zone ends for the edge-overhang warning.
    try {
        var detectedBleed = doc.documentBleedOffset; // may not exist on all versions
        if (detectedBleed && detectedBleed.top > 0) {
            txtBleed.text = String(Math.round((detectedBleed.top / 72) * 1000) / 1000);
        }
    } catch (eBleedDetect) {}

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
        if (txtFolder.text === "") { alert("Select an output folder."); return; }
        var destFolder = new Folder(txtFolder.text);
        if (!destFolder.exists) { alert("Folder does not exist."); return; }
        
        if (!dropdownPresets.selection) { alert("No PDF preset selected (or none installed)."); return; }
        var presetName = dropdownPresets.selection.text;

        var bleedInches = parseFloat(txtBleed.text);
        if (isNaN(bleedInches) || bleedInches < 0) bleedInches = 0;
        var bleedPts = bleedInches * 72;

        try { app.preferences.setStringPreference("TheSignPack_LastPDFPreset", presetName); } catch(e) {}

        var includeArtboardName = chkIncludeArtboardName.value;
        var folderMode = dropdownFolderMode.selection ? dropdownFolderMode.selection.index : 0;
        // 0 = no subfolders, 1 = per artboard, 2 = per file type
        if (!includeArtboardName && doc.artboards.length > 1) {
            var proceedAnyway = confirm(
                "Artboard names are OFF and this document has " + doc.artboards.length + " artboards.\n\n" +
                "Every exported file will share the same name and will overwrite each other \u2014 " +
                "only the last artboard's files will remain.\n\nContinue anyway?",
                true, "Filename Collision Warning"
            );
            if (!proceedAnyway) return;
        }

        // Duplicate artboard names (Illustrator allows this) produce the
        // same collision even with the toggle ON, so check separately.
        if (includeArtboardName) {
            var abNameCounts = {};
            var abDupes = [];
            for (var da = 0; da < doc.artboards.length; da++) {
                var dupNm = doc.artboards[da].name.replace(/[\/\\:*?"<>|]/g, '-');
                if (abNameCounts[dupNm]) {
                    abNameCounts[dupNm]++;
                    if (abNameCounts[dupNm] === 2) abDupes.push(dupNm);
                } else {
                    abNameCounts[dupNm] = 1;
                }
            }
            if (abDupes.length > 0) {
                var proceedDupe = confirm(
                    "Some artboards share the same name after cleanup:\n\n" + abDupes.join(", ") +
                    "\n\nFiles for these artboards will overwrite each other during export.\n\nContinue anyway?",
                    true, "Duplicate Artboard Names"
                );
                if (!proceedDupe) return;
            }
        }

        var customNameInput = txtCustomName.text.replace(/[\/\\:*?"<>|]/g, '-');
        var saveAi = chkSaveAi.value;
        var saveEps = chkSaveEps.value;
        var preventOpening = chkDisableView.value;
        var total = doc.artboards.length;
        var exportedCount = 0;

        win.close(); 

        // Lightweight progress palette — non-blocking, just visual feedback
        // during the batch. Doesn't affect the export logic itself.
        // Uses a text-drawn bar instead of ScriptUI's native progressbar,
        // which renders as solid black and never visibly fills under
        // Illustrator's dark UI theme.
        var PROG_BAR_SEGMENTS = 24;
        var progWin = new Window("palette", "Exporting\u2026");
        progWin.orientation = "column";
        progWin.alignChildren = ["fill", "top"];
        progWin.margins = 16;
        progWin.spacing = 8;
        var progStatus = progWin.add("statictext", undefined, "Preparing\u2026");
        progStatus.preferredSize.width = 320;
        progStatus.justify = "center";
        var progBarText = progWin.add("statictext", undefined, "");
        progBarText.preferredSize.width = 320;
        progBarText.justify = "center";
        progWin.show();

        function updateProgress(current, label) {
            try {
                var filled = Math.round((current / total) * PROG_BAR_SEGMENTS);
                if (filled > PROG_BAR_SEGMENTS) filled = PROG_BAR_SEGMENTS;
                var bar = "";
                for (var bs = 0; bs < PROG_BAR_SEGMENTS; bs++) {
                    bar += (bs < filled) ? "\u25A0" : "\u25A1"; // filled / empty square
                }
                progStatus.text = "Exporting " + current + " of " + total + ": " + label;
                progBarText.text = bar;
                progWin.update();
                app.redraw();
            } catch (eProg) {}
        }

        function getOrCreateFolder(parentFolder, name) {
            var f = new Folder(parentFolder.fsName + "/" + name);
            if (!f.exists) f.create();
            return f;
        }

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

        var layerCleanupFailures = [];
        function removeEmptyLayers(layers) {
            for (var l = layers.length - 1; l >= 0; l--) {
                var currentLayer = layers[l];
                if (currentLayer.layers.length > 0) {
                    removeEmptyLayers(currentLayer.layers);
                }
                if (currentLayer.pageItems.length === 0 && currentLayer.layers.length === 0) {
                    try { currentLayer.remove(); } catch(e) {
                        // Remember which layers refused to go so the final
                        // message can say so instead of hiding it
                        try { layerCleanupFailures.push(currentLayer.name); } catch(e2) {}
                    }
                }
            }
        }

        // True bounds of an item, respecting clipping masks. A clipped
        // group's own geometricBounds ignores the mask and reports the
        // full extent of whatever is inside it (e.g. an oversized image
        // clipped down to a small shape) — that would produce false
        // bleed warnings below, so clipped groups use the clip path's
        // own bounds instead, same approach as the SQ FT Calculator.
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
                            pi.pathItems.length > 0 && pi.pathItems[0].clipping) {
                            return pi.geometricBounds;
                        }
                    }
                }
                var u = null;
                for (var g = 0; g < item.pageItems.length; g++) {
                    var cb = getTrueBounds(item.pageItems[g]);
                    if (!cb) continue;
                    if (!u) {
                        u = [cb[0], cb[1], cb[2], cb[3]];
                    } else {
                        if (cb[0] < u[0]) u[0] = cb[0];
                        if (cb[1] > u[1]) u[1] = cb[1];
                        if (cb[2] > u[2]) u[2] = cb[2];
                        if (cb[3] < u[3]) u[3] = cb[3];
                    }
                }
                return u;
            }
            return item.geometricBounds;
        }

        // Checks every top-level item still on the artboard against the
        // artboard's own bounds. Only flags items that PARTIALLY bleed
        // past an edge (per your answer) — items entirely outside the
        // artboard are ignored, since selectallinartboard shouldn't be
        // selecting those anyway.
        function findBleedingItems(items, abBounds) {
            var names = [];
            for (var b = 0; b < items.length; b++) {
                var it = items[b];
                // "items" here is tempDoc.pageItems, which is a FLAT list of
                // every item in the document at every nesting level, not
                // just top-level ones. Without this check, an item buried
                // inside a clipped group gets measured twice: once
                // correctly as part of the group (via getTrueBounds' clip-
                // aware descent below), and once more on its own using its
                // raw, un-clipped bounds — producing a false "outside
                // artboard" warning for art that's actually properly
                // clipped. Only top-level items (directly on a layer) are
                // checked here; getTrueBounds handles everything nested
                // inside them, clipped or not.
                try {
                    if (!it.parent || it.parent.typename !== "Layer") continue;
                } catch (eParent) { continue; }
                var tb = getTrueBounds(it);
                if (!tb) continue;
                // A clip path's geometricBounds and the artboard's own
                // artboardRect can disagree by a razor-thin amount (seen:
                // ~1e-12pt) even when they're meant to be the exact same
                // edge — a floating-point rounding quirk, worse on Large
                // Canvas docs where values get scaled internally. A strict
                // >=/<= comparison treats that as "poking past the edge"
                // and false-flags art that's genuinely fully clipped to
                // the artboard. BLEED_EPSILON absorbs that noise (0.05pt —
                // far larger than the rounding error, far smaller than
                // any bleed anyone would actually care about).
                var BLEED_EPSILON = 0.05;
                // tb/abBounds = [left, top, right, bottom]
                var overlaps = !(tb[2] < abBounds[0] - BLEED_EPSILON || tb[0] > abBounds[2] + BLEED_EPSILON ||
                                  tb[1] < abBounds[3] - BLEED_EPSILON || tb[3] > abBounds[1] + BLEED_EPSILON);
                if (!overlaps) continue; // fully outside — ignore
                var fullyInside = (tb[0] >= abBounds[0] - BLEED_EPSILON && tb[2] <= abBounds[2] + BLEED_EPSILON &&
                                    tb[1] <= abBounds[1] + BLEED_EPSILON && tb[3] >= abBounds[3] - BLEED_EPSILON);
                if (!fullyInside) {
                    var nm = (it.name && it.name !== "") ? it.name : it.typename;
                    names.push(nm);
                }
            }
            return names;
        }

        // Declared outside the try so the error handler can clean them up
        var masterTempFile = null;
        var tempAiFile = null;
        var tempDoc = null;

        function cleanupTempFiles() {
            // Close a temp doc if one is still open, then delete temp files
            try {
                if (tempDoc && tempDoc.name && /^_temp_/.test(tempDoc.name)) {
                    tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                }
            } catch (eC1) {}
            try { if (tempAiFile && tempAiFile.exists) tempAiFile.remove(); } catch (eC2) {}
            try { if (masterTempFile && masterTempFile.exists) masterTempFile.remove(); } catch (eC3) {}
        }

        try {
            masterTempFile = new File(destFolder.fsName + "/_master_temp_build.ai");
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

            // Embed every linked file (PDF and AI saveAs have no
            // "embed links" flag — the only way to guarantee no
            // missing-link references is to embed them in the doc
            // itself, once, here, before any per-artboard copies
            // are made. EPS also gets its own embedLinkedFiles flag
            // below as a second layer of safety.
            var linkEmbedFailures = [];
            var bleedFailures = [];
            try {
                var placed = masterDoc.placedItems;
                for (var pI = placed.length - 1; pI >= 0; pI--) {
                    try { placed[pI].embed(); }
                    catch (eEmbed) {
                        try { linkEmbedFailures.push(placed[pI].name); } catch(eN) {}
                    }
                }
            } catch (ePlaced) {}

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);

            for (var i = 0; i < total; i++) {
                var abName = doc.artboards[i].name;
                var cleanArtboardName = abName.replace(/[\/\\:*?"<>|]/g, '-'); 
                updateProgress(i + 1, abName);
                
                var prefix = (customNameInput !== "") ? customNameInput : (cleanDocName + " ");
                var baseFileName = includeArtboardName
                    ? (prefix + cleanArtboardName)
                    : prefix.replace(/\s+$/, '');

                // Per-artboard folder mode: everything for this sign goes
                // into its own subfolder, named after the artboard itself
                // (independent of the include-artboard-name toggle above).
                var artboardDestFolder = destFolder;
                if (folderMode === 1) {
                    artboardDestFolder = getOrCreateFolder(destFolder, cleanArtboardName);
                }
                
                tempAiFile = new File(destFolder.fsName + "/_temp_" + i + ".ai");
                masterTempFile.copy(tempAiFile); 
                
                tempDoc = app.open(tempAiFile);
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

                // Check what's left against this artboard's bounds, expanded
                // by the bleed amount — art inside the bleed zone is expected
                // and won't get clipped by the RIP, so it shouldn't warn.
                // Only genuine overhang past the bleed itself gets flagged.
                try {
                    var rawBounds = tempDoc.artboards[i].artboardRect;
                    var abBounds = [
                        rawBounds[0] - bleedPts, // left
                        rawBounds[1] + bleedPts, // top
                        rawBounds[2] + bleedPts, // right
                        rawBounds[3] - bleedPts  // bottom
                    ];
                    var bleeding = findBleedingItems(tempDoc.pageItems, abBounds);
                    if (bleeding.length > 0) {
                        bleedFailures.push(cleanArtboardName);
                    }
                } catch (eBleed) {}

                removeEmptyLayers(tempDoc.layers);
                
                var abCount = tempDoc.artboards.length;
                for (var a = abCount - 1; a >= 0; a--) {
                    if (a !== i) {
                        try { tempDoc.artboards[a].remove(); } catch(e){}
                    }
                }
                
                var pdfDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "PDF") : artboardDestFolder;
                var pdfTargetFile = new File(pdfDestFolder.fsName + "/" + baseFileName + ".pdf");
                var pdfSaveOpts = new PDFSaveOptions();
                pdfSaveOpts.pDFPreset = presetName;
                pdfSaveOpts.preserveEditability = true; 
                pdfSaveOpts.acrobatLayers = true;
                // ACROBAT7 (PDF 1.6) or higher — PDF's UserUnit key, which
                // records a Large Canvas document's true 10x scale, isn't
                // supported before PDF 1.6. Previously hardcoded to
                // ACROBAT6 (PDF 1.5), one version too old for UserUnit to
                // be included at all: Illustrator opened the exported PDF
                // at the right size anyway (it has its own internal
                // awareness of the document), but Acrobat and other
                // spec-compliant readers had nothing to go on but the
                // literal page size in the file, which came out 10x
                // too small.
                pdfSaveOpts.compatibility = PDFCompatibility.ACROBAT7;
                pdfSaveOpts.artboardRange = "1"; 
                pdfSaveOpts.viewAfterSaving = !preventOpening;
                
                tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

                if (saveAi) {
                    var aiDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "AI") : artboardDestFolder;
                    var aiTargetFile = new File(aiDestFolder.fsName + "/" + baseFileName + ".ai");
                    var aiSaveOpts = new IllustratorSaveOptions();
                    aiSaveOpts.pdfCompatible = true;
                    tempDoc.saveAs(aiTargetFile, aiSaveOpts);
                }

                if (saveEps) {
                    var epsDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "EPS") : artboardDestFolder;
                    var epsTargetFile = new File(epsDestFolder.fsName + "/" + baseFileName + ".eps");
                    var epsSaveOpts = new EPSSaveOptions();
                    epsSaveOpts.cmykPostScript = (tempDoc.documentColorSpace === DocumentColorSpace.CMYK);
                    epsSaveOpts.embedAllFonts = false; // text is already outlined by this point
                    epsSaveOpts.preview = EPSPreview.COLORTIFF;
                    // compatibility intentionally left unset — Illustrator
                    // defaults to the current/modern format, same as a
                    // manual File > Save As. Previously hardcoded to
                    // Compatibility.ILLUSTRATOR10 (a legacy format from
                    // long before Large Canvas existed), which is why
                    // EPS exports from this script came out scaled down
                    // 10x on Large Canvas documents while a manual Save
                    // As of the same file came out correct.
                    try { epsSaveOpts.postScript = PostScriptLevelEnum.LEVEL3; } catch(ePS) {}
                    try { epsSaveOpts.compatibleGradientPrinting = true; } catch(eGP) {}
                    try { epsSaveOpts.embedLinkedFiles = true; } catch(eEL) {}
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
            
            masterTempFile.remove();
            masterTempFile = null;

            app.userInteractionLevel = prevInteractionLevel; 
            var doneMsg = "Done!\n" + exportedCount + " artboards exported.";
            if (layerCleanupFailures.length > 0) {
                doneMsg += "\n\nNote: " + layerCleanupFailures.length +
                           " empty layer(s) could not be removed during cleanup:\n" +
                           layerCleanupFailures.join(", ");
            }
            if (linkEmbedFailures.length > 0) {
                doneMsg += "\n\nNote: " + linkEmbedFailures.length +
                           " linked file(s) could not be embedded (likely still linked in the export):\n" +
                           linkEmbedFailures.join(", ");
            }
            if (bleedFailures.length > 0) {
                doneMsg += "\n\nWarning: art extends past the artboard edge and may be clipped on:\n" +
                           bleedFailures.join("\n");
            }
            try { progWin.close(); } catch (ePc1) {}
            alert(doneMsg);
        } catch (error) { 
            app.userInteractionLevel = prevInteractionLevel;
            cleanupTempFiles();
            try { progWin.close(); } catch (ePc2) {}
            alert("Error:\n" + error.message +
                  "\n\nExported before the error: " + exportedCount + " of " + total + " artboards." +
                  "\nTemporary files were cleaned up.");
        }
    };
    win.show();
}

exportProductionFilesV9();