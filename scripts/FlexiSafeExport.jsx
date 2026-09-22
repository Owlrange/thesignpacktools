// ============================================================
//  Flexi-Safe Export 1.3  —  for Adobe Illustrator
//
//  Makes client-handoff PDFs (and optional .ai) that survive
//  import into FlexiDesign/FlexiSIGN and other RIP/cut software
//  that ignores Illustrator clipping masks.
//
//  1.3 — simplified image handling with explicit options:
//   - Images inside clipping masks are rasterized (that's what a
//     baked shape cut IS for pixels) at the DPI / color / background
//     YOU pick in the UI: 150 or 300 DPI, CMYK or RGB,
//     Transparent or White. Defaults: 150, CMYK, Transparent.
//   - Vector content sharing a mask with an image still stays
//     vector (children are split, each keeps the mask shape)
//   - Resolution is auto-capped for very large art so Illustrator
//     can't silently collapse it to garbage values
//
//  Also: per-artboard export, bleed option (trim cuts at the
//  bleed mark), text outlined, grouped output, artboard-edge trim.
//
//  IMPORTANT: compare output against the original before sending
//  to a client the first time, and after any Illustrator update.
// ============================================================

#target illustrator

function flexiSafeExport() {

    // ------------------ SETTINGS ------------------
    var DEFAULT_PRESET  = "[PDF/X-1a:2001]"; // preselected when no saved preference
    var DEFAULT_BLEED   = "0.125";           // inches, shown in the bleed box
    var OUTLINE_TEXT    = true;              // convert all text to outlines
    var KEEP_EDITABLE   = true;              // preserve AI editing data in the PDF (opens grouped; larger file)
    var PREF_KEY        = "TheSignPack_FlexiPDFPreset";
    var MAX_SIDE_PX     = 16000;             // Illustrator raster limit: max pixels per side
    var MAX_TOTAL_PX    = 50000000;          // Illustrator raster limit: max total pixels
    // ----------------------------------------------

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

    // ---- UI ----
    var win = new Window("dialog", "Flexi-Safe Export 1.3");
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.margins = 20;

    var pnlSettings = win.add("panel", undefined, "Export Settings");
    pnlSettings.orientation = "column"; pnlSettings.alignChildren = ["left", "top"]; pnlSettings.margins = 15; pnlSettings.spacing = 10;

    pnlSettings.add("statictext", undefined, "1. Select PDF Preset:");
    var dropdownPresets = pnlSettings.add("dropdownlist", undefined, pdfPresets);

    var savedPreset = "";
    try { savedPreset = app.preferences.getStringPreference(PREF_KEY); } catch (e) {}
    if (savedPreset === "") savedPreset = DEFAULT_PRESET;

    var presetIndex = 0;
    for (var p = 0; p < pdfPresets.length; p++) {
        if (pdfPresets[p] === savedPreset) { presetIndex = p; break; }
    }
    dropdownPresets.selection = presetIndex;
    dropdownPresets.preferredSize.width = 300;

    pnlSettings.add("statictext", undefined, "2. Output Folder:");
    var grpFolder = pnlSettings.add("group");
    var btnFolder = grpFolder.add("button", undefined, "Browse...");
    var txtFolder = grpFolder.add("edittext", undefined, doc.path.fsName); txtFolder.characters = 35;

    btnFolder.onClick = function () {
        var startFolder = new Folder(doc.path.fsName);
        var selectedFolder = Folder.selectDialog("Select destination folder", startFolder);
        if (selectedFolder) txtFolder.text = selectedFolder.fsName;
    };

    pnlSettings.add("statictext", undefined, "3. Custom File Name:");
    var txtCustomName = pnlSettings.add("edittext", undefined, cleanDocName + " ");
    txtCustomName.characters = 35;

    var firstAbName = doc.artboards[0].name.replace(/[\/\\:*?"<>|]/g, '-');
    var txtPreview = pnlSettings.add("statictext", undefined, "Preview: " + txtCustomName.text + firstAbName + ".pdf");
    txtPreview.preferredSize.width = 350;

    txtCustomName.onChanging = function () {
        var currentText = txtCustomName.text;
        if (currentText === "") currentText = cleanDocName + " ";
        txtPreview.text = "Preview: " + currentText + firstAbName + ".pdf";
    };

    pnlSettings.add("statictext", undefined, "4. Image Rasterization:");
    var grpRaster = pnlSettings.add("group");
    grpRaster.add("statictext", undefined, "DPI:");
    var ddDpi = grpRaster.add("dropdownlist", undefined, ["150", "300"]);
    ddDpi.selection = 0; // 150
    grpRaster.add("statictext", undefined, "Color:");
    var ddColor = grpRaster.add("dropdownlist", undefined, ["CMYK", "RGB"]);
    ddColor.selection = 0; // CMYK
    grpRaster.add("statictext", undefined, "Background:");
    var ddBg = grpRaster.add("dropdownlist", undefined, ["Transparent", "White"]);
    ddBg.selection = 0; // Transparent

    pnlSettings.add("statictext", undefined, "5. Additional Settings:");
    var chkSaveAi = pnlSettings.add("checkbox", undefined, "Also save baked .ai file(s)");
    chkSaveAi.value = true;

    var chkDisableView = pnlSettings.add("checkbox", undefined, "Prevent PDFs from opening automatically");
    chkDisableView.value = false;

    var grpBleed = pnlSettings.add("group");
    var chkBleed = grpBleed.add("checkbox", undefined, "Add bleed:");
    chkBleed.value = false;
    var txtBleed = grpBleed.add("edittext", undefined, DEFAULT_BLEED);
    txtBleed.characters = 6;
    txtBleed.enabled = false;
    grpBleed.add("statictext", undefined, "inches (art is trimmed at the bleed mark)");

    chkBleed.onClick = function () { txtBleed.enabled = chkBleed.value; };

    var warningGroup = win.add("group");
    warningGroup.orientation = "column";
    warningGroup.alignChildren = ["center", "top"];
    warningGroup.spacing = 2;
    warningGroup.margins = [0, 5, 0, 0];
    warningGroup.add("statictext", undefined, "Processing runs in the background.");
    warningGroup.add("statictext", undefined, "(Illustrator may look frozen, but it hasn't crashed!)");
    warningGroup.add("statictext", undefined, "Compare the result with the original before sending to a client.");

    var grpButtons = win.add("group"); grpButtons.alignment = ["center", "top"]; grpButtons.margins = [0, 10, 0, 0];
    var btnExport = grpButtons.add("button", undefined, "Export Flexi-Safe Files");
    var btnCancel = grpButtons.add("button", undefined, "Cancel");

    btnCancel.onClick = function () { win.close(); };

    btnExport.onClick = function () {
        if (txtFolder.text === "") { alert("Select an output folder."); return; }
        var destFolder = new Folder(txtFolder.text);
        if (!destFolder.exists) { alert("Folder does not exist."); return; }

        var presetName = dropdownPresets.selection.text;
        try { app.preferences.setStringPreference(PREF_KEY, presetName); } catch (e) {}

        var customNameInput = txtCustomName.text;
        if (customNameInput === "") customNameInput = cleanDocName + " ";
        var saveAi = chkSaveAi.value;
        var preventOpening = chkDisableView.value;

        var rasterDpi = parseInt(ddDpi.selection.text, 10);
        if (isNaN(rasterDpi) || rasterDpi <= 0) rasterDpi = 150;
        var rasterCMYK = (ddColor.selection.text === "CMYK");
        var rasterTransparent = (ddBg.selection.text === "Transparent");

        var bleedPts = 0;
        if (chkBleed.value) {
            var bleedIn = parseFloat(txtBleed.text);
            if (isNaN(bleedIn) || bleedIn < 0) bleedIn = 0;
            bleedPts = bleedIn * 72;
        }

        var total = doc.artboards.length;
        var exportedCount = 0;

        win.close();

        var originalFile = new File(originalFilePath);
        var prevInteractionLevel = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        // Declared outside the try so the error handler can clean them up
        var masterTempFile = null;
        var tempAiFile = null;
        var masterDoc = null;
        var tempDoc = null;

        function cleanupTempFiles() {
            try { if (masterDoc) masterDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC0) {}
            try {
                if (tempDoc && tempDoc.name && /^_flexi_temp_/.test(tempDoc.name)) {
                    tempDoc.close(SaveOptions.DONOTSAVECHANGES);
                }
            } catch (eC1) {}
            try { if (tempAiFile && tempAiFile.exists) tempAiFile.remove(); } catch (eC2) {}
            try { if (masterTempFile && masterTempFile.exists) masterTempFile.remove(); } catch (eC3) {}
        }

        function unlockAllLayers(layers) {
            for (var L = 0; L < layers.length; L++) {
                try {
                    if (layers[L].locked) layers[L].locked = false;
                    if (!layers[L].visible) layers[L].visible = true;
                    if (layers[L].layers.length > 0) unlockAllLayers(layers[L].layers);
                } catch (eL) {}
            }
        }

        function containsRaster(item) {
            if (item.typename === "RasterItem" || item.typename === "PlacedItem") return true;
            if (item.typename === "GroupItem" || item.typename === "CompoundPathItem") {
                var kids = (item.typename === "GroupItem") ? item.pageItems : item.pathItems;
                for (var k = 0; k < kids.length; k++) {
                    if (containsRaster(kids[k])) return true;
                }
            }
            return false;
        }

        // Single pass: collect every clip group, innermost FIRST
        function collectClipGroups(container, out) {
            for (var k = 0; k < container.pageItems.length; k++) {
                var it = container.pageItems[k];
                if (it.typename === "GroupItem") {
                    collectClipGroups(it, out);
                    if (it.clipped) out.push(it);
                }
            }
        }

        var bakedVector = 0;
        var rasterizedImgs = 0;
        var failed = 0;
        var textOutlined = 0;
        var trimmed = 0;

        // ---- Vector crop of one clip group (selection-based) ----
        function bakeVectorGroup(dcRef, grp) {
            dcRef.selection = null;
            grp.selected = true;
            try { app.executeMenuCommand("OffsetPath v22"); } catch (eOS) {} // Outline Stroke
            try { app.executeMenuCommand("expandStyle"); } catch (eE1) {}
            app.executeMenuCommand("Live Pathfinder Crop");
            app.executeMenuCommand("expandStyle");
            try { app.executeMenuCommand("group"); } catch (eG) {}
            dcRef.selection = null;
        }

        // ---- Rasterize one image clip group at the CHOSEN settings ----
        // Bounds are padded one output pixel outward so pixel-grid
        // snapping can't leave a transparent sliver at the boundary.
        // Resolution is capped for very large art so Illustrator can't
        // silently collapse it.
        function rasterizeImageGroup(dcRef, grp, sf, boundsRect) {
            var dpi = rasterDpi;

            var target = null;
            if (boundsRect) {
                var pad = 72 / dpi;
                if (pad < 1) pad = 1;
                target = [boundsRect[0] - pad, boundsRect[1] + pad,
                          boundsRect[2] + pad, boundsRect[3] - pad];
            }

            // Cap for physical size (real inches; Large Canvas corrected)
            try {
                var mb = target;
                if (!mb) mb = grp.visibleBounds;
                var wInches = ((mb[2] - mb[0]) / 72) * sf;
                var hInches = ((mb[1] - mb[3]) / 72) * sf;
                if (wInches > 0 && hInches > 0) {
                    var sideCap = Math.floor(MAX_SIDE_PX / Math.max(wInches, hInches));
                    var areaCap = Math.floor(Math.sqrt(MAX_TOTAL_PX / (wInches * hInches)));
                    var cap = Math.min(sideCap, areaCap);
                    if (cap < 36) cap = 36;
                    if (dpi > cap) dpi = cap;
                }
            } catch (eCap) {}

            var ro = new RasterizeOptions();
            // Large Canvas fix: Illustrator reads this resolution in
            // CANVAS units (1/10 real on Large Canvas), so a 150 request
            // produced 15 real DPI. Multiplying by the scale factor makes
            // the requested DPI come out as REAL DPI on any canvas type.
            ro.resolution = dpi * sf;
            ro.transparency = rasterTransparent;
            ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;

            if (target) dcRef.rasterize(grp, target, ro);
            else dcRef.rasterize(grp, undefined, ro);
        }

        // Rectangle intersection for [l, t, r, b] bounds; null if none
        function intersectRect(a, b) {
            var l = Math.max(a[0], b[0]);
            var t = Math.min(a[1], b[1]);
            var r = Math.min(a[2], b[2]);
            var bt = Math.max(a[3], b[3]);
            if (r <= l || t <= bt) return null;
            return [l, t, r, bt];
        }

        // ---- Bake ONE clip group into real geometry ----
        // Vector-only: cropped as vectors. Contains images: children are
        // SPLIT — vector siblings cropped as vectors; image-bearing
        // siblings rasterized at the chosen settings, cut to the mask.
        function bakeClipGroup(dcRef, clipGroup, sf) {
            try {
                if (!containsRaster(clipGroup)) {
                    bakeVectorGroup(dcRef, clipGroup);
                    bakedVector++;
                    return;
                }

                // Find the mask path
                var mask = null;
                var maskIsCompound = false;
                for (var c = 0; c < clipGroup.pageItems.length; c++) {
                    var pi = clipGroup.pageItems[c];
                    if (pi.typename === "PathItem" && pi.clipping) { mask = pi; break; }
                    if (pi.typename === "CompoundPathItem" &&
                        pi.pathItems.length > 0 && pi.pathItems[0].clipping) {
                        mask = pi; maskIsCompound = true; break;
                    }
                }
                if (!mask) {
                    rasterizeImageGroup(dcRef, clipGroup, sf, null);
                    rasterizedImgs++;
                    return;
                }

                var maskBounds = mask.geometricBounds;

                // Split children; dissolve plain groups that MIX images
                // and vectors so vectors never rasterize with a photo
                var queue = [];
                for (var k = 0; k < clipGroup.pageItems.length; k++) {
                    if (clipGroup.pageItems[k] !== mask) queue.push(clipGroup.pageItems[k]);
                }

                while (queue.length > 0) {
                    var kid = queue.shift();
                    try {
                        if (kid.typename === "GroupItem" && !kid.clipped && containsRaster(kid)) {
                            var subs = [];
                            for (var s2 = 0; s2 < kid.pageItems.length; s2++) subs.push(kid.pageItems[s2]);
                            for (var s3 = 0; s3 < subs.length; s3++) {
                                subs[s3].move(kid, ElementPlacement.PLACEBEFORE);
                            }
                            try { kid.remove(); } catch (eKR) {}
                            queue = subs.concat(queue);
                            continue;
                        }

                        var w = dcRef.groupItems.add();
                        w.move(clipGroup, ElementPlacement.PLACEBEFORE);
                        kid.move(w, ElementPlacement.PLACEATEND);

                        var mCopy = mask.duplicate(w, ElementPlacement.PLACEATBEGINNING);
                        try { mCopy.filled = false; mCopy.stroked = false; } catch (eMF) {}
                        if (maskIsCompound) {
                            try { mCopy.pathItems[0].clipping = true; } catch (eMC) {}
                        } else {
                            mCopy.clipping = true;
                        }
                        w.clipped = true;

                        if (containsRaster(kid)) {
                            var kb = null;
                            try { kb = kid.visibleBounds; } catch (eKB) {}
                            var hardBounds = kb ? intersectRect(maskBounds, kb) : maskBounds;
                            rasterizeImageGroup(dcRef, w, sf, hardBounds || maskBounds);
                            rasterizedImgs++;
                        } else {
                            bakeVectorGroup(dcRef, w);
                            bakedVector++;
                        }
                    } catch (eKid) { failed++; }
                }

                try { clipGroup.remove(); } catch (eRm) {}

            } catch (eMask) {
                try {
                    rasterizeImageGroup(dcRef, clipGroup, sf, null);
                    rasterizedImgs++;
                } catch (eFB) {
                    failed++;
                    try { clipGroup.clipped = false; } catch (eRel) {}
                }
                dcRef.selection = null;
            }
        }

        try {
            // ---- 1. Master copy: bake everything ONCE ----
            masterTempFile = new File(destFolder.fsName + "/_flexi_master_build.ai");
            originalFile.copy(masterTempFile);
            masterDoc = app.open(masterTempFile);

            var masterSf = 1;
            try { if (masterDoc.scaleFactor) masterSf = masterDoc.scaleFactor; } catch (eSf) {}

            unlockAllLayers(masterDoc.layers);
            try { app.executeMenuCommand("unlockAll"); } catch (e) {}
            try { app.executeMenuCommand("showAll"); } catch (e) {}

            // Match the chosen rasterization color space. NOTE: this
            // switches the DOCUMENT color mode on the temp copy — if the
            // file was authored in the other mode, vector colors convert
            // too (that's what makes the rasterized images come out in
            // the chosen space).
            try {
                var isCMYK = (masterDoc.documentColorSpace === DocumentColorSpace.CMYK);
                if (rasterCMYK && !isCMYK) app.executeMenuCommand("doc-color-cmyk");
                if (!rasterCMYK && isCMYK) app.executeMenuCommand("doc-color-rgb");
            } catch (eCS) {}

            // Outline all text first (so masks only contain paths)
            if (OUTLINE_TEXT) {
                var tFrames = masterDoc.textFrames;
                for (var t = tFrames.length - 1; t >= 0; t--) {
                    try { tFrames[t].createOutline(); textOutlined++; } catch (eT) {}
                }
            }

            // Bake all clip masks, innermost first
            var clipGroups = [];
            for (var Lr = 0; Lr < masterDoc.layers.length; Lr++) {
                collectClipGroups(masterDoc.layers[Lr], clipGroups);
            }
            for (var cg = 0; cg < clipGroups.length; cg++) {
                bakeClipGroup(masterDoc, clipGroups[cg], masterSf);
            }

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);
            masterDoc = null;

            // ---- 2. One PDF (+.ai) per artboard from the baked master ----
            for (var i = 0; i < total; i++) {
                var abName = doc.artboards[i].name;
                var cleanArtboardName = abName.replace(/[\/\\:*?"<>|]/g, '-');
                var baseFileName = customNameInput + cleanArtboardName;

                tempAiFile = new File(destFolder.fsName + "/_flexi_temp_" + i + ".ai");
                masterTempFile.copy(tempAiFile);

                tempDoc = app.open(tempAiFile);
                app.activeDocument = tempDoc;

                var tempSf = 1;
                try { if (tempDoc.scaleFactor) tempSf = tempDoc.scaleFactor; } catch (eSf2) {}

                tempDoc.selection = null;
                tempDoc.artboards.setActiveArtboardIndex(i);

                try {
                    app.executeMenuCommand('selectallinartboard');
                    app.executeMenuCommand('hide');
                    app.executeMenuCommand('selectall');
                    app.executeMenuCommand('clear');
                    app.executeMenuCommand('showAll');
                } catch (e) {}

                var abCount = tempDoc.artboards.length;
                for (var a = abCount - 1; a >= 0; a--) {
                    if (a !== i) {
                        try { tempDoc.artboards[a].remove(); } catch (e) {}
                    }
                }

                // ---- Trim anything sticking outside the TRIM BOUNDARY ----
                // (artboard, extended by the bleed amount when bleed is on)
                try {
                    var abR = tempDoc.artboards[0].artboardRect; // [l, t, r, b]
                    var trimR = [abR[0] - bleedPts, abR[1] + bleedPts,
                                 abR[2] + bleedPts, abR[3] - bleedPts];
                    var TOL = 0.5; // pt — ignore hairline overhang
                    var offenders = [];
                    for (var Lt = 0; Lt < tempDoc.layers.length; Lt++) {
                        var layerItems = tempDoc.layers[Lt].pageItems;
                        for (var pi2 = 0; pi2 < layerItems.length; pi2++) {
                            var cand = layerItems[pi2];
                            try {
                                if (cand.typename === "PathItem" && cand.guides) continue;
                                var vb = cand.visibleBounds;
                                if (vb[0] < trimR[0] - TOL || vb[1] > trimR[1] + TOL ||
                                    vb[2] > trimR[2] + TOL || vb[3] < trimR[3] - TOL) {
                                    offenders.push(cand);
                                }
                            } catch (eVb) {}
                        }
                    }
                    for (var of2 = 0; of2 < offenders.length; of2++) {
                        try {
                            var offender = offenders[of2];
                            var trimGroup = tempDoc.groupItems.add();
                            trimGroup.move(offender, ElementPlacement.PLACEBEFORE);
                            offender.move(trimGroup, ElementPlacement.PLACEATEND);
                            var maskRect = trimGroup.pathItems.rectangle(
                                trimR[1], trimR[0], trimR[2] - trimR[0], trimR[1] - trimR[3]);
                            maskRect.stroked = false;
                            maskRect.filled = false;
                            maskRect.clipping = true;
                            trimGroup.clipped = true;

                            bakeClipGroup(tempDoc, trimGroup, tempSf);
                            trimmed++;
                        } catch (eTrim) { failed++; }
                    }
                } catch (eTrimAll) {}

                var pdfTargetFile = new File(destFolder.fsName + "/" + baseFileName + ".pdf");
                var pdfSaveOpts = new PDFSaveOptions();
                pdfSaveOpts.pDFPreset = presetName;
                pdfSaveOpts.preserveEditability = KEEP_EDITABLE; // keeps groups when the PDF is opened
                pdfSaveOpts.viewAfterSaving = !preventOpening;
                pdfSaveOpts.artboardRange = "1";

                // Bleed: exactly what the UI says — preset bleed is overridden
                try {
                    pdfSaveOpts.bleedLink = false;
                    pdfSaveOpts.bleedOffsetRect = [bleedPts, bleedPts, bleedPts, bleedPts];
                } catch (eBleed) {}

                // Highest-quality flattener (only applies when the chosen
                // preset flattens transparency, e.g. PDF/X-1a)
                try { pdfSaveOpts.flattenerPreset = "[High Resolution]"; } catch (eFlat) {}

                tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);

                if (saveAi) {
                    var aiTargetFile = new File(destFolder.fsName + "/" + baseFileName + ".ai");
                    var aiSaveOpts = new IllustratorSaveOptions();
                    aiSaveOpts.pdfCompatible = true;
                    tempDoc.saveAs(aiTargetFile, aiSaveOpts);
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

            var msg = "Done!\n" + exportedCount + " artboard(s) exported as Flexi-safe files.\n\n" +
                      bakedVector + " vector section(s) baked into geometry\n" +
                      rasterizedImgs + " image section(s) rasterized at " + rasterDpi + " DPI (" +
                      (rasterCMYK ? "CMYK" : "RGB") + ", " +
                      (rasterTransparent ? "transparent" : "white") + " background)\n" +
                      textOutlined + " text frame(s) outlined\n" +
                      trimmed + " object(s) trimmed at the trim boundary";
            if (failed > 0) {
                msg += "\n\n[!] " + failed + " mask(s) could NOT be baked and were released instead - " +
                       "CHECK THE PDFs around complex areas before sending.";
            }
            alert(msg);

        } catch (error) {
            app.userInteractionLevel = prevInteractionLevel;
            cleanupTempFiles();
            alert("Flexi-Safe Export failed:\n" + error +
                  "\n\nExported before the error: " + exportedCount + " of " + total + " artboards." +
                  "\nYour original file was not modified. Temporary files were cleaned up.");
        }
    };

    win.show();
}

flexiSafeExport();
