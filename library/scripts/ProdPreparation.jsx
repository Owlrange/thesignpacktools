#target illustrator

var RESULT = "";

//==================================================
// CONFIGURATION
//==================================================

var DESIGN_LAYER_NAME =
"Design";

//==================================================
// DOCUMENT
//==================================================

var doc =
null;

//==================================================
// DESIGN LAYER COLOR
//==================================================

function createColor(
r,
g,
b
){

var color =
    new RGBColor();


color.red =
    r;

color.green =
    g;

color.blue =
    b;


return color;

}

//==================================================
// FIND LAYER
//==================================================

function getLayerByName(
doc,
name
){

for (
    var i = 0;
    i < doc.layers.length;
    i++
) {

    if (
        doc.layers[i].name ===
        name
    ) {

        return doc.layers[i];

    }

}


return null;

}

//==================================================
// CREATE OR GET DESIGN LAYER
//==================================================

function getDesignLayer(
doc
){

var layer =
    getLayerByName(
        doc,
        DESIGN_LAYER_NAME
    );


if (
    layer === null
) {

    layer =
        doc.layers.add();


    layer.name =
        DESIGN_LAYER_NAME;

}


layer.locked =
    false;

layer.visible =
    true;


layer.color =
    createColor(
        255,
        102,
        0
    );


return layer;

}

//==================================================
// CHECK OBJECT RELATIONSHIP
//==================================================

function isChildOf(
item,
parent
){

var current =
    item.parent;


while (
    current
) {

    if (
        current ===
        parent
    ) {

        return true;

    }


    current =
        current.parent;

}


return false;

}

//==================================================
// DETERMINE WHETHER AN ITEM SHOULD BE KEPT
//==================================================

function shouldKeep(
item,
keep
){

for (
    var i = 0;
    i < keep.length;
    i++
) {

    var selected =
        keep[i];


    // The item itself

    if (
        item ===
        selected
    ) {

        return true;

    }


    // The item is inside a selected object

    if (
        isChildOf(
            item,
            selected
        )
    ) {

        return true;

    }


    // A selected object is inside the item

    if (
        isChildOf(
            selected,
            item
        )
    ) {

        return true;

    }

}


return false;

}

//==================================================
// REMOVE UNSELECTED ITEMS
//==================================================

function removeUnselectedItems(
doc,
keep
){

for (
    var i =
        doc.pageItems.length - 1;

    i >= 0;

    i--
) {

    var item =
        doc.pageItems[i];


    try {

        if (
            !shouldKeep(
                item,
                keep
            )
        ) {

            item.remove();

        }

    }
    catch (e) {}

}

}

//==================================================
// MOVE SELECTION TO DESIGN LAYER
//==================================================

function moveSelectionToDesign(
keep,
designLayer
){

for (
    var i = 0;
    i < keep.length;
    i++
) {

    try {

        keep[i].move(
            designLayer,
            ElementPlacement.PLACEATEND
        );

    }
    catch (e) {}

}

}

//==================================================
// REMOVE ALL OTHER LAYERS
//==================================================

function removeOtherLayers(
doc,
designLayer
){

for (
    var i =
        doc.layers.length - 1;

    i >= 0;

    i--
) {

    var layer =
        doc.layers[i];


    if (
        layer ===
        designLayer
    ) {

        continue;

    }


    try {

        layer.locked =
            false;

        layer.visible =
            true;


        layer.remove();

    }
    catch (e) {}

}

}

//==================================================
// SORT ITEMS
//
// Priority:
// 1. Top to bottom
// 2. Left to right when objects are on the same row
//
// Result:
// Top-left object first
//==================================================

function sortItems(
items
){

items.sort(
    function(
        a,
        b
    ){

        var ab =
            a.visibleBounds;

        var bb =
            b.visibleBounds;


        var ay =
            (
                ab[1] +
                ab[3]
            ) / 2;

        var by =
            (
                bb[1] +
                bb[3]
            ) / 2;


        var ax =
            (
                ab[0] +
                ab[2]
            ) / 2;

        var bx =
            (
                bb[0] +
                bb[2]
            ) / 2;


        // Tolerance used to determine
        // whether objects are on the same row

        var tolerance =
            5;


        if (
            Math.abs(
                ay -
                by
            ) >
            tolerance
        ) {

            return (
                by -
                ay
            );

        }


        return (
            ax -
            bx
        );

    }
);

}

//==================================================
// CREATE ARTBOARDS FROM ITEMS
//==================================================

function createArtboardsFromItems(
doc,
items
){

var boundsList =
    [];


// Capture bounds before modifying artboards

for (
    var i = 0;
    i < items.length;
    i++
) {

    try {

        var b =
            items[i]
                .visibleBounds;


        boundsList.push({

            left:
                b[0],

            top:
                b[1],

            right:
                b[2],

            bottom:
                b[3]

        });

    }
    catch (e) {}

}


if (
    boundsList.length ===
    0
) {

    throw new Error(
        "Unable to retrieve the bounds of the selected objects."
    );

}


// Remove all existing artboards,
// temporarily keeping the first one

while (
    doc.artboards.length >
    1
) {

    doc.artboards.remove(
        doc.artboards.length -
        1
    );

}


// Reuse the first artboard
// for the first object

for (
    var i = 0;
    i < boundsList.length;
    i++
) {

    var b =
        boundsList[i];


    if (
        i === 0
    ) {

        doc.artboards[0]
            .artboardRect = [

                b.left,
                b.top,
                b.right,
                b.bottom

            ];

    }
    else {

        doc.artboards.add([

            b.left,
            b.top,
            b.right,
            b.bottom

        ]);

    }

}

}

//==================================================
// SWATCH CLEANUP
//==================================================

//--------------------------------------------------
// COLOR HELPERS
//--------------------------------------------------

function isTrueSpotColor(color) {
    try {
        return (
            color &&
            color.typename === "SpotColor" &&
            color.spot &&
            color.spot.colorType === ColorModel.SPOT
        );
    } catch (e) {
        return false;
    }
}

function isProcessSpotColor(color) {
    try {
        return (
            color &&
            color.typename === "SpotColor" &&
            color.spot &&
            color.spot.colorType === ColorModel.PROCESS
        );
    } catch (e) {
        return false;
    }
}

function cloneProcessColor(color) {
    var newColor;

    if (color.typename === "CMYKColor") {
        newColor = new CMYKColor();
        newColor.cyan = color.cyan;
        newColor.magenta = color.magenta;
        newColor.yellow = color.yellow;
        newColor.black = color.black;
        return newColor;
    }

    if (color.typename === "RGBColor") {
        newColor = new RGBColor();
        newColor.red = color.red;
        newColor.green = color.green;
        newColor.blue = color.blue;
        return newColor;
    }

    if (color.typename === "GrayColor") {
        newColor = new GrayColor();
        newColor.gray = color.gray;
        return newColor;
    }

    if (color.typename === "LabColor") {
        newColor = new LabColor();
        newColor.l = color.l;
        newColor.a = color.a;
        newColor.b = color.b;
        return newColor;
    }

    return color;
}

function getProcessColorFromSpotColor(spotColor) {
    try {
        return cloneProcessColor(spotColor.spot.color);
    } catch (e) {
        return null;
    }
}

//--------------------------------------------------
// UNLINK PROCESS GLOBAL COLORS
//--------------------------------------------------

function unlinkProcessGlobalColors(doc) {
    var convertedCount = 0;
    var pathItems = doc.pathItems;
    var textFrames = doc.textFrames;
    var i;
    var j;

    for (i = 0; i < pathItems.length; i++) {
        var path = pathItems[i];

        try {
            if (path.filled && isProcessSpotColor(path.fillColor)) {
                var processFill = getProcessColorFromSpotColor(path.fillColor);

                if (processFill) {
                    path.fillColor = processFill;
                    convertedCount++;
                }
            }
        } catch (eFill) {}

        try {
            if (path.stroked && isProcessSpotColor(path.strokeColor)) {
                var processStroke = getProcessColorFromSpotColor(path.strokeColor);

                if (processStroke) {
                    path.strokeColor = processStroke;
                    convertedCount++;
                }
            }
        } catch (eStroke) {}
    }

    for (i = 0; i < textFrames.length; i++) {
        var textFrame = textFrames[i];

        for (j = 0; j < textFrame.characters.length; j++) {
            try {
                var charAttributes =
                    textFrame.characters[j].characterAttributes;

                if (isProcessSpotColor(charAttributes.fillColor)) {
                    var textFill =
                        getProcessColorFromSpotColor(
                            charAttributes.fillColor
                        );

                    if (textFill) {
                        charAttributes.fillColor = textFill;
                        convertedCount++;
                    }
                }

                if (isProcessSpotColor(charAttributes.strokeColor)) {
                    var textStroke =
                        getProcessColorFromSpotColor(
                            charAttributes.strokeColor
                        );

                    if (textStroke) {
                        charAttributes.strokeColor = textStroke;
                        convertedCount++;
                    }
                }
            } catch (eText) {}
        }
    }

    return convertedCount;
}

//--------------------------------------------------
// CHECK WHETHER A SPOT IS USED
//--------------------------------------------------

function isSpotUsed(doc, targetSpot) {
    var pathItems = doc.pathItems;
    var textFrames = doc.textFrames;
    var i;
    var j;

    for (i = 0; i < pathItems.length; i++) {
        var path = pathItems[i];

        try {
            if (
                path.filled &&
                path.fillColor.typename === "SpotColor" &&
                path.fillColor.spot === targetSpot
            ) {
                return true;
            }
        } catch (eFill) {}

        try {
            if (
                path.stroked &&
                path.strokeColor.typename === "SpotColor" &&
                path.strokeColor.spot === targetSpot
            ) {
                return true;
            }
        } catch (eStroke) {}
    }

    for (i = 0; i < textFrames.length; i++) {
        var textFrame = textFrames[i];

        for (j = 0; j < textFrame.characters.length; j++) {
            try {
                var charAttributes =
                    textFrame.characters[j].characterAttributes;

                if (
                    charAttributes.fillColor.typename === "SpotColor" &&
                    charAttributes.fillColor.spot === targetSpot
                ) {
                    return true;
                }
            } catch (eTextFill) {}

            try {
                var charStrokeAttributes =
                    textFrame.characters[j].characterAttributes;

                if (
                    charStrokeAttributes.strokeColor.typename === "SpotColor" &&
                    charStrokeAttributes.strokeColor.spot === targetSpot
                ) {
                    return true;
                }
            } catch (eTextStroke) {}
        }
    }

    return false;
}

//--------------------------------------------------
// CHECK WHETHER A PATTERN IS USED
//--------------------------------------------------

function isPatternUsed(doc, targetPattern) {
    var pathItems = doc.pathItems;
    var textFrames = doc.textFrames;
    var i;
    var j;

    for (i = 0; i < pathItems.length; i++) {
        var path = pathItems[i];

        try {
            if (
                path.filled &&
                path.fillColor.typename === "PatternColor" &&
                path.fillColor.pattern === targetPattern
            ) {
                return true;
            }
        } catch (eFill) {}

        try {
            if (
                path.stroked &&
                path.strokeColor.typename === "PatternColor" &&
                path.strokeColor.pattern === targetPattern
            ) {
                return true;
            }
        } catch (eStroke) {}
    }

    for (i = 0; i < textFrames.length; i++) {
        var textFrame = textFrames[i];

        for (j = 0; j < textFrame.characters.length; j++) {
            try {
                var charAttributes =
                    textFrame.characters[j].characterAttributes;

                if (
                    charAttributes.fillColor.typename === "PatternColor" &&
                    charAttributes.fillColor.pattern === targetPattern
                ) {
                    return true;
                }
            } catch (eTextFill) {}

            try {
                var charStrokeAttributes =
                    textFrame.characters[j].characterAttributes;

                if (
                    charStrokeAttributes.strokeColor.typename === "PatternColor" &&
                    charStrokeAttributes.strokeColor.pattern === targetPattern
                ) {
                    return true;
                }
            } catch (eTextStroke) {}
        }
    }

    return false;
}


//--------------------------------------------------
// CLEAN SWATCHES
//--------------------------------------------------

function cleanSwatches(doc) {
    var report = {
    convertedProcessColors: 0,
    removedSwatches: [],
    retainedPatterns: [],
    failedToRemove: []
};

    report.convertedProcessColors =
        unlinkProcessGlobalColors(doc);

    var swatches = doc.swatches;

    for (var i = swatches.length - 1; i >= 0; i--) {
        var swatch;

        try {
            swatch = swatches[i];

            if (
                swatch.name === "[None]" ||
                swatch.name === "[Registration]"
            ) {
                continue;
            }

            var color = swatch.color;
            var colorType = color.typename;
            var keepSwatch = false;

            // Preserve only real Spot colors currently used in artwork.
            if (colorType === "SpotColor" && isTrueSpotColor(color)) {
                keepSwatch = isSpotUsed(doc, color.spot);
            }

            // Preserve patterns and gradients only when artwork uses them.
            if (colorType === "PatternColor") {
                keepSwatch = isPatternUsed(doc, color.pattern);
            }

            if (keepSwatch) {
    report.retainedPatterns.push(swatch.name);
    continue;
}

            try {
                var removedName = swatch.name;
                swatch.remove();
                report.removedSwatches.push(removedName);
            } catch (removeError) {
                report.failedToRemove.push(swatch.name);
            }

        } catch (e) {}
    }

    var groups = doc.swatchGroups;

    for (var g = groups.length - 1; g >= 0; g--) {
        try {
            if (groups[g].getAllSwatches().length === 0) {
                groups[g].remove();
            }
        } catch (eGroup) {}
    }

    return report;
}

//==================================================
// MAIN
//==================================================

function main(){

if (
    app.documents.length ===
    0
) {

    RESULT =
        "ERROR: No document is open.";

    throw new Error();

}


doc =
    app.activeDocument;


//================================================
// 1. CAPTURE SELECTION
//================================================

if (
    doc.selection.length ===
    0
) {

    RESULT =
        "ERROR: No objects selected.";

    throw new Error();

}


var keep =
    [];


for (
    var i = 0;
    i < doc.selection.length;
    i++
) {

    keep.push(
        doc.selection[i]
    );

}


//================================================
// 2. SORT SELECTION
//================================================

sortItems(
    keep
);


//================================================
// 3. DESIGN LAYER
//================================================

var designLayer =
    getDesignLayer(
        doc
    );


//================================================
// 4. REMOVE UNSELECTED ITEMS
//================================================

removeUnselectedItems(
    doc,
    keep
);


//================================================
// 5. MOVE SELECTION TO DESIGN LAYER
//================================================

moveSelectionToDesign(
    keep,
    designLayer
);


//================================================
// 6. REMOVE OTHER LAYERS
//================================================

removeOtherLayers(
    doc,
    designLayer
);


//================================================
// 7. CREATE ARTBOARDS
//================================================

createArtboardsFromItems(
    doc,
    keep
);


//================================================
// 8. CLEAN SWATCHES
//================================================
var swatchReport =
    cleanSwatches(
        doc
    );


//================================================
// 9. FINISH
//================================================

doc.selection =
    keep;

var warningMsg =
    "";

if (
    swatchReport &&
    swatchReport.retainedPatterns &&
    swatchReport.retainedPatterns.length >
    0
) {

    warningMsg =
        "\nWARNING: A pattern is in use and must be removed manually.";

}


RESULT =
    "SUCCESS: Production preparation completed." +
    warningMsg;

}

//==================================================
// EXECUTION
//==================================================

try {

main();

}
catch (e) {

if (
    RESULT ===
    ""
) {

    RESULT =
        "ERROR: " +
        e.message;

}

}

RESULT;