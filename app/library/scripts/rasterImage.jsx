/*
    The Sign Pack Tools
    Rasterize / Crop Test
    V1 Experimental

    Workflow:

    Selected clipping mask(s)
        ↓
    Export each item as PNG at 150 DPI
        ↓
    Place PNG back into Illustrator
        ↓
    Embed
        ↓
    Restore original dimensions
        ↓
    Restore original top-left position
        ↓
    Remove original clipping mask

    IMPORTANT:
    This is an experimental version.
    The final pixel crop strategy will be added after validating
    the Illustrator export/import behavior.
*/


(function () {

    // ============================================================
    // SETTINGS
    // ============================================================

    var RASTER_RESOLUTION = 150;

    var TEMP_FOLDER =
        Folder.temp.fsName +
        "/TheSignPackTools_Raster";

    var PNG_FOLDER =
        new Folder(TEMP_FOLDER);

    if (!PNG_FOLDER.exists) {
        PNG_FOLDER.create();
    }


    // ============================================================
    // VALIDATE DOCUMENT
    // ============================================================

    if (!app.documents.length) {

        alert(
            "No document is open."
        );

        return;
    }


    var doc =
        app.activeDocument;


    // ============================================================
    // VALIDATE SELECTION
    // ============================================================

    if (
        !doc.selection ||
        doc.selection.length === 0
    ) {

        alert(
            "Please select one or more clipping masks."
        );

        return;
    }


    // ============================================================
    // GET CLIPPING MASK
    // ============================================================

    function getClippingMask(item) {

        if (!item) {
            return null;
        }


        // The selected item itself is a clipping group
        if (
            item.typename === "GroupItem" &&
            item.clipped
        ) {

            return item;
        }


        // Search parent hierarchy
        var current =
            item;

        while (
            current &&
            current.typename !== "Document"
        ) {

            if (
                current.typename === "GroupItem" &&
                current.clipped
            ) {

                return current;
            }

            current =
                current.parent;
        }


        return null;
    }


    // ============================================================
    // GET UNIQUE CLIPPING MASKS
    // ============================================================

    var clippingMasks = [];


    function alreadyAdded(item) {

        for (
            var i = 0;
            i < clippingMasks.length;
            i++
        ) {

            if (
                clippingMasks[i] === item
            ) {

                return true;
            }
        }

        return false;
    }


    for (
        var i = 0;
        i < doc.selection.length;
        i++
    ) {

        var selectedItem =
            doc.selection[i];

        var clippingMask =
            getClippingMask(
                selectedItem
            );


        if (clippingMask) {

            if (
                !alreadyAdded(
                    clippingMask
                )
            ) {

                clippingMasks.push(
                    clippingMask
                );
            }
        }
    }


    // ============================================================
    // VALIDATE CLIPPING MASKS
    // ============================================================

    if (
        clippingMasks.length === 0
    ) {

        alert(
            "No clipping masks were found in the selection."
        );

        return;
    }


    // ============================================================
    // GET TOP-LEFT POSITION
    // ============================================================

    function getTopLeft(item) {

        var bounds =
            item.visibleBounds;

        return {

            left:
                bounds[0],

            top:
                bounds[1]
        };
    }


    // ============================================================
    // GET SIZE
    // ============================================================

    function getSize(item) {

        var bounds =
            item.visibleBounds;

        return {

            width:
                bounds[2] -
                bounds[0],

            height:
                bounds[1] -
                bounds[3]
        };
    }


    // ============================================================
    // CREATE SAFE FILE NAME
    // ============================================================

    function sanitizeFileName(name) {

        if (!name) {
            name = "Raster";
        }

        name =
            name.replace(
                /[\\\/:*?"<>|]/g,
                "_"
            );

        return name;
    }


    // ============================================================
    // EXPORT PNG
    // ============================================================

    function exportPNG(
        item,
        file
    ) {

        var options =
            new ExportOptionsPNG24();


        /*
            Keep transparency.

            Anti-aliasing is intentionally ON.
        */

        options.antiAliasing =
            true;

        options.transparency =
            true;

        options.artBoardClipping =
            false;


        /*
            PNG export uses 72 DPI
            when scale is 100%.

            To obtain 150 DPI:

                150 / 72 × 100
        */

        options.horizontalScale =
            (
                RASTER_RESOLUTION /
                72
            ) * 100;

        options.verticalScale =
            (
                RASTER_RESOLUTION /
                72
            ) * 100;


        /*
            Export only the selected
            object instead of the artboard.
        */

        item.selected =
            true;


        doc.exportFile(
            file,
            ExportType.PNG24,
            options
        );
    }


    // ============================================================
    // EMBED PLACED ITEM
    // ============================================================

    function embedPlacedItem(
        placedItem
    ) {

        if (
            placedItem &&
            placedItem.typename ===
            "PlacedItem"
        ) {

            try {

                placedItem.embed();

            }
            catch (error) {

                throw new Error(
                    "Could not embed placed PNG.\n" +
                    error.message
                );
            }
        }
    }


    // ============================================================
    // PROCESS ONE CLIPPING MASK
    // ============================================================

    function processClippingMask(
        clippingMask,
        index
    ) {

        // --------------------------------------------------------
        // STORE ORIGINAL GEOMETRY
        // --------------------------------------------------------

        var originalPosition =
            getTopLeft(
                clippingMask
            );

        var originalSize =
            getSize(
                clippingMask
            );


        // --------------------------------------------------------
        // CREATE TEMP FILE
        // --------------------------------------------------------

        var baseName =
            sanitizeFileName(
                clippingMask.name ||
                "Raster"
            );

        var fileName =
            baseName +
            "_" +
            index +
            "_" +
            new Date().getTime() +
            ".png";

        var pngFile =
            new File(
                PNG_FOLDER.fsName +
                "/" +
                fileName
            );


        // --------------------------------------------------------
        // EXPORT
        // --------------------------------------------------------

        app.selection =
            null;

        clippingMask.selected =
            true;


        exportPNG(
            clippingMask,
            pngFile
        );


        // --------------------------------------------------------
        // VERIFY FILE
        // --------------------------------------------------------

        if (!pngFile.exists) {

            throw new Error(
                "PNG export failed:\n" +
                pngFile.fsName
            );
        }


        // --------------------------------------------------------
        // PLACE PNG
        // --------------------------------------------------------

        var placedItem =
            doc.placedItems.add();


        placedItem.file =
            pngFile;


        // --------------------------------------------------------
        // WAIT FOR PLACED ITEM
        // --------------------------------------------------------

        placedItem.position = [
            originalPosition.left,
            originalPosition.top
        ];


        // --------------------------------------------------------
        // EMBED
        // --------------------------------------------------------

        embedPlacedItem(
            placedItem
        );


        // --------------------------------------------------------
        // GET CURRENT SIZE
        // --------------------------------------------------------

        var currentSize =
            getSize(
                placedItem
            );


        if (
            currentSize.width === 0 ||
            currentSize.height === 0
        ) {

            throw new Error(
                "The resulting raster has zero dimensions."
            );
        }


        // --------------------------------------------------------
        // SCALE TO ORIGINAL WIDTH
        // --------------------------------------------------------

        var scaleX =
            (
                originalSize.width /
                currentSize.width
            ) * 100;

        var scaleY =
            (
                originalSize.height /
                currentSize.height
            ) * 100;


        placedItem.resize(
            scaleX,
            scaleY,
            true,
            true,
            true,
            true,
            100,
            Transformation.TOPLEFT
        );


        // --------------------------------------------------------
        // RESTORE EXACT TOP-LEFT POSITION
        // --------------------------------------------------------

        placedItem.position = [
            originalPosition.left,
            originalPosition.top
        ];


        // --------------------------------------------------------
        // REMOVE ORIGINAL
        // --------------------------------------------------------

        clippingMask.remove();


        // --------------------------------------------------------
        // REMOVE TEMP FILE
        // --------------------------------------------------------

        try {

            pngFile.remove();

        }
        catch (error) {

            // Ignore temp-file cleanup errors
        }


        return placedItem;
    }


    // ============================================================
    // PROCESS ALL
    // ============================================================

    var results = [];

    var errors = [];


    for (
        var i = 0;
        i < clippingMasks.length;
        i++
    ) {

        try {

            var result =
                processClippingMask(
                    clippingMasks[i],
                    i + 1
                );

            results.push(
                result
            );

        }
        catch (error) {

            errors.push(
                "Item " +
                (i + 1) +
                ":\n" +
                error.message
            );
        }
    }


    // ============================================================
    // CLEAN SELECTION
    // ============================================================

    app.selection =
        null;


    for (
        var i = 0;
        i < results.length;
        i++
    ) {

        results[i].selected =
            true;
    }


    // ============================================================
    // RESULT
    // ============================================================

    var message =
        "Raster test completed.\n\n" +
        "Processed: " +
        results.length +
        " item(s).";


    if (
        errors.length > 0
    ) {

        message +=
            "\n\nErrors:\n\n" +
            errors.join(
                "\n\n"
            );
    }


    alert(
        message
    );


})();