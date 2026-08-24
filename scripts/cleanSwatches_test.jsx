#target illustrator

var RESULT = "";


//====================================
// Verifica se uma cor é Spot utilizada
//====================================

function spotIsUsed(item, targetSpot) {

    try {

        // PathItem
        if (item.typename === "PathItem") {

            if (item.filled) {

                try {

                    if (
                        item.fillColor.typename === "SpotColor" &&
                        item.fillColor.spot === targetSpot
                    ) {
                        return true;
                    }

                }
                catch (e) {}
            }


            if (item.stroked) {

                try {

                    if (
                        item.strokeColor.typename === "SpotColor" &&
                        item.strokeColor.spot === targetSpot
                    ) {
                        return true;
                    }

                }
                catch (e) {}
            }

        }


        // TextFrame
        if (item.typename === "TextFrame") {

            try {

                if (
                    item.textRange.characterAttributes.fillColor.typename === "SpotColor" &&
                    item.textRange.characterAttributes.fillColor.spot === targetSpot
                ) {
                    return true;
                }

            }
            catch (e) {}


            try {

                if (
                    item.textRange.characterAttributes.strokeColor.typename === "SpotColor" &&
                    item.textRange.characterAttributes.strokeColor.spot === targetSpot
                ) {
                    return true;
                }

            }
            catch (e) {}

        }


        // Grupo
        if (item.typename === "GroupItem") {

            for (
                var i = 0;
                i < item.pageItems.length;
                i++
            ) {

                if (
                    spotIsUsed(
                        item.pageItems[i],
                        targetSpot
                    )
                ) {
                    return true;
                }

            }

        }


        // Compound Path
        if (item.typename === "CompoundPathItem") {

            for (
                var i = 0;
                i < item.pathItems.length;
                i++
            ) {

                if (
                    spotIsUsed(
                        item.pathItems[i],
                        targetSpot
                    )
                ) {
                    return true;
                }

            }

        }

    }
    catch (e) {}

    return false;

}


//====================================
// Verifica se Spot está sendo utilizada
//====================================

function isSpotUsed(doc, targetSpot) {

    for (
        var i = 0;
        i < doc.pageItems.length;
        i++
    ) {

        if (
            spotIsUsed(
                doc.pageItems[i],
                targetSpot
            )
        ) {
            return true;
        }

    }

    return false;

}


//====================================
// Limpa Swatches
//====================================

function cleanSwatches(doc) {

    var swatches =
        doc.swatches;

    var removed = 0;
    var preserved = 0;

    var removedSpots = 0;
    var preservedSpots = 0;


    // Percorre de trás para frente
    for (
        var i = swatches.length - 1;
        i >= 0;
        i--
    ) {

        var swatch =
            swatches[i];


        try {

            var color =
                swatch.color;

            var type =
                color.typename;


            //====================================
            // None
            //====================================

            if (
                type === "NoColor"
            ) {

                preserved++;

                continue;

            }


            //====================================
            // Registration
            //====================================

            if (
                swatch.name === "[Registration]"
            ) {

                preserved++;

                continue;

            }


            //====================================
            // Spot Color
            //====================================

            if (
                type === "SpotColor"
            ) {

                var spot =
                    color.spot;


                if (
                    isSpotUsed(
                        doc,
                        spot
                    )
                ) {

                    preservedSpots++;
                    preserved++;

                    continue;

                }


                // Spot não utilizada
                swatch.remove();

                removedSpots++;
                removed++;

                continue;

            }


            //====================================
            // Todas as demais cores
            //
            // CMYK
            // RGB
            // Gray
            // Global
            // Pattern
            // Gradient
            // etc.
            //====================================

            swatch.remove();

            removed++;

        }
        catch (e) {

            // Não interrompe a limpeza
            continue;

        }

    }


    return {

        removed: removed,

        preserved: preserved,

        removedSpots: removedSpots,

        preservedSpots: preservedSpots

    };

}


//====================================
// Remove grupos vazios
//====================================

function cleanEmptySwatchGroups(doc) {

    var groups =
        doc.swatchGroups;

    var removed = 0;


    for (
        var i = groups.length - 1;
        i >= 0;
        i--
    ) {

        try {

            var group =
                groups[i];


            if (
                group.getAllSwatches().length > 0
            ) {

                continue;

            }


            group.remove();

            removed++;

        }
        catch (e) {

            continue;

        }

    }


    return removed;

}


//====================================
// MAIN
//====================================

function main() {

    if (
        app.documents.length === 0
    ) {

        RESULT =
            "ERROR: Nenhum documento aberto.";

        throw new Error();

    }


    var doc =
        app.activeDocument;


    var result =
        cleanSwatches(doc);


    var groupsRemoved =
        cleanEmptySwatchGroups(doc);


    RESULT =
        "SUCCESS: Limpeza concluída.\n\n" +

        "Swatches removidas: " +
        result.removed +

        "\n" +

        "Swatches preservadas: " +
        result.preserved +

        "\n\n" +

        "Spots removidas: " +
        result.removedSpots +

        "\n" +

        "Spots preservadas: " +
        result.preservedSpots +

        "\n\n" +

        "Grupos removidos: " +
        groupsRemoved;

}


//====================================
// EXECUÇÃO
//====================================

try {

    main();

}
catch (e) {

    if (
        RESULT === ""
    ) {

        RESULT =
            "ERROR: " +
            e.message;

    }

}


RESULT;