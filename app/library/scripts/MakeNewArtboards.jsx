#target illustrator

var RESULT = "";
var doc = null;


//==================================================
// MAIN
//==================================================

function main(){

    if(app.documents.length === 0){

        RESULT =
            "ERROR: No document is open.";

        return;

    }

    doc = app.activeDocument;


    if(doc.selection.length === 0){

        RESULT =
            "ERROR: Select one or more objects.";

        return;

    }


    //================================================
    // Ask arrangement direction
    //================================================

    var arrangement =
        askArrangement();


    if(arrangement === null){

        RESULT =
            "WARNING: Operation cancelled.";

        return;

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

        return;

    }


    //================================================
    // Sort objects
    //================================================

    if(arrangement === "row"){

        sortByRow(items);

    }
    else{

        sortByColumn(items);

    }


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
// ARRANGEMENT DIALOG
//==================================================

function askArrangement(){

    var w =
        new Window(
            "dialog",
            "Create New Artboards"
        );


    w.orientation =
        "column";

    w.alignChildren =
        "fill";

    w.spacing = 8;
    w.margins = 12;


    //================================================
    // Description
    //================================================

    w.add(
        "statictext",
        undefined,
        "How would you like to arrange the artboards?"
    );


    //================================================
    // Arrangement Options
    //================================================

    var options =
        w.add(
            "panel",
            undefined,
            ""
        );


    options.orientation =
        "column";

    options.alignChildren =
        "left";


    var rowRadio =
        options.add(
            "radiobutton",
            undefined,
            "Grid by Row"
        );


    var columnRadio =
        options.add(
            "radiobutton",
            undefined,
            "Grid by Column"
        );


    rowRadio.value =
        true;


    //================================================
    // Buttons
    //================================================

    var buttons =
        w.add("group");

    buttons.alignment =
        "center";


    var createButton =
        buttons.add(
            "button",
            undefined,
            "Create"
        );


    var result =
        null;


    //================================================
    // Create
    //================================================

    createButton.onClick =
        function(){

            if(rowRadio.value){

                result =
                    "row";

            }
            else{

                result =
                    "column";

            }

            w.close();

        };


    //================================================
    // Show Dialog
    //================================================

    w.show();


    return result;

}


//==================================================
// CHECK VERTICAL OVERLAP
//
// Illustrator geometricBounds:
//
// [left, top, right, bottom]
//
// Two objects belong to the same row when
// their vertical ranges overlap.
//==================================================

function verticalOverlap(a, b){

    var aBounds =
        a.geometricBounds;

    var bBounds =
        b.geometricBounds;


    var aTop =
        aBounds[1];

    var aBottom =
        aBounds[3];

    var bTop =
        bBounds[1];

    var bBottom =
        bBounds[3];


    return(
        aBottom <= bTop &&
        bBottom <= aTop
    );

}


//==================================================
// CHECK HORIZONTAL OVERLAP
//
// Two objects belong to the same column when
// their horizontal ranges overlap.
//==================================================

function horizontalOverlap(a, b){

    var aBounds =
        a.geometricBounds;

    var bBounds =
        b.geometricBounds;


    var aLeft =
        aBounds[0];

    var aRight =
        aBounds[2];

    var bLeft =
        bBounds[0];

    var bRight =
        bBounds[2];


    return(
        aLeft <= bRight &&
        bLeft <= aRight
    );

}


//==================================================
// SORT BY ROW
//
// Objects are grouped by vertical overlap.
//
// Within each row:
// left to right.
//
// Rows:
// top to bottom.
//==================================================

function sortByRow(items){

    var rows = [];


    //================================================
    // Build rows
    //================================================

    for(
        var i = 0;
        i < items.length;
        i++
    ){

        var item =
            items[i];

        var placed =
            false;


        for(
            var r = 0;
            r < rows.length;
            r++
        ){

            var row =
                rows[r];

            var overlaps =
                false;


            for(
                var j = 0;
                j < row.length;
                j++
            ){

                if(
                    verticalOverlap(
                        item,
                        row[j]
                    )
                ){

                    overlaps =
                        true;

                    break;

                }

            }


            if(overlaps){

                row.push(item);

                placed =
                    true;

                break;

            }

        }


        if(!placed){

            rows.push(
                [item]
            );

        }

    }


    //================================================
    // Sort rows top to bottom
    //================================================

    rows.sort(
        function(a, b){

            return(
                getTop(b) -
                getTop(a)
            );

        }
    );


    //================================================
    // Sort objects inside each row
    //================================================

    for(
        var r = 0;
        r < rows.length;
        r++
    ){

        rows[r].sort(
            function(a, b){

                var aLeft =
                    a.geometricBounds[0];

                var bLeft =
                    b.geometricBounds[0];


                return(
                    aLeft -
                    bLeft
                );

            }
        );

    }


    //================================================
    // Rebuild items array
    //================================================

    items.length =
        0;


    for(
        var r = 0;
        r < rows.length;
        r++
    ){

        for(
            var i = 0;
            i < rows[r].length;
            i++
        ){

            items.push(
                rows[r][i]
            );

        }

    }

}


//==================================================
// SORT BY COLUMN
//
// Objects are grouped by horizontal overlap.
//
// Within each column:
// top to bottom.
//
// Columns:
// left to right.
//==================================================

function sortByColumn(items){

    var columns = [];


    //================================================
    // Build columns
    //================================================

    for(
        var i = 0;
        i < items.length;
        i++
    ){

        var item =
            items[i];

        var placed =
            false;


        for(
            var c = 0;
            c < columns.length;
            c++
        ){

            var column =
                columns[c];

            var overlaps =
                false;


            for(
                var j = 0;
                j < column.length;
                j++
            ){

                if(
                    horizontalOverlap(
                        item,
                        column[j]
                    )
                ){

                    overlaps =
                        true;

                    break;

                }

            }


            if(overlaps){

                column.push(item);

                placed =
                    true;

                break;

            }

        }


        if(!placed){

            columns.push(
                [item]
            );

        }

    }


    //================================================
    // Sort columns left to right
    //================================================

    columns.sort(
        function(a, b){

            return(
                getLeft(a) -
                getLeft(b)
            );

        }
    );


    //================================================
    // Sort objects inside each column
    //================================================

    for(
        var c = 0;
        c < columns.length;
        c++
    ){

        columns[c].sort(
            function(a, b){

                var aTop =
                    a.geometricBounds[1];

                var bTop =
                    b.geometricBounds[1];


                return(
                    bTop -
                    aTop
                );

            }
        );

    }


    //================================================
    // Rebuild items array
    //================================================

    items.length =
        0;


    for(
        var c = 0;
        c < columns.length;
        c++
    ){

        for(
            var i = 0;
            i < columns[c].length;
            i++
        ){

            items.push(
                columns[c][i]
            );

        }

    }

}


//==================================================
// GET TOP POSITION OF GROUP
//==================================================

function getTop(items){

    var top =
        items[0].geometricBounds[1];


    for(
        var i = 1;
        i < items.length;
        i++
    ){

        var itemTop =
            items[i].geometricBounds[1];


        if(itemTop > top){

            top =
                itemTop;

        }

    }


    return top;

}


//==================================================
// GET LEFT POSITION OF GROUP
//==================================================

function getLeft(items){

    var left =
        items[0].geometricBounds[0];


    for(
        var i = 1;
        i < items.length;
        i++
    ){

        var itemLeft =
            items[i].geometricBounds[0];


        if(itemLeft < left){

            left =
                itemLeft;

        }

    }


    return left;

}


//==================================================
// EXECUTION
//==================================================

try{

    main();

    if(RESULT === ""){

        RESULT =
            "SUCCESS: Artboards created successfully.";

    }

}
catch(e){

    if(RESULT === ""){

        RESULT =
            "ERROR: Unexpected error:\n" +
            e.message;

    }

}

RESULT;