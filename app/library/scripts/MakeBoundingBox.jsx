#target illustrator

var RESULT = "";
var doc = null;
var outlineLayer = null;


app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


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
// ENSURE BOUNDING BOX LAYER
// ==========================================

function main(){

    doc =
        app.activeDocument;


    try {

        outlineLayer =
            doc.layers.getByName(
                "BoundingBox"
            );

    }
    catch (e) {

        outlineLayer =
            doc.layers.add();

        outlineLayer.name =
            "BoundingBox";

        outlineLayer.color =
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
        outlineLayer.locked
    ){

        RESULT =
            "ERROR: The 'BoundingBox' layer is locked.";

        throw new Error();

    }


    if(
        !outlineLayer.visible
    ){

        RESULT =
            "ERROR: The 'BoundingBox' layer is hidden.";

        throw new Error();

    }


    // ==========================================
    // PROCESS SELECTION
    // ==========================================

    var sel =
        doc.selection;


    if(
        sel.length === 0
    ){

        RESULT =
            "ERROR: No objects selected.";

        throw new Error();

    }


    for(
        var i = doc.selection.length - 1;
        i >= 0;
        i--
    ){

        processItem(
            sel[i]
        );

    }

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
        "keep";


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
// PROCESS SELECTED ITEM
// ==========================================

function processItem(item){

    // Duplicate object

    var copy =
        item.duplicate();


    // Move duplicate to BoundingBox layer

    copy.move(
        outlineLayer,
        ElementPlacement.PLACEATBEGINNING
    );


    // Convert text to outlines

    if(
        copy.typename ===
        "TextFrame"
    ){

        copy.createOutline();

    }


    aplicarStroke(
        copy
    );


    var userChoice =
        askDeleteOriginal();


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
// EXECUTE
// ==========================================

try {

    main();

    RESULT =
        "SUCCESS: BoundingBox created successfully.";

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