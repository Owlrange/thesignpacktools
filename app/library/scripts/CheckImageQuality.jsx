// ============================================================
//  Check Image Quality 1.2  —  DPI Inspector
//  Changes from 1.1:
//   - Floating palette: you can pan/zoom/work while it's open
//   - Each image is scanned inside its own error trap, so one
//     broken/missing link can't cut the report short
//   - Sort buttons show the current direction (▲/▼)
// ============================================================

#target illustrator
#targetengine "signpack_dpi"

function main() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var allImages = [];
    var scanErrors = 0;

    // Captured up-front while we still have document access: palette
    // callbacks can't touch the document, so Save uses these strings
    var docName = doc.name;
    var docSavedPath = "";
    try { if (doc.saved) docSavedPath = doc.fullName.path; } catch (eDp) {}

    try {
        // kind + idx let Focus find the item again from the main engine
        for (var i = 0; i < doc.placedItems.length; i++) allImages.push({ item: doc.placedItems[i], kind: "placed", idx: i });
        for (var i = 0; i < doc.rasterItems.length; i++) allImages.push({ item: doc.rasterItems[i], kind: "raster", idx: i });
    } catch (eCollect) {}

    var imageList = [];
    var lowDpiCount = 0;

    // Detect if this is a Large Canvas (scaleFactor will be 10)
    var sf = 1;
    try { if (doc.scaleFactor) sf = doc.scaleFactor; } catch (eSf) {}

    for (var i = 0; i < allImages.length; i++) {
        // Everything per-image is trapped: a single broken link,
        // missing file, or odd item can't stop the rest of the scan
        try {
            var item = allImages[i].item;
            var ppi = 0;

            try {
                var m = item.matrix;
                var scaleX = Math.sqrt(m.mValueA * m.mValueA + m.mValueB * m.mValueB);
                scaleX = scaleX * sf;
                if (scaleX > 0) ppi = Math.round(72 / scaleX);
            } catch (e) {}

            var isLow = (ppi > 0 && ppi < 150);
            if (isLow) lowDpiCount++;

            var itemName = "Unnamed Image";
            try {
                itemName = item.name ||
                    (item.typename === "PlacedItem" && item.file
                        ? (item.file.displayName || item.file.name)
                        : "Unnamed Image");
            } catch (eName) {}

            imageList.push({ kind: allImages[i].kind, idx: allImages[i].idx, name: itemName, ppi: ppi, isLow: isLow });
        } catch (eItem) {
            scanErrors++;
        }
    }

    // Close a previous instance of the palette if one is still open
    try {
        if ($.global.__dpiWin && $.global.__dpiWin instanceof Window) {
            $.global.__dpiWin.close();
        }
    } catch (ePrev) {}

    var win = new Window("palette", "DPI Inspector");
    $.global.__dpiWin = win;
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 20;
    win.spacing = 15;

    var headerGroup = win.add("group");
    headerGroup.orientation = "column";
    headerGroup.alignChildren = ["center", "center"];
    var titleText = headerGroup.add("statictext", undefined, "Image DPI Overview");
    titleText.graphics.font = ScriptUI.newFont("dialog", "BOLD", 16);

    if (lowDpiCount > 0) {
        var warningPanel = win.add("panel", undefined, "Action Required");
        warningPanel.margins = 15;
        warningPanel.alignChildren = ["center", "center"];

        var warningText = warningPanel.add("statictext", undefined, "[!] " + lowDpiCount + " image(s) are below 150 DPI!");
        warningText.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
        warningText.graphics.foregroundColor = warningText.graphics.newPen(warningText.graphics.PenType.SOLID_COLOR, [0.8, 0, 0], 1);
    }

    if (scanErrors > 0) {
        var errNote = win.add("statictext", undefined, scanErrors + " image(s) could not be read (broken/missing links?) and were skipped.");
    }

    var listGroup = win.add("group");
    listGroup.orientation = "column";
    listGroup.alignChildren = ["fill", "center"];
    listGroup.spacing = 8;

    // Sort Buttons (labels show the direction of the NEXT click's sort)
    var sortGroup = listGroup.add("group");
    sortGroup.orientation = "row";
    sortGroup.alignChildren = ["left", "center"];
    var btnSortDPI = sortGroup.add("button", undefined, "Sort by DPI \u25B2");
    var btnSortName = sortGroup.add("button", undefined, "Sort by Name \u25B2");

    var list = listGroup.add("listbox", undefined, [], {
        numberOfColumns: 2,
        showHeaders: true,
        columnTitles: ["DPI Status", "Image Name"]
    });
    list.preferredSize.width = 400;
    list.preferredSize.height = 200;

    function renderList() {
        list.removeAll();
        for (var j = 0; j < imageList.length; j++) {
            var data = imageList[j];
            var dpiText = data.ppi + " DPI";
            if (data.isLow) dpiText = "[LOW] " + dpiText;

            var listItem = list.add("item", dpiText);
            listItem.subItems[0].text = data.name;
        }
    }

    var dpiAscending = true;
    btnSortDPI.onClick = function () {
        imageList.sort(function (a, b) {
            return dpiAscending ? (a.ppi - b.ppi) : (b.ppi - a.ppi);
        });
        // Arrow shows what just happened; toggle for the next click
        btnSortDPI.text = "Sort by DPI " + (dpiAscending ? "\u25B2" : "\u25BC");
        dpiAscending = !dpiAscending;
        renderList();
    };

    var nameAscending = true;
    btnSortName.onClick = function () {
        imageList.sort(function (a, b) {
            var nameA = a.name.toLowerCase();
            var nameB = b.name.toLowerCase();
            if (nameA < nameB) return nameAscending ? -1 : 1;
            if (nameA > nameB) return nameAscending ? 1 : -1;
            return 0;
        });
        btnSortName.text = "Sort by Name " + (nameAscending ? "\u25B2" : "\u25BC");
        nameAscending = !nameAscending;
        renderList();
    };

    // Initial Sort (Lowest DPI first)
    btnSortDPI.notify("onClick");

    var btnGroup = win.add("group");
    btnGroup.orientation = "row";
    btnGroup.alignChildren = ["center", "center"];
    btnGroup.spacing = 15;

    var btnFocus = btnGroup.add("button", undefined, "Focus Image");
    btnFocus.preferredSize.height = 30;

    var btnSave = btnGroup.add("button", undefined, "Save Report (.txt)");
    btnSave.preferredSize.height = 30;

    var btnClose = btnGroup.add("button", undefined, "Close");
    btnClose.preferredSize.height = 30;

    // Runs in Illustrator's MAIN engine via BridgeTalk (self-contained).
    // Finds the image again by collection + index — valid as long as
    // images haven't been added/removed since the scan (re-run if so).
    function focusImageDoc(kind, idx) {
        try {
            var doc = app.activeDocument;
            var targetItem = (kind === "placed") ? doc.placedItems[idx] : doc.rasterItems[idx];

            doc.selection = null;

            targetItem.hidden = false;
            targetItem.locked = false;
            var parent = targetItem.parent;
            while (parent && parent.typename !== "Document") {
                if (parent.hasOwnProperty("locked")) parent.locked = false;
                if (parent.hasOwnProperty("hidden")) parent.hidden = false;
                parent = parent.parent;
            }

            targetItem.selected = true;

            var view = doc.activeView;
            view.centerPoint = [
                targetItem.position[0] + targetItem.width / 2,
                targetItem.position[1] - targetItem.height / 2
            ];

            app.redraw();
        } catch (e) {
            alert("Could not select the item. If images were added or removed since the scan, re-run the script.\n" + e);
        }
    }

    var doFocus = function () {
        if (list.selection !== null) {
            var selectedData = imageList[list.selection.index];
            var bt = new BridgeTalk();
            bt.target = "illustrator";
            bt.body = "(" + String(focusImageDoc) + ')("' + selectedData.kind + '", ' + selectedData.idx + ");";
            bt.send();
        }
    };

    btnFocus.onClick = doFocus;
    list.onDoubleClick = doFocus;

    btnSave.onClick = function () {
        try {
            var filePath = (docSavedPath !== "") ? docSavedPath + "/ImageDPI_Report.txt" : Folder.desktop + "/ImageDPI_Report.txt";
            var f = new File(filePath);
            f.encoding = "UTF-8";
            f.open("w");
            f.writeln("Image DPI Report for: " + docName);
            f.writeln("--------------------------------");
            for (var j = 0; j < imageList.length; j++) {
                var data = imageList[j];
                var status = data.isLow ? "[LOW] " : "";
                f.writeln(status + data.ppi + " DPI  |  " + data.name);
            }
            f.close();
            alert("Report saved to:\n" + f.fsName);
        } catch (e) {
            alert("Error saving file: " + e);
        }
    };

    btnClose.onClick = function () { win.close(); };

    win.location = [110, 155];
    win.show();
}

main();
