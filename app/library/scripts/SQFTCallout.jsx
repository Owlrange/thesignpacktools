// ============================================================
//  Add SQ FT Callout  —  for Adobe Illustrator
//  FIXED VERSION: Reduced base sizes for better scaling on large files
//  
//  Changes made:
//  - FONT_SIZE reduced from 72pt to 42pt
//  - All dimensions scaled down proportionally (~40% reduction)
//  - Better visibility on large artboards (50"+ wide)
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
    var AUTO_SCALE      = true;            // one shared scale for all callouts
    var REFERENCE_WIDTH = 36;              // inches (increased from 24in for better large-file scaling)
    var MIN_SCALE       = 0.4;             // NEVER go below this scale (reduced from 0.5)
    var LAYER_NAME      = "Measurements";  // callouts go here
    var LABEL_SUFFIX    = " SQ FT";
    var DECIMALS        = 2;               // decimals for square footage
    // ----------------------------------------------

    if (app.documents.length === 0) {
        alert("Open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var fontProblem = false;

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

        var fontSize = FONT_SIZE      * s;
        var dotD     = DOT_DIAMETER   * s;
        var strokeW  = STROKE_WEIGHT  * s;
        var vDrop    = VERTICAL_DROP  * s;
        var hRun     = HORIZONTAL_RUN * s;
        var textGap  = TEXT_GAP       * s;
        var dotRaise = DOT_RAISE      * s;
        var dotInset = DOT_INSET      * s;

        var group = measLayer.groupItems.add();
        group.name = label + " Callout";

        // Anchor: bottom-right corner of the art
        var cornerX = b[2];
        var cornerY = b[3];

        // Dot (tucked into the corner)
        var dotCX = cornerX - dotInset;
        var dotCY = cornerY + dotRaise;
        var dot = group.pathItems.ellipse(
            dotCY + dotD / 2,   // top
            dotCX - dotD / 2,   // left
            dotD, dotD
        );
        dot.filled = true;
        dot.fillColor = black;
        dot.stroked = false;

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

        // Position text
        var tb = tf.geometricBounds;
        var tH = tb[1] - tb[3];
        tf.position = [lineEndX + textGap, lineBottomY + tH / 2];
    }

    // ---- 6. Create callouts ----
    if (doc.selection.length > 0) {
        var items = [];
        for (var i = 0; i < doc.selection.length; i++) items.push(doc.selection[i]);

        var allBounds = [];
        var maxWIn = 0;
        for (var k = 0; k < items.length; k++) {
            var kb = getItemBounds(items[k]);
            allBounds.push(kb);
            var kw = (kb[2] - kb[0]) / 72;
            if (kw > maxWIn) maxWIn = kw;
        }

        var scale = 1;
        if (AUTO_SCALE && maxWIn > 0) scale = maxWIn / REFERENCE_WIDTH;
        if (scale < MIN_SCALE) scale = MIN_SCALE;

        for (var j = 0; j < allBounds.length; j++) {
            buildCallout(allBounds[j], scale);
        }
    } else {
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
        var abW = (ab[2] - ab[0]) / 72;
        var abScale = (AUTO_SCALE && abW > 0) ? abW / REFERENCE_WIDTH : 1;
        if (abScale < MIN_SCALE) abScale = MIN_SCALE;
        buildCallout([ab[0], ab[1], ab[2], ab[3]], abScale);
    }

    // Restore the layer's original lock state
    measLayer.locked = wasLocked;

    if (!theFont || fontProblem) {
        alert("Callouts created, but 'Gotham Medium' could not be applied — those labels are using the default font.\n\nIf Gotham comes from a font manager or Adobe Fonts, make sure it's activated, or type something in Gotham in this document once and re-run.\nYou can also check the exact PostScript name (Type > Font) and update FONT_NAME at the top of the script.");
    }

})();