/*
  Standardize PDFs 1.4
  Author: Joao Victor Malz
  Copyright: (c) 2026 Joao Victor Malz
  Created for use at The Sign Pack
  ---------------------------------------------------------
  Changes from 1.2:
    - The company logo (white on dark UI, black on light UI) shows at the
      top of the main window, with the title next to it.
    - Buttons: Run on the left, Close on the right.
    - The output folder is now found by looking for the project's existing
      <project>_Presentation_v<N>.pdf files first (own folder, project
      folder and the folders inside it). The folder holding the highest
      version wins, so the next version lands next to the last one
      (e.g. ...\Design Files with v2 in it -> v3 goes there).
    - Folders named like Fonts, Links, Old, Archive or Backup are skipped,
      so a font file called "Presentation File Font" is no longer picked.
    - Folders with "presentation" in the name are only the second choice.
  Changes from 1.1 (kept for reference):
    - New "Wide layout" checkbox at the top of the window:
      the same options in two columns, about half as tall, so the Run button
      stays on screen on small displays. Switching keeps everything you
      already chose.
    - The layout choice is saved as soon as you switch, even with
      "Remember these settings" off. With nothing saved, a short screen
      (up to 820 px) starts wide.
    - Cancel, Esc and the window X now close the script (they used to
      reopen the window after switching layout).
    - Wide layout opens at the standard spot (90, 140), kept on screen;
      the tall layout stays centered like before.
    - Cloud files (iCloud / OneDrive): if the temporary copy fails, it now
      tries a byte-by-byte copy, then a hidden copy next to the original,
      and shows a clear "Download Now" message if everything fails.
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
var TSP_NAME = "Standardize PDFs 1.4";
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


    var SCRIPT_NAME = "Standardize PDFs 1.4";

    var PREF = "signpack/standardizepdf/";

    if (app.documents.length === 0) {
        styledAlert("Open a document first.");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": no document is open.";
        return;
    }

    var sourceDoc = app.activeDocument;

    var origFile = null;
    try { origFile = sourceDoc.fullName; } catch (eFN) { origFile = null; }
    if (!origFile || !origFile.exists) {
        styledAlert("Please save this document to disk first (the script works on a copy of the saved file).");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": save the file first.";
        return;
    }
    var hasUnsaved = false;
    try { hasUnsaved = !sourceDoc.saved; } catch (eSv) {}

    // Pittsburgh: the client folder is always "FASTSIGNS Of Pittsburgh" (any capitals).
    // Looks at the whole folder path, so it works under Production 5's / 6's files alike.
    var pghFolder = "";
    try {
        var pghParts = String(origFile.parent.fsName).replace(/\\/g, "/").split("/");
        for (var pp = 0; pp < pghParts.length; pp++) {
            if (/fastsigns[\s_\-]*of[\s_\-]*pittsburgh/i.test(pghParts[pp])) { pghFolder = pghParts[pp]; break; }
        }
    } catch (ePgh) {}

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
    function showDoneDialog(outFile, pages, pageWin, pageHin, projectNum, presetUsed, emptyList, failedList, note) {
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
    function styledConfirm(message, title) {
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
        var btnYes = btnGroup.add("button", undefined, "Yes", { name: "ok" });
        btnYes.preferredSize.width = 90;
        var btnNo = btnGroup.add("button", undefined, "No", { name: "cancel" });
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
    // Built by a function so the layout can be switched (tall / wide) while the
    // dialog is open. "st" carries the user's choices over to the rebuilt dialog.
    function buildDialog(wide, st) {
    var ui = {};
    var win = new Window("dialog", SCRIPT_NAME);
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = uik().MARGINS;
    win.spacing = uik().SPACING;

    var topGrp = win.add("group");
    topGrp.alignment = ["fill", "top"];
    topGrp.alignChildren = ["left", "center"];
    topGrp.spacing = 10;
    addLogo(topGrp, win);
    var topTitle = topGrp.add("statictext", undefined, "Standardize PDFs");
    try { topTitle.graphics.font = ScriptUI.newFont("dialog", "BOLD", uik().TITLE_SIZE); } catch (eTT) {}
    var topSpacer = topGrp.add("group");
    topSpacer.alignment = ["fill", "center"];
    var chkWide = topGrp.add("checkbox", undefined, "Wide layout");
    chkWide.alignment = ["right", "center"];
    chkWide.value = wide;

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
    // nothing pre-selected: the user picks which artboards to export

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

    // Selecting items one by one makes the list scroll to the last one;
    // scroll back to the first selected item so the top of the selection stays in view.
    function scrollToFirstSelected() {
        try {
            for (var q = 0; q < abList.items.length; q++) {
                if (abList.items[q].selected) {
                    abList.revealItem(abList.items[0]);   // start from the very top
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
        for (var q = 0; q < abList.items.length; q++) {
            var nm = String(abList.items[q].abName).toLowerCase();
            abList.items[q].selected = (nm.indexOf("presentation") !== -1 && nm.indexOf("proof") === -1);
        }
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
        try { pghNote.graphics.foregroundColor = pghNote.graphics.newPen(pghNote.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 0.4], 1); } catch (ePn) {}
    }
    var rbH11 = sizePnl.add("radiobutton", undefined, "11\" height (default)");
    var rbH85 = sizePnl.add("radiobutton", undefined, "8.5\" height  -  Pittsburgh");
    var rbAuto = sizePnl.add("radiobutton", undefined, "Auto (size of the largest selected sign - slower)");
    var rbCustom = sizePnl.add("radiobutton", undefined, "Custom height:");

    var heightGrp = sizePnl.add("group");
    heightGrp.orientation = "row";
    heightGrp.alignChildren = "center";
    heightGrp.margins = [20, 0, 0, 0];
    heightGrp.add("statictext", undefined, "Height:");
    var txtHeight = heightGrp.add("edittext", undefined, remembered("height", "11"));
    txtHeight.characters = 6;
    heightGrp.add("statictext", undefined, "in  (width follows the largest sign's shape)");

    var savedMode = remembered("mode", "h11");
    if (savedMode === "height") savedMode = "custom";   // older saved value
    if (savedMode === "h85") rbH85.value = true;
    else if (savedMode === "auto") rbAuto.value = true;
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
            ? "Pittsburgh confirmed (folder: " + pghFolder + ")"
            : "Pittsburgh folder found (" + pghFolder + "), but another size is picked.";
    }
    rbH11.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbH85.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbAuto.onClick = function () { heightGrp.enabled = false; refreshPghNote(); };
    rbCustom.onClick = function () { heightGrp.enabled = true; refreshPghNote(); };
    refreshPghNote();

    var marginGrp = sizePnl.add("group");
    marginGrp.orientation = "row";
    marginGrp.add("statictext", undefined, "Margin around each sign (in):");
    var txtMargin = marginGrp.add("edittext", undefined, remembered("margin", "0"));
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
    chkOpen.value = (remembered("open", "1") === "1");

    var chkSave = outPnl.add("checkbox", undefined, "Save the open file first if it has unsaved changes");
    chkSave.value = (remembered("autosave", "1") === "1");
    chkSave.helpTip = "On: your open file is saved (overwritten) before exporting, so the PDF has your latest edits.\nOff: the PDF is built from the last saved version and unsaved changes are left out.";

    var chkRemember = win.add("checkbox", undefined, "Remember these settings (layout, size, height, margin, preset, open when done, auto-save)");
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
            overwrite: chkOverwrite.value, open: chkOpen.value, save: chkSave.value, remember: chkRemember.value
        };
    }
    chkWide.onClick = function () {
        ui.switchTo = chkWide.value;
        ui.state = captureState();
        ui.switching = true;
        win.close(2);
    };

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

    ui.win = win;
    ui.rbH85 = rbH85; ui.rbAuto = rbAuto; ui.rbCustom = rbCustom;
    ui.txtHeight = txtHeight; ui.txtMargin = txtMargin; ui.txtFolder = txtFolder;
    ui.txtProject = txtProject; ui.ddPreset = ddPreset;
    ui.chkOpen = chkOpen; ui.chkSave = chkSave; ui.chkRemember = chkRemember;
    ui.buildFileName = buildFileName;
    return ui;
    }   // end of buildDialog

    // wide layout: remembered with the other settings; with nothing saved, a short screen starts wide
    var wideSaved = getPref("wide", "");
    var screenH = 0;
    try { screenH = $.screens[0].bottom - $.screens[0].top; } catch (eScr) {}
    var wideNow = (wideSaved !== "") ? (wideSaved === "1") : (screenH > 0 && screenH <= 820);
    var stCarry = null;
    var ui, result;
    while (true) {
        ui = buildDialog(wideNow, stCarry);
        // Place the main window at the standard spot (set after it opens,
        // because Illustrator re-centers dialogs on show), kept on screen
        ui.win.onShow = function () {
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
        setPref("mode", sizeMode);
        if (sizeMode === "custom" && !isNaN(fixedHeightIn) && fixedHeightIn > 0) setPref("height", fixedHeightIn);
        setPref("margin", marginIn);
        setPref("open", openAfter ? "1" : "0");
        setPref("autosave", autoSave ? "1" : "0");
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
        try { return f.exists && f.length > 0 && f.length === src.length; } catch (eL) { return false; }
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
    if (!copyOk) {
        styledAlert("Could not create a temporary copy of the file. Nothing was changed.\n\n" +
                    "If this file is stored in iCloud or OneDrive, it may not be downloaded to this computer yet. " +
                    "In Finder or Explorer, right-click it and choose Download Now / Always Keep on This Device, " +
                    "wait for it to finish, then run the script again.");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": could not make a temporary copy of the file.";
        return;
    }

    var prevInteractionLevel = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    var tempDoc = null;
    var newDoc = null;
    var jobs = [];            // { ab, name, rect, file, page } in LIST order
    var tempFilesToDelete = [];
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
        tempDoc = app.open(tempFile);
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

        step = "closing the standard-size document";
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
        newDoc = null;

        succeeded = true;
        progress.finish();
        progress.close();
        app.userInteractionLevel = prevInteractionLevel;

        TSP_RESULT = "SUCCESS: " + TSP_NAME + ": done, " + placedCount + " page" + (placedCount === 1 ? "" : "s") + " in " + outFileName + ".pdf";
        showDoneDialog(outFile, placedCount, pageW / 72, pageH / 72, projectNum, presetName,
                       emptySigns, failedSigns,
                       (capNote.replace(/^\s+/, "") + (capNote !== "" && unsavedNote !== "" ? "  " : "") + unsavedNote));

    } catch (e) {
        errMessage = String(e.message);
        errLine = (e.line !== undefined) ? String(e.line) : "?";
        progress.close();
        app.userInteractionLevel = prevInteractionLevel;
        try { if (newDoc) newDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e1) {}
        try { if (tempDoc) tempDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    } finally {
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
        report += "Source file: " + sourceDoc.name + "\n";
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
