// ============================================================
//  SQ FT Calculator (UI)  —  for Adobe Illustrator
//  Lists every selected art with its dimensions, the sq ft math,
//  and an editable quantity — then totals everything at the
//  bottom, updating live as you change quantities.
//
//  Usage:
//    1. Select one or more arts/groups (each is calculated
//       separately, clipping masks respected).
//    2. File > Scripts > SQFT_Calculator
//
//  Assumes the document is at real size (1 in = 72 pt).
//  Large Canvas (1/10 scale) documents are detected automatically.
// ============================================================

#target illustrator
#targetengine "sqftcalc"

(function () {

    // ------------------ SETTINGS ------------------
    var DECIMALS         = 1;                // decimals shown for sq ft values
    var FONT_NAME        = "Gotham-Medium";  // font for the "+ Add Total SQ FT" label
    var TOTAL_LABEL_SIZE = 48;               // pt — size of the placed total label
    var LAYER_NAME       = "Measurements";   // where the label goes; created if missing
    // ----------------------------------------------

    if (app.documents.length === 0) { alert("Open a document first."); return; }
    var doc = app.activeDocument;
    if (doc.selection.length === 0) { alert("Select one or more arts first."); return; }

    // Large Canvas documents report coordinates at 1/10 of real size
    var docScale = 1;
    try { if (doc.scaleFactor) docScale = doc.scaleFactor; } catch (eS) {}

    // ---- TRUE bounds (respects clipping masks, skips hidden/guides) ----
    function getItemBounds(item) {
        if (item.hidden) return null;
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
                var cb = getItemBounds(item.pageItems[g]);
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
            if (u) return u;
        }
        return item.geometricBounds;
    }

    function round2(v) {
        var f = Math.pow(10, DECIMALS);
        return Math.round(v * f) / f;
    }
    function fmt(v) {
        // fixed decimals for tidy columns
        return v.toFixed(DECIMALS);
    }

    // ---- Measure every selected item ----
    var rows = [];
    for (var i = 0; i < doc.selection.length; i++) {
        var it = doc.selection[i];
        var b = getItemBounds(it);
        if (!b) continue;

        var wIn = ((b[2] - b[0]) / 72) * docScale;
        var hIn = ((b[1] - b[3]) / 72) * docScale;
        var sqft = (wIn * hIn) / 144;

        rows.push({
            name: (it.name && it.name !== "") ? it.name : null,
            w: wIn, h: hIn, sqft: sqft, qty: 1,
            left: b[0], top: b[1], hPts: (b[1] - b[3])
        });
    }

    if (rows.length === 0) { alert("Nothing measurable in the selection."); return; }

    // ---- Sort into view order: top to bottom, left to right ----
    // Items whose tops are within half the smaller item's height are
    // treated as the same visual row and ordered left to right.
    rows.sort(function (a, b) {
        var tol = Math.min(a.hPts, b.hPts) / 2;
        if (Math.abs(a.top - b.top) <= tol) return a.left - b.left;
        return b.top - a.top; // higher on the page first
    });

    // Fallback names follow the sorted (visual) order
    for (var n = 0; n < rows.length; n++) {
        if (!rows[n].name) rows[n].name = "Art " + (n + 1);
    }

    // ---- Build the dialog ----
    // Close a previous instance of the palette if one is still open
    try {
        if ($.global.__sqftWin && $.global.__sqftWin instanceof Window) {
            $.global.__sqftWin.close();
        }
    } catch (ePrev) {}

    var win = new Window("palette", "SQ FT Calculator");
    $.global.__sqftWin = win;
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = 12;
    win.spacing = 6;

    // Column widths
    var W_NAME = 110, W_CALC = 165, W_SQFT = 55, W_QTY = 40, W_SUB = 65;

    // Header
    var header = win.add("group");
    header.spacing = 6;
    function headCell(parent, text, w) {
        var t = parent.add("statictext", undefined, text);
        t.preferredSize.width = w;
        t.graphics.font = ScriptUI.newFont(t.graphics.font.name, "BOLD", t.graphics.font.size);
        return t;
    }
    headCell(header, "Art", W_NAME);
    headCell(header, "Calculation", W_CALC);
    headCell(header, "SQ FT", W_SQFT);
    headCell(header, "Qty", W_QTY);
    headCell(header, "Subtotal", W_SUB);

    // Scrollable area if there are many rows
    var listHost;
    if (rows.length > 10) {
        listHost = win.add("panel");
        listHost.alignChildren = ["fill", "top"];
        listHost.maximumSize.height = 420;
    } else {
        listHost = win;
    }

    var subtotalLabels = [];
    var qtyFields = [];

    for (var r = 0; r < rows.length; r++) {
        (function (idx) {
            var row = rows[idx];
            var g = listHost.add("group");
            g.spacing = 6;

            var nameT = g.add("statictext", undefined, row.name);
            nameT.preferredSize.width = W_NAME;

            var calcStr = fmt(row.w) + '" \u00D7 ' + fmt(row.h) + '" \u00F7 144';
            var calcT = g.add("statictext", undefined, calcStr);
            calcT.preferredSize.width = W_CALC;

            var sqftT = g.add("statictext", undefined, fmt(round2(row.sqft)));
            sqftT.preferredSize.width = W_SQFT;

            var qtyE = g.add("edittext", undefined, "1");
            qtyE.preferredSize.width = W_QTY;
            qtyFields.push(qtyE);

            var subT = g.add("statictext", undefined, fmt(round2(row.sqft)));
            subT.preferredSize.width = W_SUB;
            subtotalLabels.push(subT);

            qtyE.onChanging = function () { recalc(); };
            qtyE.onChange   = function () { recalc(); };
        })(r);
    }

    // Divider + total
    win.add("panel").preferredSize.height = 1;

    var totalGroup = win.add("group");
    totalGroup.alignment = "right";
    var totalCaption = totalGroup.add("statictext", undefined, "TOTAL:");
    totalCaption.graphics.font = ScriptUI.newFont(totalCaption.graphics.font.name, "BOLD", totalCaption.graphics.font.size + 2);
    // Read-only edittext: OS-level plain text, so Ctrl+C / Cmd+C works
    // on both Windows and Mac and pastes at whatever size you're typing
    var totalT = totalGroup.add("edittext", undefined, "0");
    totalT.readonly = true;
    totalT.characters = 10;
    totalT.onActivate = function () {
        this.active = true;
        this.textSelection = [0, this.text.length];
    };
    var totalUnit = totalGroup.add("statictext", undefined, "SQ FT");
    totalUnit.graphics.font = ScriptUI.newFont(totalUnit.graphics.font.name, "BOLD", totalUnit.graphics.font.size + 2);

    function recalc() {
        var total = 0;
        for (var k = 0; k < rows.length; k++) {
            var q = parseFloat(qtyFields[k].text);
            if (isNaN(q) || q < 0) q = 0;
            rows[k].qty = q;
            var sub = round2(rows[k].sqft) * q;
            subtotalLabels[k].text = fmt(sub);
            total += sub;
        }
        totalT.text = fmt(total); // number only — this is what gets copied
    }
    recalc();

    // Note at the bottom
    var note = win.add("statictext", undefined,
        "Tip: click the total, then Ctrl+C (Cmd+C on Mac) to copy the number.");
    note.alignment = "right";

    // ---- Places "TOTAL SQ FT: XX" at the center of the current view ----
    // Self-contained (no outside variables) because it's sent through
    // BridgeTalk — the reliable way to modify the document from a
    // floating palette without PARM errors.
    function addTotalLabel(totalStr, fontName, fontSize, layerName) {
        try {
            var doc = app.activeDocument;

            var lay = null;
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name.toLowerCase() === layerName.toLowerCase()) {
                    lay = doc.layers[i];
                    break;
                }
            }
            if (!lay) {
                lay = doc.layers.add();
                lay.name = layerName;
                lay.zOrder(ZOrderMethod.BRINGTOFRONT);
            }
            var wasLocked = lay.locked;
            lay.locked = false;
            lay.visible = true;

            var black;
            if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
                black = new CMYKColor();
                black.cyan = 0; black.magenta = 0; black.yellow = 0; black.black = 100;
            } else {
                black = new RGBColor();
                black.red = 0; black.green = 0; black.blue = 0;
            }

            var tf = lay.textFrames.add();
            tf.contents = "TOTAL SQ FT: " + totalStr;
            var attrs = tf.textRange.characterAttributes;

            var f = null;
            try { f = app.textFonts.getByName(fontName); } catch (e1) {}
            if (!f) {
                for (var k = 0; k < app.textFonts.length; k++) {
                    var n = app.textFonts[k].name.toLowerCase();
                    if (n.indexOf("gotham") !== -1 && n.indexOf("medium") !== -1 &&
                        n.indexOf("italic") === -1) {
                        f = app.textFonts[k];
                        break;
                    }
                }
            }
            try { if (f) attrs.textFont = f; } catch (e2) {}
            try { attrs.size = fontSize; } catch (e3) {}
            try { attrs.fillColor = black; } catch (e4) {}

            var c = doc.activeView.centerPoint;
            tf.position = [c[0] - tf.width / 2, c[1] + tf.height / 2];

            lay.locked = wasLocked;
            app.redraw();
        } catch (eAll) {
            alert("Couldn't add the total label: " + eAll);
        }
    }

    // Buttons
    var btns = win.add("group");
    btns.alignment = "right";
    var addBtn = btns.add("button", undefined, "+ Add Total SQ FT");
    addBtn.onClick = function () {
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = "(" + String(addTotalLabel) + ')("' + totalT.text + '", "' +
                  FONT_NAME + '", ' + TOTAL_LABEL_SIZE + ', "' + LAYER_NAME + '");';
        bt.send();
    };
    var closeBtn = btns.add("button", undefined, "Close", { name: "ok" });
    closeBtn.onClick = function () { win.close(); };

    win.location = [110, 155];
    win.show();

})();
