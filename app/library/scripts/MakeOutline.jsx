#target illustrator

var RESULT = "";
var doc = null;
var black = null;


app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


// ==========================================
// CREATE LAYER COLOR
// ==========================================

function criarCorlayer(r, g, b){

    var cor =
        new RGBColor();

    cor.red = r;
    cor.green = g;
    cor.blue = b;

    return cor;

}


// ==========================================
// CREATE BLACK COLOR
// ==========================================

function criarSwatchBlack(){

    var cor =
        new CMYKColor();

    cor.cyan = 0;
    cor.magenta = 0;
    cor.yellow = 0;
    cor.black = 100;

    return cor;

}


// ==========================================
// ASK WHETHER TO DELETE ORIGINAL
// ==========================================

function askDeleteOriginal(){

    var w =
        new Window(
            "dialog",
            "Outline - Original Object"
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
// GET 1 PT STROKE WIDTH
// ==========================================

function getStroke1pt(doc){

    return 1 / doc.scaleFactor;

}


// ==========================================
// APPLY STROKE/FILL RECURSIVELY
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
            true;

        item.strokeWidth =
            getStroke1pt(doc);

        item.strokeColor =
            black;

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
    // ENSURE OUTLINE LAYER
    // ======================================

    var outlineLayer;


    try{

        outlineLayer =
            doc.layers.getByName(
                "Outline"
            );

    }
    catch(e){

        outlineLayer =
            doc.layers.add();

        outlineLayer.name =
            "Outline";

        outlineLayer.color =
            criarCorlayer(
                0,
                0,
                0
            );

    }


    // Validate the layer

    if(
        outlineLayer.locked
    ){

        RESULT =
            "ERROR: The 'Outline' layer is locked.";

        throw new Error();

    }


    if(
        !outlineLayer.visible
    ){

        RESULT =
            "ERROR: The 'Outline' layer is hidden.";

        throw new Error();

    }


    // ======================================
    // CREATE BLACK COLOR
    // ======================================

    black =
        criarSwatchBlack();


    // ======================================
    // PROCESS SELECTED OBJECTS
    // ======================================

    var itemsToGroup =
        [];


    var userChoice =
        askDeleteOriginal();


    var sel =
        doc.selection;


    if(
        sel.length === 0
    ){

        RESULT =
            "ERROR: No objects are selected.";

        throw new Error();

    }


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


        // Apply stroke/fill
        aplicarStroke(
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
            outlineLayer,
            ElementPlacement.PLACEATBEGINNING
        );

    }
    else if(
        itemsToGroup.length === 1
    ){

        itemsToGroup[0].move(
            outlineLayer,
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
        "SUCCESS: Outline created successfully.";

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