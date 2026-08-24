// ============================================================
//  Area Calculator Pro.jsx (Fixed for ExtendScript)
//  Calculates square footage with a native UI.
//  Handles Groups, Clipping Masks, and Large Canvas scaling.
// ============================================================

#target illustrator
#targetengine "areacalc_fixed"

(function () {

    // ------------------ SETTINGS ------------------
    var DECIMALS = 2;                // Decimal places for output
    var LAYER_NAME = "Measurements"; // Layer name reference (optional)
    // ----------------------------------------------

    if (app.documents.length === 0) {
        alert("Please open an Illustrator document first.");
        return;
    }

    var doc = app.activeDocument;
    
    // Handle "Large Canvas" scaling (1/10 scale documents)
    var docScale = 1;
    try { 
        if (doc.scaleFactor) docScale = doc.scaleFactor; 
    } catch (e) {}

    // --- Helper: Get True Bounds (Respects Groups & Clipping Masks) ---
    function getTrueBounds(item) {
        if (!item || item.hidden) return null;
        
        // Skip guides
        if (item.typename === "PathItem" && item.guides) return null;

        // Handle Groups
        if (item.typename === "GroupItem") {
            // Check for Clipping Mask
            if (item.clipped) {
                for (var i = 0; i < item.pageItems.length; i++) {
                    var child = item.pageItems[i];
                    if (child.typename === "PathItem" && child.clipping) {
                        return child.geometricBounds;
                    }
                    // Compound path clipping
                    if (child.typename === "CompoundPathItem" && child.pathItems.length > 0 && child.pathItems[0].clipping) {
                        return child.pathItems[0].geometricBounds;
                    }
                }
            }
            
            // Recursive union of all children
            var union = null;
            for (var j = 0; j < item.pageItems.length; j++) {
                var childBounds = getTrueBounds(item.pageItems[j]);
                if (!childBounds) continue;
                
                if (!union) {
                    union = [childBounds[0], childBounds[1], childBounds[2], childBounds[3]];
                } else {
                    if (childBounds[0] < union[0]) union[0] = childBounds[0];
                    if (childBounds[1] > union[1]) union[1] = childBounds[1];
                    if (childBounds[2] > union[2]) union[2] = childBounds[2];
                    if (childBounds[3] < union[3]) union[3] = childBounds[3];
                }
            }
            return union;
        }

        // Standard Path/Compound Path
        if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
            return item.geometricBounds;
        }

        return null;
    }

    // --- Process Selection ---
    if (doc.selection.length === 0) {
        alert("Please select one or more objects (Paths, Groups, or Clipped Art) to calculate area.");
        return;
    }

    var itemsData = [];
    var hasErrors = false;

    for (var i = 0; i < doc.selection.length; i++) {
        var sel = doc.selection[i];
        var bounds = getTrueBounds(sel);

        if (!bounds) {
            // Skip guides or hidden items silently
            continue;
        }

        // Calculate dimensions in Inches
        var wIn = ((bounds[2] - bounds[0]) / 72) * docScale;
        var hIn = ((bounds[1] - bounds[3]) / 72) * docScale;
        var sqFt = (wIn * hIn) / 144;

        // Determine Name
        var name = sel.name;
        if (!name || name === "") {
            name = (sel.typename === "GroupItem") ? "Group #" + (i + 1) : "Path #" + (i + 1);
        }

        itemsData.push({
            name: name,
            width: wIn,
            height: hIn,
            sqFt: sqFt,
            typeName: sel.typename
        });
    }

    if (itemsData.length === 0) {
        alert("No measurable objects found in the selection. Please select visible Paths or Groups.");
        return;
    }

    // --- Build UI ---
    try {
        if ($.global.__areaCalcWin && $.global.__areaCalcWin instanceof Window) {
            $.global.__areaCalcWin.close();
        }
    } catch (e) {}

    var win = new Window("palette", "Area Calculator Pro");
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 12;

    // Headers
    var headerGrp = win.add("group");
    headerGrp.spacing = 6;
    var hName = headerGrp.add("statictext", undefined, "Item"); 
    hName.preferredSize.width = 120;
    var hDim = headerGrp.add("statictext", undefined, "Dims (in)"); 
    hDim.preferredSize.width = 90;
    var hSqFt = headerGrp.add("statictext", undefined, "Sq Ft"); 
    hSqFt.preferredSize.width = 60;
    
    // Make headers bold
    var headers = [hName, hDim, hSqFt];
    for (var h = 0; h < headers.length; h++) {
        headers[h].graphics.font = ScriptUI.newFont(headers[h].graphics.font.name, "BOLD", headers[h].graphics.font.size);
    }

    // List Container
    var listPanel = win.add("panel");
    listPanel.alignChildren = ["fill", "top"];
    if (itemsData.length > 12) {
        listPanel.maximumSize.height = 350;
    }
    
    var totalSqFt = 0;
    var subtotalLabels = [];

    // Use standard FOR loop instead of forEach
    for (var r = 0; r < itemsData.length; r++) {
        var row = itemsData[r];
        totalSqFt += row.sqFt;

        var rowGrp = listPanel.add("group");
        rowGrp.spacing = 6;
        rowGrp.alignChildren = ["left", "center"];

        var txtName = rowGrp.add("statictext", undefined, row.name);
        txtName.preferredSize.width = 120;
        txtName.truncation = "ellipsis";

        var txtDim = rowGrp.add("statictext", undefined, row.width.toFixed(1) + '" x ' + row.height.toFixed(1) + '"');
        txtDim.preferredSize.width = 90;

        var txtVal = rowGrp.add("statictext", undefined, row.sqFt.toFixed(DECIMALS));
        txtVal.preferredSize.width = 60;
        txtVal.justify = "right";
        
        subtotalLabels.push(txtVal);
    }

    // Footer / Total
    win.add("panel").preferredSize.height = 1; // Separator

    var footerGrp = win.add("group");
    footerGrp.alignment = ["fill", "bottom"];
    footerGrp.spacing = 10;

    var lblTotal = footerGrp.add("statictext", undefined, "TOTAL:");
    lblTotal.graphics.font = ScriptUI.newFont(lblTotal.graphics.font.name, "BOLD", lblTotal.graphics.font.size + 2);

    var txtTotal = footerGrp.add("edittext", undefined, totalSqFt.toFixed(DECIMALS));
    txtTotal.readonly = true;
    txtTotal.characters = 12;
    txtTotal.justify = "right";
    
    // Allow copying via Ctrl+A / Ctrl+C
    txtTotal.onActivate = function() {
        this.active = true;
        this.textSelection = [0, this.text.length];
    };

    var btnCopy = footerGrp.add("button", undefined, "Copy Number");
    btnCopy.preferredSize.width = 100;
    btnCopy.onClick = function() {
        // Select all text so user can just hit Ctrl+C
        txtTotal.active = true;
        txtTotal.textSelection = [0, txtTotal.text.length];
        alert("Selected! Press Ctrl+C (Cmd+C) to copy the total.");
    };

    var btnClose = footerGrp.add("button", undefined, "Close", { name: "cancel" });
    btnClose.onClick = function() { win.close(); };

    win.show();

})();