var RESULT = "";

#target illustrator

// ============================================================
//  Export All PDFs 2.1
//  Combined mode rebuilt from scratch (normal mode is untouched):
//   Background: 2.0's combined mode isolated each selected artboard into
//   its own temp copy (same technique as normal mode), then copied each
//   one's content into a shared "builder" document, artboard by artboard,
//   to produce one merged PDF/AI/EPS. In testing, content from one
//   artboard kept turning up on another artboard's page - sometimes a
//   neighbor's stray shape, once a completely unrelated shape from
//   elsewhere in the document. Four fixes aimed at that copy/merge
//   mechanism were tried and each failed to resolve it (matching other
//   artboards' removal, spacing merged artboards apart, a per-layer clip
//   mask, replacing the merge doc's Select-All-based clear with a direct
//   per-item delete) - each ruled out one specific mechanism without
//   fixing the actual symptom, while confirming along the way that each
//   artboard's OWN isolated copy was clean on its own. That pointed at
//   the merge/copy-between-documents step itself as the real problem,
//   not any particular detail of it - so instead of patching it further,
//   combined mode no longer builds a shared document or copies content
//   between documents at all:
//   - PDF: saved directly from a prepared (unmodified) copy of the whole
//     document, using Illustrator's own artboardRange with a comma-
//     separated list of the selected artboards (e.g. "1,4,6"). Each page
//     only ever shows what's actually inside that artboard's own box -
//     the same native mechanism normal mode's single-artboard PDF export
//     already relies on, just producing several pages in one call. No
//     isolation step at all for this format.
//   - AI / EPS: these two formats have no "just these artboards" option
//     (an .ai always holds the whole document; an .eps is always one
//     flattened page of whatever the document contains), so content
//     still needs to be stripped down for them specifically. Done once,
//     on a single prepared copy: every item that doesn't overlap ANY
//     selected artboard (expanded by the chosen bleed amount) is deleted
//     directly, then every non-selected artboard is removed. No
//     selection commands are used for the deletion - each item's own
//     true bounds are checked directly against every target artboard, so
//     there's nothing left for a menu command's own behavior to get
//     wrong. Artboard names and positions are untouched since nothing is
//     rebuilt or copied - they're the originals.
//   Net effect: no per-artboard temp files, no shared builder document,
//   no cross-document copy/paste, no "Paste Remembers Layers" surface
//   area at all for combined mode.
//
//  Changes from 1.9 (2.0):
//   NEW
//   - Bleed is now three radio buttons: No Bleed (default),
//     0.125" or Custom (with an inches field). The choice drives the
//     edge-overhang warning AND the optional PDF bleed below.
//   - "Add bleed to PDF only" checkbox (off by default, greyed out
//     when No Bleed is selected). Sets the PDF export's bleed offset
//     to the chosen amount. It does NOT create artwork in the bleed
//     area and does not touch the .ai / .eps files. The PDF page
//     becomes 2x bleed larger in each direction (TrimBox = artboard).
//   - Artboard selection: All artboards (default) or Selected
//     artboards with a range field such as "1-3, 5" (numbers follow
//     the order of the Artboards panel).
//   - Cancel button on the progress window (stops between artboards; now
//     checks more often during the slower combined-mode steps so a click
//     is noticed sooner instead of appearing to do nothing).
//   - "Preserve Illustrator editing capabilities" checkbox for the
//     PDF (on by default = same behavior as before). Turning it off
//     gives smaller, faster PDFs.
//   - "Open output folder when done" checkbox (off by default).
//   - "Remember settings" checkbox (off by default): remembers the
//     file-type checkboxes, prevent-opening, artboard-name toggle,
//     folder organization, bleed choice, PDF-bleed and open-folder
//     toggles. "Remember output folder" (off by default) does the
//     same for the folder. The PDF preset is always remembered.
//     None of this touches Illustrator's own Save As preferences.
//   - Warning line at the top about existing files being overwritten.
//   - After each artboard is isolated, a sanity check flags artboards
//     where art was left entirely outside the artboard or where the
//     artboard ended up empty (isolation may have failed).
//   - Artboard selection is now a scrollable, multi-select list (with
//     Select All / Select None) instead of typing a range, and the
//     dialog is laid out in two columns to keep the window shorter.
//   - "Export selected artboards as one combined file" checkbox (off
//     by default). PDF becomes one multi-page file, .ai becomes one
//     multi-artboard file; .eps is automatically flattened to a
//     single page by Illustrator itself, since EPS can never hold
//     more than one page regardless of what this script does. Combined
//     files are named after the current document, ignoring the
//     Custom File Name field, artboard-name toggle and per-artboard
//     folders. Built by isolating each artboard exactly like normal
//     mode, then copying it into a shared document, artboard by
//     artboard, before the final save. Each artboard's content is
//     copied across ONE TOP-LEVEL LAYER AT A TIME (hide every other
//     layer, copy what's left, paste onto the same-named layer in
//     the shared document, found by name - not "remembered"), rather
//     than relying on Illustrator's own "Paste Remembers Layers"
//     feature, which in testing sometimes dropped entire layers'
//     worth of content instead of routing it correctly. Any layer
//     that ends up empty across every merged artboard is removed
//     before the final save. Each merged artboard also keeps its
//     original name instead of Illustrator's generic default.
//   - Combined files only: each artboard is additionally hard-clipped
//     to its own exact bounds (plus a bleed amount you choose) right
//     before its content is copied into the shared document. This is
//     a safety net for Illustrator's 'selectallinartboard' command,
//     which can occasionally let a stray object from elsewhere survive
//     even when artboards don't overlap - the clip guarantees only
//     truly-inside geometry can end up on the wrong page, regardless
//     of why the selection let something through. This bleed choice
//     has NO default and is NOT remembered between sessions - the
//     "Export Files" button refuses to run a combined export until one
//     is picked, so a file with real bleed art built in can never get
//     that art silently clipped off by an unset/forgotten value. A
//     clipped layer is pasted as a clip group rather than loose items,
//     which is a small structural change if the merged .ai is opened
//     for further editing later.
//   BUG FIXES
//   - Temp/master documents are now tracked by reference, so they are
//     always closed and their temp files deleted after an error
//     (previously the name check failed once saveAs renamed the doc).
//   - The original document is made active again after an error.
//   - Artboard names ending in a space or period are trimmed in file
//     and folder names (Windows strips them silently, which could
//     cause collisions the duplicate-name check missed).
//   PERFORMANCE
//   - The edge-overhang check walks each layer's top-level items
//     instead of checking the parent of every item in the document.
//   REMOVED
//   - The documentBleedOffset auto-detect block (dead code).
//
//  Older history (1.9 and earlier) lives in the 1.9 file. Key
//  lessons carried over, with the reasons kept next to the code:
//   - PDF compatibility must be ACROBAT7 or higher (Large Canvas).
//   - EPS compatibility must be left unset (Large Canvas).
//   - The edge check uses a small tolerance for float noise.
//
//  MAINTENANCE NOTE: this script relies on Illustrator's own
//  'selectallinartboard' menu command to isolate each artboard's
//  content. Adobe has changed this command's behavior between
//  versions before. After ANY Illustrator update, spot-check one
//  exported PDF against the source file before trusting a batch.
// ============================================================

function main() {
    if (app.documents.length === 0) {
        RESULT = "ERROR: Please open a document first.";
        return;
    }

    var doc = app.activeDocument;
    var originalFilePath = "";

    try {
        if (!doc.saved) doc.save();
        originalFilePath = doc.fullName.fsName;
    } catch (e) {
        RESULT = "ERROR: Please save your original .ai file first.";
        return;
    }

    var docName = doc.name.replace(/\.[^\.]+$/, '');
    var cleanDocName = docName.replace(/[\/\\:*?"<>|]/g, '-');
    var pdfPresets = app.PDFPresetsList;

    // ---------- small helpers ----------
    var PREF_PREFIX = "TheSignPack_";
    function readPref(key) {
        try { return app.preferences.getStringPreference(PREF_PREFIX + key) || ""; } catch (e) { return ""; }
    }
    function writePref(key, val) {
        try { app.preferences.setStringPreference(PREF_PREFIX + key, String(val)); } catch (e) {}
    }
    function sanitizeName(s) {
        return s.replace(/[\/\\:*?"<>|]/g, '-');
    }
    // Windows silently strips trailing spaces/periods from names, so trim
    // them up front to keep the collision checks honest.
    function cleanAbName(name, idx) {
        var n = sanitizeName(name).replace(/[\s.]+$/, '');
        return (n === "") ? ("Artboard " + (idx + 1)) : n;
    }
    // ---------- main window ----------
    var win = new Window("dialog", "Export All PDFs 2.1");
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.margins = 20;

    var txtOverwrite = win.add("statictext", undefined, "Existing files with the same name will be overwritten.");
    txtOverwrite.alignment = ["center", "top"];

    var pnlSettings = win.add("panel", undefined, "Export Settings");
    pnlSettings.orientation = "row"; pnlSettings.alignChildren = ["fill", "top"]; pnlSettings.margins = 15; pnlSettings.spacing = 20;

    var colLeft = pnlSettings.add("group");
    colLeft.orientation = "column"; colLeft.alignChildren = ["fill", "top"]; colLeft.spacing = 10;

    var colRight = pnlSettings.add("group");
    colRight.orientation = "column"; colRight.alignChildren = ["fill", "top"]; colRight.spacing = 10;

    // ----- left column -----
    colLeft.add("statictext", undefined, "1. Select PDF Preset:");
    var dropdownPresets = colLeft.add("dropdownlist", undefined, pdfPresets);

    var savedPreset = readPref("LastPDFPreset");
    var presetIndex = 0;
    for (var p = 0; p < pdfPresets.length; p++) {
        if (pdfPresets[p] === savedPreset) {
            presetIndex = p;
            break;
        }
    }
    dropdownPresets.selection = presetIndex;
    dropdownPresets.preferredSize.width = 270;

    colLeft.add("statictext", undefined, "2. Output Folder:");
    var grpFolder = colLeft.add("group");
    var btnFolder = grpFolder.add("button", undefined, "Browse...");
    var txtFolder = grpFolder.add("edittext", undefined, doc.path.fsName); txtFolder.characters = 26;
    var chkRememberFolder = colLeft.add("checkbox", undefined, "Remember output folder");
    chkRememberFolder.value = false;

    btnFolder.onClick = function () {
        var startFolder = new Folder(txtFolder.text !== "" ? txtFolder.text : doc.path.fsName);
        if (!startFolder.exists) startFolder = new Folder(doc.path.fsName);
        var selectedFolder = Folder.selectDialog("Select destination folder", startFolder);
        if (selectedFolder) txtFolder.text = selectedFolder.fsName;
    };

    colLeft.add("statictext", undefined, "3. Custom File Name:");
    var txtCustomName = colLeft.add("edittext", undefined, cleanDocName + " ");
    txtCustomName.characters = 30;

    var firstAbName = cleanAbName(doc.artboards[0].name, 0);
    var txtPreview = colLeft.add("statictext", undefined, "Preview: " + txtCustomName.text + firstAbName + ".pdf");
    txtPreview.preferredSize.width = 270; // Forces the preview box to be wide enough

    txtCustomName.onChanging = function () { updatePreview(); };

    function updatePreview() {
        if (typeof chkCombined !== "undefined" && chkCombined.value) {
            txtPreview.text = "Preview: " + cleanDocName + ".pdf (combined)";
            return;
        }
        var currentText = sanitizeName(txtCustomName.text);
        if (currentText === "") currentText = cleanDocName + " ";
        var suffix = (typeof chkIncludeArtboardName !== "undefined" && !chkIncludeArtboardName.value)
            ? "" : firstAbName;
        txtPreview.text = "Preview: " + currentText + suffix + ".pdf";
    }

    colLeft.add("statictext", undefined, "4. Additional Settings:");
    var chkSaveAi = colLeft.add("checkbox", undefined, "Also save as .ai file");
    chkSaveAi.value = true;

    var chkSaveEps = colLeft.add("checkbox", undefined, "Also save as .eps file");
    chkSaveEps.value = true;

    var chkDisableView = colLeft.add("checkbox", undefined, "Prevent PDFs from opening automatically");
    chkDisableView.value = false;

    var chkIncludeArtboardName = colLeft.add("checkbox", undefined, "Include artboard name in file name");
    chkIncludeArtboardName.value = false;
    chkIncludeArtboardName.onClick = function () { updatePreview(); };

    var chkPreserveEdit = colLeft.add("checkbox", undefined, "PDF: preserve Illustrator editing capabilities");
    chkPreserveEdit.value = true;

    var chkAiPdfCompatible = colLeft.add("checkbox", undefined, "AI: create PDF-compatible file");
    chkAiPdfCompatible.value = true;

    var chkOpenFolder = colLeft.add("checkbox", undefined, "Open output folder when done");
    chkOpenFolder.value = false;

    // ----- right column -----
    colRight.add("statictext", undefined, "5. Folder Organization:");
    var FOLDER_MODE_OPTIONS = ["No subfolders", "One folder per artboard", "One folder per file type"];
    var dropdownFolderMode = colRight.add("dropdownlist", undefined, FOLDER_MODE_OPTIONS);
    dropdownFolderMode.selection = 0; // default: no subfolders
    dropdownFolderMode.preferredSize.width = 260;

    colRight.add("statictext", undefined, "6. Bleed \u2014 art inside this won't trigger the edge warning:");
    var grpBleed = colRight.add("group");
    grpBleed.orientation = "row";
    var rbBleedNone = grpBleed.add("radiobutton", undefined, "No Bleed");
    var rbBleed125 = grpBleed.add("radiobutton", undefined, "0.125\"");
    var rbBleedCustom = grpBleed.add("radiobutton", undefined, "Custom");
    var txtBleed = grpBleed.add("edittext", undefined, "0.125");
    txtBleed.characters = 6;
    grpBleed.add("statictext", undefined, "in");
    rbBleedNone.value = true;

    function refreshBleedUI() {
        txtBleed.enabled = rbBleedCustom.value;
    }
    rbBleedNone.onClick = refreshBleedUI;
    rbBleed125.onClick = refreshBleedUI;
    rbBleedCustom.onClick = refreshBleedUI;

    // Independent of the warning tolerance above - its own amount, and it
    // can be turned on regardless of what the warning is set to.
    var grpPdfBleed = colRight.add("group");
    grpPdfBleed.orientation = "row";
    var chkPdfBleed = grpPdfBleed.add("checkbox", undefined, "Add bleed to PDF only");
    chkPdfBleed.value = false;
    var txtPdfBleed = grpPdfBleed.add("edittext", undefined, "0.125");
    txtPdfBleed.characters = 6;
    grpPdfBleed.add("statictext", undefined, "in");

    function refreshPdfBleedUI() {
        txtPdfBleed.enabled = chkPdfBleed.value;
    }
    chkPdfBleed.onClick = refreshPdfBleedUI;

    var abTotalCount = doc.artboards.length;
    colRight.add("statictext", undefined, "7. Artboards (this document has " + abTotalCount + "):");
    var grpAbMode = colRight.add("group");
    grpAbMode.orientation = "row";
    var rbAbAll = grpAbMode.add("radiobutton", undefined, "All artboards");
    var rbAbSel = grpAbMode.add("radiobutton", undefined, "Selected");
    rbAbAll.value = true;

    var grpAbButtons = colRight.add("group");
    grpAbButtons.orientation = "row";
    var btnAbSelectAll = grpAbButtons.add("button", undefined, "Select All");
    var btnAbSelectNone = grpAbButtons.add("button", undefined, "Select None");

    var abListItems = [];
    for (var abi = 0; abi < abTotalCount; abi++) {
        abListItems.push((abi + 1) + " - " + cleanAbName(doc.artboards[abi].name, abi));
    }
    var listAb = colRight.add("listbox", undefined, abListItems, { multiselect: true });
    listAb.preferredSize = [260, 150]; // fixed height, scrolls internally when it overflows

    var txtAbCount = colRight.add("statictext", undefined, "0 of " + abTotalCount + " selected");

    function updateAbCount() {
        var sel = listAb.selection;
        var n = sel ? (sel instanceof Array ? sel.length : 1) : 0;
        txtAbCount.text = n + " of " + abTotalCount + " selected";
    }
    function refreshArtboardUI() {
        var enable = rbAbSel.value;
        listAb.enabled = enable;
        btnAbSelectAll.enabled = enable;
        btnAbSelectNone.enabled = enable;
        updateAbCount();
    }
    rbAbAll.onClick = refreshArtboardUI;
    rbAbSel.onClick = refreshArtboardUI;
    listAb.onChange = updateAbCount;
    btnAbSelectAll.onClick = function () {
        for (var sa = 0; sa < listAb.items.length; sa++) listAb.items[sa].selected = true;
        updateAbCount();
    };
    btnAbSelectNone.onClick = function () {
        for (var sn = 0; sn < listAb.items.length; sn++) listAb.items[sn].selected = false;
        updateAbCount();
    };

    var chkCombined = colRight.add("checkbox", undefined, "Export selected artboards as one combined file");
    chkCombined.value = false;

    function refreshCombinedUI() {
        var combined = chkCombined.value;
        txtCustomName.enabled = !combined;
        chkIncludeArtboardName.enabled = !combined;
        updatePreview();
    }
    chkCombined.onClick = refreshCombinedUI;

    // ---------- load remembered settings ----------
    if (readPref("RememberSettings") === "1") {
        var rv;
        rv = readPref("SaveAi");       if (rv !== "") chkSaveAi.value = (rv === "1");
        rv = readPref("SaveEps");      if (rv !== "") chkSaveEps.value = (rv === "1");
        rv = readPref("NoOpen");       if (rv !== "") chkDisableView.value = (rv === "1");
        rv = readPref("IncludeAbName"); if (rv !== "") chkIncludeArtboardName.value = (rv === "1");
        rv = readPref("PdfBleed");     if (rv !== "") chkPdfBleed.value = (rv === "1");
        rv = readPref("OpenFolder");   if (rv !== "") chkOpenFolder.value = (rv === "1");
        rv = readPref("Combined");     if (rv !== "") chkCombined.value = (rv === "1");
        rv = parseInt(readPref("FolderMode"), 10);
        if (!isNaN(rv) && rv >= 0 && rv < FOLDER_MODE_OPTIONS.length) dropdownFolderMode.selection = rv;
        rv = readPref("BleedMode");
        if (rv === "125") { rbBleedNone.value = false; rbBleed125.value = true; }
        else if (rv === "custom") { rbBleedNone.value = false; rbBleedCustom.value = true; }
        rv = readPref("BleedCustom");  if (rv !== "") txtBleed.text = rv;
        rv = readPref("PdfBleedCustom"); if (rv !== "") txtPdfBleed.text = rv;
    }
    if (readPref("RememberFolder") === "1") {
        var savedFolder = readPref("OutputFolder");
        if (savedFolder !== "" && new Folder(savedFolder).exists) txtFolder.text = savedFolder;
        chkRememberFolder.value = true;
    }
    refreshBleedUI();
    refreshPdfBleedUI();
    refreshArtboardUI();
    refreshCombinedUI();
    updatePreview();

    var warningGroup = win.add("group");
    warningGroup.orientation = "column";
    warningGroup.alignChildren = ["center", "top"];
    warningGroup.spacing = 2;
    warningGroup.margins = [0, 5, 0, 0];
    warningGroup.add("statictext", undefined, "Processing runs in the background.");
    warningGroup.add("statictext", undefined, "(Illustrator may look frozen, but it hasn't crashed!)");
    warningGroup.add("statictext", undefined, "Please check your output folder before closing.");

    var chkRemember = win.add("checkbox", undefined, "Remember settings");
    chkRemember.alignment = ["center", "top"];
    chkRemember.value = (readPref("RememberSettings") === "1");

    var grpButtons = win.add("group"); grpButtons.alignment = ["center", "top"]; grpButtons.margins = [0, 10, 0, 0];
    var btnExport = grpButtons.add("button", undefined, "Export Files");
    var btnCancel = grpButtons.add("button", undefined, "Cancel");

    btnCancel.onClick = function () { RESULT = "WARNING: Operation cancelled."; win.close(); };

    btnExport.onClick = function () {
        if (txtFolder.text === "") { RESULT = "ERROR: Select an output folder."; win.close(); return; }
        var destFolder = new Folder(txtFolder.text);
        if (!destFolder.exists) { RESULT = "ERROR: Folder does not exist."; win.close(); return; }

        if (!dropdownPresets.selection) { RESULT = "ERROR: No PDF preset selected (or none installed)."; win.close(); return; }
        var presetName = dropdownPresets.selection.text;

        // ----- bleed -----
        var bleedInches = 0;
        var bleedMode = "none";
        if (rbBleed125.value) {
            bleedInches = 0.125;
            bleedMode = "125";
        } else if (rbBleedCustom.value) {
            bleedMode = "custom";
            bleedInches = parseFloat(txtBleed.text);
            if (isNaN(bleedInches) || bleedInches < 0) {
                RESULT = "ERROR: Enter a valid custom bleed in inches (for example 0.25).";
                win.close();
                return;
            }
        }
        var bleedPts = bleedInches * 72;

        // Fully independent of the warning tolerance above: its own
        // amount, usable regardless of what the warning is set to.
        var pdfBleedInches = 0;
        if (chkPdfBleed.value) {
            pdfBleedInches = parseFloat(txtPdfBleed.text);
            if (isNaN(pdfBleedInches) || pdfBleedInches < 0) {
                RESULT = "ERROR: Enter a valid PDF bleed in inches (for example 0.125).";
                win.close();
                return;
            }
        }
        var pdfBleedPts = pdfBleedInches * 72;
        var usePdfBleed = chkPdfBleed.value && pdfBleedPts > 0;

        // ----- artboard selection -----
        var abIndices = [];
        if (rbAbSel.value) {
            var abSel = listAb.selection;
            if (!abSel) {
                RESULT = "ERROR: Select at least one artboard in the list, or choose \"All artboards\".";
                win.close();
                return;
            }
            var abSelArr = (abSel instanceof Array) ? abSel : [abSel];
            for (var si = 0; si < abSelArr.length; si++) abIndices.push(abSelArr[si].index);
            abIndices.sort(function (a, b) { return a - b; });
        } else {
            for (var ai = 0; ai < doc.artboards.length; ai++) abIndices.push(ai);
        }
        var total = abIndices.length;

        var includeArtboardName = chkIncludeArtboardName.value;
        var folderMode = dropdownFolderMode.selection ? dropdownFolderMode.selection.index : 0;
        // 0 = no subfolders, 1 = per artboard, 2 = per file type

        var combinedMode = chkCombined.value;

        if (!combinedMode && !includeArtboardName && total > 1) {
            var proceedAnyway = confirm(
                "Artboard names are OFF and " + total + " artboards will be exported.\n\n" +
                "Every exported file will share the same name and will overwrite each other \u2014 " +
                "only the last artboard's files will remain.\n\nContinue anyway?",
                true, "Filename Collision Warning"
            );
            if (!proceedAnyway) return;
        }

        // Duplicate artboard names (Illustrator allows this) produce the
        // same collision even with the toggle ON, so check separately.
        if (!combinedMode && includeArtboardName) {
            var abNameCounts = {};
            var abDupes = [];
            for (var da = 0; da < total; da++) {
                var dupNm = cleanAbName(doc.artboards[abIndices[da]].name, abIndices[da]);
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

        // ----- save preferences (only after validation passed) -----
        writePref("LastPDFPreset", presetName);
        writePref("RememberSettings", chkRemember.value ? "1" : "0");
        if (chkRemember.value) {
            writePref("SaveAi", chkSaveAi.value ? "1" : "0");
            writePref("SaveEps", chkSaveEps.value ? "1" : "0");
            writePref("NoOpen", chkDisableView.value ? "1" : "0");
            writePref("IncludeAbName", chkIncludeArtboardName.value ? "1" : "0");
            writePref("PdfBleed", chkPdfBleed.value ? "1" : "0");
            writePref("OpenFolder", chkOpenFolder.value ? "1" : "0");
            writePref("Combined", chkCombined.value ? "1" : "0");
            writePref("FolderMode", folderMode);
            writePref("BleedMode", bleedMode);
            writePref("BleedCustom", txtBleed.text);
            writePref("PdfBleedCustom", txtPdfBleed.text);
        }
        writePref("RememberFolder", chkRememberFolder.value ? "1" : "0");
        if (chkRememberFolder.value) writePref("OutputFolder", destFolder.fsName);

        var customNameInput = sanitizeName(txtCustomName.text);
        var saveAi = chkSaveAi.value;
        var saveEps = chkSaveEps.value;
        var preventOpening = chkDisableView.value;
        var preserveEdit = chkPreserveEdit.value;
        var aiPdfCompatible = chkAiPdfCompatible.value;
        var openFolderWhenDone = chkOpenFolder.value;
        var exportedCount = 0;
        var cancelRequested = false;

        win.close();

        // Lightweight progress palette. Uses a text-drawn bar instead of
        // ScriptUI's native progressbar, which renders as solid black and
        // never visibly fills under Illustrator's dark UI theme.
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
        var btnProgCancel = progWin.add("button", undefined, "Cancel");
        btnProgCancel.alignment = ["center", "top"];
        // Stops between artboards, not mid-artboard. Illustrator may not
        // register the click while it is busy inside an artboard.
        btnProgCancel.onClick = function () {
            cancelRequested = true;
            try {
                btnProgCancel.enabled = false;
                progStatus.text = "Cancelling after the current artboard\u2026";
                progWin.update();
            } catch (eCancel) {}
        };
        progWin.show();

        // Pumps the UI so a queued Cancel click gets noticed sooner during
        // the slower combined-mode steps, instead of only being picked up
        // once an entire artboard finishes. Doesn't stop anything by
        // itself - it just gives Illustrator a chance to run the button's
        // onClick handler, which sets cancelRequested for the next check.
        function pumpUI() {
            try { progWin.update(); app.redraw(); } catch (ePump) {}
        }

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

        // Combined mode only (AI/EPS side): deletes every item that
        // doesn't overlap ANY of the given target artboard rects, walking
        // layers directly - no selection commands involved at all, so
        // there's nothing for a menu command's own quirks to get wrong.
        // Each item's true bounds (see getTrueBounds, below) are checked
        // against every target rect directly; an item is kept the moment
        // it overlaps just one of them. Guides and other items with no
        // real bounds are left alone either way, same as elsewhere in
        // this script. Layer names/structure are never touched.
        function stripToTargets(layers, targetRects) {
            for (var sl2 = 0; sl2 < layers.length; sl2++) {
                var sLayer = layers[sl2];
                var sItems = sLayer.pageItems;
                for (var si3 = sItems.length - 1; si3 >= 0; si3--) {
                    var sBounds = getTrueBounds(sItems[si3]);
                    if (!sBounds) continue;
                    var sKeep = false;
                    for (var st = 0; st < targetRects.length; st++) {
                        var sr = targetRects[st];
                        var sOutside = (sBounds[2] < sr[0] - BLEED_EPSILON || sBounds[0] > sr[2] + BLEED_EPSILON ||
                                        sBounds[1] < sr[3] - BLEED_EPSILON || sBounds[3] > sr[1] + BLEED_EPSILON);
                        if (!sOutside) { sKeep = true; break; }
                    }
                    if (!sKeep) {
                        try { sItems[si3].remove(); } catch (eStrip) {}
                    }
                }
                if (sLayer.layers.length > 0) stripToTargets(sLayer.layers, targetRects);
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
                    try { currentLayer.remove(); } catch (e) {
                        // Remember which layers refused to go so the final
                        // message can say so instead of hiding it
                        try { layerCleanupFailures.push(currentLayer.name); } catch (e2) {}
                    }
                }
            }
        }

        // True bounds of an item, respecting clipping masks. A clipped
        // group's own geometricBounds ignores the mask and reports the
        // full extent of whatever is inside it (e.g. an oversized image
        // clipped down to a small shape) - that would produce false
        // bleed warnings, so clipped groups use the clip path's own
        // bounds instead.
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

        // A clip path's geometricBounds and the artboard's own artboardRect
        // can disagree by a razor-thin amount (seen: ~1e-12pt) even when
        // they're meant to be the exact same edge - a floating-point
        // rounding quirk, worse on Large Canvas docs. BLEED_EPSILON (0.05pt)
        // absorbs that noise without masking any real overhang.
        var BLEED_EPSILON = 0.05;

        // One pass over each layer's TOP-LEVEL items (getTrueBounds handles
        // everything nested inside them, clipped or not). Fills res with:
        //   total    - items that have visible bounds
        //   outside  - items entirely outside the artboard (isolation
        //              should have deleted these, so this means it failed)
        //   overhang - items that cross the artboard edge by more than
        //              the bleed zone (bleedRect)
        // rects are [left, top, right, bottom].
        function analyzeIsolation(layers, abRect, bleedRect, res) {
            for (var la = 0; la < layers.length; la++) {
                var layer = layers[la];
                var items = layer.pageItems;
                for (var b = 0; b < items.length; b++) {
                    var tb = getTrueBounds(items[b]);
                    if (!tb) continue;
                    res.total++;
                    var overlaps = !(tb[2] < abRect[0] - BLEED_EPSILON || tb[0] > abRect[2] + BLEED_EPSILON ||
                                     tb[1] < abRect[3] - BLEED_EPSILON || tb[3] > abRect[1] + BLEED_EPSILON);
                    if (!overlaps) { res.outside++; continue; }
                    var insideBleed = (tb[0] >= bleedRect[0] - BLEED_EPSILON && tb[2] <= bleedRect[2] + BLEED_EPSILON &&
                                       tb[1] <= bleedRect[1] + BLEED_EPSILON && tb[3] >= bleedRect[3] - BLEED_EPSILON);
                    if (!insideBleed) res.overhang++;
                }
                if (layer.layers.length > 0) analyzeIsolation(layer.layers, abRect, bleedRect, res);
            }
        }

        // Combined mode only: same idea as analyzeIsolation, but for use
        // BEFORE anything has been stripped out of the shared document -
        // it only counts items that actually overlap this one artboard in
        // the first place, ignoring everything else in the file entirely.
        // analyzeIsolation can't be reused here as-is: it counts every
        // item it's given as "total" and treats non-overlapping ones as an
        // isolation failure, which is the wrong question to ask against a
        // document that hasn't been isolated yet - virtually everything in
        // the file would look "outside" and "empty" would never fire
        // correctly.
        function analyzeCombinedArtboard(layers, rawRect, bleedRect, res) {
            for (var la2 = 0; la2 < layers.length; la2++) {
                var layer2 = layers[la2];
                var items2 = layer2.pageItems;
                for (var b2 = 0; b2 < items2.length; b2++) {
                    var tb2 = getTrueBounds(items2[b2]);
                    if (!tb2) continue;
                    var overlaps2 = !(tb2[2] < rawRect[0] - BLEED_EPSILON || tb2[0] > rawRect[2] + BLEED_EPSILON ||
                                      tb2[1] < rawRect[3] - BLEED_EPSILON || tb2[3] > rawRect[1] + BLEED_EPSILON);
                    if (!overlaps2) continue;
                    res.total++;
                    var insideBleed2 = (tb2[0] >= bleedRect[0] - BLEED_EPSILON && tb2[2] <= bleedRect[2] + BLEED_EPSILON &&
                                        tb2[1] <= bleedRect[1] + BLEED_EPSILON && tb2[3] >= bleedRect[3] - BLEED_EPSILON);
                    if (!insideBleed2) res.overhang++;
                }
                if (layer2.layers.length > 0) analyzeCombinedArtboard(layer2.layers, rawRect, bleedRect, res);
            }
        }

        // Declared outside the try so the error handler can clean them up.
        // Documents are tracked by reference (not by name): after saveAs
        // Illustrator renames the document, so a name check misses it.
        var masterTempFile = null;
        var tempAiFile = null;
        var masterDoc = null;
        var tempDoc = null;
        var mergedTempFile = null;
        var mergedDoc = null;

        function cleanupTempFiles() {
            try { if (tempDoc) tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC1) {}
            tempDoc = null;
            try { if (masterDoc) masterDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC2) {}
            masterDoc = null;
            try { if (mergedDoc) mergedDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC2b) {}
            mergedDoc = null;
            try { app.activeDocument = doc; } catch (eC3) {}
            try { if (tempAiFile && tempAiFile.exists) tempAiFile.remove(); } catch (eC4) {}
            try { if (masterTempFile && masterTempFile.exists) masterTempFile.remove(); } catch (eC5) {}
            try { if (mergedTempFile && mergedTempFile.exists) mergedTempFile.remove(); } catch (eC6) {}
            // Also force this off in case an older build of this script
            // (or anything else) left it on - the current combined-mode
            // build no longer uses it at all, see the merge step below.
            try { app.pasteRemembersLayers = false; } catch (eC7) {}
        }

        try {
            masterTempFile = new File(destFolder.fsName + "/_master_temp_build.ai");
            originalFile.copy(masterTempFile);
            masterDoc = app.open(masterTempFile);

            fastUnlock(masterDoc.layers);
            try { app.executeMenuCommand('unlockAll'); } catch (e) {}
            try { app.executeMenuCommand('showAll'); } catch (e) {}

            try {
                var tFrames = masterDoc.textFrames;
                if (tFrames.length > 0) {
                    for (var t = tFrames.length - 1; t >= 0; t--) {
                        try { tFrames[t].createOutline(); } catch (e) {}
                    }
                }
            } catch (e) {}

            // Embed every linked file (PDF and AI saveAs have no
            // "embed links" flag - the only way to guarantee no
            // missing-link references is to embed them in the doc
            // itself, once, here, before any per-artboard copies
            // are made. EPS also gets its own embedLinkedFiles flag
            // below as a second layer of safety.
            var linkEmbedFailures = [];
            var bleedFailures = [];      // art crosses the edge past the bleed zone
            var isolationFailures = [];  // art left entirely outside the artboard
            var emptyArtboards = [];     // nothing left on the artboard
            var pdfBleedFailed = false;
            try {
                var placed = masterDoc.placedItems;
                for (var pI = placed.length - 1; pI >= 0; pI--) {
                    try { placed[pI].embed(); }
                    catch (eEmbed) {
                        try { linkEmbedFailures.push(placed[pI].name); } catch (eN) {}
                    }
                }
            } catch (ePlaced) {}

            masterDoc.save();
            masterDoc.close(SaveOptions.DONOTSAVECHANGES);
            masterDoc = null;

            var combinedBaseName = "";
            var combinedFilesWritten = [];

            if (combinedMode) {
                // ---------- combined build, rewritten: no isolation, no ----------
                // per-artboard temp copies, no merging content between
                // documents. See the header note for why the previous
                // approach (build a shared document, copy each artboard's
                // isolated content into it one at a time) kept leaking
                // content from other artboards - four different fixes
                // aimed at that mechanism all failed, which was the sign
                // to stop patching it and remove it instead.
                combinedBaseName = cleanDocName;

                function isSelectedArtboardIndex(idx) {
                    for (var sia = 0; sia < abIndices.length; sia++) {
                        if (abIndices[sia] === idx) return true;
                    }
                    return false;
                }

                var pdfDestFolderC = (folderMode === 2) ? getOrCreateFolder(destFolder, "PDF") : destFolder;
                var aiDestFolderC = (folderMode === 2) ? getOrCreateFolder(destFolder, "AI") : destFolder;
                var epsDestFolderC = (folderMode === 2) ? getOrCreateFolder(destFolder, "EPS") : destFolder;

                // ---- PDF: Illustrator's own multi-artboard save, directly ----
                // on a prepared (but otherwise untouched) copy of the whole
                // document. Its own artboardRange can take a comma-separated
                // list of specific artboards, not just a contiguous range,
                // and each resulting page only ever shows what's actually
                // inside that artboard's own box - the same mechanism normal
                // mode's own single-artboard PDF export already relies on.
                // No isolation step needed here at all.
                if (!cancelRequested) {
                    updateProgress(1, "combined PDF");
                    mergedTempFile = new File(destFolder.fsName + "/_combined_pdf_build.ai");
                    masterTempFile.copy(mergedTempFile);
                    mergedDoc = app.open(mergedTempFile);

                    var pdfRangeParts = [];
                    for (var pr = 0; pr < total; pr++) pdfRangeParts.push(abIndices[pr] + 1);

                    var pdfTargetFileC = new File(pdfDestFolderC.fsName + "/" + combinedBaseName + ".pdf");
                    var pdfSaveOptsC = new PDFSaveOptions();
                    pdfSaveOptsC.pDFPreset = presetName;
                    pdfSaveOptsC.preserveEditability = preserveEdit;
                    pdfSaveOptsC.acrobatLayers = true;
                    pdfSaveOptsC.compatibility = PDFCompatibility.ACROBAT7;
                    pdfSaveOptsC.artboardRange = pdfRangeParts.join(",");
                    pdfSaveOptsC.viewAfterSaving = !preventOpening;
                    if (usePdfBleed) {
                        try { pdfSaveOptsC.bleedLink = true; } catch (eBLc) {}
                        try {
                            pdfSaveOptsC.bleedOffsetRect = [pdfBleedPts, pdfBleedPts, pdfBleedPts, pdfBleedPts];
                        } catch (eBRc) { pdfBleedFailed = true; }
                    }
                    mergedDoc.saveAs(pdfTargetFileC, pdfSaveOptsC);
                    combinedFilesWritten.push(combinedBaseName + ".pdf");

                    mergedDoc.close(SaveOptions.DONOTSAVECHANGES);
                    mergedDoc = null;
                    mergedTempFile.remove();
                    mergedTempFile = null;
                }

                // ---- AI / EPS: these two formats have no "just these ----
                // artboards" option (an .ai file always holds the whole
                // document; an .eps is always one flattened page of
                // whatever the document contains), so this is the one
                // place content still needs to be stripped down. Done once,
                // directly, on a single document: delete every item that
                // doesn't overlap ANY selected artboard, then remove the
                // artboards that weren't picked. No selection commands
                // involved in the deletion - each item's own true bounds
                // are checked directly, so there's nothing for a menu
                // command's quirks to get wrong.
                if (!cancelRequested) {
                    updateProgress(total, "combined AI/EPS");
                    mergedTempFile = new File(destFolder.fsName + "/_combined_content_build.ai");
                    masterTempFile.copy(mergedTempFile);
                    mergedDoc = app.open(mergedTempFile);

                    // Expanded by the chosen bleed amount (same value used
                    // for the overhang warning below) - not just the bare
                    // artboard box - so art that intentionally sits in the
                    // bleed zone, and doesn't happen to touch the artboard's
                    // own edge, isn't mistaken for stray content and
                    // stripped out.
                    var targetRects = [];
                    for (var tr = 0; tr < total; tr++) {
                        var rawTarget = mergedDoc.artboards[abIndices[tr]].artboardRect;
                        targetRects.push([
                            rawTarget[0] - bleedPts,
                            rawTarget[1] + bleedPts,
                            rawTarget[2] + bleedPts,
                            rawTarget[3] - bleedPts
                        ]);
                    }

                    // Bleed/isolation warnings per selected artboard,
                    // before anything gets deleted - same checks normal
                    // mode already runs, just against this one document.
                    for (var wa = 0; wa < total; wa++) {
                        try {
                            var wIdx = abIndices[wa];
                            var wName = cleanAbName(doc.artboards[wIdx].name, wIdx);
                            var wRaw = mergedDoc.artboards[wIdx].artboardRect;
                            var wBleedRect = [
                                wRaw[0] - bleedPts, wRaw[1] + bleedPts,
                                wRaw[2] + bleedPts, wRaw[3] - bleedPts
                            ];
                            var wAnalysis = { total: 0, outside: 0, overhang: 0 };
                            analyzeCombinedArtboard(mergedDoc.layers, wRaw, wBleedRect, wAnalysis);
                            if (wAnalysis.overhang > 0) bleedFailures.push(wName);
                            if (wAnalysis.total === 0) emptyArtboards.push(wName);
                        } catch (eW) {}
                    }

                    stripToTargets(mergedDoc.layers, targetRects);
                    removeEmptyLayers(mergedDoc.layers);

                    // Remove every artboard that wasn't selected. The ones
                    // that remain keep their original name and position -
                    // neither was ever touched.
                    for (var ra4 = mergedDoc.artboards.length - 1; ra4 >= 0; ra4--) {
                        if (!isSelectedArtboardIndex(ra4)) {
                            try { mergedDoc.artboards[ra4].remove(); } catch (eRa4) {}
                        }
                    }

                    if (saveAi) {
                        var aiTargetFileC = new File(aiDestFolderC.fsName + "/" + combinedBaseName + ".ai");
                        var aiSaveOptsC = new IllustratorSaveOptions();
                        aiSaveOptsC.pdfCompatible = aiPdfCompatible;
                        mergedDoc.saveAs(aiTargetFileC, aiSaveOptsC);
                        combinedFilesWritten.push(combinedBaseName + ".ai");
                    }

                    if (saveEps) {
                        var epsTargetFileC = new File(epsDestFolderC.fsName + "/" + combinedBaseName + ".eps");
                        var epsSaveOptsC = new EPSSaveOptions();
                        epsSaveOptsC.cmykPostScript = (mergedDoc.documentColorSpace === DocumentColorSpace.CMYK);
                        epsSaveOptsC.embedAllFonts = false;
                        epsSaveOptsC.preview = EPSPreview.COLORTIFF;
                        try { epsSaveOptsC.postScript = PostScriptLevelEnum.LEVEL3; } catch (ePSc) {}
                        try { epsSaveOptsC.compatibleGradientPrinting = true; } catch (eGPc) {}
                        try { epsSaveOptsC.embedLinkedFiles = true; } catch (eELc) {}
                        mergedDoc.saveAs(epsTargetFileC, epsSaveOptsC);
                        combinedFilesWritten.push(combinedBaseName + ".eps");
                    }

                    mergedDoc.close(SaveOptions.DONOTSAVECHANGES);
                    mergedDoc = null;
                    mergedTempFile.remove();
                    mergedTempFile = null;
                }

                exportedCount = cancelRequested ? 0 : total;
            } else {
                // ---------- normal mode: one set of files per artboard ----------
                for (var k = 0; k < total; k++) {
                    if (cancelRequested) break;

                    var i = abIndices[k];
                    var abName = doc.artboards[i].name;
                    var cleanArtboardName = cleanAbName(abName, i);
                    updateProgress(k + 1, abName);

                    var prefix = (customNameInput !== "") ? customNameInput : (cleanDocName + " ");
                    var baseFileName = includeArtboardName
                        ? (prefix + cleanArtboardName)
                        : prefix;
                    baseFileName = baseFileName.replace(/[\s.]+$/, '');
                    if (baseFileName === "") baseFileName = cleanArtboardName;

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
                    } catch (e) {}

                    // Check what's left against this artboard's bounds. The
                    // bleed zone is expected art and won't get clipped by the
                    // RIP, so only genuine overhang past the bleed is flagged.
                    // Anything entirely outside the artboard, or an artboard
                    // with nothing left on it, means isolation went wrong.
                    try {
                        var rawBounds = tempDoc.artboards[i].artboardRect;
                        var bleedRect = [
                            rawBounds[0] - bleedPts, // left
                            rawBounds[1] + bleedPts, // top
                            rawBounds[2] + bleedPts, // right
                            rawBounds[3] - bleedPts  // bottom
                        ];
                        var analysis = { total: 0, outside: 0, overhang: 0 };
                        analyzeIsolation(tempDoc.layers, rawBounds, bleedRect, analysis);
                        if (analysis.overhang > 0) bleedFailures.push(cleanArtboardName);
                        if (analysis.outside > 0) isolationFailures.push(cleanArtboardName);
                        if (analysis.total === 0) emptyArtboards.push(cleanArtboardName);
                    } catch (eBleed) {}

                    removeEmptyLayers(tempDoc.layers);

                    var abCount = tempDoc.artboards.length;
                    for (var a = abCount - 1; a >= 0; a--) {
                        if (a !== i) {
                            try { tempDoc.artboards[a].remove(); } catch (e) {}
                        }
                    }

                    var pdfDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "PDF") : artboardDestFolder;
                    var pdfTargetFile = new File(pdfDestFolder.fsName + "/" + baseFileName + ".pdf");
                    var pdfSaveOpts = new PDFSaveOptions();
                    pdfSaveOpts.pDFPreset = presetName;
                    pdfSaveOpts.preserveEditability = preserveEdit;
                    pdfSaveOpts.acrobatLayers = true;
                    // ACROBAT7 (PDF 1.6) or higher - PDF's UserUnit key, which
                    // records a Large Canvas document's true 10x scale, isn't
                    // supported before PDF 1.6. With ACROBAT6, Acrobat and other
                    // spec-compliant readers showed the PDF 10x too small.
                    pdfSaveOpts.compatibility = PDFCompatibility.ACROBAT7;
                    pdfSaveOpts.artboardRange = "1";
                    pdfSaveOpts.viewAfterSaving = !preventOpening;
                    if (usePdfBleed) {
                        // PDF-only bleed: same amount on all four sides. Empty
                        // bleed area stays blank (no artwork is created).
                        try { pdfSaveOpts.bleedLink = true; } catch (eBL) {}
                        try {
                            pdfSaveOpts.bleedOffsetRect = [pdfBleedPts, pdfBleedPts, pdfBleedPts, pdfBleedPts];
                        } catch (eBR) { pdfBleedFailed = true; }
                    }

                    tempDoc.saveAs(pdfTargetFile, pdfSaveOpts);
                    pumpUI();

                    if (saveAi) {
                        var aiDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "AI") : artboardDestFolder;
                        var aiTargetFile = new File(aiDestFolder.fsName + "/" + baseFileName + ".ai");
                        var aiSaveOpts = new IllustratorSaveOptions();
                        aiSaveOpts.pdfCompatible = aiPdfCompatible;
                        tempDoc.saveAs(aiTargetFile, aiSaveOpts);
                        pumpUI();
                    }

                    if (saveEps) {
                        var epsDestFolder = (folderMode === 2) ? getOrCreateFolder(destFolder, "EPS") : artboardDestFolder;
                        var epsTargetFile = new File(epsDestFolder.fsName + "/" + baseFileName + ".eps");
                        var epsSaveOpts = new EPSSaveOptions();
                        epsSaveOpts.cmykPostScript = (tempDoc.documentColorSpace === DocumentColorSpace.CMYK);
                        epsSaveOpts.embedAllFonts = false; // text is already outlined by this point
                        epsSaveOpts.preview = EPSPreview.COLORTIFF;
                        // compatibility intentionally left unset - Illustrator
                        // defaults to the current/modern format, same as a
                        // manual File > Save As. Hardcoding the legacy
                        // Compatibility.ILLUSTRATOR10 made EPS exports come
                        // out scaled down 10x on Large Canvas documents.
                        try { epsSaveOpts.postScript = PostScriptLevelEnum.LEVEL3; } catch (ePS) {}
                        try { epsSaveOpts.compatibleGradientPrinting = true; } catch (eGP) {}
                        try { epsSaveOpts.embedLinkedFiles = true; } catch (eEL) {}
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
            }

            masterTempFile.remove();
            masterTempFile = null;

            app.userInteractionLevel = prevInteractionLevel;
            try { app.activeDocument = doc; } catch (eAD) {}

            var doneMsg;
            if (combinedMode) {
                doneMsg = cancelRequested
                    ? ("Cancelled.\n" + exportedCount + " of " + total + " artboards merged before stopping.")
                    : (combinedFilesWritten.length > 0
                        ? ("Done!\n" + exportedCount + " artboard(s) combined into:\n" + combinedFilesWritten.join("\n"))
                        : "Nothing was exported.");
            } else {
                doneMsg = cancelRequested
                    ? ("Cancelled.\n" + exportedCount + " of " + total + " artboards exported before stopping.")
                    : ("Done!\n" + exportedCount + " artboards exported.");
            }
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
            if (pdfBleedFailed) {
                doneMsg += "\n\nNote: the PDF bleed setting could not be applied by this version of Illustrator.";
            }
            if (isolationFailures.length > 0) {
                doneMsg += "\n\nWarning: art was left outside the artboard, so isolation may have failed on:\n" +
                           isolationFailures.join("\n") +
                           "\nCheck these PDFs against the source file.";
            }
            if (emptyArtboards.length > 0) {
                doneMsg += "\n\nWarning: nothing was left on these artboards after isolation (empty, or isolation failed):\n" +
                           emptyArtboards.join("\n");
            }
            if (bleedFailures.length > 0) {
                doneMsg += "\n\nWarning: art extends past the artboard edge and may be clipped on:\n" +
                           bleedFailures.join("\n");
            }
            try { progWin.close(); } catch (ePc1) {}
            if (openFolderWhenDone) {
                try { destFolder.execute(); } catch (eOpen) {}
            }
            RESULT = cancelRequested ? "WARNING: " + doneMsg : "SUCCESS: " + doneMsg;
        } catch (error) {
            app.userInteractionLevel = prevInteractionLevel;
            cleanupTempFiles();
            try { progWin.close(); } catch (ePc2) {}
            RESULT = "ERROR: " + error.message +
                      "\n\nExported before the error: " + exportedCount + " of " + total + " artboards." +
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
