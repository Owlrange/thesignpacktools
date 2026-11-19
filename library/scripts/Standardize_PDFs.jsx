/*
  Standardize PDFs 2.0
  Author: Joao Victor Malz
  Copyright: (c) 2026 Joao Victor Malz
  Created for use at The Sign Pack
  ---------------------------------------------------------
  Problem: when exporting multi-artboard presentation PDFs, each artboard is
  sized to fit its own sign/art, so pages come out different sizes and the
  PDF "breaks flow" for the client.

  What this does:
    1. Works on a DISPOSABLE COPY of your currently open, saved .ai file.
       Your open document is never modified or saved over.
    2. Skips selected artboards that have no art, then exports each of the
       others to its own temporary single-page PDF.
    3. Creates a fresh, normal-size document (same color mode as the
       source file) where every page has the same standard size:
         - 11" height (default), 8.5" height (Pittsburgh), or a custom
           height: the width follows the shape of the largest sign, or
         - Auto: size of the largest selected sign (needs an extra
           measuring pass, so it is slower).
    4. Places each temporary PDF on its own page (vector),
       scaled UNIFORMLY to the largest size that fits inside the page
       (minus the margin) and centered. Nothing is clipped or stretched.
    5. Saves ONE multi-page PDF named <project>_Presentation_v<version>.pdf,
       closes everything without saving, and deletes all temp files.

  Other features:
    - Artboard list starts in artboard order; Move Up / Move Down changes
      the page order. "Select Presentation" selects artboards with
      "presentation" in the name (skipping any with "proof").
    - Project # is read from the start of the open file's name.
    - Version is pre-filled with the next number after the highest
      <project>_Presentation_v<N>.pdf found in the output folder. The
      "Overwrite current" toggle (off by default) uses that highest number
      instead and skips the overwrite question.
      If no presentation PDF exists yet, it falls back to the version of the
      design files FOLDER (<project>_Design Files_v<N>, looked for in the open
      file's folder, its parent folders, and the folders next to / inside it):
      next number = N + 1, or N with "Overwrite current" on.
    - "Save the open file first if it has unsaved changes" (on by default,
      remembered): the script works from the saved file on disk, so this makes
      sure the PDF includes your latest edits. With it off, unsaved changes are
      NOT in the PDF and the Done window says so.
    - Optional "Remember these settings" checkbox (off by default): layout
      (tall / wide), size mode, height, margin, preset, open-when-done and auto-save. The output folder is never
      remembered.
    - The output folder is pre-filled with the project's "presentation"
      folder (found by walking up to the project folder named after the
      Project #, then looking inside it); it falls back to the file's own
      folder, and can always be changed.
    - PDF preset dropdown for the final export (default: TSP_Presentation).
      Temporary PDFs are exported without downsampling so images are only
      compressed once, by the chosen preset.
    - Progress window while it works.
    - On failure: temp files are deleted and a dialog offers to save an
      error report to the Desktop to send to the script's creator.

  Because the artwork goes through a fresh normal-size document, Large
  Canvas files (scale factor above 1) no longer affect positioning.
*/

#target "illustrator"

// Message handed back to Sign Pack Tools (the status bar shows it): SUCCESS: / WARNING: / ERROR:
var TSP_NAME = "Standardize PDFs 2.0";
var TSP_RESULT = "";

function main() {
    // ---- UI Kit: logo, popups and standard sizes live in ONE shared file ----
    // Needs "UI_Kit_x.x.jsx" in the same folder as this script (the highest version
    // is used). If it is missing the script still works: plain system popups, no logo.
    var UIK_SELF = "";
    try { UIK_SELF = $.fileName; } catch (eUS) {}
    var UIK_CACHE = null;
    function uik() {
        if (UIK_CACHE) return UIK_CACHE;
        var kit = null;
        try {
            var folder = new File(UIK_SELF).parent;
            var files = folder.getFiles();
            var best = null, bestV = null;
            for (var i = 0; i < files.length; i++) {
                if (!(files[i] instanceof File)) continue;
                var m = decodeURI(files[i].name).match(/^UI[ _]Kit(?:[ _]*v?(\d+(?:\.\d+)*))?\.jsx$/i);
                if (!m) continue;
                var v = (m[1] || "0").split(".");
                var newer = !bestV;
                for (var n = 0; !newer && n < 4; n++) {
                    var x = parseInt(v[n] || "0", 10), y = parseInt(bestV[n] || "0", 10);
                    if (x !== y) { newer = (x > y); break; }
                }
                if (newer) { best = files[i]; bestV = v; }
            }
            if (best) {
                $.global.__SIGNPACK_LOADING_UI = true;
                $.global.__SIGNPACK_UIKIT = null;
                try { $.evalFile(best); } catch (eKit) {}
                $.global.__SIGNPACK_LOADING_UI = false;
                kit = $.global.__SIGNPACK_UIKIT;
            }
        } catch (eFind) {}
        if (!kit || !kit.spAlert) {
            kit = {
                version: "none", missing: true, TITLE_SIZE: 15, MARGINS: 16, SPACING: 10,
                pos: function () { return [90, 140]; },
                spAlert: function (message) { alert(message); },
                spConfirm: function (message) { return confirm(message); },
                addLogo: function () { return null; },
                popupDefs: "function spAlert(message, title) { alert(message); }\nfunction spConfirm(message, title, yesText) { return confirm(message); }\n"
            };
            try {
                if (!$.global.__SIGNPACK_UIKIT_WARNED) {
                    $.global.__SIGNPACK_UIKIT_WARNED = true;
                    alert("The UI Kit file was not found.\n\nPut \"UI_Kit_x.x.jsx\" in the same folder as this script to get the logo and the dark popups. The script works without it.");
                }
            } catch (eWarn) {}
        }
        UIK_CACHE = kit;
        return kit;
    }
    function addLogo(parent, w) { return uik().addLogo(parent, w); }


    var SCRIPT_NAME = "Standardize PDFs 2.0";

    var PREF = "signpack/standardizepdf/";

    if (app.documents.length === 0) {
        styledAlert("Open a document first.");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": no document is open.";
        return;
    }

    var sourceDoc = app.activeDocument;
    var sourceName = "";
    var sourceFullPath = "";
    try { sourceName = sourceDoc.name; } catch (eSn0) {}
    try { sourceFullPath = sourceDoc.fullName.fsName; } catch (eSn1) {}
    // true while the original file is still open in Illustrator
    function sourceStillOpen() {
        try { var nm = sourceDoc.name; return (nm !== undefined); } catch (eSo) { return false; }
    }
    // true when doc is the same open file as the original (never close that one by mistake)
    function isSourceDoc(doc) {
        try { return doc === sourceDoc || (sourceFullPath !== "" && doc.fullName.fsName === sourceFullPath); } catch (eIs) { return false; }
    }

    var origFile = null;
    try { origFile = sourceDoc.fullName; } catch (eFN) { origFile = null; }
    if (!origFile || !origFile.exists) {
        styledAlert("Please save this document to disk first (the script works on a copy of the saved file).");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": save the file first.";
        return;
    }
    var hasUnsaved = false;
    try { hasUnsaved = !sourceDoc.saved; } catch (eSv) {}

    // Client detection (Pittsburgh, Lacey): looks at every folder name in the path first, then at the
    // file name, so it also works for people whose file is not inside the client folder (no OneDrive, Mac).
    // Pittsburgh = "Pittsburgh" or the separate word "Pitts"; Lacey = "Lacey". Capitals do not matter.
    function nameIsPgh(t) { return /pittsburgh/i.test(t) || /(^|[^a-z])pitts([^a-z]|$)/i.test(t); }
    function nameIsLacey(t) { return /lacey/i.test(t); }
    var pghFolder = "", pghHow = "";
    var laceyFolder = "", laceyHow = "";
    try {
        var clParts = String(origFile.parent.fsName).replace(/\\/g, "/").split("/");
        for (var pp = 0; pp < clParts.length; pp++) {
            if (pghFolder === "" && nameIsPgh(clParts[pp])) { pghFolder = clParts[pp]; pghHow = "Folder"; }
            if (laceyFolder === "" && nameIsLacey(clParts[pp])) { laceyFolder = clParts[pp]; laceyHow = "Folder"; }
        }
        var clFile = decodeURI(String(origFile.name));
        if (pghFolder === "" && nameIsPgh(clFile)) { pghFolder = clFile; pghHow = "File"; }
        if (laceyFolder === "" && nameIsLacey(clFile)) { laceyFolder = clFile; laceyHow = "File"; }
    } catch (eCl) {}

    // the standardized PDF is built in the same color mode as the source file
    var docColorSpace = DocumentColorSpace.CMYK;
    try { docColorSpace = sourceDoc.documentColorSpace; } catch (eCS) {}

    // ---------------- remembered settings ----------------
    function getPref(key, def) {
        try {
            var v = app.preferences.getStringPreference(PREF + key);
            if (v === undefined || v === null || v === "") return def;
            return v;
        } catch (e) { return def; }
    }
    function setPref(key, val) {
        try { app.preferences.setStringPreference(PREF + key, String(val)); } catch (e) {}
    }
    // Saved settings are only used when "Remember these settings" was left on
    var rememberOn = (getPref("remember", "0") === "1");
    function remembered(key, def) {
        return rememberOn ? getPref(key, def) : def;
    }

    // ---------------- helpers: dialogs ----------------
    // Dark-themed message dialog (matches Illustrator's UI, unlike native alert())
    function styledAlert(message, title) {
        try {
            var dlg = new Window("dialog", title || SCRIPT_NAME);
            dlg.orientation = "column";
            dlg.alignChildren = ["fill", "top"];
            dlg.margins = 20;
            dlg.spacing = 18;

            var msgText = dlg.add("statictext", undefined, String(message), { multiline: true });
            msgText.alignment = ["fill", "top"];
            msgText.justify = "center";
            msgText.preferredSize.width = 400;

            var btnGroup = dlg.add("group");
            btnGroup.alignment = ["center", "top"];
            var btnOk = btnGroup.add("button", undefined, "OK", { name: "ok" });
            btnOk.preferredSize.width = 90;
            btnOk.onClick = function () { dlg.close(); };

            dlg.center();
            dlg.show();
        } catch (eAlert) {
            alert(message);   // last resort: native alert
        }
    }

    // "Done" dialog: centered heading + one centered line per item, with space between.
    // The Saved line shows the short path; hovering it shows the full path.
    function showDoneDialog(outFile, pages, pageWin, pageHin, projectNum, presetUsed, emptyList, failedList, note, pngLine) {
        try {
            var dlg = new Window("dialog", SCRIPT_NAME);
            dlg.orientation = "column";
            dlg.alignChildren = ["center", "top"];
            dlg.margins = [40, 30, 40, 30];
            dlg.spacing = 18;

            var head = dlg.add("statictext", undefined, "Done.");
            head.alignment = ["center", "top"];
            try { head.graphics.font = ScriptUI.newFont("dialog", "BOLD", 22); } catch (eF) {}

            var shortLine = shortPath(outFile.parent, projectNum) + "\\" + decodeURI(outFile.name);
            var saved = dlg.add("statictext", undefined, "Saved: " + shortLine);
            saved.alignment = ["center", "top"];
            saved.helpTip = outFile.fsName;

            var pg = dlg.add("statictext", undefined,
                "Pages: " + pages + " (all " + pageWin.toFixed(2) + "in x " + pageHin.toFixed(2) + "in)");
            pg.alignment = ["center", "top"];

            var sizeMB = "?";
            try { sizeMB = (outFile.length / (1024 * 1024)).toFixed(1) + " MB"; } catch (eSz) {}
            var sz = dlg.add("statictext", undefined,
                "File size: " + sizeMB + (presetUsed !== "" ? "   |   Preset: " + presetUsed : ""));
            sz.alignment = ["center", "top"];

            if (pngLine) {
                var pl = dlg.add("statictext", undefined, pngLine);
                pl.alignment = ["center", "top"];
            }

            var addList = function (title, list) {
                if (list.length === 0) return;
                var t = dlg.add("statictext", undefined, title);
                t.alignment = ["center", "top"];
                for (var li = 0; li < list.length; li++) {
                    var row = dlg.add("statictext", undefined, list[li]);
                    row.alignment = ["center", "top"];
                }
            };
            addList("These artboards had no art and were skipped:", emptyList);
            addList("These artboards failed and were skipped:", failedList);

            if (note) {
                var nt = dlg.add("statictext", undefined, note);
                nt.alignment = ["center", "top"];
            }

            var bg = dlg.add("group");
            bg.alignment = ["center", "top"];
            var ok = bg.add("button", undefined, "OK", { name: "ok" });
            ok.preferredSize.width = 120;
            ok.onClick = function () { dlg.close(); };

            dlg.center();
            dlg.show();
        } catch (eDone) {
            var fb = "Done.\n\nSaved: " + outFile.fsName + "\nPages: " + pages;
            alert(fb);
        }
    }

    // Dark-themed Yes/No dialog (matches Illustrator's UI, unlike native confirm())
    // defaultNo = true: the Enter key answers No instead of Yes
    function styledConfirm(message, title, defaultNo) {
        var dlg = new Window("dialog", title || "Confirm");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 20;
        dlg.spacing = 18;

        var msgText = dlg.add("statictext", undefined, message, { multiline: true });
        msgText.alignment = ["fill", "top"];
        msgText.justify = "center";
        msgText.preferredSize.width = 360;

        var btnGroup = dlg.add("group");
        btnGroup.alignment = ["center", "top"];
        btnGroup.spacing = 15;
        var btnYes = btnGroup.add("button", undefined, "Yes", { name: defaultNo ? "cancel" : "ok" });
        btnYes.preferredSize.width = 90;
        var btnNo = btnGroup.add("button", undefined, "No", { name: defaultNo ? "ok" : "cancel" });
        btnNo.preferredSize.width = 90;

        var result = false;
        btnYes.onClick = function () { result = true; dlg.close(); };
        btnNo.onClick = function () { result = false; dlg.close(); };

        dlg.center();
        dlg.show();
        return result;
    }

    // Progress window (palette with a progress bar)
    function makeProgress(total) {
        var count = 0;
        var pw = new Window("palette", SCRIPT_NAME);
        pw.orientation = "column";
        pw.alignChildren = ["fill", "top"];
        pw.margins = 16;
        pw.spacing = 10;
        var ptxt = pw.add("statictext", undefined, "Starting...");
        ptxt.preferredSize.width = 380;
        var pbar = pw.add("progressbar", undefined, 0, total);
        pbar.preferredSize.width = 380;
        pw.center();
        pw.show();
        pw.update();
        return {
            set: function (msg) {
                try { ptxt.text = msg; pw.update(); } catch (e) {}
            },
            tick: function (msg) {
                count++;
                try {
                    pbar.value = Math.min(count, total);
                    ptxt.text = msg;
                    pw.update();
                } catch (e) {}
            },
            finish: function () {
                try { pbar.value = total; pw.update(); } catch (e) {}
            },
            close: function () { try { pw.close(); } catch (e) {} }
        };
    }

    // Bounds [l, t, r, b] of every TOP-LEVEL visible item (cheap: no selection,
    // no recursion into groups). Returns null if anything goes wrong, so the
    // caller treats every artboard as non-empty.
    function collectTopLevelRects(doc) {
        var rects = [];
        try {
            var walk = function (layers) {
                for (var a = 0; a < layers.length; a++) {
                    var ly = layers[a];
                    if (!ly.visible) continue;
                    var items = ly.pageItems;
                    for (var b = 0; b < items.length; b++) {
                        var it = items[b];
                        var skip = false;
                        try { if (it.hidden) skip = true; } catch (e1) {}
                        try { if (it.guides) skip = true; } catch (e2) {}
                        if (skip) continue;
                        rects.push(it.geometricBounds);
                    }
                    if (ly.layers.length > 0) walk(ly.layers);
                }
            };
            walk(doc.layers);
        } catch (eWalk) {
            return null;
        }
        return rects;
    }
    function artboardHasArt(rects, ar) {
        // ar = [left, top, right, bottom]; item = [l, t, r, b]
        for (var q = 0; q < rects.length; q++) {
            var r = rects[q];
            if (r[0] < ar[2] && r[2] > ar[0] && r[3] < ar[1] && r[1] > ar[3]) return true;
        }
        return false;
    }
    function makePdfOpts(range) {
        var o = new PDFSaveOptions();
        // ACROBAT7 (PDF 1.6) keeps Large Canvas scale info (UserUnit)
        o.compatibility = PDFCompatibility.ACROBAT7;
        o.preserveEditability = false;
        o.generateThumbnails = false;
        o.viewAfterSaving = false;
        o.artboardRange = range;
        // No downsampling in the temporary PDFs: images are compressed only once,
        // by the chosen preset, in the final export (avoids double compression).
        try { o.colorDownsamplingMethod = DownsampleMethod.NODOWNSAMPLE; } catch (e1) {}
        try { o.grayscaleDownsamplingMethod = DownsampleMethod.NODOWNSAMPLE; } catch (e2) {}
        try { o.monochromeDownsamplingMethod = DownsampleMethod.NODOWNSAMPLE; } catch (e3) {}
        return o;
    }
    // Place every PDF page with its page box (the artboard), and remember the user's own setting
    var prevCropBox = null, cropBoxChanged = false;
    function forceCropBox() {
        try {
            var po = app.preferences.PDFFileOptions;
            prevCropBox = po.pDFCropToBox;
            try { po.pDFCropToBox = PDFBoxType.PDFCROPBOX; cropBoxChanged = true; }
            catch (eCb1) { po.pDFCropToBox = PDFBoxType.PDFMEDIABOX; cropBoxChanged = true; }
        } catch (eCb) {}
    }
    function restoreCropBox() {
        if (!cropBoxChanged) return;
        try { if (prevCropBox !== null) app.preferences.PDFFileOptions.pDFCropToBox = prevCropBox; } catch (eCr) {}
        cropBoxChanged = false;
    }
    function setPageToOpen(n) {
        try { app.preferences.setIntegerPreference("plugin/PDFImport/PageToOpen", n); } catch (e) {}
    }

    // Failure dialog with an option to save a report on the Desktop
    function showErrorDialog(summary, reportText) {
        var dlg = new Window("dialog", "Something went wrong");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 20;
        dlg.spacing = 16;

        var t = dlg.add("statictext", undefined,
            "Something went wrong while building the PDF.\n\n" + summary +
            "\n\nClick \"Save Report to Desktop\" and send the file to the creator.\nSend to creator for bugfixing, thanks!",
            { multiline: true });
        t.alignment = ["fill", "top"];
        t.justify = "center";
        t.preferredSize.width = 400;
        t.preferredSize.height = 150;

        var bg = dlg.add("group");
        bg.alignment = ["center", "top"];
        bg.spacing = 15;
        var btnSave = bg.add("button", undefined, "Save Report to Desktop");
        btnSave.preferredSize.width = 170;
        var btnClose = bg.add("button", undefined, "Close", { name: "cancel" });
        btnClose.preferredSize.width = 90;

        btnSave.onClick = function () {
            try {
                var d = new Date();
                var z = function (n) { return (n < 10 ? "0" : "") + n; };
                var stampStr = d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + "_" +
                               z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
                var rf = new File(Folder.desktop.fsName + "/Standardize_PDFs_Error_Report_" + stampStr + ".txt");
                rf.encoding = "UTF-8";
                rf.open("w");
                rf.write(reportText);
                rf.close();
                styledAlert("Report saved to your Desktop:\n" + rf.name + "\n\nPlease send it to the creator for bugfixing. Thanks!");
                dlg.close();
            } catch (eRep) {
                styledAlert("Could not save the report: " + eRep.message);
            }
        };
        btnClose.onClick = function () { dlg.close(); };

        dlg.center();
        dlg.show();
    }

    // ---------------- presentation folder lookup ----------------
    // Finds the project folder (walking UP from the open file to a folder whose
    // name starts with the project number), then looks inside it (max 3 levels):
    //   1) the folder that holds the highest <project>_Presentation_v<N>.pdf
    //      (the open file's own folder counts too), so the next version goes
    //      next to the last one;
    //   2) otherwise the shallowest folder with "presentation" in its name.
    // Folders such as Fonts, Links, Old, Archive and Backup are skipped.
    // Returns { folder: Folder, version: N (0 if found by name) } or null.
    var SKIP_FOLDER_RX = /font|link|^old$|archive|backup/i;

    function lastPresVersionIn(folder, project) {
        var best = 0;
        try {
            var rx = new RegExp("^" + project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_Presentation_v(\\d+)\\.pdf$", "i");
            var files = folder.getFiles(function (x) { return x instanceof File; });
            for (var fi = 0; fi < files.length; fi++) {
                var m = decodeURI(files[fi].name).match(rx);
                if (m) {
                    var n = parseInt(m[1], 10);
                    if (n > best) best = n;
                }
            }
        } catch (eLP) {}
        return best;
    }

    function findPresentationFolder(project) {
        try {
            if (!project) return null;
            var projFolder = null;
            var cur = origFile.parent;
            for (var up = 0; up < 15 && cur; up++) {
                var nm = decodeURI(cur.name);
                if (nm.indexOf(project) === 0 && !/^\d/.test(nm.substr(project.length))) {
                    projFolder = cur;
                    break;
                }
                cur = cur.parent;
            }
            if (!projFolder) return null;

            // collect candidate folders: the file's own folder + everything
            // under the project folder (breadth-first, 3 levels), skipping junk
            var all = [];
            var seen = {};
            var addFolder = function (f, depth) {
                var key = f.fsName;
                if (seen[key]) return;
                seen[key] = true;
                all.push({ f: f, depth: depth });
            };
            addFolder(origFile.parent, 0);
            var queue = [{ f: projFolder, depth: 0 }];
            addFolder(projFolder, 0);
            while (queue.length > 0) {
                var node = queue.shift();
                if (node.depth >= 3) continue;
                var subs = node.f.getFiles(function (x) { return x instanceof Folder; });
                for (var b = 0; b < subs.length; b++) {
                    if (SKIP_FOLDER_RX.test(decodeURI(subs[b].name))) continue;
                    addFolder(subs[b], node.depth + 1);
                    queue.push({ f: subs[b], depth: node.depth + 1 });
                }
            }

            // 1) folder with the highest existing presentation version
            var bestF = null, bestN = 0;
            for (var c = 0; c < all.length; c++) {
                var n = lastPresVersionIn(all[c].f, project);
                if (n > bestN) { bestN = n; bestF = all[c].f; }
            }
            if (bestF) return { folder: bestF, version: bestN };

            // 2) shallowest folder with "presentation" in its name
            for (var d = 0; d < all.length; d++) {
                if (decodeURI(all[d].f.name).toLowerCase().indexOf("presentation") !== -1) {
                    return { folder: all[d].f, version: 0 };
                }
            }
        } catch (eFind) {}
        return null;
    }

    // Short display of a folder: from the project folder onward, e.g.
    // "125711_JB #7413_ Partial Truck Wrap\Final Presentation Files".
    // If the project folder isn't in the path, the last two folders are shown.
    function shortPath(folder, project) {
        try {
            var parts = [];
            var cur = folder;
            for (var i = 0; i < 20 && cur; i++) {
                var nm = decodeURI(cur.name);
                if (nm === "") break;
                parts.unshift(nm);
                if (project && nm.indexOf(project) === 0 && !/^\d/.test(nm.substr(project.length))) {
                    return parts.join("\\");
                }
                cur = cur.parent;
            }
            var fallback = decodeURI(folder.name);
            if (folder.parent && decodeURI(folder.parent.name) !== "") {
                fallback = decodeURI(folder.parent.name) + "\\" + fallback;
            }
            return fallback;
        } catch (eSP) {
            return folder.fsName;
        }
    }

    // ---------------- UI ----------------
    // Dark grey window (white text, green accents, green Run button). One switch: set STYLED_UI to false
    // to get the plain system look back (use this if the labels are hard to read on your computer).
    var STYLED_UI = true;
    var TSP_BG = [43 / 255, 43 / 255, 43 / 255, 1];   // window background: dark grey (#2B2B2B)
    var TSP_GREEN = [34 / 255, 164 / 255, 56 / 255, 1];
    var TSP_GREEN_HI = [52 / 255, 184 / 255, 76 / 255, 1];
    var TSP_GREEN_LO = [24 / 255, 128 / 255, 42 / 255, 1];
    // White text on every label, check box, radio button and text field; green panel titles
    // and green status notes (no blue letters).
    function paintBlue(ctl) {
        try {
            var g = ctl.graphics;
            if (ctl.type === "statictext" || ctl.type === "checkbox" || ctl.type === "radiobutton" ||
                ctl.type === "panel" || ctl.type === "edittext" || ctl.type === "listbox") {
                var penCol = [1, 1, 1, 1];
                if (ctl.type === "panel") penCol = TSP_GREEN_HI;       // panel titles: green
                else if (ctl.isNote) penCol = TSP_GREEN_HI;            // the small status notes: green
                g.foregroundColor = g.newPen(g.PenType.SOLID_COLOR, penCol, 1);
            }
        } catch (ePb) {}
        try {
            if (ctl.children) { for (var pi = 0; pi < ctl.children.length; pi++) paintBlue(ctl.children[pi]); }
        } catch (ePc) {}
    }
    var TITLE_PNG = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\xde\x00\x00\x00\x2b\x08\x06\x00\x00\x00\x17\x38\x36\x1d\x00\x00\x09\x54\x49\x44\x41\x54\x78\xda\xed\x9a\x6b\x48\x93\xef\x1b\xc7\xef\x1d\xd4\xe5\x3c\x6c\x41\x2b\xd4\x4a\xb2\xa8\x1c\xce\x54\xa8\x55\xb3\x92\xf0\xd0\xc0\xa8\x48\x74\x38\x02\x5f\x24\x99\xab\xac\xf6\x2a\x22\x4c\xf1\x45\x05\x33\x35\x28\x8b\xb4\xc3\x9b\xa8\xa4\x59\x61\x21\x51\x23\x3c\xbc\xa8\x96\xab\x11\x32\x47\x46\x65\xce\x59\xb3\xe5\xe6\xce\xdb\xef\xd5\xfd\xe7\x49\x76\x7a\x9e\x3d\xd6\x8f\xdf\xff\xfa\xbc\xd2\x3d\xd7\x73\xdf\xd7\x75\xdd\xcf\xf7\x3e\x23\x04\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xf0\x2f\xa1\xb8\xb8\xb8\xb8\xb7\xb7\xb7\xd7\x6c\x36\x9b\xdd\x6e\xb7\xdb\x6c\x36\x9b\x9f\x3f\x7f\xfe\xbc\xa1\xa1\xa1\x21\x39\x39\x39\x19\xdb\x95\x95\x95\x95\x05\x48\xf0\xf5\xeb\xd7\xaf\xe1\xea\x3d\x7c\xf8\xf0\x61\x6c\x6b\xb5\x5a\xad\x49\x49\x49\x49\xe1\xec\x25\x12\x89\x04\xdb\xdb\xed\x76\x7b\x76\x76\x76\x76\x30\x3b\xb9\x5c\x2e\xc7\x76\x7a\xbd\x5e\x1f\xec\x7d\x22\x5e\xaf\xd7\x3b\x35\x35\x35\xa5\xd1\x68\x34\x4a\xa5\x52\x99\x9a\x9a\x9a\x4a\x26\x7f\x64\xe2\x08\xe5\x43\x20\x10\x08\xf8\x7c\x3e\xdf\xf4\xf4\xf4\x74\x7f\x7f\x7f\x7f\x75\x75\x75\x35\x83\xc1\x60\x44\xf3\x2e\x19\xff\x97\x2d\x5b\xb6\x8c\xf8\xee\xea\xd5\xab\x57\xe3\x67\x0a\x85\x42\x41\xa6\x7d\x2f\x5e\xbc\x78\x31\x9a\xb8\xe6\x63\x34\x1a\x8d\x91\x72\x1a\xae\x3c\xab\xd5\x6a\x1d\x1a\x1a\x1a\x52\x28\x14\x8a\xf8\xf8\xf8\x78\xba\x73\x44\x26\x16\x9b\xcd\x66\xa3\x24\xba\xb3\x67\xcf\x9e\x0d\x57\xb0\xc5\x62\xb1\xc8\x64\x32\xd9\x42\x08\x4f\xaf\xd7\xeb\x89\xf6\x87\x0e\x1d\x3a\x44\xa6\x31\xf4\x7a\xbd\x3e\x31\x31\x31\x31\x56\xe1\xcd\x67\x66\x66\x66\xa6\xb2\xb2\xb2\x32\xda\x1c\x92\x89\x83\x4c\xa3\xf6\xf4\xf4\xf4\xb0\x58\x2c\x16\x9d\xfe\xff\x17\x84\x47\x64\x78\x78\x78\x98\x38\x38\xd0\x91\xa3\x85\x14\x1e\x13\x21\x84\xc4\x62\xb1\xf8\xcc\x99\x33\x67\xc2\x19\xf2\xf9\x7c\x7e\x61\x61\x61\x21\xdd\xa3\x6c\x51\x51\x51\x91\x50\x28\x14\x12\x7f\xab\xaf\xaf\xaf\x27\x53\x86\x50\x28\x14\x76\x74\x74\x74\xd0\xed\x1b\x8f\xc7\xe3\xdd\xb9\x73\xe7\x4e\x5d\x5d\x5d\xdd\x9f\x88\x23\x14\xfb\xf6\xed\xdb\x77\xec\xd8\xb1\x63\x0b\xe9\x7f\x2c\x7c\xfe\xfc\xf9\xf3\xdf\x9e\xad\x89\xc5\x62\x71\x7b\x7b\x7b\xfb\xbf\x35\x47\x41\x51\xa9\x54\x2a\xac\xdc\xb1\xb1\xb1\x31\xa1\x50\x28\x4c\x48\x48\x48\x58\xb3\x66\xcd\x9a\x53\xa7\x4e\x9d\x9a\x9a\x9a\x9a\x32\x1a\x8d\x46\x2e\x97\xcb\x0d\x55\xc6\xc8\xc8\xc8\x08\x2e\x43\xa1\x50\x28\xa2\xad\xfb\xfe\xfd\xfb\xf7\x83\xf5\x20\xdb\xb7\x6f\xdf\x4e\xb6\x17\x94\xcb\xe5\x72\x2a\x23\x1e\xfe\x9d\xc5\x62\xb1\x56\xac\x58\xb1\xe2\xc4\x89\x13\x27\x7e\xfe\xfc\xf9\x93\x38\x3d\xc9\xcb\xcb\xcb\xa3\x33\x8e\x50\x3e\x20\x84\xd0\xa2\x45\x8b\x16\x6d\xdb\xb6\x6d\xdb\xd8\xd8\xd8\x18\x7e\xfe\xe1\xc3\x87\x0f\x74\xfa\x1f\x6e\xc4\x0b\xc7\xf2\xe5\xcb\x97\x4f\x4e\x4e\x4e\xe2\xf7\xd4\x6a\xb5\x9a\xc9\x64\x32\x83\xf9\xe6\xf5\x7a\xbd\xb1\x7e\x9b\xa1\x62\x65\xb3\xd9\xec\xdc\xdc\xdc\x5c\x8d\x46\xa3\x21\xd6\xb7\x64\xc9\x92\x25\x74\xe5\x28\x5c\x1b\xd1\xc2\xad\x5b\xb7\x6e\xe1\xc2\xbb\xbb\xbb\xbb\x83\xf5\x0a\xeb\xd6\xad\x5b\x17\xae\x0c\x2a\xc2\xcb\xc8\xc8\xc8\xf0\x78\x3c\x9e\x40\x20\x10\xf0\xfb\xfd\xfe\x81\x81\x81\x01\x5c\xc6\xbd\x7b\xf7\xee\x91\x15\xde\xec\xec\xec\xec\xda\xb5\x6b\xd7\x52\x15\x1e\x91\x82\x82\x82\x02\xec\x5b\x20\x10\x08\x3c\x7c\xf8\xf0\x21\x9d\x71\x44\xe3\x83\x4c\x26\x93\x11\x3f\x0c\xbc\xd6\xa3\xc3\x7f\x2a\xc2\x4b\x4a\x4a\x4a\xd2\xe9\x74\x3a\xfc\x8e\x56\xab\xd5\xce\xef\x8c\xff\x94\xf0\x30\x02\x81\x40\xe0\xf7\xfb\xfd\xf8\x79\x79\x79\x79\x39\x5d\x39\xa2\x2a\xbc\x1d\x3b\x76\xec\xe8\xeb\xeb\xeb\x33\x99\x4c\x26\x87\xc3\xe1\x78\xff\xfe\xfd\xfb\xe6\xe6\xe6\x66\x81\x40\x20\xf8\xcd\xb0\xa9\xa9\xa9\x09\x17\xee\x76\xbb\xdd\x2d\x2d\x2d\x2d\xc4\x0f\x38\x1a\xa8\x08\xaf\xb9\xb9\xb9\x19\xbf\xd3\xdf\xdf\xdf\xbf\x75\xeb\xd6\xad\xf8\x7f\x8f\xc7\xe3\x49\x4f\x4f\x4f\x8f\xd4\x18\x6e\xb7\xdb\x3d\x3d\x3d\x3d\x8d\xff\xd7\xe9\x74\x3a\x0e\x87\xc3\x89\x55\x78\x08\x21\x74\xe1\xc2\x85\x0b\xc4\x7a\x52\x52\x52\x52\xe8\x8a\x83\xac\xf0\xe6\xe6\xe6\xe6\xe8\xf4\x9f\xac\xf0\x98\x4c\x26\xf3\xf1\xe3\xc7\x8f\x89\xeb\xf6\x48\x71\xfd\x09\xe1\x21\x84\x90\xd9\x6c\x36\xe3\xe7\x07\x0e\x1c\x38\x40\x57\x8e\xa8\x08\x6f\xf7\xee\xdd\xbb\x7d\x3e\x9f\x2f\xd4\x3e\xc9\x86\x0d\x1b\x36\xfc\xcf\x78\xd5\xaa\x55\xab\xec\x76\xbb\x7d\xbe\xe1\xf8\xf8\xf8\x78\x6b\x6b\x6b\xeb\x96\x2d\x5b\xb6\xd0\x2d\xbc\xf8\xf8\xf8\x78\x93\xc9\x64\xc2\xef\xec\xdd\xbb\x77\x2f\x42\x08\xbd\x7b\xf7\xee\x1d\xfe\xad\xa9\xa9\xa9\x29\x52\x63\xd8\x6c\x36\x5b\x59\x59\x59\x19\xb1\xd7\xeb\xec\xec\xec\xa4\x43\x78\xf9\xf9\xf9\xf9\x44\x3b\xb1\x58\x2c\xa6\x2b\x8e\x70\x3e\x70\x38\x1c\x4e\x61\x61\x61\xa1\xd1\x68\x34\xe2\xe7\x6f\xdf\xbe\x7d\x4b\xa7\xff\x64\x85\xd7\xd6\xd6\xd6\x46\xcc\x79\x7e\x7e\x7e\x7e\x2c\x1b\x12\x26\x93\xc9\x44\x87\xf0\xd2\xd3\xd3\xd3\x89\x6d\x2f\x95\x4a\xa5\x74\xe5\x88\xcc\xe6\x0a\x9b\xcd\x66\x23\x84\xd0\xeb\xd7\xaf\x5f\x87\xb2\xf9\xf1\xe3\xc7\x0f\xbc\xd3\xcd\x44\x08\xa1\x8f\x1f\x3f\x7e\x2c\x29\x29\x29\x19\x19\x19\x19\x21\x3a\x95\x99\x99\x99\xd9\xd0\xd0\xd0\x30\x38\x38\x38\xf8\xe2\xc5\x8b\x17\x69\x69\x69\x69\x74\x4d\x6f\xf7\xef\xdf\xbf\x7f\xe9\xd2\xa5\x4b\x11\x42\x68\x62\x62\x62\xe2\xd1\xa3\x47\x8f\x10\x42\xe8\xf2\xe5\xcb\x97\xb1\xcd\xc1\x83\x07\x0f\xc6\xc5\xc5\xc5\x45\x2a\xeb\xe9\xd3\xa7\x4f\xcf\x9d\x3b\x77\x0e\xff\x5f\x5b\x5b\x5b\x5b\x55\x55\x55\x15\xab\x8f\x93\x93\x93\x93\xc4\xff\x17\x2f\x5e\xbc\x78\xa1\xe2\x20\x36\x90\xc3\xe1\x70\xbc\x7c\xf9\xf2\x65\x56\x56\x56\x16\x7e\x7e\xe9\xd2\xa5\x4b\x0b\xe1\x7f\x34\xd4\xd5\xd5\xd5\x1d\x3d\x7a\xf4\x28\x42\x08\xf9\xfd\x7e\x7f\x75\x75\x75\xb5\x56\xab\xd5\xfe\xcd\xcd\x14\x16\x8b\xc5\x12\x89\x44\xa2\xbb\x77\xef\xde\xc5\x53\x70\xb7\xdb\xed\x1e\x1c\x1c\x1c\xfc\x1b\x39\x22\x4e\xc7\xf1\xdf\x39\x39\x39\x39\x5c\x2e\x97\x5b\x5a\x5a\x5a\xfa\xe4\xc9\x93\x27\x2a\x95\x4a\x15\x74\xf7\x93\xc1\x60\x30\x76\xee\xdc\xb9\xb3\xad\xad\xad\xcd\x60\x30\x18\xe6\x2b\x56\xa7\xd3\xe9\x88\xdb\xda\xb1\x8c\x78\x43\x43\x43\x43\xd8\xbe\xb1\xb1\xb1\x11\xff\x9e\x9c\x9c\x9c\x3c\x3b\x3b\x3b\x8b\x9f\xe1\x23\x8c\x70\x23\x1e\x5e\x6c\x13\xd7\x56\xbf\x7e\xfd\xfa\xd5\xd8\xd8\xd8\x18\xcb\x88\x97\x9b\x9b\x9b\x4b\xb4\xdb\xb4\x69\xd3\x26\xba\xe2\x20\xd3\x9b\x5e\xbb\x76\xed\x1a\xf1\x2c\x8f\x0e\xff\xa3\x1d\xf1\x4a\x4b\x4b\x4b\xbd\x5e\xaf\x17\xdb\x29\x95\x4a\x25\x1d\xdb\xff\x54\x47\xbc\x70\xa8\x54\x2a\x15\x9d\x39\xa2\x32\xe2\x11\x8f\x62\x34\x1a\x8d\x46\x26\x93\xc9\xc8\x9e\x07\xa3\xac\xac\xac\xac\xce\xce\xce\x4e\x62\x05\x45\x45\x45\x45\xb1\x0a\x2f\x2f\x2f\x2f\x2f\xda\x80\x06\x06\x06\x06\xa2\x11\x1e\xde\xe4\xf8\xfe\xfd\xfb\x77\xe2\x9c\x3d\x16\xe1\xb5\xb4\xb4\xb4\x60\x1b\x97\xcb\xe5\x22\x9e\x13\xc5\x1a\x47\x34\x8d\xea\xf1\x78\x3c\x7b\xf6\xec\xd9\x43\x65\xdd\x13\xc9\xff\x68\x84\x27\x14\x0a\x85\x56\xab\xd5\x4a\xec\x00\xc8\x08\x65\x21\xd6\x78\xa1\xe8\xed\xed\xed\x25\x1e\xa2\xd3\x91\x23\xaa\x9b\x2b\x15\x15\x15\x15\x5a\xad\x56\x4b\x2c\x57\xad\x56\xab\x7f\x5b\xdf\x61\x4e\x9f\x3e\x7d\x7a\xe3\xc6\x8d\x1b\x83\x15\xf4\xe5\xcb\x97\x2f\xf3\x17\xaf\xb1\x08\xef\xfa\xf5\xeb\xd7\xc9\x1c\xd0\xce\x77\x38\x94\xf0\x10\x42\x48\x2a\x95\x4a\x89\x73\x7e\xaa\xc2\x13\x89\x44\x22\x97\xcb\xe5\xc2\x36\x0f\x1e\x3c\x78\x40\x67\x1c\xa1\x7c\xc8\xce\xce\xce\x26\xd6\x7b\xf2\xe4\xc9\x93\x54\x84\x17\xc9\xff\x48\xc2\x13\x08\x04\x82\xf1\xf1\xf1\x71\xfc\xfc\xd9\xb3\x67\xcf\x70\xaf\xfe\x6f\x10\x9e\xcf\xe7\xf3\x99\xcd\x66\x73\x5f\x5f\x5f\x5f\x45\x45\x45\xc5\x42\xe4\x88\x8a\xf0\x78\x3c\x1e\x0f\x8f\x70\x69\x69\x69\x69\x35\x35\x35\x35\x6f\xde\xbc\x79\x83\x37\xc8\x36\x6f\xde\xbc\x19\x11\xd7\x20\x38\x51\x5d\x5d\x5d\x5d\x12\x89\x44\x92\x92\x92\x92\xc2\xe5\x72\xb9\x72\xb9\x5c\x4e\x9c\x6a\x14\x17\x17\x17\xc7\x22\x3c\x3e\x9f\xcf\x9f\x9b\x9b\x9b\x23\xf3\xc1\xce\xef\x69\xc3\x09\x0f\x21\x84\xce\x9f\x3f\x7f\x9e\x8a\xf0\x98\x4c\x26\x33\x23\x23\x23\xe3\xc8\x91\x23\x47\x2c\x16\x8b\x85\x38\xf2\x88\x44\x22\x11\x9d\x71\x84\x6b\x54\xe2\x2e\xa9\xc3\xe1\x70\xcc\xdf\x61\xa6\xc3\xff\x70\xc2\xe3\x70\x38\x1c\xe2\x14\x7a\x74\x74\x74\x94\xc7\xe3\xf1\xc8\x0a\xe5\x4f\xed\x6a\x92\x79\x8f\x4c\x8e\xa8\xd4\x7d\xf5\xea\xd5\xab\xdf\xbe\x7d\xfb\x76\xfc\xf8\xf1\xe3\x99\x99\x99\x99\x71\x71\x71\x71\xb5\xb5\xb5\xb5\xb8\x8c\xdb\xb7\x6f\xdf\x46\x08\x21\x94\x9a\x9a\x9a\x4a\x74\x20\x1c\x13\x13\x13\x13\x09\x09\x09\x09\xb1\x08\x4f\xa9\x54\x2a\x89\x5b\xd2\xa1\x36\x1d\xea\xeb\xeb\xeb\x89\xf7\x31\xf9\x7c\x3e\x3f\x5a\xe1\xb1\xd9\x6c\x36\xf1\xc3\xa1\x7a\x65\x2c\xdc\xd5\xaf\x58\xe3\x88\xb4\xab\x49\x5c\x63\x0f\x0f\x0f\x0f\x53\xb9\x32\x16\xce\xff\x70\xc2\x6b\x6d\x6d\x6d\xfd\x13\x57\xc6\xa2\xb9\x66\x45\x97\xf0\xa8\xe4\x88\x6c\xdd\x05\x05\x05\x05\xa1\x8e\x12\x30\x78\xd3\x8d\x69\xb5\x5a\xad\x12\x89\x44\xf2\xea\xd5\xab\x57\xe1\x0a\xb5\xdb\xed\x76\xb9\x5c\x2e\x77\xb9\x5c\x2e\xaa\xbd\x17\x83\xc1\x60\x10\xaf\xe6\x74\x74\x74\x74\x78\x3c\x1e\x4f\x30\xdb\xee\xee\xee\x6e\x8b\xc5\x62\x41\x08\xa1\xc4\xc4\xc4\xc4\x9a\x9a\x9a\x9a\x68\xeb\xf1\x7a\xbd\xde\xca\xca\xca\x4a\xfc\x3e\x55\x66\x66\x66\x66\xaa\xaa\xaa\xaa\xae\x5c\xb9\x72\xe5\x4f\xc6\xe1\x74\x3a\x9d\xc4\x0f\x41\x2c\x16\x8b\x83\x4d\x39\xa9\xfa\x1f\xcd\xed\x14\xf4\x7f\x02\xd5\x1c\x05\xc3\x60\x30\x18\xd4\x6a\xb5\x3a\x5c\xbb\xe2\xa3\xae\xdf\xd8\xb5\x6b\xd7\xae\xae\xae\xae\x2e\x83\xc1\x60\xb0\xd9\x6c\x36\xa7\xd3\xe9\x1c\x1d\x1d\x1d\x6d\x6f\x6f\x6f\x5f\xb9\x72\xe5\xca\x58\xcf\xf1\xa4\x52\xa9\x94\xd8\xdb\x45\x9a\xbe\x10\x17\xbe\x46\xa3\xd1\x18\xec\xe6\x46\xb8\x5e\xb3\xbc\xbc\xbc\x1c\xaf\xf7\xa2\x19\xf1\xf0\xba\x21\xd2\xcd\x75\x3a\xe2\x88\xa6\x37\xbd\x71\xe3\xc6\x0d\xfc\xdc\xe9\x74\x3a\xd7\xaf\x5f\xbf\x9e\x0e\xff\x23\x8d\x78\xa1\xae\xbf\xfd\x17\x46\x3c\x32\x39\xa2\x5a\x77\x49\x49\x49\x49\x4f\x4f\x4f\x8f\xc9\x64\x32\xb9\x5c\x2e\xd7\xa7\x4f\x9f\x3e\xdd\xbc\x79\xf3\x66\x4e\x4e\x4e\x0e\xb6\xf9\x07\xa5\xa1\xa5\xe0\xe8\xf3\x8c\xb2\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82";
    function addTitleImage(parent) {
        try {
            var tf = new File(Folder.temp.fsName + "/signpack_title_standardize.png");
            tf.encoding = "BINARY";
            if (tf.open("w")) { tf.write(TITLE_PNG); tf.close(); }
            if (!tf.exists || tf.length < 50) return null;
            return parent.add("image", undefined, tf);
        } catch (eTi) { return null; }
    }
    // Green rounded main button. The text is part of the pictures (normal, hover, click, disabled), so it
    // is always centered; the window font and DPI cannot move it. If anything fails, the button stays native.
    function btnImage(key, data) {
        try {
            var f = new File(Folder.temp.fsName + "/signpack_btn_" + key + ".png");
            f.encoding = "BINARY";
            if (f.open("w")) { f.write(data); f.close(); }
            if (f.exists && f.length > 50) return ScriptUI.newImage(f);
        } catch (eBi) {}
        return null;
    }
    function styleRunButton(btn, def) {
        if (!STYLED_UI) return;
        try {
            var imN = btnImage(def.key + "_n", def.n), imH = btnImage(def.key + "_h", def.h2);
            var imP = btnImage(def.key + "_p", def.p), imD = btnImage(def.key + "_d", def.d);
            if (!imN) return;
            btn.preferredSize = [def.w, def.h];
            btn.onDraw = function (stt) {
                var gb = this.graphics;
                var bw = this.size.width, bh = this.size.height;
                gb.newPath(); gb.rectPath(0, 0, bw, bh);
                gb.fillPath(gb.newBrush(gb.BrushType.SOLID_COLOR, TSP_BG));
                var im = imN;
                if (!this.enabled) { if (imD) im = imD; }
                else { try { if (stt && stt.leftButtonPressed && imP) im = imP; else if (stt && stt.mouseOver && imH) im = imH; } catch (eSt) {} }
                gb.drawImage(im, 0, 0, bw, bh);
            };
            var redrawBtn = function () { try { btn.notify("onDraw"); } catch (eNd) {} };
            btn.addEventListener("mouseover", redrawBtn);
            btn.addEventListener("mouseout", redrawBtn);
            btn.addEventListener("mousedown", redrawBtn);
            btn.addEventListener("mouseup", redrawBtn);
        } catch (eGb) {}
    }
    var BTN_RUN = { key: "run", w: 58, h: 28, n: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x3a\x00\x00\x00\x1c\x08\x06\x00\x00\x00\x30\x4e\xac\x03\x00\x00\x06\xc5\x49\x44\x41\x54\x78\xda\xe5\x99\x7f\x8c\x54\x57\x15\xc7\x3f\xe7\xde\x37\x6f\x76\x67\x77\x67\x59\x24\x60\x84\x6a\x77\x29\x12\x57\xa0\x54\x76\x51\x30\x26\xb6\x31\xa5\x4a\x9a\x98\x12\x28\x0d\x45\x2d\x6d\x8a\x31\x4a\x63\x13\x25\xa6\x26\x64\x63\xff\xf0\xc7\x7f\x0d\xd1\xa4\x2a\x1a\x15\xdb\x2e\x89\x36\x36\x46\x4b\x9a\x28\xad\xa5\xed\xee\x52\x88\x54\x6a\x0b\xec\xd2\x50\x21\x2c\xed\xfe\x9e\x59\x66\xde\xbb\xe7\xf8\xc7\xee\x4c\x16\x68\xff\x98\xa5\x69\x41\x4f\x32\x99\xc9\xdc\x97\x37\xf7\xf3\xce\x3d\xdf\xfb\x3d\x77\x84\x77\x8a\x5d\x38\xba\x50\x00\xba\x37\xfa\x56\xf9\xcf\x5a\x49\x75\xb3\x40\xa7\x06\x96\x8a\x93\x3c\x6a\x06\x08\xef\x6f\x18\x4e\xc4\xd4\xc6\x9c\xe7\x35\x83\x5e\x8b\xdc\xe3\x03\xb6\xf0\x20\x9b\xf6\x85\xcb\xe6\x3e\x23\x2e\x9f\x68\xf7\x46\xcf\xa6\x7d\x81\xfb\x57\x65\xda\x6e\xce\x6e\x41\x74\x87\xa8\xac\x94\xd8\x89\xa9\x61\xa9\x81\x1a\x1f\x68\x38\x41\x22\x41\x9c\x60\x65\x35\x73\x76\x04\x73\x8f\xf4\xff\xad\xb4\x97\x47\x0f\x25\x55\x86\x77\x05\x9d\xbe\xa0\xf5\xd1\xce\x8f\x4b\xde\xff\xca\xe7\x32\x6b\xf5\x42\xc0\x4a\x0a\x58\x40\x44\x00\xc7\xd5\x11\x8a\x99\x81\x78\xc9\x3a\x5c\x9d\x27\x14\x93\x83\x36\x16\xee\x19\xb8\xbf\xf7\xf5\x4b\x61\xe5\x32\xc8\x3d\x1d\x9d\x2e\x17\xff\x55\x32\x32\x37\x14\xd3\x54\x44\xdc\x55\x04\xf7\xae\xd0\x66\xa6\x3e\x17\x45\x96\xd8\x90\x16\xcb\xb7\x0d\x6c\xeb\xeb\x9d\x09\x3b\x05\x6a\xbb\x1c\xd2\xa5\xad\x7b\x3a\x3a\x5d\x43\xe6\x69\x90\x16\x2d\x87\x54\x44\x22\xae\xa1\x30\xb3\xd4\xc5\x3e\x02\x1b\xd6\x42\xb2\x6e\x60\x5b\x5f\x6f\x85\x4d\x2a\x1f\x96\xec\xed\x68\x53\x9f\xe9\x43\xa4\xc5\x4a\x21\xe0\xc4\x73\x2d\x86\x5a\x90\xac\xf7\x98\x0d\xbb\x90\x74\x1c\xdf\xd2\xd7\x8f\xed\x72\x0e\xa0\xbd\xbb\x3d\x0e\xea\x1f\x93\x8c\x6b\xd1\x6b\x19\x72\x4a\xa8\xbc\x96\x42\x90\x8c\x6b\x09\xea\x1f\x6b\xef\x6e\x8f\x01\x1c\xd2\xa5\xa5\x72\xf3\x9d\xbe\x39\x5e\x1d\x0a\x69\x2a\xb3\x80\x74\xe2\x88\x9c\xbf\xe8\xe5\xc5\x4f\x6b\xd7\xfb\x1f\xe2\xc4\x87\x42\x9a\xfa\xe6\x78\x75\xa9\xdc\x7c\x27\xd2\xa5\xd2\xde\xdd\x1e\x4f\x96\x9a\x0e\xf9\x7a\xdf\xae\x93\x0a\x52\x9b\xf0\x08\xc2\x44\x5a\xa0\x1c\x12\x04\xb0\x19\xf0\xb9\xa8\x8e\xac\xcf\xa2\xa6\x1f\x40\xc1\xa2\xae\xde\x11\x26\xc3\xb1\xfa\xec\xf8\xaa\x68\xa2\x9c\xef\xcc\x64\xa4\x5d\x27\x55\x90\xda\x0c\x80\x13\xe1\x42\x28\xb3\xa1\x75\x3d\x4b\x5b\x16\x13\x34\x80\x08\x66\xc6\xb9\xe2\x20\xcf\x9e\x7d\x89\x37\xc6\xdf\xa4\x21\x53\x8f\x01\x5e\x1c\x6a\x56\x05\x8f\x9c\x07\x83\x74\x7a\xe7\xaa\x8c\x57\xee\x6d\x06\xc1\xc2\x2c\xd3\x8a\xd3\x49\x35\x97\x71\xed\x13\xe5\x7c\x67\xe4\x91\xad\x12\x39\x67\x49\x1a\xa0\xb6\x65\x2b\x08\xa5\x50\x62\x43\xdb\x7a\x6e\x59\xf4\xd9\xcb\xc6\x87\x4b\x23\x6c\x3f\xb0\x93\xe7\xcf\xf6\x12\x39\xcf\x50\x52\xa0\xce\x67\xc9\x65\xea\x51\x55\xde\x9a\x1c\x06\x81\x39\x71\x9e\x52\x28\x53\x48\x8a\xd4\x47\x59\x40\x98\x4c\x2f\x10\x89\xa7\x29\x6e\xbc\x68\xa5\xd4\x98\x56\x95\xc8\x7b\x9f\xea\xd6\x08\xb3\x0e\x53\x63\xb6\x05\x25\x08\xa3\xe5\x31\x52\x0d\xec\x7e\x65\x0f\x07\xce\xbc\x48\x2e\xaa\xe3\xcb\xad\xb7\xb1\x71\xf1\xed\x7c\xef\x53\xdf\xe2\xd6\xa7\x36\xb3\x7a\xc1\xa7\xb9\x79\xe1\x5a\x5e\x3e\x7f\x94\xfd\xa7\x0f\x30\xb7\xae\x85\x6f\x2e\xbf\x87\x60\xca\x4f\x5f\xf9\x35\xcb\x5a\x96\xf2\xc5\x8f\xdd\x42\xcf\xb9\xc3\x9c\xbf\xf0\x36\xeb\xae\xfb\x3c\xa7\x27\xce\xf0\xa7\x53\xfb\x09\xa6\x78\xf1\x58\xad\xb8\x22\x62\x6a\x60\xd6\x11\x21\x2c\xb1\xd4\xb8\x12\xdf\x5a\x11\xa3\x43\x83\x47\x79\xb2\xff\xcf\x78\x97\xe1\xdf\x23\x27\xd8\xd0\xb6\x9e\x85\x0d\x1f\x26\xe3\x32\xac\x9c\xf7\x49\x76\x2c\xbf\x97\xbd\xc7\xff\xc0\x1f\xfb\xff\xc2\xa2\xa6\x8f\xf0\xe0\x8d\xdb\x01\xd8\x7d\x74\x0f\x2b\xe6\x7d\x82\x1d\xcb\xef\x65\xf0\x86\xb7\x99\x5f\xff\xa1\xea\xbd\x6f\x9a\xb7\x8c\x9d\x2f\x3e\x4c\x63\xa6\x71\xca\x08\xd5\x88\x6a\xa9\x81\xb0\x24\x12\x21\x3f\xed\x5d\x67\x0d\x5a\x29\xed\x8e\xf9\x2b\x98\x48\x27\x68\xcc\x34\x70\x47\xdb\x97\x70\xe2\x38\x53\x38\xc7\x78\x32\x41\xa2\x09\xa9\x06\x0a\x49\x11\x99\xae\xe3\x89\xb4\x48\xa2\x09\x00\xa5\x50\x26\xd5\x80\x17\xc7\xd7\x0f\xec\x64\x71\xf3\xf5\x3c\x78\xe3\x76\x6e\xbf\xfe\x56\x7e\x72\xe4\x67\x8c\x27\x05\xa2\xda\xb3\x2a\xa8\x21\x42\xfe\x3d\x71\x3e\x95\x55\xff\xc0\x8a\xfb\x78\x60\xc5\x7d\xd5\xef\xcf\x15\xcf\xf3\xc3\xc3\xbb\x51\xd3\x6a\xd6\xbd\x78\x9c\x08\x22\x32\x35\x71\xd1\x8a\xab\x21\x72\x9e\x67\xde\x7c\x8e\x5f\xbc\xfa\x7b\x6e\x68\x6e\x65\x7b\xfb\xdd\xd4\x45\x59\xb2\x3e\x66\xac\x3c\x5e\xab\x84\x5c\xbc\xea\xcc\x18\xc3\x09\xb3\xae\xf7\xe9\x49\x02\x3c\x75\x6a\xff\xd4\xd3\x2f\x4f\x65\xf0\x3b\x2f\xfc\x80\x67\x4e\x3f\x4b\x53\xdc\x84\x9a\x61\x18\xa9\x05\x26\xd3\x12\xa5\xb4\xf4\x8e\x22\x1f\x4c\x69\xc9\xce\x21\x17\xd5\x93\x5a\x8a\x20\xb5\xd7\xe6\xc5\x6d\x1d\x66\x8c\x39\x8c\xe3\x12\x5d\x19\x68\x6a\x81\x54\x03\x4f\x0e\x3c\xcd\x77\x9f\x7b\x88\x47\x8e\xfe\x92\x8c\xcb\xf0\x8d\x65\x5f\x25\x9f\x6d\xa2\x1c\x4a\xa8\x29\x82\xb0\x7a\xfe\x4a\xda\xf2\x1f\xe5\x0b\x8b\x3e\x47\xe4\x3c\x93\xe9\x85\xea\x52\x4e\x35\x60\xa6\x04\x0b\xa8\x29\x6a\x4a\xaa\xe1\x8a\x76\x53\x89\x04\x8c\xe3\x0e\x91\x3e\x71\xc2\x6c\x2a\x7d\xea\xe9\x18\xf9\x4c\x23\x91\xf3\xcc\xad\x6b\x61\x41\xd3\x75\xfc\xfc\xd5\xbd\xf4\x0e\x1e\xe6\x33\x0b\x56\xf1\xf0\xea\x9d\x80\xf0\xf2\xf9\x7f\x62\x66\xdc\x34\x6f\x19\xff\xda\xfc\x77\x7e\xb4\xe6\x21\xbc\x78\xe6\xd7\xcf\xc3\x80\xac\x8f\x89\x9c\xa7\x31\xd3\x80\x99\x21\x08\x73\xb3\x2d\x34\x66\x72\xb3\x77\x58\x66\x26\x4e\x40\xa4\xcf\xe7\xef\x58\x34\xec\xe0\x6b\x28\xae\x56\xc3\x30\xf5\xfb\x82\x9a\x72\x72\xec\x0d\x9e\x3f\xdb\xc3\x50\x69\x14\xc5\x38\xf4\xd6\x51\x46\x4a\xa3\x8c\x27\x13\x0c\x8c\x9f\xe6\xe4\xe8\x29\x5e\x1b\x3d\x41\x2e\xca\xf1\xfa\x48\x3f\xdf\xef\xf9\x31\x27\xc6\x4e\xf1\xd2\xe0\x61\xfa\x06\x8f\xa0\x18\x43\xa5\x11\xfe\x71\xb6\x87\x53\x13\xa7\x89\x9c\xa7\x90\x4e\xd2\x33\x78\x98\x9e\xc1\x23\xa4\x1a\x70\xe2\x6a\x56\x0f\x04\x4b\xd5\xbe\xfd\x9e\x5a\xc0\x86\x4c\x8e\xac\x8b\x41\xa0\x1c\x12\x26\x92\x02\x02\x34\xc7\x79\xbc\x73\x8c\x27\x45\x30\x43\x99\xda\x17\x13\x4d\x31\x33\xe6\x64\xf3\x94\x35\xa1\x90\x14\xc9\xfa\x98\x86\x4c\x0e\x35\x65\xac\x3c\x8e\x19\x34\xc7\x4d\xb5\x67\xf5\x12\x0b\x28\x00\x8b\x7f\xb7\x66\xab\xcb\x47\xbf\x49\x47\xca\xa9\xb8\xda\x7b\x50\x27\x0e\x27\x42\x30\xad\x56\x40\xc5\xd2\xcd\xb4\x71\x95\x8c\x54\x9c\x4e\xc5\x73\x5e\x6a\x01\x2b\x16\x71\xaa\x31\x60\x56\x75\x6a\x6a\x69\x34\x27\x8e\x74\x2c\xfd\xca\xc9\xbb\x5f\xf8\xad\xc3\x76\xb9\x6c\x3c\xfa\x44\x18\x2d\xf7\xf8\x86\x28\x32\xad\xdd\x5c\x56\x44\x63\x66\x99\x57\xc4\x65\xa6\x57\xad\x08\x4c\xa8\xbe\x07\xd2\xe9\xf1\xca\xf5\x33\x1b\x80\x30\x2d\x72\xb3\x80\x0c\xbe\x21\x8a\xc2\x68\xb9\x27\x1b\x8f\x3e\x51\xed\x47\x8f\x6d\x3a\x56\xf6\x2e\xdc\x65\x89\x0e\xbb\xac\xf7\xa8\x05\xae\xd5\x50\x0b\x2e\xeb\xbd\x25\x3a\xec\x5d\xb8\xeb\xd8\xa6\x63\xe5\x6a\x3f\x8a\xed\x72\xc7\xb7\xf4\xf5\x6b\x31\x59\x07\x36\x2c\x59\xef\xcd\x2c\xbd\xd6\x18\xcd\x2c\x95\xac\xf7\x60\xc3\x5a\x4c\xd6\x55\x4e\x17\x90\x2e\x9d\x2e\x9a\x2e\xa5\x7b\xa3\x1f\xd8\xd6\xd7\xab\x85\x64\x1d\xc6\x90\xcf\x45\xd1\x34\xac\x5e\x13\x79\x34\x4b\x7d\x2e\x8a\x30\x86\xaa\xe7\x45\xdd\x1b\x3d\xd2\xa5\x5c\x74\xba\xb7\x69\x5f\xa8\xc2\x8e\x25\x6b\x34\x09\x07\xa3\xe6\x38\x92\xd8\x39\x0c\x30\x0b\x57\x19\xb4\x62\x16\x30\x90\xd8\xb9\xa8\x39\x8e\x34\x09\x07\x75\x2c\x59\x73\xe9\x09\xe0\xff\xf1\x01\xf6\xff\xf0\x5f\x12\xff\x05\xb2\xd2\xf0\x0d\x73\xa2\xf5\x12\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", h2: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x3a\x00\x00\x00\x1c\x08\x06\x00\x00\x00\x30\x4e\xac\x03\x00\x00\x06\xaa\x49\x44\x41\x54\x78\xda\xe5\x99\x6f\x6c\x55\x77\x19\xc7\x3f\xcf\xef\x77\xce\xb9\xbd\x6d\x29\x94\x6c\x08\x0c\x94\xd1\x31\x48\x57\x27\x86\xd6\x45\xb2\x65\x9b\x73\x81\x69\xc3\x0b\xf4\x4e\x41\x59\x24\xcb\xa6\x8b\x89\x7f\x92\xbd\xd9\x1b\x9b\x1a\x8d\xf1\x9d\x2e\xee\x85\x71\x71\x99\xd3\xe0\xb8\xd3\x25\x38\x84\x25\xc6\x65\x9b\x19\x6c\x14\x5a\x6b\x29\x19\xac\x0c\xa8\x96\x0c\x69\x6f\x57\x7a\xff\xf4\x9c\xf3\xfb\x3d\xbe\xb8\xbd\xcd\x60\x68\xd2\x96\x08\xe8\xf3\xe6\x9e\x73\xcf\xbf\xdf\xf7\x79\xce\xf3\x7c\xbf\xcf\x73\x84\xcb\x59\x57\x97\xa1\xbb\xdb\x03\xe4\x76\xe7\xec\xe9\x25\xf1\x46\x4d\xfd\x97\x81\x0e\x9f\xea\x5a\x63\xa4\x49\xbd\x2a\x20\xfc\x77\x4d\xc5\x88\x78\xaf\x13\x26\x90\xb7\x81\x43\x12\x98\xdf\x7e\xec\x5c\xf4\x46\xfe\xc1\xbc\xbb\x74\xed\x1f\xb4\x0f\x2d\x34\xb7\x3b\x67\xf3\x0f\xe6\xdd\x86\x9f\x6f\x08\x4d\xcb\xf2\xaf\x20\x7c\x0b\xcf\x7a\x13\x59\x51\xa7\xf8\xd4\x83\x57\xae\xaa\x19\xc1\x04\x06\xb1\x82\x8f\x9d\x62\xe8\x43\x79\xd2\x0f\x8d\xfc\xe6\xf0\xd7\x0f\x27\x35\x0c\xff\x16\x68\x4e\x73\x36\x2f\x79\x77\xfb\xef\x1f\xb8\x35\xd3\x14\x3c\x63\x1b\xc2\x8d\xbe\xe2\xf0\x15\x87\x8a\x3a\x01\x01\x31\x5c\x13\xa6\x5e\x41\x45\xc5\x9a\x3a\x8b\xa9\xb3\xb8\x62\xf2\xc6\xd4\x44\xba\xb3\x7f\xeb\xbe\xe3\x35\x2c\x33\xbe\xb9\x28\x92\x92\x77\xeb\xf7\x6c\xee\xc8\x2c\x0a\x0f\x98\xc8\x6e\x4c\x0a\x71\xea\x2b\xa9\x47\x40\x10\x7b\xed\x80\x04\x10\x23\x88\x45\xc0\x57\x52\x9f\x14\xe2\xd4\x44\x76\x63\x66\x51\x78\x60\xfd\x9e\xcd\x1d\x79\xc9\xbb\xdc\xee\x9c\xbd\x28\xa2\x5d\xda\x65\xba\xa5\xdb\xaf\xdf\xb3\xb9\x23\x6c\x88\x5e\x16\xa1\xd9\x4d\xf9\x54\x84\x80\xeb\xc8\x54\x49\x6d\xc6\x04\xaa\x14\x92\x62\xbc\xa9\x6f\xcb\xfe\x43\x35\x6c\x52\xdb\x68\x7f\xe9\xf3\xab\x25\x6b\x7b\xaa\x20\x9d\x13\x11\xcb\x75\x68\xaa\xea\x6c\xc6\x5a\x55\x0a\x5a\x76\xed\x3d\x9d\x7b\x4f\x76\x69\x97\x31\x00\xad\x03\xb9\x08\x2b\xbb\x4c\x68\xae\x6b\x90\x00\x22\x62\xdd\x94\x73\x26\x34\xcd\x58\xd9\xd5\x3a\x90\x8b\x66\x5e\xdd\xf6\x7d\x9d\x3b\xc2\xe6\xe8\x57\xf1\xd8\x54\x2a\x46\x82\xd9\x17\x41\x83\x5c\x86\x69\xbc\x7a\x14\xbd\x5a\xa5\x2a\x8d\x16\x67\x82\xa4\x10\x3f\xd4\xf3\xc0\x4b\xcf\x49\xeb\x40\x2e\xca\x0e\x97\x0f\xdb\xac\x6d\x75\x65\x87\x08\xb3\x2a\x38\x82\x50\x74\x25\x12\x9f\xd6\x1e\x01\x08\x06\xa1\xce\xd6\x91\xb1\x11\x5e\xfd\xd5\xc8\x57\x6f\xb3\x16\x57\x76\x83\xe5\x95\xd9\x0d\x41\xf6\x74\xa5\xc3\x64\xa4\xd5\x97\x9d\x88\xcc\x4e\x00\x88\x08\xb1\x8b\xe9\x5c\x7e\x1f\xb7\x2c\x58\x85\x53\x87\x20\xa8\x2a\xe7\xa6\x46\x39\x78\xfe\x08\x67\x4a\x67\xa9\xb7\x75\x33\x91\x57\x74\x06\xb8\x9d\xce\x90\xda\x75\xb5\xe3\x35\x07\x82\xe2\xe6\xe8\x24\x11\x8c\x2f\x3b\x35\xa1\xb4\x66\x4f\x57\x3a\x02\x11\x76\x98\xc8\x9a\x34\x4d\x5c\x95\x42\x66\x17\xcd\x29\x1f\xd3\xb9\xfc\xb3\xdc\xb5\xa4\xe3\x43\xc7\xc7\xe3\x09\x1e\xef\xfd\x01\x6f\x8d\xf6\x61\x8d\xa5\x98\x94\xc9\x98\x88\xac\xad\xc3\xe3\x19\x8b\xc7\x11\xa0\x29\x5c\x40\xec\x63\x4a\xae\x42\xc6\x44\x88\x08\x15\x37\x85\x15\x43\x63\xd0\x30\x0f\x19\xa5\xde\x46\x81\xd5\xd8\xed\x08\x54\x7c\xbb\x3a\x53\xa5\xca\xb9\x78\x0e\x61\x22\x9d\xc4\xa9\xe3\xe9\xa1\xe7\x39\x70\xfe\x30\x75\x36\xc3\xe7\x96\xdd\xcb\x96\x15\xf7\xf3\x9d\xb5\x0f\xf3\xc5\xbf\x7c\x83\x3b\x16\xb7\x71\xe7\x8d\x1d\xf4\x8f\x1f\xe3\x95\xf7\x0e\xb0\x38\x5a\xc4\xc3\xab\xbf\x84\xc7\xf3\xcb\x93\x79\xd6\x35\xb5\x70\xdf\xd2\x3b\x39\x32\x36\xc0\xe8\x54\x81\x7b\x3f\xf2\x69\x46\xca\xef\xb1\xff\xec\xab\x78\x55\xac\xc8\xac\xb3\x5d\x40\xd4\x29\x2a\xbe\x3d\x40\x64\x8d\x26\xbe\x1a\xec\x39\x2b\x32\xc1\x8a\xa5\x7f\x7c\x90\x3f\xfc\xe3\x4f\x84\x26\xe4\x9d\x0b\xa7\xe8\xbc\xe9\x3e\x96\x66\x6f\x24\x34\x21\x6d\x0b\xd7\xf2\x48\xcb\x36\x5e\x18\xfe\x23\x7b\x47\xfe\xcc\x4d\x76\x29\x8f\xad\xd9\x01\xc0\xd3\x43\xcf\xd3\xba\xf0\x56\x1e\x69\xd9\xc6\xf9\x15\x05\x6e\xc8\x34\xcf\xdc\xbb\x6d\xd1\x3a\xbe\x3f\xf0\x53\x1a\x83\x7a\x74\xd6\xaf\xb1\x88\x26\x1e\x44\xd6\x04\x52\x15\xe8\xcc\x47\xa0\xd7\x52\xfb\x13\xcd\xad\x4c\xa6\x25\x1a\x82\x7a\x3a\x97\x7f\x06\x23\x86\xb3\x95\x7f\x32\x99\x16\x49\x35\xc5\xa9\xa3\x94\x96\xab\x79\x8c\x52\x4c\x4b\xa4\x5a\x2d\x62\xb1\x8b\x71\xea\xb0\x62\x78\xbc\xf7\x87\xdc\xdc\xb8\x92\xc7\x6e\xf9\x2a\x9b\x97\xdd\xcd\x53\xc7\x9f\xa5\x98\x96\xb0\x62\x67\x5b\xc5\x45\xbd\x22\x46\x9a\xae\x88\xf2\xa9\x01\x7d\xb4\x65\x3b\x8f\xb6\x6c\x9f\xf9\xff\x5c\x65\x94\x27\xdf\x7e\x06\xaf\x1e\x23\x06\x2b\x16\x2b\x06\x23\x82\x20\x17\x2d\x5c\x51\xac\x58\x5e\x3d\x77\x90\x5f\x9f\x7a\x91\x9b\x1b\x57\xf2\xd0\xaa\x2f\x90\x31\x11\x19\x13\x72\x01\x65\x3e\xe4\x6e\xd4\xeb\x84\x18\xa9\xf1\xc2\xdc\x92\x7e\xfa\xd2\x97\xcf\xbe\xc6\xcf\x4e\x3c\xcb\x64\x5a\x24\xf1\x29\xdd\x03\x3f\xe1\xb5\x73\x07\x69\x0c\x1b\xf0\x5a\x3d\xcb\xa9\xa7\xe2\xa6\x98\xf2\x31\x22\x97\xe3\x5e\xa5\x39\x5a\x48\xbd\xcd\x90\x6a\x3a\x1d\xfd\x79\xb5\x75\xa8\xd7\x09\x83\xea\x09\x09\x4d\x95\x79\xe6\x68\x4e\x1d\x4e\x1d\xfb\xce\xbe\xc2\x13\x7d\x3f\xe6\x17\x43\xbb\x08\x4d\xc0\xce\xd5\x39\x16\x84\x8d\xc4\x3e\x41\xd5\x23\xc0\x27\x9b\x6f\x63\x55\xfd\x0a\xee\x5e\x72\x07\x81\x04\x54\x5c\x3c\x4d\x24\x8a\x53\x87\x57\x3f\xfd\xab\x33\xdb\xf3\x61\x53\x09\x0d\xa8\x9e\x30\xa2\xa6\x47\xac\xa0\x73\x8c\xa8\xa2\x34\x06\x0d\x58\xb1\x34\x47\x0b\xf9\x68\xfd\x72\x9e\x7b\xf7\x45\x7a\x0b\x47\x69\x5f\x7c\x3b\x4f\xb4\x7e\x13\x01\xfe\x3a\x7e\x0c\x45\xf9\xf8\xa2\x75\xbc\x7e\xff\xef\xf8\x5e\xdb\xb7\xb1\x62\xb8\x21\xd3\x8c\x02\x91\x89\xb0\x62\x69\x08\xea\x51\x14\x41\xaa\x91\x0d\xb2\xc8\x1c\xcb\x87\x82\x8a\x15\x44\x4d\x8f\x5d\xb6\x7d\x6d\x01\xd1\xaf\xe1\x30\xb3\xbe\xe3\x34\x27\x79\x94\x53\xc5\xbf\xf3\xe6\x68\x1f\xe3\xf1\x04\x8a\xa7\x7f\xfc\x18\xef\x27\x17\x98\x4c\x4b\x9c\x29\x8d\x70\x6a\x72\x98\x77\x26\x4f\x51\x6f\xb3\x0c\x4d\x9e\xe1\x47\x47\x9f\xe2\xdd\xe2\x30\x47\x0a\x7f\xa3\x6f\x7c\x10\x55\xa5\x90\xbc\xcf\x9b\xa3\x7d\x0c\x97\x46\xb0\x62\x29\xbb\x0a\x47\xc6\x06\xe8\x1d\x3f\x4a\xaa\xd5\x05\xce\xae\x12\x89\x80\xaa\xa6\x7c\xf7\x8a\x4a\xc0\x7a\x9b\x25\x32\x21\x00\x89\x4f\x28\xba\x12\x20\x34\x85\x8d\x18\x4c\x75\x5f\xab\x8e\xb1\x62\x48\x7c\x8a\xa2\x2c\x0c\x17\x90\xf8\x84\x92\xab\x10\x99\x90\x7a\x9b\xc5\xe3\xb9\x90\x14\x51\x94\xa6\xb0\x71\xd6\x31\xb8\x54\x02\x5e\x51\x51\xff\x41\x11\x5f\x93\x74\xb5\x1c\xae\x9d\x77\xb9\x6a\x7d\xa9\x04\xbc\x9c\x44\x9c\xb7\xa8\xef\xd2\x2e\x93\x3f\x3a\x18\xd4\x0f\x97\x5f\xb7\x0d\xc1\xa7\xd2\x62\x72\x5d\xb7\x69\xb5\x9e\x34\x68\x08\xad\x2b\xa6\x6f\x95\x56\x66\xef\xca\xdd\xd6\x9a\x1a\x80\xc1\xb6\x7c\x8c\xd3\x6d\x3e\xf1\x85\x6a\xd3\x3a\xaf\x52\x77\x4d\x34\xde\x3e\xf1\x05\x9c\x6e\x1b\x6c\xcb\xc7\x00\xa6\x5b\xba\x7d\x97\x76\x99\x9e\xce\xbd\x27\x93\x62\xbc\x49\x95\x69\xb0\xa4\xd7\x1f\x48\xd2\xda\x74\x21\x29\xc6\x9b\x6a\xd3\x85\x6e\xe9\xf6\x06\xa0\x5b\xba\x7d\x6e\x77\xce\xf6\x6d\xd9\x7f\x28\x29\xc6\x9b\x14\xc6\x82\x86\x20\x50\x4f\x3a\x07\x81\x79\x35\x10\x7a\xf5\xa4\x41\x43\x10\x28\x8c\xd5\xe6\x45\xb9\xdd\x39\xdb\x2d\xd5\x19\xef\xff\xdf\xb8\x13\xa0\x36\x22\xec\xdf\xba\xef\xb8\x1f\x1a\xb9\xc7\x15\x93\x9d\xea\x7d\xaf\x04\xa2\x41\x36\xb4\x26\x0a\x0c\x46\xae\x3e\x46\x23\x98\x28\x30\x41\x36\xb4\x12\x88\xaa\xf7\xbd\xae\x98\xec\xf4\x43\x23\xf7\xf4\x6f\xdd\x77\xbc\x36\xba\xfd\x8f\x93\xfa\xff\xd5\x4f\x12\xff\x02\x36\x67\xce\xa6\xe1\x1f\x5a\x85\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", p: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x3a\x00\x00\x00\x1c\x08\x06\x00\x00\x00\x30\x4e\xac\x03\x00\x00\x06\x66\x49\x44\x41\x54\x78\xda\xe5\x99\x6d\x8c\x94\x57\x15\xc7\x7f\xe7\xde\x3b\x2f\xbb\x33\xbb\xb0\xbc\x94\x16\x91\x12\x0c\xb4\xdd\x96\x42\xcb\x4b\x6c\x1b\x4a\x6d\xac\x98\xa6\x0d\xd6\xb8\x20\x31\x18\x4c\x4c\x63\x4a\x4a\xab\xad\xda\xb4\x31\xd3\x15\x63\x8c\x49\x83\x9a\xa8\x4d\xbf\xb4\xd5\x98\x20\x1b\x5f\x48\xda\x48\xa3\x12\x91\xb8\x54\x76\xb1\x34\xc8\x0a\x6e\x01\xb7\x68\x0b\x0b\xcc\xc0\xee\x0c\xbb\x33\x73\xef\x3d\x7e\x98\xd9\x05\xa1\x4d\xdc\xa5\x11\x90\x93\xcc\x97\xb9\xcf\xf3\xe4\xfe\x9e\x73\xcf\xff\xfc\xef\x7d\x84\xf7\x8a\x1c\x86\x76\x22\x00\x6d\x6d\xf6\xba\x05\x7f\xbd\x33\x06\xf9\x2c\xb0\x58\x22\x37\x20\x34\xa3\x28\x20\xfc\x6f\x43\x11\x04\x65\x40\x0d\x07\x80\x2e\x63\x75\xd3\xbb\x7b\x6e\xe9\xa4\xa3\x23\x5c\x30\xf7\x73\xe2\xc2\x89\xb6\x61\xe9\x20\xf0\xf0\xc2\xc4\xb4\x99\x43\x9f\x13\x95\xf5\x28\x0b\x24\x21\x42\x50\x34\x28\x28\x97\x36\x04\xc4\x0a\x58\x41\xab\xaa\x08\x7b\x54\xf4\x07\xc7\xde\x6e\xf8\x19\x2f\xec\xae\x8e\x32\xbc\x2f\xe8\xe6\x36\xcb\xca\x8e\x30\xfd\xa9\x1b\xe7\xc6\xac\x79\xd1\xa4\xec\x9d\x5a\x51\xb4\x1a\x01\x42\xfd\x7a\xc3\xe5\x11\x91\xda\x2b\xb7\x92\x30\x48\x52\x88\xe5\xd0\x69\x8a\xf1\x0b\xef\x7c\x67\xff\xdf\x47\x58\x2e\x04\xad\x0f\x5c\xfb\x8d\x9b\x17\x93\x62\xab\x58\x99\xa4\x43\xc1\x63\xc4\x5c\x46\x70\xef\x0f\x1d\x35\x4a\x83\x75\x1a\x34\x4f\x99\x4f\x1e\xdd\xb0\xaf\xeb\x5c\x58\x39\x77\x5d\xd7\x20\xf5\x35\x41\x5a\xb4\x12\x3d\x46\x1c\x57\x52\x44\xf5\x92\x34\x4e\xd1\x02\x65\x59\x7e\x74\xc3\xbe\xae\x11\x36\x21\x97\x33\xb4\xb7\xc7\x6b\x72\xf3\x66\x1b\x17\xba\x45\xa4\x45\xab\x31\x20\x62\xb9\x12\x43\x35\x48\xc2\x58\x55\x2d\x44\x6f\x17\xf5\xb7\xef\x3d\x44\x2e\x67\x84\x1c\xa6\x95\x56\x97\x17\xdd\x21\x29\xbb\x44\x87\x42\xc0\x5c\xa1\x90\x67\x33\x1b\xa4\xc1\x5a\x2d\x87\x5d\x93\x54\x96\xf6\xd0\xe3\x0d\xed\xc4\xbc\xc8\x2a\x93\x71\x4b\xea\x35\x39\x66\x48\x2b\x06\x67\xdc\x7f\xfc\xac\xb1\x88\xc8\xa5\x01\x35\x62\x75\x28\x78\x93\x71\x4b\xf2\x22\xab\x68\x27\x4a\x6b\xae\x35\x99\x17\x76\x4b\x52\x5a\x75\x38\x52\x17\x9f\xff\x5e\xe9\x45\x28\x96\x4b\x54\x7c\xa5\x56\xf1\xf5\xd6\x63\x8c\xa1\x31\xd1\x40\xca\xa5\x88\x1a\x2f\x45\x56\xa3\xa4\x0d\x5a\xd1\x9e\x49\xca\x42\x57\x88\xb2\x58\x92\xb4\x6a\x59\x05\x33\xb6\x14\x18\x31\x0c\xfb\x61\x56\xce\x5f\xc1\x4d\xd3\xe6\xe2\x63\x18\x65\x7d\x77\xe0\x18\x7f\x38\xf8\x27\x0e\xe7\xfb\xc8\x26\x1b\xeb\x7d\xc0\x12\x35\x8e\x82\x3b\xe3\x00\xad\xdd\x27\x32\x3a\x3e\xf2\x6c\x45\x09\x31\x8c\x37\xab\x46\xcb\xaa\xe2\xa4\xb5\x50\x61\xb1\x8b\x26\xae\x31\xd6\x1a\x7c\x0c\x30\xb6\x65\x2b\x22\x0c\x57\xcb\xac\x5a\xf0\x10\xf7\xcd\x5d\x76\xc1\x78\xfe\x4c\x81\xb5\x9b\x1e\x65\xc7\xa1\x9d\x58\xeb\x28\x0e\x17\x48\x27\x52\x64\x92\x8d\x84\x18\x39\x5e\x3a\x89\x00\x13\x1b\x26\x50\xf6\x15\x4a\xe5\x12\xe9\x44\x1a\x11\x61\xa8\x32\x84\x35\x96\xa6\x74\x13\x06\xa9\x1b\xb1\x31\x2b\x53\xc4\x1a\x1b\x4d\x58\xe3\x10\x16\xd5\xcc\xdc\xf8\x0a\x4a\x44\x38\x35\x74\x1a\x1f\x3d\x1b\xb7\x3f\xcf\xb6\xb7\x76\xd0\x98\x6c\xe4\x33\xb7\x3e\xc8\xea\xdb\x3e\x4d\xee\x13\x5f\x65\xe9\x0f\x1f\x60\xd9\xac\x45\x7c\x7c\xce\x32\xba\x8e\xec\xe1\x37\xfb\x7f\xc7\x94\xcc\x24\x1e\xbf\xfb\x4b\x44\x0d\x7c\x7f\xc7\x0b\xcc\xbb\xee\x26\x1e\x6c\x5d\xce\xce\xbe\x6e\xfa\x8b\xc7\xb9\xff\xc6\xfb\x38\x72\xea\x9f\xfc\x72\xef\xab\x04\x0d\x58\xb1\x63\x87\x15\x91\xba\x51\x5d\xe4\x04\x99\xa3\x5e\xb9\x18\xdf\x6a\xea\x62\xd4\x75\xe4\x0d\xb6\xbe\xb9\x05\x6c\x82\xbf\xf5\x1f\x60\xd5\x82\x4f\x31\x63\xc2\x74\x92\x36\xc9\xed\x1f\xba\x95\x27\x96\x3d\xc2\x4b\xdd\x3f\xa7\xe3\xcd\x2d\xcc\x6c\x99\xc1\x53\xf7\xae\x07\x60\xe3\x1f\x9f\xe7\xb6\xe9\xf3\x78\x62\xd9\x23\xf4\x17\x8f\x73\x4d\x76\xea\xe8\xb3\x17\xce\x58\xc0\xe3\x5b\x9e\xa1\x39\x95\x25\xe8\x98\xb3\x2a\xea\x15\x41\xe6\xb8\x9a\x41\xbf\x38\xd0\x91\xc5\xb0\x64\xe6\xed\x0c\x56\x8a\x34\x25\xb3\xac\x9c\xbf\x02\x23\x86\x7f\x9d\x7e\x87\x52\x79\x10\x1f\x3d\x3e\x7a\x4a\x95\x12\x46\x04\x55\x65\xb0\x5c\xa2\x1a\xaa\x00\x0c\xfb\x32\x3e\x7a\xac\x58\xd6\x6e\x7a\x94\xb9\x53\x67\xf3\xf5\x7b\x1f\xe3\xa1\x5b\xee\xe7\xdb\xbf\xdf\xc8\xc0\x70\x11\x67\x2d\x3a\x36\x58\x41\x15\x84\x66\xf7\xc1\xa8\x79\x0d\xf4\xc9\x7b\xd6\xf1\xe4\x3d\xeb\x46\xff\x3f\x3a\xd8\xcf\x37\x7f\xfb\x1c\x31\xc6\xd1\xac\x5b\xb1\x18\x31\x88\x08\xce\x58\xb4\x2e\x3e\x8a\xe2\x8c\x63\xeb\x81\x6d\xbc\xbc\xf3\x25\x3e\x3c\xe5\x23\xac\xbb\xeb\x8b\xa4\x13\x29\x92\x36\x89\x12\x81\xf1\xb7\x77\x83\x32\x40\x6d\xa2\x3a\x7e\x25\xaf\xdd\xfa\xab\xbd\xaf\xd6\xdf\xfe\x20\x95\x50\xe5\xb1\x5f\x3f\xcd\x6b\x07\xb6\x91\x49\x37\x11\x63\xac\xab\xa8\xa7\x52\x1d\x62\xb8\x5a\x7e\x4f\x59\x08\x1a\x69\x6c\x6c\xa1\x31\xd9\x80\x8f\xd5\x7a\x99\x8d\x7b\x6a\x8a\x08\x28\x03\x46\xd1\x5e\x71\x17\x07\xea\x43\xc0\x47\xcf\x2f\xf6\xbe\xc2\x33\x1d\x5f\xe1\xb9\xed\x3f\x22\x69\x13\xac\x5f\xfa\x30\x13\xd2\xcd\x94\x7d\x85\xa8\x11\x41\xf8\xe8\xf5\x8b\x98\x35\x65\x36\xcb\x6f\xf8\x18\x09\xe3\x18\xf2\xc3\xb5\x2d\xa6\x2a\x3e\x7a\x54\x23\x21\x86\x5a\x1b\x8a\x11\x1f\xfd\x45\x19\x42\x71\x82\xa2\xbd\x06\xa5\xbb\xd6\xfc\x74\x5c\xa0\xaa\x4a\x73\x3a\x8b\x33\x8e\xc9\x99\x16\xb2\x93\xaf\xe7\xc7\x9d\x2f\xf2\x7a\x5f\x37\x77\xcd\x5a\xc2\x77\x1f\xc8\x21\xc0\xae\x23\x6f\x10\x55\x59\x38\x63\x3e\x87\x9f\xde\xcd\xf7\x56\x7c\x0b\x6b\x2c\xd3\xb2\x53\x01\x25\xe5\x92\x38\xe3\xc8\xa6\xb2\xa8\x2a\x22\xc2\xe4\xcc\x24\xb2\xc9\xec\xf8\x1d\x96\xaa\xd6\x1b\x7b\xb7\x6d\xbe\x7b\x5a\x01\xc3\x5a\x22\x06\x19\x9b\x20\x09\x02\x52\x5b\xba\x6f\x9d\x38\xc4\xf6\x83\x9d\xe4\xcf\x14\x88\x44\xba\x8f\xec\xa1\x30\x74\x8a\xc1\x72\x91\x83\x27\xff\x41\xef\x89\x43\xec\x3f\xd6\x4b\x26\xd9\xc8\xfe\xfe\x5e\xbe\xf6\x4a\x3b\xbd\x27\x0e\xd1\xd9\xb7\x8b\x3f\xbf\xfd\x17\x54\x95\x93\x67\xf2\x6c\x3f\xd8\xc9\xe1\x7c\x1f\xce\x3a\x4a\x95\x33\xec\xec\xeb\xe6\xf5\xbe\xdd\xf8\xe8\xc7\x6a\xda\x6a\x32\x29\xa8\x78\xf9\xf2\x07\x6a\x01\x33\xa9\x0c\x29\x9b\x04\x81\x8a\xaf\x50\x2c\x97\x40\x60\x62\x7a\x02\xd6\x18\x06\xcb\x25\x14\x45\x55\xb1\x62\xa8\x04\x8f\xa2\xb4\x34\x4c\xa0\x12\xaa\x94\xca\x25\x52\x2e\x49\x26\x95\x21\xc6\xc8\xe9\xe1\x01\x14\x98\x98\x6e\x1e\x7b\x56\xcf\xb3\x80\x02\x70\xed\xb3\x37\xaf\x31\x19\xf3\x93\x38\xe8\xc7\xb5\x07\xb5\x62\x10\x31\x04\x0d\xa3\x15\x30\x62\xe9\xce\xb5\x71\x76\xe4\x1d\xd6\xdb\xcb\x88\x5a\x9f\x6f\x01\xcf\x5a\x44\x0b\xc8\xf8\xea\x34\xaa\x37\x4d\xce\xc5\x52\xfc\xfc\xd1\x67\xf7\xfd\xf4\x2a\xda\xa6\x91\xa3\xa7\xbd\xa7\x12\xd5\xad\x56\x1f\x0b\x92\x34\x16\xd5\x70\xc5\x42\xaa\x06\x49\x1a\xab\x3e\x16\xa2\xba\xd5\x3d\xed\x3d\x15\xc8\x5d\x3d\x47\x29\xb5\xa2\x69\x27\xb2\xb9\xcd\x1e\xdd\xb0\xaf\x8b\xb2\x2c\x57\xc8\x4b\x83\x75\x44\xf5\xf5\xd3\xb6\xcb\x1e\x91\xa8\x5e\x1a\xac\x53\xc8\x8f\x42\x6e\x6e\xb3\x23\x67\xbc\x67\x15\x76\x65\x47\x18\x81\x35\xc5\x70\x87\x86\xd8\x69\x9a\x9c\x93\x84\x19\xb9\x26\x5c\x66\xd0\xb1\x3e\x27\x24\x61\x8c\x69\x72\x4e\x43\xec\x34\xc5\x70\xc7\xf9\x27\x80\x57\xf1\x01\xf6\xff\xf1\x27\x89\x7f\x03\x6d\x0f\x87\x35\x85\xa2\xb4\x0e\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", d: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x3a\x00\x00\x00\x1c\x08\x06\x00\x00\x00\x30\x4e\xac\x03\x00\x00\x05\xe4\x49\x44\x41\x54\x78\xda\xe5\x59\xdf\x6f\x13\x57\x16\xfe\xce\xfd\x31\x63\x02\x4a\x64\x4b\x10\x1c\x82\x0a\x91\x0a\x38\x12\x51\xa5\x90\x3e\x54\xea\x23\x6a\x5f\xfa\x52\xc9\x61\x9b\x8a\x6a\xf7\x1f\x58\x69\xb5\xfb\xd4\x17\xcb\xff\x42\xff\x81\x4a\xad\xd6\x6d\xec\x97\x3e\xb6\xe2\x71\x11\x0f\x5b\x22\x9a\x20\x0c\x25\x22\x58\x68\x91\x25\x9b\x60\xe3\xc0\xe0\x99\xb9\xf7\x9e\x3e\x64\xc6\x4a\x42\xd3\x15\x36\xbb\x90\xf6\x48\x23\x8d\x35\x77\xc6\xe7\x9b\xf3\x9d\x73\xbe\x7b\x86\xf0\x2b\x56\x2a\x95\x44\xb9\x5c\x76\x00\x50\x2c\x16\xa5\xe7\x79\xef\x11\xd1\x9f\x00\x2c\x58\x6b\xcf\x0a\x21\xc6\x99\x99\x01\x10\xfe\xbf\xc6\x44\x44\xce\xb9\x9e\x94\xf2\x67\x00\x3f\x32\xf3\xb7\x51\x14\x5d\xab\xd5\x6a\x76\xaf\xef\x3b\xed\x05\x47\x8b\xc5\xa2\xac\xd5\x6a\x76\x7e\x7e\x5e\x17\x0a\x85\x4f\x01\xfc\x95\x99\xdf\x51\x4a\x91\x73\x0e\xce\x39\x6c\x63\x7c\x7d\x46\x44\x10\x42\x40\x08\x01\x63\x0c\x13\xd1\x4f\x00\xbe\xb8\x7d\xfb\xf6\x3f\x57\x56\x56\xe2\x14\xc3\xbe\x40\xd3\x05\x97\x2e\x5d\x3a\xa3\x94\xfa\xd2\xf7\xfd\xf7\x8c\x31\x30\xc6\x00\x80\x65\x66\x22\x22\x81\x37\xc0\x98\xd9\x11\x11\x03\x90\x4a\x29\x28\xa5\x10\x86\xe1\x35\x63\xcc\x5f\x96\x97\x97\xef\xee\x05\x4b\x7b\x41\x2e\x2e\x2e\x2e\x78\x9e\xf7\xbd\x94\x32\x17\x45\x91\x01\x20\xde\x14\x70\xbf\x05\x1a\x80\xf3\x3c\x4f\x59\x6b\x1f\x47\x51\xf4\x61\xb5\x5a\xfd\x71\x27\x58\x91\xf2\x3a\x05\xe9\xfb\xfe\x0f\x44\x94\x8b\xa2\xc8\x10\x91\x7a\xd3\x41\x26\x54\x16\x44\xa4\x12\x9f\x73\xbe\xef\xff\xb0\xb8\xb8\xb8\x50\xab\xd5\x6c\xa9\x54\x12\x00\x40\x69\xf2\x2e\x2d\x2d\xcd\x08\x21\xae\x13\x51\xd6\x5a\x6b\x01\x48\x1c\x4c\xb3\x52\x4a\xc9\xcc\x1d\xe7\xdc\x85\x4a\xa5\xb2\x51\x2a\x95\x84\x48\x68\xeb\x01\xf8\x46\x4a\x99\x35\xc6\x1c\x64\x90\x00\x20\x8d\x31\x56\x4a\x99\x05\xf0\x4d\x82\x6d\x3b\x47\x97\x96\x96\x2e\x67\x32\x99\xaf\x9e\x3f\x7f\x6e\x88\x48\x0d\x53\x05\xf7\xc9\x9d\xd7\x99\xb7\xe6\xd0\xa1\x43\xaa\xdf\xef\x7f\x56\xa9\x54\xbe\xa6\x62\xb1\xe8\x29\xa5\x56\x94\x52\xb3\xc6\x18\x0c\x93\x93\xd6\x5a\x58\x6b\x5f\x00\x2c\xa5\x84\x94\xf2\xb5\x00\x66\x66\xa7\x94\x82\x31\xa6\x6e\x8c\x99\x57\x5a\xeb\x05\x22\x9a\xb5\xd6\x12\xed\x17\x9a\xdf\x88\xa4\xb5\x16\x53\x53\x53\x18\x1f\x1f\xc7\x76\x6a\x6f\x5b\x18\x86\x78\xf4\xe8\x11\x82\x20\x80\x94\x72\x57\xe4\x53\xe0\xfb\xfd\x7e\x15\xac\x20\x22\x61\xad\x65\x21\xc4\xac\xd6\x7a\x41\x01\xb8\x2c\xa5\x14\xc3\xe6\xa6\x73\x0e\x27\x4e\x9c\xc0\xc9\x93\x27\x61\xad\x1d\x80\x62\x66\x3c\x7b\xf6\x0c\x2b\x2b\x2b\xd8\xdc\xdc\x84\x10\x02\x51\x14\x0d\xa2\x0c\x00\x51\x14\x01\x00\xb4\xd6\x70\xce\xc1\x18\x03\x29\x25\x88\x08\xc6\x18\x08\x21\xa0\x94\x1a\x25\xb0\x4e\x4a\x29\x8d\x31\x97\x15\x80\x0b\xcc\x8c\x44\x0c\x0c\xf5\xb4\x28\x8a\x60\xad\x45\xbd\x5e\xc7\xe6\xe6\x26\xa4\x94\xc8\xe7\xf3\x98\x99\x99\xc1\xd9\xb3\x67\x71\xf5\xea\x55\xe4\x72\x39\xe4\xf3\x79\xb4\xdb\x6d\xb4\x5a\x2d\x78\x9e\x87\x99\x99\x19\x30\x33\xee\xdf\xbf\x8f\xf1\xf1\x71\x4c\x4f\x4f\xa3\xd5\x6a\x21\x0c\x43\x1c\x3f\x7e\x1c\x41\x10\xa0\xd9\x6c\x82\x99\x31\x8c\x6f\xcc\x4c\x09\x23\x2e\x28\x66\x7e\xdb\x39\x87\xa1\x51\xee\x90\x64\xdd\x6e\x17\x0f\x1f\x3e\x84\x10\x02\x5b\x5b\x5b\x98\x9e\x9e\x46\x26\x93\x81\x10\x02\x13\x13\x13\x98\x9b\x9b\xc3\xcd\x9b\x37\xd1\x6c\x36\x21\xa5\xc4\x99\x33\x67\xc0\xcc\xd8\xd8\xd8\xc0\xc4\xc4\x04\x0a\x85\x02\x26\x27\x27\x91\xc9\x64\x90\xc9\x64\xe0\x9c\xc3\xfa\xfa\x3a\x6e\xdd\xba\x05\xa5\xd4\x4b\xd3\x38\xd1\xc5\x60\xe6\xb7\x55\x22\xd0\x31\xaa\x40\x67\x66\x64\xb3\xd9\x01\x7d\xa7\xa6\xa6\xe0\xfb\x3e\xba\xdd\x2e\x8c\x31\x70\xce\x21\x0c\xc3\x54\x4e\x0e\x98\x90\x3a\x6f\xad\x45\x18\x86\x10\x42\xe0\xc6\x8d\x1b\x18\x1b\x1b\x43\xa1\x50\x40\x3e\x9f\xc7\xfa\xfa\x3a\x92\x42\xf9\xd2\x31\x60\x66\x08\x21\xc6\xd5\xab\xa8\x70\x69\x4e\x9d\x3b\x77\x0e\x4a\x29\xc4\x71\x0c\x66\x46\xaf\xd7\xc3\xdd\xbb\x77\x77\x51\x8f\x88\x76\x9d\xef\x34\xad\x35\x1a\x8d\x06\x1a\x8d\x06\x8e\x1c\x39\x82\xd3\xa7\x4f\x0f\xc4\xfb\xa8\x26\x9c\x73\xbd\xe4\x0f\x79\x94\x68\x4a\x29\xf1\xe0\xc1\x03\xac\xad\xad\xa1\xdf\xef\x83\x99\xb1\xb6\xb6\x86\x56\xab\x05\xad\xf5\x20\x72\xcc\x0c\x6b\x2d\x9c\x73\xfb\x3e\xcf\xf3\xbc\x41\x5b\x1a\x21\xa3\xd2\x6d\x1d\x9c\x73\x3d\x41\x44\xeb\x42\x08\xf0\x08\xcd\x2e\x75\xa8\xd9\x6c\x62\x75\x75\x15\xf7\xee\xdd\x1b\x14\x1b\xad\xf5\xa0\xed\x38\xe7\x90\xcd\x66\x71\xf8\xf0\x61\x1c\x3d\x7a\x14\x9e\xe7\xed\x6a\x49\x49\x51\x7c\xe1\x18\xc1\x2f\x16\x42\x80\x88\xd6\x15\x80\xeb\x44\x34\x9f\x6c\x79\x86\x32\xa5\x14\x7c\xdf\x87\xe7\x79\x18\x1b\x1b\x43\xa3\xd1\xc0\xb1\x63\xc7\x70\xea\xd4\x29\x04\x41\x80\xd5\xd5\x55\x74\xbb\x5d\x84\x61\x88\xc9\xc9\x49\x5c\xbc\x78\x11\xd6\x5a\x08\x21\xe0\xfb\xfe\x36\xb5\x92\xf3\x9d\xed\xc4\xf3\xbc\x91\xda\x0b\x11\x71\xc2\x88\xeb\xf2\xfc\xf9\xf3\x1d\x66\xfe\x73\xb2\x93\x79\x69\xc1\x90\x5a\xaf\xd7\x43\xbb\xdd\x46\x1c\xc7\x00\x80\x27\x4f\x9e\x20\x08\x02\xc4\x71\x8c\x20\x08\xf0\xf4\xe9\x53\x6c\x6d\x6d\x0d\x2a\x72\xbd\x5e\x47\xaf\xd7\x43\xa7\xd3\x41\xb7\xdb\x05\x33\xa3\xdf\xef\xa3\xdd\x6e\x23\x08\x82\x81\x18\x79\xfc\xf8\xf1\xe0\xfa\x30\x58\x13\xa6\xfe\xed\x95\x4a\x40\xa5\xd4\xa0\x70\xa4\x02\x80\x88\xa0\xb5\x1e\xac\xdb\xa9\x82\xd2\x3c\xdd\x2b\x18\x52\x41\x91\xbe\xb4\xf4\xfe\x51\x24\xa0\xac\xd7\xeb\x76\x6e\x6e\xee\xa9\xef\xfb\x1f\x1b\x63\xec\x30\x40\xa5\x94\x50\x4a\xed\x8a\x30\x11\x41\x29\x35\x70\x7a\xa7\xf6\x95\x52\x42\x08\xb1\x0b\x54\xba\x7e\x67\x85\xdd\x7b\xff\xcb\xbe\x7f\xdf\xf7\xa5\xb5\xf6\x1f\xcb\xcb\xcb\x37\xa8\x54\x2a\x89\x7a\xbd\xae\xb4\xd6\xff\xd2\x5a\xbf\x1b\x45\x91\x25\xa2\x83\xbc\x4d\x03\x33\x5b\xcf\xf3\x64\x1c\xc7\xff\x8e\xe3\xf8\xfd\xd9\xd9\x59\x23\x00\xa0\x56\xab\x45\x00\x3e\xb1\xd6\x76\x94\x52\x12\x80\x3d\xc0\x38\xad\x52\x4a\x5a\x6b\x3b\x00\x3e\x49\xb0\x41\x94\xcb\x65\x57\x2a\x95\x44\xa5\x52\xd9\x88\xa2\xe8\x03\x00\x9d\x64\x87\x6e\x0e\x60\x24\x8d\xdc\xe6\x7a\x27\x8a\xa2\x0f\xd2\xe9\x42\xb9\x5c\x76\x7f\x98\xe1\xd8\x20\x17\xeb\xf5\x3a\x27\x17\xfe\x53\x28\x14\xbe\x03\x30\x9f\xc9\x64\xde\x4a\x85\x71\x32\xee\x1c\x49\xfc\xff\x0f\xc6\x9d\x0e\x80\xd0\x5a\x93\xef\xfb\x22\x8e\xe3\x6b\xc6\x98\x8f\xaa\xd5\xea\xcd\xbd\xe3\xce\x5d\x45\x27\x05\x5b\xad\x56\x1f\x79\x9e\xf7\x75\x2e\x97\xdb\x60\xe6\xb7\x00\x1c\xd7\x5a\x8b\x37\x05\x24\x11\x41\x4a\x49\x4a\x29\x91\xf4\xc9\x9f\xac\xb5\x9f\xdf\xb9\x73\xe7\xef\x57\xae\x5c\x69\xff\xd7\x01\xf6\xef\xf9\x93\xc4\x2f\xa4\x1e\x9b\x6f\x09\x30\x3b\xbb\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82" };
    // Built by a function so the layout can be switched (tall / wide) while the
    // dialog is open. "st" carries the user's choices over to the rebuilt dialog.
    function buildDialog(wide, st) {
    var ui = {};
    var win = new Window("dialog", SCRIPT_NAME);
    // navy first: the UI Kit picks the white logo when the window background is dark
    if (STYLED_UI) { try { win.graphics.backgroundColor = win.graphics.newBrush(win.graphics.BrushType.SOLID_COLOR, TSP_BG); } catch (eBgc) {} }
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = uik().MARGINS;
    win.spacing = uik().SPACING;

    var topGrp = win.add("group");
    topGrp.alignment = ["fill", "top"];
    topGrp.alignChildren = ["left", "center"];
    topGrp.spacing = 10;
    topGrp.margins = 0;   // logo and title line up with the panels below
    if (!(STYLED_UI && uik().addWordmark && uik().addWordmark(topGrp))) addLogo(topGrp, win);
    var topSpacer = topGrp.add("group");
    topSpacer.alignment = ["fill", "center"];
    // The title is a small picture (bold capitals), because the window font cannot be set to bold
    // or enlarged reliably. If the picture cannot be added, the plain text title is used.
    var topTitle = null;
    if (STYLED_UI) topTitle = addTitleImage(topGrp);
    if (!topTitle) {
        topTitle = topGrp.add("statictext", undefined, "STANDARDIZE PDFs");
        try { topTitle.graphics.font = ScriptUI.newFont("dialog", "BOLD", 18); } catch (eTT) {}
        topTitle.preferredSize = [250, 26];
        topTitle.justify = "right";
    }
    topTitle.alignment = ["right", "center"];
    // thin green line under the header
    if (STYLED_UI) {
        try {
            var accentLine = win.add("group");
            accentLine.alignment = ["fill", "top"];
            accentLine.preferredSize = [10, 4];
            accentLine.graphics.backgroundColor = accentLine.graphics.newBrush(accentLine.graphics.BrushType.SOLID_COLOR, TSP_GREEN);
        } catch (eAcc) {}
    }

    var leftCol = win, rightCol = win;
    if (wide) {
        var cols = win.add("group");
        cols.orientation = "row";
        cols.alignChildren = ["fill", "top"];
        cols.spacing = 14;
        leftCol = cols.add("group");
        leftCol.orientation = "column";
        leftCol.alignChildren = "fill";
        leftCol.spacing = 10;
        rightCol = cols.add("group");
        rightCol.orientation = "column";
        rightCol.alignChildren = "fill";
        rightCol.spacing = 10;
    }

    var abPnl = leftCol.add("panel", undefined, "Artboards to Export");
    abPnl.orientation = "column";
    abPnl.alignChildren = "fill";
    abPnl.margins = 14;
    abPnl.spacing = 8;

    var abList = abPnl.add("listbox", undefined, [], { multiselect: true });
    abList.preferredSize = [420, wide ? 120 : 150];
    for (var ai = 0; ai < sourceDoc.artboards.length; ai++) {
        var abNm = sourceDoc.artboards[ai].name;
        var li = abList.add("item", (ai + 1) + " - " + abNm);
        li.abIndex = ai;
        li.abName = abNm;
    }
    // Presentation artboards (name has "presentation" but not "proof") go to the top of the list, in
    // their own order, followed by the others, and they are the ones selected.
    function isPresName(nm) {
        var t = String(nm).toLowerCase();
        return (t.indexOf("presentation") !== -1 && t.indexOf("proof") === -1);
    }
    function presToTop() {
        var topRows = [], restRows = [];
        for (var q = 0; q < abList.items.length; q++) {
            var it0 = abList.items[q];
            var row0 = { text: it0.text, abIndex: it0.abIndex, abName: it0.abName };
            if (isPresName(it0.abName)) topRows.push(row0); else restRows.push(row0);
        }
        var allRows = topRows.concat(restRows);
        abList.removeAll();
        for (var r = 0; r < allRows.length; r++) {
            var nli = abList.add("item", allRows[r].text);
            nli.abIndex = allRows[r].abIndex;
            nli.abName = allRows[r].abName;
            nli.selected = (r < topRows.length);
        }
    }

    // First time the window opens (not when the layout is switched): pre-select by name.
    // Presentation artboards (without "proof" in the name) first; if there are none, the Proof ones.
    var autoSelNote = "";
    if (!st) {
        var nPres = 0, nProof = 0;
        for (var as1 = 0; as1 < abList.items.length; as1++) {
            var nmA = String(abList.items[as1].abName).toLowerCase();
            if (nmA.indexOf("presentation") !== -1 && nmA.indexOf("proof") === -1) nPres++;
            else if (nmA.indexOf("proof") !== -1 && nmA.indexOf("presentation") === -1) nProof++;
        }
        if (nPres > 0 || nProof > 0) {
            var wantPresAuto = (nPres > 0);
            if (wantPresAuto) {
                presToTop();
            } else {
                for (var as2 = 0; as2 < abList.items.length; as2++) {
                    var nmB = String(abList.items[as2].abName).toLowerCase();
                    abList.items[as2].selected = (nmB.indexOf("proof") !== -1 && nmB.indexOf("presentation") === -1);
                }
            }
            var nAuto = wantPresAuto ? nPres : nProof;
            autoSelNote = "Auto-selected " + nAuto + " " + (wantPresAuto ? "Presentation" : "Proof") + " artboard" + (nAuto === 1 ? "" : "s") + " (by name)" + (wantPresAuto ? ", moved to the top" : "");
        }
        // Artboard 1 of the file is always selected when the window opens
        for (var as3 = 0; as3 < abList.items.length; as3++) {
            if (abList.items[as3].abIndex === 0) {
                if (!abList.items[as3].selected) {
                    abList.items[as3].selected = true;
                    if (autoSelNote !== "") autoSelNote += ", plus artboard 1";
                }
                break;
            }
        }
    }

    var abBtnGrp1 = abPnl.add("group");
    abBtnGrp1.alignment = "left";
    var btnAll = abBtnGrp1.add("button", undefined, "Select All");
    var btnNone = abBtnGrp1.add("button", undefined, "Select None");
    var btnPres = abBtnGrp1.add("button", undefined, "Select Presentation");

    var abBtnGrp2 = abPnl.add("group");
    abBtnGrp2.alignment = "left";
    var btnUp = abBtnGrp2.add("button", undefined, "Move Up");
    var btnDown = abBtnGrp2.add("button", undefined, "Move Down");
    var btnProof = abBtnGrp2.add("button", undefined, "Select Proof");

    if (autoSelNote !== "") {
        var autoNote = abPnl.add("statictext", undefined, autoSelNote);
        autoNote.isNote = true;
        try { autoNote.graphics.foregroundColor = autoNote.graphics.newPen(autoNote.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 0.4], 1); } catch (ePnA) {}
    }

    // Selecting items one by one makes the list scroll to the last one;
    // scroll back to the first selected item so the top of the selection stays in view.
    function scrollToFirstSelected() {
        try {
            for (var q = 0; q < abList.items.length; q++) {
                if (abList.items[q].selected) {
                    // go to the very bottom first, then back up to the first selected one:
                    // that leaves it at the TOP edge of the box (not the bottom edge)
                    abList.revealItem(abList.items[abList.items.length - 1]);
                    abList.revealItem(abList.items[q]);
                    break;
                }
            }
        } catch (eScroll) {}
        try { refreshSize(); } catch (eRS) {}
    }

    btnAll.onClick = function () {
        for (var q = 0; q < abList.items.length; q++) abList.items[q].selected = true;
        scrollToFirstSelected();
    };
    btnNone.onClick = function () {
        abList.selection = null;
        try { refreshSize(); } catch (eRS2) {}
    };
    btnPres.onClick = function () {
        presToTop();
        scrollToFirstSelected();
    };
    btnProof.onClick = function () {
        for (var q = 0; q < abList.items.length; q++) {
            var nm = String(abList.items[q].abName).toLowerCase();
            abList.items[q].selected = (nm.indexOf("proof") !== -1 && nm.indexOf("presentation") === -1);
        }
        scrollToFirstSelected();
    };

    function moveSelected(dir) {
        var n = abList.items.length;
        var rows = [];
        for (var q = 0; q < n; q++) {
            var it = abList.items[q];
            rows.push({ text: it.text, abIndex: it.abIndex, abName: it.abName, sel: it.selected });
        }
        var tmp;
        if (dir < 0) {
            for (var a = 1; a < n; a++) {
                if (rows[a].sel && !rows[a - 1].sel) {
                    tmp = rows[a]; rows[a] = rows[a - 1]; rows[a - 1] = tmp;
                }
            }
        } else {
            for (var b = n - 2; b >= 0; b--) {
                if (rows[b].sel && !rows[b + 1].sel) {
                    tmp = rows[b]; rows[b] = rows[b + 1]; rows[b + 1] = tmp;
                }
            }
        }
        for (var c = 0; c < n; c++) {
            var target = abList.items[c];
            target.text = rows[c].text;
            target.abIndex = rows[c].abIndex;
            target.abName = rows[c].abName;
            target.selected = rows[c].sel;
        }
    }
    btnUp.onClick = function () { moveSelected(-1); };
    btnDown.onClick = function () { moveSelected(1); };

    var sizePnl = leftCol.add("panel", undefined, "Standard Page Size");
    sizePnl.orientation = "column";
    sizePnl.alignChildren = "left";
    sizePnl.margins = 14;
    sizePnl.spacing = 8;

    // note shown only when the file sits in a Pittsburgh folder (kept ABOVE the radio buttons,
    // because anything placed between radio buttons would split them into separate groups)
    var pghNote = null;
    if (pghFolder !== "") {
        pghNote = sizePnl.add("statictext", undefined, "");
        pghNote.preferredSize.width = 400;
        pghNote.isNote = true;
        try { pghNote.graphics.foregroundColor = pghNote.graphics.newPen(pghNote.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 0.4], 1); } catch (ePn) {}
    }
    var rbH11 = sizePnl.add("radiobutton", undefined, "11\" height (default)");
    var rbH85 = sizePnl.add("radiobutton", undefined, "8.5\" height  -  Pittsburgh");
    // Auto, Custom height and Margin are not offered any more (1.5): the controls still exist,
    // but in a hidden, zero-size group, so the rest of the script is unchanged. The page is
    // always 11" (or 8.5" for Pittsburgh) and the margin is always 0.
    var hiddenOpts = win.add("group");
    hiddenOpts.orientation = "column";
    hiddenOpts.visible = false;
    hiddenOpts.maximumSize = [0, 0];
    var rbAuto = hiddenOpts.add("radiobutton", undefined, "Auto");
    var rbCustom = hiddenOpts.add("radiobutton", undefined, "Custom height:");

    var heightGrp = hiddenOpts.add("group");
    heightGrp.orientation = "row";
    heightGrp.alignChildren = "center";
    heightGrp.margins = [20, 0, 0, 0];
    heightGrp.add("statictext", undefined, "Height:");
    var txtHeight = heightGrp.add("edittext", undefined, remembered("height", "11"));
    txtHeight.characters = 6;
    heightGrp.add("statictext", undefined, "in  (width follows the largest sign's shape)");

    var savedMode = "h11";   // Auto / Custom are gone: an old saved mode is ignored
    if (savedMode === "height") savedMode = "custom";   // older saved value
    if (savedMode === "auto") rbAuto.value = true;
    else if (savedMode === "custom") rbCustom.value = true;
    else rbH11.value = true;
    // first time the window opens (not when the layout is switched): a Pittsburgh folder picks 8.5"
    if (pghFolder !== "" && !st) {
        rbH11.value = false; rbAuto.value = false; rbCustom.value = false;
        rbH85.value = true;
    }
    heightGrp.enabled = rbCustom.value;

    function refreshPghNote() {
        if (!pghNote) return;
        pghNote.text = rbH85.value
            ? "Pittsburgh: " + pghHow + " confirmed"
            : "Pittsburgh: " + pghHow + " found, but another size is picked.";
    }
    rbH11.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbH85.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbAuto.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbCustom.onClick = function () { heightGrp.enabled = true; refreshPghNote(); };
    refreshPghNote();

    var marginGrp = hiddenOpts.add("group");
    marginGrp.orientation = "row";
    marginGrp.add("statictext", undefined, "Margin around each sign (in):");
    var txtMargin = marginGrp.add("edittext", undefined, "0");
    txtMargin.characters = 6;

    var outPnl = rightCol.add("panel", undefined, "Output");
    outPnl.orientation = "column";
    outPnl.alignChildren = "left";
    outPnl.margins = 14;
    outPnl.spacing = 8;

    // the output folder is never remembered: it starts as the file's own folder
    var startFolder = origFile.parent.fsName;

    // PDF preset used for the FINAL export (list = presets installed in Illustrator)
    var presetNames = [];
    try {
        var presetList = app.PDFPresetsList;
        for (var pi = 0; pi < presetList.length; pi++) presetNames.push(String(presetList[pi]));
    } catch (ePL) {}
    var presetGrp = outPnl.add("group");
    presetGrp.orientation = "row";
    presetGrp.alignChildren = "center";
    presetGrp.add("statictext", undefined, "PDF preset:");
    var ddPreset = presetGrp.add("dropdownlist", undefined, presetNames);
    ddPreset.preferredSize.width = 290;
    var wantPreset = remembered("preset", "TSP_Presentation");
    var presetIdx = -1;
    for (var pj = 0; pj < presetNames.length; pj++) {
        if (presetNames[pj] === wantPreset) { presetIdx = pj; break; }
    }
    if (presetIdx < 0) {
        for (var pk = 0; pk < presetNames.length; pk++) {
            if (presetNames[pk] === "TSP_Presentation") { presetIdx = pk; break; }
        }
    }
    if (presetIdx < 0 && presetNames.length > 0) presetIdx = 0;
    if (presetIdx >= 0) ddPreset.selection = presetIdx;

    var folderGrp = outPnl.add("group");
    folderGrp.orientation = "row";
    folderGrp.add("statictext", undefined, "Folder:");
    var txtFolder = folderGrp.add("edittext", undefined, startFolder);
    txtFolder.characters = 34;
    var btnBrowse = folderGrp.add("button", undefined, "Browse...");
    var folderTouched = false;     // true once the user typed/browsed a folder themselves
    btnBrowse.onClick = function () {
        var f = Folder.selectDialog("Choose output folder", txtFolder.text);
        if (f) { txtFolder.text = f.fsName; folderTouched = true; folderNote.text = ""; refreshVersion(); }
    };
    txtFolder.onChanging = function () { folderTouched = true; folderNote.text = ""; };
    txtFolder.onChange = function () { refreshVersion(); };

    var folderNote = outPnl.add("statictext", undefined, "", { multiline: true });
    folderNote.preferredSize = [380, 34];

    var cleanDocName = sourceDoc.name.replace(/\.[^\.]+$/, "");

    // Project number = leading digits of the open file's name (e.g. 124857_Large_Design...)
    var projMatch = cleanDocName.match(/^\s*(\d+)/);
    var projDefault = projMatch ? projMatch[1] : "";

    var nameGrp = outPnl.add("group");
    nameGrp.orientation = "row";
    nameGrp.alignChildren = "center";
    nameGrp.add("statictext", undefined, "Project #:");
    var txtProject = nameGrp.add("edittext", undefined, projDefault);
    txtProject.characters = 9;
    nameGrp.add("statictext", undefined, "Version:");
    var txtVersion = nameGrp.add("edittext", undefined, "1");
    txtVersion.characters = 4;
    var chkOverwrite = nameGrp.add("checkbox", undefined, "Overwrite current");
    chkOverwrite.value = false;     // always off at start, never remembered

    var versionNote = outPnl.add("statictext", undefined, "");
    versionNote.preferredSize.width = 380;

    var previewTxt = outPnl.add("statictext", undefined, "");
    previewTxt.preferredSize.width = 380;

    var sizeTxt = outPnl.add("statictext", undefined, "", { multiline: true });
    sizeTxt.preferredSize = [380, 48];

    // Rough size guess, shown before export. The real size is only known after saving,
    // so this scales the source file's size by the number of selected artboards and,
    // when the file has images, by what the chosen PDF preset does to image resolution.
    function fmtMB(b) {
        var mb = b / 1048576;
        if (mb < 1) return "under 1 MB";
        return (mb < 10 ? Math.round(mb * 10) / 10 : Math.round(mb)) + " MB";
    }
    // Reads the preset's .joboptions file (a text file) for the image resolution.
    // Returns { ppi: number or 0 (no downsampling) } or null when the file is not found.
    var presetInfoCache = {};
    function readPresetInfo(name) {
        if (!name) return null;
        if (presetInfoCache.hasOwnProperty(name)) return presetInfoCache[name];
        var dirs = [];
        try {
            var appData = $.getenv("APPDATA");
            if (appData) dirs.push(appData + "/Adobe/Adobe PDF/Settings");
            var progData = $.getenv("ProgramData");
            if (progData) dirs.push(progData + "/Adobe/Adobe PDF/Settings");
        } catch (eEnv) {}
        dirs.push(Folder.userData.fsName + "/Adobe/Adobe PDF/Settings");
        dirs.push("~/Library/Application Support/Adobe/Adobe PDF/Settings");
        dirs.push("/Library/Application Support/Adobe/Adobe PDF/Settings");
        var info = null;
        for (var di = 0; di < dirs.length && !info; di++) {
            try {
                var f = new File(dirs[di] + "/" + name + ".joboptions");
                if (!f.exists) continue;
                f.encoding = "BINARY";
                if (!f.open("r")) continue;
                var txt = f.read();
                f.close();
                var down = /\/DownsampleColorImages\s+(true|false)/.exec(txt);
                var res = /\/ColorImageResolution\s+(\d+)/.exec(txt);
                if (down && res) info = { ppi: (down[1] === "true" ? parseInt(res[1], 10) : 0) };
            } catch (eJO) {}
        }
        presetInfoCache[name] = info;
        return info;
    }
    var imageCount = 0;
    try { imageCount = sourceDoc.rasterItems.length + sourceDoc.placedItems.length; } catch (eIC) {}
    function selectedCount() {
        var c = 0;
        for (var zi = 0; zi < abList.items.length; zi++) if (abList.items[zi].selected) c++;
        return c;
    }
    function refreshSize() {
        var n = selectedCount();
        if (n === 0) { sizeTxt.text = "Estimated size: select artboards to see it"; return; }
        var len = 0;
        try { len = origFile.length; } catch (eL) { len = 0; }
        var total = sourceDoc.artboards.length;
        if (!len || total < 1) { sizeTxt.text = "Estimated size: not available (save the file first)"; return; }
        var share = len / total * n;
        var lo = share * 0.4, hi = share * 1.2;
        var why = "";
        if (imageCount > 0) {
            var pi = readPresetInfo(ddPreset.selection ? ddPreset.selection.text : "");
            if (pi && pi.ppi > 0) {
                // assume the images are about 300 ppi in the file; the preset shrinks them to its ppi
                var fct = (pi.ppi / 300) * (pi.ppi / 300);
                if (fct > 1) fct = 1;
                if (fct < 0.08) fct = 0.08;
                lo *= fct; hi *= fct;
                why = ", preset limits images to " + pi.ppi + " ppi";
            } else if (pi) {
                why = ", preset keeps image resolution";
            } else {
                why = ", preset not found";
            }
        } else {
            why = ", no images";
        }
        var lowTxt = fmtMB(lo), hiTxt = fmtMB(hi);
        sizeTxt.text = "Estimated size: about " + (lowTxt === hiTxt ? lowTxt : (lowTxt === "under 1 MB" ? "under " + hiTxt : lowTxt + " to " + hiTxt)) + "  (rough guess, " + n + " page" + (n === 1 ? "" : "s") + why + ")";
    }

    // Exact check: exports the selected artboards to a temporary PDF with the chosen
    // preset, reads its size, then deletes it. Uses the last SAVED version of the file.
    var btnCheck = outPnl.add("button", undefined, "Check exact size");
    btnCheck.alignment = "left";
    btnCheck.helpTip = "Makes a temporary PDF with this preset, measures it and deletes it. Takes about as long as an export.";
    btnCheck.onClick = function () {
        var n = selectedCount();
        if (n === 0) { styledAlert("Select at least one artboard first."); return; }
        var pname = ddPreset.selection ? ddPreset.selection.text : "";
        var ranges = [];
        for (var ri = 0; ri < abList.items.length; ri++) if (abList.items[ri].selected) ranges.push(abList.items[ri].abIndex + 1);
        var stamp2 = Math.floor(Math.random() * 1000000);
        var tmpAi = new File(Folder.temp.fsName + "/__std_chk_" + stamp2 + ".ai");
        var tmpPdf = new File(Folder.temp.fsName + "/__std_chk_" + stamp2 + ".pdf");
        var chkDoc = null;
        var prevLevel = app.userInteractionLevel;
        var msg = "";
        sizeTxt.text = "Checking the exact size... please wait";
        try { sizeTxt.parent.parent.update(); } catch (eUp) {}
        try {
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            if (!origFile.copy(tmpAi)) throw new Error("Could not make a temporary copy of the file.");
            chkDoc = app.open(tmpAi);
            var o = new PDFSaveOptions();
            if (pname !== "") o.pDFPreset = pname;
            o.compatibility = PDFCompatibility.ACROBAT7;
            o.generateThumbnails = false;
            o.viewAfterSaving = false;
            o.artboardRange = ranges.join(",");
            chkDoc.saveAs(tmpPdf, o);
            var bytes = tmpPdf.length;
            msg = "Exact size check: " + fmtMB(bytes).replace("under 1 MB", "under 1 MB (" + Math.round(bytes / 1024) + " KB)") + " for " + n + " page" + (n === 1 ? "" : "s") + ". The final file may differ slightly.";
            if (hasUnsaved) msg += " (Used the last saved version of the file.)";
        } catch (eChk) {
            msg = "Could not check the size: " + eChk.message;
        }
        try { if (chkDoc) chkDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eCl) {}
        try { app.activeDocument = sourceDoc; } catch (eAct) {}
        try { if (tmpAi.exists) tmpAi.remove(); } catch (eR1) {}
        try { if (tmpPdf.exists) tmpPdf.remove(); } catch (eR2) {}
        app.userInteractionLevel = prevLevel;
        sizeTxt.text = msg;
    };

    function buildFileName() {
        var pj = txtProject.text.replace(/\s+/g, "");
        var vr = txtVersion.text.replace(/\s+/g, "");
        return pj + "_Presentation_v" + vr;
    }
    function refreshPreview() {
        previewTxt.text = "File name: " + buildFileName() + ".pdf";
    }
    // Highest <project>_Presentation_v<N>.pdf in a folder (0 if none)
    function findLastVersion(folder, project) {
        var best = 0;
        try {
            if (!project || !folder || !folder.exists) return 0;
            var rx = new RegExp("^" + project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_Presentation_v(\\d+)\\.pdf$", "i");
            var files = folder.getFiles(function (x) { return x instanceof File; });
            for (var fi = 0; fi < files.length; fi++) {
                var m = decodeURI(files[fi].name).match(rx);
                if (m) {
                    var n = parseInt(m[1], 10);
                    if (n > best) best = n;
                }
            }
        } catch (eLV) {}
        return best;
    }

    // Highest <project>_Design Files_v<N> FOLDER near the open file: the file's own
    // folder and its parents (up to 8 levels), plus the folders next to it and
    // inside it. Returns { n, name } or null.
    function findDesignVersion(project) {
        try {
            if (!project) return null;
            var rx = new RegExp("^" + project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[ _\\-]*Design[ _\\-]*Files[ _\\-]*v(\\d+)\\s*$", "i");
            var best = null;
            var consider = function (folder) {
                var m = decodeURI(folder.name).match(rx);
                if (m) {
                    var n = parseInt(m[1], 10);
                    if (!best || n > best.n) best = { n: n, name: decodeURI(folder.name) };
                }
            };
            var cur = origFile.parent;
            for (var up = 0; up < 8 && cur; up++) {
                consider(cur);
                cur = cur.parent;
            }
            var around = [origFile.parent];
            if (origFile.parent && origFile.parent.parent) around.push(origFile.parent.parent);
            for (var a = 0; a < around.length; a++) {
                var subs = around[a].getFiles(function (x) { return x instanceof Folder; });
                for (var b = 0; b < subs.length; b++) consider(subs[b]);
            }
            return best;
        } catch (eDV) {}
        return null;
    }

    var versionTouched = false;     // true once the user typed a version themselves
    function refreshVersion() {
        var proj = txtProject.text.replace(/\s+/g, "");
        var last = findLastVersion(new Folder(txtFolder.text), proj);
        var base = 0;
        if (last > 0) {
            base = last;
            versionNote.text = "Last version found: v" + last;
        } else {
            var dv = findDesignVersion(proj);
            if (dv) {
                base = dv.n;
                versionNote.text = "No presentation found. Design files folder: " + dv.name;
            } else {
                versionNote.text = "No previous version found.";
            }
        }
        if (!versionTouched) {
            if (base > 0) txtVersion.text = String(chkOverwrite.value ? base : base + 1);
            else txtVersion.text = "1";
        }
        refreshPreview();
    }

    txtProject.onChanging = refreshPreview;
    txtVersion.onChanging = function () { versionTouched = true; refreshPreview(); };
    chkOverwrite.onClick = function () { versionTouched = false; refreshVersion(); };
    refreshPreview();

    // Pre-fill the output folder with the project's presentation folder
    function autoFolder() {
        if (folderTouched) return;
        var found = findPresentationFolder(txtProject.text.replace(/\s+/g, ""));
        if (found) {
            txtFolder.text = found.folder.fsName;
            folderNote.text = (found.version > 0
                ? "Folder of the last presentation (v" + found.version + "): "
                : "Presentation folder found: ") +
                shortPath(found.folder, txtProject.text.replace(/\s+/g, ""));
        } else {
            txtFolder.text = startFolder;
            folderNote.text = "No presentation folder found - using this file's folder: " +
                              shortPath(new Folder(startFolder), txtProject.text.replace(/\s+/g, ""));
        }
    }
    txtProject.onChange = function () { autoFolder(); refreshVersion(); };
    autoFolder();
    refreshVersion();

    var chkOpen = outPnl.add("checkbox", undefined, "Open the PDF when done");
    chkOpen.value = true;   // standard: always on when the window opens (never remembered)
    chkOpen.onClick = function () {
        // switching it off asks every time; the answer No puts the tick back
        if (!chkOpen.value) {
            var okOff = styledConfirm(
                "This script is still in testing.\n\n" +
                "Turning this option off makes you responsible for how the PDF is exported and how it shows in MSR.\n\n" +
                "Be advised: double-check the presentation.\n\nContinue?",
                "Standardize PDFs - Warning", true);
            if (!okOff) chkOpen.value = true;
        }
    };
    chkOpen.helpTip = "On (standard): the PDF opens when it is done, so you can check the presentation. Turning it off asks for confirmation every time.";

    var chkSave = outPnl.add("checkbox", undefined, "Save the open file first if it has unsaved changes");
    chkSave.value = (remembered("autosave", "1") === "1");
    chkSave.helpTip = "On: your open file is saved (overwritten) before exporting, so the PDF has your latest edits.\nOff: the PDF is built from the last saved version and unsaved changes are left out.";

    var chkRename = outPnl.add("checkbox", undefined, "After exporting, rename the selected artboards to Presentation");
    chkRename.value = true;   // never remembered: on every time the window opens
    chkRename.helpTip = "On: after a successful run, the artboards you selected are renamed in your open file to Presentation 1, Presentation 2... (in page order; just Presentation if only one), so the next run selects them by itself. The old names are overwritten. If \"Save the open file first\" is on, the file is saved with the new names. If it is off, the names are changed but not saved yet.\nOff: artboard names are left alone.\nNothing is renamed if the export fails.";
    var chkPng = outPnl.add("checkbox", undefined, "Also save the pages as PNG files in a zip");
    chkPng.value = false;   // never remembered: off for every client except Lacey (ticked below)
    // first time the window opens (not when the layout is switched): a Lacey folder ticks the PNG zip
    if (laceyFolder !== "" && !st) chkPng.value = true;
    if (laceyFolder !== "") {
        var laceyNote = outPnl.add("statictext", undefined, "Lacey: " + laceyHow + " confirmed, PNG zip is on");
        laceyNote.isNote = true;
        try { laceyNote.graphics.foregroundColor = laceyNote.graphics.newPen(laceyNote.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 0.4], 1); } catch (ePnL) {}
        laceyNote.margins = [20, 0, 0, 0];
    }
    var pngGrp = outPnl.add("group");
    pngGrp.orientation = "row";
    pngGrp.alignChildren = "center";
    pngGrp.margins = [20, 0, 0, 0];
    pngGrp.add("statictext", undefined, "PNG resolution:");
    var ddPng = pngGrp.add("dropdownlist", undefined, ["72 ppi", "150 ppi", "300 ppi"]);
    ddPng.preferredSize.width = 90;
    var wantPpi = remembered("pngppi", "150");
    ddPng.selection = (wantPpi === "72") ? 0 : (wantPpi === "300" ? 2 : 1);
    var chkPngKeep = outPnl.add("checkbox", undefined, "Keep the PNG files too (besides the zip)");
    chkPngKeep.value = (remembered("pngkeep", "0") === "1");
    chkPngKeep.margins = [20, 0, 0, 0];
    function refreshPng() {
        pngGrp.enabled = chkPng.value;
        chkPngKeep.enabled = chkPng.value;
    }
    chkPng.onClick = refreshPng;
    refreshPng();
    chkPng.helpTip = "Also saves each page of the presentation as a PNG (named like the PDF plus -1, -2, -3...) and puts them in a zip next to the PDF. The zip has the same name as the PDF (.zip instead of .pdf).";
    ddPng.helpTip = "Resolution of the PNG files. 150 ppi is the usual choice. A very large page is scaled down so no side goes over 16000 px.";
    chkPngKeep.helpTip = "Off: the loose PNG files are deleted once they are in the zip. On: they stay in a folder next to the zip.";

    var chkRemember = win.add("checkbox", undefined, "Remember these settings (size, height, margin, preset, auto-save, PNG resolution)");
    chkRemember.value = rememberOn;

    var note = win.add("statictext", undefined,
        "Works on a disposable copy of the saved file. Your open document is not touched or saved. " +
        "Each sign is scaled (uniformly) to fit its page, so small signs are enlarged.",
        { multiline: true });
    note.preferredSize.width = wide ? 880 : 420;

    var btnGrp = win.add("group");
    btnGrp.alignment = "right";
    var okBtn = btnGrp.add("button", undefined, "Run", { name: "ok" });
    var cancelBtn = btnGrp.add("button", undefined, "Close", { name: "cancel" });

    abList.onChange = refreshSize;
    ddPreset.onChange = refreshSize;
    refreshSize();
    var selIdx = [];      // artboard indices, in LIST order
    var selNames = [];

    function captureState() {
        var rows = [];
        for (var cq = 0; cq < abList.items.length; cq++) {
            var cit = abList.items[cq];
            rows.push({ text: cit.text, abIndex: cit.abIndex, abName: cit.abName, sel: cit.selected });
        }
        return {
            order: rows,
            mode: rbH85.value ? "h85" : (rbAuto.value ? "auto" : (rbCustom.value ? "custom" : "h11")),
            height: txtHeight.text, margin: txtMargin.text,
            preset: ddPreset.selection ? ddPreset.selection.text : "",
            folder: txtFolder.text, folderTouched: folderTouched,
            project: txtProject.text, version: txtVersion.text, versionTouched: versionTouched,
            overwrite: chkOverwrite.value, open: chkOpen.value, save: chkSave.value, remember: chkRemember.value,
            png: chkPng.value, pngIdx: (ddPng.selection ? ddPng.selection.index : 1), pngKeep: chkPngKeep.value,
            rename: chkRename.value
        };
    }

    // carry the user's choices over when the layout was switched
    if (st) {
        abList.removeAll();
        for (var sr = 0; sr < st.order.length; sr++) {
            var sli = abList.add("item", st.order[sr].text);
            sli.abIndex = st.order[sr].abIndex;
            sli.abName = st.order[sr].abName;
            sli.selected = st.order[sr].sel;
        }
        if (st.mode === "h85") rbH85.value = true;
        else if (st.mode === "auto") rbAuto.value = true;
        else if (st.mode === "custom") rbCustom.value = true;
        else rbH11.value = true;
        try { refreshSize(); } catch (eRS3) {}
        heightGrp.enabled = rbCustom.value;
        refreshPghNote();
        txtHeight.text = st.height;
        txtMargin.text = st.margin;
        for (var sp = 0; sp < presetNames.length; sp++) if (presetNames[sp] === st.preset) { ddPreset.selection = sp; break; }
        txtFolder.text = st.folder;
        folderTouched = st.folderTouched;
        txtProject.text = st.project;
        txtVersion.text = st.version;
        versionTouched = st.versionTouched;
        chkOverwrite.value = st.overwrite;
        chkOpen.value = st.open;
        chkSave.value = st.save;
        chkRemember.value = st.remember;
        chkPng.value = st.png;
        try { ddPng.selection = st.pngIdx; } catch (ePg) {}
        chkPngKeep.value = st.pngKeep;
        chkRename.value = (st.rename !== false);
        refreshPng();
        refreshPreview();
        scrollToFirstSelected();
    }
    okBtn.onClick = function () {
        selIdx = [];
        selNames = [];
        for (var k = 0; k < abList.items.length; k++) {
            if (abList.items[k].selected) {
                selIdx.push(abList.items[k].abIndex);
                selNames.push(abList.items[k].abName);
            }
        }
        if (selIdx.length === 0) {
            styledAlert("Select at least one artboard.");
            return;
        }

        if (rbCustom.value) {
            var hv = parseFloat(txtHeight.text);
            if (isNaN(hv) || hv <= 0) {
                styledAlert("Enter a valid page height in inches.");
                return;
            }
        }

        var pjVal = txtProject.text.replace(/\s+/g, "");
        var vrVal = txtVersion.text.replace(/\s+/g, "");
        if (!/^\d+$/.test(pjVal)) {
            styledAlert("Enter the project number (digits only).");
            return;
        }
        if (!/^\d+$/.test(vrVal)) {
            styledAlert("Enter the version as a number (digits only).");
            return;
        }

        var chkFolder = new Folder(txtFolder.text);
        if (!chkFolder.exists) {
            styledAlert("Output folder does not exist.");
            return;
        }
        var chkFile = new File(chkFolder.fsName + "/" + buildFileName() + ".pdf");
        if (chkFile.exists) {
            // is the existing file locked (for example still open in a PDF viewer)?
            var canWrite = false;
            try {
                canWrite = chkFile.open("a");
                if (canWrite) chkFile.close();
            } catch (eLock) { canWrite = false; }
            if (!canWrite) {
                styledAlert(
                    buildFileName() + ".pdf can't be overwritten - it is probably still open in a PDF viewer.\n\n" +
                    "Close it (or change the version number) and run again.",
                    "File Is Locked");
                return;
            }

            // with "Overwrite current" on, the user already chose to overwrite
            if (!chkOverwrite.value) {
                var okOverwrite = styledConfirm(
                    buildFileName() + ".pdf already exists in this folder.\n\nOverwrite it?",
                    "File Already Exists");
                if (!okOverwrite) return;
            }
        }

        ui.selIdx = selIdx;
        ui.selNames = selNames;
        win.close(1);
    };

    if (STYLED_UI) { paintBlue(win); styleRunButton(okBtn, BTN_RUN); }
    ui.win = win;
    ui.scrollTop = scrollToFirstSelected;
    ui.rbH85 = rbH85; ui.rbAuto = rbAuto; ui.rbCustom = rbCustom;
    ui.txtHeight = txtHeight; ui.txtMargin = txtMargin; ui.txtFolder = txtFolder;
    ui.txtProject = txtProject; ui.ddPreset = ddPreset;
    ui.chkOpen = chkOpen; ui.chkSave = chkSave; ui.chkRemember = chkRemember;
    ui.chkPng = chkPng; ui.ddPng = ddPng; ui.chkPngKeep = chkPngKeep; ui.chkRename = chkRename;
    ui.buildFileName = buildFileName;
    return ui;
    }   // end of buildDialog

    // The wide layout is the only layout (the tall one was removed in 1.5); an old saved "wide" setting is ignored
    var wideNow = true;
    var stCarry = null;
    var ui, result;
    while (true) {
        ui = buildDialog(wideNow, stCarry);
        // Place the main window at the standard spot (set after it opens,
        // because Illustrator re-centers dialogs on show), kept on screen
        ui.win.onShow = function () {
            try { ui.scrollTop(); } catch (eSt) {}   // auto-selected artboards stay at the top of the list
            try {
                var w = ui.win;
                if (!wideNow) { w.center(); return; }   // tall layout stays centered
                var wx = 90, wy = 140;
                var sc = $.screens[0];
                var ww = w.bounds.width, wh = w.bounds.height;
                if (wx + ww > sc.right - sc.left - 10) wx = Math.max(10, (sc.right - sc.left) - ww - 10);
                if (wy + wh > sc.bottom - sc.top - 40) wy = Math.max(10, (sc.bottom - sc.top) - wh - 40);
                w.location = [wx, wy];
            } catch (ePos) {}
        };
        result = ui.win.show();
        if (ui.switching === true) { wideNow = ui.switchTo; setPref("wide", wideNow ? "1" : "0"); stCarry = ui.state; continue; }
        break;
    }
    if (result !== 1) { TSP_RESULT = "WARNING: " + TSP_NAME + ": cancelled."; return; }

    var rbH85 = ui.rbH85, rbAuto = ui.rbAuto, rbCustom = ui.rbCustom;
    var txtHeight = ui.txtHeight, txtMargin = ui.txtMargin, txtFolder = ui.txtFolder;
    var txtProject = ui.txtProject, ddPreset = ui.ddPreset;
    var chkOpen = ui.chkOpen, chkSave = ui.chkSave, chkRemember = ui.chkRemember;
    var wantPng = ui.chkPng.value;
    var pngPpi = ui.ddPng.selection ? [72, 150, 300][ui.ddPng.selection.index] : 150;
    var keepPng = ui.chkPngKeep.value;
    var wantRename = ui.chkRename.value;
    var buildFileName = ui.buildFileName;
    var selIdx = ui.selIdx, selNames = ui.selNames;

    var sizeMode = rbH85.value ? "h85" : (rbAuto.value ? "auto" : (rbCustom.value ? "custom" : "h11"));
    var useAuto = (sizeMode === "auto");
    var fixedHeightIn = (sizeMode === "h85") ? 8.5 : (sizeMode === "custom" ? parseFloat(txtHeight.text) : 11);
    var marginIn = parseFloat(txtMargin.text);
    if (isNaN(marginIn) || marginIn < 0) marginIn = 0;
    var outFolderPath = txtFolder.text;
    var outFileName = buildFileName();
    var projectNum = txtProject.text.replace(/\s+/g, "");
    var presetName = ddPreset.selection ? ddPreset.selection.text : "";
    var openAfter = chkOpen.value;
    var autoSave = chkSave.value;

    // remember settings for next time - only when the checkbox is on
    setPref("remember", chkRemember.value ? "1" : "0");
    if (chkRemember.value) {
        setPref("mode", sizeMode === "h85" ? "h11" : sizeMode);   // 8.5" (Pittsburgh) is never remembered
        if (sizeMode === "custom" && !isNaN(fixedHeightIn) && fixedHeightIn > 0) setPref("height", fixedHeightIn);
        setPref("margin", marginIn);
        setPref("autosave", autoSave ? "1" : "0");
        setPref("pngppi", String(pngPpi));
        setPref("pngkeep", keepPng ? "1" : "0");
        if (presetName !== "") setPref("preset", presetName);
    }

    var outFolder = new Folder(outFolderPath);

    // Save the open file first, so the temporary copy has the latest edits
    var unsavedNote = "";
    if (hasUnsaved) {
        if (autoSave) {
            try {
                sourceDoc.save();
            } catch (eSave) {
                styledAlert("Could not save the open file, so nothing was exported.\n\n" + eSave.message +
                            "\n\nSave it yourself, or turn off \"Save the open file first\" to export the last saved version.");
                TSP_RESULT = "ERROR: " + TSP_NAME + ": could not save the open file.";
                return;
            }
        } else {
            unsavedNote = "Note: unsaved changes in the open file are NOT in this PDF.";
        }
    }

    // ---------------- Work on a disposable copy ----------------
    var stamp = Math.floor(Math.random() * 1000000);
    var tempFile = new File(Folder.temp.fsName + "/__std_pdf_" + stamp + ".ai");

    // Copy the saved file. Cloud files (iCloud/OneDrive placeholders) can fail the
    // normal copy, so there are fallbacks: byte copy, then a hidden copy next to the original.
    function copyLooksGood(f, src) {
        try { return f.exists && f.length > 0; } catch (eL) { return false; }
    }
    function byteCopy(src, dst) {
        var okB = false;
        try {
            src.encoding = "BINARY";
            if (!src.open("r")) return false;
            var data = src.read();
            src.close();
            dst.encoding = "BINARY";
            if (!dst.open("w")) return false;
            dst.write(data);
            dst.close();
            okB = true;
        } catch (eB) {
            try { src.close(); } catch (e1) {}
            try { dst.close(); } catch (e2) {}
        }
        return okB;
    }
    var copyOk = false;
    try { copyOk = origFile.copy(tempFile) && copyLooksGood(tempFile, origFile); } catch (eC1) {}
    if (!copyOk) {
        try { if (tempFile.exists) tempFile.remove(); } catch (eR1) {}
        copyOk = byteCopy(origFile, tempFile) && copyLooksGood(tempFile, origFile);
    }
    if (!copyOk) {
        try { if (tempFile.exists) tempFile.remove(); } catch (eR2) {}
        var altFile = new File(origFile.parent.fsName + "/.__std_pdf_" + stamp + ".ai");
        var altOk = false;
        try { altOk = (origFile.copy(altFile) || byteCopy(origFile, altFile)) && copyLooksGood(altFile, origFile); } catch (eC2) {}
        if (altOk) {
            tempFile = altFile;
            copyOk = true;
        } else {
            try { if (altFile.exists) altFile.remove(); } catch (eR3) {}
        }
    }
    var shellNote = "not tried";
    if (!copyOk && $.os.indexOf("Windows") >= 0) {
        // Last attempt: let Windows copy the file itself
        try {
            try { if (tempFile.exists) tempFile.remove(); } catch (eR4) {}
            app.system('cmd /c copy /y "' + origFile.fsName + '" "' + tempFile.fsName + '"');
            copyOk = copyLooksGood(tempFile, origFile);
            shellNote = copyOk ? "worked" : "ran, but no file appeared";
        } catch (eSh) { shellNote = "error: " + eSh; }
    }
    if (!copyOk) {
        var sizeNote = "?";
        try { sizeNote = String(origFile.length) + " bytes, exists: " + origFile.exists; } catch (eSz) {}
        var errNote = "";
        try { errNote = origFile.error || ""; } catch (eEr) {}
        styledAlert("Could not create a temporary copy of the file. Nothing was changed.\n\n" +
                    "File: " + origFile.fsName + "\nSize: " + sizeNote + (errNote ? "\nSystem message: " + errNote : "") +
                    "\nWindows copy: " + shellNote + "\n\n" +
                    "If this file is stored in iCloud or OneDrive, it may not be downloaded to this computer yet. " +
                    "In Finder or Explorer, right-click it and choose Download Now / Always Keep on This Device, " +
                    "wait for it to finish, then run the script again. Otherwise send me this message.");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": could not make a temporary copy of the file.";
        return;
    }

    var prevInteractionLevel = app.userInteractionLevel;
    forceCropBox();
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    var tempDoc = null;
    var newDoc = null;
    var jobs = [];            // { ab, name, rect, file, page } in LIST order
    var tempFilesToDelete = [];

    // Opens the temporary copy. 1) pop-ups hidden (normal), 2) pop-ups shown, 3) a hidden copy next to the original.
    function openCopy() {
        var why = [];
        var lvl = app.userInteractionLevel;
        try { return app.open(tempFile); } catch (eO1) { why.push("pop-ups hidden: " + eO1.message); }
        try {
            app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
            var d2 = app.open(tempFile);
            app.userInteractionLevel = lvl;
            return d2;
        } catch (eO2) { why.push("pop-ups shown: " + eO2.message); }
        app.userInteractionLevel = lvl;
        try {
            var nextTo = new File(origFile.parent.fsName + "/.__std_open_" + stamp + ".ai");
            if (origFile.copy(nextTo) || byteCopy(origFile, nextTo)) {
                tempFilesToDelete.push(nextTo);
                app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
                var d3 = app.open(nextTo);
                app.userInteractionLevel = lvl;
                return d3;
            }
            why.push("copy next to the original: could not be made");
        } catch (eO3) { why.push("copy next to the original: " + eO3.message); }
        app.userInteractionLevel = lvl;
        throw new Error("Illustrator would not open the copy of the file. " + why.join(" | "));
    }
    var emptySigns = [];
    var failedSigns = [];
    var exportMode = "";
    var step = "starting";
    var succeeded = false;
    var errMessage = "";
    var errLine = "";
    var pageW = 0, pageH = 0;

    // open + export + (measure if Auto) + place per sign + save
    var progress = makeProgress(selIdx.length * (useAuto ? 3 : 2) + 2);

    try {
        step = "opening the temporary copy";
        progress.tick("Opening a temporary copy...");
        tempDoc = openCopy();
        step = "activating the temporary copy";
        app.activeDocument = tempDoc;

        // ---- Step 1: skip artboards with no art (cheap bounds check) ----
        step = "checking which artboards have art";
        progress.set("Checking which artboards have art...");
        var topRects = collectTopLevelRects(tempDoc);   // null = unknown, assume all have art

        for (var s1 = 0; s1 < selIdx.length; s1++) {
            var i = selIdx[s1];
            var abRef = tempDoc.artboards[i];
            var abName = abRef.name;
            var abRect = abRef.artboardRect;
            if (topRects !== null && !artboardHasArt(topRects, abRect)) {
                emptySigns.push(abName);
                continue;
            }
            jobs.push({ ab: i, name: abName, rect: abRect, file: null, page: 0 });
        }

        if (jobs.length === 0) {
            throw new Error("None of the selected artboards have any art - nothing to export.");
        }

        // ---- Step 2: export one temporary PDF per artboard ----
        exportMode = "one temporary PDF per artboard";
        for (var j4 = 0; j4 < jobs.length; j4++) {
            var jb = jobs[j4];
            try {
                step = "artboard " + (jb.ab + 1) + " (" + jb.name + "): saving its temporary PDF";
                progress.tick("Exporting " + jb.name + " (" + (j4 + 1) + " of " + jobs.length + ")");
                var oneFile = new File(Folder.temp.fsName + "/__std_pdf_" + stamp + "_" + jb.ab + ".pdf");
                tempFilesToDelete.push(oneFile);
                tempDoc.artboards.setActiveArtboardIndex(jb.ab);
                tempDoc.saveAs(oneFile, makePdfOpts(String(jb.ab + 1)));
                if (oneFile.exists) {
                    jb.file = oneFile;
                    jb.page = 1;
                } else {
                    failedSigns.push(jb.name);
                }
            } catch (eOne) {
                failedSigns.push(jb.name + " [" + step + "] " + eOne.message);
            }
        }

        // keep only the artboards that exported
        var exported = [];
        for (var j6 = 0; j6 < jobs.length; j6++) {
            if (jobs[j6].file !== null) exported.push(jobs[j6]);
        }
        jobs = exported;

        // The disposable copy is no longer needed
        step = "closing the temporary copy";
        try { tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {}
        tempDoc = null;

        if (jobs.length === 0) {
            throw new Error("No artboards could be exported - nothing to build." +
                (failedSigns.length > 0 ? "\n\nDetails:\n- " + failedSigns.join("\n- ") : ""));
        }

        // ---- Step 3: decide the standard page size ----
        var marginPt = marginIn * 72;

        if (useAuto) {
            // Auto needs the real placed sizes: place each page once in a scratch doc
            var maxW = 0, maxH = 0;
            step = "creating the scratch measuring document";
            var measureDoc = app.documents.add(DocumentColorSpace.CMYK, 1000, 1000);
            app.activeDocument = measureDoc;
            for (var m = 0; m < jobs.length; m++) {
                progress.tick("Measuring " + jobs[m].name + " (" + (m + 1) + " of " + jobs.length + ")");
                try {
                    step = "measuring " + jobs[m].name + " (page " + jobs[m].page + "): placing it";
                    setPageToOpen(jobs[m].page);
                    var probe = measureDoc.placedItems.add();
                    probe.file = jobs[m].file;
                    var pb = probe.geometricBounds; // [left, top, right, bottom]
                    if ((pb[2] - pb[0]) > maxW) maxW = pb[2] - pb[0];
                    if ((pb[1] - pb[3]) > maxH) maxH = pb[1] - pb[3];
                    probe.remove();
                } catch (eProbe) {
                    failedSigns.push(jobs[m].name + " [" + step + "] " + eProbe.message);
                }
            }
            step = "closing the scratch measuring document";
            try { measureDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eM) {}
            measureDoc = null;

            if (maxW <= 0 || maxH <= 0) {
                throw new Error("Could not measure any of the exported pages." +
                    (failedSigns.length > 0 ? "\n\nDetails:\n- " + failedSigns.join("\n- ") : ""));
            }
            pageW = maxW + marginPt * 2;
            pageH = maxH + marginPt * 2;
        } else {
            // Fixed height: no measuring needed. The width follows the shape of
            // the largest sign, read straight from the artboard sizes (the
            // ratio is the same whatever the Large Canvas scale is).
            var maxAbW = 0, maxAbH = 0;
            for (var j5 = 0; j5 < jobs.length; j5++) {
                var rr = jobs[j5].rect;
                if ((rr[2] - rr[0]) > maxAbW) maxAbW = rr[2] - rr[0];
                if ((rr[1] - rr[3]) > maxAbH) maxAbH = rr[1] - rr[3];
            }
            if (maxAbW <= 0 || maxAbH <= 0) {
                throw new Error("Could not read the artboard sizes.");
            }
            pageH = fixedHeightIn * 72;
            pageW = pageH * (maxAbW / maxAbH);
        }

        // Illustrator's normal canvas tops out near 16383pt per side
        var capNote = "";
        var MAXPAGE = 14000;
        if (pageW > MAXPAGE || pageH > MAXPAGE) {
            var k = MAXPAGE / Math.max(pageW, pageH);
            pageW *= k;
            pageH *= k;
            marginPt *= k;
            capNote = "\n\nNote: the page was larger than Illustrator's canvas limit, so every page was reduced proportionally to fit.";
        }

        // ---- Step 4: build the standard-size document ----
        // Illustrator creates ALL the artboards at once (grid layout), so it
        // picks valid positions itself - no per-artboard add() calls.
        var gap = 72;

        var createNewDoc = function (n) {
            var rows = Math.max(1, Math.ceil(Math.sqrt(n)));
            step = "creating the standard-size document (" + (pageW / 72).toFixed(2) + " x " + (pageH / 72).toFixed(2) +
                   " in, " + n + " artboards, " + rows + " rows)";
            progress.set("Creating the standard-size document...");
            var d = app.documents.add(docColorSpace, pageW, pageH, n,
                                      DocumentArtboardLayout.GridByRow, gap, rows);
            app.activeDocument = d;
            return d;
        };

        var placedCount = 0;
        var ratioOff = [];     // pages whose placed shape differs from their artboard

        // Places every job on its own artboard, scaled to fit and centered.
        var placeAll = function () {
            placedCount = 0;
            for (var q2 = 0; q2 < jobs.length; q2++) {
                var job = jobs[q2];
                var label = "page " + (q2 + 1) + " (" + job.name + ")";
                progress.tick("Placing " + job.name + " (" + (q2 + 1) + " of " + jobs.length + ")");

                step = label + ": reading its artboard";
                var ab2 = newDoc.artboards[q2];
                var rect = ab2.artboardRect; // [left, top, right, bottom]

                step = label + ": naming its artboard";
                ab2.name = job.name;

                // place, scale uniformly to fit inside page minus margin, center
                step = label + ": placing its PDF (page " + job.page + ")";
                setPageToOpen(job.page);
                var item = newDoc.placedItems.add();
                item.file = job.file;

                // scale from the item's OWN placed size (no separate measuring pass)
                var ib0 = item.geometricBounds;
                var iw0 = ib0[2] - ib0[0];
                var ih0 = ib0[1] - ib0[3];
                if (iw0 <= 0 || ih0 <= 0) {
                    throw new Error(label + ": the placed PDF page has no size");
                }

                try {
                    var abRatio = (job.rect[2] - job.rect[0]) / (job.rect[1] - job.rect[3]);
                    var plRatio = iw0 / ih0;
                    if (abRatio > 0 && Math.abs(plRatio - abRatio) / abRatio > 0.005) ratioOff.push(job.name);
                } catch (eRatio) {}

                var availW = pageW - marginPt * 2;
                var availH = pageH - marginPt * 2;
                if (availW <= 0 || availH <= 0) { availW = pageW; availH = pageH; }

                var scale = Math.min(availW / iw0, availH / ih0);
                step = label + ": scaling it (" + (scale * 100).toFixed(1) + "%)";
                item.resize(scale * 100, scale * 100);

                step = label + ": centering it on artboard [" + rect.join(", ") + "]";
                var ib = item.geometricBounds;
                var iw = ib[2] - ib[0];
                var ih = ib[1] - ib[3];
                var cx = (rect[0] + rect[2]) / 2;
                var cy = (rect[1] + rect[3]) / 2;
                item.left = cx - iw / 2;
                item.top = cy + ih / 2;

                placedCount++;
            }
        };

        newDoc = createNewDoc(jobs.length);
        placeAll();

        if (placedCount === 0) {
            throw new Error("Nothing could be placed - no pages were built.");
        }

        // ---- Step 5: export one multi-page PDF ----
        progress.tick("Saving the final PDF...");
        var finalOpts = new PDFSaveOptions();
        if (presetName !== "") {
            // the preset decides compression, thumbnails, optimization, etc.
            finalOpts.pDFPreset = presetName;
        } else {
            // no preset available: explicit presentation-friendly settings
            // (150 ppi, JPEG) so the file does not come out huge
            finalOpts.generateThumbnails = false;
            try { finalOpts.colorDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE; } catch (f1) {}
            try { finalOpts.colorDownsampling = 150; } catch (f2) {}
            try { finalOpts.colorDownsamplingImageThreshold = 150; } catch (f3) {}
            try { finalOpts.grayscaleDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE; } catch (f4) {}
            try { finalOpts.grayscaleDownsampling = 150; } catch (f5) {}
            try { finalOpts.grayscaleDownsamplingImageThreshold = 150; } catch (f6) {}
        }
        finalOpts.compatibility = PDFCompatibility.ACROBAT7;
        finalOpts.viewAfterSaving = openAfter;
        finalOpts.artboardRange = "";

        var outFile = new File(outFolder.fsName + "/" + outFileName + ".pdf");
        step = "saving the final multi-page PDF";
        newDoc.saveAs(outFile, finalOpts);

        // ---- Optional: each page as a PNG (<PDF name>-1.png, <PDF name>-2.png...), then a zip next to the PDF ----
        // The PDF is already saved, so a problem here never loses it; it is only reported.
        var pngLine = "";
        var pngWarn = false;
        if (wantPng) {
            try {
                step = "saving the PNG files";
                progress.tick("Saving the PNG files...");
                var pngDir = new Folder(outFolder.fsName + "/" + outFileName + "_PNGs");
                if (pngDir.exists) {
                    var oldPngs = pngDir.getFiles();
                    for (var op = 0; op < oldPngs.length; op++) { try { if (oldPngs[op] instanceof File) oldPngs[op].remove(); } catch (eOp) {} }
                } else {
                    pngDir.create();
                }
                var pngScale = pngPpi / 72 * 100;
                var pngReduced = false;
                var bigSide = Math.max(newDoc.width, newDoc.height) / 72 * pngPpi;   // longest side in pixels
                if (bigSide > 16000) { pngScale = pngScale * 16000 / bigSide; pngReduced = true; }
                var pngCount = 0;
                var pageTotal = newDoc.artboards.length;
                for (var pn = 0; pn < pageTotal; pn++) {
                    step = "saving PNG " + (pn + 1) + " of " + pageTotal;
                    newDoc.artboards.setActiveArtboardIndex(pn);
                    var pOpts = new ExportOptionsPNG24();
                    pOpts.antiAliasing = true;
                    pOpts.transparency = false;
                    pOpts.artBoardClipping = true;
                    pOpts.horizontalScale = pngScale;
                    pOpts.verticalScale = pngScale;
                    newDoc.exportFile(new File(pngDir.fsName + "/" + outFileName + "-" + (pn + 1) + ".png"), ExportType.PNG24, pOpts);
                    pngCount++;
                }

                step = "making the zip";
                progress.tick("Making the zip...");
                var zipFile = new File(outFolder.fsName + "/" + outFileName + ".zip");
                try { if (zipFile.exists) zipFile.remove(); } catch (eZr) {}
                var isWinOS = ($.os.indexOf("Windows") !== -1);
                // Illustrator has no system.callSystem. Mac: app.system. Windows: a temporary .bat file is
                // run with File.execute (it does not wait, so the zip is waited for below) and its output
                // goes to a log file that is read back.
                var sysUsedBat = false;
                var runSys = function (cmd) {
                    if (!isWinOS) {
                        try { return app.system(cmd); } catch (eAs) { return "app.system: " + eAs.message; }
                    }
                    sysUsedBat = true;
                    var logF = new File(Folder.temp.fsName + "/tsp_zip_log.txt");
                    var doneF = new File(Folder.temp.fsName + "/tsp_zip_done.txt");
                    var batF = new File(Folder.temp.fsName + "/tsp_zip_run.bat");
                    try { if (logF.exists) logF.remove(); } catch (eL0) {}
                    try { if (doneF.exists) doneF.remove(); } catch (eL0b) {}
                    var line = String(cmd).replace(/\s*2>&1\s*$/, "");
                    batF.encoding = "UTF-8";
                    if (!batF.open("w")) return "could not write the temporary .bat file";
                    batF.write("@echo off\r\nchcp 65001 >nul\r\n" + line + " > \"" + logF.fsName + "\" 2>&1\r\necho done> \"" + doneF.fsName + "\"\r\n");
                    batF.close();
                    batF.execute();
                    // wait for the marker file (only checks that it exists, nothing is opened); up to 30 s
                    var finished = false;
                    for (var w = 0; w < 600; w++) {
                        $.sleep(50);
                        try { if (doneF.exists) { finished = true; break; } } catch (eL1) {}
                    }
                    var outTxt = finished ? "" : "timed out after 30 s";
                    if (finished) {
                        $.sleep(100);
                        try { if (logF.exists && logF.open("r")) { outTxt = logF.read(); logF.close(); } } catch (eL2) { try { logF.close(); } catch (eL2b) {} }
                    }
                    try { batF.remove(); } catch (eL3) {}
                    try { logF.remove(); } catch (eL4) {}
                    try { doneF.remove(); } catch (eL5) {}
                    return outTxt;
                };
                var zipMsgs = [];
                var zipExists = function () { try { return zipFile.exists && zipFile.length > 0; } catch (eZx) { return false; } };
                var zipNote = function (label, out) {
                    var t = String(out === undefined || out === null ? "" : out).replace(/[\r\n]+/g, " ").replace(/^\s+|\s+$/g, "");
                    if (t.length > 160) t = t.substring(0, 160) + "...";
                    zipMsgs.push(label + ": " + (t === "" ? "no message" : t));
                };
                try {
                    if (isWinOS) {
                        var psQ = function (t) { return String(t).replace(/'/g, "''"); };
                        // 1st try: PowerShell Compress-Archive
                        var psCmd = "Get-ChildItem -LiteralPath '" + psQ(pngDir.fsName) + "' -File | Compress-Archive -DestinationPath '" + psQ(zipFile.fsName) + "' -Force";
                        var r1 = runSys("powershell -NoProfile -ExecutionPolicy Bypass -Command \"" + psCmd + "\" 2>&1");
                        if (!zipExists()) {
                            zipNote("PowerShell", r1);
                            // 2nd try: tar.exe ships with Windows 10 and later and can write zip files
                            try { if (zipFile.exists) zipFile.remove(); } catch (eZt2) {}
                            var r2 = runSys("cmd /c \"cd /d \"" + pngDir.fsName + "\" && tar -a -c -f \"" + zipFile.fsName + "\" *.png\" 2>&1");
                            if (!zipExists()) {
                                zipNote("tar", r2);
                                // 3rd try: the .NET zip class, through PowerShell
                                try { if (zipFile.exists) zipFile.remove(); } catch (eZt3) {}
                                var netCmd = "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('" + psQ(pngDir.fsName) + "', '" + psQ(zipFile.fsName) + "')";
                                var r3 = runSys("powershell -NoProfile -ExecutionPolicy Bypass -Command \"" + netCmd + "\" 2>&1");
                                if (!zipExists()) zipNote(".NET", r3);
                            }
                        }
                    } else {
                        var shQ = function (t) { return String(t).replace(/(["\\$`])/g, "\\$1"); };
                        var r4 = runSys("cd \"" + shQ(pngDir.fsName) + "\" && zip -q \"" + shQ(zipFile.fsName) + "\" *.png 2>&1");
                        if (!zipExists()) zipNote("zip", r4);
                    }
                } catch (eZip) { zipNote("script", eZip.message); }
                var zipOk = false;
                try { zipOk = zipFile.exists && zipFile.length > 0; } catch (eZe) {}

                if (zipOk) {
                    var zipMB = "";
                    try { zipMB = (zipFile.length / (1024 * 1024)).toFixed(1) + " MB"; } catch (eZm) {}
                    pngLine = "PNG: " + pngCount + " file" + (pngCount === 1 ? "" : "s") + " in " + decodeURI(zipFile.name) +
                              " (" + pngPpi + " ppi" + (zipMB !== "" ? ", " + zipMB : "") + ")" + (pngReduced ? ", scaled down to fit 16000 px" : "") +
                              (keepPng ? ", PNG files kept" : "");
                    if (!keepPng) {
                        var madePngs = pngDir.getFiles();
                        for (var mp = 0; mp < madePngs.length; mp++) { try { madePngs[mp].remove(); } catch (eMp) {} }
                        try { pngDir.remove(); } catch (eMd) {}
                    }
                } else {
                    pngWarn = true;
                    pngLine = "The zip could not be made on this computer. The " + pngCount + " PNG file" + (pngCount === 1 ? " is" : "s are") + " in the folder " + decodeURI(pngDir.name) + "." +
                              (zipMsgs.length ? "  [" + zipMsgs.join("  |  ") + "]" : "");
                }
            } catch (ePng) {
                pngWarn = true;
                pngLine = "The PNG export stopped (" + step + "): " + ePng.message + ". The PDF was saved.";
            }
        }

        // The PDF is already saved. If Illustrator already closed this document ("there is no document"),
        // that is fine: it is only cleanup, so it never stops the script or reports an error.
        step = "closing the standard-size document";
        try { newDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eNc) {}
        newDoc = null;

        succeeded = true;
        progress.finish();
        progress.close();
        app.userInteractionLevel = prevInteractionLevel;

        // ---- Optional: rename the artboards that went into the PDF, in the open file ----
        // Only after a fully successful export. Page order = list order. Skipped (empty) and failed
        // artboards are not renamed. A problem here is only reported; the PDF is already saved.
        var renameNote = "";
        if (wantRename) {
            try {
                app.activeDocument = sourceDoc;
                var renamedCount = 0;
                for (var rn = 0; rn < jobs.length; rn++) {
                    sourceDoc.artboards[jobs[rn].ab].name = (jobs.length === 1) ? "Presentation" : ("Presentation " + (rn + 1));
                    renamedCount++;
                }
                if (renamedCount > 0) {
                    if (autoSave) {
                        try {
                            sourceDoc.save();
                            renameNote = "Artboards renamed to Presentation and the file was saved.";
                        } catch (eRs) {
                            renameNote = "Artboards renamed to Presentation, but the file could NOT be saved. Save it yourself.";
                        }
                    } else {
                        renameNote = "Artboards renamed to Presentation. The file is NOT saved yet - save it to keep the names.";
                    }
                }
            } catch (eRn) {
                renameNote = "The artboards could not be renamed: " + eRn.message;
            }
        }

        TSP_RESULT = (pngWarn ? "WARNING: " : "SUCCESS: ") + TSP_NAME + ": done, " + placedCount + " page" + (placedCount === 1 ? "" : "s") + " in " + outFileName + ".pdf" +
                     (pngWarn ? " (PNG zip not made)" : (wantPng ? " + PNG zip" : ""));
        var ratioNote = (ratioOff.length > 0)
            ? ("Check these pages, their shape is not the same as their artboard (blank space is possible): " + ratioOff.join(", ") + ".")
            : "";
        var notesAll = [];
        if (capNote !== "") notesAll.push(capNote.replace(/^\s+/, ""));
        if (unsavedNote !== "") notesAll.push(unsavedNote);
        if (ratioNote !== "") notesAll.push(ratioNote);
        if (renameNote !== "") notesAll.push(renameNote);
        showDoneDialog(outFile, placedCount, pageW / 72, pageH / 72, projectNum, presetName,
                       emptySigns, failedSigns, notesAll.join("  "), pngLine);

    } catch (e) {
        errMessage = String(e.message);
        errLine = (e.line !== undefined) ? String(e.line) : "?";
        progress.close();
        app.userInteractionLevel = prevInteractionLevel;
        try { if (newDoc && !isSourceDoc(newDoc)) newDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e1) {}
        try { if (tempDoc && !isSourceDoc(tempDoc)) tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    } finally {
        restoreCropBox();
        // Always clean up the temp files
        try { if (tempFile.exists) tempFile.remove(); } catch (e3) {}
        for (var d = 0; d < tempFilesToDelete.length; d++) {
            try { if (tempFilesToDelete[d].exists) tempFilesToDelete[d].remove(); } catch (e4) {}
        }
    }

    // ---------------- failure: offer a report ----------------
    if (!succeeded) {
        var report = "";
        report += SCRIPT_NAME + " - Error Report\n";
        report += "==============================\n";
        report += "Date: " + (new Date()).toString() + "\n";
        report += "Illustrator version: " + app.version + "\n";
        report += "OS: " + $.os + "\n";
        report += "Source file: " + (sourceName !== "" ? sourceName : "(unknown)") + "\n";
        report += "Original file still open: " + (sourceStillOpen() ? "yes" : "NO - Illustrator no longer has it open") + "\n";
        try {
            var openNames = [];
            for (var od = 0; od < app.documents.length; od++) { try { openNames.push(app.documents[od].name); } catch (eOn) { openNames.push("(unreadable)"); } }
            report += "Open documents: " + (openNames.length === 0 ? "(none)" : openNames.join(" | ")) + "\n";
        } catch (eOd) {}
        report += "\nFailed at step: " + step + "\n";
        report += "Error: " + errMessage + " (script line " + errLine + ")\n";
        report += "\nSettings:\n";
        report += "  Page size mode: " + (useAuto ? "Auto" : ("Fixed height " + fixedHeightIn + " in (" + sizeMode + ")")) + "\n";
        report += "  Export method: " + (exportMode === "" ? "(not reached)" : exportMode) + "\n";
        report += "  Margin (in): " + marginIn + "\n";
        report += "  Output file: " + outFileName + ".pdf\n";
        report += "  PDF preset: " + (presetName === "" ? "(none - explicit settings)" : presetName) + "\n";
        report += "  Page size used (pt): " + pageW.toFixed(1) + " x " + pageH.toFixed(1) + "\n";
        report += "\nSelected artboards (in order): " + selNames.join(" | ") + "\n";
        report += "Artboards with art: " + jobs.length + "\n";
        if (emptySigns.length > 0) report += "No art on: " + emptySigns.join(" | ") + "\n";
        if (failedSigns.length > 0) report += "Failed artboards:\n  - " + failedSigns.join("\n  - ") + "\n";

        TSP_RESULT = "ERROR: " + TSP_NAME + ": " + errMessage;
        showErrorDialog("Step: " + step + "\n" + errMessage, report);
    }
}

main();

// last value of the file = what Sign Pack Tools shows in its status bar
(TSP_RESULT === "" ? ("WARNING: " + TSP_NAME + ": cancelled.") : TSP_RESULT);
