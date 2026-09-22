// ============================================================
//  Check All Colors 1.4
//  Version: 1.4 (enhanced)
//
//  Enhancements from 1.3:
//   - Suppressed alerts during scan (broken links won't spam dialogs)
//   - $.gc() called after scan to free memory before building UI
//   - Last-used report path saved to preferences
//   - SCRIPT_VERSION variable for programmatic tracking
//   - Version shown in palette title bar
// ============================================================

#target illustrator
#targetengine "signpack_colors"

var SCRIPT_VERSION = "1.4";

function main() {
    if (app.documents.length === 0) {
        alert("No document open.");
        return;
    }

    var doc = app.activeDocument;
    var usedColors = {};
    var colorCache = {};

    // ---- Unified error handler ----
    function safeExecute(func, errorMessage) {
        try {
            return func();
        } catch (e) {
            return null;
        }
    }

    // ---- Preference helpers ----
    function loadPref(key, fallback) {
        try {
            var val = app.preferences.getStringPreference(key);
            if (val !== "" && val !== null) return val;
        } catch (e) {}
        return fallback;
    }
    function savePref(key, val) {
        try { app.preferences.setStringPreference(key, String(val)); } catch (e) {}
    }

    function getColorHash(c) {
        if (!c) return null;
        if (c.typename === "SpotColor") return "spot_" + c.spot.name;
        if (c.typename === "CMYKColor") return "cmyk_" + Math.round(c.cyan) + "_" + Math.round(c.magenta) + "_" + Math.round(c.yellow) + "_" + Math.round(c.black);
        if (c.typename === "RGBColor") return "rgb_" + Math.round(c.red) + "_" + Math.round(c.green) + "_" + Math.round(c.blue);
        if (c.typename === "GrayColor") return "gray_" + Math.round(c.gray);
        return "other";
    }

    // Captured up-front while we still have document access: palette
    // callbacks can't touch the document, so Save uses these strings
    var docName = doc.name;
    var docSavedPath = "";
    try { if (doc.saved) docSavedPath = doc.fullName.path; } catch (eDp) {}

    // Serializes a color into a string that can travel through BridgeTalk.
    function colorToSpec(c) {
        try {
            if (c.typename === "SpotColor") return "spot|" + c.spot.name;
            if (c.typename === "CMYKColor") return "cmyk|" + c.cyan + "|" + c.magenta + "|" + c.yellow + "|" + c.black;
            if (c.typename === "RGBColor")  return "rgb|" + c.red + "|" + c.green + "|" + c.blue;
            if (c.typename === "GrayColor") return "gray|" + c.gray;
        } catch (e) {}
        return "black";
    }

    function addColor(color, kind, idx) {
        if (!color) return;
        var hash = getColorHash(color);
        if (!hash || hash === "other" || colorCache[hash]) return;

        if (color.typename === "SpotColor") {
            colorCache[hash] = true;
            usedColors[color.spot.name] = { color: color, spec: colorToSpec(color), kind: kind, idx: idx };
        } else {
            try {
                var swatch = doc.swatches.getByColor(color);
                if (swatch && swatch.name && swatch.name[0] !== "[") {
                    colorCache[hash] = true;
                    usedColors[swatch.name] = { color: swatch.color, spec: colorToSpec(swatch.color), kind: kind, idx: idx };
                }
            } catch (e) {}
        }
    }

    // ---- Scan with suppressed alerts to avoid dialog spam from broken links ----
    var prevInteraction = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    var scanErrors = 0;

    for (var i = 0; i < doc.pathItems.length; i++) {
        var it = doc.pathItems[i];
        safeExecute(function() {
            if (it.filled) addColor(it.fillColor, "path", i);
        }, "Failed to read path fill");
        safeExecute(function() {
            if (it.stroked) addColor(it.strokeColor, "path", i);
        }, "Failed to read path stroke");
    }

    for (var j = 0; j < doc.textFrames.length; j++) {
        var txt = doc.textFrames[j];
        safeExecute(function() {
            addColor(txt.textRange.characterAttributes.fillColor, "text", j);
        }, "Failed to read text fill");
        safeExecute(function() {
            addColor(txt.textRange.characterAttributes.strokeColor, "text", j);
        }, "Failed to read text stroke");
    }

    app.userInteractionLevel = prevInteraction;

    // Free memory before building the UI
    $.gc();

    var colorNames = [];
    for (var key in usedColors) {
        colorNames.push(key);
    }

    if (colorNames.length === 0) {
        alert("No named colors found in the document.");
        return;
    }

    // Close a previous instance of the palette if one is still open
    try {
        if ($.global.__colorsWin && $.global.__colorsWin instanceof Window) {
            $.global.__colorsWin.close();
        }
    } catch (ePrev) {}

    var w = new Window("palette", "Color Inspector v" + SCRIPT_VERSION);
    $.global.__colorsWin = w;
    w.orientation = "column";
    w.alignChildren = ["fill", "fill"];
    w.margins = 20;

    var panel = w.add("panel", undefined, "Colors (Click Name to Copy)");
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.preferredSize = [420, 250];

    // Runs in Illustrator's MAIN engine via BridgeTalk (self-contained).
    function focusItemDoc(kind, idx) {
        try {
            var doc = app.activeDocument;
            var targetItem = (kind === "path") ? doc.pathItems[idx] : doc.textFrames[idx];

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
            alert("Could not select the item. If the artwork changed since the scan, re-run the script.\n" + e);
        }
    }

    var doFocus = function (kind, idx) {
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = "(" + String(focusItemDoc) + ')("' + kind + '", ' + idx + ");";
        bt.send();
    };

    // Runs in Illustrator's MAIN engine via BridgeTalk (self-contained).
    function createLegendItemDoc(spec, textStr) {
        try {
            var doc = app.activeDocument;

            // Rebuild the color from its serialized form
            var col = null;
            var parts = spec.split("|");
            if (parts[0] === "spot") {
                var sc = new SpotColor();
                sc.spot = doc.spots.getByName(parts[1]);
                col = sc;
            } else if (parts[0] === "cmyk") {
                col = new CMYKColor();
                col.cyan = parseFloat(parts[1]); col.magenta = parseFloat(parts[2]);
                col.yellow = parseFloat(parts[3]); col.black = parseFloat(parts[4]);
            } else if (parts[0] === "rgb") {
                col = new RGBColor();
                col.red = parseFloat(parts[1]); col.green = parseFloat(parts[2]);
                col.blue = parseFloat(parts[3]);
            } else if (parts[0] === "gray") {
                col = new GrayColor();
                col.gray = parseFloat(parts[1]);
            } else {
                col = new GrayColor();
                col.gray = 100;
            }

            var view = doc.activeView;
            var size = 100;
            var gap = 30;
            var spacing = 20;

            // Stacking state persists in the main engine between clicks
            if (!$.global.__ccLegend) $.global.__ccLegend = { y: 0, cx: null, cy: null };
            var st = $.global.__ccLegend;
            var c = view.centerPoint;
            if (st.cx === null || Math.abs(c[0] - st.cx) > 5 || Math.abs(c[1] - st.cy) > 5) {
                st.y = 0;
            }
            st.cx = c[0]; st.cy = c[1];

            var top = c[1] + (size / 2) - st.y;
            var left = c[0] - 150;

            // 1. Draw the Square
            var rect = doc.pathItems.rectangle(top, left, size, size);
            rect.filled = true;
            rect.fillColor = col;

            var outline;
            if (doc.documentColorSpace === DocumentColorSpace.RGB) {
                outline = new RGBColor();
                outline.red = 0; outline.green = 0; outline.blue = 0;
            } else {
                outline = new CMYKColor();
                outline.cyan = 0; outline.magenta = 0; outline.yellow = 0; outline.black = 100;
            }

            rect.stroked = true;
            rect.strokeColor = outline;
            rect.strokeWidth = 4;

            // 2. Draw the Text
            var txt = doc.textFrames.add();
            txt.contents = textStr;

            try {
                txt.textRange.characterAttributes.textFont = app.textFonts.getByName("Gotham-Medium");
            } catch (e) {}

            try { txt.textRange.characterAttributes.size = 75; } catch (eSz) {}

            // 3. Align text vertically with an optical nudge
            var textLeft = left + size + gap;
            var opticalNudge = 6;
            var textTop = (top - (size / 2)) + (txt.height / 2) - opticalNudge;
            txt.position = [textLeft, textTop];

            // 4. Group the Square and the Text
            var group = doc.groupItems.add();
            rect.move(group, ElementPlacement.PLACEATEND);
            txt.move(group, ElementPlacement.PLACEATEND);

            st.y += (size + spacing);

            app.redraw();
        } catch (e) {
            alert("Could not create the label.\n" + e);
        }
    }

    var createLegendItem = function (spec, textStr) {
        var safeText = String(textStr).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        var safeSpec = String(spec).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = "(" + String(createLegendItemDoc) + ')("' + safeSpec + '", "' + safeText + '");';
        bt.send();
    };

    for (var j2 = 0; j2 < colorNames.length; j2++) {
        (function (index) {
            var row = panel.add("group");
            row.orientation = "row";
            row.alignment = ["fill", "center"];

            var currentName = colorNames[index];
            var data = usedColors[currentName];

            var swatchBox = row.add("panel");
            swatchBox.preferredSize = [30, 20];

            var rgb = convertToRGB(data.color);
            swatchBox.graphics.backgroundColor = swatchBox.graphics.newBrush(
                swatchBox.graphics.BrushType.SOLID_COLOR,
                [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1]
            );

            var nameField = row.add("edittext", undefined, currentName);
            nameField.readonly = true;
            nameField.characters = 20;
            nameField.onActivate = function () {
                this.active = true;
                this.textSelection = [0, this.text.length];
            }

            var focusBtn = row.add("button", undefined, "Focus");
            focusBtn.onClick = function () {
                doFocus(data.kind, data.idx);
            };

            var drawBtn = row.add("button", undefined, "+ Add Label");
            drawBtn.onClick = function () {
                createLegendItem(data.spec, currentName);
            };

        })(j2);
    }

    var btnGroup = w.add("group");
    btnGroup.orientation = "row";
    btnGroup.alignChildren = ["center", "center"];
    btnGroup.spacing = 15;

    var saveBtn = btnGroup.add("button", undefined, "Save Report (.txt)");
    var closeBtn = btnGroup.add("button", undefined, "Close");

    saveBtn.onClick = function () {
        try {
            var savedReportPath = loadPref("CheckAllColors_ReportPath", "");
            var defaultPath = (savedReportPath !== "") ? savedReportPath : (docSavedPath !== "" ? docSavedPath : Folder.desktop.fsName);
            var filePath = defaultPath + "/NamedColorsReport.txt";
            var f = new File(filePath);
            f.encoding = "UTF-8";
            f.open("w");

            f.writeln("File Name: " + docName);
            f.writeln("--------------------------------");
            for (var s = 0; s < colorNames.length; s++) {
                f.writeln(colorNames[s]);
            }

            f.close();
            savePref("CheckAllColors_ReportPath", f.path);
            alert("Report saved successfully to:\n" + f.fsName);
        } catch (e) {
            alert("Error saving file: " + e);
        }
    }

    closeBtn.onClick = function () { w.close(); };

    w.location = [110, 155];
    w.show();
}

function convertToRGB(color) {
    var rgb = [0, 0, 0];
    if (!color) return rgb;

    if (color.typename === "RGBColor") {
        rgb = [color.red, color.green, color.blue];
    } else if (color.typename === "CMYKColor") {
        var c = color.cyan / 100;
        var m = color.magenta / 100;
        var y = color.yellow / 100;
        var k = color.black / 100;
        rgb[0] = 255 * (1 - c) * (1 - k);
        rgb[1] = 255 * (1 - m) * (1 - k);
        rgb[2] = 255 * (1 - y) * (1 - k);
    } else if (color.typename === "GrayColor") {
        var g = Math.round(255 * (1 - color.gray / 100));
        rgb = [g, g, g];
    } else if (color.typename === "SpotColor") {
        rgb = convertToRGB(color.spot.color);
    }

    rgb[0] = Math.max(0, Math.min(255, Math.round(rgb[0])));
    rgb[1] = Math.max(0, Math.min(255, Math.round(rgb[1])));
    rgb[2] = Math.max(0, Math.min(255, Math.round(rgb[2])));

    return rgb;
}

main();