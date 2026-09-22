#target illustrator

var RESULT = "";
var doc = null;
var whiteInkColor = null;


app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


// ==========================================
// CREATE LAYER COLOR
// ==========================================

function criarCor(r, g, b){

    var cor =
        new RGBColor();

    cor.red = r;
    cor.green = g;
    cor.blue = b;

    return cor;

}


// ==========================================
// GET WHITE INK COLOR
// ==========================================

function getWhiteInkColor(doc){

    var spot;


    try{

        spot =
            doc.spots.getByName(
                "White Ink"
            );

    }
    catch(e){

        spot =
            doc.spots.add();

        spot.name =
            "White Ink";

        spot.colorType =
            ColorModel.SPOT;


        // Display color (can be any color)

        var cmyk =
            new CMYKColor();

        cmyk.cyan =
            100;

        cmyk.magenta =
            0;

        cmyk.yellow =
            0;

        cmyk.black =
            0;


        spot.color =
            cmyk;

    }


    var spotColor =
        new SpotColor();

    spotColor.spot =
        spot;

    spotColor.tint =
        100;


    return spotColor;

}


// ==========================================
// ASK WHETHER TO DELETE ORIGINAL
// ==========================================

function askDeleteOriginal(){

    var w =
        new Window(
            "dialog",
            "White Ink - Original Object"
        );

    w.orientation =
        "column";

    w.alignChildren =
        "fill";


    w.add(
        "statictext",
        undefined,
        "Do you want to keep the original object?"
    );


    var btnGroup =
        w.add("group");

    btnGroup.alignment =
        "center";


    var keepBtn =
        btnGroup.add(
            "button",
            undefined,
            "Keep Original"
        );


    var deleteBtn =
        btnGroup.add(
            "button",
            undefined,
            "Remove Original"
        );


    var result =
        "keep";


    keepBtn.onClick =
        function(){

            result =
                "keep";

            w.close();

        };


    deleteBtn.onClick =
        function(){

            result =
                "delete";

            w.close();

        };


    w.show();


    return result;

}


// ==========================================
// APPLY FILL RECURSIVELY
// ==========================================

function aplicarFill(item){

    // Path item

    if(
        item.typename ===
        "PathItem"
    ){

        item.filled =
            true;

        item.stroked =
            false;

        item.fillColor =
            whiteInkColor;

        return;

    }


    // Group

    if(
        item.typename ===
        "GroupItem"
    ){

        for(
            var i = 0;
            i < item.pageItems.length;
            i++
        ){

            aplicarFill(
                item.pageItems[i]
            );

        }

        return;

    }


    // Compound path

    if(
        item.typename ===
        "CompoundPathItem"
    ){

        for(
            var i = 0;
            i < item.pathItems.length;
            i++
        ){

            aplicarFill(
                item.pathItems[i]
            );

        }

        return;

    }

}


// ==========================================
// MAIN FUNCTION
// ==========================================

function main(){

    if(
        app.documents.length === 0
    ){

        RESULT =
            "ERROR: No document is open.";

        throw new Error();

    }


    doc =
        app.activeDocument;


    app.userInteractionLevel =
        UserInteractionLevel.DISPLAYALERTS;


    // ======================================
    // ENSURE WHITE INK LAYER
    // ======================================

    var WhiteInkLayer;


    try{

        WhiteInkLayer =
            doc.layers.getByName(
                "White Ink"
            );

    }
    catch(e){

        WhiteInkLayer =
            doc.layers.add();

        WhiteInkLayer.name =
            "White Ink";

        WhiteInkLayer.color =
            criarCor(
                0,
                255,
                255
            );

    }


    // ======================================
    // VALIDATE LAYER
    // ======================================

    if(
        WhiteInkLayer.locked
    ){

        RESULT =
            "ERROR: The 'White Ink' layer is locked.";

        throw new Error();

    }


    if(
        !WhiteInkLayer.visible
    ){

        RESULT =
            "ERROR: The 'White Ink' layer is hidden.";

        throw new Error();

    }


    // ======================================
    // GET WHITE INK SPOT COLOR
    // ======================================

    whiteInkColor =
        getWhiteInkColor(
            doc
        );


    // ======================================
    // VALIDATE SELECTION
    // ======================================

    var sel =
        doc.selection;


    if(
        sel.length === 0
    ){

        RESULT =
            "ERROR: No objects are selected.";

        throw new Error();

    }


    // ======================================
    // PROCESS SELECTED OBJECTS
    // ======================================

    var itemsToGroup =
        [];


    var userChoice =
        askDeleteOriginal();


    for(
        var i = 0;
        i < sel.length;
        i++
    ){

        var originalItem =
            sel[i];

        var item;


        // Convert text to outlines

        if(
            originalItem.typename ===
            "TextFrame"
        ){

            item =
                originalItem.createOutline();

        }
        else{

            // Duplicate any other object type
            // such as PathItem, GroupItem, etc.

            item =
                originalItem.duplicate();

        }


        // Apply white ink fill

        aplicarFill(
            item
        );


        itemsToGroup.push(
            item
        );


        // Remove the original object
        // only if requested by the user

        if(
            userChoice ===
            "delete"
        ){

            try{

                originalItem.remove();

            }
            catch(e){}

        }

    }


    // ======================================
    // GROUP PROCESSED OBJECTS
    // ======================================

    if(
        itemsToGroup.length > 1
    ){

        var finalGroup =
            doc.groupItems.add();


        for(
            var j = 0;
            j < itemsToGroup.length;
            j++
        ){

            itemsToGroup[j].move(
                finalGroup,
                ElementPlacement.PLACEATEND
            );

        }


        finalGroup.move(
            WhiteInkLayer,
            ElementPlacement.PLACEATBEGINNING
        );

    }
    else if(
        itemsToGroup.length === 1
    ){

        itemsToGroup[0].move(
            WhiteInkLayer,
            ElementPlacement.PLACEATBEGINNING
        );

    }

}


// ==========================================
// EXECUTION
// ==========================================

try{

    main();

    RESULT =
        "SUCCESS: White Ink created successfully.";

}
catch(e){

    if(
        RESULT === ""
    ){

        RESULT =
            "ERROR: Unexpected error:\n" +
            e.message;

    }

}


RESULT;