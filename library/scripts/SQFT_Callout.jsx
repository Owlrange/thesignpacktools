// ============================================================
//  Add SQ FT Callout 2.2  -  for Adobe Illustrator
//  Author: Joao Victor Malz
//  Copyright: (c) 2026 Joao Victor Malz
//  Created for use at The Sign Pack
//
//  Adds a square-footage callout at the bottom-right corner of each selected item (or of
//  the active artboard if nothing is selected): a ball on the end of an L-shaped line, and
//  the text "<sq ft> SQ FT" in Gotham Medium, on the "Measurements" layer.
//
//   - The callout grows in direct proportion to the item's width. An item about 36 in wide
//     gets the standard size; SIZE_PERCENT at the top makes everything bigger or smaller.
//   - The ball is a real arrowhead on the line, added by the Illustrator action
//     "SQFT Arrow" (set "SQFT") from the file SQFT_Arrow.aia, which must sit in the same
//     folder as this script. If that file is missing, or the arrowhead does not show up,
//     the ball is drawn as a separate dot and the script says so at the end.
//   - Large Canvas documents are handled (every drawn size is divided by the document scale,
//     with a self-check of the text and line size).
// ============================================================

#target illustrator

(function () {

    // ------------------ SETTINGS ------------------
    var FONT_NAME       = "Gotham-Medium"; // PostScript name
    var FONT_SIZE       = 42;              // pt (reduced from 72pt)
    var DOT_DIAMETER    = 14.4;            // pt (reduced from 21.6pt)
    var DOT_RAISE       = 9.6;             // pt (reduced from 14.4pt)
    var DOT_INSET       = 9.6;             // pt (reduced from 14.4pt)
    var STROKE_WEIGHT   = 2;               // pt (reduced from 3pt)
    var VERTICAL_DROP   = 65;              // pt (reduced from 98pt)
    var HORIZONTAL_RUN  = 58;              // pt (reduced from 87pt)
    var TEXT_GAP        = 14.4;            // pt (reduced from 21.6pt)
    var AUTO_SCALE       = true;            // each callout scales to its own item's width
    var REFERENCE_WIDTH  = 36;              // inches — item at this width gets scale 1.0
    var MIN_SCALE        = 0.3;             // NEVER go below this scale
    var MAX_SCALE        = 12;              // NEVER go above this scale
    var SIZE_PERCENT     = 250;             // 100 = standard look. 120 = 20% bigger, 80 = 20% smaller
    var BASE_SCALE       = 1.98;            // the scale an item at REFERENCE_WIDTH gets at SIZE_PERCENT 100
    var TEXT_HEIGHT_RATIO = 0.8;            // height of "6.21 SQ FT" (caps + Q tail) as a part of the font size
    var LAYER_NAME      = "Measurements";  // callouts go here
    var LABEL_SUFFIX    = " SQ FT";
    var ARROW_FILE      = "SQFT_Arrow.aia"; // the action file, in the same folder as this script
    var ARROW_SET       = "SQFT";           // action set name inside it
    var ARROW_ACTION    = "SQFT Arrow";     // action name inside it
    var DECIMALS        = 2;               // decimals for square footage
    // ----------------------------------------------

    if (app.documents.length === 0) {
        alert("Open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var fontProblem = false;
    var arrowReady = false;     // the action is loaded and can be used
    var arrowFailed = false;    // the arrowhead did not show up at least once (dot was drawn instead)
    var arrowMissing = false;   // action file not found

    // Large Canvas documents (over 227in) report coordinates at 1/10
    // of real size to scripts — detect it so the math stays correct
    var docScale = 1;
    try { if (doc.scaleFactor) docScale = doc.scaleFactor; } catch (eS) {}

    // ---- 1. Black in the document's color space ----
    var black;
    if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
        black = new CMYKColor();
        black.cyan = 0; black.magenta = 0; black.yellow = 0; black.black = 100;
    } else {
        black = new RGBColor();
        black.red = 0; black.green = 0; black.blue = 0;
    }

    // ---- 2. Find the font ----
    var theFont = null;
    try { theFont = app.textFonts.getByName(FONT_NAME); } catch (e) {}
    if (!theFont) {
        for (var f = 0; f < app.textFonts.length; f++) {
            var n = app.textFonts[f].name.toLowerCase();
            if (n.indexOf("gotham") !== -1 && n.indexOf("medium") !== -1 &&
                n.indexOf("italic") === -1) {
                theFont = app.textFonts[f];
                break;
            }
        }
    }

    // ---- 3. Find or create the target layer ----
    var measLayer = null;
    for (var L = 0; L < doc.layers.length; L++) {
        if (doc.layers[L].name.toLowerCase() === LAYER_NAME.toLowerCase()) {
            measLayer = doc.layers[L];
            break;
        }
    }
    if (!measLayer) {
        measLayer = doc.layers.add();
        measLayer.name = LAYER_NAME;
        measLayer.zOrder(ZOrderMethod.BRINGTOFRONT);
    }

    // Make sure we can draw on it (restore lock state afterwards)
    var wasLocked = measLayer.locked;
    measLayer.locked = false;
    measLayer.visible = true;

    // ---- 4. Get an item's TRUE bounds (respects clipping masks) ----
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

    // ---- 5. Builds one callout for a given bounds [l, t, r, b] ----
    function buildCallout(b, s) {
        // Keep the scale inside Illustrator's limits
        if (!s || s <= 0 || isNaN(s)) s = 1;
        var maxS = 1296 / FONT_SIZE;
        var minS = 0.1 / FONT_SIZE;
        if (s > maxS) s = maxS;
        if (s < minS) s = minS;

        var wIn  = (b[2] - b[0]) / 72;
        var hIn  = (b[1] - b[3]) / 72;
        // Real-world size (corrects Large Canvas 1/10 coordinates)
        var realW = wIn * docScale;
        var realH = hIn * docScale;
        var sqft  = (realW * realH) / 144;

        var factor  = Math.pow(10, DECIMALS);
        var rounded = Math.round(sqft * factor) / factor;
        var label   = String(rounded) + LABEL_SUFFIX;

        // These are the real-world sizes we WANT. On a Large Canvas
        // document, docScale > 1 and the API expects coordinates in
        // its compressed internal units — so divide by docScale to
        // convert intended real-world size into what we actually draw.
        // On a normal canvas docScale is 1, so this changes nothing.
        // On a Large Canvas file, Illustrator renders whatever value you
        // feed it multiplied by docScale (confirmed: an 80pt font fed to
        // the API renders as 800pt on a Large Canvas doc). So EVERY
        // drawn dimension — including font size and stroke weight, not
        // just position/spacing — needs dividing by docScale to come
        // out at the real-world intended size.
        var fontSize = (FONT_SIZE      * s) / docScale;
        var dotD     = (DOT_DIAMETER   * s) / docScale;
        var strokeW  = (STROKE_WEIGHT  * s) / docScale;
        var vDrop    = (VERTICAL_DROP  * s) / docScale;
        var hRun     = (HORIZONTAL_RUN * s) / docScale;
        var textGap  = (TEXT_GAP       * s) / docScale;
        var dotRaise = (DOT_RAISE      * s) / docScale;
        var dotInset = (DOT_INSET      * s) / docScale;

        var group = measLayer.groupItems.add();
        group.name = label + " Callout";

        // Anchor: bottom-right corner of the art
        var cornerX = b[2];
        var cornerY = b[3];

        // Ball position (tucked into the corner): the start of the line
        var dotCX = cornerX - dotInset;
        var dotCY = cornerY + dotRaise;
        function drawDot() {
            var dot = group.pathItems.ellipse(
                dotCY + dotD / 2,   // top
                dotCX - dotD / 2,   // left
                dotD, dotD
            );
            dot.filled = true;
            dot.fillColor = black;
            dot.stroked = false;
        }
        if (!arrowReady) drawDot();

        // L-shaped leader line: from dot, down, then right
        var lineBottomY = dotCY - vDrop;
        var lineEndX    = dotCX + hRun;

        var leader = group.pathItems.add();
        leader.setEntirePath([
            [dotCX,    dotCY],
            [dotCX,    lineBottomY],
            [lineEndX, lineBottomY]
        ]);
        leader.closed = false;
        leader.filled = false;
        leader.stroked = true;
        leader.strokeColor = black;
        leader.strokeWidth = strokeW;
        leader.strokeCap = StrokeCap.BUTTENDCAP;
        leader.strokeJoin = StrokeJoin.MITERENDJOIN;

        // Label text
        var tf = group.textFrames.add();
        tf.contents = label;
        var attrs = tf.textRange.characterAttributes;

        // Font application with error handling
        var fontApplied = false;
        if (theFont) {
            try { attrs.textFont = theFont; fontApplied = true; } catch (e1) {}
        }
        if (!fontApplied) {
            try {
                attrs.textFont = app.textFonts.getByName(FONT_NAME);
                fontApplied = true;
            } catch (e2) {}
        }
        if (!fontApplied) fontProblem = true;

        try { attrs.size = Math.round(fontSize * 100) / 100; } catch (e3) {}
        try { attrs.fillColor = black; } catch (e4) {}

        // ---- Self-check (Large Canvas and similar): compare the REAL size of the stroke and the text with the
        // dot, which is drawn from exact coordinates. The intended proportions are known, so anything more than
        // about 35% away is corrected. On a normal file both checks pass and nothing changes.
        try {
            var gbL = leader.geometricBounds, vbL = leader.visibleBounds;
            var swUnits = 2 * (gbL[0] - vbL[0]);                       // half the stroke sticks out on the left
            var expSw   = dotD * (STROKE_WEIGHT / DOT_DIAMETER);
            if (swUnits > 0 && expSw > 0 && (swUnits / expSw < 0.65 || swUnits / expSw > 1.35)) {
                leader.strokeWidth = leader.strokeWidth * (expSw / swUnits);
            }
        } catch (eChkS) {}
        try {
            var tbC = tf.geometricBounds;
            var hText = tbC[1] - tbC[3];
            var expH  = dotD * (FONT_SIZE / DOT_DIAMETER) * TEXT_HEIGHT_RATIO;
            if (hText > 0 && expH > 0 && (hText / expH < 0.65 || hText / expH > 1.35)) {
                attrs.size = attrs.size * (expH / hText);
            }
        } catch (eChkT) {}

        // Position text
        var tb = tf.geometricBounds;
        var tH = tb[1] - tb[3];
        tf.position = [lineEndX + textGap, lineBottomY + tH / 2];

        // The ball: run the action on the line, then put the weight back (the ball follows the weight)
        if (arrowReady) {
            var wantW = leader.strokeWidth;
            var shown = false;
            try {
                doc.selection = null;
                leader.selected = true;
                app.doScript(ARROW_ACTION, ARROW_SET, false);
                leader.strokeWidth = wantW;
                doc.selection = null;
                var gbA = leader.geometricBounds, vbA = leader.visibleBounds;
                var ext = Math.max(gbA[0] - vbA[0], vbA[2] - gbA[2], vbA[1] - gbA[1], gbA[3] - vbA[3]);
                shown = ext > wantW * 1.5;
            } catch (eAr) {
                shown = false;
                try { leader.strokeWidth = wantW; } catch (eW) {}
            }
            if (!shown) { arrowFailed = true; drawDot(); }
        }
    }

    // Loads the action file that sits next to this script
    function loadArrowAction() {
        var af = null;
        try { af = new File(File($.fileName).parent.fsName + "/" + ARROW_FILE); } catch (eP) { af = null; }
        if (!af || !af.exists) { arrowMissing = true; return; }
        try { app.unloadAction(ARROW_SET, ""); } catch (eU) {}
        try { app.loadAction(af); arrowReady = true; } catch (eL) { arrowReady = false; arrowFailed = true; }
    }

    // Turns a real-world width (inches) into a callout scale, in direct
    // proportion to the width: an item at REFERENCE_WIDTH gets BASE_SCALE
    // (times SIZE_PERCENT), twice as wide = twice as big, so every sign
    // gets the same look relative to itself. MIN/MAX_SCALE keep it readable
    // for tiny items and inside Illustrator's limits for huge ones.
    function widthToScale(widthIn) {
        var base = BASE_SCALE * (SIZE_PERCENT / 100);
        if (!AUTO_SCALE || widthIn <= 0) return base;
        var s = (widthIn / REFERENCE_WIDTH) * base;
        if (s < MIN_SCALE) s = MIN_SCALE;
        if (s > MAX_SCALE) s = MAX_SCALE;
        return s;
    }

    loadArrowAction();

    // ---- 6. Create callouts ----
    if (doc.selection.length > 0) {
        var items = [];
        for (var i = 0; i < doc.selection.length; i++) items.push(doc.selection[i]);

        // Each item scales independently based on its OWN width — a
        // batch selection of a big logo and a small phone number should
        // produce a big callout and a small callout, not one uniform
        // size taken from whichever item happens to be widest.
        for (var k = 0; k < items.length; k++) {
            var kb = getItemBounds(items[k]);
            if (!kb) continue;
            // Real-world width, corrected for Large Canvas documents —
            // previously this ignored docScale while the sq ft math
            // downstream did apply it, causing wrong scale on those files.
            var kw = ((kb[2] - kb[0]) / 72) * docScale;
            var kScale = widthToScale(kw);
            buildCallout(kb, kScale);
        }
    } else {
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
        var abW = ((ab[2] - ab[0]) / 72) * docScale;
        var abScale = widthToScale(abW);
        buildCallout([ab[0], ab[1], ab[2], ab[3]], abScale);
    }

    // Restore the layer's original lock state
    measLayer.locked = wasLocked;
    if (arrowReady) { try { app.unloadAction(ARROW_SET, ""); } catch (eUn) {} }
    if (arrowMissing) {
        alert(ARROW_FILE + " was not found next to this script, so the ball was drawn as a separate dot (the 1.7 look).\n\nPut " + ARROW_FILE + " in the same folder as SQFT Callout to get the arrowhead ball.");
    } else if (arrowFailed) {
        alert("The arrowhead could not be added to at least one callout, so a separate dot was drawn there.\n\nCheck that the action file has the set \"" + ARROW_SET + "\" with the action \"" + ARROW_ACTION + "\".");
    }

    if (!theFont || fontProblem) {
        alert("Callouts created, but 'Gotham Medium' could not be applied — those labels are using the default font.\n\nIf Gotham comes from a font manager or Adobe Fonts, make sure it's activated, or type something in Gotham in this document once and re-run.\nYou can also check the exact PostScript name (Type > Font) and update FONT_NAME at the top of the script.");
    }

})();