#target illustrator

var RESULT = "";
var doc = app.activeDocument;

var COLUMN_TOLERANCE = 2;

app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


//==================================================
// MAIN
//==================================================

function main(){

    if(doc.selection.length === 0){

        RESULT =
            "ERROR: Select one or more objects.";

        throw new Error();

    }


    //================================================
    // Capture selected objects
    //================================================

    var items = [];


    for(
        var i = 0;
        i < doc.selection.length;
        i++
    ){

        var item =
            doc.selection[i];


        try{

            // Verify that the object has valid bounds
            item.geometricBounds;

            items.push(item);

        }
        catch(e){

            // Ignore objects without valid bounds

        }

    }


    if(items.length === 0){

        RESULT =
            "ERROR: No objects with valid geometric bounds found.";

        throw new Error();

    }


    //================================================
    // Sort objects
    //
    // Priority:
    // 1. Left to right
    // 2. Top to bottom only when
    //    X positions are practically equal
    //================================================

    items.sort(
        function(a, b){

            var aBounds =
                a.geometricBounds;

            var bBounds =
                b.geometricBounds;


            var aLeft =
                aBounds[0];

            var bLeft =
                bBounds[0];


            var aTop =
                aBounds[1];

            var bTop =
                bBounds[1];


            // Objects practically in the same column
            if(
                Math.abs(
                    aLeft - bLeft
                ) <= COLUMN_TOLERANCE
            ){

                // Higher object first
                return bTop - aTop;

            }


            // Absolute priority:
            // left to right

            return aLeft - bLeft;

        }
    );


    //================================================
    // Create artboards
    //================================================

    for(
        var i = 0;
        i < items.length;
        i++
    ){

        var bounds =
            items[i].geometricBounds;


        doc.artboards.add(
            bounds
        );

    }

}


//==================================================
// EXECUTION
//==================================================

try{

    main();

    RESULT =
        "SUCCESS: Artboards created successfully.";

}
catch(e){

    if(
        RESULT === ""
    ){

        RESULT =
            "ERROR: " +
            e.message;

    }

}


RESULT;