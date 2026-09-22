#target illustrator

var RESULT = "";
var doc = null;
var cutColor = null;


app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


// ==========================================
// GET CUT CONTOUR COLOR
// ==========================================

function getCutContourColor(doc){

    var spot;


    try{

        spot =
            doc.spots.getByName(
                "CutContour"
            );

    }
    catch(e){

        spot =
            doc.spots.add();

        spot.name =
            "CutContour";

        spot.colorType =
            ColorModel.SPOT;


        // Display color
        var cmyk =
            new CMYKColor();

        cmyk.cyan =
            0;

        cmyk.magenta =
            100;

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
// CREATE RGB COLOR
// ==========================================

function createColor(r, g, b){

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


// ==========================================
// ASK WHETHER TO DELETE ORIGINAL
// ==========================================

function askDeleteOriginal(){

    var w =
        new Window(
            "dialog",
            "CutContour - Original Object"
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

    return (
        1 /
        doc.scaleFactor
    );

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


    // ==========================================
    // ENSURE CUT CONTOUR LAYER
    // ==========================================

    var outlineLayer;


    try{

        outlineLayer =
            doc.layers.getByName(
                "CutContour"
            );

    }
    catch(e){

        outlineLayer =
            doc.layers.add();

        outlineLayer.name =
            "CutContour";

        outlineLayer.color =
            createColor(
                255,
                79,
                255
            );

    }


    // ==========================================
    // VALIDATE LAYER
    // ==========================================

    if(
        outlineLayer.locked
    ){

        RESULT =
            "ERROR: The 'CutContour' layer is locked.";

        throw new Error();

    }


    if(
        !outlineLayer.visible
    ){

        RESULT =
            "ERROR: The 'CutContour' layer is hidden.";

        throw new Error();

    }


    // ==========================================
    // GET CUT CONTOUR SPOT COLOR
    // ==========================================

    cutColor =
        getCutContourColor(
            doc
        );


    // ==========================================
    // STORE PROCESSED ITEMS
    // ==========================================

    var itemsToGroup =
        [];


    var userChoice =
        askDeleteOriginal();


    // ==========================================
    // PROCESS SELECTION
    // ==========================================

    var sel =
        doc.selection;


    if(
        sel.length === 0
    ){

        RESULT =
            "ERROR: No object selected.";

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


        // Convert text to outline
        if(
            originalItem.typename ===
            "TextFrame"
        ){

            item =
                originalItem.createOutline();

        }
        else{

            // Duplicate other object types
            item =
                originalItem.duplicate();

        }


        // Apply stroke and fill
        applyStroke(
            item
        );


        itemsToGroup.push(
            item
        );


        // Remove original if requested
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


    // ==========================================
    // GROUP PROCESSED ITEMS
    // ==========================================

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
// APPLY STROKE/FILL RECURSIVELY
// ==========================================

function applyStroke(item){

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
            getStroke1pt(
                doc
            );

        item.strokeColor =
            cutColor;


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

            applyStroke(
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

            applyStroke(
                item.pathItems[i]
            );

        }


        return;

    }

}


// ==========================================
// RUN SCRIPT
// ==========================================

try{

    main();


    RESULT =
        "SUCCESS: CutContour created successfully.";

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