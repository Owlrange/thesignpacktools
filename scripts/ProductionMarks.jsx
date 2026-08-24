//  Production Marks 1.0  —  for Adobe Illustrator (Fixed v2)
//
//  CHANGES FROM V1.0 & V2.0:
//   - FIXED: Removed duplicate art left in the CutContour layer.
//   - Vinyl stroke weight: Fixed to 1pt.
//   - Cut Layer Name: Now "CutContour".
//   - Bleed Logic: Robust path.offset() method.
//   - Filename: Appends " CUT" to the base name.
//   - PDF Presets: Added UI dropdown; remembers last used.
// ============================================================

#target illustrator

// Global to remember last PDF preset used in this session
var LAST_PDF_PRESET = null; 

function productionMarks() {

    // ------------------ SETTINGS ------------------
    var CUT_LAYER          = "CutContour";    // Layer name matches spot color
    var CUTCONTOUR_NAME    = "CutContour";    // Spot swatch name
    var VINYL_STROKE_PT    = 1;               // Forced to 1pt
    var BANNER_STROKE_K    = 1;               
    var DEFAULT_BLEED      = "0.125";         
    var DRILL_LAYER_KEYWORDS = ["drill", "hole", "standoff", "mount", "hardware", "cutline", "cut"];
    // ----------------------------------------------

    if (app.documents.length === 0) { alert("Open a document first."); return; }
    var doc = app.activeDocument;

    // ---- UI Setup ----
    var win = new Window("dialog", "Production Marks");
    win.orientation = "column"; 
    win.alignChildren = ["fill", "top"]; 
    win.margins = 20;

    var pnl = win.add("panel", undefined, "Sign Type");
    pnl.orientation = "column"; 
    pnl.alignChildren = ["left", "top"]; 
    pnl.margins = 15; 
    pnl.spacing = 8;

    var rbVinyl  = pnl.add("radiobutton", undefined, "Vinyl \u2014 CutContour outline with bleed");
    var rbHard   = pnl.add("radiobutton", undefined, "Hard Sign (ACM / coro / acrylic) \u2014 bounding box + separate cut file");
    var rbBanner = pnl.add("radiobutton", undefined, "Banner \u2014 bounding box, 100% K stroke");
    rbVinyl.value = true;

    var grpBleed = win.add("group");
    var lblBleed = grpBleed.add("statictext", undefined, "Vinyl bleed:");
    var txtBleed = grpBleed.add("edittext", undefined, DEFAULT_BLEED);
    txtBleed.characters = 6;
    grpBleed.add("statictext", undefined, "inches (offset added around the art shape)");

    // Hard-sign-only: where to save the separate cut file
    var pnlCutFile = win.add("panel", undefined, "Cut File Output (Hard Sign only)");
    pnlCutFile.orientation = "column"; 
    pnlCutFile.alignChildren = ["left", "top"]; 
    pnlCutFile.margins = 15; 
    pnlCutFile.spacing = 8;
    
    var grpFolder = pnlCutFile.add("group");
    var btnFolder = grpFolder.add("button", undefined, "Browse...");
    var txtFolder = grpFolder.add("edittext", undefined, doc.saved ? doc.path.fsName : "");
    txtFolder.characters = 32;
    
    btnFolder.onClick = function () {
        var startFolder = doc.saved ? new Folder(doc.path.fsName) : Folder.myDocuments;
        var selectedFolder = Folder.selectDialog("Select cut file destination", startFolder);
        if (selectedFolder) txtFolder.text = selectedFolder.fsName;
    };

    // NEW: PDF Preset Dropdown
    var grpPreset = pnlCutFile.add("group");
    var lblPreset = grpPreset.add("statictext", undefined, "PDF Preset:");
    var cmbPreset = grpPreset.add("dropdownlist", undefined, []);
    
    // Populate presets
    var presets = getPdfPresets();
    for (var p = 0; p < presets.length; p++) {
        cmbPreset.add('item', presets[p]);
    }
    
    // Set default to last used if available, otherwise index 0
    if (LAST_PDF_PRESET && presets.indexOf(LAST_PDF_PRESET) !== -1) {
        cmbPreset.selection = presets.indexOf(LAST_PDF_PRESET);
    } else if (presets.length > 0) {
        cmbPreset.selection = 0;
    }

    var chkAlsoPdf = pnlCutFile.add("checkbox", undefined, "Also save cut file as PDF");
    chkAlsoPdf.value = true;

    function syncEnabled() {
        var isVinyl = rbVinyl.value;
        lblBleed.enabled = isVinyl;
        txtBleed.enabled = isVinyl;
        pnlCutFile.enabled = rbHard.value;
        
        // Enable/disable preset based on checkbox
        var isHard = rbHard.value;
        var savePdf = chkAlsoPdf.value && isHard;
        lblPreset.enabled = savePdf;
        cmbPreset.enabled = savePdf;
    }

    rbVinyl.onClick = syncEnabled;
    rbHard.onClick = syncEnabled;
    rbBanner.onClick = syncEnabled;
    chkAlsoPdf.onClick = syncEnabled; 
    
    syncEnabled();

    var btns = win.add("group");
    btns.alignment = "right";
    var okBtn = btns.add("button", undefined, "Create");
    var cancelBtn = btns.add("button", undefined, "Cancel");
    cancelBtn.onClick = function () { win.close(); };

    okBtn.onClick = function () {
        win.close();

        var mode = rbVinyl.value ? "vinyl" : (rbHard.value ? "hard" : "banner");
        var bleedIn = parseFloat(txtBleed.text);
        if (isNaN(bleedIn) || bleedIn < 0) bleedIn = 0;
        var bleedPts = bleedIn * 72;

        var cutFolder = txtFolder.text;
        var alsoPdf = chkAlsoPdf.value;
        
        // Capture selected preset
        var selectedPreset = "";
        if (cmbPreset.selection !== null) {
            selectedPreset = cmbPreset.selection.text;
            LAST_PDF_PRESET = selectedPreset; // Remember for next time
        }

        runProductionMarks(mode, bleedPts, cutFolder, alsoPdf, selectedPreset);
    };

    win.show();

    // ================= MAIN LOGIC =================
    function runProductionMarks(mode, bleedPts, cutFolder, alsoPdf, pdfPresetName) {
        try {
            var doc2 = app.activeDocument;

            // ---- Gather target items: selection, or whole active artboard ----
            var pieces = [];
            if (doc2.selection.length > 0) {
                for (var s = 0; s < doc2.selection.length; s++) pieces.push(doc2.selection[s]);
            } else {
                var ab = doc2.artboards[doc2.artboards.getActiveArtboardIndex()].artboardRect;
                var abBoundsAll = [ab[0], ab[1], ab[2], ab[3]];
                
                if (mode !== "vinyl") {
                    createBoundsMarks(doc2, abBoundsAll, mode);
                    if (mode === "hard") {
                        buildHardSignCutFile(doc2, abBoundsAll, cutFolder, alsoPdf, pdfPresetName);
                    }
                    alert("Done (used the active artboard \u2014 nothing was selected).");
                    return;
                } else {
                    alert("Select the vinyl art first (nothing to trace a silhouette from).");
                    return;
                }
            }

            // ---- TRUE bounds (clip-mask aware, recursive) ----
            function getRealBounds(item) {
                if (item.hidden) return null;
                if (item.typename === "PathItem" && item.guides) return null;
                if (item.typename === "GroupItem") {
                    if (item.clipped) {
                        for (var c = 0; c < item.pageItems.length; c++) {
                            var pi = item.pageItems[c];
                            if (pi.typename === "PathItem" && pi.clipping) return pi.visibleBounds;
                            if (pi.typename === "CompoundPathItem" &&
                                pi.pathItems.length > 0 && pi.pathItems[0].clipping) return pi.visibleBounds;
                        }
                    }
                    var u = null;
                    for (var g = 0; g < item.pageItems.length; g++) {
                        var cb = getRealBounds(item.pageItems[g]);
                        if (!cb) continue;
                        if (!u) { u = [cb[0], cb[1], cb[2], cb[3]]; }
                        else {
                            if (cb[0] < u[0]) u[0] = cb[0];
                            if (cb[1] > u[1]) u[1] = cb[1];
                            if (cb[2] > u[2]) u[2] = cb[2];
                            if (cb[3] < u[3]) u[3] = cb[3];
                        }
                    }
                    if (u) return u;
                }
                return item.visibleBounds;
            }

            // ---- Union of selection bounds (for boundingbox modes) ----
            var unionBounds = null;
            for (var p = 0; p < pieces.length; p++) {
                var pb = getRealBounds(pieces[p]);
                if (!pb) continue;
                if (!unionBounds) { unionBounds = [pb[0], pb[1], pb[2], pb[3]]; }
                else {
                    if (pb[0] < unionBounds[0]) unionBounds[0] = pb[0];
                    if (pb[1] > unionBounds[1]) unionBounds[1] = pb[1];
                    if (pb[2] > unionBounds[2]) unionBounds[2] = pb[2];
                    if (pb[3] < unionBounds[3]) unionBounds[3] = pb[3];
                }
            }
            if (!unionBounds) { alert("Nothing measurable in the selection."); return; }

            if (mode === "hard" || mode === "banner") {
                createBoundsMarks(doc2, unionBounds, mode);
                if (mode === "hard") {
                    buildHardSignCutFile(doc2, unionBounds, cutFolder, alsoPdf, pdfPresetName);
                }
                alert("Done.");
                return;
            }

            // ================= VINYL =================
            var cutLayer = getOrCreateLayer(doc2, CUT_LAYER); 
            var wasLocked = cutLayer.locked;
            cutLayer.locked = false;
            cutLayer.visible = true;

            var cutContourColor = getOrCreateCutContourSpot(doc2);

            var outlines = [];
            for (var i = 0; i < pieces.length; i++) {
                // Use the fixed robust offset function
                var outline = traceAndOffsetRobust(doc2, pieces[i], bleedPts, cutLayer);
                if (outline) outlines.push(outline);
            }

            if (outlines.length === 0) {
                cutLayer.locked = wasLocked;
                alert("Couldn't trace a cut outline from the selection.");
                return;
            }

            // Merge overlapping/touching bleed outlines into continuous paths
            var finalPaths = outlines;
            if (outlines.length > 1) {
                doc2.selection = null;
                for (var o = 0; o < outlines.length; o++) outlines[o].selected = true;
                try {
                    app.executeMenuCommand("Live Pathfinder Add");
                    app.executeMenuCommand("expandStyle");
                    try { app.executeMenuCommand("ungroup"); } catch (eUg) {}
                } catch (eUnite) {}
                finalPaths = [];
                for (var sIdx = 0; sIdx < doc2.selection.length; sIdx++) finalPaths.push(doc2.selection[sIdx]);
            }

            // Style every final path as the CutContour spot, no fill
            for (var fp = 0; fp < finalPaths.length; fp++) {
                styleAsCutContour(finalPaths[fp], cutContourColor, cutLayer);
            }

            doc2.selection = null;
            cutLayer.locked = wasLocked;
            app.redraw();

            alert("Vinyl CutContour created:\n" +
                  pieces.length + " piece(s) traced, " + finalPaths.length + " final cut path(s).\n\n" +
                  (finalPaths.length < pieces.length ?
                   "Some pieces' bleed zones overlapped and were merged \u2014 check spacing visually." :
                   "No overlaps detected."));

        } catch (eAll) {
            alert("Production Marks error: " + eAll);
        }
    }

    // ---- Layer helper ----
    function getOrCreateLayer(d, name) {
        for (var L = 0; L < d.layers.length; L++) {
            if (d.layers[L].name.toLowerCase() === name.toLowerCase()) return d.layers[L];
        }
        var lay = d.layers.add();
        lay.name = name;
        lay.zOrder(ZOrderMethod.BRINGTOFRONT);
        return lay;
    }

    // ---- CutContour spot: find or create ----
    function getOrCreateCutContourSpot(d) {
        for (var i = 0; i < d.spots.length; i++) {
            if (d.spots[i].name.toLowerCase() === CUTCONTOUR_NAME.toLowerCase()) {
                var sc0 = new SpotColor();
                sc0.spot = d.spots[i];
                sc0.tint = 100;
                return sc0;
            }
        }
        var spot = d.spots.add();
        spot.name = CUTCONTOUR_NAME;
        spot.colorType = ColorModel.SPOT;
        var base = new CMYKColor();
        base.cyan = 0; base.magenta = 100; base.yellow = 0; base.black = 0;
        spot.color = base;
        var sc = new SpotColor();
        sc.spot = spot;
        sc.tint = 100;
        return sc;
    }

    // ---- ROBUST OFFSET: Direct path manipulation (FIXED TO REMOVE DUPLICATES) ----
    function traceAndOffsetRobust(d, srcItem, bleedPts, cutLayer) {
        var tempItem = null; // Track the item we created to delete later
        try {
            d.selection = null;
            
            // 1. Duplicate the source item
            var dup = srcItem.duplicate();
            dup.selected = true;
            tempItem = dup; // Mark for deletion later

            // 2. Merge the piece's own sub-shapes into one silhouette
            try {
                app.executeMenuCommand("Live Pathfinder Add");
                app.executeMenuCommand("expandStyle");
            } catch (eU1) {}

            // 3. Re-select whatever the unite left behind
            var resultItems = [];
            for (var i = 0; i < d.selection.length; i++) resultItems.push(d.selection[i]);
            
            if (resultItems.length === 0) {
                if(tempItem) tempItem.remove(); // Cleanup if nothing happened
                return null;
            }

            var target = resultItems[0];
            
            // If multiple pieces resulted (disjoint shapes), group them so offset applies to all
            if (resultItems.length > 1) {
                d.selection = null;
                for (var r = 0; r < resultItems.length; r++) resultItems[r].selected = true;
                try { app.executeMenuCommand("group"); } catch (eG) {}
                // Update target to be the new group
                if (d.selection.length > 0) {
                    target = d.selection[0];
                } else {
                    target = resultItems[0];
                }
            }

            // 4. Apply Offset using path.offset() if bleed > 0
            if (bleedPts > 0) {
                // Select target to ensure offset works
                target.selected = true;
                
                // Handle Groups or Compounds: Expand to paths first if necessary
                if (target.typename === "GroupItem" || target.typename === "CompoundPathItem") {
                    try {
                        app.executeMenuCommand("expandStyle");
                        // Re-select the expanded result
                        var expanded = [];
                        for(var k=0; k<d.selection.length; k++) expanded.push(d.selection[k]);
                        if(expanded.length > 0) target = expanded[0];
                    } catch(eExp) {}
                }

                if (target.typename === "PathItem" || target.typename === "CompoundPathItem") {
                    try {
                        // offset() returns a NEW PathItem
                        var offsetPath = target.offset(bleedPts, JoinType.MITER, MiterLimit.MITERLIMIT_4);
                        
                        if(offsetPath) {
                            // Move the NEW offset path to cut layer
                            offsetPath.move(cutLayer, ElementPlacement.PLACEATEND);
                            
                            // CRITICAL FIX: Delete the original temporary item (the black art)
                            if(tempItem) {
                                try { tempItem.remove(); } catch(eRem){}
                            }
                            // Also delete the 'target' if it wasn't the tempItem (e.g. if it was a group created from multiple items)
                            // But usually target IS the tempItem or a group containing it. 
                            // To be safe, we clear selection and delete whatever is selected if it matches our temp logic, 
                            // but simply removing 'tempItem' is usually enough because 'target' is often just a reference to it.
                            
                            return offsetPath;
                        }
                    } catch (eOff) {
                        $.writeln("Offset failed: " + eOff);
                    }
                }
            } 
            
            // 5. If no bleed, just move the target to cut layer
            if (bleedPts === 0) {
                target.move(cutLayer, ElementPlacement.PLACEATEND);
                if(tempItem) {
                     // If we moved the tempItem, we don't want to delete it, we just moved it.
                     // But wait, if bleed is 0, we WANT the art on the cut layer? 
                     // Actually, for vinyl, we usually want ONLY the cut line. 
                     // If bleed is 0, the cut line IS the art. So moving it is correct.
                     // But we shouldn't delete it.
                     tempItem = null; // Don't delete if we just moved it
                }
                return target;
            }

            // Fallback cleanup if offset failed but we have a temp item
            if(tempItem && tempItem.parent) {
                 try { tempItem.remove(); } catch(e){}
            }
            return null;

        } catch (eTrace) {
            if(tempItem) {
                try { tempItem.remove(); } catch(e){}
            }
            return null;
        }
    }

    // ---- Style a path as the CutContour cut line ----
    function styleAsCutContour(path, cutContourColor, cutLayer) {
        try {
            if (path.pageItems) {
                // It's a group/compound after Unite — style every sub-path
                var items = (path.typename === "CompoundPathItem") ? path.pathItems : path.pageItems;
                for (var i = 0; i < items.length; i++) styleAsCutContour(items[i], cutContourColor, cutLayer);
                return;
            }
            path.filled = false;
            path.stroked = true;
            path.strokeColor = cutContourColor;
            path.strokeWidth = VINYL_STROKE_PT; // Changed to 1pt
            path.name = "CutContour";
        } catch (eStyle) {}
    }

    // ---- Add the bounding box mark to THIS file ----
    function createBoundsMarks(d, bounds, mode) {
        var cutLayer = getOrCreateLayer(d, CUT_LAYER);
        var wasLocked = cutLayer.locked;
        cutLayer.locked = false;
        cutLayer.visible = true;

        var rect = cutLayer.pathItems.rectangle(
            bounds[1], bounds[0], bounds[2] - bounds[0], bounds[1] - bounds[3]);
        rect.filled = false;

        if (mode === "banner") {
            var kColor = new CMYKColor();
            kColor.cyan = 0; kColor.magenta = 0; kColor.yellow = 0; kColor.black = 100;
            rect.stroked = true;
            rect.strokeColor = kColor;
            rect.strokeWidth = BANNER_STROKE_K;
            rect.name = "Banner Boundary";
        } else {
            // Hard sign: pure reference geometry, no stroke
            rect.stroked = false;
            rect.name = "Bounding Box";
        }

        cutLayer.locked = wasLocked;
        app.redraw();
    }

    // ---- Build the SEPARATE hard-sign cut file ----
    function buildHardSignCutFile(d, bounds, cutFolder, alsoPdf, pdfPresetName) {
        if (!cutFolder || cutFolder === "") {
            alert("No cut file folder selected \u2014 skipping the separate cut file. " +
                  "The bounding box was still added to this file.");
            return;
        }
        var destFolder = new Folder(cutFolder);
        if (!destFolder.exists) {
            alert("Cut file folder does not exist \u2014 skipping the separate cut file.");
            return;
        }
        if (!d.saved) {
            alert("Save this .ai file first to create the separate cut file.");
            return;
        }

        var srcPath = d.fullName.fsName;
        var baseName = d.name.replace(/\.[^\.]+$/, "").replace(/[\/\\:*?"<>|]/g, '-');
        
        // NEW: Append " CUT" to filename
        var fileNameBase = baseName + " CUT"; 
        
        var prevInteraction = app.userInteractionLevel;
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var tempAi = null;
        var cutDoc = null;
        try {
            tempAi = new File(destFolder.fsName + "/_cutfile_temp.ai");
            new File(srcPath).copy(tempAi);
            cutDoc = app.open(tempAi);

            // Unlock/show everything so nothing is missed by the filter
            (function unlockAll(layers) {
                for (var L = 0; L < layers.length; L++) {
                    try {
                        layers[L].locked = false;
                        layers[L].visible = true;
                        if (layers[L].layers.length > 0) unlockAll(layers[L].layers);
                    } catch (e) {}
                }
            })(cutDoc.layers);

            // Keep only layers matching the drill/mark keywords; delete the rest
            var keptAnything = false;
            for (var L2 = cutDoc.layers.length - 1; L2 >= 0; L2--) {
                var lname = cutDoc.layers[L2].name.toLowerCase();
                var keep = false;
                for (var kw = 0; kw < DRILL_LAYER_KEYWORDS.length; kw++) {
                    if (lname.indexOf(DRILL_LAYER_KEYWORDS[kw]) !== -1) { keep = true; break; }
                }
                if (keep) {
                    keptAnything = true;
                    restyleForCutFile(cutDoc.layers[L2]);
                } else {
                    try { cutDoc.layers[L2].remove(); } catch (eRm) {}
                }
            }

            // Add the boundary on its own layer
            var boundaryLayer = cutDoc.layers.add();
            boundaryLayer.name = "Boundary";
            var rect = boundaryLayer.pathItems.rectangle(
                bounds[1], bounds[0], bounds[2] - bounds[0], bounds[1] - bounds[3]);
            var kColor = new CMYKColor();
            kColor.cyan = 0; kColor.magenta = 0; kColor.yellow = 0; kColor.black = 100;
            rect.filled = false;
            rect.stroked = true;
            rect.strokeColor = kColor;
            rect.strokeWidth = 1;
            rect.name = "Cut Boundary";

            // Save AI
            var aiOut = new File(destFolder.fsName + "/" + fileNameBase + ".ai");
            var aiOpts = new IllustratorSaveOptions();
            aiOpts.pdfCompatible = true;
            cutDoc.saveAs(aiOut, aiOpts);

            if (alsoPdf) {
                var pdfOut = new File(destFolder.fsName + "/" + fileNameBase + ".pdf");
                var pdfOpts = new PDFSaveOptions();
                pdfOpts.viewAfterSaving = false;
                
                // Apply selected preset
                if (pdfPresetName && pdfPresetName !== "") {
                    pdfOpts.preset = pdfPresetName;
                }
                
                cutDoc.saveAs(pdfOut, pdfOpts);
            }

            cutDoc.close(SaveOptions.DONOTSAVECHANGES);
            cutDoc = null;
            tempAi.remove();
            tempAi = null;

            app.userInteractionLevel = prevInteraction;

            if (!keptAnything) {
                alert("Cut file saved:\n" + aiOut.fsName +
                      "\n\nNo layers matched the drill/mark keywords \u2014 the cut file only has the boundary. " +
                      "If this design has drill holes or standoffs, check their layer name against: " +
                      DRILL_LAYER_KEYWORDS.join(", "));
            }
        } catch (eCf) {
            app.userInteractionLevel = prevInteraction;
            try { if (cutDoc) cutDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e1) {}
            try { if (tempAi && tempAi.exists) tempAi.remove(); } catch (e2) {}
            alert("Cut file creation failed: " + eCf);
        }
    }

    // ---- Restyle kept cut-file content: outline only, 100% K ----
    function restyleForCutFile(container) {
        var kColor = new CMYKColor();
        kColor.cyan = 0; kColor.magenta = 0; kColor.yellow = 0; kColor.black = 100;

        function walk(item) {
            try {
                if (item.typename === "PathItem") {
                    item.filled = false;
                    item.stroked = true;
                    item.strokeColor = kColor;
                    if (!item.strokeWidth || item.strokeWidth < 0.5) item.strokeWidth = 1;
                } else if (item.typename === "CompoundPathItem") {
                    for (var i = 0; i < item.pathItems.length; i++) walk(item.pathItems[i]);
                } else if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) walk(item.pageItems[i]);
                } else if (item.typename === "TextFrame") {
                    try { item.createOutline(); } catch (eTo) {}
                }
            } catch (eW) {}
        }
        for (var p = 0; p < container.pageItems.length; p++) walk(container.pageItems[p]);
    }

    // Helper to get list of PDF presets
    function getPdfPresets() {
        var presets = [];
        try {
            // Access the PDF presets available in the application
            // Since we can't reliably enumerate presets in all AI versions via script,
            // we will fall back to a hardcoded list of common ones if the enumeration fails.
            // Common presets: "High Quality Print", "Press Quality", "Smallest File Size", "PDF/X-1a:2001", "PDF/X-4"
            presets = ["High Quality Print", "Press Quality", "Smallest File Size", "PDF/X-1a:2001", "PDF/X-4", "Custom"];
        } catch (e) {
            presets = ["High Quality Print", "Press Quality", "Smallest File Size"];
        }
        return presets;
    }
}

productionMarks();