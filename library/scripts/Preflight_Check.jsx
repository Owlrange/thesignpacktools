// ============================================================
//  Preflight Check 1.0
//  Author: Joao Victor Malz
//  Copyright: (c) 2026 Joao Victor Malz
//  Created for use at The Sign Pack
//
//  Checks the open file before export. Two sections, every row shows a status icon:
//    green check = OK, yellow triangle = warning, red cross = wrong, grey dash = not run.
//
//  STANDARD CHECKS (always, every job):
//    Image DPI, Unused swatches, Text (live / missing font / overset),
//    File color mode, Open paths (production layers only),
//    Clipping masks (hidden ones are red), External links.
//
//  SIGN TYPE CHECKS (pick the sign type in the dropdown). The list of sign types and
//  the layers each one needs come from "Sign_Types_x.x.json"; the Client list from
//  "Clients_x.x.json" (both in the same folder as this script).
//    Layers: every layer of the sign type must exist (missing = wrong), with its exact
//            name (a different spelling = wrong, only capitals / spaces = warning)
//            and the right layer colour. The Fix button creates / renames / recolours.
//    Layer Art: on layers with a rule, paths need the stroke (1 pt) and colour
//            (100% black or 100% magenta / CutContour spot). Free layers are not checked.
//    Plus: hairline strokes, stacked duplicates, items off the artboard, artboard size.
//  Scope: with nothing selected the whole file is checked (or the artboard picked in the
//  list); with something selected only that art is checked (the layers are always checked
//  for the whole file).
//
//  "View" on a row lists its items below; double-click an item to jump to it. All
//  read-only except the focus/select action. Thresholds and production layer names
//  are in SETTINGS below.
// ============================================================


#target illustrator
#targetengine "signpack_preflight"

// ---- Code sent to Illustrator travels as plain hex digits (4 per character): no quotes, backslashes or line
//      breaks for the transport to damage ("Expected: )" errors on some computers) ----
function spSendCode(src) {
    src = String(src);
    var h = "";
    for (var i = 0; i < src.length; i++) {
        var x = src.charCodeAt(i).toString(16);
        while (x.length < 4) x = "0" + x;
        h += x;
    }
    return 'eval((function(h){var r="";for(var i=0;i+4<=h.length;i+=4)r+=String.fromCharCode(parseInt(h.substring(i,i+4),16));return r;})("' + h + '"));';
}

// Message handed back to Sign Pack Tools (the status bar shows it): SUCCESS: / WARNING: / ERROR:
var TSP_NAME = "Preflight Check 1.0";
var TSP_RESULT = "";

// ==================== SETTINGS ====================
var SETTINGS = {
    DPI_WARN: 150,                 // below this = warning
    DPI_BAD: 100,                  // below this = red
    HAIRLINE_MIN_PT: 0.5,
    OVERHANG_BLEED_INCHES: 0,      // General / vinyl: art past the artboard
    ARTBOARD_MIN_INCHES: 1,
    ARTBOARD_MAX_INCHES: 600,
    MIN_AVG_THICKNESS_INCHES: 0.08,// thin-shape heuristic (avg, not narrowest)
    MIN_VINYL_WIDTH_INCHES: 0.125, // narrowest part of a vinyl piece (e.g. stem of a letter)
    MIN_THIN_EDGE_INCHES: 0.6,     // ...only flagged if the narrow part runs this long (ignores sharp tips)
    NARROW_SKIP_AVG_INCHES: 0.5,   // big plain pieces (avg thickness above this) are skipped
    NARROW_MAX_SHAPES: 300,        // safety cap for the narrowest-width check
    MIN_ITEM_WIDTH_INCHES: 0.2,    // undersized items / islands. mm = in x 25.4
    MIN_ITEM_HEIGHT_INCHES: 0.2,
    MIN_GAP_INCHES: 0.06,          // optional tight-gap check (bounding boxes)
    GAP_MAX_ITEMS: 400,            // gap check is O(n^2), skip above this
    MAX_IMAGE_ROWS: 100,           // images listed in the Image DPI row
    MAX_ROWS: 50,                  // per-check cap on listed items
    // A layer is a "production layer" if its name CONTAINS any of these
    // (case-insensitive). Used by open paths, cut layer, stroke-only,
    // print-vs-cut bleed. EDIT to match your layer names.
    PRODUCTION_LAYER_KEYS: ["cut", "route", "contour", "thru", "outline", "hole", "whiteink"],
    CUT_SPOT_NAME: "CutContour"    // spot color name (must be 100% M)
};
// ====================================================

// ==================== CLIENT PRESETS ====================
// The real list is read from Clients_x.x.json (same folder) when the script starts;
// this built-in list is only the fallback if that file is missing. A client can
// override any SETTINGS value above and, per sign type, only the fields that differ.
// To add a client, edit Clients_x.x.json (see the notes inside it).
var CLIENTS = [
    { label: "The Sign Pack - Production", settings: {}, mode: "production" },
    { label: "The Sign Pack - Design", settings: {}, mode: "design" }
];
// Design mode runs fewer checks: only the rows listed here (plus any Bleed row).
// Edit these lists to move a check between Production and Design.
var DESIGN_STANDARD = ["Image DPI", "Unused Swatches", "Named Colors", "Text (live / fonts)", "File Color Mode", "External Links"];
var DESIGN_JOB = ["Sheet Notes", "Layers", "Extra Layers", "Layer Art (stroke / colour)", "Hairline Strokes", "Items Off Artboard", "Artboard Size"];
var CURRENT_MODE = "production";
var CURRENT_CLIENT = null;
function modeAllows(kind, label) {
    if (CURRENT_MODE !== "design") return true;
    var list = (kind === "std") ? DESIGN_STANDARD : DESIGN_JOB;
    for (var i = 0; i < list.length; i++) if (list[i] === label) return true;
    if (kind === "job" && (label.indexOf("Bleed") === 0 || label.indexOf("No Bleed") === 0)) return true;
    return false;
}
var BASE_SETTINGS = {};
(function () { for (var k in SETTINGS) BASE_SETTINGS[k] = SETTINGS[k]; })();
function applyClientSettings(client) {
    CURRENT_CLIENT = client || null;
    CURRENT_MODE = (client && client.mode) ? client.mode : "production";
    for (var k in BASE_SETTINGS) SETTINGS[k] = BASE_SETTINGS[k];
    if (client && client.settings) for (var o in client.settings) SETTINGS[o] = client.settings[o];
}
// ========================================================

var SELF_PATH = "";
try { SELF_PATH = $.global.__SELF_OVERRIDE ? $.global.__SELF_OVERRIDE : $.fileName; $.global.__SELF_OVERRIDE = null; } catch (eSP) {}
    // ---- UI Kit: logo, popups and standard sizes live in ONE shared file ----
    // Needs "UI_Kit_x.x.jsx" in the same folder as this script (the highest version
    // is used). If it is missing the script still works: plain system popups, no logo.
    var UIK_SELF = "";
    try { UIK_SELF = SELF_PATH; } catch (eUS) {}
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
    function spAlert(message, title) { uik().spAlert(message, title); }
    function spConfirm(message, title, yesText) { return uik().spConfirm(message, title, yesText); }
    function addLogo(parent, w) { return uik().addLogo(parent, w); }

    // ---- Look: dark grey window, white text, green accents ----
    // STYLED_UI = false gives the plain system look back (use it if the labels are hard to read).
    var STYLED_UI = true;
    var TSP_BG = [43 / 255, 43 / 255, 43 / 255, 1];          // window background, #2B2B2B
    var TSP_GREEN = [34 / 255, 164 / 255, 56 / 255, 1];      // company green
    var TSP_GREEN_HI = [52 / 255, 184 / 255, 76 / 255, 1];   // lighter green (hover, panel titles)
    var TITLE_PNG = "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\xd0\x00\x00\x00\x2b\x08\x06\x00\x00\x00\x09\xf1\x06\xae\x00\x00\x04\xe6\x49\x44\x41\x54\x78\xda\xed\x9a\x5d\x88\x55\x55\x14\xc7\x7f\x6b\xc6\xaf\x11\xfb\xd0\x51\x33\x14\x2b\x34\x42\x0a\x9a\x48\x48\x24\x35\xa4\x0f\x2b\x43\x26\x44\x32\x29\x88\x92\xc2\x4c\x1f\x02\x0b\xaa\x97\x24\x41\xa8\x87\xa4\x31\xc1\x0a\x33\xca\x87\x3e\x91\x20\x15\x29\x25\xcc\x40\x28\xa5\x1e\x4a\x92\x52\x0c\x26\x15\xd3\x41\x9a\x1c\x66\xe6\xdf\xc3\x9c\x0b\x9b\xc3\x9c\xaf\x7b\xef\x0c\x77\x4e\xeb\xf7\xb4\xef\xde\x6b\x9d\xbd\xd6\x3e\x7b\x9d\xbd\xd7\xbe\x1b\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\xc7\x71\x1c\x67\x98\x91\x74\xa7\x92\xb9\x28\xe9\x3b\x49\x6b\x25\x8d\x29\xa0\xd7\x27\xe9\xac\xa4\x7d\x92\x56\x49\xb2\x02\xba\x71\x7e\xab\x52\xef\x52\x92\x5e\xce\x71\x99\x16\x7b\xde\xec\x14\xd9\x7b\x24\xed\x94\xf4\xbb\xa4\x6e\x49\x5d\x92\x8e\x4b\xda\x21\xe9\xde\x3c\xe3\x9e\x20\x33\x2e\x66\xc3\xdc\xa8\x7e\x89\x8a\x71\xba\xe0\x9c\x58\x2a\x69\x97\xa4\x93\x91\x3f\xe7\x25\xfd\x2c\x69\x8b\xa4\xdb\xea\xe9\x4b\x2d\xf3\xa1\x16\xbb\x73\xda\xfc\x4a\xac\xef\x67\x8a\x06\x50\xc8\x61\x49\x57\x54\xe9\xf4\xa7\x92\x9a\xcb\x16\x40\x92\x5a\x25\xed\xc9\x61\xcb\x37\x92\x66\x34\x7a\x00\x45\x3e\x1f\xcc\x78\x56\x9f\xa4\x0e\x49\xa3\x1b\x25\x80\xaa\xb1\x3b\xcb\x66\x49\xab\x63\xfa\x2f\x84\xed\x4d\x55\x2c\x56\xf3\x80\x2d\x55\x2e\x74\x0f\x03\xeb\x4b\xb6\x72\xb7\x02\x87\x81\xfb\x72\x88\xcf\x07\xae\x6b\x70\x7f\xae\x01\xbe\x07\x16\x66\x88\x36\x01\x6b\x80\xfb\xcb\x6a\xb7\xa4\x76\xe0\xed\xa0\x6a\x93\x99\x6d\xce\x15\x40\x16\x01\x8c\x06\xda\x80\x83\x41\xf3\x63\x92\xa6\xa4\xe9\x45\xba\xe3\x81\x45\x40\xf8\xb5\x78\x2a\xa1\xcb\x3e\x4b\x67\x76\x96\xad\x09\x4c\x18\xe2\x77\xf7\x3e\x70\x63\xf0\xfb\x00\x70\x07\xd0\x02\x4c\x06\x96\x05\x63\xf7\xb4\x99\x1d\xaa\x57\xc7\x66\xb6\x27\xee\x2c\x70\x2c\x10\x79\x2e\xd6\x3c\x23\xc7\x63\x3f\x88\x05\xf9\xe7\x81\x3f\x53\x80\x55\xc0\xf1\xa8\xed\x35\x33\xdb\x3d\x44\xe3\x5a\x74\x3e\xd4\xd5\x6e\x49\x8b\x80\x8f\x80\xca\x8e\xa9\xc3\xcc\x5e\xca\x9d\x03\x0d\xd2\x3e\x55\x52\x7f\x20\xf2\x50\x81\x65\x7b\x65\x20\xd2\x5b\xc9\x85\x62\xba\xbd\xd5\xe6\x6b\x43\xa9\x97\xb6\x85\x93\xb4\x30\xd6\xb6\x43\x52\x53\xc2\x73\xee\xaa\x77\x0e\x94\x20\x7b\x34\x90\x5b\x5b\xf0\x2b\xbe\x38\xd6\xcf\xb6\x04\xb9\x16\x49\x6b\xb2\x72\xda\x1a\xb7\x70\xbd\xc3\x61\xf7\x60\x36\x4b\xba\x55\xd2\x85\xa0\x7a\x67\xdc\xd7\xc2\x5b\x38\x33\x3b\x03\x9c\x0b\xaa\x26\x56\xf9\x65\xe9\x31\x33\x51\x0e\x1e\x0d\xca\x7f\x01\xeb\xcd\xac\x3f\x61\xfc\x0e\x8c\x00\x7f\x1e\x09\xca\x67\x80\x0d\x09\xbe\x74\x9b\xd9\xd6\x06\x7a\x8f\x75\xb3\x5b\xd2\x0d\xc0\x1e\xe0\xaa\xa8\xea\x0b\xe0\x89\x24\x9d\xa6\x02\x51\x3e\x3d\xda\x92\x54\x38\x97\x43\x67\x9c\xa4\x05\xc0\xc6\xa0\xfa\xd7\x04\xf1\xe6\x94\xc4\xaf\x33\xa3\x9f\x34\x46\x0d\xe1\x8b\x0b\x57\x82\x2f\xcd\xec\x62\x60\xd3\xdd\x29\x36\x5d\x5f\xc4\x17\xa0\x7b\x98\x26\xe2\xed\x31\x7f\xba\x6a\xcc\x4b\x6a\xf1\xa5\xc8\x7c\xa8\xa7\xdd\xfb\x80\x69\x95\x6d\x24\xb0\xce\xcc\xfa\x92\x84\x47\xe5\x18\x84\x66\xe0\xe6\x28\x99\xaa\x2c\x63\x3d\xc0\xa1\xa4\x41\xcb\x78\xe4\x5b\x25\x3a\x43\x98\x14\x94\x3b\x4b\xe0\xcf\xc4\x11\xea\x4f\x3d\xed\x0e\x73\xab\x66\x60\x9b\xa4\xa5\x85\x57\xa0\xe0\x8b\xd1\x1b\x25\xa6\xf3\x83\xe6\x8e\xf0\x6b\x5b\x80\x77\x80\xf7\x4a\x14\x40\x17\x82\xf2\xf4\x92\xf9\x73\xed\xff\xd8\xee\x70\x6e\x3f\x00\xac\x4b\x3b\xd2\x2b\xca\x6e\xe0\xc5\x82\x3a\xbd\x40\xbb\x99\xad\x4e\xd9\x7f\xa6\x9d\xba\x4c\xcb\xc8\xcf\xd2\xe8\x1d\xc2\x17\xf7\x53\x38\xd0\x92\x5a\x02\x9b\xf6\xc7\x4e\x32\xf3\xe6\x9a\x36\xc8\xc9\x5a\xcb\x30\x4d\xc4\x1f\x83\xf2\x52\x49\x57\xd6\x78\x4a\x58\x8b\x2f\x45\xe6\x43\x3d\xed\x3e\x01\xdc\x02\xec\x0f\xea\x36\x4b\x6a\xab\x36\x80\xfa\x81\xb3\xc0\x57\xc0\x0a\x33\x5b\x66\x66\x3d\x59\x83\x16\x6d\xfb\x7a\x82\xad\xe2\x2c\xca\xc7\x67\x41\x79\x2a\xf0\xc6\x08\xf7\xe7\x93\xa0\x3c\x05\x78\x7d\xb0\xd3\x27\x49\x63\x24\xbd\x5c\x6b\x80\x35\xa8\xdd\x8b\xcd\xec\x34\xf0\x78\x90\xe7\x8f\x05\x76\x49\x1a\x9f\x96\xeb\xd4\xfd\x68\x58\xd2\xc6\xa0\xa9\x5b\xd2\x4d\x29\xba\x23\xf1\x18\xdb\x24\x1d\x89\xb5\xef\x96\x34\x3f\x3a\x32\x6d\x8d\xfa\xdc\x95\x74\x88\xd0\x48\xc7\xd8\x91\xfe\xb7\xb1\xbe\xf6\x4a\x9a\x2b\x69\xac\xa4\x49\x92\xda\x25\x1d\x8b\xda\x0e\x49\x9a\x50\x2f\x5f\xaa\x9d\x0f\xb5\xd8\x9d\x31\x7f\x1f\x8c\x3d\x73\xfb\x70\x07\xd0\xb8\xe8\x2e\x58\x78\x0d\xa8\xda\xab\x3c\x97\xea\x6d\x6b\x06\xcb\xb3\x02\x28\x6a\x9f\x15\xdd\xf7\xcb\xcb\xdf\x92\x26\x37\x70\x00\xcd\x94\xd4\x59\xc0\x9f\x27\x87\x28\x80\x72\xcf\x87\x5a\xec\xce\xf1\xff\xe7\x9b\x83\xcd\x8b\x5a\x72\xa0\x22\x7b\xe0\x7f\x81\xf0\xe2\xdd\x3c\xe0\xf9\x32\xed\xe1\xcc\xec\x44\xe4\xd7\x0f\x39\xc4\xf7\x02\x6d\x66\x76\xae\x81\xfd\x39\x15\xf9\x73\x24\x43\xf4\x1f\xe0\x59\x33\x7b\xb7\xe4\x76\x6f\x00\x8e\x06\xbf\xb7\x4b\x9a\x39\x2c\x01\x14\x39\xf6\x35\x03\xd7\x5d\x2a\xbc\x2a\x69\x4e\x09\x83\x68\x2e\xb0\x1c\xf8\x18\x38\x05\x5c\x06\xba\x80\x5f\x18\xf8\x0b\x60\x81\x99\x2d\x31\xb3\x93\x23\xc0\x9f\x3f\x18\xb8\x06\xb3\x82\x81\x2b\x31\x7f\x46\xf9\xec\xf9\xe8\x44\x76\x13\x30\xc7\xcc\xb6\x96\xdd\x6e\x33\xbb\x0c\xac\x8c\x02\x0f\xe0\x6a\xe0\xc3\xca\x4e\xea\x3f\xde\x4d\x86\x1f\x45\x00\x86\x95\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82";
    function paintWin(w) {
        if (!STYLED_UI) return;
        try { w.graphics.backgroundColor = w.graphics.newBrush(w.graphics.BrushType.SOLID_COLOR, TSP_BG); } catch (ePw) {}
    }
    // White text everywhere, green panel titles. Controls marked keepColor are left alone.
    function paintStyle(ctl) {
        if (!STYLED_UI) return;
        try {
            var g = ctl.graphics;
            var t = ctl.type;
            if (t === "statictext" || t === "checkbox" || t === "radiobutton" || t === "panel" || t === "edittext" || t === "listbox") {
                if (!ctl.keepColor) g.foregroundColor = g.newPen(g.PenType.SOLID_COLOR, (t === "panel") ? TSP_GREEN_HI : [1, 1, 1, 1], 1);
            }
        } catch (ePs) {}
        try {
            if (ctl.children) { for (var pi = 0; pi < ctl.children.length; pi++) paintStyle(ctl.children[pi]); }
        } catch (ePc) {}
    }
    // Button pictures (the text is part of the picture, so it is always centered).
    function btnImage(key, data) {
        try {
            var f = new File(Folder.temp.fsName + "/signpack_btn_" + key + ".png");
            f.encoding = "BINARY";
            if (f.open("w")) { f.write(data); f.close(); }
            if (f.exists && f.length > 50) return ScriptUI.newImage(f);
        } catch (eBi) {}
        return null;
    }
    function btnSet(def) {
        return { n: btnImage(def.key + "_n", def.n), h: btnImage(def.key + "_h", def.h2), p: btnImage(def.key + "_p", def.p), d: btnImage(def.key + "_d", def.d), w: def.w, hgt: def.h };
    }
    // Green rounded main button. A second set (alt) can be used with btn.useAlt(true), e.g. Create / Rename.
    // If anything fails, the button stays native.
    function styleGreenButton(btn, def, altDef) {
        if (!STYLED_UI) return;
        try {
            var sets = [btnSet(def)];
            if (altDef) sets.push(btnSet(altDef));
            if (!sets[0].n || (altDef && !sets[1].n)) return;
            var cur = 0;
            btn.preferredSize = [def.w, def.h];
            btn.useAlt = function (on) { cur = (on && altDef) ? 1 : 0; try { btn.notify("onDraw"); } catch (eUa) {} };
            btn.onDraw = function (stt) {
                var gb = this.graphics;
                var bw = this.size.width, bh = this.size.height;
                var s = sets[cur];
                gb.newPath(); gb.rectPath(0, 0, bw, bh);
                gb.fillPath(gb.newBrush(gb.BrushType.SOLID_COLOR, TSP_BG));
                var im = s.n;
                if (!this.enabled) { if (s.d) im = s.d; }
                else { try { if (stt && stt.leftButtonPressed && s.p) im = s.p; else if (stt && stt.mouseOver && s.h) im = s.h; } catch (eSt) {} }
                gb.drawImage(im, 0, 0, bw, bh);
            };
            var redrawBtn = function () { try { btn.notify("onDraw"); } catch (eNd) {} };
            btn.addEventListener("mouseover", redrawBtn);
            btn.addEventListener("mouseout", redrawBtn);
            btn.addEventListener("mousedown", redrawBtn);
            btn.addEventListener("mouseup", redrawBtn);
        } catch (eGb) {}
    }
    // Logo: The Sign Pack wordmark from the UI Kit on the styled window, the old logo otherwise.
    function addHeaderLogo(parent, w) {
        if (STYLED_UI) {
            try { var im = uik().addWordmark ? uik().addWordmark(parent) : null; if (im) return im; } catch (eWm) {}
        }
        return addLogo(parent, w);
    }
    // Title as a small picture (bold capitals), because the window font cannot be set bold/bigger reliably.
    function addHeaderTitle(parent, fallbackText) {
        var im = null;
        if (STYLED_UI) {
            try {
                var tf = new File(Folder.temp.fsName + "/signpack_title_preflight.png");
                tf.encoding = "BINARY";
                if (tf.open("w")) { tf.write(TITLE_PNG); tf.close(); }
                if (tf.exists && tf.length > 50) im = parent.add("image", undefined, tf);
            } catch (eTi) { im = null; }
        }
        if (!im) {
            im = parent.add("statictext", undefined, fallbackText);
            try { im.graphics.font = ScriptUI.newFont("dialog", "BOLD", uik().TITLE_SIZE); } catch (eFt) {}
        }
        im.alignment = ["right", "center"];
        return im;
    }
    function addAccentLine(w) {
        if (!STYLED_UI) return;
        try {
            var ln = w.add("group");
            ln.alignment = ["fill", "top"];
            ln.preferredSize = [10, 4];
            ln.graphics.backgroundColor = ln.graphics.newBrush(ln.graphics.BrushType.SOLID_COLOR, TSP_GREEN);
        } catch (eAl) {}
    }
    var BTN_FIX = { key: "fix", w: 84, h: 28, n: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x06\x54\x49\x44\x41\x54\x78\xda\xed\x9a\x5f\x8c\xdc\x55\x15\xc7\x3f\xe7\xde\xfb\xfb\xcd\xce\x6c\x3b\xdb\x6d\x8b\x18\x51\x92\x82\xb5\x74\x4b\xa5\xca\x6e\x43\x21\x31\x2a\x26\x45\x1e\x78\x30\x69\x4b\x53\xaa\xd0\x26\x8d\x31\x48\x62\x88\xbc\xf8\x50\x56\x8c\xe1\x09\x08\xd1\xa8\x8d\x81\x46\x6d\x6a\xb7\x09\x3c\x19\xfc\x47\x50\x24\x4b\xd3\xee\x26\x54\x6d\xa5\x6c\xba\xab\xd4\xd2\x22\x76\xb7\x3b\xfb\x67\x76\x66\x7e\xf7\x1c\x1f\x66\x67\x69\xe9\xd6\x07\x4d\x66\x56\xbb\x27\xbf\x49\x26\xf9\xdd\x64\x66\x3e\x73\xee\x39\xdf\xef\xf9\x5d\x61\xbe\xd8\x8b\xa3\x17\x05\xa0\x6f\x8b\x5f\x25\x67\xef\x94\x4c\xef\x17\xe8\xd1\xc8\x1a\x71\x52\x44\xcd\x00\xe1\xff\x33\x0c\x27\x62\x6a\x25\xe7\x39\x65\x70\xcc\x82\xfb\xf9\x88\xdd\xd0\xcf\xd6\xc3\xf1\x0a\x46\x97\xc4\x95\x40\xfa\xb6\x78\xb6\x1e\x8e\xec\xb9\x3d\xb9\xe9\x73\xb9\x1d\x88\x3e\x22\x2a\x1b\x24\x75\x62\x6a\x58\x66\xa0\xc6\x35\x11\x4e\x90\x20\x88\x13\xac\xaa\x66\xce\xde\xc0\xdc\xb3\xc3\xaf\x54\x0e\xb0\x6f\xb0\x36\xc7\xea\xaa\x40\x67\x17\xac\xda\xd7\xf3\x09\x29\xfa\xe7\x7d\x21\xb9\x53\x67\x22\x56\x51\xc0\x22\x22\x02\x38\xae\xad\x50\xcc\x0c\xc4\x4b\xce\xe1\xda\x3c\x71\xba\xd6\x6f\xa5\xf8\xd0\xc8\x9e\x63\x6f\x7d\x10\xaa\x5c\x01\xf3\xb9\xee\x1e\x57\x48\x7f\x29\x89\x2c\x8f\xd3\x59\x26\x22\xee\x1a\x84\x78\x55\xb8\x66\xa6\xbe\x10\x82\xd5\x6c\x54\xa7\xab\xf7\x8c\xec\x1a\x38\x76\x29\xd4\x3a\x50\xdb\xeb\x90\x5e\x5d\xf5\x5c\x77\x8f\x6b\x4f\x7e\x05\xd2\xa9\xd5\x98\x89\x48\x58\x64\x38\x4f\x81\x35\xcb\x5c\xea\x03\xd8\x98\x4e\xd5\x36\x8f\xec\x1a\x38\xd6\x60\x28\x8d\x37\xab\x0f\x74\xdf\xa4\x3e\x19\x40\xa4\xd3\x2a\x31\xe2\xc4\x2f\xa2\xfb\xb7\xb9\x1a\x25\xe7\x3d\x66\x63\x2e\xd6\xba\x87\x76\x0c\x0c\x63\x7b\x9d\x03\xe8\xea\xeb\x4a\xa3\xfa\x83\x92\xb8\x4e\x5d\x80\x30\x05\x90\x85\x26\x28\x9c\x78\xad\xc4\x28\x89\xeb\x8c\xea\x0f\x76\xf5\x75\xa5\x00\x0e\xe9\xd5\x4a\xb5\x63\x9b\xef\x48\x37\xc6\xa9\x2c\x93\x16\xc0\xf4\xe2\x09\x6e\x9e\x97\x78\x04\x88\xa6\xd4\x34\x43\x4d\x17\x14\x53\x71\xe2\xe3\x54\x96\xf9\x8e\x74\x63\xa5\xda\xb1\x0d\xe9\x55\xe9\xea\xeb\x4a\xcb\x95\xa5\x83\x3e\xef\xbb\xb4\xac\x20\xcd\x6f\x40\xa5\xea\x04\x71\x1e\x58\x22\x42\x31\x59\x42\x3e\xb4\x91\xb8\x84\x6a\xac\x52\xd1\xea\xc2\xca\x56\x43\x5d\xde\x11\xcb\xf1\x64\x3e\x37\x71\x7b\x98\xac\x16\x7b\x92\x44\xba\xb4\xac\xd2\xcc\x6f\x2a\x08\x8a\x11\xc4\xf1\xc8\x27\x77\xd3\x91\x16\x89\x1a\x41\x04\xa8\x7b\x06\xd5\xc8\x33\x7f\xfc\x31\x8f\xde\xf6\x55\x76\xaf\xdd\xce\xd3\xc7\xf7\xf1\xc4\xe0\x33\x7c\xb8\x70\x1d\xd1\x22\x51\x15\xc3\x70\xe2\x70\x22\xa8\xe9\xac\xdf\x68\x6a\x3d\x72\x5a\x56\x73\x89\xeb\x9a\xac\x16\x7b\x82\x47\x76\x4a\x70\xce\x6a\x59\x84\xe6\x6e\x77\x33\xc3\x39\xcf\xd7\xd7\xef\x66\x59\x5a\x9c\x77\xcd\xfe\x53\x7d\xfc\x65\xec\x2d\x7e\x73\xe6\x55\x46\x26\xde\x26\x71\x09\x17\x66\x46\xa9\x69\xa4\x98\x2e\x21\x75\x29\x93\xb5\x29\xca\x71\x86\x42\xc8\x93\x0f\x6d\x75\xd9\xd8\xdc\x34\x55\x09\xde\xfb\x4c\x77\x06\xcc\xba\x4d\x8d\x59\xd1\xde\x92\x3d\x73\xb1\x32\xce\x92\xd0\xce\xa3\xfd\x8f\xf3\xce\xd4\xbb\xa4\x3e\xc1\x30\x54\x95\x89\xea\x24\x7f\x9d\xf8\x3b\x03\xef\x1d\x67\xa4\x74\x86\x7c\xc8\xf1\xb5\x75\x0f\x92\xf8\x84\x83\x43\x2f\x72\xba\xf4\x37\xee\xbd\xf1\x6e\xee\xb8\xfe\x53\xbc\x7e\x7e\x90\x57\xde\xe9\xa7\x10\xf2\xcd\xad\xb7\x22\x62\x6a\x60\xd6\x1d\x10\x56\x5b\x66\xb4\xd2\x97\x87\xd9\xa6\xf4\xf2\xd9\xd7\x78\x73\xec\x34\xed\x49\x1b\xd1\x94\x76\x5f\xa0\xaa\x19\x5f\xbc\xf1\xf3\xec\x5e\xbb\x9d\xa7\x8e\xff\x88\x5f\x9f\xf9\x1d\x85\x24\xcf\xc3\xb7\x3e\xc4\x47\x0a\xd7\xf3\xed\x81\xa7\xf9\xe1\x67\x9e\xa4\x2d\xb4\x71\xf8\xf4\x2f\x70\xe2\x66\x4b\x46\x73\x37\xbe\x65\x06\xc2\xea\x20\x42\x71\xd6\x9b\xb7\x08\x68\xbd\x96\x02\x1c\xfc\xc2\x0f\xa8\x68\xa5\xae\x4a\x70\x1c\x18\x7a\x81\xef\xff\x79\x3f\xe5\x38\x43\xa6\x91\xc9\xda\x14\x4b\xd3\x25\x7c\x77\xf0\x59\x36\xac\x5c\xc7\xb6\x8f\xdf\xc7\x86\x95\xeb\x68\x4f\x0a\xec\xf9\xfd\x37\x39\x7e\xe1\x04\xd7\xb5\xad\x20\x5a\x6c\xc1\x8f\x30\x44\x28\x2e\x28\x4b\xb9\xb6\x73\x35\x9f\x5e\xb9\x9e\xdb\x56\x74\xb1\x61\xe5\x3a\x56\xe6\x97\x93\x69\x86\x17\x47\x70\x1e\x11\x41\x70\xe4\x7c\xca\x63\xfd\xdf\xe1\x9f\x33\xa3\xac\x59\x76\x33\x07\x86\x5e\xe4\x85\xe1\x97\xf8\x50\x6b\x60\x5e\xbe\xdb\xcc\x28\xb5\x76\x1c\x67\xb8\xd9\x8f\xbd\xef\xa5\xaf\x30\x5c\x7a\x9b\xb6\x90\x62\x06\x51\x23\xc5\x74\x29\x99\xc6\x4b\xca\x15\xa8\x29\xed\x49\x81\xc4\x25\x00\xac\x68\xeb\x24\xe7\xd3\x56\xea\xd4\xf7\xc7\x7d\x18\x43\x12\x84\x56\x14\x9e\x46\x44\x8b\x64\x1a\x29\x55\x27\xb9\x58\x29\x31\x5e\x99\xe0\x62\xa5\x44\x25\x56\x70\xd4\xe5\x50\xa6\x11\x33\xe6\xe0\x3e\x75\xd7\xe3\xe4\x7c\xca\x6b\xe7\x8f\x72\xcf\xc7\x3e\xcb\xae\x5b\xee\xe7\x1f\x33\xa3\x84\xd6\x98\x3c\x93\x20\x60\x0c\x39\x44\x06\xc4\x09\x2d\xd0\x1a\x73\xb1\x3c\xb7\x8c\xe0\x3c\x39\x9f\x12\x9c\x27\x71\x81\xc4\x05\xbc\x78\xd4\x8c\x42\x28\x10\x9c\xa7\x3d\xe4\x99\xce\xca\x3c\x79\xc7\xb7\x58\xbf\xfc\x16\xbe\xf7\xa7\xe7\x79\xe0\xb7\x0f\x73\x61\x66\x8c\x27\x36\x3e\xc6\xdd\x37\xdc\xc5\x64\x36\x3d\xdb\x98\x9a\xab\xff\xc4\x09\x88\x0c\xf8\xe2\x97\x3e\x3a\xe6\xe0\x41\x14\xd7\x6c\x61\x3f\x7b\x31\x13\x2b\xbc\x71\xe1\x04\x47\xde\x1d\xac\x3b\x21\x71\x18\xd6\x30\xf1\x00\x9c\x9d\x3a\xc7\xab\xe7\x8e\x30\x13\x2b\xdc\xba\x7c\x0d\x7f\x38\x77\x84\xfd\x6f\x1e\xa2\x54\x9d\xe0\xc4\xe8\x29\xce\x4f\xbf\xc7\x74\x56\x66\x68\x7c\x98\xe0\x9a\x3d\x24\x13\x41\xb0\x4c\xed\x1b\x0b\xc2\x7a\x8e\x57\x27\x50\x53\x3a\xd2\xa5\x78\x71\x97\xd5\x1e\x11\xa1\x9c\x95\x29\x67\x15\x0a\x21\x4f\xce\xa7\x8c\x55\xc6\x11\xa0\x23\x2d\x12\x9c\x67\x2a\x2b\x53\xce\xca\xe4\x7c\x8e\xf6\x50\xa8\xff\x19\x2d\xb2\x9e\x02\x70\xf3\xcf\x36\xed\x74\xc5\xf0\x93\xec\x62\x35\x13\xd7\xfc\x19\xa8\x17\x8f\x08\x97\x35\x9f\xcb\x07\x3b\x97\x5b\xcb\xc6\xfa\x2b\xad\xa7\x35\xbd\x31\x99\x5a\x16\x96\xa5\x41\x4b\xd9\x97\x4f\x3f\xf0\xfa\x4f\x1d\xb6\xd7\xe5\xd2\xf1\x43\x71\xbc\x7a\xd4\xb7\x87\x60\xda\x7c\xdd\xd1\x68\x4a\x57\x1f\x3d\xd6\x9b\x52\xc3\xa7\x37\xd6\x37\x32\xf1\xfd\xfb\x4d\x87\x19\x7d\x7b\x08\x71\xbc\x7a\x34\x97\x8e\x1f\x9a\x9b\x87\x9e\xdc\x7a\xb2\xea\x5d\xdc\x6e\x35\x1d\x73\x39\xef\xd1\x16\x8b\xb9\xff\x85\x50\x8b\x2e\xe7\xbd\xd5\x74\xcc\xbb\xb8\xfd\xe4\xd6\x93\xd5\xb9\x79\x28\xb6\xd7\x0d\xed\x18\x18\xd6\xe9\xda\x66\xb0\x31\xc9\x79\x6f\x66\xd9\x22\xb5\xab\x36\xf5\x4c\x72\xde\x83\x8d\xe9\x74\x6d\x73\x63\x5a\x8f\xf4\x6a\xbd\x01\x49\xaf\xd2\xb7\xc5\x8f\xec\x1a\x38\xa6\x53\xb5\xcd\x18\xa3\xbe\x10\xc2\x2c\x54\x5d\x44\x78\x49\x5e\x9a\x65\xbe\x10\x02\xc6\xe8\xdc\xf3\xa4\xbe\x2d\x1e\xe9\xd5\x7a\x86\x36\x62\xeb\xe1\x38\x07\xb5\x54\xdb\xa4\xb5\xd8\x1f\x3a\xd2\x20\xa9\xab\xb7\x5d\xb3\x78\x8d\xc2\x55\xcc\x22\x06\x92\x3a\x17\x3a\xd2\xa0\xb5\xd8\xaf\xa5\xda\xa6\x0f\x3e\xf1\x9c\x7f\x20\xb2\x78\xd0\xe1\x52\x79\xf1\x5f\x1e\x74\x68\xc4\xe2\x51\x9c\xff\xf8\x28\xce\xbf\x00\xf3\x42\x85\xfa\xe7\xeb\x9f\x30\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", h2: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x06\x4c\x49\x44\x41\x54\x78\xda\xed\x9a\x5d\x88\x5d\x57\x15\xc7\x7f\x6b\xef\x7d\xce\xbd\x77\x66\x32\x93\xa4\xc4\xa8\x58\x8c\xf9\xac\x93\x18\xa2\xc9\xf4\x21\x5a\x28\x8a\x26\xa5\xa1\x84\xc0\x4d\x9b\x84\x14\xe3\x07\xa2\x42\x45\x7d\x11\x4a\x19\x2e\x7d\x11\xa4\x16\x7c\x51\x43\x44\xb0\x96\xa6\xb9\xb4\x0f\x69\xeb\x44\x10\x29\x14\x3b\xda\x4c\x3e\x4c\xd3\x21\x4d\x32\xa9\x93\x21\x23\xa6\xc9\x4c\x32\x33\x77\xee\xbd\xe7\x9c\xbd\x97\x0f\x33\x37\x36\x9f\x68\xc1\x3b\xa3\x99\xf5\x74\x1f\x0e\x9c\x73\x7f\x67\xad\xbd\xfe\xeb\xbf\x8e\x70\xab\xe8\xee\x36\x94\x4a\x01\xa0\x78\xa0\x68\x07\x3f\x92\x6c\xd4\x2c\x3c\x06\x74\x85\x4c\x57\x19\x23\xed\x1a\x54\x01\xe1\xff\x33\x54\x8c\x48\x08\x3a\x66\x9c\xbc\x0b\x1c\x16\x67\xf6\x7f\xf2\x62\xfc\x66\x79\x7b\xd9\xdf\xc8\xe8\x83\x71\x13\x90\xe2\x81\xa2\x2d\x6f\x2f\xfb\xf5\xbf\x5c\x1f\x99\x65\x1f\xdf\x85\xf0\x04\x81\x75\x26\xb6\xa2\x5e\x09\x59\x80\xa0\xdc\x15\x61\x04\xe3\x0c\x62\x85\x90\x78\xc5\x70\x1c\xe5\x67\x61\x60\xf8\xf9\x23\xdf\x3a\x92\x36\x58\xdd\x16\x68\x51\x8b\xb6\x2c\x65\xbf\xf6\xe5\x87\x56\xe6\xda\xdd\xaf\x6d\x6b\xb4\x31\xd4\x3c\xa1\xe6\x51\x51\x2f\x20\x20\x86\xbb\x2a\x34\x28\xa8\xa8\x58\x93\xb7\x98\xbc\xc5\x57\xd2\x37\xeb\x63\xd9\x9e\x13\xdb\x7a\x4e\x37\x98\x5d\x7b\x07\xd7\x65\xa6\x94\xfd\xba\x83\x9b\xbb\x72\xf3\xa3\x5e\x13\xdb\x8d\xe9\x68\x92\x85\x5a\x16\x10\x10\xc4\xde\x7d\x30\x01\xc4\x08\x62\x11\x08\xb5\x2c\xa4\xa3\x49\x66\x62\xbb\x31\x37\x3f\xea\x5d\x77\x70\x73\x57\x59\xca\xbe\x78\xa0\x68\xaf\xcb\xd0\x6e\xed\x36\x25\x29\x85\x75\x07\x37\x77\x45\xad\xf1\xef\x45\x58\xe0\xeb\x21\x13\xc1\x31\x17\x37\xe7\xac\x92\xd9\x9c\x71\xaa\x8c\xa6\x95\x64\xd3\xf1\x47\x0e\x1d\x6e\x30\x94\xc6\x8f\x0d\xaf\x3e\xbc\x54\x0a\xb6\x6f\x0a\xa6\xf7\x22\x62\xe7\xd0\xdd\x09\xaa\x7a\x9b\xb3\x56\x95\x51\xad\xfa\x0d\x7d\x5b\x5e\x3b\xd7\xad\xdd\xc6\x00\x74\x9e\x2c\xc6\x58\x79\xc1\x44\x66\xd6\xc2\x94\x59\x26\x28\x44\xc4\xfa\xba\xf7\x26\x32\x0b\xb0\xf2\x42\xe7\xc9\x62\x7c\xad\xe4\x37\xf4\x6c\xd9\x1d\x2d\x88\x7f\x93\x8c\xd4\x33\x31\xd2\xf4\x32\xb7\x77\x78\x7f\x5e\x3d\x41\x03\x8a\x22\x18\x8c\xcc\x2e\xb0\x1a\x34\x8b\x17\xe6\x5c\x3a\x9a\x3c\xde\xf7\xd0\xab\xcf\x49\xe7\xc9\x62\x5c\x18\xaa\x1e\xb1\x05\xdb\xe9\xab\x1e\x11\x9a\xde\x78\xc6\xd3\x09\x02\x0d\x29\xd6\x90\xb7\x8a\x20\xb4\xb9\x56\xf2\x36\x47\x64\x1c\x49\xc8\x48\x42\x32\xab\xb2\x55\x95\x60\x0b\x16\x5f\xf5\xfd\xd5\x7b\x0b\xeb\x5d\x61\xb0\xd6\x65\x72\xd2\x19\xaa\x5e\xa4\x89\x4f\x2a\x08\x8a\x62\xc4\xf0\xcd\xe5\x3b\x69\x8f\xda\xf0\x21\x20\xc2\x74\x36\x0a\x5e\x03\x7b\xcf\x3e\xcf\x77\x57\x3c\xce\xce\x25\x5b\xf9\xc5\xd9\xdf\xf2\xd3\x53\xfb\x58\x94\xbb\xe7\xba\xcc\x35\x62\x10\x84\x40\x40\x55\x9b\x5c\xfa\x98\x50\xf5\x6a\x22\xe9\x2c\x0c\xd6\xba\x9c\x08\xbb\x4d\x6c\x4d\x96\xa5\x7e\x4a\x1a\x35\xf5\x60\xc7\x1a\xc3\x37\x96\xed\xa0\x23\x6a\xbb\xe5\x35\xfb\x07\x0f\xf2\xee\xf8\x7b\xbc\x7e\xf1\xcf\x9c\xaf\x5c\x20\x32\x8e\x91\xe4\x0a\x5e\x3d\x6d\xae\x85\xd8\x44\x4c\x64\x93\xd4\x7d\x42\xc1\xe6\xc9\xdb\x1c\x4a\x73\xa1\xaa\x68\xb0\xb1\xb3\x9a\xf8\xdd\x4e\x25\x6c\x50\x6f\xa6\xa4\xe6\x4c\x94\x0c\x70\x35\x1d\xa3\xcd\x15\x78\xea\xc4\x33\xfc\xa3\xf6\x3e\x91\x89\x50\x20\x68\x60\x22\xab\x30\x34\x39\xcc\x5f\x47\xfb\x19\xac\x0c\x93\x33\x31\x5f\x5b\xba\x9d\xc8\x44\xbc\x3c\x74\x88\xf7\x2a\x43\x7c\xf9\xa3\x5f\xe0\x73\x0b\x3f\x43\xdf\xe5\x13\xfc\xe9\x52\x1f\x05\x9b\x27\x68\x68\x62\xc3\x44\xd4\x2b\x2a\x61\x83\x43\x64\x85\xa6\x61\x2a\x79\x67\x28\x9c\x58\xac\x58\xde\x78\xff\x2d\xce\x8e\xff\x8d\xbc\xcb\xa3\xaa\x14\x6c\x9e\x4c\x33\xbe\xb4\xf8\xf3\xec\x5a\xb2\x95\x9f\x9f\x79\x8e\xd7\x2f\xf6\x52\x70\x05\xbe\xbe\xf4\x51\x16\xe7\x17\xf1\xcc\xa9\xbd\xfc\xe4\xb3\x4f\x92\x37\x39\x5e\xb9\xf0\x07\x0c\xa6\xe9\x65\x0f\x22\x9a\x06\x10\x59\xe1\x64\xca\xe8\x60\xa6\x8c\x0e\x01\xc2\x34\x80\xbd\x5d\x3f\xa6\x1e\x12\x98\x3e\x17\x5f\x3a\xdf\xc3\xaf\xce\xbd\x48\xcd\xd7\xf1\xea\xa9\xf8\x2a\x6d\xae\x85\x67\x4f\xed\x63\x4d\xc7\x2a\xb6\x7e\xe2\x2b\xac\xe9\x58\x49\x8b\x2d\xf0\x83\xa3\x4f\xf3\xce\x95\xd3\xdc\x93\x5b\x80\x57\xdf\xf4\xbf\xa1\x41\x11\x23\xed\xb3\x6a\x94\x5c\x39\xef\x53\xac\x9d\x7f\x1f\xab\x3b\x56\xb2\xa6\x63\x15\x0b\x73\xf3\xc9\xd4\x63\xc4\x60\xc5\x22\x08\x22\x86\x9c\x89\x29\xbd\xfd\x2c\x97\xeb\x57\x58\x3e\x6f\x09\x2f\x0d\xf5\xf0\xbb\xe1\x3f\xce\x14\xcc\xeb\xab\x4d\x83\x8e\xcd\xa4\x1d\xa7\x70\x4d\x5b\xee\xea\xfd\x1e\xe7\x27\x2f\x90\xb3\x31\xaa\x8a\xd7\xc0\xbc\xa8\xf5\x3a\x48\x32\x7d\xb6\xb6\xb8\x16\x22\x33\x25\x99\x17\xc4\x1d\xc4\x26\x42\x09\x33\xc5\xf1\x5f\x76\x1f\xaa\x67\x24\x32\x53\x8a\x6a\x86\xc2\xab\xc7\xab\x67\x22\xab\x30\x96\x8e\x33\x96\x4e\x30\x96\x4e\x50\xf7\xe9\x94\x1c\xd2\x30\x0d\x55\xc9\x82\x07\x11\x9e\x5e\xfb\x43\x72\x36\xe6\x2f\x97\x8f\xf1\xc5\xc5\x1b\xd9\xb9\x64\x2b\x97\xea\xa3\x77\x1c\x12\xfe\x9b\x7a\x45\x22\x03\xaa\x67\x8c\xa8\xe9\x13\x2b\x28\xcc\x18\xd0\xf9\x71\x07\x56\x2c\xb1\x89\xb0\x62\x71\xe2\x70\xe2\xb0\x62\x50\x94\x16\x57\xc0\x8a\xa5\x60\xf3\xd4\x7c\x8d\xa7\x56\x3f\xc1\xa7\xdb\x97\xb3\x6f\x60\x3f\xdf\x3e\xfc\x24\x23\xc9\x55\x7e\xd4\xf9\x1d\x1e\x58\x74\x3f\x93\x59\x15\xd3\x64\x53\x4c\x41\xc5\x0a\xa2\xa6\xcf\x7e\x6c\xe7\xaa\x51\x44\xbf\x8a\xc7\xd0\x64\x61\xdf\xb8\x5b\xdd\xd7\x39\x79\xf5\x34\x7d\x23\x6f\x93\x84\x04\x33\x0d\xf2\x83\x4f\xf3\xf7\xda\x45\x7a\x2f\x1d\xa5\xe6\x13\xee\x6b\x5f\x46\xef\xa5\xa3\xbc\x78\xfe\x15\xc6\xd3\x09\x4e\x8d\x0f\x70\xb1\x76\x99\x49\x5f\x63\x60\x62\x10\x67\x9a\x9b\xa5\xa2\x22\xa0\xaa\x19\xdf\x9f\x55\xa3\xe7\x3c\xd7\x7a\x53\x76\x09\x42\xd5\xd7\xa8\x87\x84\x82\xcd\x11\x9b\x98\xab\xe9\x38\x00\xed\x51\x1b\x56\x2c\x93\x59\x95\x9a\xaf\x93\xb3\x31\x2d\xb6\xd0\x54\x61\x7f\xe3\xe8\x39\xab\xcc\x91\xdb\x75\xe8\x1b\x47\xcb\xc6\xf5\x41\xfd\x74\x53\x33\xd7\x46\xd9\x66\x0a\xfa\x5b\x9a\x23\xdd\xda\x6d\xca\xef\xf4\xbb\x96\xa1\xea\x1b\xb6\xd5\xdd\x9f\x55\xd2\x39\x2f\xf4\x3f\xf0\x44\x5d\x6b\x64\x7d\x25\x7b\x6b\xf2\xde\xc2\x03\xc5\xd5\x9d\x99\x01\xe8\x5f\x53\x4e\xf0\xba\x23\xa4\x61\x74\xca\x34\x9d\x61\x31\xf7\x3f\x02\xd3\xe6\xac\x0d\x69\x18\xc5\xeb\x8e\xfe\x35\xe5\x04\xc0\x94\xa4\x14\xba\xb5\xdb\xf4\x6d\x79\xed\x5c\x5a\x49\x36\xa9\x32\x0d\x95\x6c\x0e\xdb\x6d\xcf\xcd\xac\xe1\xd6\xa7\x95\x64\x53\xc3\xad\x2f\x49\x29\x18\x80\x92\x94\x42\xf1\x40\xd1\x1e\x7f\xe4\xd0\xe1\xb4\x92\x6c\x52\x18\x71\xad\xce\x69\x20\x43\x35\xcc\x21\xbc\x46\x32\x68\x20\x73\xad\xce\x29\x8c\x34\xf6\x49\xc5\x03\x45\x5b\x92\xa9\x1d\xfd\xdc\x1a\xf9\xdf\x69\x3b\x1f\x66\x8d\x0c\xd0\x58\x89\x9e\xd8\xd6\x73\x3a\x0c\x0c\x3f\xe8\x2b\xe9\x1e\x0d\xe1\x98\x38\x51\x57\x88\xac\x89\x9d\xc1\xc8\xdd\xc3\xd2\x08\x26\x76\xc6\x15\x22\x2b\x4e\x54\x43\x38\xe6\x2b\xe9\x9e\x30\x30\xfc\xe0\x89\x6d\x3d\xa7\x1b\xab\xf7\x1b\xcd\x9e\x9b\x63\xee\x53\x9c\x0f\xfd\x29\xce\x3f\x01\x49\xcf\x87\x8a\xc7\x6c\x48\x29\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", p: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x05\xe5\x49\x44\x41\x54\x78\xda\xed\x9a\x5d\x88\x5d\xd5\x15\xc7\x7f\x6b\xef\x7d\xce\xfd\x9a\x99\x98\x69\x31\x89\x96\x52\x0a\xa6\x7a\xd3\xa6\x12\x93\xc0\x04\xb4\xa5\xa0\x29\xd8\x16\x0a\x1d\x3f\x90\x18\xed\x43\x14\x5b\x9a\x96\xbe\xd8\x82\x5e\x87\x3c\xd4\x94\x82\xa0\x42\x51\x04\xab\x69\xd1\x66\x4a\x2d\x7d\x90\x98\x36\x44\xab\x0e\x8c\x99\x48\xda\x38\x63\x12\x93\x31\xad\xc4\x4c\xec\x7c\x7f\xdd\xaf\xb3\xf7\xea\xc3\xbd\x33\x26\x99\x49\x0b\x16\xee\x9d\x36\xb3\xe0\x3c\x9d\xf3\x72\x7e\xac\xf5\x5f\xeb\xbf\xf6\x16\x16\x8b\x02\x86\x2e\x02\x00\x9d\x9d\x76\xcd\xf5\xef\x6c\x09\x5e\xee\x00\x36\x49\xe0\x0b\x08\x6d\x28\x0a\x08\xff\x9f\xa1\x08\x82\x32\xa9\x86\xe3\xc0\x21\x63\xf5\xc5\xb3\x47\xbe\xd8\x43\x77\xb7\x5f\xc0\xe8\xbc\x58\x08\xa4\x13\x4b\x37\x9e\x1d\x37\x44\xab\x3e\x5b\xbc\x4b\x54\x7e\x80\x72\xbd\x44\x22\x78\x45\xbd\x82\x72\x79\x84\x80\x58\x01\x2b\x68\x55\x15\xe1\x88\x8a\x3e\x7e\xee\x1f\x99\xdf\xf0\xf4\xe1\xea\x3c\xab\x4b\x02\xdd\xdb\x69\xb9\xad\xdb\x5f\xf5\xe0\xb5\x6b\x43\x8b\x79\xd6\xa4\xec\x16\xad\x28\x5a\x0d\x00\xbe\xfe\xbd\xe1\xf2\x8a\x40\x2d\x85\xac\x44\x06\x89\x85\x50\xf6\x3d\x66\x3a\xdc\xfb\xe1\xa3\xc7\x4e\xcc\x31\x5b\x08\xb4\xfe\x62\xf5\x43\xeb\x36\x91\x62\x9f\x58\x69\xd7\xa2\x4f\x30\x62\x2e\x43\x88\x97\x86\x1b\x34\x48\xc6\x3a\xf5\x3a\x4a\x99\xaf\x0f\xed\xea\x3f\x74\x3e\x54\x39\x5f\x0f\x6a\x30\xf5\x15\x41\x56\x6a\x25\x24\x18\x71\xcb\x0c\x17\xc3\xaa\x89\xc4\xc6\x29\x3a\x46\x59\xb6\x0e\xed\xea\x3f\x34\xc7\x50\x28\x14\x0c\x5d\x5d\xe1\xca\xc2\x97\x3e\x6f\x9c\xef\x13\x91\x95\x5a\x0d\x1e\x11\xbb\x4c\xee\xdf\xb5\x2d\xf5\x12\x19\xab\xaa\x63\x21\xb1\x1b\x3f\xea\x3a\x3a\x48\xa1\x60\x84\x02\x26\x4f\xde\x8d\x8a\xbe\x2e\x29\xbb\x59\x8b\xde\x63\x96\x16\x4c\x41\x40\x40\x55\x97\x5a\xa6\x7a\xc9\x58\xab\x65\xff\x56\xbb\xca\x8d\x03\x0c\x24\x86\x2e\xc2\xa8\xc8\xed\x26\xe7\x36\xd7\x35\xb3\xe1\x30\xad\xb1\x38\xe3\x16\x79\x2c\x82\xe0\xd5\x53\xf5\x55\x82\x86\xa5\x05\xd4\x88\xd5\xa2\x4f\x4c\xce\x6d\x1e\x15\xb9\x9d\x2e\x82\xe4\x0b\xf9\x78\x54\x38\x2c\xb1\xe4\xb5\x14\xa8\x37\xa1\x86\xc6\x44\x69\x92\x10\x16\xc2\x12\x11\xda\xd2\xad\x64\xa2\x0c\x91\x75\x54\x92\x0a\x65\x5f\xa9\x65\xec\xd2\xc9\xd2\x20\x69\x83\x56\x74\xa0\x5d\xb9\xc1\x8d\x05\xd9\x24\x31\x79\x2d\xab\x60\x44\x1a\x59\xc6\x81\x80\x33\x8e\x1f\x7f\xe5\x01\xae\xc8\xac\xc0\x87\x0b\x46\x3a\xbc\x06\x7e\xf1\xea\x93\xfc\xe4\x6b\x3b\xb9\xaf\x63\x3b\x3f\x3f\xf8\x04\x0f\xbf\xf2\x28\xab\x5b\x57\xe1\x83\xc7\xab\x47\x55\x31\x62\x30\x62\x08\x1a\x1a\x9f\xc5\x46\x8c\x96\x55\xc5\x49\x7e\xac\xc2\x26\x17\x4c\xd8\x66\xac\x35\x24\xc1\x43\x63\xcb\x5d\x55\xb1\x62\xe6\x81\x2e\x16\xcf\xf4\xfe\x9a\xfe\x73\xc7\xd8\x77\xec\x00\xa7\x46\x4e\x13\xd9\x88\xe1\x99\x11\x12\x9f\xd0\x96\x6e\x25\x76\x31\x53\xe5\x69\x4a\xd5\x12\xd9\x28\x43\x26\xce\x34\x41\x6b\x35\x60\x8d\x0d\xc6\x6f\x73\x08\x1b\x6b\x26\x52\x9a\x52\x47\x0a\x8c\x16\xc7\x69\x49\xe5\xf8\xfe\x4b\x0f\x72\x66\xe2\x2c\x29\x1b\x13\x50\x42\xf0\x4c\x96\xa6\x18\x1c\xf9\x3b\xbd\x1f\xbc\xcd\xe0\xc8\x69\x32\x2e\xcd\xce\x1b\x77\x10\xd9\x88\x3d\x87\xbb\x39\x39\x3c\xc8\x37\xf3\x5b\xd9\xf2\xb9\xcd\xbc\x71\xba\x97\x03\x27\x5e\x23\x1b\x67\x1b\x9b\xa9\x22\x52\x37\xe2\x1b\x9d\x20\xd7\x68\xa2\x34\xd3\x97\xcf\x35\xa1\xfd\x27\x5e\xe5\xfd\xa1\xe3\xd8\x38\x8b\xd7\x40\x4b\x9c\xa5\xec\x13\xbe\x91\xbf\x85\xfb\x3b\xee\x61\xf7\xc1\xc7\xf9\xf3\xb1\x03\xe4\xe2\x1c\x3f\xbc\xe9\x3e\xae\x5e\xb1\x86\x87\xf6\xfd\x8c\x67\xef\x78\x82\x74\x94\xe2\x85\x23\xbf\xc7\x18\x4b\x13\xbc\xb1\x68\xa2\x08\x72\x8d\xab\x2d\x3a\x9a\x07\x54\x00\xad\x67\xd3\x4b\xdb\x7f\x45\x39\xa9\xa0\x35\x69\xe2\xb9\xbe\x17\xf9\xe5\x5f\x9e\xa2\x58\x29\x92\x84\x84\xa9\xf2\x34\xe9\x54\x0b\x85\xfd\xbb\xd9\xf0\x99\xf5\xdc\xb5\xe1\x3b\x6c\xb8\x7a\x3d\xb9\x38\xcb\xf6\x17\xbe\xc7\x91\x33\x47\xb9\xb2\xe5\xd3\x35\xf5\x6a\xf4\x6f\xa8\x82\xd0\xb6\xa4\x9c\xd0\xba\xd5\xd7\x22\x62\xf0\xc1\xe3\x8c\xe5\xe5\x77\xff\x44\x08\xc9\xfc\x58\x25\x08\x46\x0c\x69\x9b\x62\xe7\x1f\x7e\xca\xfe\x1d\xbf\xe3\xba\x55\x6b\x79\xbe\xef\xb7\x74\xff\xf5\x8f\xcd\x82\x79\x61\xb5\xa1\x4c\x22\xd2\x56\x57\x72\x69\x86\x86\x4a\x7d\x52\xbb\xe5\xe9\x4e\x4e\x0d\xbf\x4f\x3a\x4a\x13\x34\xe0\x83\x27\x95\x69\x5b\x00\xc9\x13\x68\x49\xe5\x88\x6c\x04\xc0\xa7\x72\xed\xa4\x5c\xdc\xcc\x39\x55\x6b\x3a\xaa\x93\x46\xd1\xf7\xc4\x09\x34\x71\x29\xe7\x83\x27\x09\x09\x13\xa5\x49\xc6\x8a\xe3\x8c\x17\x27\x18\x2f\x4e\x50\x4e\xca\x40\x6d\x1c\x4a\x42\x32\xff\x2d\xc0\x93\xdf\xde\x4d\xda\xc5\xbc\x36\xd8\xc3\xad\xd7\xdd\xcc\x8e\x8e\xed\x7c\x34\x3d\x8c\x33\x4d\x31\x79\x2a\x4e\x50\xf4\x3d\x83\xd2\x57\x17\xb2\xa6\x01\x6d\xcf\xae\xc4\x19\x47\xca\xa5\x88\x8c\x23\xb2\x11\x91\x8d\xb0\x62\x51\x0d\xe4\xe2\x2c\xce\x38\xb2\x71\x86\x4a\x75\x96\xc7\xbe\xb5\x8b\x2f\x5f\xb5\x8e\xc7\x5e\x7f\x8a\xce\xe7\xbe\xcb\xf0\xcc\x08\xbb\x6f\x7d\x98\x9b\xd7\x7e\x95\xa9\xf2\x4c\xe3\xbd\x89\xaa\xd6\x18\xd2\x67\xdb\x6e\x5a\x35\x86\xe1\x1e\x02\xa6\x91\x16\x64\xce\x9f\x8b\x08\xa5\xa4\xc4\xdb\x67\xfe\xc6\x9b\xa7\x7b\x29\x27\x95\x7a\xf5\xe8\x05\x0b\xc6\x0f\x26\x3e\xe4\xe0\xc9\x37\x98\x49\x4a\xac\x5f\x93\xe7\xe0\xa9\x37\x79\xa6\x77\x0f\xe3\xa5\x49\x8e\x0e\xbd\xcb\xd9\xc9\x73\xcc\x54\x67\x39\xfe\xcf\x93\x44\xd6\x35\xb8\xdc\x44\x44\x50\x49\xe4\x47\x4b\xca\x7a\xae\xc8\xb4\xd5\xb2\xf2\x3c\x1c\x22\xc2\x6c\xa5\x58\x1b\xdc\xe3\x0c\x29\x97\x62\x6c\x76\x1c\x04\xae\x48\xaf\xc0\x59\xcb\x74\x79\x96\x62\xb5\x48\xda\xa5\xc8\xa5\x72\x8d\x2d\xb6\x8b\xac\xa7\x00\xac\x7e\x64\xdd\x36\x93\x33\xcf\x87\xa9\xa4\x29\x3b\x50\x3b\xb7\x04\x09\xc9\xa2\x99\x75\xb1\xb5\xac\xe9\xa4\xe0\x83\x47\x69\xb2\xf5\x0c\x9a\x98\x56\xe7\xc2\x4c\xb8\x7b\xe8\x91\xfe\x3d\xff\x13\xeb\xbb\x25\x1b\x8b\xae\xef\x28\x30\xd0\x35\x50\x09\xea\xee\xd4\x24\x8c\x49\x6c\x2c\xaa\x7e\x99\xd6\x7f\x6c\x44\x5e\x62\x63\x35\x09\x63\x41\xdd\x9d\x03\x5d\x03\x15\x28\x2c\x1f\x81\x7c\xd2\x32\xbf\xd4\x11\x48\xad\x01\x75\x11\xd8\xdb\x69\x87\x76\xf5\x1f\xa2\x2c\x5b\x15\x46\x25\x63\x1d\x41\x13\x20\x2c\x13\xfc\x18\x25\x41\x13\xc9\x58\xa7\x30\x3a\x0f\x73\x6f\xa7\x9d\x3b\xa3\xff\xb8\xa3\xdf\xd6\xed\xe7\xa0\x9a\x69\xdf\xa1\x3e\xf4\x98\x56\xe7\x24\x32\x66\xde\xa0\x5c\x9e\x70\x43\xfd\xdf\x91\xc8\x18\xd3\xea\x9c\xfa\xd0\x63\xa6\x7d\xc7\xc5\x27\x9e\x8b\x2f\x44\x96\x2f\x3a\x5c\xb0\xb9\xf9\xef\x2e\x3a\xcc\xc5\xf2\x55\x9c\x4f\x7c\x15\xe7\x5f\xe0\x6f\x37\x94\xf3\x14\x01\xbb\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", d: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x05\x81\x49\x44\x41\x54\x78\xda\xed\x9a\xcf\x6e\x13\x57\x14\xc6\xbf\x73\xef\xb9\x33\xce\x26\x60\x6f\x40\x64\x11\xa9\x16\x09\x8e\x04\x42\x84\x00\x02\xba\xa6\x9b\x6e\x2a\x39\x94\x54\x54\xed\x0b\x54\xaa\xda\x55\x37\x96\x5f\xa1\x2f\x50\xa9\xa8\xa6\xb1\x37\x5d\x16\xb1\x01\x15\x58\x34\x44\x45\x0a\x72\x92\x86\x64\x41\x82\x02\x04\xd5\x22\x0e\xd8\xb9\x73\xff\x74\x91\x19\x2b\x0e\x24\xd0\x2e\x32\x08\x72\xa4\xd9\x78\xae\x34\xd6\x6f\xce\xf9\xce\x3d\xdf\x1d\xc2\x6b\xa2\x54\x2a\x89\x72\xb9\xec\x00\xa0\x58\x2c\xca\x20\x08\xce\x12\xd1\xe7\x00\x46\xac\xb5\x83\x42\x88\x5e\xef\xbd\x07\x40\x78\x3f\xc3\x13\x11\x39\xe7\x56\xa5\x94\xb3\x00\x26\xbc\xf7\xbf\x6a\xad\xef\xd4\x6a\x35\xbb\x95\xd1\xe6\x78\x05\x48\xb1\x58\x94\xb5\x5a\xcd\x0e\x0f\x0f\xab\x42\xa1\xf0\x05\x80\x6f\xbc\xf7\xc7\x99\x99\x9c\x73\x70\xce\x61\x83\xe5\xfb\x1f\x44\x04\x21\x04\x84\x10\x30\xc6\x78\x22\xba\x07\xe0\xc7\xe9\xe9\xe9\x5f\x26\x27\x27\xa3\x84\xd5\xb6\x40\x93\x05\x17\x2f\x5e\x1c\x60\xe6\x9f\xc2\x30\x3c\x6b\x8c\x81\x31\x06\x00\xac\xf7\x9e\x88\x48\xe0\x03\x0a\xef\xbd\x23\x22\x0f\x40\x32\x33\x98\x19\xeb\xeb\xeb\x77\x8c\x31\x5f\x8f\x8f\x8f\xff\xbd\x15\x2a\x6d\x85\x39\x3a\x3a\x3a\x12\x04\xc1\xef\x52\xca\x9c\xd6\xda\x00\x10\x1f\x1a\xc4\x9d\xe0\x02\x70\x41\x10\xb0\xb5\xf6\x1f\xad\xf5\x27\xd5\x6a\x75\x62\x33\x54\x91\xe8\x41\x02\x33\x0c\xc3\x6b\x44\x94\xd3\x5a\x1b\x22\xe2\x3d\x98\x5d\x12\x20\x88\x88\x63\x36\xb9\x30\x0c\xaf\x8d\x8e\x8e\x8e\xd4\x6a\x35\x5b\x2a\x95\x04\x00\x50\x22\xae\x63\x63\x63\x1f\x09\x21\xee\x12\x51\xd6\x5a\x6b\x01\xc8\x3d\x84\x3b\x86\x95\x52\x4a\xef\x7d\xc3\x39\x77\xb2\x52\xa9\x2c\x94\x4a\x25\x21\xe2\x72\x0f\x00\x5c\x95\x52\x66\x8d\x31\x7b\x30\xdf\x2e\xa4\x31\xc6\x4a\x29\xb3\x00\xae\xc6\x0c\x37\x34\x74\x6c\x6c\xec\x72\x26\x93\xf9\xb9\xd5\x6a\x19\x22\xe2\x34\xba\xe9\x0e\xba\xd5\xb9\x88\x68\xc7\xb5\x29\xe9\xaa\xe9\xe9\xe9\xe1\x76\xbb\xfd\x65\xa5\x52\xb9\x42\xc5\x62\x31\x60\xe6\x49\x66\x1e\x32\xc6\x20\x0d\xcd\x8c\xa2\x68\xdb\xad\x98\x52\x0a\xcc\x0c\x21\x04\xac\xb5\x70\xce\xbd\x73\x8d\x8a\x99\x61\x8c\xa9\x1b\x63\x86\x59\x29\x35\x42\x44\x43\xd6\x5a\xa2\x14\x5e\x3f\x11\xe1\xc8\x91\x23\x08\x82\xa0\x0b\x16\x11\xc1\x39\x87\x99\x99\x19\x14\x0a\x05\x1c\x3f\x7e\x1c\x13\x13\x13\x98\x9a\x9a\x42\x26\x93\xe9\x64\x6d\xb2\x96\x88\xba\x7e\xdb\xcd\x46\x65\xad\xf5\x42\x88\x21\xa5\xd4\x08\x03\xb8\x2c\xa5\x14\x69\x68\xa7\xf7\x1e\x42\x08\x0c\x0e\x0e\xa2\xb7\xb7\x17\x00\x20\x36\x64\x1d\x44\x84\x28\x8a\x30\x3f\x3f\x8f\xe7\xcf\x9f\x63\x71\x71\x11\x6b\x6b\x6b\x10\x42\x60\x7d\x7d\x1d\xce\x39\x04\x41\x90\x6c\xba\x61\x8c\x01\x33\x43\xca\x54\xe4\xdf\x49\x29\xa5\x31\xe6\x32\x03\x38\x19\xbf\x59\x4a\x4b\x9f\xa2\x28\x42\xbb\xdd\xc6\xc4\xc4\x04\x5a\xad\x16\xa4\x94\x9d\x6c\x33\xc6\xe0\xc5\x8b\x17\x78\xfa\xf4\x29\xd6\xd6\xd6\x20\xa5\xc4\xc0\xc0\x00\x98\x19\x0b\x0b\x0b\x68\x36\x9b\x38\x74\xe8\x10\xfa\xfa\xfa\xf0\xe8\xd1\x23\x3c\x79\xf2\x04\xcc\xbc\xab\x99\xea\xbd\xa7\xf8\x79\x27\xd9\x7b\x7f\xd8\x39\x07\x4a\x51\xed\x93\x92\x7d\xfc\xf8\x31\x9a\xcd\x26\xa4\x94\x70\xce\x81\x99\xe1\x9c\x43\x5f\x5f\x1f\x4e\x9d\x3a\x85\x5b\xb7\x6e\x61\x79\x79\x19\xcc\x8c\x33\x67\xce\x20\x0c\x43\x4c\x4d\x4d\xe1\xdc\xb9\x73\x90\x52\xe2\xc1\x83\x07\xa9\x34\xad\x78\xee\x87\xf7\xfe\x30\xc7\x46\x07\xd2\x34\x3a\x92\x0e\x7e\xfe\xfc\xf9\x8e\x8e\x2a\xa5\x30\x37\x37\x87\xd9\xd9\x59\x18\x63\xf0\xf2\xe5\xcb\x4e\x59\xdf\xbf\x7f\x1f\xb9\x5c\x0e\xf9\x7c\x1e\xd9\x6c\x16\x61\x18\xe2\xe6\xcd\x9b\x68\x34\x1a\x08\xc3\x30\x0d\xaf\x81\x62\xf9\xea\x7d\xa7\xa6\xa0\x7d\xfb\xf6\x21\x97\xcb\x21\x9b\xcd\x22\x97\xcb\x75\xe0\x24\x26\xc5\x66\xc3\x62\x72\x72\x12\xad\x56\x0b\x07\x0e\x1c\xc0\xec\xec\x2c\x96\x96\x96\xd2\x82\xd9\x15\xec\x9c\x5b\x4d\xdb\x8e\x4b\x3a\xf4\x8d\x1b\x37\x3a\x3a\x99\x68\xa8\x52\xea\x15\x48\xde\xfb\xce\x56\xca\x7b\x8f\x30\x0c\x3b\xc0\xd3\xb6\xfb\x04\x11\xcd\xc5\x7f\xcc\xa7\x59\xf2\xde\x7b\x44\x51\xd4\x75\x6d\x4c\xc0\x1b\xf7\x13\x29\x48\xfe\xe6\xc8\xc8\x08\xa4\x94\x58\x5c\x5c\x44\x3e\x9f\x47\x3e\x9f\x47\xbb\xdd\x4e\x45\x43\xbd\xf7\x5e\x08\x01\x22\x9a\x13\x00\xee\xc6\x4d\x21\x35\xa0\x41\x10\x74\xb2\x2c\x69\x50\x9b\xa7\x22\x66\x46\x4f\x4f\x0f\xa4\x94\x30\xc6\xe0\xc4\x89\x13\xe8\xef\xef\xc7\xf4\xf4\x34\x6e\xdf\xbe\x8d\xd5\xd5\x55\x9c\x3e\x7d\x1a\x07\x0f\x1e\x44\x3c\x9c\xec\x76\x85\xf9\xf8\x99\x77\xe5\xd1\xa3\x47\x1b\xde\xfb\xaf\x62\xe7\x89\x76\xbb\xd4\x01\xc0\x5a\x8b\x67\xcf\x9e\x61\x65\x65\x05\xf1\x8e\xa3\xeb\x3e\x11\xa1\xd9\x6c\x62\x79\x79\x19\xd6\x5a\xec\xdf\xbf\x1f\x0f\x1f\x3e\xc4\xfc\xfc\x3c\xb4\xd6\x68\x34\x1a\xd0\x5a\x43\x6b\x8d\xd5\xd5\xd5\x34\xca\x9f\xe2\x0a\xff\xf6\x9d\x1a\x3d\x95\x52\xaf\xcd\x2e\x6b\x6d\xd7\xc6\x5d\x6b\xdd\xc9\x6c\x22\xea\x6c\xec\xa5\x94\x60\xe6\xdd\x2e\xf7\xae\xd1\x53\xd6\xeb\x75\x7b\xec\xd8\xb1\xb5\x30\x0c\x3f\x33\xc6\xd8\x34\x80\x26\x4e\xf8\xb6\xb6\x8e\x94\x50\x4a\x75\x32\x6f\xeb\xfa\xad\xf7\x77\xdb\xc6\x0b\xc3\x50\x5a\x6b\xbf\x1f\x1f\x1f\xff\x8b\x4a\xa5\x92\xa8\xd7\xeb\xac\x94\xfa\x43\x29\x75\x4a\x6b\x6d\x89\x68\xcf\xbe\x7b\xbb\xec\xb4\x41\x10\xc8\x28\x8a\xfe\x8c\xa2\xe8\xe3\xa1\xa1\x21\x23\x00\xa0\x56\xab\x69\x00\x97\xac\xb5\x0d\x66\x96\x00\xec\x1e\xae\x37\x67\x26\x33\x4b\x6b\x6d\x03\xc0\xa5\x98\x21\x44\xb9\x5c\x76\xa5\x52\x49\x54\x2a\x95\x05\xad\xf5\x05\x00\x8d\xd8\x89\x36\x7b\xcc\xb6\xf7\x40\xe5\x86\x0b\xd3\xd0\x5a\x5f\x48\xdc\xfa\x72\xb9\xec\xf6\x0e\xe9\xfe\x63\x03\xc2\x1b\x0e\xe9\x3a\x5a\x59\xaf\xd7\x7d\x7c\x63\xa9\x50\x28\xfc\x06\x60\x38\x93\xc9\xf4\x27\x83\x3f\x36\x8e\x91\x53\x35\x51\xd2\x82\x48\x44\x0e\x80\x50\x4a\x51\x18\x86\x22\x8a\xa2\x3b\xc6\x98\x4f\xab\xd5\xea\xd4\xd6\x63\xe4\xae\xe6\x93\x40\xad\x56\xab\xcf\x82\x20\xb8\x92\xcb\xe5\x16\xbc\xf7\xfd\x00\x0e\x2a\xa5\xc4\x87\x06\x93\x88\x20\xa5\x24\x66\x16\xf1\x3e\xf3\x9e\xb5\xf6\x87\x99\x99\x99\xef\xae\x5f\xbf\xbe\xf2\xc6\x0f\x1d\x92\xd8\xfb\x14\xe7\xff\x7f\x8a\xf3\x2f\x55\x9b\x60\x6a\x49\x04\xd8\x52\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82" };
    var BTN_ADDLABEL = { key: "addlabel", w: 84, h: 28, n: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x0b\x72\x49\x44\x41\x54\x78\xda\xed\x9a\x7b\x94\xd5\xd5\x75\xc7\x3f\xfb\x9c\xdf\xbd\xf3\xbe\x03\x94\x11\x10\x04\x07\xe4\x91\x11\x42\x70\x06\x14\x13\xdf\x58\x12\x34\xb2\x62\x01\x61\x21\x24\xe2\xaa\x31\x6d\xa5\x1a\x5b\xdb\xa6\x4d\x09\x8d\x2b\xea\x6a\x53\x57\x4c\x4d\x89\x6d\xb4\xd6\x1a\x0d\x94\xa4\xd6\x9a\x8a\x51\x2b\x11\x91\xc7\x00\x82\x71\x52\x45\x1e\x23\xc3\x73\x60\x9e\xf7\xce\x7d\xfc\x7e\xe7\xec\xfe\x71\x87\x9b\x19\xe7\x81\x21\xed\x3f\x95\x73\xd7\x5d\xeb\xde\x75\x7e\xbf\x73\xf6\xef\xfb\xdb\xe7\xbb\xbf\x7b\x9f\x23\xf4\xd7\x56\x61\x58\x8d\x07\x60\xed\x42\x5b\x2d\x87\x2f\x97\xc8\x2f\x16\x98\xe9\x1d\x93\xc5\x48\x02\xaf\x0a\x08\xff\x3f\x9b\x62\x44\xd4\x6b\x87\xb1\xbc\xab\xb0\x5d\x03\xf3\xec\x01\x1d\xbd\x99\x45\xeb\x5c\x1f\x8c\x7a\xb4\xbe\x80\xac\x5d\x68\x59\xb4\xce\x71\x47\x6d\x6c\xfc\x35\x45\x4b\x11\xbf\x52\xbc\x7c\x4a\xe2\x46\xd4\x2b\x1a\x29\x78\xe5\x63\xd1\x8c\x20\x81\x20\x46\xd0\x9c\x57\x35\xfa\x16\x6a\x1e\xd9\xff\x5f\xd9\xa7\x79\x6c\x47\x58\xc0\x6a\x40\x40\xbb\x2f\xa8\x7e\x6c\xe6\x24\x49\xd8\x27\x6c\x69\xec\x72\x9f\x71\x68\xd6\x03\xea\x10\x11\xc0\xf0\xf1\x6a\x1e\x55\x05\xb1\x52\x64\x30\xc5\x16\xd7\x15\x6e\xd6\x0e\x77\xdb\x81\x3b\xb6\xbf\xf7\x61\x50\xa5\x0f\x98\x8f\xd7\xcd\x34\xa5\xf1\x17\x25\x26\xc3\x5c\x57\x14\x89\x88\xf9\x18\x82\x38\x20\xb8\xaa\xea\x6d\x69\x10\x68\xa8\x2d\xbe\x2b\xf7\xd9\x03\x2b\xea\xb7\xf7\x04\x35\x0f\xa8\xae\x32\xc8\x6a\x5f\xfd\x78\xdd\x4c\x53\x16\xdb\x00\x32\xd4\xe7\x5c\x24\x22\xc1\x39\x0c\xfb\x21\x58\xd5\xc8\xc4\x6d\x00\xda\xea\x53\xe1\xdc\x03\x2b\xea\xb7\x9f\xc6\x50\x4e\xff\x98\xf8\x74\xdd\x78\x6f\x63\xf5\x88\x0c\xd5\xac\x73\x18\xb1\xe7\xa0\x1b\xd4\x57\x9d\x14\x59\x8b\x6a\xab\x71\x61\xdd\xde\xa5\xf5\xfb\xd1\x55\xc6\x00\xd4\xac\xad\x89\x3b\x6f\x9f\x91\x98\x19\xea\xff\x97\xc1\x94\xee\xcf\x6f\x7a\xcd\xff\xe5\xfc\x67\x35\x86\x11\xeb\xb3\xce\x49\xcc\x0c\x75\xde\x3e\x53\xb3\xb6\x26\x0e\x60\x90\xd5\x3e\x9b\xab\xbc\xc5\x56\xc6\x67\xb9\x54\x14\xc9\x19\xc0\x34\x62\x30\x62\x3e\xb2\x91\x91\x46\x84\x3e\x42\x19\x58\x19\x84\x3e\x22\xd2\xa8\xff\x87\x11\x21\x30\x16\x23\x67\x47\xe3\xbf\x9a\xff\xec\x5b\xa8\xfd\xdb\x27\x46\xac\x4b\x45\x91\xad\x8c\xcf\xca\xe6\x2a\x6f\x41\x56\x7b\xa9\x59\x5b\x13\x4f\x67\x2b\x76\xd8\x12\x5b\xe3\xd3\x1e\x64\xe0\x00\xa4\x28\xe9\x28\x03\x40\x91\x8d\x13\x48\x30\x28\x50\x00\xe5\xb1\x52\x8c\x58\x92\x61\x0a\xa7\xae\xcf\x8b\x30\x62\x28\x8f\x95\xe1\xd5\x93\x0c\x53\x7d\x3c\x23\xe3\xb2\x74\x45\x69\x8a\x6c\x9c\xb2\xa0\xf4\x8c\xf3\xf5\x9d\xbf\x0c\x23\x86\x64\x98\xc2\xab\x3f\x2b\xef\xac\x88\x97\xa1\x0a\xc9\x30\xd5\x77\x7e\xc5\x9b\x12\x83\x4b\xbb\x86\x92\xa2\xce\x5a\x93\xcc\x25\x66\x9a\x98\xa9\xf1\x69\x2f\x83\x81\xe9\x55\x29\x32\x71\xfe\xf1\xea\xbf\xe1\xc7\x9f\xfd\x01\x93\x87\x4c\x20\xed\x32\x7d\x3c\xc7\x88\x10\x88\x25\x10\x8b\xa2\xfc\xc3\xd5\xdf\x66\xe3\xfc\xf5\x5c\x58\x31\x86\xac\xcb\x15\x3c\x3c\x6e\x02\x9c\x3a\x46\x96\x9e\xc7\xc6\xf9\xeb\xf9\xe1\x9c\x47\xb1\xdd\xf7\x08\x82\x11\x43\xc6\x65\xa9\xad\x9a\xc6\x37\x66\xde\xcb\xbc\xb1\xd7\x91\x71\xd9\x7e\x3d\xd5\x88\xc1\x8a\x25\x30\x16\x2b\x16\x83\x14\xc6\x79\xf2\xda\xef\xb0\x71\xfe\x7a\xc6\x94\x8d\xc2\x69\x44\xdc\xc4\x06\x1c\xe3\xb4\xdd\xa7\x57\x60\xe8\x23\x2a\x8b\x2a\x78\xe9\xc6\x1f\xf1\x93\xcf\xfd\x80\xa2\x20\x8e\x53\xdf\xdb\x29\x04\xe3\xd3\x5e\x4c\xcc\xd4\x24\x73\x89\x99\xc6\x22\xcb\x24\x30\x06\x06\x7e\x7d\x56\x2c\xa9\x30\xc5\xd5\xa3\x2f\xe7\x86\x71\x73\x98\x3d\xa2\x96\xe5\x93\x17\x92\x75\x59\x4c\x8f\xc1\x8d\x18\xd2\x51\x96\x93\xd9\x56\x4e\x66\x5b\xc9\xb9\x90\x21\x45\x95\x24\xe2\x15\x58\x31\xdd\x09\x48\xde\x5b\x4e\x66\x5a\x38\x95\x69\x03\x20\x11\xaf\xa0\x32\x9e\xe8\xe3\x19\x69\x97\xe1\x92\xaa\x69\xac\x9c\x76\x3b\xf3\xc6\x5e\x4b\xc6\x65\xfa\x78\xb8\xa2\x24\xc3\x14\x2d\xd9\x56\x9a\xd3\x2d\xb4\x64\xdb\x08\x7d\x58\x00\xad\x32\x9e\x20\x11\xaf\x40\x44\x68\xc9\xb4\x71\x32\xd3\x42\x32\x4c\xf5\x02\xd5\x88\xa1\x2b\x4a\x73\x32\xd3\xca\xc9\x4c\x2b\xa9\xb0\xab\xd0\x2f\x08\xc3\x8a\x2b\x19\x12\xaf\x1c\x84\xe6\xd4\x4b\x60\x8c\x45\x96\x05\xa8\xd6\xa9\x57\xba\x45\xfb\x40\x32\x81\xc0\x04\x2c\x9b\xb4\x00\x00\xa7\x8e\x1b\xc6\xcd\xe1\xe1\xdd\x8f\xd1\x9c\x6e\x21\x66\x02\x44\x84\x64\x98\xe2\x13\x43\x27\x72\xcd\xe8\x4f\x03\xca\x73\x07\x36\x90\xea\x5e\x26\xda\x6d\x5e\x2a\xec\xe2\x8a\x51\x97\x72\xe9\x88\x19\x7c\xd0\x79\x84\x3d\xa7\x1a\x88\xbc\xc3\xa9\xeb\x77\xb9\x65\xa2\x2c\x91\x77\x24\xc3\x54\xbf\x0f\x64\xc5\x52\x57\x35\x9d\x19\xc3\xa7\x32\xa4\x28\xc1\xf1\xf4\x49\x5e\x6d\xda\xc4\x91\xae\xe3\x94\x05\x25\x38\x75\xb8\x6e\x5f\x59\x3e\x79\x11\xd5\x89\x0b\xd8\x76\xfc\x2d\x5e\x3f\xba\x95\x92\xa0\x18\x41\xe8\xcc\x25\x99\x51\x35\x95\x2b\x46\x5d\x8a\x20\x6c\x3e\xb6\x9d\xfa\xe6\x3d\x14\xd9\xf8\x19\x39\xfe\x34\xd1\xab\x57\x50\xad\x0b\x10\x26\x6a\xa4\x0c\x94\x97\x1b\x31\xa4\xc2\x2e\xa6\x0f\xbf\x98\xd9\x23\x6b\xd9\x7e\xe2\x2d\xf6\x75\x34\xb2\xf8\xa2\xf9\xdc\x30\xf6\x3a\x1e\xfd\xc5\x3f\x51\x55\x3a\x9c\xb6\x6c\x1b\x73\xc6\x5c\xc9\x9a\xab\x1e\xa2\x2c\x28\x05\x60\xe5\xb4\xdb\xc9\xba\x1c\x82\x10\x98\x80\x64\x98\xe2\x2f\xeb\xee\xe1\xde\xe9\x77\x16\xc6\x6f\xec\x6c\xc2\xe3\x07\x7c\x9f\x03\x05\xa5\xfc\x92\x0c\x19\x51\x5a\xc5\xf3\xf3\x9e\xec\xd5\x77\x24\x75\x9c\x85\x2f\xdd\x41\x53\xf2\x08\x81\xb1\xa8\x7a\xd6\x5c\xf9\x20\x93\x86\x4c\x28\x5c\xf3\xb7\xbb\xbf\xcf\xb7\x77\xaf\x41\x15\x6e\x9b\xb2\x98\x07\x2e\xfb\xb3\x5e\x63\xfc\xf9\xd6\x07\x59\xf3\xce\x53\x8c\x28\xa9\xfa\x28\x4a\x41\x34\x52\x10\x26\x1a\x11\x12\xdd\xb9\x79\xff\x80\x22\xe4\x7c\x8e\xc5\x13\x6e\x42\x10\xd6\x34\x3c\xc5\x5f\xef\xfa\x1e\xce\x3b\x96\x4e\xba\x99\x44\x51\x05\x59\x97\xa5\x2c\x28\x63\xf5\xcc\x3f\xa2\x2c\x28\x65\xdd\xbe\xe7\xf9\xc2\x8b\xb7\xb3\xe9\xe8\x76\xce\x2b\x19\x5e\x08\x66\xd3\x86\x4d\xe1\xde\xe9\x77\x12\xfa\x90\x87\x76\x3d\xca\x92\x9f\xfd\x1e\x69\x97\x21\x6e\x62\x84\x2e\x44\x7e\x0d\x75\xa3\x28\x31\x13\xa3\x39\x7d\x8a\x95\x9b\xbe\xce\xad\xaf\xdc\xc5\x6f\x3f\xbf\x84\x9f\x1c\xf8\x4f\xce\x2f\x1b\xc1\x2d\x17\xdd\x44\x2a\x4a\xe3\xbc\x23\x30\x01\x46\x2c\x4b\x5f\xfe\x7d\xbe\xb5\xf3\x11\x72\x3e\xe4\xab\xd3\xbf\xcc\xe4\x21\x13\x18\x53\x3e\x8a\xfb\x2f\xbd\x8f\x0f\x92\x87\x59\xb8\xe1\x0e\x16\xff\xec\x2b\x1c\x4e\x1d\xe3\xeb\xb5\x77\x33\xb6\x62\x74\x37\x6f\xcb\x99\x63\x97\x57\x44\x48\x04\x67\x8a\x70\x19\x97\x63\x5c\xf9\x18\xbe\x30\xfe\x73\x74\x45\x19\x02\x09\x18\x5b\x31\x86\x83\xc9\x26\x26\x0d\x99\xc0\x55\xe7\xcf\x66\xfd\xbe\x17\xf8\xcc\xa8\x4b\x19\x9f\x18\xc7\xc1\xce\x26\xfe\x74\xcb\xb7\x68\xcd\xb6\xb3\xe7\x54\x03\x9f\xfc\xad\x29\x5c\x50\x3e\x9a\x74\x94\x61\xd6\x88\x19\x00\xbc\xd0\xf8\x32\x0f\xec\xfc\x2e\x8a\xd2\x9a\x6d\xe3\xc5\x1b\x7f\x88\x11\x83\xea\xe0\xb6\x58\xb1\x05\x2e\x06\x21\xd2\x08\x2b\x96\x92\xa0\x98\x2f\x5d\xb8\x08\x6b\x2c\x91\x8f\x50\x55\xce\x2f\x1d\x81\x15\x53\xf0\xfc\x7b\xde\x58\xc5\xcf\x8f\x6e\xe1\x3f\x1a\x5f\x66\x62\x65\x35\x0b\x26\x7c\x9e\x8b\x87\x4d\x41\x55\xb1\x62\x69\xcd\xb6\x71\xd9\xc8\x4b\x50\x85\x9c\x0f\x29\x0e\x8a\xb9\x6c\xc4\x25\xbc\xd2\xb4\xe9\xd7\x92\x6c\x81\x2a\x1d\x03\x95\xe3\xac\x18\xda\xa2\x14\xb7\x5d\x78\x0b\x89\x78\x05\x00\xdf\xbf\xea\xa1\x5e\x03\x2c\x9b\xb4\x80\xf5\xfb\x5f\x20\x66\xf2\xf2\x35\x1d\xa5\x49\x47\x19\x2a\xe3\x15\x64\x5c\x86\xae\x6e\x99\x95\xf7\xa8\x00\x55\xa5\x2d\xdb\x01\x28\x15\xb1\x72\xda\x73\x9d\x05\x6a\x19\xac\xe5\x7c\x48\x5b\xae\x03\x23\x06\xa7\x0e\x2b\x96\x9c\x0f\xf9\x46\xdd\x57\xf9\x83\x69\x2b\xd8\xdf\xd1\xc8\xcf\x8f\x6e\x65\xea\xb0\x29\x79\x10\xe5\x57\x94\x01\xd0\x9e\xeb\xa0\x3c\x56\x46\x32\x4c\xd1\x9a\x6d\x47\x55\x89\x49\x80\xb5\x16\xaf\xca\x79\x25\xc3\xb9\x76\xf4\x67\x28\x09\x8a\x39\xd0\xd1\xc8\xfe\xf6\x46\x52\x61\x57\x41\x79\x7c\xd4\x72\x5f\x80\xb2\x57\x02\xa9\xd5\x5c\x5f\x40\x23\x75\x94\x06\xa5\x2c\xba\xe8\x26\x54\x95\x27\xde\xfd\x11\xad\xd9\xb6\x82\x34\x59\x36\x79\x01\xb3\x47\xd6\xf2\xc9\x61\x35\xfc\xb2\xf5\x7d\xda\x73\x1d\x4c\x1a\x32\x9e\xdb\x3f\xb1\x84\x67\xf6\xfe\x1b\x77\x5e\xbc\x9c\x89\x95\xd5\x44\x3e\x2f\x57\xde\x6d\xdd\x87\x88\x70\xc3\xb8\x39\xbc\x78\xe8\x35\x76\x9f\x6a\xe0\x8f\x3f\xf5\x15\x9c\x3a\xb2\x2e\x9b\x5f\xf2\xda\x77\x69\x47\xde\x31\xb2\xb4\x8a\xeb\xc7\x5c\x49\x45\xbc\x1c\xaf\x79\xce\xdd\x76\x7c\x17\x9f\x1e\x35\x8b\x9c\x0f\x59\xfe\xca\x4a\xde\x78\xff\xdf\xb9\xf5\x92\xbb\x78\xe2\x9a\x87\x09\x7d\x3e\x88\xe4\x5c\x0e\xa7\x8e\x7b\xa7\xdf\xc9\xd7\xb6\x3e\xc0\xe5\x23\xeb\x98\x7f\xe1\x5c\x8c\x08\xfb\x3b\x1a\x0b\x4b\xba\x39\xdd\xc2\x97\x37\xde\xc7\x89\xf4\x49\x16\x4d\xb8\x89\xa6\xe4\x51\x36\x34\xbd\xc6\x84\x8a\x71\x64\xa3\xb0\xdf\xa0\xd9\xd3\x4c\x09\x44\x34\xab\x7b\x03\x44\xea\xc5\x48\xad\xaa\x6a\x4f\x12\xb3\x62\x69\xcb\xb5\xb3\x60\xfc\x8d\xd4\x0c\x9d\xc8\xce\xe6\xb7\xb9\x7b\xd3\x2a\x62\xdd\x5a\xaf\x25\xdb\x4e\x49\x50\xc2\xef\xd6\x2c\xe5\xae\x69\x2b\xf8\xe2\xab\x7f\xc8\x77\xdf\x7e\x9c\xbf\xa8\xbd\x9b\x6f\xce\xba\x8f\x6f\xce\xba\xaf\x57\x60\xab\x8c\x27\xd8\x7c\x6c\x3b\x3f\xfd\xe0\x55\xe6\x8d\xbd\x96\x67\xaf\xff\xfb\xfc\x4b\xf3\xf9\x65\x5b\x55\x32\xbc\x5f\x9e\x2c\x0f\x4a\x09\x8c\x65\xde\xb8\xeb\x98\x37\xee\xba\x5e\xfd\x57\x3d\x77\x33\x9b\x8e\x6e\x65\xc6\xf0\xa9\x3c\x72\xc5\xfd\xfc\x72\xea\x17\xf9\xfc\xb8\xeb\x09\x8c\xa5\x32\x56\x81\x02\x55\xc5\xc3\xb1\x62\x99\x5f\x3d\x97\xf9\xd5\x73\x0b\xf7\xbe\x74\x68\x23\xbb\x4e\xfe\x82\x48\x1d\x4f\xbf\xf7\x63\x96\x4e\xba\x99\x6d\xbf\xf3\xd3\x42\xff\x8e\xe6\x3d\xbc\x76\xe4\x0d\x10\x28\x8b\x95\x10\xb7\xb1\x81\x03\x93\xaa\x8a\x11\x10\xa9\xb7\x89\x9b\xc7\xb4\x1a\xf8\x12\x9e\x5e\xf9\xa4\x88\xe0\xd5\x53\x9d\x18\xcb\xc1\x8e\x43\x3c\xf5\xde\xbf\x72\x2a\xdb\xca\xd0\xa2\x4a\x4a\x82\x12\x4a\x63\x25\x1c\xe8\x68\xa4\x33\x4c\xf1\x41\xf2\x30\x07\x3b\x0f\xb1\xe5\xf8\x4e\x0e\x76\x1e\x22\x10\x4b\x63\xf2\x30\x5f\xdb\xfa\x20\x5b\x4f\xec\xe4\xbf\xdb\xde\xe7\xcd\xe3\xf5\x64\x5c\x96\x97\x9b\x5e\x27\xd5\x9d\x11\xd5\x37\xef\xe1\x4f\xde\xbc\x9f\x63\xe9\x13\x6c\x3e\x56\xcf\xae\xe6\x77\x0a\x7c\xd9\xd3\xf6\x13\x99\x53\x6c\x3e\x5e\xcf\x96\xe3\x3b\x7b\x7c\x77\x50\x7f\x62\x37\x1b\x8f\x6e\x41\x10\xaa\x13\x17\xe0\x55\xf9\xde\x3b\x4f\xb2\xaf\xe3\x20\x9b\x8e\x6e\x63\x7f\x67\x23\x5e\x3d\x3b\x9b\xdf\xe6\xc1\x5d\x7f\x47\xdc\xc6\x68\xc9\xb4\xf1\xec\xfb\xcf\x71\xff\x8e\xef\x14\x02\xdb\x86\xa6\x8d\x34\x25\x8f\x80\x40\x73\xe6\x14\xeb\xf6\x3d\xcf\x5f\xd5\x3f\x4c\xce\xe7\x0a\x09\xc6\xa6\x63\xdb\xd8\xd9\xbc\x27\xaf\x48\xfa\x00\x2b\x82\xa0\x91\xd7\x7b\x06\x4d\x3d\x05\xa1\x2b\xea\x22\xe3\x72\x94\x06\x25\x14\x07\x45\xf9\x5a\x6b\x41\xb6\x44\x74\x86\x49\xac\x98\xbc\x78\x46\xe8\x0c\x93\xdd\xcc\x91\x17\xf1\x5e\x3d\xa1\x8f\x48\xc4\xcb\x89\x99\x00\xe7\x7d\xfe\x1e\x63\xf1\xde\x13\xb3\x31\x32\x2e\x8b\x20\x54\x76\xf3\x74\x7f\xa9\x67\x3f\x6c\x40\x65\x8f\x39\x8d\x18\x42\x1f\x11\x88\x25\x52\x57\x48\x55\xdb\x73\x1d\xf9\x2c\xcf\xc6\x89\x7c\x84\x31\x06\xe7\x1d\xe5\xb1\x72\xac\x98\x42\x46\xd5\x11\x76\x16\xe4\x91\xeb\xa6\xba\x98\x0d\xf0\xde\xd3\x9e\xeb\x40\x44\x0a\xcf\x38\x58\xea\x29\x00\x13\xfe\x65\xf6\x32\x93\x08\xfe\x39\x6a\xcb\x45\x62\x7a\xd7\x40\xf3\xa9\xa2\xe0\x55\xfb\xe4\xc2\x82\x60\x4d\x3e\x3a\x9f\xe6\x98\x0f\x93\xb8\x20\x88\x80\xf3\xbe\x57\x5a\x99\xff\x9d\x07\x29\x9f\x2a\xd2\x2f\x4f\x19\x91\x01\x03\x56\xe4\xdd\x87\xc6\x93\xd3\xfe\x52\xb0\xd7\x8a\x2d\xfc\x97\x82\x3e\xc8\xaf\xbe\x9e\x76\x5a\xb1\xdd\x24\xd3\xb7\x3f\xaf\x65\xfb\xb7\x4f\xbd\x46\xc1\x90\x78\xe0\x3b\xa2\xe5\xfb\x6e\x7d\xf3\x29\x41\x57\x99\x9a\x75\xeb\x82\x4c\xb6\xe2\x75\x53\x1a\xcc\x72\xa9\xc8\xc9\xb9\x5a\xe8\x47\xd3\xc2\x5e\x9d\x2d\x0b\xac\xef\x8a\xb6\x15\x17\x75\x5e\xd1\xb0\x70\x61\x64\x00\x1a\x16\x35\xe4\xac\x71\x4b\x34\xf4\xad\xa6\xc8\x5a\xfc\xe0\x21\xed\x5c\xcb\x17\x98\x4d\x91\xb5\x1a\xfa\x56\x6b\xdc\x92\x86\x45\x0d\xb9\x42\x3d\x14\x5d\x65\xf6\x2e\xad\xdf\xef\xbb\xc2\xb9\xa0\xad\x52\x64\xad\xea\x60\xc9\xeb\xb9\x2d\x10\x29\xb2\x16\xb4\xd5\x77\x85\x73\x4f\x57\xeb\x91\xd5\xbe\xbb\xa4\xb2\xda\xb3\x76\xa1\x3d\xb0\xa2\x7e\xbb\x4f\x85\x73\x51\x5a\x6c\x69\x10\x74\x83\xea\xcf\x41\xd8\x6b\x93\x2e\xb2\xa5\x41\x80\xd2\x52\xd8\x4f\x5a\xbb\xd0\x22\xab\x3d\xbd\x76\x33\x17\xad\x73\x05\x50\x3b\xc2\xd9\x3e\x74\x9b\x83\xca\x78\x20\x71\x63\x50\x40\xd5\x7d\x4c\xc1\xf5\xa8\x3a\x14\x24\x6e\x4c\x50\x19\x0f\x7c\xe8\x36\xfb\x8e\x70\xf6\x87\x77\x3c\xfb\x2f\x88\x9c\x3b\xe8\xd0\x53\x62\xfc\x86\x07\x1d\x4e\xb7\x73\x47\x71\xce\xfa\x28\xce\xff\x00\xbe\xc5\xf3\x4b\x8f\xe9\x7b\xff\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", h2: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x0b\x6a\x49\x44\x41\x54\x78\xda\xed\x9a\x7b\x70\x5d\xd5\x75\xc6\x7f\x6b\xef\x73\xae\x74\xa5\x2b\xd9\xf2\x2b\x32\x7e\x88\x58\x18\x8c\x82\x8d\x8d\xad\x40\x8c\x3d\x71\x26\x18\x3b\xc1\x8e\x3d\x4c\xe4\xe0\x66\xdc\x42\x81\x50\xdc\xb4\x33\x0d\x43\x4a\x12\x17\x8d\x32\x0c\xd3\x69\xc9\x50\x1e\x6d\x9a\x90\xc4\xa4\xd0\x21\xb1\x98\x74\xcc\xe0\xf2\xc8\x90\xd2\x3a\xc5\x2f\x19\x5b\x7e\xc6\xf6\x80\xe3\x87\x84\x9f\xba\x92\xac\xfb\x3a\xe7\xec\xbd\xfb\xc7\x7d\x58\xb2\x1e\x0e\x34\xf9\x27\x78\x6b\x34\x73\x47\xe7\x9c\xbd\x8f\xbe\xbd\xd6\xfa\xbe\xf5\xed\x2b\x0c\x35\x9a\x9b\x15\x2d\x2d\x16\xa0\x69\x43\x93\x3e\x36\x21\x98\xef\x22\x7b\x17\xd0\x68\x23\x77\x9d\x52\x52\xed\xac\x73\x80\xf0\xc7\x39\x9c\x28\x11\x6b\x5d\xaf\xf2\xe4\x10\xb0\x43\x3c\xf5\xb3\xba\x33\xb1\x77\x5a\x57\xb5\x9a\x4b\x31\xea\x3f\x06\x01\xd2\xb4\xa1\x49\xb7\xae\x6a\x35\x73\x7f\x30\xd7\x57\xf5\x57\x7d\x15\xe1\xaf\xb1\xcc\x56\x31\x2d\xce\x38\x6c\x64\xc1\x3a\x3e\x16\x43\x09\xca\x53\x88\x16\x6c\x60\x1c\x8a\xdd\x38\x9e\xb6\xef\x75\xfe\xfb\xce\x07\x76\x86\x45\xac\x86\x05\xb4\xc9\x35\xe9\x56\x69\x35\xb3\x7e\xf1\x85\x6b\xcb\xaa\xbd\xf5\xba\xd2\x9f\x6f\xb3\x06\x9b\x35\x38\x71\x46\x40\x40\x14\x1f\xab\xe1\xac\x03\x27\x4e\xb4\x2a\xd7\xa8\x72\x8d\x49\x85\xef\xe4\x7a\xa3\x7b\xf6\xdc\xf9\xda\xe1\x22\x66\xa5\x3d\x18\x10\x99\xd2\x6a\x66\xbf\xb2\xb4\xb1\x6c\xb4\xbf\x45\xc5\xf4\xfc\x30\x19\x44\x36\x1b\x59\x04\x04\xd1\x1f\x3f\x30\x01\x44\x09\xa2\x11\xb0\xd9\xc8\x86\xc9\x20\x52\x31\x3d\xbf\x6c\xb4\xbf\x65\xf6\x2b\x4b\x1b\x5b\xa5\xd5\x34\x6d\x68\xd2\x03\x22\xb4\xd9\x35\xab\x16\x69\xb1\xb3\x5f\x59\xda\xe8\x57\xc6\xde\x10\xa1\xc6\xe4\x6c\x24\x82\xc7\x95\x31\x38\x66\x1d\x91\x2e\x53\x9e\x73\x24\xc3\x54\xb0\x64\xf7\x97\x5e\xdf\x51\xc4\x50\x8a\x1f\xe6\xbd\x7a\xc7\x34\x89\xeb\xb6\x3c\x98\xc6\x88\x88\xbe\x02\xdd\x48\xa0\x3a\xa3\xcb\xb4\x76\x8e\xa4\xcb\x98\x79\x6d\xcb\x36\xbd\xdf\xec\x9a\x95\x02\x68\xd8\xd7\x14\x43\xcb\x4b\xca\x57\xbf\x77\x30\xa5\xf0\xf3\xff\xbd\xe7\x0f\xb9\xfe\x47\x99\x43\x44\xb4\xc9\x19\xa3\x7c\x55\x83\x96\x97\x1a\xf6\x35\xc5\x4a\x29\x3f\xef\xb5\x65\x6b\xfc\x9a\xd8\xbf\x05\x5d\xb9\x48\x94\x78\x23\x13\x9f\x2a\xee\x10\x8e\xcb\xb3\xbd\x71\x16\x70\xa8\x7c\x19\x1a\xe6\x9e\x7c\x4d\xd7\x43\xec\xa3\x20\x28\x51\x38\x1c\xd6\xd9\x0f\x0d\xc6\x48\x73\xff\x3e\xe6\x70\xd6\x45\xb1\x31\x65\x5e\x98\x0c\xfe\xb4\xed\x0b\xaf\xbe\x20\x0d\xfb\x9a\x62\xf1\x13\x99\x9d\x3a\xae\x1b\x4c\xc6\x20\xc2\xb0\xc4\xe3\x70\x64\x4d\x0e\x80\x98\xf2\xf1\xc4\xbb\x2c\xa8\x95\x5e\x1c\x25\x9a\x54\x94\xc6\x38\x3b\x08\x54\x25\x42\xa5\x57\x89\x75\x96\x54\x94\x1e\x04\x66\xce\x06\x64\x4c\x96\x98\xf2\xa9\xd0\xf1\xdf\x69\x13\x07\xae\x5f\x81\x12\x45\x2a\x4a\x7f\xa4\x0d\x11\x84\x84\x57\x81\x03\x52\x51\x6a\xd0\xea\xce\x61\x75\x5c\x63\x32\xe6\x40\x66\x4a\x7c\xae\x8a\x1f\xcb\x36\x2a\x5f\x1a\x6c\xc6\xc8\x88\x60\x3a\x47\x4c\xc5\x78\xf2\xa6\x47\x79\xfe\x96\xef\x71\x4d\xe2\x6a\xb2\x36\x87\x92\x41\xa9\x80\x16\x8d\x16\x8d\x73\x8e\x27\x6f\x7a\x94\x8d\x0b\x9f\x63\x4a\xc5\x44\x02\x93\x43\x89\x42\x89\xc2\x53\x1e\xc6\x59\x26\x94\x8f\x63\xe3\xc2\xe7\xf8\x41\xe3\xe3\xe8\x42\x24\x4a\x21\x13\xb2\x36\xc7\xac\xd1\x33\x78\xf8\xfa\x07\xb8\xad\x76\x01\x39\x1b\x94\x32\xe4\xd2\xac\x29\xae\xa9\x45\x23\x48\x61\x1e\xe1\xd9\x79\xdf\x65\xe3\xc2\xe7\x98\x18\x9f\x40\xe4\x0c\xbe\xf2\x2e\x3b\x87\x12\x85\x20\x44\x2e\xa2\x3a\x96\xa0\x75\xe1\xbf\xf2\xd3\xcf\x7c\x8f\x98\x2e\xc3\x3a\x3b\x20\xfd\x45\x50\x36\x63\x44\xf9\xd2\x10\x3f\x96\x6d\x54\x22\xac\x51\x31\xad\x9c\x0c\xbf\x7d\x5a\x34\x29\x93\xe6\xd6\x71\xf3\x58\x5c\xbb\x90\x79\x63\x66\xf1\x95\xba\xe5\xe4\x4c\x40\xff\x3d\x50\xa2\xc8\x99\x80\x64\xd0\x4d\x32\xe8\x26\xb4\x21\xa3\xfc\x6a\xaa\xfc\x44\x01\x2c\x4a\xd1\xd2\x15\x74\xd3\x1d\xf4\x00\x50\xe5\x27\xa8\xf6\x13\x83\x22\x23\x6b\xf2\x80\xde\x5f\xbf\x9a\xcf\x7f\xe2\x56\xb2\x26\x37\xa8\x96\x39\x1c\xa9\x28\x4d\x32\xe8\x29\xcd\x19\xba\xa8\xb4\xd1\xd5\x7e\x82\x2a\x3f\x81\x20\x74\x17\xee\x49\x45\xe9\x01\x81\xa0\x44\x91\x89\x32\x74\x05\xdd\x74\x05\xdd\xa4\xa3\x4c\x09\x74\x41\x18\xed\x57\x33\xca\xaf\x1e\xb6\x64\x39\x71\x56\xc5\xb4\x12\x61\x8d\xe7\xc4\xce\x73\x46\xe5\xa5\xe6\x08\xa9\xae\x45\xb3\x6a\xea\xb2\x52\x4d\x59\x5c\xbb\x80\xef\x1f\x79\x91\xae\x20\x89\x27\x1e\x22\x42\x2a\x4a\x73\x6d\xd5\x27\x59\x30\xbe\x11\x07\xbc\xde\xf9\x36\xa9\x28\x4d\xb1\xda\x0a\xf9\x7b\x6e\x19\x37\x87\x9b\x6a\x6e\xa0\x23\x7d\x9a\x03\xbd\x87\x31\xce\x14\x6a\x2d\x43\xa6\xbc\x71\x86\x54\x94\x1e\x92\x5c\xb4\x68\x66\xd7\x34\x30\x73\xd4\x0c\xaa\xfd\x2a\xce\xe6\xce\xb3\xf9\xec\x0e\x4e\x65\xcf\x50\xa1\xe3\x18\x67\x4b\xa9\xfe\x95\xba\xe5\x4c\xad\xb8\x8a\x5d\xc9\xfd\x6c\x3d\xf7\x2e\xe5\xba\x1c\x41\xe8\x8b\x52\xcc\x1c\x35\x83\x5b\xc6\xcd\x41\x10\xb6\x9f\x6f\xa7\xbd\xfb\x00\x31\xe5\x03\x10\xb9\x88\xc8\x45\x23\x94\x05\xc4\x19\x87\x13\x3b\xcf\x43\x64\xba\x0b\x6d\x3e\x78\x87\x21\xa1\x74\x94\xe1\x86\x51\xd7\x31\x6f\xec\x2c\x76\x27\xf7\xf3\xdb\xd4\x49\x56\x4e\x5e\xc2\xe2\xda\x05\xfc\xe4\xfd\x9f\x33\xae\x6c\x0c\xdd\xc1\x05\x3e\x3b\xe1\x66\x9e\x98\xf3\x1d\x2a\xbc\x38\x00\xf7\xd7\xaf\x26\x67\x03\x04\xc1\x2b\x44\xf9\x43\x33\xbe\xc6\xda\xe9\x6b\x4a\xf3\x9f\x48\x7f\xc0\x45\x5b\x40\x86\x04\xb5\x98\x86\x97\xfe\x3d\x74\x21\x13\x62\x63\x79\xf1\x33\x4f\x0d\xb8\x76\x2a\x7b\x96\x7b\xb7\x7d\x93\xce\xcc\x69\xb4\x28\x2c\x8e\x27\x66\x7f\x87\xfa\xaa\xba\xd2\x3d\xdf\x3f\xf2\x02\xff\x72\xe4\x05\x00\x56\xd7\xad\x60\xdd\xa7\xfe\x6a\xc0\x1c\x8f\xef\x7f\x96\xe7\x8f\xbe\xcc\xf8\xb2\xb1\xbf\x83\x52\x10\x71\xa1\x05\x91\xe9\x4a\xf2\x46\x07\xc3\x19\x1d\x82\x10\xd8\x90\x95\x93\x97\x20\xc0\xf3\x47\x5f\xe6\x99\xc3\x3f\xc5\x38\xc3\x97\xa7\x7e\x91\x2a\x3f\x41\xce\x06\x54\x7a\x71\xfe\xb6\xe1\x41\x2a\xbc\x38\x1b\x3b\x7e\xc9\xdd\x5b\x1f\x62\xdb\xf9\x5d\x8c\x2f\x1b\x83\x03\xb2\x26\xc7\xf5\xd5\xd7\xb0\x76\xfa\x1a\x22\x1b\xf1\xcc\xe1\xf5\x3c\xb0\xfd\x5b\x64\x4d\x0e\x5f\x79\x44\x2e\xfc\x70\x3a\x10\x87\x2f\x1e\xe7\x72\x49\xbe\xdd\xfe\x0f\xac\xdd\xb1\x8e\xa6\x5f\xaf\x65\x53\xe7\xaf\xa8\x2d\x1f\xcf\xca\xc9\xb7\x93\x89\x32\x18\x6b\xf1\x0a\x1b\xf2\x17\x3b\xbe\xcd\x3f\x1d\xfa\x31\xa1\x0d\x79\x70\xfa\x1a\xae\xa9\xba\x9a\x89\xf1\x09\x7c\xab\x61\x2d\x1d\x99\x53\xdc\xbb\xf5\x61\xbe\xb6\xfd\x11\x3e\xc8\x9c\xe1\x1b\x33\xee\x67\x72\xc5\xc4\x52\x40\x5c\x8e\xbb\x9c\x75\x88\x92\x6a\xef\x72\x0c\x17\xd8\x80\xc9\x15\x13\xb9\x63\xd2\xe7\xc8\x98\x2c\x9e\x68\x26\x57\x4c\xe4\x44\xfa\x03\xea\x13\x75\xcc\x1f\x37\x97\x57\x3b\xde\xe2\xe6\x71\x73\xa8\xab\x9c\xc4\x89\x74\x27\x8f\xed\x7b\x9a\xee\xb0\x97\xfd\x3d\x87\x69\xa8\x9e\xce\xa4\x8a\x5a\x32\x26\xcb\x4d\x35\x33\x01\x78\xf3\xd4\x66\x9e\x3a\xb4\x1e\x87\xa3\x3b\xec\xe5\xe7\xb7\xfe\x33\x0a\x75\x59\xb6\xd5\x05\x42\x2b\x12\x57\xe4\x0c\x5a\x34\xe5\xba\x8c\xbb\xea\x96\xa3\x45\x13\xb9\x08\x87\xe3\x13\xe5\xe3\x0b\x04\x98\x07\x63\xdd\xde\x27\xd8\x72\xf6\x5d\x7e\x79\x6a\x33\xd3\x12\x53\x59\x3e\x69\x31\x33\xaa\xeb\x71\x2e\x5f\xce\xba\x83\x5e\xe6\x8e\x9d\x05\x38\x42\x17\x51\xae\xcb\x98\x5b\x33\x93\xcd\x67\xb7\x0d\x22\xde\x91\x86\xe7\xac\xeb\x1d\xce\x8e\x53\xa2\x48\x85\x69\x56\xd7\xad\xa0\xca\xcb\x93\xc6\x13\x73\xd6\x0d\x74\xa7\xa6\xde\xc1\xab\x1d\x6f\xe1\x15\x34\x5a\xc6\xe4\xc8\x9a\x1c\xd5\x5e\x82\xac\xc9\x91\x31\xd9\x42\x44\x81\xaf\xf2\x32\xab\x37\xbc\x80\xc3\x91\xf0\x2a\xe9\x0d\xfb\x4a\xea\x80\x11\x24\x51\x68\x43\x7a\xc2\x3e\x94\x68\x8c\x8b\xd0\xa2\x09\x6c\xc8\xc3\xd7\x3f\xc0\x7d\xf5\x77\x71\x2c\x75\x92\x2d\xe7\x76\x71\xfd\xa8\xfa\x81\x2c\x5c\xf8\x7c\x21\xec\x23\xe1\x55\x90\x32\x69\x7a\x82\x0b\x80\xc3\x13\x0f\xad\x14\xce\x39\xc6\x95\xd5\xb0\x70\x7c\x23\xe5\xba\x9c\x63\xa9\x0e\x8e\xf5\x9d\x24\x6d\x32\x79\xb5\x72\x79\xa9\x56\xb2\xfb\x3c\x9c\x3b\x22\xbe\x9e\xeb\x72\x91\xbb\xb4\x8e\x1a\x67\xa8\xd0\x71\x56\x4c\xbe\x1d\xe7\x1c\x2f\x1d\x7b\x85\xee\xb0\x17\x2d\x0a\x11\x61\xd5\xd4\x65\x34\x8e\xb9\x91\x86\x51\xd3\x39\x72\xe1\x28\xbd\x61\x1f\xf5\x89\x3a\xbe\x7a\xf5\x4a\x7e\x71\xe2\x75\xee\x9e\xb6\x92\x69\x89\xa9\x44\xce\x10\x13\x9f\x23\x17\x7e\x8b\x20\x2c\xae\x5d\xc8\xaf\x4e\xbf\xc3\xfe\x9e\xc3\x7c\xfd\xda\x3f\xc3\x38\x4b\xce\x86\x43\x56\x1d\x57\x78\x8f\x09\xe5\xe3\x58\x34\xe1\x16\x12\x7e\x45\x5e\xba\x88\xb0\xb3\x6b\x1f\x37\x8f\x9d\x4d\x68\x43\xfe\xb2\xed\xef\xd8\x74\xf2\x0d\x1e\xbc\xee\xcf\x79\x66\x6e\x0b\xa6\x40\x22\x81\x0d\x31\xce\xb0\x76\xfa\x1a\x1e\xdb\xf7\x0c\x8d\x63\x6f\x64\xe9\xc4\xcf\x22\x08\xc7\xd2\x27\xf3\x4a\x45\x84\xf3\xb9\x24\x0f\xed\x7a\x8c\x73\xb9\x2e\x56\x4c\xbe\x9d\x0f\x32\x67\xf8\xaf\xd3\xef\x50\x57\x39\x99\xd0\x46\x25\x71\x3f\x9c\xa8\x14\x5f\x0b\xd9\xe8\x88\x27\x4e\xb5\x89\x96\xb9\x0e\x9c\x0c\x60\x4f\x45\x4f\x78\x81\xe5\x93\x16\x73\x6d\xd5\x27\xd9\xd3\x7d\x90\x75\x7b\xfe\x11\x4f\x79\x68\x51\x24\x83\x5e\xe2\xba\x9c\x35\x57\xdf\xc9\x7d\xf5\x77\xf1\xf5\xb6\x47\xf9\xd1\x7b\x3f\xe3\x1b\x33\xee\xe3\x91\x86\xb5\x3c\xd2\xb0\x96\xfe\x96\x56\xb5\x9f\x60\x7b\x57\x3b\x6f\x9d\xfa\x5f\x3e\x5f\x7b\x2b\x3f\xfc\xf4\xdf\xe7\x19\xd4\x1a\xb4\x28\xc6\xc7\x6a\x86\xac\x93\x15\x3a\x8e\x16\xcd\x6d\xb5\x0b\xb8\xad\x76\xc1\x80\xeb\x2b\xfe\xe7\x5e\xb6\x9e\xdf\xc5\xcc\xd1\x33\x78\xfc\xc6\x6f\x72\xcf\xb4\x55\xdc\x5e\xbb\x10\x2d\x9a\x2a\x2f\x81\x03\xc6\x96\xd5\xa0\x45\xb3\x74\xe2\x22\x96\x4e\x5c\x54\x7a\xf6\xed\x33\x5b\xd8\xdb\xfd\x1b\x8c\xb5\xbc\x7c\xe2\x3f\xf9\xf2\x94\x2f\xf2\xe6\xe7\x5e\x2c\x5d\x6f\xef\x3e\xc8\xaf\xcf\xee\x40\x10\xe2\xba\x1c\x5f\x79\xc3\xd6\x52\x07\x4e\xb4\x20\x4e\xb5\xe9\x89\x7f\x72\x5d\x12\x71\x77\x63\x50\xfd\x9f\x10\x01\x8b\x63\x6a\xe5\x55\x1c\x4f\x75\xb2\xe1\xf8\x26\x92\x41\x0f\xa3\x62\xd5\xc4\x75\x19\x15\x3a\xce\xb1\x54\x07\x7d\x51\x9a\x8e\xcc\x69\x8e\xa7\x3b\xd9\x99\xdc\xcb\xf1\x74\x27\x5a\x34\x27\x33\xa7\x78\x7c\xff\xb3\xbc\xdb\xb5\x8f\x23\x7d\x47\xd9\xd1\xd5\x4e\xce\x06\xfc\xf7\xd9\x6d\xa4\xa2\x0c\x00\xbb\xbb\x0f\xf0\xdd\x7d\x4f\x71\x3a\x7b\x8e\x1d\x5d\xed\xec\xeb\x39\x74\xd1\x02\xeb\x97\x2c\xe7\x82\x24\x3b\xba\xda\x69\xeb\xda\xcb\xce\xc2\x6f\x5b\xd7\x5e\xda\x93\x07\xd8\x72\xfe\x5d\x04\x61\x4a\xe5\x24\x9c\xb3\xac\x7f\xbf\x95\xa3\xa9\x13\x6c\x3b\xbf\x9b\xe3\xa9\x93\x58\x2c\x7b\xba\x0f\xf2\xf4\xa1\xf5\xf8\xda\x27\x19\xf4\xf0\x1f\x27\xdf\xe0\xc9\xdf\xfc\x18\xe7\x1c\xbe\xf2\x78\xfb\xf4\x56\x3a\x32\xa7\x11\x84\xf3\x41\x92\x8d\x1d\x6f\xf2\xc4\xc1\x1f\x12\xb8\x10\x2d\x8a\xac\x0d\xd8\x76\x7e\x17\xed\xdd\x07\xb1\xd8\xc1\x7d\xbd\x13\x01\xe7\x5c\xc4\xdf\x8c\xd8\x7a\x0a\x42\xda\x64\x08\x6c\x40\xb9\x2e\xa7\x5c\x95\x95\xea\x49\xb1\x93\xe8\x8b\xd2\x28\x51\x54\x79\x95\x25\x4d\x97\x87\xc4\xa1\x44\x61\x9d\x25\x72\x86\x84\x57\x89\xa7\x34\xd6\x59\xfa\xa2\x74\x5e\xce\x38\x8b\x27\x1e\x41\x81\x49\xab\x86\x10\xf7\xc5\xd6\xf3\x62\x01\xb8\x38\xaa\xbc\x44\x61\xcd\xbc\x50\x8f\x0a\xb5\xd5\x38\x8b\xaf\x7c\x2a\x75\x9c\xde\xf0\x02\x16\x47\x99\x8a\x11\xb9\x08\x25\x0a\x63\x2d\x89\x42\x4b\x5a\x24\xb8\x0b\x51\xaa\x24\x8f\x8c\x33\x54\x78\x71\x3c\xf1\xb0\x58\x7a\xc3\xbe\xc2\xfb\x55\x0e\x6e\x2c\x2e\x69\x3d\x2f\x6b\x8e\x14\xdb\x30\x87\x2d\xe8\xc5\xc1\xc6\x05\xb8\x92\x30\x2f\x76\x44\x03\x8f\x04\x04\xeb\x6c\xa9\x1d\xec\xff\x8f\xb8\x7e\xc4\x31\x54\x9d\xba\xb8\xc6\xd0\xa6\x45\xbe\x4d\xd5\xa5\xf9\x8a\x4f\x15\xcd\x94\xa2\xa1\x71\xe9\x7a\xc5\xf7\xe9\x5f\xe2\x5c\xbf\x35\xfb\x5f\x2f\xce\x31\xd4\xfb\x0d\x32\x47\x9a\x5d\xb3\x6a\xdd\x7f\xc0\xab\x38\x91\xd9\xac\x2b\xbd\x4f\x47\xa9\xf0\x8a\x17\xfa\x21\x3c\x51\xaf\xd2\xd7\x26\x15\x6d\x4f\x4f\x89\x2f\x6c\xfa\x54\x43\xa4\x00\x0e\xdc\xd0\x1a\x60\xdc\x6a\x1b\xda\x64\xde\x34\x1d\x91\xd2\xae\x8c\x7e\x06\xb3\x0d\x6d\x12\xe3\x56\x1f\xb8\xa1\x35\x00\x50\x2d\xd2\x62\x9b\x5d\xb3\x6a\x5b\xb6\xe9\xfd\x30\x15\x2c\x71\x8e\x02\xa8\x44\x57\x60\x1b\xe9\x08\x24\xef\xd6\x87\xa9\x60\x49\xd1\xad\x6f\x91\x16\xab\x00\x5a\xa4\xc5\x36\x6d\x68\xd2\xbb\xbf\xf4\xfa\x8e\x30\x15\x2c\x71\xd0\xe5\x55\x7a\x9e\xb3\x44\xb8\x8f\x60\x22\xfe\xf1\x22\x69\x9d\x25\xf2\x2a\x3d\xcf\x41\x57\xf1\x3c\xa9\x69\x43\x93\x6e\x91\xfc\x19\xfd\x95\x63\xe4\x3f\xd4\x31\x32\x40\xf1\x48\x74\xcf\x9d\xaf\x1d\xb6\xef\x75\x2e\x32\xa9\xf0\x1e\x67\xed\x2e\xf1\xc4\x79\x71\x5f\xab\x98\xa7\x50\xf2\xf1\xc1\x52\x09\x2a\xe6\x29\x2f\xee\x6b\xf1\xc4\x39\x6b\x77\x99\x54\x78\x8f\x7d\xaf\x73\xd1\x9e\x3b\x5f\x3b\x5c\x3c\x7a\x67\x90\xaa\xb9\x74\x5c\xf9\x2a\xce\x47\xfe\x2a\xce\xff\x01\xe2\x49\xf6\x85\xc7\x2c\xa3\xdb\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", p: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x0b\x6f\x49\x44\x41\x54\x78\xda\xed\x9a\x6b\x94\x95\xd5\x79\xc7\x7f\xcf\xde\xef\x39\x73\x3f\x33\x80\x0c\x17\x41\x6e\x4e\xc0\x19\x2f\x28\x30\x0a\x06\x48\x35\x15\x8d\xa0\xcb\x0b\x91\x4b\xf1\x16\xaa\x0d\xe9\x0a\x35\x26\xa9\x26\xd5\x71\x30\x49\x43\x57\xcd\x6a\x8c\x5d\x36\x89\x2d\x56\x4d\xc2\x82\x6a\xa3\xa9\x21\xa8\x41\x41\x20\xc0\x70\x91\x45\x19\x45\x81\xc1\x41\x22\x38\x33\x67\x6e\xe7\xfa\x5e\xf6\xee\x87\x73\xe6\x30\xc3\xdc\xb4\xb5\x5f\x22\xcf\xb7\xb3\xf6\xbb\xf7\x7e\xce\x7f\x3f\x97\xff\xf3\xec\x2d\xf4\x25\x35\x28\x6a\x31\x00\x2c\x5c\xa8\x47\x4d\xfd\xef\x59\x26\x90\x45\xc0\x0c\x31\x4c\x46\x88\x60\xb1\x80\xf0\xa7\x29\x16\x41\xb0\x74\x58\xc5\x21\xa0\x4e\x69\xbb\xf6\xc3\xb7\x2e\xdc\xce\xfa\xf5\x41\x2f\x8c\xba\x49\x6f\x40\x16\xa2\x59\x4f\xc0\x3d\xd3\x42\x23\xce\x4b\x2e\x15\x2b\x5f\xc7\x32\x55\x42\x22\x04\x16\x1b\x58\xb0\x7c\x36\x44\x40\xb4\x80\x16\xac\x67\x2d\xc2\x5b\x56\xec\xe3\xa7\x1a\x0b\x7e\xc1\xcf\xf6\x78\x39\xac\xfa\x05\x74\xdd\x42\xcd\x97\xd7\x07\xa3\x1f\x98\xf2\x39\x53\xac\xd6\xa8\x3c\x3d\xcb\xba\x16\xeb\x19\x80\x20\xfb\xbd\xe2\xb3\x25\x86\x8c\x09\x69\x09\x29\x24\x2c\x98\x74\xb0\x5d\xc5\xcc\x5d\x7f\xfc\xe1\x3b\xef\x76\x61\xd6\x1b\xd0\xec\xc0\xc8\x87\xaa\x66\x90\xc7\xef\x44\xcb\x50\x9b\x0c\x7c\x94\xa8\xcf\x20\x88\xfd\x83\x6b\xac\x91\x02\xed\xd8\xc0\x46\x49\x73\xed\xc9\x47\x0f\xd6\x75\x07\x55\xba\xc7\x83\x0c\x98\x76\xa3\x20\x43\xac\x6b\x7c\x94\x38\x67\x31\xec\x0b\x56\xeb\x4b\x58\x39\x16\xdb\x4a\x5a\xe6\x9d\x7c\xf4\x60\x5d\x17\x86\x42\x4d\x8d\xa2\xb6\xd6\x94\xd7\x5c\x34\x51\x39\xc1\x6e\x11\x19\x62\x3d\x13\x20\xa2\xcf\x22\x37\x50\xda\xb2\x81\x84\x94\xb6\xd6\xb6\x1a\x5f\x4f\xff\xa8\xf6\xc0\x51\x6a\x6a\x94\x50\x83\xaa\xa4\xd2\x89\x8a\x7d\x53\xf2\x74\xb5\x4d\x06\x01\xea\xd3\x03\x53\x10\x10\xb0\xb6\xff\x4c\x26\x22\x60\xc9\x12\x87\x4f\x3b\xaf\x0c\xbe\xff\xa0\x6b\x88\x64\x31\xb4\x67\x5a\x6a\x20\x05\x5a\xdb\x74\xb0\x6b\xa8\x95\xd9\xf5\xd4\xfb\x8a\x5a\x4c\x54\xe4\x36\x55\xe4\x54\x67\x63\xe6\x80\x60\x2a\x51\x28\x51\xb9\x4d\x06\x13\xdf\xf8\x78\x81\x37\x20\x58\x5e\xe0\xe1\x1b\xbf\x9f\xfd\x04\x47\x39\xd9\x50\xfe\xc9\xe5\xe3\xec\x3f\x98\x78\x81\x87\x17\xf8\x7d\x29\xa7\x6d\x32\xf0\x55\x91\x53\x1d\x15\xb9\x8d\x5a\x8c\x54\xd6\x54\x86\xa3\xc2\x1e\x09\x4b\xa5\x4d\x19\x06\xd2\xdc\x62\x49\xb8\x49\x04\x08\x3b\x79\x84\xb4\x33\xe8\xc9\x17\xe7\x15\xa1\x45\xd3\x99\x8e\x11\xd8\x20\x63\x31\x67\x1c\x50\x49\x5e\x31\xc6\x1a\x3a\xd3\xb1\x5e\x96\x91\xf2\xd2\x24\xdc\x04\x79\xa1\x3c\x8a\xc2\x85\x9f\xd8\xd2\x4a\xf2\x8a\x51\xa2\xb2\xfb\x9b\x4f\x4c\x9c\x45\x84\x48\x5e\x31\x16\xe8\x4c\xc5\x7a\x1f\x8c\xb1\x46\xf2\x15\xd6\xb5\xf5\x43\x2d\xd3\x54\xab\x91\x19\xa2\xa5\xd2\xa6\xad\x0c\x04\xa6\xb1\x96\x3c\x9d\xc7\x73\x4b\x9e\xe4\xe5\xe5\x6b\xb9\xa0\xbc\x82\xa4\x9b\xec\x35\x45\x89\xc2\x51\x1a\x47\x69\x2c\x96\xe7\x16\x3f\xc9\xce\x95\x1b\x99\x38\x6c\x1c\x69\xcf\xcd\x59\x78\x58\x3b\x04\xc6\x30\x3a\x32\x82\x9d\x2b\x37\xf2\xfc\x1d\x6b\xd0\x4a\x63\x6d\x86\x53\x2b\x51\x24\xbd\x14\x33\xc6\x4e\xe5\xfb\x5f\xfa\x2e\x0b\x2a\xe7\x91\xf2\x52\x7d\xaa\x78\x7a\x4f\x07\xad\x34\x4a\x04\x8b\x45\x44\x58\xbb\xec\xe7\xec\x5c\xb9\x91\x31\x65\xe7\x12\x98\x80\xb0\x0e\x0d\xb2\x86\xce\x79\xa0\x17\xf8\x94\xe5\x47\xd8\xf2\xb5\x97\xd9\xb0\x7c\x2d\x79\xa1\x70\xf6\x50\xa4\xc7\x44\x9b\xb6\x22\x5a\x2a\x5b\x8d\xcc\x50\x46\x99\x65\x68\x51\x60\x4d\x7f\x60\x6a\xa5\x89\xb9\x31\xae\xae\x98\xcd\x0d\x55\xd7\xf2\xf9\x09\x97\xf3\x95\xcb\x97\x92\xf2\x5d\x54\x37\xd7\xef\x02\xa1\x39\x1e\xa5\x39\x1e\xc5\xf5\x5d\x86\x14\x96\x52\x9a\x1f\x41\x4b\x06\xe0\x2e\x6b\x69\x8a\xb7\xd0\x92\x88\x02\x50\x9a\x1f\xa1\xac\xa0\xb4\x97\xab\x27\xdd\x14\xd3\xc7\x4e\xe5\xfe\xb9\x2b\x98\x7f\xc1\x35\x24\xbd\x54\xaf\x50\x63\xb1\xc4\xdc\x38\xcd\xf1\x28\x4d\xf1\x66\xa2\x89\x56\xbc\xc0\xcb\x81\x56\x56\x90\xd9\x5f\x89\xd0\x92\x88\xd2\x14\x6f\xa1\x33\x1d\xeb\x01\xaa\x12\x45\xc2\x4d\xd0\x14\x8f\xd2\x14\x8f\x12\x77\x13\xb9\x71\x11\x61\x58\xe1\x10\x86\x16\x96\xf5\xf2\xae\x6e\x5a\x18\xb4\x28\xa3\xcc\x32\x07\x61\x7a\xa6\x88\xec\x3f\x28\x5a\x6b\x71\xc4\xe1\xee\xea\x25\x00\x04\x26\xe0\xc6\xaa\xeb\x58\xfd\xfa\x4f\x68\x8a\x35\x13\x52\x21\x44\x84\x58\x3a\x46\xd5\xc8\x29\x7c\xb1\x62\x2e\x16\xcb\x0b\x07\x5e\xa6\x33\x1d\xc7\x5a\x9b\xb1\x18\x84\x98\x1b\xe7\x0b\x93\xae\x64\xe6\xf8\xe9\x34\xb6\x9e\xe0\xad\x13\x07\xf0\x8d\x4f\x60\x82\x3e\xdd\x2d\xe9\xa5\xf1\x8d\x4f\xcc\x8d\xf7\xa9\xa2\x23\x9a\xea\xb1\x97\x32\x6d\xcc\x54\x86\x14\x96\x72\xb2\xe3\x23\x5e\x7d\xf7\x0d\x4e\x74\x7c\x48\x51\xb8\x90\xc0\x04\x04\x26\x63\x2b\x5f\xa9\x5e\xca\xc4\x61\xe3\xd9\xf1\xfe\x6e\xde\x38\xb2\x8d\xc2\x50\x21\x4a\xa0\x23\xdd\xc9\xf4\x31\x53\x99\x3b\x69\x16\x0a\x61\x4b\xc3\x0e\xea\x8e\xef\x23\x4f\x87\x07\x8e\xa1\xdd\x15\xcd\x14\xe2\xd3\x1d\x41\x2a\xac\x6f\xe9\xaf\x2e\x57\xa2\x88\xbb\x71\x2e\x1b\x73\x31\x57\x4e\xb8\x9c\x9d\x8d\x7b\x38\xdc\xd4\xc0\xd2\x69\xb7\x72\x63\xd5\xb5\xfc\xd3\x96\x9f\x52\x5e\x32\x9c\xd6\x44\x1b\xf3\x26\xff\x19\x4f\x2f\x7a\x82\xa2\x70\x21\x00\xf7\xcf\x5d\x41\xda\x77\x91\x6c\x62\x89\xb9\x31\x56\x5d\xfb\x20\x0f\x5e\xb5\x32\xb7\xfe\xb1\x68\x23\xc6\xf6\xdf\x16\xe8\x2f\x29\x89\x08\xae\xef\x71\x4e\x64\x04\xaf\xde\xfb\x7c\x8f\xb1\x13\xed\x1f\xb2\xe0\xdf\x96\xd2\xd8\x76\x22\x13\x46\x30\xac\xb9\xed\x71\xa6\x94\x57\xe4\xbe\x59\xbd\xe9\x71\xfe\x7e\xd3\x8f\xb1\x58\xee\xb9\xe2\x76\x1e\x5b\xb0\xaa\xc7\x1a\xdf\xfa\xaf\x47\x78\x62\xeb\x53\x8c\x2c\x29\x47\x44\x06\x4b\xc2\x62\x7d\x8b\x20\x15\x2a\xd3\xe8\x18\x08\x50\x21\xed\xbb\x2c\xbd\xec\x56\x04\xe1\x89\xad\x4f\xf1\xfd\xdf\xff\x08\xdf\x04\xdc\x31\x7d\x11\xa5\xf9\x11\xd2\x7e\x9a\xe2\x70\x11\x3f\xbc\xfe\x21\x8a\xc2\x85\xfc\x6a\xdf\x0b\xcc\x7f\x6a\x11\x9b\x8f\xfe\x81\x11\x25\xc3\x33\xc9\xcc\x4b\x72\xf1\xa8\x2a\x1e\xbc\x6a\x25\x5e\xe0\xf1\xbd\xd7\x1e\xe3\xe6\xa7\xef\x20\xe1\x25\x09\xeb\x10\x9e\xf1\x06\x70\xa9\xbe\xbd\x26\xac\x43\x7c\x14\x6b\xe2\xaf\xfe\xe3\x9b\x2c\x7c\xe6\x6e\xe6\xfc\xf3\x02\xd6\xef\x7f\x89\x73\x4b\x47\xb1\xf4\xb2\x5b\x49\xb8\x09\x02\x13\xe4\x0e\xe4\x96\x7f\xbf\x8b\x47\x5e\xf9\x07\xdc\xc0\xe5\x6f\xaf\xfa\x3a\x17\x94\x57\x70\x5e\xd9\xb9\xac\xbe\xfe\x61\xde\x6f\x3d\xce\x82\x7f\x5d\xca\x4d\x6b\x6e\xe7\x83\xb6\x3f\xb2\x6a\xde\x03\x8c\x1b\x32\x96\x94\x9f\xfe\x38\x8c\x46\xb0\x16\x84\x88\x33\x58\x86\x4b\xf9\x69\xc6\x0f\x3d\x8f\x85\x97\xdc\x40\xc2\x4b\xa2\x95\xc3\xf8\xa1\xe7\x71\x2c\xda\xc8\x94\xf2\x0a\xae\x3a\x7f\x36\xeb\xf6\xff\x9a\x39\x93\x66\x31\x69\xd8\x04\x1a\xa2\x8d\x7c\xe3\xa5\x87\x88\x26\x5a\xd9\x73\xe2\x00\x53\x47\x57\x31\x6e\xc8\x58\x92\x6e\x92\x99\xe3\x67\x00\xf0\xe2\xc1\xdf\x51\xfb\xca\x3f\x62\xb1\xb4\x24\xda\xd8\xbc\xe2\x45\xb4\xa8\x01\xa9\x8d\x88\xa0\x95\x46\x8b\xce\x15\xc2\xbe\xf1\xd1\xa2\x29\x08\xe5\xb3\xfc\xf2\x65\x68\xa5\xf1\x03\x0f\x6b\x2d\xe7\x46\x46\x65\x92\x4b\xf6\x90\xbe\xf6\xc2\xb7\x79\xfd\xf0\x56\x5e\x3a\xb8\x81\xc9\xc3\xcf\x67\xd1\xa5\x37\x71\xf1\xe8\x2a\x8c\x35\x38\xca\xa1\x25\xd1\xc6\x95\x13\xaa\xb1\xd6\xe2\x06\x1e\x05\xa1\x7c\x66\x8d\xaf\xe6\x95\x77\x5f\xff\x44\x94\xcd\xc1\xd2\x81\x48\x24\xcb\x47\x7a\x1c\x85\x16\x4d\x6b\xba\x8d\x7b\xae\xb8\x9d\xd2\xfc\x08\x00\x4f\x2f\xfa\x49\x8f\x05\xee\xaa\x5e\xcc\xba\xfd\xbf\xc6\x51\x99\xb3\x49\x78\x09\x92\x5e\x8a\xd2\xfc\x52\x92\x5e\x8a\x84\x9b\xcc\x25\x8f\x90\x0e\x61\xac\xa5\x35\xd9\x86\xc5\x12\xc9\x2b\xa1\x3d\xd5\x9e\x05\x6c\x60\xa5\x5d\xdf\x25\x96\x6c\x47\x8b\x26\x30\x01\x5a\x29\xd2\xbe\xc7\x0f\xbe\xf4\x1d\xee\x9b\xf3\x55\x0e\x37\x37\xf0\xc6\x91\x6d\x5c\x3c\xaa\x32\x63\x51\xd2\x93\x94\xb7\x25\x3b\x28\xc9\x2f\xa6\x33\x1d\x27\x9a\x6c\xc3\x5a\x70\x94\x83\xa3\x34\xc6\x1a\x46\x14\x9f\xc3\x9f\x7f\xee\x0b\x14\x86\x0a\x38\xd2\xd2\xc0\xe1\x96\x06\x62\x6e\x3c\xc3\x56\x06\xa7\x6a\x19\x4a\x61\x6d\x87\x63\xb1\xef\x29\x47\x4d\xb3\x5e\x6f\x40\x7d\xe3\x53\x14\x2e\x64\xc9\xa5\xb7\x60\xad\xe5\xe7\x3b\x9f\x25\x9a\x68\x45\x2b\x8d\x88\x70\xf7\x8c\x25\x7c\x7e\xc2\x15\x5c\x32\xfa\x42\xea\x4f\x1e\xa2\x2d\xd9\xce\x94\xe1\x15\xdc\x3b\xf3\x0e\x7e\xb1\x67\x1d\xf7\xce\x5c\xce\xe4\xf2\xf3\xf1\x8c\x4f\xd8\x09\xf3\xf6\xa9\x43\x28\x11\x6e\xac\xba\x8e\xdf\xbe\xfd\x2a\xfb\x4e\x1c\xe0\x3b\x57\xdf\x47\x60\x02\xd2\x7e\xba\x4f\x97\xb7\x58\x7c\xe3\x33\x2a\x32\x92\x2f\x4e\xbe\x9a\x92\xfc\x62\x8c\x31\x28\x11\xb6\xbf\xbf\x9b\x39\x13\x67\xe1\x06\x2e\xb7\x3d\xbb\x9c\xbd\x7b\x37\xb1\xf0\x9a\xbb\xf9\xe5\xd2\x9f\xe2\x05\x3e\x82\xe0\xfa\x2e\x81\x09\x78\xf0\xea\x95\xdc\xff\xd2\xc3\xcc\x9e\x30\x93\x5b\x2e\x9a\x8f\x12\xe1\x70\x4b\x43\x8e\x8a\x35\xc5\x9a\xb9\x73\xed\x5f\x73\xaa\xb3\x89\x25\x97\xdd\xc2\xf1\xb6\x13\xfc\xf6\xed\xd7\x38\xff\x9c\x09\xb8\x81\x8b\xdf\x47\xd2\xec\xae\xa6\x38\x22\xc6\x33\xef\x39\x58\x76\x23\x4c\xcb\x10\x40\xe9\x41\x95\x5a\x93\xed\x2c\x9e\x7a\x13\x55\x23\xa7\x50\x77\x7c\x1f\x2b\x9e\xff\x36\x8e\x76\xd0\xa2\x48\x24\xdb\x28\x0c\x15\xb2\x62\xd6\x5d\x7c\x63\xee\x57\xf9\x8b\xe7\xfe\x92\x1f\x6d\x79\x92\x55\xf3\x1e\x60\xf5\xf5\x0f\xb3\xfa\xfa\x87\x7b\x24\xb6\xb2\xfc\x08\x6f\x1e\xdd\xc1\x6f\xea\x37\xb2\xa0\x72\x1e\xff\x79\xe7\x33\xa7\xdd\x56\x69\x46\x14\x0f\xef\x33\x4e\x16\x87\x8b\x70\x94\xc3\x0d\x55\xf3\xb8\xa1\x6a\x5e\x8f\xf1\xea\x1f\x5f\xc3\xe6\x23\xdb\x98\x36\xe6\x12\xfe\xe5\xd6\xc7\x78\x7b\xf6\x21\x6e\xbc\xf0\x3a\x1c\xe5\x50\x56\x90\x71\xba\xf2\x92\x73\xd0\x4a\x73\xf3\x45\xf3\xb9\xf9\xa2\xf9\xb9\xb9\x1b\xde\x79\x8d\x3d\xc7\xf7\x13\x18\x9f\xa7\xeb\xd6\x72\xe7\x8c\x45\x1c\xf8\xe6\x9b\xb9\xf1\xba\xe3\xfb\x78\xed\xbd\x2d\x80\x50\x14\x2e\x24\xcf\x09\xf7\x1f\xe3\x33\xe4\x19\x2c\xbb\x75\x64\xce\x88\x56\x14\x77\x62\x50\xdd\x67\x08\x82\xb1\x86\x89\xc3\xc6\x71\xb4\xe5\x7d\xd6\xd4\xfd\x92\xe6\x44\x94\xa1\x05\x65\x14\x84\x0b\xc8\x0f\x17\x72\xa4\xa5\x81\xce\x54\x8c\xc6\xd6\x0f\x38\xdc\xd2\xc8\xf6\x86\x9d\x34\x44\x1b\xd1\x4a\x73\x2c\xda\xc8\xb7\x7e\x53\xc3\xf6\x63\x75\xd4\x9f\x3a\xc4\xd6\x86\x9d\xa4\xfc\x34\x1b\x0f\x6d\x22\x96\x8e\x03\xb0\xeb\xf8\x3e\xfe\xe6\xc5\xbf\xe3\xc3\x8e\x93\xbc\x79\x74\x07\x7b\x4e\xec\x3f\x5d\x7f\x77\x4b\x93\xa7\x62\x4d\x6c\x6d\xd8\xc1\xb6\x63\xbb\xd8\x76\xac\x8e\x6d\xc7\x76\xb2\xed\xd8\x2e\x76\x35\xee\x65\xd3\x91\xad\x08\xc2\xa4\x61\xe3\x30\xd6\xf2\xf8\xd6\x9f\xf1\x5e\xf3\x51\x36\x1f\xfd\x03\x87\x5b\x1a\x30\xc6\xb0\xfb\xf8\x5b\xac\x7a\xf5\x31\xc2\x3a\x44\x4b\x3c\xca\x73\x7b\xd7\x53\xb3\x71\x35\x86\x4c\x62\xdb\xf0\xce\xef\x69\x6c\xfd\x00\x41\xf8\x28\xde\xcc\xaf\xf6\x3e\xcf\x77\x37\xfc\x80\x74\xe0\xa2\x45\x91\xf2\xd2\x6c\x3e\xb2\x8d\xba\x0f\xf6\x61\xce\x24\xf6\x5d\x81\x45\xb0\xe2\xcb\x7d\x03\x96\x9e\x22\x42\xdc\x4d\x90\xf6\xd2\x14\x86\x0b\x28\x08\xe5\x67\x29\x0e\xd9\x4a\xc2\xa3\x33\x15\x43\x29\x4d\x69\x7e\x09\x22\x42\x47\xaa\x33\x7b\x7b\x60\x33\xf1\xce\x06\xf8\x81\x4f\x24\xbf\x84\x90\x0e\x11\x98\x80\x8e\x74\x27\x8e\x72\x08\x4c\x40\x48\x87\x32\xee\x2e\x92\x8b\xd3\x3d\x4b\xcf\x6c\x1c\x16\x7a\xdd\x14\x94\x16\x44\x00\xc9\x12\xf5\x4c\x65\xe3\xa8\x4c\x8c\x0d\x3b\x61\x8a\xf3\x8a\x68\x4b\xb6\x63\xac\x25\xdf\x09\xe3\x05\x19\x6f\xf0\x8d\x4f\x49\x5e\x49\x2e\x11\x0a\x42\x7b\xaa\x03\x11\x41\x89\xe0\x9b\x80\xa2\x70\x61\x56\x5f\x43\x7b\xaa\x1d\x41\x28\x2d\x88\xf4\x06\xf3\x8c\xd2\x53\x00\x46\x3e\x52\xb5\x4c\x15\xa9\x67\x4c\xa7\xdf\xab\x07\xda\x55\x2a\x1a\x6b\x30\x67\x14\x53\x22\x92\xab\x80\xba\x88\xb9\x56\x9a\x2c\x0d\xcb\xd5\x0b\x82\x10\x98\x20\xa7\xbc\x52\x2a\x1b\x61\x04\x6b\x6d\xb6\x54\xa4\x4f\x72\xaf\x44\xfa\xed\xd7\x04\xc6\x87\x33\xd6\xeb\xee\x5d\xc6\x9a\x4c\xbc\xcf\xfe\xee\xda\x4f\x44\x30\xc6\xf4\x60\x15\x5d\x7a\x77\xe9\x6c\xac\xc9\x25\xa3\x4c\xc2\xb5\x7d\xc7\x51\x63\x7d\x55\xe2\x38\x26\x6e\x6e\x3f\xf9\xc8\xc1\x67\xff\xdf\xdb\x77\x7f\xe2\x8d\xe6\x3e\xda\x77\xd4\x50\x5f\x5b\xef\x1a\xeb\x2c\xb6\xbe\x69\x95\xb0\xd2\x58\x1b\x9c\x45\xeb\x63\x34\x98\xc3\x4a\x5b\xdf\xb4\x1a\xeb\x2c\xae\xaf\xad\x77\xa1\xe6\xec\x15\xc8\xa7\x7d\x05\x92\x49\x40\xb5\x18\xd6\x2d\xd4\x27\x1f\x3d\x58\x47\x5a\xe6\x59\x88\x4a\x81\x76\x30\xd6\xcf\xde\xfa\x9d\x95\xd3\x97\x74\xbe\x14\x68\xc7\x42\x34\x07\xe6\xba\x85\xba\xeb\x8e\xfe\x74\x79\xf2\xe5\xf5\x41\x17\xa8\x2a\x16\xcc\xb4\x81\xd9\xae\x4a\x1c\x47\x42\xaa\xeb\x9b\xe0\x33\x0a\xae\xc9\xfe\x77\x24\xa4\x94\x2a\x71\x1c\x1b\x98\xed\x2a\x16\xcc\x3c\xf3\xc6\xb3\xef\x86\xc8\xd9\x87\x0e\xdd\x5b\x1e\xff\xc7\x87\x0e\x5d\x72\xf6\x29\xce\xff\xfa\x29\xce\xff\x00\x75\xa3\xde\xfe\xa7\x6e\x60\x2b\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82", d: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x54\x00\x00\x00\x1c\x08\x06\x00\x00\x00\xff\x60\x98\xc0\x00\x00\x09\x7c\x49\x44\x41\x54\x78\xda\xed\x9a\x5d\x4f\x1c\xd7\x19\xc7\x7f\xe7\xcc\x99\xd9\xdd\x60\xb0\x97\x80\x0d\xc1\x66\x03\x36\x34\x10\x30\x96\x78\x49\xe2\xc8\xca\xab\x62\xe7\xa2\xb9\xc3\x69\x5c\xa5\x6a\xbf\x40\xa5\xaa\x77\xbd\x41\x7c\x85\x7e\x81\x4a\x8d\x4a\x1a\xb8\xf1\x65\x93\x48\xb9\x48\xe5\x48\xb1\xb1\x63\xcb\x8e\xb1\xc1\x32\x76\x54\x5e\xc2\x92\x5d\x13\xd6\xb0\x33\x73\xce\x9c\x5e\x78\x67\xc4\x3b\x24\xe9\x4d\x13\x1e\x69\x6f\xe6\x9c\x9d\x73\xe6\x7f\x9e\xe7\xff\x3c\xcf\x7f\x46\xb0\x85\x0d\x0d\x0d\xc9\xe1\xe1\xe1\x08\x60\x70\x70\xd0\xf1\x3c\xef\xb4\x10\xe2\x37\x40\xbf\x31\xe6\x57\x52\xca\x1a\x6b\xad\x05\x04\x3f\x4f\xb3\x42\x08\x11\x45\xd1\xf7\x8e\xe3\xdc\x05\xae\x58\x6b\xff\x19\x04\xc1\x17\x63\x63\x63\x66\x23\x46\x6b\x6d\x13\x20\x83\x83\x83\xce\xd8\xd8\x98\xe9\xed\xed\x75\x3b\x3a\x3a\x7e\x0b\xfc\xd1\x5a\x7b\x4a\x29\x25\xa2\x28\x22\x8a\x22\x9e\x60\xf9\xf3\x37\x21\x04\x52\x4a\xa4\x94\x68\xad\xad\x10\xe2\x3a\xf0\xd7\x89\x89\x89\x7f\x5c\xbd\x7a\x35\x8c\xb1\xda\x16\xd0\x78\xc2\xbb\xef\xbe\xdb\xae\x94\xfa\x5b\x2a\x95\x3a\xad\xb5\x46\x6b\x0d\x60\xac\xb5\x42\x08\x21\xf9\x05\x99\xb5\x36\x12\x42\x58\xc0\x51\x4a\xa1\x94\xc2\xf7\xfd\x2f\xb4\xd6\x7f\xf8\xe8\xa3\x8f\x26\x37\x82\x2a\x36\x82\x79\xfe\xfc\xf9\x7e\xcf\xf3\xfe\xe5\x38\x4e\x6d\x10\x04\x1a\x90\xbf\x34\x10\x77\x02\x17\x88\x3c\xcf\x53\xc6\x98\x42\x10\x04\xe7\x46\x47\x47\xaf\xac\x05\x55\xc6\x7c\x10\x83\x99\x4a\xa5\x3e\x16\x42\xd4\x06\x41\xa0\x85\x10\x6a\x1f\xcc\x75\x14\x20\x85\x10\xaa\x82\x4d\x6d\x2a\x95\xfa\xf8\xfc\xf9\xf3\xfd\x63\x63\x63\x66\x68\x68\x48\x02\x88\x98\x5c\x2f\x5c\xb8\xd0\x2a\xa5\x1c\x17\x42\x64\x8d\x31\x06\x70\xf6\x21\xdc\xd1\x8c\xe3\x38\x8e\xb5\xb6\x18\x45\x51\xdf\xc8\xc8\xc8\xfd\xa1\xa1\x21\x29\x2b\xe1\xee\x01\x1f\x3a\x8e\x93\xd5\x5a\xef\x83\xb9\x37\x73\xb4\xd6\xc6\x71\x9c\x2c\xf0\x61\x05\xc3\x27\x1c\x7a\xe1\xc2\x85\xf7\xd3\xe9\xf4\xdf\x57\x57\x57\xb5\x10\x42\xed\x96\xf9\x2a\x7c\xb2\x57\xde\x59\xf7\xbf\x1f\x3a\x47\x08\x81\x10\x02\x6b\xed\x8f\xaa\x2e\xf6\xb2\xfe\x4f\xb9\x87\xb5\x56\x67\x32\x19\x55\x2e\x97\x7f\x37\x32\x32\xf2\x81\x18\x1c\x1c\xf4\x94\x52\x57\x95\x52\x9d\x5a\x6b\x76\xe3\xcc\x4a\xc6\xc7\x71\x9c\x3d\x6d\x52\x29\x85\x10\x02\xad\xf5\x96\x80\x08\x21\x50\x4a\x61\xad\x4d\xee\xbd\xd6\xa2\x28\x22\x0c\x43\x94\x52\x38\xce\x0f\x0f\x9c\xdd\xd6\xdf\x8b\xb9\xae\x0b\x40\x18\x86\x5b\x26\x2a\xa5\x14\x5a\xeb\xdb\x5a\xeb\x5e\xe9\xba\x6e\xbf\x94\xb2\xd3\x18\xb3\x63\x49\x64\xad\x45\x4a\xc9\x8b\x2f\xbe\xc8\xeb\xaf\xbf\x4e\x4d\x4d\x0d\xc6\x98\x4d\xa0\xc6\x1e\x15\x5f\x7f\xe9\xa5\x97\x78\xfb\xed\xb7\xa9\xaa\xaa\x4a\xe6\xc7\xf5\x9d\xb5\x96\x4c\x26\xc3\xd9\xb3\x67\x39\x73\xe6\xcc\xba\x7b\x09\x21\x88\xa2\x88\xda\xda\x5a\xfa\xfa\xfa\x78\xe6\x99\x67\x88\xa2\x68\x47\x2f\x5e\xbb\x6e\x6c\x2f\xbf\xfc\x32\xe7\xce\x9d\x23\x93\xc9\x10\x45\x11\x52\xca\x3d\xdf\x23\x8a\x22\x3c\xcf\xe3\xcd\x37\xdf\xe4\x95\x57\x5e\xc1\x71\x9c\x4d\x87\x22\x84\x90\xc6\x18\x21\xa5\xec\x74\x5d\xb7\x5f\x02\xef\x3b\x8e\x23\x81\x68\xa7\x30\xd7\x5a\xd3\xd0\xd0\xc0\xf1\xe3\xc7\x69\x6a\x6a\xa2\xb5\xb5\x95\x27\xb9\x6b\xfd\x3c\x63\x0c\xbe\xef\xe3\xfb\x3e\xc6\x18\x3c\xcf\xc3\xf3\xbc\x64\x93\x42\x08\xc2\x30\xc4\xf7\x7d\x82\x20\x00\x20\x95\x4a\x25\x5e\xb0\x8e\xf5\x8d\x21\x9b\xcd\x26\x80\x6e\x5c\x6f\x6d\xd4\xc4\x6b\xfa\xbe\x8f\xb5\x36\x59\xcf\x75\x5d\x52\xa9\x14\x42\x08\x82\x20\xc0\xf7\x7d\xc2\x30\xdc\x74\x78\x6b\xef\x51\x89\xd4\x64\x3c\x7e\x86\x1d\x2c\xaa\x60\xf8\xbe\x02\xfa\x2a\xfc\x24\x76\x0a\x61\x29\x25\xcf\x3e\xfb\x2c\x71\xa1\x7f\xf4\xe8\x51\x26\x26\x26\xf0\x7d\x3f\x39\xd5\x30\x0c\x39\x78\xf0\x20\x8d\x8d\x8d\x00\x7c\xf3\xcd\x37\x84\x61\xb8\xee\x54\xb5\xd6\x1c\x3e\x7c\x98\xfa\xfa\x7a\x1e\x3f\x7e\x4c\xb1\x58\xdc\x31\x1c\x8d\x31\xac\xae\xae\x6e\x49\x07\x31\x18\xb5\xb5\xb5\xd4\xd6\xd6\xe2\x79\x1e\xbe\xef\x33\x3b\x3b\xcb\xea\xea\xea\x26\x2a\x69\x6d\x6d\xa5\xa6\xa6\x86\x7c\x3e\xcf\xc2\xc2\x42\x42\x21\x61\x18\x92\xcd\x66\x69\x68\x68\x00\x60\x61\x61\x81\x42\xa1\x80\x7c\x92\xb3\x77\xe5\x6f\x6b\xad\xa8\x8c\xf7\x29\x6b\x6d\x5b\x25\x94\xc4\x4e\xde\x99\xcd\x66\x69\x6a\x6a\x62\x7e\x7e\x9e\xe5\xe5\x65\x9e\x7f\xfe\x79\x9a\x9a\x9a\x98\x9c\x9c\x24\x95\x4a\x11\x04\x01\x8d\x8d\x8d\x9c\x3e\x7d\x9a\xaa\xaa\x2a\xa4\x94\xb4\xb7\xb7\x27\xad\x6a\xa5\x7d\xa3\xbb\xbb\x9b\x9e\x9e\x9e\xc4\x23\xf3\xf9\xfc\x9e\xda\xbf\x6d\x12\x02\xa9\x54\x8a\x37\xde\x78\x83\xa7\x9e\x7a\x2a\xa1\x84\xc5\xc5\x45\x3e\xff\xfc\x73\x1e\x3f\x7e\x9c\x24\xb4\x17\x5e\x78\x21\x01\x2c\x0c\x43\x6e\xdc\xb8\xc1\xc4\xc4\x44\x02\xf4\xc0\xc0\x00\xa9\x54\x0a\x80\x20\x08\xb8\x72\xe5\x0a\x93\x93\x93\xa4\xd3\xe9\xbd\xd4\xa7\xa2\xf2\x9c\x6d\xaa\x22\x74\xb0\x93\xd0\x61\x8c\x21\x97\xcb\xe1\x79\x1e\x53\x53\x53\x14\x0a\x05\xda\xda\xda\x68\x69\x69\x61\x7a\x7a\x9a\x28\x8a\x70\x5d\x97\x93\x27\x4f\x92\x4e\xa7\x99\x98\x98\x60\x7a\x7a\x9a\xb6\xb6\x36\x72\xb9\x1c\x61\x18\xa2\xb5\xe6\xd0\xa1\x43\x74\x75\x75\xa1\xb5\xe6\xfa\xf5\xeb\x14\x8b\x45\x4e\x9e\x3c\x49\x2a\x95\xa2\x54\x2a\xfd\xa8\x5e\xbb\x5c\x2e\x73\xf9\xf2\x65\x7c\xdf\xa7\x5c\x2e\xd3\xd6\xd6\x46\x47\x47\x07\xb9\x5c\x8e\x9b\x37\x6f\x26\xa0\x97\x4a\x25\x3e\xf9\xe4\x93\x64\x0f\xdd\xdd\xdd\xcc\xcc\xcc\xa0\xb5\xa6\xaf\xaf\x8f\xe5\xe5\x65\x3e\xfb\xec\x33\x84\x10\x0c\x0c\x0c\xd0\xd3\xd3\xc3\xcc\xcc\x0c\x51\x14\xed\x69\x2b\x15\xa7\xa9\x51\xbb\xcd\x8c\xa2\x88\x03\x07\x0e\xd0\xdc\xdc\xcc\xf2\xf2\x32\x42\x08\xaa\xaa\xaa\x28\x14\x0a\xd4\xd5\xd5\x71\xe4\xc8\x11\x1e\x3e\x7c\xc8\xe1\xc3\x87\x39\x78\xf0\x20\x85\x42\x81\xaf\xbe\xfa\x8a\x20\x08\x78\xf4\xe8\x11\xd9\x6c\x96\xea\xea\x6a\x8c\x31\xd4\xd5\xd5\x91\xc9\x64\xb8\x73\xe7\x0e\xb7\x6e\xdd\x02\xc0\xf7\x7d\xde\x7a\xeb\xad\x3d\x55\x0c\x1b\x93\x4e\xcc\x95\x52\x4a\x4e\x9c\x38\xb1\xae\x2a\xc8\x64\x32\xeb\x92\xcb\xf8\xf8\x38\x0b\x0b\x0b\xcc\xcc\xcc\x50\x5d\x5d\x4d\x67\x67\x27\x87\x0e\x1d\x4a\x00\xff\xee\xbb\xef\xa8\xab\xab\x4b\x3c\xb8\xae\xae\x8e\xfa\xfa\x7a\xe6\xe6\xe6\x7e\x50\xc9\xa5\xa2\x28\xfa\x7e\x3b\x39\x2e\xe6\xc5\xe3\xc7\x8f\x53\x55\x55\x45\x14\x45\xbc\xfa\xea\xab\xc9\x75\x6b\x2d\x2d\x2d\x2d\x3c\x7c\xf8\x30\x51\x65\xc2\x30\xc4\x18\x83\xeb\xba\x18\x63\xd6\x25\x80\x98\x93\xe2\x64\xa4\x94\x22\x0c\xc3\x6d\xb3\xf7\xc6\x83\x0d\x82\x20\x09\xe1\x38\x01\xf6\xf4\xf4\xd0\xdb\xdb\xcb\xfc\xfc\x3c\xdf\x7e\xfb\x2d\xd9\x6c\x76\x5d\xcd\x18\x57\x0b\x71\xe9\xa5\xb5\x4e\xee\x13\x53\x89\xb5\x96\x74\x3a\x4d\x43\x43\x03\x4a\x29\x4a\xa5\x12\xf7\xef\xdf\xdf\x94\xbc\xf6\x22\xf7\x29\x21\xc4\x94\x94\xb2\xb7\x22\x4f\x89\x8d\x1c\xe5\x38\x0e\xcd\xcd\xcd\x68\xad\x99\x9a\x9a\xc2\xf7\xfd\x04\x98\xd6\xd6\x56\x8e\x1c\x39\x42\x36\x9b\x65\x69\x69\x89\x95\x95\x15\x9e\x7e\xfa\x69\x4e\x9c\x38\xc1\xf4\xf4\x34\xed\xed\xed\x64\xb3\x59\xc2\x30\x44\x4a\xc9\xd2\xd2\x12\x61\x18\x72\xec\xd8\x31\x66\x67\x67\x29\x16\x8b\x74\x76\x76\xa2\x94\xda\x36\x83\xc7\x94\x93\xc9\x64\x68\x6c\x6c\xc4\x75\xdd\x04\xd0\xc5\xc5\x45\xea\xeb\xeb\x29\x97\xcb\x5c\xba\x74\x89\x07\x0f\x1e\xd0\xd5\xd5\x45\x53\x53\x53\x12\xaa\x51\x14\xa1\x94\xa2\xa3\xa3\x83\xeb\xd7\xaf\x53\x5f\x5f\x4f\x73\x73\x33\x61\x18\xb2\xbc\xbc\x8c\x31\x06\x6b\x2d\x41\x10\xf0\xe5\x97\x5f\x52\x2e\x97\xc9\xe5\x72\xac\xac\xac\x30\x3b\x3b\x4b\x75\x75\xf5\xae\x92\xa5\xb5\xd6\x3a\x8e\x23\xac\xb5\x53\x0a\x18\x17\x42\xf4\x56\x24\xaa\x75\xde\x19\x04\x01\xb9\x5c\x8e\xe6\xe6\x66\xa6\xa7\xa7\x19\x1f\x1f\x4f\xc2\x2e\x08\x02\x1c\xc7\x61\x60\x60\x80\xe7\x9e\x7b\x8e\x4b\x97\x2e\x71\xf7\xee\x5d\xfa\xfb\xfb\x19\x18\x18\xe0\xd4\xa9\x53\xc9\xa1\xa4\xd3\x69\x5c\xd7\x25\x9f\xcf\x27\xdc\xfa\xda\x6b\xaf\x25\x19\x58\x08\xb1\x2d\xf9\xbb\xae\x8b\x52\x8a\x96\x96\x16\xda\xda\xda\xd6\x8d\x5d\xbc\x78\x91\x7c\x3e\x4f\x73\x73\x33\xfd\xfd\xfd\xb4\xb7\xb7\x73\xf4\xe8\x51\x94\x52\x49\xd2\x4b\xa7\xd3\x08\x21\x38\x76\xec\x18\xb9\x5c\x0e\x29\x25\x9e\xe7\x71\xef\xde\x3d\x8a\xc5\x22\x51\x14\x31\x31\x31\x41\x57\x57\x17\xef\xbc\xf3\x0e\x61\x18\x52\x53\x53\xc3\x83\x07\x0f\x98\x9f\x9f\x4f\xca\xba\x9d\x3c\x55\x08\x61\x2b\xe3\xe3\x4e\x77\x77\x77\xd1\x5a\xfb\xfb\x8a\xf2\x24\xd6\x02\x6a\xad\xe5\xc0\x81\x03\x94\x4a\x25\xee\xdd\xbb\x87\xef\xfb\x78\x9e\x47\xac\x0b\x96\x4a\x25\x56\x56\x56\x28\x95\x4a\x94\x4a\x25\x16\x17\x17\x79\xf4\xe8\x11\x00\x2b\x2b\x2b\x5c\xbb\x76\x2d\xb9\x96\xcf\xe7\x89\xa2\x88\xf9\xf9\x79\x56\x57\x57\xb1\xd6\xb2\xb8\xb8\xc8\xb5\x6b\xd7\x28\x95\x4a\xe4\xf3\x79\x8a\xc5\xe2\x96\x2d\xee\xca\xca\x0a\x73\x73\x73\x9b\x7e\x85\x42\x81\x85\x85\x05\xc2\x30\xa4\xba\xba\x1a\x80\xc9\xc9\xc9\xe4\x7a\xa9\x54\xc2\x5a\xcb\xc2\xc2\x02\x5f\x7f\xfd\x35\x52\x4a\xca\xe5\x32\x53\x53\x53\xdc\xba\x75\x2b\xa9\x3e\xe6\xe6\xe6\x58\x5a\x5a\xc2\x5a\x9b\x8c\xdf\xb8\x71\x23\xa1\x22\xad\x35\xf9\x7c\x9e\x42\xa1\xb0\x53\x52\xb2\xc0\x9f\x76\x6d\x3d\x8d\x31\x68\xad\x13\x10\xd7\xba\x7e\x1c\x2a\x52\xca\xc4\x23\xe2\x9a\x2f\x0e\xcb\xb8\x86\x73\x5d\x37\xe9\x8e\x62\x6e\x8a\x1f\x28\xee\xa0\xb6\x2a\xee\xa3\x28\xda\xb6\x06\xdd\x69\x4d\x29\x65\xc2\xd1\x31\x75\xc5\x00\x59\x6b\x93\x96\x34\xb6\xb8\xad\xdc\x38\xbe\x76\xbf\x5b\xed\x6f\x63\xeb\xb9\xab\x38\xb2\x9b\x38\xb1\x51\x2c\xd9\x2e\x34\xd6\xfe\x77\x2f\x73\x76\x9b\xbb\xd7\x35\xf7\xba\xd6\xc6\x79\x5b\xed\x77\xab\xfd\x6d\x12\x47\x86\x86\x86\xe4\xed\xdb\xb7\x95\xeb\xba\xff\x76\x5d\x77\x20\x08\x02\x23\x84\xd8\x97\xef\xf6\xa6\x42\x19\xcf\xf3\x9c\x30\x0c\x2f\x87\x61\x78\xa6\xb3\xb3\x53\x4b\x80\xb1\xb1\xb1\x00\x78\xcf\x18\x53\x54\x4a\x39\x80\xd9\x87\x6b\x77\x81\x59\x29\xe5\x18\x63\x8a\xc0\x7b\x15\x0c\x91\xc3\xc3\xc3\xd1\xd0\xd0\x90\x1c\x19\x19\xb9\x1f\x04\xc1\x59\xa0\x58\x51\xa2\xf5\x3e\x66\xdb\x7a\xa6\x76\x9e\x08\x01\xc5\x20\x08\xce\xc6\x6a\xfd\xf0\xf0\x70\xb4\xff\x92\xee\x7f\xfc\x92\x2e\xe1\xca\xdb\xb7\x6f\xdb\xca\xc0\x7f\x3a\x3a\x3a\x2e\x02\xbd\xe9\x74\x3a\x17\x37\xfe\x3c\x79\x8d\x8c\xf8\x29\xd2\xf7\xff\x29\x88\x42\x88\x08\x90\xae\xeb\x8a\x54\x2a\x25\xc3\x30\xfc\x42\x6b\xfd\xeb\xd1\xd1\xd1\x9b\x1b\x5f\x23\xaf\x4b\x3e\x31\xa8\xa3\xa3\xa3\x8b\x9e\xe7\x7d\x50\x5b\x5b\x7b\xdf\x5a\x9b\x03\x1a\x5c\xd7\x95\xbf\x34\x30\x85\x10\x38\x8e\x23\x94\x52\xb2\x52\x67\x5e\x37\xc6\xfc\xe5\xce\x9d\x3b\x7f\xfe\xf4\xd3\x4f\xf3\xbb\x7e\xe8\x10\xdb\xfe\xa7\x38\x3f\xfe\x53\x9c\xff\x02\xf4\x60\xd5\x4c\x95\xdd\x23\xff\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82" };


    // ---- Data files: JSON first (an old .jsx copy stays as a backup) ----
    function spCmpVer(a, b) {
        var len = (a.length > b.length) ? a.length : b.length;
        for (var n = 0; n < len; n++) {
            var x = parseInt(a[n] || "0", 10), y = parseInt(b[n] || "0", 10);
            if (x !== y) return (x > y) ? 1 : -1;
        }
        return 0;
    }
    function spBefore(x, y) {
        var c = spCmpVer(x.ver, y.ver);
        if (c !== 0) return c > 0;
        return x.isJson && !y.isJson;
    }
    // Finds "<base> x.x.json" (and, if withJsx, ".jsx") next to the script.
    // Highest version first; with the same version the .json goes first.
    function spFindData(scriptPath, base, withJsx) {
        var list = [];
        try {
            var rx = new RegExp("^" + base + "(?:[ _]*v?(\\d+(?:\\.\\d+)*))?\\.(json" + (withJsx ? "|jsx" : "") + ")$", "i");
            var files = new File(scriptPath).parent.getFiles();
            for (var i = 0; i < files.length; i++) {
                if (!(files[i] instanceof File)) continue;
                var nm = decodeURI(files[i].name);
                var m = nm.match(rx);
                if (!m) continue;
                list.push({ file: files[i], name: nm, ver: (m[1] || "0").split("."), isJson: (m[2].toLowerCase() === "json") });
            }
        } catch (eFind) {}
        for (var a = 1; a < list.length; a++) {
            var cur = list[a], b = a - 1;
            while (b >= 0 && spBefore(cur, list[b])) { list[b + 1] = list[b]; b--; }
            list[b + 1] = cur;
        }
        return list;
    }
    function spReadJson(f) {
        f.encoding = "UTF-8";
        if (!f.open("r")) throw new Error("the file could not be opened");
        var txt = f.read();
        f.close();
        if (txt.charCodeAt(0) === 0xFEFF) txt = txt.substr(1);
        txt = txt.replace(/^\s+/, "");
        if (txt.charAt(0) !== "{") throw new Error("it does not look like a JSON file");
        return eval("(" + txt + ")");
    }
    function spIsArray(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
    // Problem text for one sign type (or, with partial, for an override that lists only some fields). "" = fine.
    function spTypeProblem(st, nm, partial) {
        var okEl = { black: 1, magenta: 1 };
        if (!st || typeof st !== "object") return nm + ": not a valid entry.";
        if (!partial && (typeof st.label !== "string" || st.label === "")) return nm + ": missing label.";
        if (st.notes !== undefined && !spIsArray(st.notes)) return nm + ": notes must be a list of texts.";
        if (st.addNotes !== undefined && !spIsArray(st.addNotes)) return nm + ": addNotes must be a list of texts.";
        if (!partial && !spIsArray(st.layers)) return nm + ": missing the layers list.";
        if (st.layers !== undefined) {
            if (!spIsArray(st.layers)) return nm + ": layers must be a list.";
            for (var i = 0; i < st.layers.length; i++) {
                var ly = st.layers[i];
                if (!ly || typeof ly.name !== "string" || ly.name === "") return nm + ": layer #" + (i + 1) + " has no name.";
                if (typeof ly.color !== "string" || ly.color === "") return nm + ": layer \"" + ly.name + "\" has no color.";
                if (ly.stroke !== undefined && ly.stroke !== null && typeof ly.stroke !== "number") return nm + ": layer \"" + ly.name + "\": stroke must be a number or null.";
                if (ly.element !== undefined && ly.element !== null && !okEl[ly.element]) return nm + ": layer \"" + ly.name + "\": element must be \"black\", \"magenta\" or null.";
            }
        }
        return "";
    }

    // ---- Sign Types (shared file) -------------------------------------
    // Loads the highest "Sign_Types_x.x.json" found in the same folder as this
    // script (the old "Sign_Types_x.x.jsx" is used only if the .json is missing or
    // broken). Returns { version, defaultType, types, source } or null (after an
    // error window, unless quiet).
    function loadSignTypes(scriptPath, scriptTitle, quiet) {
        function fail(title, lines) {
            if (quiet) return null;
            try {
                var d = new Window("dialog", title);
                d.orientation = "column";
                d.alignChildren = ["fill", "top"];
                d.margins = 20;
                d.spacing = 12;
                var h = d.add("statictext", undefined, title);
                try { h.graphics.font = ScriptUI.newFont("dialog", "BOLD", uik().TITLE_SIZE); } catch (eF1) {}
                var t = d.add("statictext", undefined, lines.join("\n"), { multiline: true });
                t.preferredSize = [480, 20 * (lines.length + 3)];
                var g = d.add("group");
                g.alignment = ["center", "top"];
                var okb = g.add("button", undefined, "OK", { name: "ok" });
                okb.preferredSize.width = 100;
                d.center();
                d.show();
            } catch (eW) {
                alert(title + "\n\n" + lines.join("\n"));
            }
            return null;
        }
        var cands = spFindData(scriptPath, "Sign[ _]Types", true);
        var where = "";
        try { where = new File(scriptPath).parent.fsName; } catch (eWh) {}
        if (cands.length === 0) {
            return fail("Sign Types file missing", [
                scriptTitle + " needs the Sign Types file to run, and it was not found in this folder:",
                where,
                "",
                "Download the latest \"Sign_Types_x.x.json\" and put it in the same folder as " + scriptTitle + ", then run it again."
            ]);
        }
        var firstProblems = null, firstName = "";
        for (var ci = 0; ci < cands.length; ci++) {
            var cand = cands[ci];
            var data = null, problems = [];
            if (cand.isJson) {
                try { data = spReadJson(cand.file); } catch (eJ) { problems.push("Could not read the file: " + eJ); }
            } else {
                $.global.__SIGNPACK_LOADING = true;
                $.global.__SIGNPACK_SIGN_TYPES = null;
                try { $.evalFile(cand.file); } catch (eLoad) { problems.push("Could not read the file: " + eLoad); }
                $.global.__SIGNPACK_LOADING = false;
                data = $.global.__SIGNPACK_SIGN_TYPES;
                $.global.__SIGNPACK_SIGN_TYPES = null;
            }
            if (problems.length === 0) {
                if (!data || !data.types || !spIsArray(data.types) || !data.types.length) {
                    problems.push("It does not contain any sign types.");
                } else {
                    for (var s = 0; s < data.types.length && problems.length < 6; s++) {
                        var st = data.types[s];
                        var pr = spTypeProblem(st, (st && st.label) ? st.label : ("Sign type #" + (s + 1)), false);
                        if (pr) problems.push(pr);
                    }
                }
            }
            if (problems.length === 0) {
                if (!data.colors || typeof data.colors !== "object") data.colors = {};
                if (!data.version) data.version = cand.ver.join(".");
                if (!data.defaultType) data.defaultType = data.types[0].label;
                data.source = cand.isJson ? "json" : "jsx";
                return data;
            }
            if (!firstProblems) { firstProblems = problems; firstName = cand.name; }
        }
        var lines = ["The Sign Types file (" + firstName + ") has a problem:", ""];
        for (var q = 0; q < firstProblems.length; q++) lines.push(firstProblems[q]);
        lines.push("");
        lines.push("Fix the file, or download the latest one and put it in the same folder as " + scriptTitle + ".");
        return fail("Sign Types file problem", lines);
    }

    // ---- Client profiles (Clients_x.x.json, optional) ----
    // A client lists only what is DIFFERENT from The Sign Pack standard. If the file is
    // missing or broken, the built-in standard profiles are used (and a broken file is reported once).
    function spClientDefaults() {
        return [
            { label: "The Sign Pack - Production", mode: "production", settings: {}, "export": { preset: "", bleed: "none" }, signTypes: {} },
            { label: "The Sign Pack - Design", "for": ["preflight"], mode: "design", settings: {}, signTypes: {} }
        ];
    }
    // forScript: "preflight" | "helper" | "export". Returns { version, source, clients, problem }.
    function loadClients(scriptPath, forScript, quiet) {
        var problems = [], raw = null, ver = "built-in", src = "built-in";
        var cands = spFindData(scriptPath, "Clients", false);
        if (cands.length > 0) {
            try {
                raw = spReadJson(cands[0].file);
                if (!raw || !spIsArray(raw.clients) || raw.clients.length === 0) {
                    problems.push(cands[0].name + " has no clients list.");
                    raw = null;
                } else {
                    ver = raw.version ? String(raw.version) : cands[0].ver.join(".");
                    src = "json";
                }
            } catch (eRead) {
                problems.push("Could not read " + cands[0].name + ": " + eRead);
                raw = null;
            }
        }
        function build(list, report) {
            var out = [], seen = {};
            for (var i = 0; i < list.length; i++) {
                var c = list[i];
                if (!c || typeof c.label !== "string" || c.label === "") { if (report) problems.push("Client #" + (i + 1) + ": missing label."); continue; }
                if (c.enabled === false) continue;
                var only = spIsArray(c["for"]) ? c["for"] : null;
                if (only) {
                    var okFor = false;
                    for (var k = 0; k < only.length; k++) if (String(only[k]).toLowerCase() === forScript) okFor = true;
                    if (!okFor) continue;
                }
                if (seen[c.label]) { if (report) problems.push("Client \"" + c.label + "\" is listed twice (the first one is used)."); continue; }
                seen[c.label] = true;
                var sts = {}, ov = (c.signTypes && typeof c.signTypes === "object") ? c.signTypes : {};
                for (var tn in ov) {
                    var pr = spTypeProblem(ov[tn], c.label + " / " + tn, true);
                    if (pr) { if (report) problems.push(pr); } else sts[tn] = ov[tn];
                }
                out.push({
                    label: c.label,
                    mode: (c.mode === "design") ? "design" : "production",
                    settings: (c.settings && typeof c.settings === "object") ? c.settings : {},
                    exp: (c["export"] && typeof c["export"] === "object") ? c["export"] : {},
                    signTypes: sts
                });
            }
            return out;
        }
        var clients = raw ? build(raw.clients, true) : [];
        if (clients.length === 0) {
            if (raw) problems.push("No usable client was found in the file.");
            clients = build(spClientDefaults(), false);
            ver = "built-in";
            src = "built-in";
        }
        if (problems.length > 0 && !quiet) {
            try {
                if (!$.global.__SIGNPACK_CLIENTS_WARNED) {
                    $.global.__SIGNPACK_CLIENTS_WARNED = true;
                    uik().spAlert("The Clients file has a problem:\n\n- " + problems.join("\n- ") + "\n\nThe entries with problems are skipped. If nothing usable is left, the standard The Sign Pack profiles are used.", "Clients file problem");
                }
            } catch (eWarn) {}
        }
        return { version: ver, source: src, clients: clients, problem: problems.join("\n") };
    }
    function findClientByLabel(list, label) {
        for (var i = 0; i < list.length; i++) if (list[i].label === label) return list[i];
        return null;
    }
    // The sign type as this client wants it: the standard entry with the client's changes on top.
    function applyClientToType(t, client) {
        var ov = (client && client.signTypes) ? client.signTypes[t.label] : null;
        if (!ov) return t;
        var r = {}, k;
        for (k in t) r[k] = t[k];
        for (k in ov) {
            if (k === "addNotes" || k === "label") continue;
            r[k] = ov[k];
        }
        if (ov.addNotes && ov.addNotes.length) r.notes = (r.notes || []).concat(ov.addNotes);
        return r;
    }

    // ---- Open another script of the toolkit (same folder as this one) ----
    function findSibling(scriptPath, rx) {
        try {
            var files = new File(scriptPath).parent.getFiles();
            var best = null, bestV = null;
            for (var i = 0; i < files.length; i++) {
                if (!(files[i] instanceof File)) continue;
                var m = decodeURI(files[i].name).match(rx);
                if (!m) continue;
                var v = (m[1] || "0").split(".");
                var newer = !bestV;
                if (bestV) {
                    var len = (v.length > bestV.length) ? v.length : bestV.length;
                    for (var n = 0; n < len; n++) {
                        var x = parseInt(v[n] || "0", 10), y = parseInt(bestV[n] || "0", 10);
                        if (x !== y) { newer = (x > y); break; }
                    }
                }
                if (newer) { best = files[i]; bestV = v; }
            }
            return best;
        } catch (eFs) { return null; }
    }
    // Starts the script in its own persistent engine (so its window stays open).
    function launchScript(f, engineName) {
        function lit(str) { return '"' + String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"'; }
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = '#targetengine "' + engineName + '"\n' + spSendCode('$.global.__SELF_OVERRIDE = ' + lit(f.fsName) + ';$.evalFile(new File(' + lit(f.fsName) + '));');
        bt.onError = function (er) { spAlert("Could not open " + decodeURI(f.name) + ":\n" + (er && er.body ? er.body : er)); };
        bt.send();
    }
    function addSignTypesTag(parent, ver) {
        try {
            var vt = parent.add("statictext", undefined, "Sign Types " + ver);
            vt.keepColor = true;
            try { vt.graphics.foregroundColor = vt.graphics.newPen(vt.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55], 1); } catch (eC) {}
            return vt;
        } catch (eT) { return null; }
    }

function main() {
    // JOBMODE: this copy of the script was started inside Illustrator's main engine by the
    // palette, only to scan the document (the palette engine can lose access to the document).
    var JOBMODE = ($.global.__PF_JOB ? true : false);
    if (JOBMODE && app.documents.length === 0) {
        $.global.__PF_JOB = null;
        $.global.__PF_RESULT = "({nodoc:true})";
        return;
    }
    if (app.documents.length === 0) {
        spAlert("Please open a document first.");
        TSP_RESULT = "ERROR: " + TSP_NAME + ": no document is open.";
        return;
    }

    var doc = app.activeDocument;
    var sf = 1;
    var topCache = null;
    var topLayerCache = null;
    var pathColorCache = null;  // fill / stroke color of every path, read once per scan
    var gapEnabled = false;
    var curType = null;
    var scopeIdx = -1;          // -1 = all artboards, otherwise the artboard being checked
    var scopeRect = null;
    var selRect = null;         // union of the selected items (only while scanning, and only when no artboard is picked)
    var selCount = 0;

    function docIsAlive(d) {
        try { var n = d.name; var c = d.artboards.length; return true; } catch (e) { return false; }
    }
    // Returns true if a usable document was found.
    function refreshDoc() {
        var cand = null;
        // 1) the active document (can throw while the palette has focus)
        try { if (app.documents.length > 0) cand = app.activeDocument; } catch (e1) { cand = null; }
        // 2) otherwise keep the one we have, if it still exists
        // 2) otherwise just keep the one we already have (trusted; never re-tested,
        //    because the test itself can throw while the palette has focus)
        if (!cand) cand = doc;
        // 3) otherwise any open document
        if (!cand) {
            try { if (app.documents.length > 0) cand = app.documents[0]; } catch (e2) { cand = null; }
        }
        if (!cand) { topCache = null; topLayerCache = null; pathColorCache = null; return false; }
        doc = cand;
        sf = 1;
        try { if (doc.scaleFactor) sf = doc.scaleFactor; } catch (eSf) {}
        topCache = null;
        topLayerCache = null;
        pathColorCache = null;
        try {
            if (scopeIdx >= 0 && scopeIdx < doc.artboards.length) scopeRect = doc.artboards[scopeIdx].artboardRect;
            else { scopeIdx = -1; scopeRect = null; }
        } catch (eScope) { scopeIdx = -1; scopeRect = null; }
        selRect = null; selCount = 0;
        if (JOBMODE && scopeIdx < 0) {
            try {
                var sel = doc.selection;
                if (sel && sel.length > 0) {
                    for (var si = 0; si < sel.length; si++) {
                        var vb = null;
                        try { vb = sel[si].geometricBounds; } catch (eVb) { vb = null; }
                        if (!vb) continue;
                        if (!selRect) selRect = [vb[0], vb[1], vb[2], vb[3]];
                        else {
                            if (vb[0] < selRect[0]) selRect[0] = vb[0];
                            if (vb[1] > selRect[1]) selRect[1] = vb[1];
                            if (vb[2] > selRect[2]) selRect[2] = vb[2];
                            if (vb[3] < selRect[3]) selRect[3] = vb[3];
                        }
                        selCount++;
                    }
                }
            } catch (eSel) { selRect = null; selCount = 0; }
        }
        return true;
    }
    refreshDoc();

    // ---- Unit helpers (Large Canvas safe) -----------------------
    function inD(inches) { return inches * 72 / sf; }          // inches -> doc units
    function toIn(v) { return (v * sf) / 72; }                 // doc units -> inches
    function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }

    function mk(sev, check, name, detail, collection, idx) {
        return { sev: sev, check: check, name: name, detail: detail, collection: collection, idx: idx };
    }

    // ---- Shared helpers ----------------------------------------
    function getTrueBounds(item) {
        if (!item || item.hidden) return null;
        if (item.typename === "PathItem" && item.guides) return null;
        if (item.typename === "GroupItem") {
            if (item.clipped) {
                for (var c = 0; c < item.pageItems.length; c++) {
                    var pi = item.pageItems[c];
                    if (pi.typename === "PathItem" && pi.clipping) return pi.geometricBounds;
                    if (pi.typename === "CompoundPathItem" &&
                        pi.pathItems.length > 0 && pi.pathItems[0].clipping) return pi.geometricBounds;
                }
            }
            var u = null;
            for (var g = 0; g < item.pageItems.length; g++) {
                var cb = getTrueBounds(item.pageItems[g]);
                if (!cb) continue;
                if (!u) { u = [cb[0], cb[1], cb[2], cb[3]]; }
                else {
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

    function isTopLevel(it) {
        try { return it.parent && it.parent.typename === "Layer"; } catch (e) { return false; }
    }

    // Hidden itself, in a hidden group, or on a hidden layer.
    function effHidden(it) {
        var p = it, guard = 0;
        while (p && guard++ < 60) {
            try {
                if (p.typename === "Layer") { if (!p.visible) return true; }
                else if (p.typename === "Document") break;
                else if (p.hidden) return true;
            } catch (e1) {}
            try { p = p.parent; } catch (e2) { break; }
        }
        return false;
    }

    function matchesProd(name) {
        var n = normName(name);
        for (var k = 0; k < SETTINGS.PRODUCTION_LAYER_KEYS.length; k++) {
            if (n.indexOf(normName(SETTINGS.PRODUCTION_LAYER_KEYS[k])) >= 0) return true;
        }
        return false;
    }
    function onProdLayer(it) {
        var p = it, guard = 0;
        while (p && guard++ < 60) {
            try {
                if (p.typename === "Layer" && matchesProd(p.name)) return true;
                if (p.typename === "Document") break;
                p = p.parent;
            } catch (e) { break; }
        }
        return false;
    }
    function layerNameOf(it) {
        var p = it, guard = 0;
        while (p && guard++ < 60) {
            try {
                if (p.typename === "Layer") return p.name;
                p = p.parent;
            } catch (e) { break; }
        }
        return "(no layer)";
    }

    // Layer-name helpers (CutContour / BoundingBox / routed layers)
    function normName(n) { return ("" + n).toLowerCase().replace(/[\s_\-]/g, ""); }
    function isCutLayerName(n) { return normName(n).indexOf("cutcontour") >= 0; }
    function isOutlineLayerName(n) { return normName(n).indexOf("outline") === 0; }
    function isHolesLayerName(n) { return normName(n).indexOf("hole") >= 0; }
    function isWhiteInkLayerName(n) { return normName(n).indexOf("whiteink") >= 0; }
    function isBBoxLayerName(n) { var x = normName(n); return x.indexOf("boundingbox") >= 0 || x.indexOf("bbox") >= 0; }
    function isRoutedLayerName(n) { return normName(n).indexOf("rout") >= 0; }
    function isCutSpotName(n) { return normName(n) === normName(SETTINGS.CUT_SPOT_NAME); }
    function onLayerWhere(it, test) {
        var p = it, guard = 0;
        while (p && guard++ < 60) {
            try {
                if (p.typename === "Layer" && test(p.name)) return true;
                if (p.typename === "Document") break;
                p = p.parent;
            } catch (e) { break; }
        }
        return false;
    }

    // Top-level items with true bounds, computed once per scan.
    // kind: "cut", "bbox", "outline", "holes", "white" (production layers) or "art" (everything else)
    // doc.pageItems lists EVERY item, nested ones too, and asking each one for
    // its parent is slow. Do it once per scan and let every check share the result.
    function anySubLayers(layers) {
        for (var q = 0; q < layers.length; q++) {
            try { if (layers[q].layers.length > 0) return true; } catch (eQ) { return true; }
        }
        return false;
    }
    // idx for items found through their layer: "L<layer>:<item>" (e.g. "L2:15"), turned back
    // into the item by resolveTopIdx. Plain numbers still mean doc.pageItems[number].
    function resolveTopIdx(d, idx) {
        if (typeof idx !== "string") return d.pageItems[idx];
        var m = idx.match(/^L(\d+):(\d+)$/);
        if (!m) return null;
        return d.layers[parseInt(m[1], 10)].pageItems[parseInt(m[2], 10)];
    }
    function getTopLayerItems() {
        if (topLayerCache) return topLayerCache;
        topLayerCache = [];
        // Fast way: only when no layer has sub-layers (then every item a layer lists is top-level)
        try {
            var lays = doc.layers;
            if (!anySubLayers(lays)) {
                var fast = [];
                for (var la = 0; la < lays.length; la++) {
                    var lItems = lays[la].pageItems;
                    for (var lk = 0; lk < lItems.length; lk++) {
                        try { fast.push({ it: lItems[lk], idx: "L" + la + ":" + lk }); } catch (eL) {}
                    }
                }
                topLayerCache = fast;
                return topLayerCache;
            }
        } catch (eFast) { topLayerCache = []; }
        var flat0 = doc.pageItems;
        for (var i0 = 0; i0 < flat0.length; i0++) {
            try {
                var it0 = flat0[i0];
                if (isTopLevel(it0)) topLayerCache.push({ it: it0, idx: i0 });
            } catch (e0) {}
        }
        return topLayerCache;
    }
    function getTop() {
        if (topCache) return topCache;
        topCache = [];
        var flat = getTopLayerItems();
        for (var i = 0; i < flat.length; i++) {
            try {
                var it = flat[i].it;
                var gi = flat[i].idx;
                if (!inScope(it)) continue;
                if (effHidden(it)) continue;
                var tb = getTrueBounds(it);
                if (!tb) continue;
                var kind = "art";
                if (onLayerWhere(it, isCutLayerName)) kind = "cut";
                else if (onLayerWhere(it, isBBoxLayerName)) kind = "bbox";
                else if (onLayerWhere(it, isOutlineLayerName)) kind = "outline";
                else if (onLayerWhere(it, isHolesLayerName)) kind = "holes";
                else if (onLayerWhere(it, isWhiteInkLayerName)) kind = "white";
                topCache.push({ it: it, idx: gi, tb: tb, kind: kind });
            } catch (e) {}
        }
        return topCache;
    }
    function getArt() {
        var all = getTop(), out = [];
        for (var i = 0; i < all.length; i++) if (all[i].kind === "art") out.push(all[i]);
        return out;
    }
    // True when the item touches the artboard being checked (always true for "All artboards")
    function inScope(it) {
        var r = scopeRect || selRect;
        if (!r) return true;
        try {
            var b = it.geometricBounds;
            return !(b[2] < r[0] || b[0] > r[2] || b[1] < r[3] || b[3] > r[1]);
        } catch (e) { return true; }
    }
    function layerHasScopedItem(ly) {
        try {
            var items = ly.pageItems;
            if (items.length === 0) return false;
            if (!scopeRect && !selRect) return true;
            for (var q = 0; q < items.length; q++) if (inScope(items[q])) return true;
        } catch (e) {}
        return false;
    }
    function overlapsRect(tb, r) {
        return !(tb[2] < r[0] || tb[0] > r[2] || tb[1] < r[3] || tb[3] > r[1]);
    }
    function unionBounds(list) {
        var u = null;
        for (var i = 0; i < list.length; i++) {
            var b = list[i].tb;
            if (!u) u = [b[0], b[1], b[2], b[3]];
            else {
                if (b[0] < u[0]) u[0] = b[0];
                if (b[1] > u[1]) u[1] = b[1];
                if (b[2] > u[2]) u[2] = b[2];
                if (b[3] < u[3]) u[3] = b[3];
            }
        }
        return u;
    }
    function nameOf(it) { try { return it.name || it.typename; } catch (e) { return "Item"; } }

    // Color key used to match swatches against artwork colors.
    function colorKey(c) {
        if (!c) return null;
        try {
            switch (c.typename) {
                case "SpotColor": return "S:" + c.spot.name;
                case "CMYKColor": return "C:" + Math.round(c.cyan) + "," + Math.round(c.magenta) + "," + Math.round(c.yellow) + "," + Math.round(c.black);
                case "RGBColor": return "R:" + Math.round(c.red) + "," + Math.round(c.green) + "," + Math.round(c.blue);
                case "GrayColor": return "K:" + Math.round(c.gray);
                case "GradientColor": return "G:" + c.gradient.name;
                case "PatternColor": return "P:" + c.pattern.name;
            }
        } catch (e) {}
        return null;
    }
    function addUsed(c, used) {
        var k = colorKey(c);
        if (!k) return;
        used[k] = true;
        try {
            if (c.typename === "GradientColor") {
                var stops = c.gradient.gradientStops;
                for (var s = 0; s < stops.length; s++) addUsed(stops[s].color, used);
            }
        } catch (e) {}
    }

    // Net-material thickness helpers (thin shapes / islands)
    function estimatePerimeter(pathItem) {
        var pts = pathItem.pathPoints;
        var n = pts.length;
        if (n < 2) return 0;
        var total = 0;
        var segments = pathItem.closed ? n : n - 1;
        for (var i = 0; i < segments; i++) {
            var a = pts[i].anchor;
            var b = pts[(i + 1) % n].anchor;
            var dx = b[0] - a[0], dy = b[1] - a[1];
            total += Math.sqrt(dx * dx + dy * dy);
        }
        return total;
    }
    function boundsInside(inner, outer) {
        var e = 0.01;
        return inner[0] >= outer[0] - e && inner[2] <= outer[2] + e &&
               inner[1] <= outer[1] + e && inner[3] >= outer[3] - e;
    }
    // Sub-paths of a compound path with nesting depth (0 = outer, 1 = hole, ...)
    function compoundSubs(cp) {
        var subs = [];
        for (var p = 0; p < cp.pathItems.length; p++) {
            var sp = cp.pathItems[p];
            var a = 0;
            try { a = Math.abs(sp.area); } catch (eA) {}
            if (a <= 0) continue;
            subs.push({ area: a, per: estimatePerimeter(sp), b: sp.geometricBounds, depth: 0 });
        }
        for (var i = 0; i < subs.length; i++) {
            for (var j = 0; j < subs.length; j++) {
                if (i === j) continue;
                if (subs[j].area > subs[i].area && boundsInside(subs[i].b, subs[j].b)) subs[i].depth++;
            }
        }
        return subs;
    }

    // Each check can call setInfo("what was checked", "badge") so the row can say
    // what it covered even when everything is fine. Reset before every check.
    var infoNote = "", infoBadge = "";
    function setInfo(text, badge) { infoNote = text || ""; infoBadge = badge || ""; }
    function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
    function problemCount(issues) {
        var n = 0;
        for (var i = 0; i < issues.length; i++) if (issues[i].sev !== "ok") n++;
        return n;
    }

    function capRows(issues, extraCheck, limit) {
        var max = limit || SETTINGS.MAX_ROWS;
        if (issues.length > max) {
            var more = issues.length - max;
            var sev = issues[0].sev;
            issues.length = max;
            issues.push(mk(sev, extraCheck, "...and " + more + " more", "Only the first " + max + " are listed", null, null));
        }
        return issues;
    }

    // ============================================================
    //  STANDARD CHECKS
    // ============================================================

    // ---- Image DPI ----------------------------------------------
    function checkDPI() {
        var issues = [];
        var okRows = [], total = 0;
        var colls = [["placedItems", doc.placedItems], ["rasterItems", doc.rasterItems]];
        for (var c = 0; c < colls.length; c++) {
            var coll = colls[c][1];
            for (var i = 0; i < coll.length; i++) {
                try {
                    var item = coll[i];
                    if (!inScope(item)) continue;
                    if (effHidden(item)) continue;
                    var m = item.matrix;
                    var scaleX = Math.sqrt(m.mValueA * m.mValueA + m.mValueB * m.mValueB) * sf;
                    var scaleY = Math.sqrt(m.mValueC * m.mValueC + m.mValueD * m.mValueD) * sf;
                    var ppiX = scaleX > 0 ? Math.round(72 / scaleX) : 0;
                    var ppiY = scaleY > 0 ? Math.round(72 / scaleY) : 0;
                    var ppi = (ppiX > 0 && ppiY > 0) ? Math.min(ppiX, ppiY) : (ppiX || ppiY);
                    if (ppi > 0) {
                        total++;
                        var nm = "Unnamed";
                        try { nm = item.name || (item.file ? item.file.displayName : "Unnamed"); } catch (eN) {}
                        if (ppi < SETTINGS.DPI_WARN) {
                            issues.push(mk(ppi < SETTINGS.DPI_BAD ? "bad" : "warn", "Image DPI", nm,
                                ppi + " DPI at final size (warn < " + SETTINGS.DPI_WARN + ", red < " + SETTINGS.DPI_BAD + ")",
                                colls[c][0], i));
                        } else {
                            okRows.push(mk("ok", "Image DPI", nm, ppi + " DPI at final size", colls[c][0], i));
                        }
                    }
                } catch (eItem) {}
            }
        }
        if (total === 0) { setInfo("No images in the file"); return null; }
        var bads = [], warns = [];
        for (var q = 0; q < issues.length; q++) (issues[q].sev === "bad" ? bads : warns).push(issues[q]);
        var all = capRows(bads.concat(warns).concat(okRows), "Image DPI", SETTINGS.MAX_IMAGE_ROWS);
        setInfo(plural(total, "image") + " checked", plural(total, "image"));
        return all;
    }

    // ---- Unused swatches -----------------------------------------
    var unusedSwatchNames = [];
    function getPathColors() {
        if (pathColorCache) return pathColorCache;
        pathColorCache = [];
        var pp = doc.pathItems;
        for (var pi = 0; pi < pp.length; pi++) {
            var ent = { p: null, i: pi, fc: null, sc: null, stroked: false, g: false, c: false, sw: 0, b: null, np: -1 };
            try {
                var one = pp[pi];
                ent.p = one;
                if (one.filled) ent.fc = one.fillColor;
                if (one.stroked) { ent.sc = one.strokeColor; ent.stroked = true; ent.sw = one.strokeWidth; }
                ent.g = one.guides;
                ent.c = one.clipping;
            } catch (eP) {}
            pathColorCache.push(ent);
        }
        return pathColorCache;
    }
    function checkSwatches() {
        unusedSwatchNames = [];
        var used = {};
        var pcs = getPathColors();
        for (var i = 0; i < pcs.length; i++) {
            try {
                if (pcs[i].fc) addUsed(pcs[i].fc, used);
                if (pcs[i].sc) addUsed(pcs[i].sc, used);
            } catch (e1) {}
        }
        var frames = doc.textFrames;
        for (var t = 0; t < frames.length; t++) {
            try {
                var tf = frames[t];
                var rngs = tf.textRanges;
                for (var r = 0; r < rngs.length; r++) {
                    try {
                        var ca = rngs[r].characterAttributes;
                        addUsed(ca.fillColor, used);
                        addUsed(ca.strokeColor, used);
                    } catch (e2) {}
                }
            } catch (e3) {}
        }
        var issues = [];
        var sw = doc.swatches;
        var swChecked = 0;
        for (var s = 0; s < sw.length; s++) {
            try {
                var swatch = sw[s];
                var nm = swatch.name;
                if (nm.charAt(0) === "[") continue;       // [None], [Registration]
                var k = colorKey(swatch.color);
                if (!k) continue;
                swChecked++;
                if (!used[k]) { issues.push(mk("warn", "Unused Swatch", nm, "Not used by any artwork", null, null)); unusedSwatchNames.push(nm); }
            } catch (e4) {}
        }
        setInfo(plural(swChecked, "swatch") + " checked");
        return capRows(issues, "Unused Swatch");
    }

    // ---- Named colors (the old Check All Colors) ------------------
    // Lists every spot color and every color that has a named swatch, used by
    // the artwork. Each row can be focused, and "Add Label" puts a labelled
    // color square in the file (for the client's color legend).
    function colorSpec(c) {
        try {
            if (c.typename === "SpotColor") return "spot|" + c.spot.name;
            if (c.typename === "CMYKColor") return "cmyk|" + c.cyan + "|" + c.magenta + "|" + c.yellow + "|" + c.black;
            if (c.typename === "RGBColor") return "rgb|" + c.red + "|" + c.green + "|" + c.blue;
            if (c.typename === "GrayColor") return "gray|" + c.gray;
        } catch (e) {}
        return "";
    }
    // On-screen approximation of the color (CMYK is converted with the simple formula,
    // a spot color uses its alternate color), used only for the little color square.
    function colorRGB(c) {
        var rgb = [0, 0, 0];
        try {
            if (c.typename === "SpotColor") return colorRGB(c.spot.color);
            if (c.typename === "RGBColor") rgb = [c.red, c.green, c.blue];
            else if (c.typename === "CMYKColor") {
                var k = c.black / 100;
                rgb = [255 * (1 - c.cyan / 100) * (1 - k), 255 * (1 - c.magenta / 100) * (1 - k), 255 * (1 - c.yellow / 100) * (1 - k)];
            } else if (c.typename === "GrayColor") {
                var g = 255 * (1 - c.gray / 100);
                rgb = [g, g, g];
            }
        } catch (e) {}
        return [Math.max(0, Math.min(255, Math.round(rgb[0]))), Math.max(0, Math.min(255, Math.round(rgb[1]))), Math.max(0, Math.min(255, Math.round(rgb[2])))];
    }
    function colorDesc(c) {
        try {
            if (c.typename === "SpotColor") return "Spot color";
            if (c.typename === "CMYKColor") return "CMYK " + Math.round(c.cyan) + " / " + Math.round(c.magenta) + " / " + Math.round(c.yellow) + " / " + Math.round(c.black);
            if (c.typename === "RGBColor") return "RGB " + Math.round(c.red) + " / " + Math.round(c.green) + " / " + Math.round(c.blue);
            if (c.typename === "GrayColor") return "Gray " + Math.round(c.gray) + "%";
        } catch (e) {}
        return "Color";
    }
    function checkColors() {
        var rows = [], seenKey = {}, seenName = {};
        function addColor(color, coll, idx) {
            if (!color) return;
            var t = color.typename;
            if (t !== "SpotColor" && t !== "CMYKColor" && t !== "RGBColor" && t !== "GrayColor") return;
            var key = colorKey(color);
            if (!key || seenKey[key]) return;
            var name = "", useColor = color;
            if (t === "SpotColor") {
                name = color.spot.name;
            } else {
                try {
                    var swatch = doc.swatches.getByColor(color);
                    if (!swatch || !swatch.name || swatch.name.charAt(0) === "[") return;
                    name = swatch.name;
                    useColor = swatch.color;
                } catch (eSw) { return; }
            }
            seenKey[key] = true;
            if (seenName[name]) return;
            seenName[name] = true;
            var r = mk("ok", "Named Color", name, colorDesc(useColor), coll, idx);
            r.spec = colorSpec(useColor);
            r.rgb = colorRGB(useColor);
            rows.push(r);
        }
        var pcs2 = getPathColors();
        for (var i = 0; i < pcs2.length; i++) {
            try {
                if (!pcs2[i].p || !inScope(pcs2[i].p)) continue;
                if (pcs2[i].fc) addColor(pcs2[i].fc, "pathItems", pcs2[i].i);
                if (pcs2[i].sc) addColor(pcs2[i].sc, "pathItems", pcs2[i].i);
            } catch (e1) {}
        }
        var frames = doc.textFrames;
        for (var t2 = 0; t2 < frames.length; t2++) {
            try {
                var tf = frames[t2];
                if (!inScope(tf)) continue;
                var ca = tf.textRange.characterAttributes;
                addColor(ca.fillColor, "textFrames", t2);
                addColor(ca.strokeColor, "textFrames", t2);
            } catch (e2) {}
        }
        if (rows.length === 0) { setInfo("No named colors found in the file"); return []; }
        var n = rows.length;
        setInfo(plural(n, "named color") + " in use. Select one and press Add Label.", plural(n, "color"));
        return capRows(rows, "Named Color", SETTINGS.MAX_IMAGE_ROWS);
    }

    // ---- Text: live / missing font / overset ---------------------
    function checkText() {
        var issues = [];
        var frames = doc.textFrames;
        var tfChecked = 0;
        for (var i = 0; i < frames.length; i++) {
            try {
                var tf = frames[i];
                if (!inScope(tf)) continue;
                if (effHidden(tf)) continue;
                tfChecked++;
                var label = (tf.name && tf.name !== "") ? tf.name : "Text frame " + (i + 1);
                var preview = "";
                try { preview = tf.contents.substr(0, 30); } catch (eC) {}
                var flagged = false;

                var seen = {};
                var ranges = tf.textRanges;
                for (var c = 0; c < ranges.length; c++) {
                    var fontName = "";
                    try { fontName = ranges[c].textFont.name; } catch (eF) { continue; }
                    if (seen[fontName]) continue;
                    seen[fontName] = true;
                    var found = true;
                    try { app.textFonts.getByName(fontName); } catch (eLookup) { found = false; }
                    if (!found) {
                        issues.push(mk("bad", "Missing Font", label, fontName + " is not installed", "textFrames", i));
                        flagged = true;
                    }
                }
                var overflowed = false;
                try { overflowed = tf.overflowed; } catch (eOv) {}
                if (overflowed) {
                    issues.push(mk("bad", "Overset Text", label, "Text overflows its frame: " + preview, "textFrames", i));
                    flagged = true;
                }
                if (!flagged) {
                    issues.push(mk("warn", "Live Text", label, "Not outlined: " + preview, "textFrames", i));
                }
            } catch (eTf) {}
        }
        // Keep red items first so the cap never hides them
        var bad = [], warn = [];
        for (var q = 0; q < issues.length; q++) (issues[q].sev === "bad" ? bad : warn).push(issues[q]);
        setInfo(tfChecked === 0 ? "No text frames in the file" : plural(tfChecked, "text frame") + " checked");
        return capRows(bad.concat(warn), "Text");
    }

    // ---- File color mode -----------------------------------------
    function checkColorMode() {
        var issues = [];
        var docIsCMYK = (doc.documentColorSpace === DocumentColorSpace.CMYK);
        if (!docIsCMYK) {
            issues.push(mk("warn", "Document Color Mode", doc.name,
                "Document is not in CMYK color mode. Check if there is a client spec", null, null));
        }
        var flat = getTopLayerItems();
        for (var fi = 0; fi < flat.length; fi++) {
            var i = flat[fi].idx;
            try {
                var it = flat[fi].it;
                if (!inScope(it)) continue;
                var counts = { rgb: 0, cmyk: 0 };
                countWrongMode(it, docIsCMYK, counts);
                var wrong = docIsCMYK ? counts.rgb : counts.cmyk;
                if (wrong > 0) {
                    issues.push(mk("bad", "Wrong Color Mode",
                        wrong > 1 ? nameOf(it) + " (" + wrong + " items)" : nameOf(it),
                        (docIsCMYK ? "RGB color in a CMYK document" : "CMYK color in an RGB document"),
                        "pageItems", i));
                }
            } catch (eItem) {}
        }
        setInfo("Document is " + (docIsCMYK ? "CMYK" : "not CMYK") + "; top-level items checked for the wrong color mode");
        return capRows(issues, "Wrong Color Mode");
    }
    function countWrongMode(it, docIsCMYK, counts) {
        function look(color) {
            if (!color) return;
            try {
                if (docIsCMYK && color.typename === "RGBColor") counts.rgb++;
                else if (!docIsCMYK && color.typename === "CMYKColor") counts.cmyk++;
            } catch (e) {}
        }
        try { if (it.filled) look(it.fillColor); } catch (e1) {}
        try { if (it.stroked) look(it.strokeColor); } catch (e2) {}
        try {
            if (it.typename === "GroupItem") {
                for (var g = 0; g < it.pageItems.length; g++) countWrongMode(it.pageItems[g], docIsCMYK, counts);
            } else if (it.typename === "CompoundPathItem") {
                for (var p = 0; p < it.pathItems.length; p++) countWrongMode(it.pathItems[p], docIsCMYK, counts);
            }
        } catch (eR) {}
    }

    // ---- Open paths (production layers only) ---------------------
    function checkOpenPaths() {
        var issues = [];
        var groups = {}, order = [];
        var paths = doc.pathItems;
        var opChecked = 0;
        for (var i = 0; i < paths.length; i++) {
            try {
                var p = paths[i];
                if (p.guides || p.clipping) continue;
                if (!inScope(p)) continue;
                if (effHidden(p)) continue;
                if (!onProdLayer(p)) continue;
                opChecked++;
                if (p.closed) continue;
                var ln = layerNameOf(p);
                if (!groups[ln]) { groups[ln] = { count: 0, idx: i }; order.push(ln); }
                groups[ln].count++;
            } catch (e) {}
        }
        for (var o = 0; o < order.length; o++) {
            var g = groups[order[o]];
            issues.push(mk("bad", "Open Path", "Layer \"" + order[o] + "\" (" + g.count + " path" + (g.count > 1 ? "s" : "") + ")",
                "Open path on a production layer", "pathItems", g.idx));
        }
        if (findProdLayers().length === 0) {
            setInfo("No production layer found, so nothing was checked. Layer names must contain: " + SETTINGS.PRODUCTION_LAYER_KEYS.join(", "));
            return null;
        }
        setInfo(plural(opChecked, "path") + " checked on production layers");
        return issues;
    }

    // ---- Clipping masks ---------------------------------------------
    function checkClipping() {
        var issues = [];
        var groups = doc.groupItems;
        var clipCount = 0;
        for (var i = 0; i < groups.length; i++) {
            try {
                var g = groups[i];
                if (!g.clipped) continue;
                if (!inScope(g)) continue;
                clipCount++;
                var hidden = effHidden(g);
                issues.push(mk(hidden ? "bad" : "warn", hidden ? "Hidden Clipping Mask" : "Clipping Mask",
                    nameOf(g) + " (on \"" + layerNameOf(g) + "\")",
                    hidden ? "Mask is hidden (hidden group or hidden layer)" : "Visible clipping mask, verify the result",
                    "groupItems", i));
            } catch (e) {}
        }
        var bad = [], warn = [];
        for (var q = 0; q < issues.length; q++) (issues[q].sev === "bad" ? bad : warn).push(issues[q]);
        setInfo(clipCount === 0 ? "No clipping masks in the file (" + plural(groups.length, "group") + " checked)" : plural(clipCount, "clipping mask") + " found");
        return capRows(bad.concat(warn), "Clipping Mask");
    }

    // ---- External links -----------------------------------------------
    function checkLinks() {
        var issues = [];
        var placed = doc.placedItems;
        for (var i = 0; i < placed.length; i++) {
            try {
                var item = placed[i];
                if (!inScope(item)) continue;
                var exists = false, path = "(no file reference)";
                try { if (item.file) { path = item.file.fsName; exists = item.file.exists; } } catch (eF) {}
                var nm = "Unnamed";
                try { nm = item.name || (item.file ? item.file.displayName : "Unnamed"); } catch (eN) {}
                if (!exists) issues.push(mk("bad", "Missing Link", nm, path, "placedItems", i));
                else issues.push(mk("warn", "Linked File", nm, "Still linked: " + path, "placedItems", i));
            } catch (eItem) {}
        }
        var bad = [], warn = [];
        for (var q = 0; q < issues.length; q++) (issues[q].sev === "bad" ? bad : warn).push(issues[q]);
        setInfo(placed.length === 0 ? "No linked files in the file" : plural(placed.length, "linked file") + " checked");
        return capRows(bad.concat(warn), "External Link");
    }

    // ============================================================
    //  JOB CHECKS
    // ============================================================

    function walkLayers(layers, fn, depth, topIdx) {
        for (var i = 0; i < layers.length; i++) {
            var ly = layers[i];
            var ti = (depth === 0) ? i : topIdx;
            fn(ly, depth, depth === 0 ? i : null);
            try { if (ly.layers && ly.layers.length) walkLayers(ly.layers, fn, depth + 1, ti); } catch (e) {}
        }
    }
    function findProdLayers() {
        var out = [];
        walkLayers(doc.layers, function (ly) {
            try { if (matchesProd(ly.name) && layerHasScopedItem(ly)) out.push(ly.name); } catch (e) {}
        }, 0, 0);
        return out;
    }

    function jCutLayer(sevWhenMissing) {
        return function () {
            var found = findProdLayers();
            if (found.length > 0) return [];
            return [mk(sevWhenMissing, "Cut Layer", "No cut / route layer with artwork",
                "Looked for a layer whose name contains: " + SETTINGS.PRODUCTION_LAYER_KEYS.join(", "), null, null)];
        };
    }

    function jArtboardSize() {
        var issues = [];
        for (var a = 0; a < doc.artboards.length; a++) {
            if (scopeIdx >= 0 && a !== scopeIdx) continue;
            try {
                var r = doc.artboards[a].artboardRect;
                var wIn = toIn(Math.abs(r[2] - r[0])), hIn = toIn(Math.abs(r[1] - r[3]));
                if (wIn < SETTINGS.ARTBOARD_MIN_INCHES || wIn > SETTINGS.ARTBOARD_MAX_INCHES ||
                    hIn < SETTINGS.ARTBOARD_MIN_INCHES || hIn > SETTINGS.ARTBOARD_MAX_INCHES) {
                    issues.push(mk("warn", "Artboard Size", doc.artboards[a].name,
                        wIn.toFixed(2) + "in x " + hIn.toFixed(2) + "in, verify this is correct", "artboard", a));
                }
            } catch (e) {}
        }
        return issues;
    }

    function jOverhang() {
        var issues = [];
        var tol = 0.05;
        var bl = inD(SETTINGS.OVERHANG_BLEED_INCHES);
        var tops = getArt();
        for (var a = 0; a < doc.artboards.length; a++) {
            if (scopeIdx >= 0 && a !== scopeIdx) continue;
            try {
                var raw = doc.artboards[a].artboardRect;
                var ab = [raw[0] - bl, raw[1] + bl, raw[2] + bl, raw[3] - bl];
                for (var t = 0; t < tops.length; t++) {
                    var tb = tops[t].tb;
                    var overlaps = !(tb[2] < ab[0] - tol || tb[0] > ab[2] + tol || tb[1] < ab[3] - tol || tb[3] > ab[1] + tol);
                    if (!overlaps) continue;
                    var inside = (tb[0] >= ab[0] - tol && tb[2] <= ab[2] + tol && tb[1] <= ab[1] + tol && tb[3] >= ab[3] - tol);
                    if (!inside) issues.push(mk("warn", "Overhang", nameOf(tops[t].it),
                        "Extends past artboard \"" + doc.artboards[a].name + "\"", "artboard", a));
                }
            } catch (e) {}
        }
        return capRows(issues, "Overhang");
    }

    function jOutside() {
        if (scopeIdx >= 0) { setInfo("Only checked when All artboards is selected"); return null; }
        var issues = [];
        var tops = getTop();
        for (var t = 0; t < tops.length; t++) {
            var hit = false;
            for (var a = 0; a < doc.artboards.length; a++) {
                if (overlapsRect(tops[t].tb, doc.artboards[a].artboardRect)) { hit = true; break; }
            }
            if (!hit) issues.push(mk("warn", "Off-Artboard", nameOf(tops[t].it), "Sits completely outside every artboard", "pageItems", tops[t].idx));
        }
        return capRows(issues, "Off-Artboard");
    }

    function jEmpty() {
        var issues = [];
        walkLayers(doc.layers, function (ly, depth, topIdx) {
            try {
                if (ly.pageItems.length === 0 && (!ly.layers || ly.layers.length === 0)) {
                    issues.push(mk("warn", "Empty Layer", ly.name, "Layer has nothing on it", topIdx !== null ? "layer" : null, topIdx));
                }
            } catch (e) {}
        }, 0, 0);
        var frames = doc.textFrames;
        for (var i = 0; i < frames.length; i++) {
            try {
                if (frames[i].contents === "") issues.push(mk("warn", "Empty Text", nameOf(frames[i]), "Text frame has no text", "textFrames", i));
            } catch (e1) {}
        }
        var paths = doc.pathItems;
        for (var p = 0; p < paths.length; p++) {
            try {
                if (paths[p].pathPoints.length === 1 && !paths[p].guides) issues.push(mk("warn", "Stray Point", nameOf(paths[p]), "Path with a single anchor point", "pathItems", p));
            } catch (e2) {}
        }
        return capRows(issues, "Empty / Stray");
    }

    // Bounds and point count of a path, read once and kept (only needed by a few checks)
    function ensureGeom(e) {
        if (e.np !== -1) return;
        try { e.b = e.p.geometricBounds; } catch (eG1) { e.b = null; }
        try { e.np = e.p.pathPoints.length; } catch (eG2) { e.np = 0; }
    }
    function boundsInScope(b) {
        var r = scopeRect || selRect;
        if (!r) return true;
        if (!b) return true;
        return !(b[2] < r[0] || b[0] > r[2] || b[1] < r[3] || b[3] > r[1]);
    }
    function jDuplicates(sev) {
        return function () {
            var issues = [];
            var pcs = getPathColors();
            var groupsByKey = {}, keyOrder = [];
            for (var i = 0; i < pcs.length; i++) {
                try {
                    var e = pcs[i];
                    if (!e.p || e.g || e.c) continue;
                    ensureGeom(e);
                    if (!e.b || !boundsInScope(e.b)) continue;
                    var b = e.b;
                    var key = Math.round(b[0] * 100) + "|" + Math.round(b[1] * 100) + "|" + Math.round(b[2] * 100) + "|" + Math.round(b[3] * 100) +
                              "|" + e.np + "|" + (e.fc ? colorKey(e.fc) : "nf") + "|" + (e.sc ? colorKey(e.sc) : "ns");
                    if (groupsByKey[key] === undefined) { groupsByKey[key] = [i]; keyOrder.push(key); }
                    else groupsByKey[key].push(i);
                } catch (e0) {}
            }
            // Only paths that look identical need the (slow) hidden check
            for (var k = 0; k < keyOrder.length; k++) {
                var list = groupsByKey[keyOrder[k]];
                if (list.length < 2) continue;
                var vis = [];
                for (var m = 0; m < list.length; m++) {
                    try { if (!effHidden(pcs[list[m]].p)) vis.push(list[m]); } catch (eH) {}
                }
                if (vis.length >= 2) {
                    issues.push(mk(sev, "Stacked Duplicate", nameOf(pcs[vis[1]].p), "Identical shape stacked on top of another", "pathItems", pcs[vis[0]].i));
                }
            }
            return capRows(issues, "Stacked Duplicate");
        };
    }

    function jHairlines() {
        var issues = [];
        var pcs = getPathColors();
        var scoped = !!(scopeRect || selRect);
        for (var i = 0; i < pcs.length; i++) {
            try {
                var e = pcs[i];
                if (!e.p || !e.stroked || e.g || e.c) continue;
                var sw = e.sw * sf;   // real pt = doc units x scale factor
                if (!(sw > 0 && sw < SETTINGS.HAIRLINE_MIN_PT)) continue;
                if (scoped) { ensureGeom(e); if (!boundsInScope(e.b)) continue; }
                if (!effHidden(e.p)) {
                    issues.push(mk("warn", "Hairline Stroke", nameOf(e.p),
                        sw.toFixed(3) + "pt (below " + SETTINGS.HAIRLINE_MIN_PT + "pt)", "pathItems", e.i));
                }
            } catch (e1) {}
        }
        return capRows(issues, "Hairline Stroke");
    }

    function jTransparency() {
        var issues = [];
        var tops = getArt();
        for (var t = 0; t < tops.length; t++) {
            try {
                var it = tops[t].it;
                var op = 100, bm = null;
                try { op = it.opacity; } catch (eOp) {}
                try { bm = it.blendingMode; } catch (eBm) {}
                var flags = [];
                if (op < 100) flags.push(op + "% opacity");
                if (bm !== null && bm !== BlendModes.NORMAL) flags.push("blend mode: " + bm);
                if (flags.length) issues.push(mk("warn", "Transparency", nameOf(it), flags.join(", "), "pageItems", tops[t].idx));
            } catch (e) {}
        }
        return capRows(issues, "Transparency");
    }

    function jPureBlack() {
        var issues = [];
        var flat = getTopLayerItems();
        for (var fi = 0; fi < flat.length; fi++) {
            var i = flat[fi].idx;
            try {
                var it = flat[fi].it;
                if (effHidden(it)) continue;
                if (!inScope(it)) continue;
                var n = countBlack(it);
                if (n > 0) issues.push(mk("warn", "Pure Black Fill", n > 1 ? nameOf(it) + " (" + n + " items)" : nameOf(it),
                    "C0 M0 Y0 K100, verify rich black wasn't intended", "pageItems", i));
            } catch (e) {}
        }
        return capRows(issues, "Pure Black Fill");
    }
    function countBlack(it) {
        var n = 0;
        try {
            if ((it.typename === "PathItem") && it.filled) {
                var c = it.fillColor;
                if (c.typename === "CMYKColor" && c.cyan === 0 && c.magenta === 0 && c.yellow === 0 && c.black === 100) n++;
            } else if (it.typename === "GroupItem") {
                for (var g = 0; g < it.pageItems.length; g++) n += countBlack(it.pageItems[g]);
            } else if (it.typename === "CompoundPathItem" && it.pathItems.length > 0) {
                var c2 = it.pathItems[0].fillColor;
                if (c2.typename === "CMYKColor" && c2.cyan === 0 && c2.magenta === 0 && c2.yellow === 0 && c2.black === 100) n++;
            }
        } catch (e) {}
        return n;
    }

    // Thin shapes: 2 x net area / perimeter (outer minus holes)
    function reportThin(thicknessPt, name, idx, issues) {
        var inches = thicknessPt / 72;
        if (inches < SETTINGS.MIN_AVG_THICKNESS_INCHES) {
            issues.push(mk("warn", "Thin Shape (avg)", name,
                f3(inches) + "in avg thickness (below " + SETTINGS.MIN_AVG_THICKNESS_INCHES + "in), estimate, verify by eye", "pageItems", idx));
        }
    }
    function thinPath(p, idx, issues) {
        try {
            if (p.hidden || !p.closed || !p.filled) return;
            var area = Math.abs(p.area);
            if (area <= 0) return;
            var per = estimatePerimeter(p);
            if (per <= 0) return;
            reportThin((2 * area * sf) / per, nameOf(p), idx, issues);
        } catch (e) {}
    }
    function thinCompound(cp, idx, issues) {
        try {
            var subs = compoundSubs(cp);
            if (!subs.length) return;
            var net = 0, per = 0;
            for (var i = 0; i < subs.length; i++) {
                net += (subs[i].depth % 2 === 0) ? subs[i].area : -subs[i].area;
                per += subs[i].per;
            }
            if (net <= 0 || per <= 0) return;
            reportThin((2 * net * sf) / per, nameOf(cp), idx, issues);
        } catch (e) {}
    }
    function thinCollect(it, idx, issues) {
        try {
            if (it.hidden) return;
            if (it.typename === "PathItem") thinPath(it, idx, issues);
            else if (it.typename === "CompoundPathItem" && it.pathItems.length > 0) thinCompound(it, idx, issues);
            else if (it.typename === "GroupItem") for (var g = 0; g < it.pageItems.length; g++) thinCollect(it.pageItems[g], idx, issues);
        } catch (e) {}
    }
    function jThin() {
        var issues = [];
        var tops = getArt();
        for (var t = 0; t < tops.length; t++) thinCollect(tops[t].it, tops[t].idx, issues);
        return capRows(issues, "Thin Shape (avg)");
    }


    // ---- Narrowest width of vinyl pieces ---------------------------------
    // For each shape, walks the outline and measures how thick the material is
    // at each point (a short ray from the edge straight into the shape). A shape
    // is flagged when parts thinner than MIN_VINYL_WIDTH_INCHES run for at least
    // MIN_THIN_EDGE_INCHES (so sharp tips and corners don't count). One flag per
    // top-level piece. Estimate: verify by eye.
    function nwFlatten(p) {
        var pts = p.pathPoints, n = pts.length, out = [];
        if (n < 3) return out;
        var k = sf / 72;
        var segs = p.closed ? n : n - 1;
        for (var i = 0; i < segs; i++) {
            var a = pts[i], b = pts[(i + 1) % n];
            var p0 = a.anchor, p1 = a.rightDirection, p2 = b.leftDirection, p3 = b.anchor;
            var straight = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]) < 1e-6 &&
                           Math.abs(p2[0] - p3[0]) + Math.abs(p2[1] - p3[1]) < 1e-6;
            var steps = 1;
            if (!straight) {
                var len = (Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]) +
                           Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]) +
                           Math.abs(p3[0] - p2[0]) + Math.abs(p3[1] - p2[1])) * k;
                steps = Math.max(3, Math.min(24, Math.ceil(len / 0.05)));
            }
            for (var s2 = 0; s2 < steps; s2++) {
                var t = s2 / steps, u = 1 - t;
                var x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
                var y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
                out.push([x * k, y * k]);
            }
        }
        return out;
    }
    function nwPolyArea(poly) {
        var a = 0;
        for (var i = 0; i < poly.length; i++) {
            var q = poly[(i + 1) % poly.length];
            a += poly[i][0] * q[1] - q[0] * poly[i][1];
        }
        return a / 2;
    }
    function nwInside(pt, poly) {
        var c = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1])) &&
                (pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c;
        }
        return c;
    }
    // polys: outlines (inches) of ONE shape (a path, or all sub-paths of a compound path)
    // returns { min: narrowest thickness found, thin: length of edge thinner than the limit } or null
    function nwShape(polys) {
        var L = SETTINGS.MIN_VINYL_WIDTH_INCHES;
        var areas = [], depth = [], i, j, totalArea = 0, totalPer = 0;
        for (i = 0; i < polys.length; i++) areas.push(nwPolyArea(polys[i]));
        for (i = 0; i < polys.length; i++) {
            var d = 0;
            for (j = 0; j < polys.length; j++) {
                if (i === j) continue;
                if (Math.abs(areas[j]) > Math.abs(areas[i]) && nwInside(polys[i][0], polys[j])) d++;
            }
            depth.push(d);
            totalArea += (d % 2 === 0 ? 1 : -1) * Math.abs(areas[i]);
            for (var q = 0; q < polys[i].length; q++) {
                var pa = polys[i][q], pb = polys[i][(q + 1) % polys[i].length];
                totalPer += Math.sqrt((pb[0] - pa[0]) * (pb[0] - pa[0]) + (pb[1] - pa[1]) * (pb[1] - pa[1]));
            }
        }
        if (totalArea <= 0 || totalPer <= 0) return null;
        if ((2 * totalArea) / totalPer >= SETTINGS.NARROW_SKIP_AVG_INCHES) return null;   // big plain piece

        // edges (long ones are cut into pieces <= L) + grid of cells of size L
        var edges = [], grid = {}, cell = L;
        for (i = 0; i < polys.length; i++) {
            var sgn = areas[i] >= 0 ? 1 : -1;
            if (depth[i] % 2 === 1) sgn = -sgn;        // holes: material is outside the hole
            var poly = polys[i];
            for (var e = 0; e < poly.length; e++) {
                var A = poly[e], B = poly[(e + 1) % poly.length];
                var dx = B[0] - A[0], dy = B[1] - A[1];
                var len = Math.sqrt(dx * dx + dy * dy);
                if (len < 1e-7) continue;
                var parts = Math.max(1, Math.ceil(len / L));
                for (var pp = 0; pp < parts; pp++) {
                    var a0 = [A[0] + dx * pp / parts, A[1] + dy * pp / parts];
                    var a1 = [A[0] + dx * (pp + 1) / parts, A[1] + dy * (pp + 1) / parts];
                    // inward normal: left of travel (-dy, dx) when sgn > 0, right when sgn < 0
                    var nx = (-dy / len) * sgn, ny = (dx / len) * sgn;
                    var ed = { x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1], nx: nx, ny: ny, len: len / parts };
                    var id = edges.length;
                    edges.push(ed);
                    var cx1 = Math.floor(Math.min(a0[0], a1[0]) / cell), cx2 = Math.floor(Math.max(a0[0], a1[0]) / cell);
                    var cy1 = Math.floor(Math.min(a0[1], a1[1]) / cell), cy2 = Math.floor(Math.max(a0[1], a1[1]) / cell);
                    for (var gx = cx1; gx <= cx2; gx++) for (var gy = cy1; gy <= cy2; gy++) {
                        var key = gx + "," + gy;
                        if (!grid[key]) grid[key] = [];
                        grid[key].push(id);
                    }
                }
            }
        }
        var stride = Math.max(1, Math.ceil(edges.length / 220));   // at most ~220 samples per shape
        var minT = 1e9, thin = 0, stamp = [], sCount = 0;
        for (var si = 0; si < edges.length; si += stride) {
            var ed2 = edges[si];
            var px = (ed2.x1 + ed2.x2) / 2, py = (ed2.y1 + ed2.y2) / 2;
            var best = 1e9;
            var gcx = Math.floor(px / cell), gcy = Math.floor(py / cell);
            sCount++;
            for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
                var lst = grid[(gcx + ox) + "," + (gcy + oy)];
                if (!lst) continue;
                for (var li = 0; li < lst.length; li++) {
                    var eid = lst[li];
                    if (eid === si || stamp[eid] === sCount) continue;
                    stamp[eid] = sCount;
                    var o = edges[eid];
                    var ex = o.x2 - o.x1, ey = o.y2 - o.y1;
                    var den = ed2.nx * ey - ed2.ny * ex;
                    if (Math.abs(den) < 1e-12) continue;
                    var ax = o.x1 - px, ay = o.y1 - py;
                    var t = (ax * ey - ay * ex) / den;
                    var u = (ax * ed2.ny - ay * ed2.nx) / den;
                    if (t > 1e-5 && t <= L && u >= 0 && u <= 1 && t < best) best = t;
                }
            }
            if (best < minT) minT = best;
            if (best < L) thin += ed2.len * stride;
        }
        if (minT >= 1e9) return { min: L, thin: 0 };
        return { min: minT, thin: thin };
    }
    function nwCollect(it, out, depthGuard) {
        try {
            if (it.hidden || depthGuard > 20) return;
            if (it.typename === "PathItem") {
                if (it.guides || it.clipping || !it.closed) return;
                var pl = nwFlatten(it);
                if (pl.length >= 3) out.push([pl]);
            } else if (it.typename === "CompoundPathItem") {
                var polys = [];
                for (var c = 0; c < it.pathItems.length; c++) {
                    var sp = it.pathItems[c];
                    var f = nwFlatten(sp);
                    if (f.length >= 3) polys.push(f);
                }
                if (polys.length) out.push(polys);
            } else if (it.typename === "GroupItem") {
                for (var g = 0; g < it.pageItems.length; g++) nwCollect(it.pageItems[g], out, depthGuard + 1);
            }
        } catch (e) {}
    }
    // source: "art" = the filled artwork is the vinyl (cut vinyl);
    //         "cut" = the CutContour shapes are the vinyl (print & cut: printed art isn't checked)
    function jNarrow(source) {
        return function () {
            var issues = [];
            var tops = getTop();
            var pieces = 0, shapesDone = 0, capped = false;
            for (var t = 0; t < tops.length; t++) {
                var tp = tops[t];
                if (source === "art" ? tp.kind !== "art" : tp.kind !== "cut") continue;
                pieces++;
                var shapes = [];
                nwCollect(tp.it, shapes, 0);
                var worst = null, narrowCount = 0;
                for (var sh = 0; sh < shapes.length; sh++) {
                    if (shapesDone >= SETTINGS.NARROW_MAX_SHAPES) { capped = true; break; }
                    shapesDone++;
                    var r = null;
                    try { r = nwShape(shapes[sh]); } catch (eS) { r = null; }
                    if (r && r.min < SETTINGS.MIN_VINYL_WIDTH_INCHES && r.thin >= SETTINGS.MIN_THIN_EDGE_INCHES) {
                        narrowCount++;
                        if (!worst || r.min < worst.min) worst = r;
                    }
                }
                if (worst) {
                    issues.push(mk("bad", "Narrow Vinyl", nameOf(tp.it),
                        "Narrowest part about " + f3(worst.min) + "in (minimum " + SETTINGS.MIN_VINYL_WIDTH_INCHES + "in)" +
                        (narrowCount > 1 ? ", " + narrowCount + " narrow shapes in this piece" : "") + ". Estimate, verify by eye.",
                        "pageItems", tp.idx));
                }
                if (capped) break;
            }
            if (capped) issues.push(mk("warn", "Narrow Vinyl", "Stopped early", "Only the first " + SETTINGS.NARROW_MAX_SHAPES + " shapes were measured", null, null));
            setInfo(plural(pieces, "piece") + " / " + plural(shapesDone, "shape") + " measured" +
                (source === "cut" ? " (CutContour shapes only, printed art is not checked)" : ""));
            return capRows(issues, "Narrow Vinyl");
        };
    }

    function jUndersized() {
        var issues = [];
        var minW = SETTINGS.MIN_ITEM_WIDTH_INCHES, minH = SETTINGS.MIN_ITEM_HEIGHT_INCHES;
        var tops = getArt();
        for (var t = 0; t < tops.length; t++) {
            try {
                var it = tops[t].it;
                if (it.locked) continue;
                var tb = tops[t].tb;
                var wIn = toIn(tb[2] - tb[0]), hIn = toIn(tb[1] - tb[3]);
                if (wIn > 0 && hIn > 0 && (wIn < minW || hIn < minH)) {
                    issues.push(mk("warn", "Undersized Item", nameOf(it),
                        f3(wIn) + " x " + f3(hIn) + "in (min " + minW + " x " + minH + "in)", "pageItems", tops[t].idx));
                }
            } catch (e) {}
        }
        return capRows(issues, "Undersized Item");
    }

    // Tiny islands inside compound paths (e.g. the dot of an "i")
    function jIslands() {
        var issues = [];
        var minW = SETTINGS.MIN_ITEM_WIDTH_INCHES, minH = SETTINGS.MIN_ITEM_HEIGHT_INCHES;
        var cps = doc.compoundPathItems;
        for (var i = 0; i < cps.length; i++) {
            try {
                var cp = cps[i];
                if (!inScope(cp)) continue;
                if (effHidden(cp)) continue;
                var subs = compoundSubs(cp);
                for (var s = 0; s < subs.length; s++) {
                    if (subs[s].depth % 2 !== 0) continue;
                    var wIn = toIn(subs[s].b[2] - subs[s].b[0]), hIn = toIn(subs[s].b[1] - subs[s].b[3]);
                    if (wIn < minW && hIn < minH) {
                        issues.push(mk("warn", "Tiny Island", nameOf(cp),
                            "Piece of " + f3(wIn) + " x " + f3(hIn) + "in, hard to weed/apply", "compoundPathItems", i));
                        break;
                    }
                }
            } catch (e) {}
        }
        return capRows(issues, "Tiny Island");
    }

    // Stroke-only artwork (a stroke doesn't cut) outside production layers
    function jStrokeOnly() {
        var issues = [];
        var groups = {}, order = [];
        var paths = doc.pathItems;
        for (var i = 0; i < paths.length; i++) {
            try {
                var p = paths[i];
                if (p.guides || p.clipping || p.filled || !p.stroked) continue;
                if (!inScope(p)) continue;
                if (effHidden(p) || onProdLayer(p)) continue;
                var ln = layerNameOf(p);
                if (!groups[ln]) { groups[ln] = { count: 0, idx: i }; order.push(ln); }
                groups[ln].count++;
            } catch (e) {}
        }
        for (var o = 0; o < order.length; o++) {
            var g = groups[order[o]];
            issues.push(mk("warn", "Stroke-Only", "Layer \"" + order[o] + "\" (" + g.count + ")",
                "Stroke with no fill: a stroke won't cut as a shape. Expand or fill it.", "pathItems", g.idx));
        }
        return issues;
    }

    // Optional tight-gap check (bounding boxes, not true shape distance)
    function jGaps() {
        if (!gapEnabled) return null;
        var tops = getArt();
        if (tops.length > SETTINGS.GAP_MAX_ITEMS) {
            return [mk("warn", "Tight Gap", "Too many items (" + tops.length + ")", "Gap check skipped above " + SETTINGS.GAP_MAX_ITEMS + " top-level items", null, null)];
        }
        var thr = inD(SETTINGS.MIN_GAP_INCHES);
        var issues = [];
        for (var i = 0; i < tops.length && issues.length < SETTINGS.MAX_ROWS; i++) {
            for (var j = i + 1; j < tops.length; j++) {
                var a = tops[i].tb, b = tops[j].tb;
                var dx = Math.max(b[0] - a[2], a[0] - b[2]);
                var dy = Math.max(a[3] - b[1], b[3] - a[1]);
                if (dx <= 0 && dy <= 0) continue;          // overlapping boxes
                var gap = (dx > 0 && dy > 0) ? Math.sqrt(dx * dx + dy * dy) : Math.max(dx, dy);
                if (gap > 0 && gap < thr) {
                    issues.push(mk("warn", "Tight Gap", nameOf(tops[i].it) + " / " + nameOf(tops[j].it),
                        f3(toIn(gap)) + "in between bounding boxes (min " + SETTINGS.MIN_GAP_INCHES + "in)", "pageItems", tops[i].idx));
                    if (issues.length >= SETTINGS.MAX_ROWS) break;
                }
            }
        }
        return issues;
    }

    // Art that reaches an artboard edge must run past it by the bleed amount
    function sideReport(ext, need, tol, side, out) {
        if (ext >= -tol && ext < need - tol) out.push(side + " " + f3(toIn(Math.max(ext, 0))) + "in");
    }
    function jEdgeBleed(inches) {
        return function () {
            var issues = [];
            var need = inD(inches), tol = 0.05;
            var tops = getArt();
            for (var a = 0; a < doc.artboards.length; a++) {
                if (scopeIdx >= 0 && a !== scopeIdx) continue;
                var r = doc.artboards[a].artboardRect;
                for (var t = 0; t < tops.length; t++) {
                    var tb = tops[t].tb;
                    if (!overlapsRect(tb, r)) continue;
                    var shortSides = [];
                    sideReport(r[0] - tb[0], need, tol, "left", shortSides);
                    sideReport(tb[2] - r[2], need, tol, "right", shortSides);
                    sideReport(tb[1] - r[1], need, tol, "top", shortSides);
                    sideReport(r[3] - tb[3], need, tol, "bottom", shortSides);
                    if (shortSides.length) {
                        issues.push(mk("bad", "Missing Bleed", nameOf(tops[t].it),
                            "Reaches the edge but runs past it by only: " + shortSides.join(", ") + " (needs " + inches + "in) on \"" + doc.artboards[a].name + "\"",
                            "pageItems", tops[t].idx));
                    }
                }
            }
            return capRows(issues, "Missing Bleed");
        };
    }
    // Printed + cut: art must run past the CutContour shape
    function jPrintBleed(inches) {
        return function () {
            var issues = [];
            var need = inD(inches), tol = 0.05;
            var tops = getTop();
            for (var a = 0; a < doc.artboards.length; a++) {
                if (scopeIdx >= 0 && a !== scopeIdx) continue;
                var r = doc.artboards[a].artboardRect;
                var cuts = [], arts = [];
                for (var t = 0; t < tops.length; t++) {
                    if (!overlapsRect(tops[t].tb, r)) continue;
                    if (tops[t].kind === "cut") cuts.push(tops[t]);
                    else if (tops[t].kind === "art") arts.push(tops[t]);
                }
                if (!cuts.length || !arts.length) continue;
                var cu = unionBounds(cuts), au = unionBounds(arts);
                var shortSides = [];
                sideReport(cu[0] - au[0], need, tol, "left", shortSides);
                sideReport(au[2] - cu[2], need, tol, "right", shortSides);
                sideReport(au[1] - cu[1], need, tol, "top", shortSides);
                sideReport(cu[3] - au[3], need, tol, "bottom", shortSides);
                if (shortSides.length) {
                    issues.push(mk("bad", "Missing Print Bleed", "Artboard \"" + doc.artboards[a].name + "\"",
                        "Art reaches the CutContour line but extends past it by only: " + shortSides.join(", ") + " (needs " + inches + "in)",
                        "artboard", a));
                }
            }
            return issues;
        };
    }

    // ---- Production-layer helpers --------------------------------------
    function isCutStroke(c) {
        try { return c.typename === "SpotColor" && isCutSpotName(c.spot.name) && c.tint >= 99.5; } catch (e) { return false; }
    }
    function isBlack100(c) {
        try {
            return c.typename === "CMYKColor" && Math.round(c.cyan) === 0 && Math.round(c.magenta) === 0 &&
                   Math.round(c.yellow) === 0 && Math.round(c.black) === 100;
        } catch (e) { return false; }
    }
    function isWhiteInkFill(c) {
        try { return c.typename === "SpotColor" && normName(c.spot.name) === "whiteink" && c.tint >= 99.5; } catch (e) { return false; }
    }
    function layersWithItems(test) {
        var out = [];
        walkLayers(doc.layers, function (ly) {
            try { if (test(ly.name) && layerHasScopedItem(ly)) out.push(ly); } catch (e) {}
        }, 0, 0);
        return out;
    }
    function layerExistsNamed(test) {
        var found = false;
        walkLayers(doc.layers, function (ly) { try { if (test(ly.name)) found = true; } catch (e) {} }, 0, 0);
        return found;
    }
    // Checks every path on layers matching `test` against `rule`:
    //   closed, stroke: "req"|"forbid", strokeOk(color), width1pt,
    //   fill: "req"|"forbid", fillOk(color); plus clipping masks and images on the layer.
    // Returns { n, first, order[], reasons{} }.
    function checkLayerPaths(test, rule) {
        var res = { n: 0, first: null, order: [], reasons: {} };
        function flag(why) {
            if (!res.reasons[why]) { res.reasons[why] = 0; res.order.push(why); }
            res.reasons[why]++;
        }
        var paths = doc.pathItems;
        for (var i = 0; i < paths.length; i++) {
            try {
                var p = paths[i];
                if (p.guides || p.clipping) continue;
                if (!inScope(p)) continue;
                if (!onLayerWhere(p, test) || effHidden(p)) continue;
                res.n++;
                if (res.first === null) res.first = i;
                if (rule.closed && !p.closed) flag("open path");
                if (rule.stroke === "req") {
                    if (!p.stroked) flag("no stroke");
                    else {
                        if (rule.strokeOk && !rule.strokeOk(p.strokeColor)) flag(rule.strokeMsg);
                        if (rule.width1pt && Math.abs(p.strokeWidth * sf - 1) > 0.01) flag("stroke is not 1 pt");
                    }
                } else if (rule.stroke === "forbid" && p.stroked) flag("has a stroke");
                if (rule.fill === "req") {
                    if (!p.filled) flag("no fill");
                    else if (rule.fillOk && !rule.fillOk(p.fillColor)) flag(rule.fillMsg);
                } else if (rule.fill === "forbid" && p.filled) flag("has a fill");
            } catch (e) {}
        }
        var groups = doc.groupItems;
        for (var g = 0; g < groups.length; g++) {
            try { if (groups[g].clipped && inScope(groups[g]) && onLayerWhere(groups[g], test) && !effHidden(groups[g])) flag("clipping mask"); } catch (eG) {}
        }
        var imgs = [doc.rasterItems, doc.placedItems];
        for (var c = 0; c < imgs.length; c++) {
            for (var k = 0; k < imgs[c].length; k++) {
                try { if (inScope(imgs[c][k]) && onLayerWhere(imgs[c][k], test) && !effHidden(imgs[c][k])) flag("image"); } catch (eI) {}
            }
        }
        return res;
    }
    function reasonsToIssues(res, label, layerLabel, issues) {
        for (var o = 0; o < res.order.length; o++) {
            var why = res.order[o];
            issues.push(mk("bad", label, res.reasons[why] + " item(s) on the " + layerLabel + " layer",
                why.charAt(0).toUpperCase() + why.substr(1), res.first !== null ? "pathItems" : null, res.first));
        }
    }

    // CutContour: layer + spot color (100% M) + stroke / structure rules
    function jCutContour(mode) {
        return function () {
            var issues = [];
            var usedElsewhere = 0;
            var paths = doc.pathItems;
            for (var i = 0; i < paths.length; i++) {
                try {
                    var p = paths[i];
                    if (p.guides || p.clipping || onLayerWhere(p, isCutLayerName)) continue;
                    if (!inScope(p)) continue;
                    var c1 = p.stroked ? p.strokeColor : null, c2 = p.filled ? p.fillColor : null;
                    if ((c1 && c1.typename === "SpotColor" && isCutSpotName(c1.spot.name)) ||
                        (c2 && c2.typename === "SpotColor" && isCutSpotName(c2.spot.name))) usedElsewhere++;
                } catch (e) {}
            }
            var layerExists = layerExistsNamed(isCutLayerName);
            var res = checkLayerPaths(isCutLayerName, {
                closed: true, stroke: "req", strokeOk: isCutStroke,
                strokeMsg: "Stroke isn't the " + SETTINGS.CUT_SPOT_NAME + " spot color at 100%", width1pt: true
            });
            var spotFound = null;
            try {
                for (var sp = 0; sp < doc.spots.length; sp++) {
                    if (isCutSpotName(doc.spots[sp].name)) { spotFound = doc.spots[sp]; break; }
                }
            } catch (eS) {}

            if (mode === "no") {
                if (res.n > 0 || usedElsewhere > 0) {
                    issues.push(mk("warn", "CutContour", "CutContour present",
                        "The specs sheet says this sign type takes no CutContour", res.first !== null ? "pathItems" : null, res.first));
                }
                return issues;
            }
            if (!layerExists) issues.push(mk("bad", "CutContour", "No CutContour layer", "Add a layer named CutContour with the cut path", null, null));
            else if (res.n === 0) issues.push(mk("bad", "CutContour", "CutContour layer is empty", "Nothing on the CutContour layer", null, null));
            if (!spotFound) {
                issues.push(mk("bad", "CutContour", "No spot color named " + SETTINGS.CUT_SPOT_NAME, "Spot color is missing from the Swatches panel", null, null));
            } else {
                try {
                    var sc = spotFound.color;
                    if (sc.typename === "CMYKColor") {
                        if (sc.magenta < 99.5 || sc.cyan > 0.5 || sc.yellow > 0.5 || sc.black > 0.5) {
                            issues.push(mk("bad", "CutContour", spotFound.name,
                                "Spot is C" + Math.round(sc.cyan) + " M" + Math.round(sc.magenta) + " Y" + Math.round(sc.yellow) + " K" + Math.round(sc.black) + ", must be 100% M only", null, null));
                        }
                    } else {
                        issues.push(mk("warn", "CutContour", spotFound.name, "Spot isn't defined in CMYK, can't verify 100% M", null, null));
                    }
                } catch (eC) {}
            }
            reasonsToIssues(res, "CutContour", "CutContour", issues);
            if (usedElsewhere > 0) issues.push(mk("warn", "CutContour", usedElsewhere + " path(s) outside the CutContour layer",
                "Using the " + SETTINGS.CUT_SPOT_NAME + " spot color, they'd cut", null, null));
            return issues;
        };
    }

    // Outline / Holes / White Ink layers. Outline is required when the sign type
    // needs it; Holes and White Ink are only checked when their layer exists.
    // Returns null (row shows "not run") when none of them applies.
    function jProdLayers(needOutline) {
        return function () {
            var issues = [];
            var any = false;
            var blackRule = { closed: true, stroke: "req", strokeOk: isBlack100, strokeMsg: "Stroke isn't 100% black (C0 M0 Y0 K100)", width1pt: true };
            var specs = [
                { label: "Outline", test: isOutlineLayerName, required: needOutline, rule: blackRule },
                { label: "Holes", test: isHolesLayerName, required: false, rule: blackRule },
                { label: "White Ink", test: isWhiteInkLayerName, required: false,
                  rule: { closed: true, fill: "req", fillOk: isWhiteInkFill, fillMsg: "Fill isn't the White Ink spot color at 100%", stroke: "forbid" } }
            ];
            for (var s = 0; s < specs.length; s++) {
                var sp = specs[s];
                var present = layersWithItems(sp.test).length > 0;
                if (!present && !sp.required) continue;
                any = true;
                if (!present) {
                    // The Outline is the cut path of the sign body and normally lives in a
                    // separate production file, so a missing one is only a warning.
                    var hasBBox = layersWithItems(isBBoxLayerName).length > 0;
                    issues.push(mk("warn", sp.label, "No " + sp.label + " layer",
                        hasBBox ? "BoundingBox is present, so the " + sp.label + " (cut path) is probably made in the separate production file"
                                : "No " + sp.label + " layer in this file. If this is the production file, it needs one (closed paths, 1 pt, 100% black)", null, null));
                    continue;
                }
                reasonsToIssues(checkLayerPaths(sp.test, sp.rule), sp.label, sp.label, issues);
            }
            return any ? issues : null;
        };
    }

    // BoundingBox: the sign's format shape on its own layer
    //   "nostroke": required; no fill and no stroke, anything else is wrong
    //   "stroke":   required; clean is fine, a 100% K stroke / fill is a warning
    //               (banners can carry one), any other stroke color is wrong
    //   "no":       not used by this sign type
    function jBBox(mode) {
        return function () {
            var issues = [];
            var n = 0, withFill = 0, withStroke = 0, blackStroke = 0, otherStroke = 0, firstIdx = null;
            var paths = doc.pathItems;
            for (var i = 0; i < paths.length; i++) {
                try {
                    var p = paths[i];
                    if (p.guides || p.clipping) continue;
                    if (!inScope(p)) continue;
                    if (!onLayerWhere(p, isBBoxLayerName)) continue;
                    n++;
                    if (firstIdx === null) firstIdx = i;
                    if (p.filled) withFill++;
                    if (p.stroked) {
                        withStroke++;
                        if (isBlack100(p.strokeColor)) blackStroke++; else otherStroke++;
                    }
                } catch (e) {}
            }
            if (mode === "no") {
                if (n > 0) issues.push(mk("warn", "BoundingBox", "BoundingBox present", "The specs sheet says this sign type takes no BoundingBox", "pathItems", firstIdx));
                return issues;
            }
            if (n === 0) {
                issues.push(mk("bad", "BoundingBox", "No BoundingBox", "Needs a layer named BoundingBox with the sign's format shape", null, null));
                return issues;
            }
            if (mode === "nostroke") {
                if (withFill > 0 || withStroke > 0) {
                    issues.push(mk("bad", "BoundingBox", "BoundingBox has " + (withFill > 0 ? "a fill" : "") + (withFill > 0 && withStroke > 0 ? " and " : "") + (withStroke > 0 ? "a stroke" : ""),
                        "Must have no fill and no stroke", "pathItems", firstIdx));
                }
            } else if (mode === "stroke") {
                if (otherStroke > 0) {
                    issues.push(mk("bad", "BoundingBox", "BoundingBox stroke isn't 100% black", "A stroked BoundingBox must be C0 M0 Y0 K100", "pathItems", firstIdx));
                } else if (blackStroke > 0 || withFill > 0) {
                    issues.push(mk("warn", "BoundingBox", "BoundingBox has a 100% K " + (blackStroke > 0 ? "stroke" : "fill"),
                        "Allowed for some banners, check it's intended", "pathItems", firstIdx));
                }
            }
            return issues;
        };
    }

    function isGrommetLayerName(n) { return normName(n).indexOf("grommet") >= 0; }
    function isBrailleLayerName(n) { return normName(n).indexOf("braille") >= 0; }
    // Banners: grommets are upon request. A Grommets layer = OK, none = check with the client.
    function jGrommets() {
        if (layersWithItems(isGrommetLayerName).length > 0) { setInfo("Grommets layer found"); return []; }
        return [mk("warn", "Grommets", "No Grommets layer", "Grommets are upon request for banners. Check if the client needs them.", null, null)];
    }
    // ADA: braille uses a 1 pt outline. A Braille layer is needed if the sign has braille.
    function jBraille() {
        var layers = layersWithItems(isBrailleLayerName);
        if (layers.length === 0) {
            return [mk("warn", "Braille", "No Braille layer", "Check if braille is needed on this sign. If it is, it goes on a layer named Braille with a 1 pt outline.", null, null)];
        }
        var issues = [], count = 0, bad = 0, firstBad = null;
        var paths = doc.pathItems;
        for (var i = 0; i < paths.length; i++) {
            try {
                var p = paths[i];
                if (p.guides || p.clipping || effHidden(p)) continue;
                if (!inScope(p)) continue;
                if (!onLayerWhere(p, isBrailleLayerName)) continue;
                count++;
                var sw = p.strokeWidth * sf;
                if (!p.stroked || Math.abs(sw - 1) > 0.01) { bad++; if (firstBad === null) firstBad = i; }
            } catch (e) {}
        }
        if (bad > 0) issues.push(mk("warn", "Braille", "Braille layer (" + bad + " path" + (bad > 1 ? "s" : "") + ")", "Braille needs a 1 pt outline", "pathItems", firstBad));
        setInfo(plural(count, "braille path") + " checked");
        return issues;
    }

    // Routed elements: 1 pt outline
    function jRouted() {
        var issues = [];
        var groups = {}, order = [];
        var paths = doc.pathItems;
        for (var i = 0; i < paths.length; i++) {
            try {
                var p = paths[i];
                if (p.guides || p.clipping || effHidden(p)) continue;
                if (!inScope(p)) continue;
                if (!onLayerWhere(p, isRoutedLayerName)) continue;
                var sw = p.strokeWidth * sf;
                if (!p.stroked || Math.abs(sw - 1) > 0.01) {
                    var ln = layerNameOf(p);
                    if (!groups[ln]) { groups[ln] = { count: 0, idx: i }; order.push(ln); }
                    groups[ln].count++;
                }
            } catch (e) {}
        }
        for (var o = 0; o < order.length; o++) {
            issues.push(mk("warn", "Routed Outline", "Layer \"" + order[o] + "\" (" + groups[order[o]].count + ")",
                "Routed elements need a 1 pt outline", "pathItems", groups[order[o]].idx));
        }
        return issues;
    }

    function jNotes(notes) {
        return function () {
            var issues = [];
            for (var i = 0; i < notes.length; i++) issues.push(mk("warn", "Sheet Note", curType ? curType.label : "Note", notes[i], null, null));
            return issues;
        };
    }

    // ---- Registry ---------------------------------------------------
    var STANDARD = [
        { label: "Image DPI", fn: checkDPI },
        { label: "Unused Swatches", fn: checkSwatches, fix: "swatches" },
        { label: "Named Colors", fn: checkColors, labelTool: true },
        { label: "Text (live / fonts)", fn: checkText },
        { label: "File Color Mode", fn: checkColorMode },
        { label: "Open Paths", fn: checkOpenPaths },
        { label: "Clipping Masks", fn: checkClipping },
        { label: "External Links", fn: checkLinks }
    ];

    // ---- Sign types: read from the shared Sign_Types file (same folder as this script)
    var typesPath = (JOBMODE && $.global.__PF_JOB && $.global.__PF_JOB.self) ? $.global.__PF_JOB.self : SELF_PATH;
    var ST = loadSignTypes(typesPath, "Preflight Check", JOBMODE);
    if (!ST) {
        if (JOBMODE) { $.global.__PF_JOB = null; $.global.__PF_RESULT = "({nodoc:true})"; }
        return;
    }
    var SIGN_TYPES = ST.types;
    var DEFAULT_TYPE = ST.defaultType;
    var SIGN_TYPES_VERSION = ST.version + (ST.source === "jsx" ? " (.jsx backup)" : "");
    // Client profiles: Clients_x.x.json next to this script (built-in standard profiles if it is missing).
    CLIENTS = loadClients(typesPath, "preflight", JOBMODE).clients;
    // The sign type as the picked client wants it (standard entry + the client's changes).
    function typeAt(i) { return applyClientToType(SIGN_TYPES[i], CURRENT_CLIENT); }

    // ---- Layer spec (the layers each sign type needs) ----------------------
    function rgbNear(a, b) {
        return !!(a && b) && Math.abs(a[0] - b[0]) <= 3 && Math.abs(a[1] - b[1]) <= 3 && Math.abs(a[2] - b[2]) <= 3;
    }
    function specRGB(colorName) {
        var c = ST.colors ? ST.colors[colorName] : null;
        return (c && c.length === 3) ? c : null;
    }
    function layerRGB(ly) {
        try { var c = ly.color; return [Math.round(c.red), Math.round(c.green), Math.round(c.blue)]; } catch (e) { return null; }
    }
    function rgbText(c) { return c ? ("RGB " + c[0] + ", " + c[1] + ", " + c[2]) : "unknown"; }
    function colorNameOfRGB(c) {
        if (!c) return "unknown";
        for (var k in ST.colors) if (rgbNear(c, ST.colors[k])) return k;
        return rgbText(c);
    }
    function lev(a, b) {
        var m = a.length, n = b.length, d = [], i, j;
        for (i = 0; i <= m; i++) { d[i] = [i]; }
        for (j = 1; j <= n; j++) d[0][j] = j;
        for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
            var cost = (a.charAt(i - 1) === b.charAt(j - 1)) ? 0 : 1;
            var v = d[i - 1][j] + 1, w = d[i][j - 1] + 1, x = d[i - 1][j - 1] + cost;
            d[i][j] = Math.min(v, Math.min(w, x));
        }
        return d[m][n];
    }
    function allLayersList() {
        var out = [];
        walkLayers(doc.layers, function (ly) { out.push(ly); }, 0, 0);
        return out;
    }
    // How one spec layer is present in the file: { ly, how: "exact"|"case"|"near"|"missing" }
    function matchSpecLayer(spec, layers) {
        var want = normName(spec.name), best = null, bestD = 99;
        for (var i = 0; i < layers.length; i++) {
            var nm = "";
            try { nm = layers[i].name; } catch (e) { continue; }
            if (nm === spec.name) return { ly: layers[i], how: "exact" };
        }
        for (var j = 0; j < layers.length; j++) {
            try { if (normName(layers[j].name) === want) return { ly: layers[j], how: "case" }; } catch (e2) {}
        }
        for (var k = 0; k < layers.length; k++) {
            try {
                var n2 = normName(layers[k].name);
                if (n2 === "") continue;
                var dist = lev(n2, want);
                var close = (dist <= 2 && dist < want.length - 1) || (n2.length >= 4 && want.indexOf(n2) === 0) || (want.length >= 4 && n2.indexOf(want) === 0);
                if (close && dist < bestD) { bestD = dist; best = layers[k]; }
            } catch (e3) {}
        }
        if (best) return { ly: best, how: "near" };
        return { ly: null, how: "missing" };
    }
    // Layers of the sign type: missing, misnamed or the wrong colour. The whole file is checked
    // (layers belong to the file, not to an artboard or a selection).
    function jLayers(t) {
        return function () {
            var issues = [];
            var layers = allLayersList(), used = {};
            for (var i = 0; i < t.layers.length; i++) {
                var spec = t.layers[i];
                var m = matchSpecLayer(spec, layers);
                if (m.how === "missing") {
                    issues.push(mk("bad", "Layers", "\"" + spec.name + "\"", "Layer is missing (colour " + spec.color + ")", null, null));
                    continue;
                }
                var cur = "";
                try { cur = m.ly.name; } catch (eN) {}
                if (m.how === "near") issues.push(mk("bad", "Layers", "\"" + cur + "\"", "Looks like a misspelled \"" + spec.name + "\" - rename it to \"" + spec.name + "\"", null, null));
                else if (m.how === "case") issues.push(mk("warn", "Layers", "\"" + cur + "\"", "Name differs in capitals / spaces from \"" + spec.name + "\"", null, null));
                var want = specRGB(spec.color), have = layerRGB(m.ly);
                if (want && have && !rgbNear(want, have))
                    issues.push(mk("bad", "Layers", "\"" + cur + "\"", "Layer colour is " + colorNameOfRGB(have) + ", should be " + spec.color, null, null));
            }
            if (t.layers.length === 0) return null;
            setInfo(t.layers.length + " layer" + (t.layers.length === 1 ? "" : "s") + " in the spec", "");
            return issues;
        };
    }
    function topLayerOf(ly) {
        var p = ly, g = 0;
        while (p && g++ < 60) {
            try { if (p.parent && p.parent.typename === "Document") return p; p = p.parent; } catch (e) { break; }
        }
        return ly;
    }
    // Top-level layers that are not in the spec (any layer with "design" in its name is allowed).
    // Everything on them is deleted by the fix. Checked for the whole file.
    function jExtraLayers(t) {
        return function () {
            var issues = [], keep = {}, all = allLayersList();
            for (var i = 0; i < t.layers.length; i++) {
                var m = matchSpecLayer(t.layers[i], all);
                if (m.ly) { try { keep[topLayerOf(m.ly).name] = true; } catch (e0) {} }
            }
            for (var j = 0; j < doc.layers.length; j++) {
                var ly = doc.layers[j], nm = "";
                try { nm = ly.name; } catch (e1) { continue; }
                if (keep[nm] || normName(nm).indexOf("design") >= 0) continue;
                var n = 0;
                try { n = ly.pageItems.length; } catch (e2) {}
                issues.push(mk("bad", "Extra Layers", "\"" + nm + "\"", "Not in the spec for this sign type (" + n + " item" + (n === 1 ? "" : "s") + " on it) - the fix deletes the layer and everything on it", null, null));
            }
            return issues;
        };
    }
    function elementOk(kind) {
        if (kind === "black") return function (c) { return isBlack100(c); };
        return function (c) {
            if (isCutStroke(c)) return true;
            try { return c.typename === "CMYKColor" && Math.round(c.cyan) === 0 && Math.round(c.magenta) === 100 && Math.round(c.yellow) === 0 && Math.round(c.black) === 0; } catch (e) { return false; }
        };
    }
    function elementMsg(kind) { return kind === "black" ? "stroke is not 100% black" : "stroke is not 100% magenta / CutContour spot"; }
    // Art on the spec layers that has a stroke / colour rule (1 pt, 100% black or magenta). Free layers are not checked.
    function jLayerArt(t) {
        return function () {
            var issues = [], any = false;
            var layers = allLayersList();
            for (var i = 0; i < t.layers.length; i++) {
                var spec = t.layers[i];
                if (!spec.stroke && !spec.element) continue;
                var m = matchSpecLayer(spec, layers);
                if (m.how === "missing") continue;
                any = true;
                var target = normName(m.ly.name);
                var rule = { stroke: "req", width1pt: !!spec.stroke, strokeOk: spec.element ? elementOk(spec.element) : null, strokeMsg: spec.element ? elementMsg(spec.element) : "" };
                var res = checkLayerPaths(function (n) { return normName(n) === target; }, rule);
                reasonsToIssues(res, "Layer Art", spec.name, issues);
            }
            if (!any) return null;
            return issues;
        };
    }

    function buildChecks(t) {
        var list = [];
        if (t.notes && t.notes.length) list.push({ label: "Sheet Notes", fn: jNotes(t.notes) });
        list.push({ label: "Layers", fn: jLayers(t), fix: "layers" });
        list.push({ label: "Extra Layers", fn: jExtraLayers(t), fix: "extralayers" });
        list.push({ label: "Layer Art (stroke / colour)", fn: jLayerArt(t), fix: "layerart" });
        list.push({ label: "Hairline Strokes", fn: jHairlines });
        list.push({ label: "Stacked Duplicates", fn: jDuplicates("warn") });
        list.push({ label: "Items Off Artboard", fn: jOutside });
        list.push({ label: "Artboard Size", fn: jArtboardSize });
        return list;
    }

    // ---- Scan -------------------------------------------------------
    function worst(issues) {
        var s = "ok";
        for (var i = 0; i < issues.length; i++) {
            if (issues[i].sev === "bad") return "bad";
            if (issues[i].sev === "warn") s = "warn";
        }
        return s;
    }
    // ---- Ignored rows (per file, remembered) ----
    var lastMeta = { docName: "", docKey: "unsaved", docPath: "", artNames: [], nObjs: 0 };
    function docKeyNow() {
        if (!JOBMODE) return lastMeta.docKey;
        var k = "";
        try { k = doc.fullName.fsName; } catch (e) { try { k = doc.name; } catch (e2) { k = "unsaved"; } }
        return k;
    }
    var ignoredMap = {};
    function ignoreKey(label) {
        return docKeyNow() + "::" + label;
    }
    function loadIgnored() {
        ignoredMap = {};
        var raw = "";
        try { raw = app.preferences.getStringPreference("signpack/preflight/ignored") || ""; } catch (e) {}
        if (raw === "") return;
        var parts = raw.split("||");
        for (var i = 0; i < parts.length; i++) if (parts[i] !== "") ignoredMap[parts[i]] = true;
    }
    function saveIgnored() {
        var arr = [];
        for (var k in ignoredMap) if (ignoredMap[k]) arr.push(k);
        if (arr.length > 300) arr = arr.slice(arr.length - 300);
        try { app.preferences.setStringPreference("signpack/preflight/ignored", arr.join("||")); } catch (e) {}
    }
    function isIgnored(label) { return ignoredMap[ignoreKey(label)] === true; }

    function runOne(def) {
        var res = { label: def.label, status: "ok", issues: [], info: "", badge: "", fix: def.fix || null, fixDefault: def.fixDefault || null, labelTool: def.labelTool || false, ignored: false };
        if (isIgnored(def.label)) {
            res.status = "off"; res.ignored = true;
            res.info = "Ignored by you for this file. Select this row and press Unignore Row to check it again.";
            return res;
        }
        setInfo("", "");
        try {
            var out = def.fn();
            res.info = infoNote; res.badge = infoBadge;
            if (out === null) { res.status = "off"; return res; }
            res.issues = out;
            res.status = worst(out);
            if (res.status === "ok" && res.info === "") res.info = "Checked, no problems found";
        } catch (e) {
            res.status = "warn";
            res.issues = [mk("warn", def.label, "This check could not run", "" + e + (e && e.line ? " (line " + e.line + ")" : ""), null, null)];
        }
        return res;
    }

    var stdResults = [], jobResults = [];
    function scanStandard() {
        stdResults = [];
        for (var i = 0; i < STANDARD.length; i++) {
            if (!modeAllows("std", STANDARD[i].label)) continue;
            stdResults.push(runOne(STANDARD[i]));
        }
    }
    function scanJob() {
        jobResults = [];
        var defs = buildChecks(curType);
        for (var i = 0; i < defs.length; i++) {
            if (!modeAllows("job", defs[i].label)) continue;
            jobResults.push(runOne(defs[i]));
        }
    }

    if (JOBMODE) {
        var JB = $.global.__PF_JOB;
        $.global.__PF_JOB = null;
        var JO = {};
        try {
            for (var jc = 0; jc < CLIENTS.length; jc++) if (CLIENTS[jc].label === JB.client) applyClientSettings(CLIENTS[jc]);
            scopeIdx = JB.scopeIdx;
            gapEnabled = JB.gap;
            curType = typeAt(JB.typeIdx);
            refreshDoc();
            loadIgnored();
            JO.docName = "";
            try { JO.docName = doc.name; } catch (eJ1) {}
            JO.docKey = docKeyNow();
            JO.docPath = "";
            try { if (doc.saved) JO.docPath = doc.fullName.path; } catch (eJ2) {}
            JO.artNames = [];
            try { for (var ja = 0; ja < doc.artboards.length; ja++) JO.artNames.push(String(doc.artboards[ja].name)); } catch (eJ3) {}
            JO.nObjs = 0;
            try { JO.nObjs = doc.pageItems.length; } catch (eJ4) {}
            if (!JB.jobOnly) scanStandard();
            scanJob();
            JO.scopeIdx = scopeIdx;
            JO.scopeRect = scopeRect;
            JO.selCount = selCount;
            JO.unused = unusedSwatchNames;
            var jall = (JB.jobOnly ? [] : stdResults).concat(jobResults);
            for (var jr = 0; jr < jall.length; jr++)
                for (var ji = 0; ji < jall[jr].issues.length; ji++) jall[jr].issues[ji].ab = artboardLabelDoc(jall[jr].issues[ji]);
            JO.std = JB.jobOnly ? null : stdResults;
            JO.job = jobResults;
        } catch (eJob) {
            JO = { error: "" + eJob + (eJob && eJob.line ? " (line " + eJob.line + ")" : "") };
        }
        // toSource() leaves some characters raw (line / paragraph separators and other
        // control characters, common in live text and object names). eval() on the
        // palette side then fails with "Unterminated string constant", so escape them.
        $.global.__PF_RESULT = JO.toSource().replace(/[\u0000-\u001f\u2028\u2029]/g, function (ch) {
            return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
        });
        return;
    }

    // ============================================================
    //  UI
    // ============================================================
    var POPUP_DEFS = uik().popupDefs;


    var ICON_DATA = {
        ok: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x14\x00\x00\x00\x14\x08\x06\x00\x00\x00\x8d\x89\x1d\x0d\x00\x00\x03\xeb\x49\x44\x41\x54\x78\xda\x8d\x94\x6d\x68\x96\x65\x14\xc7\x7f\xe7\x5c\xf7\xfd\xec\xd5\xbd\x69\x58\x26\x42\x94\x5a\x73\x53\x73\x29\x99\x91\x09\x92\x1f\xb6\xa6\x64\x8f\x66\x41\x89\x89\xf8\xa9\x42\xfa\x92\x14\xd3\x40\x23\xfa\x60\x81\x42\x85\x52\xf6\x82\xb5\xc5\x9a\x2f\x13\x61\x7d\x29\xc2\x32\xec\x45\x47\x2b\xa5\x32\x43\x6b\xbe\xcd\xb9\xf6\xf6\x3c\xcf\x7d\x5d\xa7\x0f\x73\xba\x4d\x90\xce\xb7\xeb\x5c\xe7\xff\xe3\xc0\x39\xe7\x0f\x63\xa3\xa1\x41\x31\x64\x64\xaa\xfa\x40\x6d\x79\xe5\xa1\x74\x05\x66\xa3\xf2\x58\x83\x8e\x95\x8f\x2e\x68\x4c\x3b\x56\x34\xf9\x21\x48\xfd\x62\x75\x3c\x81\xb7\x39\x16\x6c\x92\x21\xa2\xca\x39\x22\xf7\x13\xde\x9a\x8f\xd5\xee\x6d\x01\x48\x37\xa6\x5d\xd3\x55\xcd\x28\xe0\xf0\xc7\x3d\x9f\xd5\x4e\x8d\x8b\xa2\xed\xea\xf4\x11\x89\x15\xcb\x7a\xcc\xdb\x50\xb1\x13\x24\x56\x30\x08\x59\x7f\x84\x81\xe4\xb9\x63\x8f\xb5\x7e\x37\x12\x2a\xd7\x5a\x97\xcd\xa1\xaa\xb9\x6e\xa1\x2b\x72\xcd\x1a\xb9\x8a\xa4\x37\x1b\x40\x82\x88\x29\x26\x43\x75\x62\x66\x86\x09\xe0\x0a\x63\x17\x82\x65\xac\x37\xb7\xfa\xf8\xf2\xd6\x4f\x86\xa1\x42\x43\x83\xb2\x69\xb3\x55\xb7\xd6\xde\x21\xea\x7e\x50\xd5\x52\x3f\x98\x24\xa2\x12\x71\x93\x30\x23\x71\x91\x46\xa6\x84\x90\x0d\x0b\xda\x97\xee\xff\x96\xc6\xb4\x53\x36\x01\x82\xe1\x65\xa7\xcb\x8b\xfe\x17\x2c\x58\xc0\x24\x44\x7d\x99\x7e\xaf\x4e\x15\x6c\x77\xcd\xd1\x75\x31\xe9\xa6\xa0\xc8\xe6\x30\xab\xa5\x7e\x91\x2b\x8c\x17\xf9\xbe\xac\xbf\x19\x2c\x12\xc7\xe5\xec\x15\x5e\xa8\x5c\xcd\xae\xf9\x5b\x99\x5c\x34\xd1\x65\xfa\x33\x49\x5c\x92\x3f\x2d\xf7\x4f\xe7\x2a\x04\x53\x00\xd3\xf0\xb4\x44\x6a\x66\x62\x00\x2a\x8a\xca\xe8\x05\x88\x34\xe2\x42\xa6\x8b\xb5\x53\x57\xf0\xec\x5d\x8f\x33\x6f\xc2\x4c\x66\x57\x54\x32\x18\x32\x22\x01\x33\x0b\xcf\x00\x0c\xef\xdc\x1c\xcb\x7a\x41\x4c\x9d\x28\x7d\x49\x3f\x03\x49\x06\x27\x8a\x61\x44\x1a\x71\x71\xb0\x8b\xe5\x53\x96\xb0\xb1\x7a\x3d\x00\x6f\xfc\xbc\x93\x96\xbf\xbe\xa0\x24\x2a\xd6\x24\x93\x13\x4c\x2a\x6b\xda\xd2\xa5\x5a\xdd\xfa\x64\x99\x99\xdc\x6a\xde\x88\x70\x72\x29\xd3\xcd\x43\x13\xe7\x72\x6f\x45\x25\x97\xb3\x3d\x14\xb8\x7c\xba\x32\xdd\x2c\x9c\x38\x8f\x2d\x73\x36\x10\x89\xe3\x83\xdf\x5b\xd8\xf1\xeb\xc7\x94\xa6\xc6\x11\x08\x98\x37\x44\xa8\x08\x99\xdc\x24\xf5\x51\x4e\x00\x51\x11\x7a\x93\x7e\x16\xdf\xb6\x80\x9d\xf3\xb7\xb0\xe3\xfe\x06\x66\x96\x4f\xe7\x74\xdf\x59\xaa\xcb\xa7\xb3\x6d\xee\x46\x0a\x5d\x3e\x07\xcf\x7e\xc9\xab\xc7\xb7\x53\x96\x2a\xc1\xcc\xae\x4f\x1d\x24\x78\xaf\xda\xd1\xc3\x15\xc4\x2e\x88\x0a\x2a\x6a\x7d\x49\x3f\x97\x32\xdd\x54\xa4\x4a\xd9\x35\x7f\x2b\xb5\xb7\x3f\xcc\x9b\xf7\x6d\x64\x7c\x5e\x19\x47\x2e\x1e\xe3\xc5\xa3\xaf\x53\x18\x15\x5c\x85\xd8\x10\xc9\x09\x40\x77\xc6\xbb\x4e\x01\xa8\xde\x57\xb7\x27\x2a\x4e\xad\xb4\x5e\xef\xbb\x73\x3d\x51\x55\xd9\x34\xde\x7b\xe0\x35\x26\xe4\x97\x5f\xeb\xe0\x44\xcf\x29\x56\x7d\xb5\x81\x6c\xc8\x12\x6b\x4c\xb0\x30\x0c\xf5\x51\x41\xac\xc9\x40\xee\x70\x7b\xfd\x81\x07\x87\x8e\x3b\xe8\x1e\x0c\xf1\x96\x48\x45\x5e\x19\x1d\x57\x7e\x63\xcd\xe1\x97\x38\x37\x78\x09\x80\xbf\x07\xce\xb3\xee\x9b\x57\x18\xf0\x83\xa4\x46\xc0\x86\xb4\x62\xc4\x2a\x62\xf2\x29\x80\xa3\xa1\x41\xcf\xaf\x7f\xf7\xc4\x2d\xed\x77\xd6\xbb\xc2\xd4\xa4\x24\x9b\xf5\x45\x71\x81\x9e\xe9\xef\xe4\xeb\xf3\xdf\x83\x08\x6f\x75\xec\xe6\x64\xcf\x29\x8a\xa3\x22\xfc\x08\x98\x99\x05\xcd\x73\xea\x07\x72\x9d\x92\x9f\x59\x73\xee\xc3\x3f\x12\x4d\xcf\xe8\x10\x04\x43\x58\x6b\x49\xc8\xa9\x73\x9a\xf3\x39\x5f\x12\x17\xf3\x67\xef\x19\x5e\xfe\x71\x1b\xed\xdd\x27\x19\x17\x17\xe3\xcd\x8f\xbc\xbd\x20\x2a\xa6\x29\x95\x60\xb2\xee\xf8\x92\xb6\xbe\x74\x53\x5a\x65\xa4\xd3\xcc\xf8\xbc\x6e\x65\x54\x10\x7d\x24\x42\xe4\x07\x7d\xa2\x82\x28\xaa\x01\xbb\x36\x00\xc4\x82\x99\x98\xa6\x34\xd2\x58\x49\x7a\x73\x1b\xda\x97\x1d\xd8\x76\xdd\x1c\xc6\xd8\xd7\xac\xbd\x8f\x2e\x20\xa5\x6f\x6b\x9e\xab\x22\x18\x21\x1b\xae\xda\x97\x21\x4e\x91\x58\x91\x48\x09\x83\xc9\xe9\x90\x0d\xcf\xb7\x2f\xdd\xbf\xf7\x46\xfb\x1a\x03\xad\x79\xa7\x26\x4e\xa6\x4c\x7e\xca\x82\xad\xc2\x98\x41\xb0\x09\x06\x2a\x2a\x5d\x28\xbf\x80\x34\x67\xb2\xf6\xfe\x89\x65\xfb\xfe\x1d\x6b\xb0\x37\x46\x63\xda\x8d\x7c\xd6\xb4\xa5\x4b\xab\x0e\xd5\xdd\x3d\xfb\x60\x7d\xe5\xdc\xb6\x65\xe3\xc7\x36\x30\x56\xfe\x1f\x8e\x65\xef\xf7\xbc\x86\x2e\x8b\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82",
        warn: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x14\x00\x00\x00\x14\x08\x06\x00\x00\x00\x8d\x89\x1d\x0d\x00\x00\x02\xca\x49\x44\x41\x54\x78\xda\xbd\x94\x4f\x68\x5d\x45\x14\xc6\x7f\x67\xe6\xdd\xdc\x97\xa4\xb1\xad\x2d\x34\x79\xef\x91\x20\xb8\x10\xdc\xe8\xa2\x8b\xd6\x85\x75\x53\x41\x70\xe3\xa2\x2b\x15\x77\x16\x57\x52\xdd\xa9\xbc\x14\x45\x6c\xfd\xb3\x74\xe1\xae\xdb\xb8\x15\xdc\x99\x16\xff\xa5\x41\xac\xe8\xa2\x20\x28\x28\xb6\xa8\x58\x30\x4d\x5f\x92\x7b\xef\xcc\xf9\x5c\xbc\xbc\x24\x95\xc4\xaa\x88\x07\x66\x98\xc5\x9c\x33\xdf\x37\xf3\x3b\x03\xff\x67\x48\x98\x84\xe9\x8b\x99\xc3\x83\xa5\x6e\x4f\xc2\xfa\x7d\xc2\x5f\xe5\x84\x3b\xd4\x0c\x66\xa8\xae\x39\x5b\xb8\xbf\x67\x86\xe6\xef\xc7\xfe\xad\xba\x20\x61\xeb\x97\x66\xef\x49\xcb\x9d\x81\xae\x74\x55\x2f\xf7\x8e\x02\x68\x81\xf8\xcf\x15\xbe\x8f\x99\xa1\xd8\x4a\xaf\xc5\xb6\x4d\x20\xa4\x26\x9f\xbf\x93\x90\x5d\xe5\x6b\x81\x68\xa7\xc8\xf5\x72\xef\x68\x08\x5a\xf6\x46\x0e\xa8\x98\xb0\x58\xdd\xd2\xe3\xed\x87\xae\x7f\x20\x11\xcd\xc8\x7f\x5b\xa1\x84\xa9\xf1\xb7\x63\x69\x48\x28\x65\x0c\x03\x43\xe7\xb4\xf8\x70\x0b\xd0\x5e\x82\xfe\x5c\x28\x02\x6c\x7c\x3e\xfd\x84\xbe\xe9\xa9\x5a\xea\xa4\xe7\x4f\xb5\xf5\xe4\xa3\x85\x56\x2e\xcd\x24\x5d\xed\x69\xfd\x93\xce\xe9\x9d\x7b\xf7\x54\x28\x61\x80\xb4\x38\xd7\x36\xec\x1c\x2e\xdd\x5c\x75\xfb\xf2\x6a\xc5\xd7\xdf\x36\xfc\xf2\x5b\x36\x12\x1e\x02\x7d\x2d\xce\x1d\x60\x1e\x6d\xe6\xec\x61\xf9\x22\xd1\x0c\x6f\xda\xcd\x73\x63\x77\xc5\x7b\xf3\xba\x3c\x04\xc2\x78\x69\x8c\x97\xd0\x8a\x04\x2a\xf9\xd8\xfe\x30\x5d\x97\xf5\x19\x3b\x8b\x73\xf1\x76\x95\x5b\x05\xfb\x7d\x02\x27\xc8\xba\xdc\x39\x44\xd0\x4b\x79\xcd\xdd\xc2\xe6\xe9\x36\x1c\x12\x00\x31\xad\xba\x5b\xb4\x33\x83\xa5\x6e\x8f\x13\x64\xed\x80\x7d\x6b\x31\x3f\x3f\xc4\xa4\x4e\xf4\x8b\x7d\xf1\xee\x34\x7c\xd9\x00\x30\x58\x17\xb7\xd6\x36\x0b\x1a\xd6\x24\xa9\xd8\x17\x26\x63\xf6\x57\xcd\x10\xf3\xdb\xb6\xc3\x08\x62\xc0\x37\x3e\x9d\xb9\x2f\x94\x9c\x4e\xab\xee\x66\x16\x53\x86\xa9\xa9\xc0\xc9\xe3\xe3\x9c\x3c\xd6\x66\xfa\x48\x24\x35\x22\x06\x0b\xcd\x4d\xf7\x56\x3b\x3c\x55\x5d\xee\x3c\x00\xf8\x08\xf6\xb0\x13\x62\xc3\xde\x68\x95\xa1\xc8\x8e\x86\x84\x0c\x7b\xef\x95\x67\x0f\xf2\xce\x0b\x87\x98\x6c\x07\xdc\xc1\x0c\x93\x50\x2c\x88\x24\xce\x9b\xa1\x2d\xb0\x47\x80\x36\x4b\xdd\x47\x62\xc9\x47\x69\x43\x19\xb6\x2f\xda\x0d\x5e\x7c\xf3\x06\x37\x56\x9c\x77\x5f\x3e\xcc\xd4\xb8\x91\x33\xd8\xd0\x64\x2e\x26\x2c\xa6\x35\x1e\x2b\x8e\x5d\xfb\x50\x22\x86\xa1\x63\x4c\x59\x6f\x99\xa1\xcd\x8b\x47\x42\x66\x28\x25\xe9\xfb\x6b\x49\xdf\xfd\xd4\x68\xa3\x72\x99\x21\x0d\xa1\x1e\x4e\x8e\x24\x7f\x7d\x61\x68\x59\x06\x50\x7d\xd6\x7d\x7a\x6c\xbf\x5d\xa8\x57\x3c\x87\x40\x1c\xf5\x80\x0b\x5a\x85\xf1\xf3\xaf\x89\xba\x11\x73\xdd\x82\xa6\xd1\xf6\x4b\x1a\xb8\x93\xc7\x0e\x84\x58\xff\xee\xcf\x94\xc7\xaf\x5f\x30\x7d\x3c\x7b\xb0\x69\xa5\x2b\xad\xd2\xe6\x9a\x0d\x29\x84\xdb\x41\x95\xa0\x28\x0c\x0c\x9a\x5a\x23\xab\x5b\xe1\x8e\x8a\xb6\x59\xaa\xf4\x43\x91\x5a\x0f\x9a\xbe\x3a\x32\x49\xb6\x59\x06\x21\x57\x61\xf7\xde\xac\x2a\xa8\x81\xa9\x72\xf7\x76\x2d\x1d\x31\xe9\x91\xa8\x1f\xff\xf3\x5f\xfe\x0f\x18\x6c\x66\x9e\x9c\xf5\x78\x6a\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82",
        bad: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x14\x00\x00\x00\x14\x08\x06\x00\x00\x00\x8d\x89\x1d\x0d\x00\x00\x03\xb0\x49\x44\x41\x54\x78\xda\x9d\x94\xcd\x4f\x9c\x55\x14\xc6\x7f\xcf\xbd\xef\xbc\x8c\xcd\x60\xc3\x47\x75\x50\x16\x34\x50\x3b\x53\x83\x51\x09\x2b\x17\xda\xc4\xb8\x76\x43\xb5\x29\xd5\x2e\x8c\x4b\x17\xfe\x23\x6c\x5c\xba\xa8\xc1\x46\x81\xa4\xf1\xcf\xa8\xa2\xa6\x21\x0a\x53\x25\x96\x36\x5d\x4c\xc3\x47\x40\x28\x0c\x33\xef\x3d\xc7\xc5\x40\x4b\x89\x6e\x3c\xcb\x73\xcf\x79\xee\x39\xe7\x79\xf2\xc0\xa9\x70\x08\x0e\x3a\x99\xdb\x1e\x1f\xef\xdb\xbe\x74\xa9\xff\x74\xde\x21\x9c\xee\x7f\xae\x60\x1e\xe2\x15\x48\x00\x8f\xea\xf5\xf7\x83\xf4\x71\x61\xf6\xb6\x49\xaf\x08\x14\xe0\x71\x26\xdd\x35\xf7\xdb\xaf\xae\xac\xfc\x70\x04\x1a\x75\xd4\xf3\x1c\xe0\xf1\xc3\xef\xf5\xfa\x85\x3e\xe9\xab\x92\xf4\x41\x49\xe2\xd0\x9d\xc2\x1d\x80\x28\xd1\x23\x61\xee\x1c\xba\xff\x78\x00\x5f\x8c\x2e\x2f\xff\x74\x12\x54\xc7\xa3\x0b\xec\xaf\x5a\xed\xdd\x33\x31\xde\xce\xa1\x7f\xc7\xcc\x24\x99\x9b\x05\x24\x3d\xfd\x57\x72\xdc\xa9\x84\x10\x0d\x0e\x77\x53\xba\x31\xd6\x68\x7c\x7f\xbc\x9d\x8e\xee\xe0\x0f\xc7\xc7\xcf\x67\x29\xfd\x1a\xe1\xec\x01\x14\x32\xcb\xbc\xd3\x41\xe5\x32\x98\x75\xe1\x42\xc0\x5b\x2d\x54\x2a\xe1\x21\x14\x99\x7b\x96\x49\xd6\x32\x7b\xe7\x7c\xa3\x71\x67\x1e\x62\x38\x1a\xd3\x53\xa7\xf3\xf5\x0b\xd2\xd9\x7d\x28\x68\xb5\x32\xe5\x39\xa5\x91\x11\x6c\x6f\x0f\x62\x84\x18\xb1\xbd\x3d\x4a\x23\x23\x28\xcf\xa1\xd5\xca\x0a\x29\x05\x29\x20\x7d\xe3\x13\x13\xa5\x29\xb0\x20\xb0\xfb\x17\x2f\x5e\xee\x8d\xf1\xf2\x8e\x59\x0a\x66\x59\xa8\x54\x18\x9c\x99\x61\x68\x7e\x9e\xbc\x56\xc3\x76\x77\xb1\xdd\x5d\xf2\x5a\x8d\xa1\xf9\x79\x06\x67\x66\x08\x95\x0a\x32\x8b\xfb\x66\x45\x5f\x8c\xaf\x3d\x7c\xf2\xe4\xaa\xc0\x03\x80\x4b\x9f\x94\x24\x97\xe4\x5e\x14\xc4\xc1\x41\xca\x93\x93\x84\xfe\x7e\xaa\xb3\xb3\xe4\x63\x63\xe4\x63\x63\x54\x67\x67\x09\xfd\xfd\x94\x27\x27\x89\x83\x83\x78\x51\x80\xa4\xe4\xee\x09\x3e\x05\x90\x83\xd6\xea\xf5\xbb\x67\x42\x78\x63\xdf\xcc\x14\x42\xb0\xbd\x3d\xf2\x5a\x8d\xea\xad\x5b\xc4\x81\x01\x52\xb3\xd9\x65\xb9\x5a\x25\x6d\x6e\xd2\xbc\x76\x8d\x76\xa3\x41\xe8\xed\xc5\x53\xf2\x5c\xd2\xa1\x59\xd3\xdb\xed\x9a\x1e\x8c\x8f\xf7\x59\x51\x34\x72\xe9\xa5\xb6\xbb\x0b\x44\x8c\xdd\x15\xc7\xc6\x78\xf9\xe6\x4d\xb2\xe1\x61\x00\x8a\x47\x8f\x78\x7c\xe3\x06\xed\xd5\x55\x42\x6f\x2f\xa4\xd4\x5d\x10\xe4\xee\x6d\x8f\xf1\xcd\xa0\x94\x74\x5a\xe0\xff\x33\x14\xcc\x42\xb8\xb3\xbc\xbc\x83\xfb\x7a\xd4\x91\x24\x8f\xa7\xab\xd5\xa8\xce\xcd\x91\x0d\x0f\x93\x9a\x4d\x52\xb3\x49\x36\x3c\x4c\x75\x6e\xee\x29\x51\xc4\x88\x03\x99\x04\xd2\x76\x74\x6f\x86\x2b\x90\x5c\x5a\xea\xe9\x92\x62\xde\x6a\x91\x8f\x8e\x32\xb4\xb0\xd0\xbd\xdf\xfa\x3a\xcd\xe9\x69\x9a\xd3\xd3\xa4\xf5\x75\xe2\xc0\x00\x43\x0b\x0b\xe4\xa3\xa3\x5d\x4d\x4a\xd6\x23\xb9\xc3\x1f\xc3\x8d\xc6\x66\x00\x88\x66\xdf\xb9\xbb\xdc\x5d\xca\x32\xd2\xc6\x06\xad\xc5\x45\x6c\x6b\x8b\xe6\xf5\xeb\xb4\x57\x57\x69\xaf\xae\xd2\xbc\x7e\x1d\xdb\xda\xa2\xb5\xb8\x48\xda\xd8\x40\x59\x86\xbb\x7b\x49\x92\xcc\xe6\x8e\x59\x0e\x80\xdf\xaf\xd5\x7e\xe9\x8d\xf1\xad\x5d\xf7\xa4\x56\x2b\x86\x4a\x85\x78\xee\xdc\x33\x02\xe0\x29\x51\x69\x7d\xbd\x2b\xf8\x72\xd9\x7a\x40\x1d\xf7\x66\x5e\x2a\x5d\xa8\x2e\x2d\xed\x87\x85\xa9\x29\x1d\x09\xf2\xb3\xc2\xbd\x53\x72\x0f\x94\xcb\xc9\xdb\x6d\x3a\x6b\x6b\x84\x4a\xa5\xcb\x66\x4a\x84\x4a\x85\xce\xda\x1a\xde\x6e\x43\xb9\x6c\xc1\xdd\x7b\x24\x15\xee\x9f\x0f\x2d\x2d\x3d\x61\x6a\x2a\xe8\xa4\x6d\xfd\x59\xaf\x7f\xf4\xa2\xf4\x2d\x52\xb6\x6f\x56\x48\x92\xbb\x87\x67\xce\x00\x92\xcc\xbb\x40\x59\x8f\xc4\x76\x4a\x5f\x8e\x36\x1a\x33\xc7\x8e\x13\x00\xae\x40\xf2\xa9\xa9\x78\x61\x65\x65\x6e\xb7\x28\xde\x4b\xee\xbf\xf5\xc5\x98\xf5\x4a\x31\x97\x14\x40\x02\xe5\x92\x2a\x52\xec\x8f\x31\x13\x3c\xd8\x31\xfb\xf0\x24\xd8\x7f\x1a\xec\xcf\x13\x13\xa5\xea\xc1\xc1\xb5\xe0\x7e\x35\xc1\xeb\x06\x83\xee\x1e\x82\xb4\x15\xa5\x15\xe0\xf6\xdf\x29\xdd\xac\xdf\xbb\xb7\x7b\xd2\x94\xf9\x37\x41\x9f\x2e\xd8\x9a\x98\x38\x7b\x70\x78\x38\xd4\x31\x0b\x7d\x66\x8f\xcf\x36\x1a\x9b\xa7\x4d\xf9\x64\xff\x3f\x1d\xeb\xee\xd8\x05\x28\x88\x57\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82",
        off: "\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x14\x00\x00\x00\x14\x08\x06\x00\x00\x00\x8d\x89\x1d\x0d\x00\x00\x03\x37\x49\x44\x41\x54\x78\xda\x85\x54\xbf\x6b\x64\x55\x14\xfe\xce\x39\xf7\xdd\x79\x33\x29\xd6\x5d\x2c\x74\x89\x8d\x20\xb8\xce\x62\x61\x19\x27\x88\x20\xfe\x01\xc2\x1b\x56\xc4\xdd\x46\xa6\x4a\x14\xec\x12\x32\x79\x79\xa4\xc8\x40\x48\x27\xc1\x42\x44\x6d\xc4\x19\xd8\x28\x5a\x29\x88\xad\x16\xba\x6c\x60\x04\xb1\x11\x0b\x5d\x64\x2d\xf2\xc8\x4c\xde\xdc\x1f\xc7\x22\x19\x98\xc4\xec\xec\x81\x03\x97\x8f\xef\x7c\xf7\x9c\xfb\xe3\x03\x2e\x44\x9e\xe7\xac\xaa\x34\x8b\xed\xec\xec\x5c\xcd\xf3\xfc\xda\x45\x3c\xcf\x73\xbe\x58\x7f\x8e\x90\x65\x99\x0c\x06\x83\x00\x00\xdb\xdb\xdb\xaf\x11\xd1\xad\x10\xc2\x4b\xaa\x7a\x1d\x00\x11\xd1\x03\x11\xb9\x17\x63\xbc\xbb\xb9\xb9\xf9\xe5\xc5\x9a\x73\x82\xfd\x7e\x5f\xda\xed\x76\xd8\xd8\xd8\x78\x2e\x4d\xd3\x0f\x98\xf9\x75\x11\x81\xf7\x1e\x31\x46\x00\x00\x33\xc3\x18\x03\x55\x85\xf7\xfe\x47\xe7\xdc\xbb\x45\x51\xfc\x34\xad\x05\x00\x99\xb6\xbe\xb2\xb2\x12\xbb\xdd\xee\x2b\x69\x9a\x7e\x67\x8c\xb9\x39\x1e\x8f\x63\x08\x21\xc4\x18\x31\x93\xea\x9c\x8b\xde\x7b\x4d\x92\xe4\x19\x66\xbe\xbd\xb4\xb4\xf4\xfb\xea\xea\xea\x61\x96\x65\x32\x1c\x0e\x55\xf2\x3c\xe7\xad\xad\x2d\x05\xf0\xac\x31\xe6\x07\x66\xbe\x7a\x72\x72\xe2\x99\x59\x00\xf0\xd9\xa8\x44\x44\x74\xb6\x66\x22\xe2\x10\x82\x07\x60\x93\x24\x79\x63\x79\x79\xf9\xdb\xfd\xfd\xfd\x3f\xb3\x2c\x13\xc6\x29\x4b\x55\xf5\x23\x6b\xed\x95\xaa\xaa\x3c\x33\x1b\x3c\x3e\x4c\x08\x21\x30\x33\xab\xea\xa7\x9d\x4e\x27\xe9\xf7\xfb\x91\x00\xa0\xdb\xed\xbe\x5a\xaf\xd7\xbf\xaf\xaa\x2a\x10\x91\x9c\x6d\x32\x57\x4d\x55\xa7\x4b\x5f\xaf\xd7\xcd\x68\x34\xba\x53\x14\xc5\x67\x0c\x00\x22\x72\x5b\x44\x94\x88\x74\x4a\x0e\x21\xcc\xcd\xa9\xa0\xaa\x52\x8c\x51\x89\xe8\x0e\x00\x90\xaa\x52\x9e\xe7\xf7\x6a\xb5\xda\x8b\xce\xb9\xa8\xaa\x9c\x24\x09\x8c\x99\x3f\x75\x08\x01\x93\xc9\x04\x00\xd4\x18\x43\xce\xb9\xbf\xab\xaa\x7a\xde\xac\xad\xad\x3d\x91\xa6\xe9\x53\x31\x46\x30\x33\x8d\x46\x23\xb4\x5a\x2d\xb4\x5a\x2d\x9c\x61\xe7\x84\xa6\xd8\xe1\xe1\x21\x0e\x0e\x0e\x50\xaf\xd7\x11\x63\x84\x88\x5c\x5b\x58\x58\xb8\x6e\x6a\xb5\x1a\xcd\xfe\x00\x55\x45\x92\x24\x48\xd3\x74\x6e\x87\xd6\xda\xd9\x73\x84\xaa\x92\x73\x8e\x29\xcb\x32\x69\x36\x9b\xf7\x93\x24\x79\x61\x3a\x72\xa3\xd1\x40\xa3\xd1\x98\x2b\x58\x55\x15\xca\xb2\x04\x11\xa9\x88\x90\xf7\xfe\x9f\xaa\xaa\x6e\x98\xc1\x60\x10\x9a\xcd\xe6\x7d\x63\xcc\x0d\xe7\x5c\x24\x22\x3e\x3e\x3e\x46\x59\x96\x73\x05\x89\x08\x22\x02\x55\x8d\x22\xc2\xde\xfb\xdf\x7a\xbd\xde\x43\x73\xd6\xee\xe7\xaa\x7a\x4b\x55\x89\x88\xc0\xcc\x10\x91\xc7\x3e\x44\x55\x85\xaa\xaa\x31\x86\x26\x93\xc9\x17\x00\xc0\x79\x9e\x73\x51\x14\x5f\x8f\xc7\xe3\x5f\xd2\x34\x15\x55\x0d\x33\xe4\xb9\x19\x63\x8c\xd6\x5a\x19\x8d\x46\x7f\x95\x65\xf9\x31\x00\xe2\xe1\x70\x48\x00\x14\xc0\x3b\xde\x7b\x27\x22\x3c\x15\x9d\x17\x31\xc6\x28\x22\x2a\x22\xa4\xaa\x9d\xbd\xbd\xbd\xe3\x7e\xbf\xcf\x3c\x18\x0c\x42\x96\x65\x52\x14\xc5\xcf\xce\xb9\xb7\x45\x24\x58\x6b\x05\x80\x57\xd5\xa0\xa7\x57\xa9\xa7\x4d\xab\x02\x08\x00\xbc\xb5\x96\xad\xb5\x32\x1e\x8f\xdf\x2f\x8a\xe2\x9b\x2c\xcb\xa4\xdd\x6e\x87\xff\xd9\x57\xb7\xdb\x7d\xd9\x5a\xfb\xa1\xb5\xf6\x66\x8c\xf1\x52\xfb\x62\x66\x38\xe7\xfe\x08\x21\xbc\x97\xe7\xf9\x57\xb3\xf6\x75\xa9\xc1\x76\x3a\x9d\x64\x71\x71\xf1\x2d\x00\x6f\xaa\x6a\x53\x55\x9f\x04\xc0\x44\xf4\x2f\x11\xfd\x4a\x44\x77\x8f\x8e\x8e\x3e\xd9\xdd\xdd\x2d\x1f\x69\xb0\x97\xb9\x36\x00\xf4\x7a\xbd\x2b\x21\x84\xa7\x27\x93\x09\xd7\x6a\xb5\x07\xeb\xeb\xeb\x0f\x1f\xc5\x05\x80\xff\x00\x05\x82\x08\xf7\x11\x88\x15\x66\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82"
    };
    // ---- Color square pictures for the Named Colors list ----------
    // Builds a tiny PNG (solid color with a thin grey edge) in memory, so no
    // picture files need to ship with the script. Returns the file bytes as a string.
    var swatchImages = {};
    function swatchPngString(rgb) {
        var W = 24, H = 14;
        function be32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
        var crcTable = [];
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            crcTable[n] = c >>> 0;
        }
        function crc32(bytes) {
            var crc = 0xFFFFFFFF;
            for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        function chunk(type, data) {
            var t = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
            var body = t.concat(data);
            return be32(data.length).concat(body, be32(crc32(body)));
        }
        var raw = [];
        for (var y = 0; y < H; y++) {
            raw.push(0);
            for (var x = 0; x < W; x++) {
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) raw.push(128, 128, 128);
                else raw.push(rgb[0], rgb[1], rgb[2]);
            }
        }
        var a = 1, b = 0;
        for (var j = 0; j < raw.length; j++) { a = (a + raw[j]) % 65521; b = (b + a) % 65521; }
        var len = raw.length;
        var z = [0x78, 0x01, 0x01, len & 255, (len >>> 8) & 255, (~len) & 255, ((~len) >>> 8) & 255].concat(raw, be32(((b << 16) | a) >>> 0));
        var png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].concat(
            chunk("IHDR", be32(W).concat(be32(H), [8, 2, 0, 0, 0])),
            chunk("IDAT", z),
            chunk("IEND", []));
        var s = "";
        for (var q = 0; q < png.length; q++) s += String.fromCharCode(png[q]);
        return s;
    }
    function getSwatchImage(rgb) {
        var key = rgb[0] + "_" + rgb[1] + "_" + rgb[2];
        if (swatchImages[key] !== undefined) return swatchImages[key];
        var im = null;
        try {
            var f = new File(Folder.temp.fsName + "/signpack_pf_sw_" + key + ".png");
            f.encoding = "BINARY";
            if (f.open("w")) { f.write(swatchPngString(rgb)); f.close(); }
            if (f.exists && f.length > 50) im = ScriptUI.newImage(f);
        } catch (eSw) { im = null; }
        swatchImages[key] = im;
        return im;
    }

    var iconFiles = {};
    function getIconFileEarly(status) { return getIconFile(status); }
    // Writes the embedded PNG to the temp folder once, returns the File (or null).
    function getIconFile(status) {
        if (iconFiles[status] !== undefined) return iconFiles[status];
        var f = null;
        try {
            f = new File(Folder.temp.fsName + "/signpack_pf_icon_" + status + ".png");
            f.encoding = "BINARY";
            if (f.open("w")) { f.write(ICON_DATA[status]); f.close(); }
            if (!f.exists || f.length < 50) f = null;
        } catch (e) { f = null; }
        iconFiles[status] = f;
        return f;
    }

    // Fixed pool of rows ("slots") per panel. Rows are never added/removed after
    // the window opens; each scan just updates the slots in place. Each row has ONE
    // image control whose picture is swapped (no stacked / hidden images).
    var STATUS_KEYS = ["ok", "warn", "bad", "off"];
    var iconImages = {};
    function getIconImage(status) {
        if (iconImages[status] !== undefined) return iconImages[status];
        var im = null;
        try {
            var f = getIconFile(status);
            if (f) im = ScriptUI.newImage(f);
        } catch (e) { im = null; }
        iconImages[status] = im;
        return im;
    }

    try {
        if ($.global.__preflightWin && $.global.__preflightWin instanceof Window) {
            $.global.__preflightWin.close();
        }
    } catch (ePrev) {}

    var win = new Window("palette", "Preflight Check 1.0");
    $.global.__preflightWin = win;
    paintWin(win);   // dark grey first: the UI Kit picks the white logo on a dark window
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.margins = uik().MARGINS;
    win.spacing = uik().SPACING;

    var btnProd = null;     // created with the buttons below
    var titleRow = win.add("group");
    titleRow.orientation = "row";
    titleRow.alignment = ["fill", "top"];
    titleRow.alignChildren = ["left", "center"];
    titleRow.spacing = 10;
    titleRow.margins = 0;
    addHeaderLogo(titleRow, win);
    var titleSpacer = titleRow.add("group");
    titleSpacer.alignment = ["fill", "center"];
    var modeBadge = titleRow.add("statictext", undefined, "PRODUCTION");
    modeBadge.keepColor = true;   // keeps its own orange / blue
    modeBadge.preferredSize.width = 100;
    try { modeBadge.justify = "right"; } catch (eJu) {}
    modeBadge.alignment = ["right", "bottom"];   // right next to the title, on its bottom line
    try { modeBadge.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13); } catch (eMB) {}
    addHeaderTitle(titleRow, "Preflight Check");
    addAccentLine(win);
    function setModeUI() {
        var d = (CURRENT_MODE === "design");
        try {
            modeBadge.text = d ? "DESIGN" : "PRODUCTION";
            modeBadge.graphics.foregroundColor = modeBadge.graphics.newPen(modeBadge.graphics.PenType.SOLID_COLOR, d ? [0.4, 0.7, 1] : [1, 0.65, 0.25], 1);
            win.text = "Preflight Check 1.0 - " + (d ? "Design" : "Production");
            if (btnProd) btnProd.visible = !d;      // designers do not build production files
        } catch (eMU) {}
    }
    addSignTypesTag(win, SIGN_TYPES_VERSION);

    // Job type row
    var jobRow = win.add("group");
    jobRow.orientation = "row";
    jobRow.alignChildren = ["left", "center"];
    jobRow.add("statictext", undefined, "Sign type:");
    var jobLabels = [], defaultIdx = 0;
    for (var jl = 0; jl < SIGN_TYPES.length; jl++) {
        jobLabels.push(SIGN_TYPES[jl].label);
        if (SIGN_TYPES[jl].label === DEFAULT_TYPE) defaultIdx = jl;
    }
    var ddJob = jobRow.add("dropdownlist", undefined, jobLabels);
    ddJob.preferredSize.width = 250;
    var savedJob = defaultIdx;
    try {
        var sjl = app.preferences.getStringPreference("signpack/preflight/signtype");
        for (var sj = 0; sj < SIGN_TYPES.length; sj++) if (SIGN_TYPES[sj].label === sjl) savedJob = sj;
    } catch (ePref) {}
    ddJob.selection = savedJob;
    curType = typeAt(savedJob);
    jobRow.add("statictext", undefined, "Client:").margins = [14, 0, 0, 0];
    var clientLabels = [];
    for (var cl = 0; cl < CLIENTS.length; cl++) clientLabels.push(CLIENTS[cl].label);
    var ddClient = jobRow.add("dropdownlist", undefined, clientLabels);
    ddClient.preferredSize.width = 170;
    var savedClient = 0;
    try {
        var scl = app.preferences.getStringPreference("signpack/preflight/client");
        for (var sc = 0; sc < CLIENTS.length; sc++) if (CLIENTS[sc].label === scl) savedClient = sc;
    } catch (ePref2) {}
    ddClient.selection = savedClient;
    applyClientSettings(CLIENTS[savedClient]);
    curType = typeAt(savedJob);
    setModeUI();

    // Summary row: overall icon + counts, artboard selector on the right
    var sumRow = win.add("group");
    sumRow.orientation = "row";
    sumRow.alignChildren = ["left", "center"];
    sumRow.alignment = ["fill", "top"];
    sumRow.spacing = 10;
    var sumIcon = null;
    try {
        var sf0 = getIconFileEarly("off");
        if (sf0) sumIcon = sumRow.add("image", undefined, sf0);
    } catch (eSum) { sumIcon = null; }
    if (!sumIcon) sumIcon = sumRow.add("statictext", undefined, "-");
    sumIcon.preferredSize = [20, 20];
    sumIcon.minimumSize = [20, 20];
    var sumTxt = sumRow.add("statictext", undefined, "Scanning...");
    sumTxt.preferredSize.width = 300;
    try { sumTxt.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13); } catch (eF13) {}
    sumRow.add("statictext", undefined, "Artboard:");
    var ddArt = sumRow.add("dropdownlist", undefined, ["All artboards"]);
    ddArt.preferredSize.width = 190;
    ddArt.selection = 0;

    // Two columns of status rows
    var cols = win.add("group");
    cols.orientation = "row";
    cols.alignChildren = ["fill", "top"];
    cols.spacing = 12;
    var stdPanel = cols.add("panel", undefined, "Standard checks");
    stdPanel.orientation = "column";
    stdPanel.alignChildren = ["fill", "top"];
    stdPanel.margins = [12, 16, 12, 10];
    stdPanel.spacing = 6;
    var jobPanel = cols.add("panel", undefined, "Sign type checks");
    jobPanel.orientation = "row";
    jobPanel.alignChildren = ["fill", "fill"];
    jobPanel.margins = [12, 16, 8, 10];
    jobPanel.spacing = 4;
    var jobRows = jobPanel.add("group");
    jobRows.orientation = "column";
    jobRows.alignChildren = ["fill", "top"];
    jobRows.alignment = ["fill", "top"];
    jobRows.spacing = 6;
    var jobScroll = jobPanel.add("scrollbar", undefined, 0, 0, 0);
    jobScroll.alignment = ["right", "fill"];
    jobScroll.preferredSize = [18, 100];
    try { jobScroll.stepdelta = 1; } catch (eSd) {}

    // Both lists show the same number of rows; the sign type list scrolls.
    var VIEW_ROWS = STANDARD.length;
    var panelH = VIEW_ROWS * 30 + 30;
    stdPanel.preferredSize.height = panelH;
    jobPanel.preferredSize.height = panelH;
    jobScroll.preferredSize.height = panelH - 30;
    stdPanel.alignment = ["fill", "top"];
    jobPanel.alignment = ["fill", "top"];

    var stdSlots, jobSlots;   // created below once the helpers exist

    var detailRow = win.add("group");
    detailRow.orientation = "row";
    detailRow.alignChildren = ["left", "center"];
    detailRow.alignment = ["fill", "top"];
    var detailTitle = detailRow.add("statictext", undefined, "");
    detailTitle.preferredSize.width = 470;
    var chkGap = detailRow.add("checkbox", undefined, "Tight-gap check (slow)");
    chkGap.helpTip = "Compares bounding boxes of top-level items. Only used for cut-type signs (cut vinyl, channel letters, print & cut...).";
    var list = win.add("listbox", undefined, [], {
        numberOfColumns: 5,
        showHeaders: true,
        columnWidths: [30, 100, 170, 260, 70],
        columnTitles: ["#", "Check", "Item", "Detail", "Artboard"]
    });
    list.preferredSize.width = 640;
    list.preferredSize.height = 190;

    var detailIssues = [];
    var curRes = null;

    // Which artboard an issue sits on (by the center of the item), for the Artboard column
    function artboardLabel(iss) { return (iss && iss.ab) ? iss.ab : ""; }
    function artboardLabelDoc(iss) {
        try {
            if (!iss.collection || iss.idx === null || iss.idx === undefined) return "";
            if (iss.collection === "artboard") return String(doc.artboards[iss.idx].name);
            if (iss.collection === "layer") return "";
            var it = (iss.collection === "pageItems") ? resolveTopIdx(doc, iss.idx) : doc[iss.collection][iss.idx];
            var b = it.geometricBounds;
            var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
            for (var a = 0; a < doc.artboards.length; a++) {
                var r = doc.artboards[a].artboardRect;
                if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) return String(doc.artboards[a].name);
            }
            for (var a2 = 0; a2 < doc.artboards.length; a2++) {
                var r2 = doc.artboards[a2].artboardRect;
                if (!(b[2] < r2[0] || b[0] > r2[2] || b[1] < r2[3] || b[3] > r2[1])) return String(doc.artboards[a2].name);
            }
            return "off artboards";
        } catch (e) { return ""; }
    }

    function showDetails(res) {
        curRes = res;
        list.removeAll();
        detailIssues = res.issues;
        detailTitle.text = res.label + ": " + (res.status === "off" ? "not run" : (problemCount(res.issues) === 0 ? (res.info || "nothing to report") : problemCount(res.issues) + " item(s)" + (res.info ? " | " + res.info : "")));
        if (res.status === "off" && res.info) detailTitle.text = res.label + ": " + res.info;
        for (var i = 0; i < res.issues.length; i++) {
            var iss = res.issues[i];
            var it = list.add("item", String(i + 1));
            if (iss.rgb) { try { var swImg = getSwatchImage(iss.rgb); if (swImg) it.image = swImg; } catch (eSwI) {} }
            it.subItems[0].text = iss.check;
            it.subItems[1].text = iss.name;
            it.subItems[2].text = iss.detail;
            it.subItems[3].text = artboardLabel(iss);
        }
        updateButtons();
    }

    var iconSwapFailed = false;
    function makeSlot(panel) {
        var row = panel.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        row.spacing = 8;
        var slot = { row: row, res: null, icon: null, lbl: null };
        try {
            var f0 = getIconFile("off");
            if (f0) slot.icon = row.add("image", undefined, f0);
        } catch (eImg) { slot.icon = null; }
        if (!slot.icon) slot.icon = row.add("statictext", undefined, "-");
        slot.icon.preferredSize = [20, 20];
        slot.icon.minimumSize = [20, 20];
        slot.lbl = row.add("statictext", undefined, "");
        slot.lbl.preferredSize.width = 215;
        var btn = row.add("button", undefined, "View");
        btn.preferredSize = [50, 22];
        btn.helpTip = "Shows the details of this check.";
        slot.btn = btn;
        btn.onClick = function () { if (slot.res) showDetails(slot.res); };
        row.visible = false;
        return slot;
    }
    function makeSlots(panel, n) {
        var out = [];
        for (var i = 0; i < n; i++) out.push(makeSlot(panel));
        return out;
    }
    function markerFor(status) {
        return status === "ok" ? "[OK] " : status === "warn" ? "[!] " : status === "bad" ? "[X] " : "[-] ";
    }
    // What each check looks at (shown as a tooltip on the row and its View button).
    function checkHelp(label) {
        var L = String(label);
        function has(k) { return L.indexOf(k) === 0; }
        if (has("Image DPI")) return "Placed and raster images: warns below " + SETTINGS.DPI_WARN + " ppi, marks red below " + SETTINGS.DPI_BAD + " ppi (effective resolution at the size used in the file).";
        if (has("Unused Swatches")) return "Swatches in the file that nothing uses. Fix removes them.";
        if (has("Named Colors")) return "Spot / named colors in the file. Pick one and use Add Label to put the color and its name in the file.";
        if (has("Text")) return "Live text, missing fonts and overset text.";
        if (has("File Color Mode")) return "The document color mode (CMYK or RGB).";
        if (has("Open Paths")) return "Open paths on the production layers (CutContour, Outline...). Cut paths must be closed.";
        if (has("Clipping Masks")) return "Clipping masks found in the file.";
        if (has("External Links")) return "Linked images: missing, modified or not embedded.";
        if (has("Sheet Notes")) return "Notes from the specs sheet for this sign type (and client).";
        if (has("No Bleed")) return "This sign type has no bleed: art should stay inside the artboard.";
        if (has("Bleed Past CutContour")) return "Printed art must run past the CutContour shape by this amount.";
        if (has("Bleed ")) return "Art must extend past the artboard edge by this amount on every side.";
        if (has("CutContour")) return "Needs a CutContour layer with the CutContour spot color and clean stroke-only closed paths.";
        if (has("No CutContour")) return "This sign type does not use a CutContour. Flags one if it is there.";
        if (has("No BoundingBox")) return "This sign type does not use a BoundingBox. Flags one if it is there.";
        if (has("BoundingBox")) return "Needs a BoundingBox layer with the right fill and stroke for this sign type.";
        if (has("Outline / Holes")) return "The Outline layer (required for rigid-material cut paths). Holes and White Ink are only checked if their layer exists.";
        if (has("Grommets")) return "Grommets are upon request: a Grommets layer is fine, none means check with the client.";
        if (has("Braille")) return "Braille elements should use a 1 pt outline on a Braille layer.";
        if (has("Routed")) return "Routed elements should use a 1 pt outline.";
        if (has("Narrowest Vinyl")) return "The narrowest part of a vinyl piece (for example the stem of a letter) must be at least " + SETTINGS.MIN_VINYL_WIDTH_INCHES + " in.";
        if (has("Thin Shapes")) return "Shapes that are thinner on average than " + SETTINGS.MIN_AVG_THICKNESS_INCHES + " in.";
        if (has("Undersized Items")) return "Items smaller than " + SETTINGS.MIN_ITEM_WIDTH_INCHES + " x " + SETTINGS.MIN_ITEM_HEIGHT_INCHES + " in.";
        if (has("Tiny Islands")) return "Tiny pieces inside compound paths (for example the dot of an \"i\").";
        if (has("Stroke-Only")) return "Artwork that is only a stroke outside the production layers. A stroke does not cut.";
        if (has("Tight Gaps")) return "Items closer than " + SETTINGS.MIN_GAP_INCHES + " in to each other (compares bounding boxes, not true shape distance). Slow.";
        if (has("Pure Black")) return "Fills that are C0 M0 Y0 K100. Check that rich black was not intended.";
        if (has("Transparency")) return "Transparency (opacity, blend modes) on the artwork.";
        if (has("Hairline")) return "Strokes thinner than " + SETTINGS.HAIRLINE_MIN_PT + " pt.";
        if (has("Stacked Duplicates")) return "Identical shapes stacked on top of each other.";
        if (has("Items Off Artboard")) return "Items that sit completely outside every artboard. Only checked with All artboards selected.";
        if (has("Empty Layers")) return "Empty layers, empty text frames and paths with a single anchor point.";
        if (has("Artboard Size")) return "Artboards smaller than " + SETTINGS.ARTBOARD_MIN_INCHES + " in or larger than " + SETTINGS.ARTBOARD_MAX_INCHES + " in: check the size is right.";
        return "Shows the details of this check.";
    }
    function setSlot(slot, res) {
        if (!res) { slot.row.visible = false; slot.res = null; return; }
        slot.res = res;
        slot.row.visible = false;   // hide first so the old picture is erased on repaint
        var prefix = "";
        try {
            var img = getIconImage(res.status);
            if (slot.icon.type === "image" && img) slot.icon.image = img;
            else prefix = markerFor(res.status);
        } catch (eSwap) { prefix = markerFor(res.status); }
        var txt = res.label;
        if (res.ignored) txt += "  (ignored)";
        if (res.status !== "off") {
            var pc = problemCount(res.issues);
            if (pc > 0) txt += "  (" + pc + ")";
            else if (res.badge) txt += "  (" + res.badge + ")";
        }
        slot.lbl.text = prefix + txt;
        try {
            var tip = checkHelp(res.label);
            slot.lbl.helpTip = tip;
            if (slot.btn) slot.btn.helpTip = tip;
        } catch (eTip) {}
        slot.row.visible = true;
    }
    var jobOffset = 0;
    function paintJobSlots() {
        for (var i = 0; i < jobSlots.length; i++) setSlot(jobSlots[i], jobResults[jobOffset + i] || null);
    }
    function refreshJobSlots() {
        var maxOff = jobResults.length - jobSlots.length;
        if (maxOff < 0) maxOff = 0;
        if (jobOffset > maxOff) jobOffset = maxOff;
        if (jobOffset < 0) jobOffset = 0;
        try {
            jobScroll.minvalue = 0;
            jobScroll.maxvalue = maxOff;
            jobScroll.value = jobOffset;
            jobScroll.jumpdelta = (jobSlots.length > 1) ? jobSlots.length - 1 : 1;
            jobScroll.enabled = maxOff > 0;
            jobScroll.visible = maxOff > 0;
        } catch (eSc) {}
        paintJobSlots();
    }
    jobScroll.onChanging = function () {
        var v = Math.round(jobScroll.value);
        if (v === jobOffset) return;
        jobOffset = v;
        paintJobSlots();
    };
    jobScroll.onChange = jobScroll.onChanging;
    function fillSlots(slots, results) {
        for (var i = 0; i < slots.length; i++) setSlot(slots[i], results[i] || null);
    }
    function relayout() { /* rows are updated in place, no relayout needed */ }

    function pickInitialDetails() {
        var all = stdResults.concat(jobResults);
        var pick = null;
        for (var i = 0; i < all.length; i++) {
            if (all[i].status === "bad") { pick = all[i]; break; }
        }
        if (!pick) {
            for (var j = 0; j < all.length; j++) {
                if (all[j].status === "warn") { pick = all[j]; break; }
            }
        }
        if (pick) showDetails(pick);
        else { list.removeAll(); detailIssues = []; curRes = null; detailTitle.text = "All clear."; updateButtons(); }
    }

    // ---- Scanning notice ----
    var scanWin = null;
    function scanStart() {
        var n = lastMeta.nObjs || 0;
        try {
            scanWin = new Window("palette", "Preflight Check");
            paintWin(scanWin);
            scanWin.orientation = "column";
            scanWin.alignChildren = ["fill", "top"];
            scanWin.margins = 20;
            scanWin.spacing = 8;
            var t1 = scanWin.add("statictext", undefined, "Scanning...");
            try { t1.graphics.font = ScriptUI.newFont("dialog", "BOLD", uik().TITLE_SIZE); } catch (eF) {}
            var msg = "This can take a while on files with a lot of art or a large size.";
            if (n > 0) msg += "\nThis file has about " + n + " objects.";
            var t2 = scanWin.add("statictext", undefined, msg, { multiline: true });
            t2.preferredSize = [360, 44];
            paintStyle(scanWin);
            scanWin.center();
            scanWin.show();
            scanWin.update();
        } catch (eW) { scanWin = null; }
    }
    function scanEnd() {
        try { if (scanWin) scanWin.close(); } catch (e) {}
        scanWin = null;
    }

    // ---- Summary line ----
    function setSummary(status, text) {
        var prefix = "";
        try {
            var img = getIconImage(status);
            if (sumIcon.type === "image" && img) sumIcon.image = img;
            else prefix = markerFor(status);
        } catch (e) { prefix = markerFor(status); }
        sumTxt.text = prefix + text;
    }
    function summaryInfo() {
        var all = stdResults.concat(jobResults), nb = 0, nw = 0, no = 0, nf = 0;
        for (var i = 0; i < all.length; i++) {
            if (all[i].status === "bad") nb++;
            else if (all[i].status === "warn") nw++;
            else if (all[i].status === "ok") no++;
            else nf++;
        }
        var st = nb > 0 ? "bad" : (nw > 0 ? "warn" : (no > 0 ? "ok" : "off"));
        var tx = nb + " wrong, " + nw + " to check, " + no + " OK" + (nf > 0 ? ", " + nf + " not run" : "");
        if (scopeIdx < 0 && lastMeta.selCount > 0) tx += "   (checking the selection: " + lastMeta.selCount + " item" + (lastMeta.selCount === 1 ? "" : "s") + ")";
        return { status: st, text: tx };
    }
    function updateSummary() {
        var si = summaryInfo();
        setSummary(si.status, si.text);
    }

    // ---- Artboard selector ----
    var artFilling = false;
    function fillArtboards() {
        try {
            var names = ["All artboards"];
            for (var i = 0; i < lastMeta.artNames.length; i++) names.push((i + 1) + " - " + lastMeta.artNames[i]);
            var same = ddArt.items.length === names.length;
            if (same) for (var j = 0; j < names.length; j++) if (ddArt.items[j].text !== names[j]) { same = false; break; }
            if (same) return;
            var keep = scopeIdx;
            artFilling = true;
            ddArt.removeAll();
            for (var k = 0; k < names.length; k++) ddArt.add("item", names[k]);
            if (keep >= 0 && keep + 1 < names.length) ddArt.selection = keep + 1;
            else { ddArt.selection = 0; scopeIdx = -1; scopeRect = null; }
            artFilling = false;
        } catch (e) { artFilling = false; }
    }

    function noDocument() {
        stdResults = []; jobResults = [];
        fillSlots(stdSlots, stdResults);
        refreshJobSlots();
        list.removeAll();
        detailIssues = [];
        curRes = null;
        setSummary("off", "No open document");
        detailTitle.text = "No open document found. Open a file and press Rescan.";
        updateButtons();
    }
    function showByLabel(label) {
        var all = stdResults.concat(jobResults);
        for (var i = 0; i < all.length; i++) if (all[i].label === label) { showDetails(all[i]); return true; }
        return false;
    }
    var jobIdxKeep = -1;
    var scanning = false;
    var jobRestoring = false;
    // The dropdown can lose its selection / text after the scan window closes: put it back.
    function restoreJobDropdown() {
        if (jobIdxKeep < 0) return;
        jobRestoring = true;
        try {
            if (!ddJob.selection || ddJob.selection.index !== jobIdxKeep) ddJob.selection = jobIdxKeep;
            else { ddJob.selection = null; ddJob.selection = jobIdxKeep; }
        } catch (eRj) {}
        jobRestoring = false;
        try { ddJob.parent.layout.layout(true); } catch (eL) {}
    }
    function runMainScan(keepLabel, jobOnly) {
        if (scanning) return;
        if (SELF_PATH === "") { spAlert("Preflight cannot find its own script file, so it cannot scan. Please run it from File > Scripts."); return; }
        if (!ddJob.selection) { try { ddJob.selection = (jobIdxKeep >= 0 ? jobIdxKeep : 0); } catch (eJ) {} }
        if (ddJob.selection) jobIdxKeep = ddJob.selection.index; else jobIdxKeep = (jobIdxKeep >= 0 ? jobIdxKeep : 0);
        curType = typeAt(jobIdxKeep);
        gapEnabled = chkGap.value;
        var clientLabel = "";
        try { clientIdxKeep = ddClient.selection.index; clientLabel = CLIENTS[clientIdxKeep].label; } catch (eC) { if (clientIdxKeep >= 0) clientLabel = CLIENTS[clientIdxKeep].label; }
        var job = { typeIdx: jobIdxKeep, gap: gapEnabled, scopeIdx: scopeIdx, client: clientLabel, jobOnly: jobOnly ? true : false };
        scanning = true;
        scanStart();
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = spSendCode("$.global.__PF_JOB = " + job.toSource() + ";$.global.__PF_JOB.self = " + bt_lit(SELF_PATH) + ";$.global.__PF_RESULT = '';" +
            "var __f = new File(" + bt_lit(SELF_PATH) + ");__f.encoding = 'UTF-8';__f.open('r');var __s = __f.read();__f.close();" +
            "__s = __s.replace(/^#.*$/mg, '');eval(__s);$.global.__PF_RESULT;");
        bt.onResult = function (r) {
            scanning = false;
            scanEnd();
            restoreJobDropdown();
            try {
                var o = eval("(" + String(r.body) + ")");
                applyScanResult(o, keepLabel, jobOnly);
            } catch (eR) {
                spAlert("Something went wrong while reading the scan result.\n\nDetails: " + eR + (eR.line ? "  (line " + eR.line + ")" : "") + "\n\nReceived: " + String(r.body).substr(0, 160));
            }
        };
        bt.onError = function (er) {
            scanning = false;
            scanEnd();
            spAlert("The scan could not run:\n" + (er && er.body ? er.body : er));
        };
        bt.send();
    }
    var restoring = false;
    var clientIdxKeep = -1;
    // Something in the redraw (scan popup / relayout) can blank the dropdowns: put the choices back.
    function restoreSelections() {
        restoring = true;
        try { if (!ddJob.selection && jobIdxKeep >= 0) ddJob.selection = jobIdxKeep; } catch (e1) {}
        try { if (!ddClient.selection && clientIdxKeep >= 0) ddClient.selection = clientIdxKeep; } catch (e2) {}
        try { if (!ddArt.selection && ddArt.items.length > 0) ddArt.selection = (scopeIdx >= 0 && scopeIdx + 1 < ddArt.items.length) ? scopeIdx + 1 : 0; } catch (e3) {}
        restoring = false;
    }
    function applyScanResult(o, keepLabel, jobOnly) {
        restoreJobDropdown();
        if (!o || o.nodoc) { noDocument(); return; }
        if (o.error) {
            noDocument();
            detailTitle.text = "The scan failed: " + o.error;
            return;
        }
        lastMeta = o;
        scopeIdx = o.scopeIdx;
        scopeRect = o.scopeRect;
        unusedSwatchNames = o.unused || [];
        fillArtboards();
        if (o.std) stdResults = o.std;
        jobResults = o.job;
        fillSlots(stdSlots, stdResults);
        refreshJobSlots();
        relayout();
        updateSummary();
        if (!(keepLabel && showByLabel(keepLabel))) pickInitialDetails();
        restoreSelections();
    }
    function fullScan(keepLabel) { runMainScan(keepLabel, false); }
    function jobScan() { runMainScan(null, true); }
    function safely(fn, what) {
        return function () {
            try { fn(); }
            catch (e) { spAlert("Something went wrong while " + what + ".\n\nDetails: " + e + (e.line ? "  (line " + e.line + ")" : "") + "\n\nTry Rescan. If it happens again, send this message to Joao."); }
        };
    }
    ddJob.onChange = safely(function () {
        if (restoring) return;
        if (jobRestoring) return;
        if (ddJob.selection) jobIdxKeep = ddJob.selection.index;
        jobOffset = 0;
        try { app.preferences.setStringPreference("signpack/preflight/signtype", SIGN_TYPES[jobIdxKeep < 0 ? 0 : jobIdxKeep].label); } catch (eP) {}
        fullScan();   // the Text check depends on the sign type, so re-run everything
    }, "switching sign type");
    chkGap.onClick = safely(jobScan, "running the gap check");
    ddClient.onChange = safely(function () {
        if (restoring || !ddClient.selection) return;
        try { app.preferences.setStringPreference("signpack/preflight/client", CLIENTS[ddClient.selection.index].label); } catch (eP2) {}
        applyClientSettings(CLIENTS[ddClient.selection.index]);
        setModeUI();
        jobOffset = 0;
        fullScan();
    }, "switching client");
    ddArt.onChange = safely(function () {
        if (artFilling || restoring) return;
        scopeIdx = ddArt.selection ? ddArt.selection.index - 1 : -1;
        fullScan();
    }, "switching artboard");

    var btnGroup = win.add("group");
    btnGroup.orientation = "row";
    btnGroup.alignment = ["fill", "top"];
    btnGroup.alignChildren = ["left", "center"];
    btnGroup.spacing = 8;

    function mkBtn(text, w) {
        var b = btnGroup.add("button", undefined, text);
        b.preferredSize = [w, 30];
        return b;
    }
    var btnFocus = mkBtn("Focus Item", 88);
    var btnFix = mkBtn("Fix", 70);
    var btnIgnore = mkBtn("Ignore Row", 100);
    var btnRescan = mkBtn("Rescan", 75);
    var btnSave = mkBtn("Save Report", 100);
    var btnProd = mkBtn("Production", 90);
    var btnSpacer = btnGroup.add("group");
    btnSpacer.alignment = ["fill", "center"];
    var btnClose = mkBtn("Close", 70);
    btnProd.helpTip = "Opens Production Helper (checklist and Make buttons) for the selected sign type.";
    btnProd.onClick = safely(function () {
        var f = findSibling(SELF_PATH, /^Production[ _]Helper(?:[ _]*v?(\d+(?:\.\d+)*))?\.jsx$/i);
        if (!f) {
            spAlert("Production Helper was not found in the same folder as Preflight Check.\nPut both scripts in the same folder and try again.");
            return;
        }
        try { app.preferences.setStringPreference("signpack/prodhelper/signtype", SIGN_TYPES[ddJob.selection.index].label); } catch (ePr) {}
        try { if (ddClient.selection) app.preferences.setStringPreference("signpack/prodhelper/client", CLIENTS[ddClient.selection.index].label); } catch (ePc) {}
        launchScript(f, "signpack_prodhelper");
    }, "opening Production Helper");
    try { setModeUI(); } catch (eSm) {}
    btnFix.helpTip = "Fixes the selected row (only for rows that have a safe fix). Asks before changing anything.\nOn Named Colors it becomes Add Label: puts the selected color and its name in the file.";
    btnFocus.helpTip = "Selects the picked item in Illustrator and centers the view on it. Double-clicking the item in the list does the same.";
    btnRescan.helpTip = "Checks the open file again. Press it after you fix something.";
    btnSave.helpTip = "Saves the results as a PDF or a text file next to the open file (or on the Desktop if it was never saved).";
    btnClose.helpTip = "Closes Preflight Check.";
    ddJob.helpTip = "The sign type decides which checks apply and what the file needs (bleed, CutContour, layers...).";
    ddClient.helpTip = "A client profile can change the limits or the rules for some sign types. Use The Sign Pack unless the job has its own client rules.";
    ddArt.helpTip = "Check all artboards, or only one.";
    list.helpTip = "The problems found for the row you opened with View. Click one, then use Focus Item to see it in the file.";
    btnIgnore.helpTip = "Ignore the selected row for this file. Press again to check it again.";
    btnRescan.onClick = function () { try { fullScan(); } catch (e) { spAlert("Something went wrong while rescanning.\n\nDetails: " + e + (e.line ? "  (line " + e.line + ")" : "") + "\n\nMake sure a document is open and try again. If it happens again, send this message to Joao."); } };
    btnClose.onClick = function () { win.close(); };

    function updateButtons() {
        var r = curRes;
        btnFocus.enabled = (list.selection !== null && list.selection !== undefined);
        btnIgnore.enabled = !!r;
        btnIgnore.text = (r && r.ignored) ? "Unignore Row" : "Ignore Row";
        if (r && r.labelTool) {
            // Named Colors: the Fix button becomes "Add Label" for the selected color
            btnFix.text = "Add Label";
            if (btnFix.useAlt) btnFix.useAlt(true);
            var selRow = list.selection;
            btnFix.enabled = !!(selRow && detailIssues[selRow.index] && detailIssues[selRow.index].spec && !r.ignored);
            return;
        }
        btnFix.text = "Fix";
        if (btnFix.useAlt) btnFix.useAlt(false);
        btnFix.enabled = !!(r && r.fix && !r.ignored && (r.status === "bad" || r.status === "warn"));
    }
    list.onChange = function () { try { updateButtons(); } catch (eUb) {} };

    // ---- Simple dark dialogs ----
    function messageDialog(message, title) { spAlert(message, title || "Preflight Check"); }
    function confirmDialog(message, yesText) { return spConfirm(message, "Preflight Check", yesText); }

    // Runs in Illustrator's MAIN engine via BridgeTalk.
    function focusGeneric(collection, idx) {
        try {
            var d = app.activeDocument;
            if (collection === "artboard") {
                d.artboards.setActiveArtboardIndex(idx);
                app.redraw();
                return;
            }
            if (collection === "layer") {
                d.activeLayer = d.layers[idx];
                app.redraw();
                return;
            }
            var targetItem = null;
            if (collection === "placedItems") targetItem = d.placedItems[idx];
            else if (collection === "rasterItems") targetItem = d.rasterItems[idx];
            else if (collection === "textFrames") targetItem = d.textFrames[idx];
            else if (collection === "pageItems") {
                if (typeof idx === "string") {
                    var mm = idx.match(/^L(\d+):(\d+)$/);
                    targetItem = d.layers[parseInt(mm[1], 10)].pageItems[parseInt(mm[2], 10)];
                } else targetItem = d.pageItems[idx];
            }
            else if (collection === "pathItems") targetItem = d.pathItems[idx];
            else if (collection === "groupItems") targetItem = d.groupItems[idx];
            else if (collection === "compoundPathItems") targetItem = d.compoundPathItems[idx];
            if (!targetItem) { spAlert("Could not find that item. It may have moved, try Rescan."); return; }

            d.selection = null;
            var restoreList = [];
            restoreList.push({ obj: targetItem, locked: targetItem.locked, hidden: targetItem.hidden });
            targetItem.hidden = false;
            targetItem.locked = false;
            var parent = targetItem.parent;
            while (parent && parent.typename !== "Document") {
                var entry = { obj: parent, locked: null, hidden: null };
                if (parent.hasOwnProperty("locked")) { entry.locked = parent.locked; parent.locked = false; }
                if (parent.hasOwnProperty("hidden")) { entry.hidden = parent.hidden; parent.hidden = false; }
                restoreList.push(entry);
                parent = parent.parent;
            }
            targetItem.selected = true;
            var view = d.activeView;
            view.centerPoint = [targetItem.position[0] + targetItem.width / 2, targetItem.position[1] - targetItem.height / 2];
            app.redraw();
            for (var ri = 0; ri < restoreList.length; ri++) {
                var e2 = restoreList[ri];
                try { if (e2.locked !== null) e2.obj.locked = e2.locked; } catch (eR1) {}
                try { if (e2.hidden !== null) e2.obj.hidden = e2.hidden; } catch (eR2) {}
            }
        } catch (e) {
            spAlert("Could not select the item. If the document changed since the scan, run Rescan.\n" + e);
        }
    }

    // Runs in Illustrator's MAIN engine via BridgeTalk (self-contained, no outside variables).
    // Puts a color square + its name at the center of the view; each click stacks one below the last.
    function addColorLabelGeneric(spec, textStr, docName) {
        try {
            var doc = app.activeDocument;
            if (docName && doc.name !== docName) {
                spAlert("Nothing was added: the active document is " + doc.name + ", not " + docName + ".");
                return;
            }
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

            if (!$.global.__ccLegend) $.global.__ccLegend = { y: 0, cx: null, cy: null };
            var st = $.global.__ccLegend;
            var c = view.centerPoint;
            if (st.cx === null || Math.abs(c[0] - st.cx) > 5 || Math.abs(c[1] - st.cy) > 5) st.y = 0;
            st.cx = c[0]; st.cy = c[1];

            var top = c[1] + (size / 2) - st.y;
            var left = c[0] - 150;

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

            var txt = doc.textFrames.add();
            txt.contents = textStr;
            try { txt.textRange.characterAttributes.textFont = app.textFonts.getByName("Gotham-Medium"); } catch (e) {}
            try { txt.textRange.characterAttributes.size = 75; } catch (eSz) {}

            var textLeft = left + size + gap;
            var opticalNudge = 6;
            var textTop = (top - (size / 2)) + (txt.height / 2) - opticalNudge;
            txt.position = [textLeft, textTop];

            var group = doc.groupItems.add();
            rect.move(group, ElementPlacement.PLACEATEND);
            txt.move(group, ElementPlacement.PLACEATEND);

            st.y += (size + spacing);
            app.redraw();
        } catch (e) {
            spAlert("Could not create the label.\n" + e);
        }
    }

    // Runs in Illustrator's MAIN engine via BridgeTalk (self-contained, no outside variables).
    function fixGeneric(kind, arg, docName, scopeStr) {
        try {
            var d = app.activeDocument;
            if (docName && d.name !== docName) return "Nothing was changed: the active document is " + d.name + ", not " + docName + ".";
            var sfx = 1;
            try { if (d.scaleFactor) sfx = d.scaleFactor; } catch (e0) {}
            var rect = null;
            if (scopeStr) {
                var q = scopeStr.split(",");
                rect = [parseFloat(q[0]), parseFloat(q[1]), parseFloat(q[2]), parseFloat(q[3])];
            }
            function norm(n) { return ("" + n).toLowerCase().replace(/[\s_\-]/g, ""); }
            function inRect(it) {
                if (!rect) return true;
                try {
                    var b = it.geometricBounds;
                    return !(b[2] < rect[0] || b[0] > rect[2] || b[1] < rect[3] || b[3] > rect[1]);
                } catch (e) { return true; }
            }
            function onLayer(it, test) {
                var p = it, g = 0;
                while (p && g++ < 60) {
                    try {
                        if (p.typename === "Layer" && test(p.name)) return true;
                        if (p.typename === "Document") break;
                        p = p.parent;
                    } catch (e) { break; }
                }
                return false;
            }
            function black() {
                var c = new CMYKColor();
                c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 100;
                return c;
            }
            var changed = 0, failed = 0;
            if (kind === "swatches") {
                var names = arg.split("|~|");
                for (var n = 0; n < names.length; n++) {
                    if (names[n] === "") continue;
                    try { d.swatches.getByName(names[n]).remove(); changed++; } catch (eS) { failed++; }
                }
                return "Removed " + changed + " unused swatch" + (changed === 1 ? "" : "es") + "." + (failed ? " " + failed + " could not be removed." : "");
            }
            if (kind === "layers" || kind === "layerart" || kind === "extralayers") {
                // arg: entries "name^r,g,b^strokePt^element" joined by "|~|"
                var ents = arg.split("|~|"), specs = [];
                for (var e1 = 0; e1 < ents.length; e1++) {
                    if (ents[e1] === "") continue;
                    var f4 = ents[e1].split("^"), rg = f4[1].split(",");
                    specs.push({ name: f4[0], rgb: [parseInt(rg[0], 10), parseInt(rg[1], 10), parseInt(rg[2], 10)], stroke: f4[2] === "" ? 0 : parseFloat(f4[2]), element: f4[3] });
                }
                var lv = function (a, b) {
                    var m = a.length, n = b.length, dd = [], i, j;
                    for (i = 0; i <= m; i++) dd[i] = [i];
                    for (j = 1; j <= n; j++) dd[0][j] = j;
                    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
                        dd[i][j] = Math.min(dd[i - 1][j] + 1, Math.min(dd[i][j - 1] + 1, dd[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)));
                    return dd[m][n];
                };
                var all = [];
                (function walk(ls) { for (var w = 0; w < ls.length; w++) { all.push(ls[w]); try { if (ls[w].layers.length) walk(ls[w].layers); } catch (eW) {} } })(d.layers);
                var findLayer = function (sp) {
                    var want = norm(sp.name), q, best = null, bd = 99;
                    for (q = 0; q < all.length; q++) if (all[q].name === sp.name) return all[q];
                    for (q = 0; q < all.length; q++) if (norm(all[q].name) === want) return all[q];
                    for (q = 0; q < all.length; q++) {
                        var n2 = norm(all[q].name);
                        if (n2 === "") continue;
                        var dist = lv(n2, want);
                        var close = (dist <= 2 && dist < want.length - 1) || (n2.length >= 4 && want.indexOf(n2) === 0) || (want.length >= 4 && n2.indexOf(want) === 0);
                        if (close && dist < bd) { bd = dist; best = all[q]; }
                    }
                    return best;
                };
                var made = 0, renamed = 0, recol = 0, artFixed = 0, bad = 0;
                if (kind === "extralayers") {
                    var keepN = {};
                    for (var k1 = 0; k1 < specs.length; k1++) {
                        var fl = findLayer(specs[k1]);
                        if (!fl) continue;
                        var tl = fl, gg = 0;
                        while (tl && gg++ < 60) { try { if (tl.parent && tl.parent.typename === "Document") break; tl = tl.parent; } catch (eT) { break; } }
                        try { keepN[tl.name] = true; } catch (eK) {}
                    }
                    var anyKept = false;
                    for (var kk in keepN) anyKept = true;
                    if (!anyKept && specs.length > 0) {
                        var nl0 = d.layers.add();
                        nl0.name = specs[0].name;
                        keepN[specs[0].name] = true;
                    }
                    var gone = 0, items = 0;
                    for (var li2 = d.layers.length - 1; li2 >= 0; li2--) {
                        try {
                            var ly3 = d.layers[li2], nm3 = ly3.name;
                            if (keepN[nm3] || norm(nm3).indexOf("design") >= 0) continue;
                            try { items += ly3.pageItems.length; } catch (eC) {}
                            ly3.locked = false;
                            ly3.visible = true;
                            ly3.remove();
                            gone++;
                        } catch (eX) { bad++; }
                    }
                    try { app.redraw(); } catch (eR2) {}
                    return "Deleted " + gone + " extra layer" + (gone === 1 ? "" : "s") + " (" + items + " item" + (items === 1 ? "" : "s") + " on them)." +
                           (bad ? " " + bad + " could not be deleted." : "") + "\nPress Ctrl+Z in Illustrator to undo.";
                }
                if (kind === "layers") {
                    for (var s1 = 0; s1 < specs.length; s1++) {
                        var sp = specs[s1];
                        try {
                            var ly = findLayer(sp);
                            if (!ly) { ly = d.layers.add(); ly.name = sp.name; made++; }
                            else if (ly.name !== sp.name) { ly.name = sp.name; renamed++; }
                            var cc2 = ly.color, differs = Math.abs(cc2.red - sp.rgb[0]) > 3 || Math.abs(cc2.green - sp.rgb[1]) > 3 || Math.abs(cc2.blue - sp.rgb[2]) > 3;
                            if (differs) {
                                var nc = new RGBColor();
                                nc.red = sp.rgb[0]; nc.green = sp.rgb[1]; nc.blue = sp.rgb[2];
                                ly.color = nc;
                                recol++;
                            }
                        } catch (eL) { bad++; }
                    }
                    try { app.redraw(); } catch (eR0) {}
                    return "Layers fixed: " + made + " created, " + renamed + " renamed, " + recol + " colour" + (recol === 1 ? "" : "s") + " set." +
                           (bad ? " " + bad + " could not be changed." : "") + "\nPress Ctrl+Z in Illustrator to undo.";
                }
                // layerart: stroke of the paths on the layers that have a rule
                var spotC = null;
                for (var s2 = 0; s2 < specs.length; s2++) {
                    var sp2 = specs[s2];
                    if (!sp2.stroke && sp2.element === "") continue;
                    var ly2 = findLayer(sp2);
                    if (!ly2) continue;
                    var col2 = null;
                    if (sp2.element === "black") col2 = black();
                    else if (sp2.element === "magenta") {
                        if (!spotC) {
                            for (var si2 = 0; si2 < d.spots.length; si2++) if (norm(d.spots[si2].name) === "cutcontour") { spotC = d.spots[si2]; break; }
                            if (!spotC) {
                                spotC = d.spots.add();
                                spotC.name = "CutContour";
                                spotC.colorType = ColorModel.SPOT;
                                var mc = new CMYKColor();
                                mc.cyan = 0; mc.magenta = 100; mc.yellow = 0; mc.black = 0;
                                spotC.color = mc;
                            }
                        }
                        col2 = new SpotColor();
                        col2.spot = spotC;
                        col2.tint = 100;
                    }
                    var tgt = norm(ly2.name);
                    var pp = d.pathItems;
                    for (var pi2 = 0; pi2 < pp.length; pi2++) {
                        try {
                            var p2 = pp[pi2];
                            if (p2.guides || p2.clipping || !inRect(p2)) continue;
                            if (!onLayer(p2, function (nm) { return norm(nm) === tgt; })) continue;
                            p2.stroked = true;
                            if (col2) p2.strokeColor = col2;
                            if (sp2.stroke) p2.strokeWidth = sp2.stroke / sfx;
                            artFixed++;
                        } catch (eA) { bad++; }
                    }
                }
                try { app.redraw(); } catch (eR1) {}
                return "Fixed the stroke of " + artFixed + " path" + (artFixed === 1 ? "" : "s") + "." + (bad ? " " + bad + " could not be changed (locked layer or item?)." : "") + "\nPress Ctrl+Z in Illustrator to undo.";
            }
            var test = null, strokeCol = null, what = "";
            if (kind === "cut") {
                test = function (nm) { return norm(nm).indexOf("cutcontour") >= 0; };
                var spot = null;
                for (var si = 0; si < d.spots.length; si++) {
                    if (norm(d.spots[si].name) === "cutcontour") { spot = d.spots[si]; break; }
                }
                if (!spot) {
                    spot = d.spots.add();
                    spot.name = "CutContour";
                    spot.colorType = ColorModel.SPOT;
                    var cc = new CMYKColor();
                    cc.cyan = 0; cc.magenta = 100; cc.yellow = 0; cc.black = 0;
                    spot.color = cc;
                }
                strokeCol = new SpotColor();
                strokeCol.spot = spot;
                strokeCol.tint = 100;
                what = "CutContour layer";
            } else if (kind === "outline") {
                test = function (nm) { var x = norm(nm); return x.indexOf("outline") === 0 || x.indexOf("hole") >= 0; };
                strokeCol = black();
                what = "Outline / Holes layers";
            } else if (kind === "bbox") {
                test = function (nm) { var x = norm(nm); return x.indexOf("boundingbox") >= 0 || x.indexOf("bbox") >= 0; };
                if (arg === "k") strokeCol = black();
                what = "BoundingBox layer";
            } else {
                return "Unknown fix.";
            }
            var paths = d.pathItems;
            for (var i = 0; i < paths.length; i++) {
                try {
                    var p = paths[i];
                    if (p.guides || p.clipping) continue;
                    if (!inRect(p)) continue;
                    if (!onLayer(p, test)) continue;
                    p.filled = false;
                    if (strokeCol) {
                        p.stroked = true;
                        p.strokeColor = strokeCol;
                        p.strokeWidth = 1 / sfx;
                    } else {
                        p.stroked = false;
                    }
                    changed++;
                } catch (eP) { failed++; }
            }
            try { app.redraw(); } catch (eR) {}
            return "Fixed " + changed + " path" + (changed === 1 ? "" : "s") + " on the " + what + "." +
                   (failed ? " " + failed + " could not be changed (locked layer or item?)." : "") +
                   "\nPress Ctrl+Z in Illustrator to undo.";
        } catch (e) {
            return "The fix could not run: " + e;
        }
    }
    function bt_lit(str) {
        return '"' + String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"';
    }
    function runFix(kind, arg, afterLabel) {
        var dn = "";
        dn = lastMeta.docName;
        var sc = "";
        if (scopeRect) sc = scopeRect[0] + "," + scopeRect[1] + "," + scopeRect[2] + "," + scopeRect[3];
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = spSendCode("(" + String(fixGeneric) + ")(" + bt_lit(kind) + "," + bt_lit(arg) + "," + bt_lit(dn) + "," + bt_lit(sc) + ");");
        bt.onResult = function (r) {
            try { messageDialog(String(r.body), "Fix result"); } catch (e1) {}
            try { fullScan(afterLabel); } catch (e2) { try { messageDialog("Rescan after fix failed: " + e2, "Preflight"); } catch (e4) {} }
        };
        bt.onError = function (er) {
            try { messageDialog("The fix failed: " + er.body, "Fix result"); } catch (e3) {}
        };
        bt.send(60);
    }
    function askBBoxMode(defaultMode) {
        var result = null;
        var dlg = new Window("dialog", "Fix BoundingBox");
        paintWin(dlg);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 20;
        dlg.spacing = 12;
        dlg.add("statictext", undefined, "Both options remove any fill. Choose what the stroke should be:");
        var r1 = dlg.add("radiobutton", undefined, "No stroke (no fill, no stroke)");
        var r2 = dlg.add("radiobutton", undefined, "Stroke 100% K (C0 M0 Y0 K100), 1 pt");
        if (defaultMode === "k") r2.value = true; else r1.value = true;
        var bg = dlg.add("group");
        bg.alignment = ["center", "top"];
        bg.spacing = 12;
        var ok = bg.add("button", undefined, "Fix", { name: "ok" });
        var cn = bg.add("button", undefined, "Close", { name: "cancel" });
        ok.onClick = function () { result = r2.value ? "k" : "none"; dlg.close(); };
        cn.onClick = function () { result = null; dlg.close(); };
        paintStyle(dlg);
        dlg.center();
        dlg.show();
        return result;
    }
    function addLabelClicked() {
        var selRow = list.selection;
        var iss = selRow ? detailIssues[selRow.index] : null;
        if (!iss || !iss.spec) { messageDialog("Select a color in the list first."); return; }
        var bt = new BridgeTalk();
        bt.target = "illustrator";
        bt.body = spSendCode(POPUP_DEFS + "(" + String(addColorLabelGeneric) + ")(" + bt_lit(iss.spec) + "," + bt_lit(iss.name) + "," + bt_lit(lastMeta.docName) + ");");
        bt.send();
    }
    btnFix.onClick = safely(function () {
        if (curRes && curRes.labelTool) { addLabelClicked(); return; }
        if (!curRes || !curRes.fix) return;
        var kind = curRes.fix, label = curRes.label;
        var scopeNote = scopeRect ? "\n\nOnly items on the selected artboard are changed." : "";
        if (kind === "swatches") {
            if (unusedSwatchNames.length === 0) { messageDialog("There are no unused swatches to remove."); return; }
            if (!confirmDialog("Delete " + unusedSwatchNames.length + " unused swatch" + (unusedSwatchNames.length === 1 ? "" : "es") +
                " from this file? They are not used by any artwork, so the art does not change.\n\nYou can undo with Ctrl+Z.", "Delete swatches")) return;
            runFix("swatches", unusedSwatchNames.join("|~|"), label);
        } else if (kind === "layers" || kind === "layerart" || kind === "extralayers") {
            var specArg = [];
            for (var sl = 0; sl < curType.layers.length; sl++) {
                var sy = curType.layers[sl], rg = ST.colors[sy.color] || [0, 0, 0];
                specArg.push(sy.name + "^" + rg.join(",") + "^" + (sy.stroke ? sy.stroke : "") + "^" + (sy.element ? sy.element : ""));
            }
            if (kind === "extralayers") {
                if (!confirmDialog("Delete " + curRes.issues.length + " layer" + (curRes.issues.length === 1 ? "" : "s") + " that " + (curRes.issues.length === 1 ? "is" : "are") + " not in the spec for \"" + curType.label + "\", and EVERYTHING on " + (curRes.issues.length === 1 ? "it" : "them") +
                    ".\n\nLayers with \"design\" in the name are kept. Check the list first. You can undo with Ctrl+Z.", "Delete extra layers")) return;
            } else if (kind === "layers") {
                if (!confirmDialog("For the sign type \"" + curType.label + "\": create the missing layers, rename the misnamed ones to the spec name and set the layer colours.\n\n" +
                    "Layers that are not in the spec are not touched. You can undo with Ctrl+Z.", "Fix Layers")) return;
            } else {
                if (!confirmDialog("On the layers that have a stroke rule: set the stroke to the spec (1 pt, 100% black or 100% magenta CutContour spot). Fills are not changed." + scopeNote +
                    "\n\nThis changes how those shapes look. You can undo with Ctrl+Z.", "Fix Layer Art")) return;
            }
            runFix(kind, specArg.join("|~|"), label);
        } else if (kind === "cut") {
            if (!confirmDialog("On the CutContour layer: remove any fill and set the stroke to the CutContour spot color at 100%, 1 pt. " +
                "If the CutContour swatch does not exist, it is created (100% magenta spot).\n\nThis changes how those shapes look. You can undo with Ctrl+Z." + scopeNote, "Fix CutContour")) return;
            runFix("cut", "", label);
        } else if (kind === "outline") {
            if (!confirmDialog("On the Outline and Holes layers: remove any fill and set the stroke to 100% black (C0 M0 Y0 K100), 1 pt.\n\n" +
                "This changes how those shapes look. White Ink layers are not touched. You can undo with Ctrl+Z." + scopeNote, "Fix Outline / Holes")) return;
            runFix("outline", "", label);
        } else if (kind === "bbox") {
            var mode = askBBoxMode(curRes.fixDefault || "none");
            if (mode === null) return;
            if (!confirmDialog("On the BoundingBox layer: remove any fill" + (mode === "k" ? " and set a 100% K stroke, 1 pt." : " and any stroke.") +
                "\n\nYou can undo with Ctrl+Z." + scopeNote, "Fix BoundingBox")) return;
            runFix("bbox", mode, label);
        }
    }, "fixing this row");
    btnIgnore.onClick = safely(function () {
        if (!curRes) return;
        var key = ignoreKey(curRes.label), lbl = curRes.label;
        if (ignoredMap[key]) delete ignoredMap[key]; else ignoredMap[key] = true;
        saveIgnored();
        fullScan(lbl);
    }, "ignoring this row");

    var doFocus = function () {
        if (list.selection !== null) {
            var issue = detailIssues[list.selection.index];
            if (!issue || !issue.collection || issue.idx === null || issue.idx === undefined) {
                spAlert("This item can't be shown in the file. Select it by hand in Illustrator instead.");
                return;
            }
            var bt = new BridgeTalk();
            bt.target = "illustrator";
            bt.body = spSendCode(POPUP_DEFS + "(" + String(focusGeneric) + ')("' + issue.collection + '", ' + (typeof issue.idx === "string" ? '"' + issue.idx + '"' : issue.idx) + ");");
            bt.send();
        }
    };
    btnFocus.onClick = doFocus;
    list.onDoubleClick = doFocus;

    // ---- PDF report writer (plain PDF 1.4, standard Helvetica, ASCII only) ----
    function pdfAscii(t) { return String(t).replace(/[^\x20-\x7e]/g, "?"); }
    function pdfEsc(t) { return pdfAscii(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
    function pdfNum(x) { return String(Math.round(x * 100) / 100); }
    function pdfWrap(text, maxChars) {
        var words = pdfAscii(text).split(" "), lines = [], cur = "";
        for (var i = 0; i < words.length; i++) {
            var w = words[i];
            while (w.length > maxChars) {
                if (cur !== "") { lines.push(cur); cur = ""; }
                lines.push(w.substr(0, maxChars));
                w = w.substr(maxChars);
            }
            if (cur === "") cur = w;
            else if ((cur + " " + w).length <= maxChars) cur += " " + w;
            else { lines.push(cur); cur = w; }
        }
        if (cur !== "" || lines.length === 0) lines.push(cur);
        return lines;
    }
    // model: { title, meta:[strings], summary, summaryStatus, sections:[{title, rows:[{status,label,info,ignored,issues:[strings]}]}] }
    function buildPdf(model) {
        var PW = 612, PH = 792, M = 50;
        var pages = [], cur = null, y = 0;
        var COL = {
            ok: "0.18 0.68 0.33", warn: "0.96 0.74 0.10", bad: "0.88 0.20 0.20", off: "0.62 0.62 0.62",
            dark: "0.12 0.12 0.12", grey: "0.40 0.40 0.40", white: "1 1 1", line: "0.80 0.80 0.80"
        };
        function newPage() { cur = []; pages.push(cur); y = PH - M; }
        function txt(x, yy, size, bold, str, col) {
            cur.push("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + COL[col || "dark"] + " rg " + pdfNum(x) + " " + pdfNum(yy) + " Td (" + pdfEsc(str) + ") Tj ET");
        }
        function circle(cx, cy, r, col) {
            var k = 0.5523 * r;
            cur.push(COL[col] + " rg " + pdfNum(cx + r) + " " + pdfNum(cy) + " m " +
                pdfNum(cx + r) + " " + pdfNum(cy + k) + " " + pdfNum(cx + k) + " " + pdfNum(cy + r) + " " + pdfNum(cx) + " " + pdfNum(cy + r) + " c " +
                pdfNum(cx - k) + " " + pdfNum(cy + r) + " " + pdfNum(cx - r) + " " + pdfNum(cy + k) + " " + pdfNum(cx - r) + " " + pdfNum(cy) + " c " +
                pdfNum(cx - r) + " " + pdfNum(cy - k) + " " + pdfNum(cx - k) + " " + pdfNum(cy - r) + " " + pdfNum(cx) + " " + pdfNum(cy - r) + " c " +
                pdfNum(cx + k) + " " + pdfNum(cy - r) + " " + pdfNum(cx + r) + " " + pdfNum(cy - k) + " " + pdfNum(cx + r) + " " + pdfNum(cy) + " c f");
        }
        function strokeLines(pts, width) {
            var s = COL.white + " RG " + pdfNum(width) + " w 1 J 1 j " + pdfNum(pts[0][0]) + " " + pdfNum(pts[0][1]) + " m";
            for (var i = 1; i < pts.length; i++) s += " " + pdfNum(pts[i][0]) + " " + pdfNum(pts[i][1]) + " l";
            cur.push(s + " S");
        }
        function icon(cx, cy, r, status) {
            var u = r / 6;
            if (status === "warn") {
                cur.push(COL.warn + " rg " + pdfNum(cx) + " " + pdfNum(cy + r) + " m " + pdfNum(cx + r * 1.1) + " " + pdfNum(cy - r * 0.8) + " l " +
                    pdfNum(cx - r * 1.1) + " " + pdfNum(cy - r * 0.8) + " l f");
                cur.push(COL.dark + " rg " + pdfNum(cx - 0.6 * u) + " " + pdfNum(cy - 1.2 * u) + " " + pdfNum(1.2 * u) + " " + pdfNum(3.6 * u) + " re f");
                cur.push(COL.dark + " rg " + pdfNum(cx - 0.6 * u) + " " + pdfNum(cy - 3.4 * u) + " " + pdfNum(1.2 * u) + " " + pdfNum(1.2 * u) + " re f");
                return;
            }
            circle(cx, cy, r, status);
            if (status === "ok") strokeLines([[cx - 3 * u, cy], [cx - 1 * u, cy - 2.6 * u], [cx + 3.2 * u, cy + 2.8 * u]], 1.5 * u);
            else if (status === "bad") { strokeLines([[cx - 2.4 * u, cy - 2.4 * u], [cx + 2.4 * u, cy + 2.4 * u]], 1.5 * u); strokeLines([[cx - 2.4 * u, cy + 2.4 * u], [cx + 2.4 * u, cy - 2.4 * u]], 1.5 * u); }
            else strokeLines([[cx - 2.8 * u, cy], [cx + 2.8 * u, cy]], 1.5 * u);
        }
        function need(h) { if (y - h < M + 14) newPage(); }

        newPage();
        txt(M, y - 16, 20, true, model.title);
        y -= 38;
        for (var m = 0; m < model.meta.length; m++) { txt(M, y, 10, false, model.meta[m], "grey"); y -= 14; }
        y -= 8;
        icon(M + 10, y - 6, 10, model.summaryStatus);
        txt(M + 28, y - 10, 14, true, model.summary);
        y -= 34;

        for (var s = 0; s < model.sections.length; s++) {
            var sec = model.sections[s];
            need(40);
            txt(M, y - 10, 11, true, sec.title, "grey");
            cur.push(COL.line + " RG 0.6 w " + M + " " + pdfNum(y - 15) + " m " + (PW - M) + " " + pdfNum(y - 15) + " l S");
            y -= 28;
            for (var r = 0; r < sec.rows.length; r++) {
                var row = sec.rows[r];
                need(26);
                icon(M + 8, y - 4, 6.5, row.status);
                txt(M + 24, y - 8, 10.5, true, row.label + (row.ignored ? "  (ignored)" : ""));
                y -= 16;
                var extra = [];
                if (row.info) { var il = pdfWrap(row.info, 105); for (var a = 0; a < il.length; a++) extra.push({ t: il[a], c: "grey", ind: 24 }); }
                var maxIssues = 40;
                for (var q = 0; q < row.issues.length && q < maxIssues; q++) {
                    var wl = pdfWrap(row.issues[q], 100);
                    for (var b = 0; b < wl.length; b++) extra.push({ t: (b === 0 ? "- " : "  ") + wl[b], c: "dark", ind: 30 });
                }
                if (row.issues.length > maxIssues) extra.push({ t: "...and " + (row.issues.length - maxIssues) + " more", c: "grey", ind: 30 });
                for (var e = 0; e < extra.length; e++) {
                    need(12);
                    txt(M + extra[e].ind, y - 7, 8.5, false, extra[e].t, extra[e].c);
                    y -= 11.5;
                }
                y -= 7;
            }
            y -= 6;
        }
        for (var pg = 0; pg < pages.length; pg++) {
            cur = pages[pg];
            txt(PW - M - 60, 28, 8, false, "Page " + (pg + 1) + " of " + pages.length, "grey");
        }

        var out = "%PDF-1.4\n", offs = [];
        function addObj(body) { offs.push(out.length); out += offs.length + " 0 obj\n" + body + "\nendobj\n"; }
        var kids = [];
        for (var k = 0; k < pages.length; k++) kids.push((5 + 2 * k) + " 0 R");
        addObj("<< /Type /Catalog /Pages 2 0 R >>");
        addObj("<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pages.length + " >>");
        addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        for (var p2 = 0; p2 < pages.length; p2++) {
            var content = pages[p2].join("\n");
            addObj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (6 + 2 * p2) + " 0 R >>");
            addObj("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
        }
        var xref = out.length;
        out += "xref\n0 " + (offs.length + 1) + "\n0000000000 65535 f \n";
        for (var o = 0; o < offs.length; o++) {
            var n = String(offs[o]);
            while (n.length < 10) n = "0" + n;
            out += n + " 00000 n \n";
        }
        out += "trailer\n<< /Size " + (offs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
        return out;
    }

    function timestampSuffix() {
        var d = new Date();
        function p2(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "_" + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    }
    function nowText() {
        var d = new Date();
        function p2(n) { return (n < 10 ? "0" : "") + n; }
        return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    }
    function statusWord(s) { return s === "ok" ? "OK" : s === "warn" ? "CHECK" : s === "bad" ? "WRONG" : "NOT RUN"; }
    function reportIssueLines(res, limit) {
        var out = [];
        for (var j = 0; j < res.issues.length && j < limit; j++) {
            var iss = res.issues[j];
            var ab = artboardLabel(iss);
            out.push(iss.check + " | " + iss.name + " | " + iss.detail + (ab ? " [Artboard: " + ab + "]" : ""));
        }
        if (res.issues.length > limit) out.push("...and " + (res.issues.length - limit) + " more");
        return out;
    }
    function scopeText() {
        try {
            if (scopeIdx >= 0) return ddArt.selection.text;
            if (lastMeta.selCount > 0) return "Selection (" + lastMeta.selCount + " item" + (lastMeta.selCount === 1 ? "" : "s") + ")";
            return "All artboards";
        } catch (e) { return "All artboards"; }
    }
    function buildReportModel() {
        var si = summaryInfo();
        var model = {
            title: "Preflight Report",
            meta: [
                "File: " + lastMeta.docName,
                "Client: " + CLIENTS[ddClient.selection.index].label + "     Sign type: " + SIGN_TYPES[ddJob.selection.index].label,
                "Artboards: " + scopeText(),
                "Date: " + nowText()
            ],
            summary: si.text,
            summaryStatus: si.status,
            sections: []
        };
        var groups = [["STANDARD CHECKS", stdResults], ["SIGN TYPE CHECKS", jobResults]];
        for (var g = 0; g < groups.length; g++) {
            var rows = [];
            for (var r = 0; r < groups[g][1].length; r++) {
                var res = groups[g][1][r];
                rows.push({ status: res.status, label: res.label, info: res.info, ignored: res.ignored, issues: reportIssueLines(res, 41) });
            }
            model.sections.push({ title: groups[g][0], rows: rows });
        }
        return model;
    }
    function writePdfReport(f) {
        var data = buildPdf(buildReportModel());
        f.encoding = "BINARY";
        f.lineFeed = "Unix";
        if (!f.open("w")) throw new Error("Could not open the file for writing.");
        f.write(data);
        f.close();
    }
    function writeTxtReport(f) {
        var si = summaryInfo();
        f.encoding = "UTF-8";
        f.open("w");
        f.writeln("Preflight Report for: " + lastMeta.docName);
        f.writeln("Client: " + CLIENTS[ddClient.selection.index].label);
        f.writeln("Sign type: " + SIGN_TYPES[ddJob.selection.index].label);
        f.writeln("Artboards: " + scopeText());
        f.writeln("Generated: " + nowText());
        f.writeln("Summary: " + si.text);
        var sections = [["STANDARD CHECKS", stdResults], ["SIGN TYPE CHECKS", jobResults]];
        for (var s2 = 0; s2 < sections.length; s2++) {
            f.writeln("");
            f.writeln("== " + sections[s2][0] + " ==");
            for (var r = 0; r < sections[s2][1].length; r++) {
                var res = sections[s2][1][r];
                f.writeln("[" + statusWord(res.status) + "] " + res.label + (res.ignored ? "  (ignored)" : ""));
                if (res.info) f.writeln("      " + res.info);
                var lines = reportIssueLines(res, 200);
                for (var j = 0; j < lines.length; j++) f.writeln("      " + lines[j]);
            }
        }
        f.close();
    }
    function askReportFormat() {
        var last = "pdf";
        try { last = app.preferences.getStringPreference("signpack/preflight/reportfmt") || "pdf"; } catch (e) {}
        var result = null;
        var dlg = new Window("dialog", "Save Report");
        paintWin(dlg);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.margins = 20;
        dlg.spacing = 12;
        dlg.add("statictext", undefined, "Save the report as:");
        var rPdf = dlg.add("radiobutton", undefined, "PDF (with the status icons)");
        var rTxt = dlg.add("radiobutton", undefined, "Text file (.txt)");
        if (last === "txt") rTxt.value = true; else rPdf.value = true;
        var bg = dlg.add("group");
        bg.alignment = ["center", "top"];
        bg.spacing = 12;
        var ok = bg.add("button", undefined, "Save", { name: "ok" });
        var cn = bg.add("button", undefined, "Close", { name: "cancel" });
        ok.onClick = function () { result = rPdf.value ? "pdf" : "txt"; dlg.close(); };
        cn.onClick = function () { result = null; dlg.close(); };
        paintStyle(dlg);
        dlg.center();
        dlg.show();
        if (result) { try { app.preferences.setStringPreference("signpack/preflight/reportfmt", result); } catch (e2) {} }
        return result;
    }
    function savedDialog(f) {
        try {
            var dlg = new Window("dialog", "Report saved");
            paintWin(dlg);
            dlg.orientation = "column";
            dlg.alignChildren = ["fill", "top"];
            dlg.margins = 20;
            dlg.spacing = 14;
            var t = dlg.add("statictext", undefined, "Report saved to:\n" + f.fsName, { multiline: true });
            t.preferredSize = [420, 50];
            var bg = dlg.add("group");
            bg.alignment = ["center", "top"];
            bg.spacing = 12;
            var open = bg.add("button", undefined, "Open", {});
            var ok = bg.add("button", undefined, "Close", { name: "ok" });
            open.onClick = function () { try { f.execute(); } catch (e) {} dlg.close(); };
            ok.onClick = function () { dlg.close(); };
            paintStyle(dlg);
            dlg.center();
            dlg.show();
        } catch (e) { spAlert("Report saved to:\n" + f.fsName); }
    }
    btnSave.onClick = safely(function () {
        if (!curRes && stdResults.length === 0) { messageDialog("There is nothing to save yet. Open a file, press Rescan, then save the report."); return; }
        var fmt = askReportFormat();
        if (!fmt) return;
        var docSavedPath = "";
        docSavedPath = lastMeta.docPath || "";
        var base = (docSavedPath !== "") ? docSavedPath : Folder.desktop.fsName;
        var f = new File(base + "/Preflight_Report_" + timestampSuffix() + "." + fmt);
        if (fmt === "pdf") writePdfReport(f); else writeTxtReport(f);
        savedDialog(f);
    }, "saving the report");

    stdSlots = makeSlots(stdPanel, STANDARD.length);
    jobSlots = makeSlots(jobRows, VIEW_ROWS);
    loadIgnored();
    updateButtons();
    fullScan();                 // scan BEFORE showing so the window opens at its final size
    paintStyle(win);
    styleGreenButton(btnFix, BTN_FIX, BTN_ADDLABEL);
    if (btnFix.useAlt) btnFix.useAlt(btnFix.text === "Add Label");
    win.location = uik().pos();
    win.show();
    TSP_RESULT = "SUCCESS: " + TSP_NAME + ": opened.";
}

main();

// last value of the file = what Sign Pack Tools shows in its status bar
(TSP_RESULT === "" ? ("WARNING: " + TSP_NAME + ": cancelled.") : TSP_RESULT);
