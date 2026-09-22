#target illustrator

var RESULT = "";
var doc = null;
var outlineLayer = null;


doc =
    app.activeDocument;


// ==========================================
// CREATE LAYER COLOR
// ==========================================

function criarCorlayer(){

    var cor =
        new RGBColor();

    cor.red = 255;
    cor.green = 60;
    cor.blue = 60;

    return cor;

}


// ==========================================
// MAIN FUNCTION
// ==========================================

function main(){

    try{

        outlineLayer =
            doc.layers.getByName(
                "Ref"
            );

        RESULT =
            "ERROR: A 'Ref' layer already exists.";

        throw new Error();

    }
    catch(e){

        outlineLayer =
            doc.layers.add();

        outlineLayer.name =
            "Ref";

        outlineLayer.printable =
            false;

        outlineLayer.color =
            criarCorlayer();

    }


    // ======================================
    // VALIDATE LAYER
    // ======================================

    if(
        outlineLayer.locked
    ){

        RESULT =
            "ERROR: The 'Ref' layer is locked.";

        throw new Error();

    }


    if(
        !outlineLayer.visible
    ){

        RESULT =
            "ERROR: The 'Ref' layer is hidden.";

        throw new Error();

    }

}


// ==========================================
// EXECUTION
// ==========================================

try{

    main();

    RESULT =
        "SUCCESS: Ref layer created successfully.";

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