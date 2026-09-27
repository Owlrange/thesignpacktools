#target illustrator

var RESULT = "";
var doc = null;
var boundingBoxLayer = null;


// ==========================================
// CREATE RGB COLOR
// ==========================================

function criarCor(r, g, b) {

    var cor =
        new RGBColor();

    cor.red = r;
    cor.green = g;
    cor.blue = b;

    return cor;

}


// ==========================================
// ASK WHETHER TO DELETE ORIGINAL
// ==========================================

function askDeleteOriginal(){

    var w =
        new Window(
            "dialog",
            "BoundingBox - Original Object"
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
        "cancel";


    keepBtn.onClick =
        function () {

            result =
                "keep";

            w.close();

        };


    deleteBtn.onClick =
        function () {

            result =
                "delete";

            w.close();

        };


    w.show();


    return result;

}


// ==========================================
// ENSURE BOUNDING BOX LAYER
// ==========================================

function ensureBoundingBoxLayer(){

    try {

        boundingBoxLayer =
            doc.layers.getByName(
                "BoundingBox"
            );

    }
    catch (e) {

        boundingBoxLayer =
            doc.layers.add();

        boundingBoxLayer.name =
            "BoundingBox";

        boundingBoxLayer.color =
            criarCor(
                153,
                204,
                0
            );

    }


    // ==========================================
    // VALIDATE LAYER
    // ==========================================

    if(
        boundingBoxLayer.locked
    ){

        RESULT =
            "ERROR: The 'BoundingBox' layer is locked.";

        throw new Error();

    }


    if(
        !boundingBoxLayer.visible
    ){

        RESULT =
            "ERROR: The 'BoundingBox' layer is hidden.";

        throw new Error();

    }

}


// ==========================================
// PROCESS SELECTED ITEM
// ==========================================

function processItem(item, userChoice){

    // Duplicate object

    var copy =
        item.duplicate();


    // Move duplicate to BoundingBox layer

    copy.move(
        boundingBoxLayer,
        ElementPlacement.PLACEATBEGINNING
    );


    // Convert text to outlines
    // createOutline() replaces the TextFrame,
    // so the returned outline must be assigned back to copy

    if(
        copy.typename ===
        "TextFrame"
    ){

        copy =
            copy.createOutline();

    }


    aplicarStroke(
        copy
    );


    // Remove original only if requested

    if(
        userChoice ===
        "delete"
    ){

        try {

            item.remove();

        }
        catch (e) {}

    }

}


// ==========================================
// APPLY STROKE RECURSIVELY
// ==========================================

function aplicarStroke(item){

    // Simple path

    if(
        item.typename ===
        "PathItem"
    ){

        item.filled =
            false;

        item.stroked =
            false;

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

            aplicarStroke(
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

            aplicarStroke(
                item.pathItems[i]
            );

        }

        return;

    }

}


// ==========================================
// MAIN
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


    // ==========================================
    // VALIDATE SELECTION BEFORE MODIFICATION
    // ==========================================

    var sel =
        doc.selection;


    if(
        sel.length === 0
    ){

        RESULT =
            "ERROR: No objects are selected.";

        throw new Error();

    }


    // ==========================================
    // ASK ONCE FOR ENTIRE SELECTION
    // ==========================================

    var userChoice =
        askDeleteOriginal();


    if(
        userChoice ===
        "cancel"
    ){

        RESULT =
            "WARNING: Operation cancelled.";

        return;

    }


    // ==========================================
    // ENSURE BOUNDING BOX LAYER
    // ==========================================

    ensureBoundingBoxLayer();


    // ==========================================
    // PROCESS SELECTION
    // ==========================================

    for(
        var i = doc.selection.length - 1;
        i >= 0;
        i--
    ){

        processItem(
            sel[i],
            userChoice
        );

    }

}


// ==========================================
// EXECUTE
// ==========================================

try {

    main();

    if(
        RESULT === ""
    ){

        RESULT =
            "SUCCESS: BoundingBox created successfully.";

    }

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