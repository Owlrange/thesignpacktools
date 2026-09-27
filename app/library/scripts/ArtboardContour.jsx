#target illustrator

var RESULT = "";
var doc = null;
var black = null;
var outlineLayer = null;


//====================================
// Create Layer Color
//====================================
function createLayerColor() {

    var color = new RGBColor();

    color.red = 0;
    color.green = 0;
    color.blue = 0;

    return color;

}


//====================================
// 1 pt Stroke Considering Scale Factor
//====================================
function getStroke1pt(doc) {

    if (doc.scaleFactor)
        return 1 / doc.scaleFactor;

    return 1;

}


//====================================
// Outline Layer
//====================================
function getOutlineLayer(doc) {

    var layer;

    try {

        layer = doc.layers.getByName("Outline");

    }
    catch(e) {

        layer = doc.layers.add();

        layer.name = "Outline";
        layer.color = createLayerColor();

    }

    layer.printable = true;
    layer.visible = true;
    layer.locked = false;

    return layer;

}


//====================================
// Black CMYK
//====================================
function getBlack() {

    var black = new CMYKColor();

    black.cyan = 0;
    black.magenta = 0;
    black.yellow = 0;
    black.black = 100;

    return black;

}


//====================================
// Artboard Selection
//====================================
function askArtboards(doc) {

    var w = new Window(
        "dialog",
        "Select Artboards"
    );

    w.orientation = "column";
    w.alignChildren = "fill";
    w.spacing = 8;
    w.margins = 12;


    //====================================
    // Title
    //====================================

    w.add(
        "statictext",
        undefined,
        "Select artboards:"
    );


    //====================================
    // Select All / Select None
    //====================================

    var selectionButtons =
        w.add(
            "group"
        );

    selectionButtons.alignment =
        "center";


    var selectAll =
        selectionButtons.add(
            "button",
            undefined,
            "Select All"
        );


    var selectNone =
        selectionButtons.add(
            "button",
            undefined,
            "Select None"
        );


    //====================================
    // Artboard List
    //====================================

    var list = w.add(
        "listbox",
        undefined,
        undefined,
        {
            multiselect: true
        }
    );

    list.preferredSize = [
        320,
        250
    ];


    //====================================
    // Add Artboards
    //====================================

    for (
        var i = 0;
        i < doc.artboards.length;
        i++
    ) {

        var item = list.add(
            "item",
            doc.artboards[i].name
        );

        item.artboardIndex = i;

    }


    //====================================
    // Selection Counter
    //====================================

    var counter =
        w.add(
            "statictext",
            undefined,
            "0 of " +
            doc.artboards.length +
            " selected"
        );


    //====================================
    // Update Counter
    //====================================

    function updateCounter() {

        var selection = list.selection;

        var count = 0;

        if (selection) {

            if (selection instanceof Array) {

                count = selection.length;

            }
            else {

                count = 1;

            }

        }

        counter.text =
            count +
            " of " +
            doc.artboards.length +
            " selected";

    }


    list.onChange =
        updateCounter;


    //====================================
    // Create Button
    //====================================

    var buttons =
        w.add(
            "group"
        );

    buttons.alignment =
        "center";


    var createButton =
        buttons.add(
            "button",
            undefined,
            "Create"
        );


    var result = null;


    //====================================
    // Create
    //====================================

    createButton.onClick = function() {

        var selection =
            list.selection;


        if (!selection) {

            alert(
                "Please select at least one artboard."
            );

            return;

        }


        if (!(selection instanceof Array)) {

            selection = [
                selection
            ];

        }


        result = [];


        for (
            var i = 0;
            i < selection.length;
            i++
        ) {

            result.push(
                selection[i].artboardIndex
            );

        }


        w.close();

    };


    //====================================
    // Show Dialog
    //====================================

    w.show();


    return result;

}


//====================================
// MAIN
//====================================
function main() {

    if (app.documents.length === 0) {

        RESULT =
            "ERROR: No document is open.";

        return;

    }

    doc = app.activeDocument;

    var selectedArtboards =
        askArtboards(doc);


    // Cancelled before any document modification
    if (selectedArtboards === null) {

        RESULT =
            "WARNING: Operation cancelled.";

        return;

    }


    outlineLayer =
        getOutlineLayer(doc);

    black =
        getBlack();

    var stroke =
        getStroke1pt(doc);


    //====================================
    // Create Artboard Contours
    //====================================

    for (
        var i = 0;
        i < selectedArtboards.length;
        i++
    ) {

        var index =
            selectedArtboards[i];


        var r =
            doc.artboards[index].artboardRect;


        var shape =
            outlineLayer.pathItems.rectangle(
                r[1],
                r[0],
                r[2] - r[0],
                r[1] - r[3]
            );


        shape.stroked = true;
        shape.filled = false;
        shape.strokeWidth = stroke;
        shape.strokeColor = black;

    }

}


//====================================
// EXECUTION
//====================================

try {

    main();

    if (RESULT === "") {

        RESULT =
            "SUCCESS: Artboard contours created successfully.";

    }

}
catch(e) {

    if (RESULT === "") {

        RESULT =
            "ERROR: Unexpected error:\n" +
            e.message;

    }

}


RESULT;