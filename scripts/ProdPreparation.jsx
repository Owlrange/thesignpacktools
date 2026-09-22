#target illustrator

var RESULT = "";


//==================================================
// CONFIGURAÇÕES
//==================================================

var DESIGN_LAYER_NAME = "Design";


//==================================================
// DOCUMENTO
//==================================================

var doc = null;


//==================================================
// COR DA LAYER DESIGN
//==================================================

function criarCor(r, g, b) {

    var cor = new RGBColor();

    cor.red = r;
    cor.green = g;
    cor.blue = b;

    return cor;

}


//==================================================
// ENCONTRA LAYER
//==================================================

function getLayerByName(doc, nome) {

    for (var i = 0; i < doc.layers.length; i++) {

        if (doc.layers[i].name === nome) {
            return doc.layers[i];
        }

    }

    return null;

}


//==================================================
// CRIA OU ENCONTRA DESIGN
//==================================================

function getDesignLayer(doc) {

    var layer =
        getLayerByName(
            doc,
            DESIGN_LAYER_NAME
        );


    if (layer === null) {

        layer =
            doc.layers.add();

        layer.name =
            DESIGN_LAYER_NAME;

    }


    layer.locked = false;
    layer.visible = true;

    layer.color =
        criarCor(
            255,
            102,
            0
        );

    return layer;

}


//==================================================
// VERIFICA RELAÇÃO ENTRE OBJETOS
//==================================================

function isChildOf(item, parent) {

    var current =
        item.parent;


    while (current) {

        if (current === parent) {
            return true;
        }

        current =
            current.parent;

    }

    return false;

}


//==================================================
// DETERMINA SE ITEM DEVE SER MANTIDO
//==================================================

function shouldKeep(item, keep) {

    for (
        var i = 0;
        i < keep.length;
        i++
    ) {

        var selected =
            keep[i];


        // O próprio objeto
        if (
            item === selected
        ) {
            return true;
        }


        // Item está dentro do objeto selecionado
        if (
            isChildOf(
                item,
                selected
            )
        ) {
            return true;
        }


        // Objeto selecionado está dentro do item
        if (
            isChildOf(
                selected,
                item
            )
        ) {
            return true;
        }

    }


    return false;

}


//==================================================
// REMOVE OBJETOS NÃO SELECIONADOS
//==================================================

function removeUnselectedItems(
    doc,
    keep
) {

    for (
        var i = doc.pageItems.length - 1;
        i >= 0;
        i--
    ) {

        var item =
            doc.pageItems[i];


        try {

            if (
                !shouldKeep(
                    item,
                    keep
                )
            ) {

                item.remove();

            }

        }
        catch (e) {}

    }

}


//==================================================
// MOVE SELEÇÃO PARA DESIGN
//==================================================

function moveSelectionToDesign(
    keep,
    designLayer
) {

    for (
        var i = 0;
        i < keep.length;
        i++
    ) {

        try {

            keep[i].move(
                designLayer,
                ElementPlacement.PLACEATEND
            );

        }
        catch (e) {}

    }

}


//==================================================
// REMOVE TODAS AS OUTRAS LAYERS
//==================================================

function removeOtherLayers(
    doc,
    designLayer
) {

    for (
        var i = doc.layers.length - 1;
        i >= 0;
        i--
    ) {

        var layer =
            doc.layers[i];


        if (
            layer === designLayer
        ) {
            continue;
        }


        try {

            layer.locked = false;
            layer.visible = true;

            layer.remove();

        }
        catch (e) {}

    }

}


//==================================================
// ORDENA OBJETOS
//
// Primeiro: posição vertical
// Depois: posição horizontal
//
// Resultado:
// canto superior esquerdo → primeiro
//==================================================

function sortItems(items) {

    items.sort(
        function (a, b) {

            var ab =
                a.visibleBounds;

            var bb =
                b.visibleBounds;


            var ay =
                (ab[1] + ab[3]) / 2;

            var by =
                (bb[1] + bb[3]) / 2;


            var ax =
                (ab[0] + ab[2]) / 2;

            var bx =
                (bb[0] + bb[2]) / 2;


            // Tolerância para considerar
            // objetos na mesma linha

            var tolerance =
                5;


            if (
                Math.abs(ay - by)
                > tolerance
            ) {

                return by - ay;

            }


            return ax - bx;

        }
    );

}


//==================================================
// CRIA ARTBOARD PARA CADA OBJETO
//==================================================

function createArtboardsFromItems(
    doc,
    items
) {

    var boundsList = [];


    // Primeiro captura os bounds
    // antes de alterar as artboards

    for (
        var i = 0;
        i < items.length;
        i++
    ) {

        try {

            var b =
                items[i].visibleBounds;


            boundsList.push({
                left: b[0],
                top: b[1],
                right: b[2],
                bottom: b[3]
            });

        }
        catch (e) {}

    }


    if (
        boundsList.length === 0
    ) {

        throw new Error(
            "Não foi possível obter os limites dos objetos selecionados."
        );

    }


    // Remove todas as artboards existentes,
    // mantendo temporariamente uma.

    while (
        doc.artboards.length > 1
    ) {

        doc.artboards.remove(
            doc.artboards.length - 1
        );

    }


    // Reaproveita a primeira artboard
    // para o primeiro objeto

    for (
        var i = 0;
        i < boundsList.length;
        i++
    ) {

        var b =
            boundsList[i];


        var width =
            b.right - b.left;

        var height =
            b.top - b.bottom;


        if (i === 0) {

            doc.artboards[0].artboardRect = [
                b.left,
                b.top,
                b.right,
                b.bottom
            ];

        }
        else {

            doc.artboards.add([
                b.left,
                b.top,
                b.right,
                b.bottom
            ]);

        }

    }

}


//==================================================
// LIMPEZA DE SWATCHES
//==================================================


//--------------------------------------------------
// Verifica se uma Spot está sendo utilizada
//--------------------------------------------------

function spotIsUsed(
    item,
    targetSpot
) {

    try {

        // PATH

        if (
            item.typename === "PathItem"
        ) {

            if (
                item.filled
            ) {

                try {

                    if (
                        item.fillColor.typename ===
                        "SpotColor" &&
                        item.fillColor.spot ===
                        targetSpot
                    ) {

                        return true;

                    }

                }
                catch (e) {}

            }


            if (
                item.stroked
            ) {

                try {

                    if (
                        item.strokeColor.typename ===
                        "SpotColor" &&
                        item.strokeColor.spot ===
                        targetSpot
                    ) {

                        return true;

                    }

                }
                catch (e) {}

            }

        }


        // TEXTO

        if (
            item.typename === "TextFrame"
        ) {

            try {

                if (
                    item.textRange
                        .characterAttributes
                        .fillColor
                        .typename ===
                    "SpotColor" &&

                    item.textRange
                        .characterAttributes
                        .fillColor
                        .spot ===
                    targetSpot
                ) {

                    return true;

                }

            }
            catch (e) {}


            try {

                if (
                    item.textRange
                        .characterAttributes
                        .strokeColor
                        .typename ===
                    "SpotColor" &&

                    item.textRange
                        .characterAttributes
                        .strokeColor
                        .spot ===
                    targetSpot
                ) {

                    return true;

                }

            }
            catch (e) {}

        }


        // GRUPO

        if (
            item.typename === "GroupItem"
        ) {

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


        // COMPOUND PATH

        if (
            item.typename ===
            "CompoundPathItem"
        ) {

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


//--------------------------------------------------
// Verifica Spot no documento
//--------------------------------------------------

function isSpotUsed(
    doc,
    targetSpot
) {

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


//--------------------------------------------------
// Limpa Swatches
//--------------------------------------------------

function cleanSwatches(doc) {

    var swatches =
        doc.swatches;


    for (
        var i = swatches.length - 1;
        i >= 0;
        i--
    ) {

        try {

            var swatch =
                swatches[i];


            var color =
                swatch.color;


            var type =
                color.typename;


            // NONE

            if (
                type === "NoColor"
            ) {
                continue;
            }


            // REGISTRATION

            if (
                swatch.name ===
                "[Registration]"
            ) {
                continue;
            }


            // SPOT

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

                    continue;

                }


                swatch.remove();

                continue;

            }


            // Todas as outras:
            // CMYK
            // RGB
            // Global
            // Gray
            // Pattern
            // Gradient
            // etc.

            swatch.remove();

        }
        catch (e) {}

    }


    // Remove grupos vazios

    var groups =
        doc.swatchGroups;


    for (
        var i = groups.length - 1;
        i >= 0;
        i--
    ) {

        try {

            if (
                groups[i]
                    .getAllSwatches()
                    .length === 0
            ) {

                groups[i].remove();

            }

        }
        catch (e) {}

    }

}


//==================================================
// MAIN
//==================================================

function main() {

    if (
        app.documents.length === 0
    ) {

        RESULT =
            "ERROR: Nenhum documento aberto.";

        throw new Error();

    }


    doc =
        app.activeDocument;


    //================================================
    // 1. CAPTURA SELEÇÃO
    //================================================

    if (
        doc.selection.length === 0
    ) {

        RESULT =
            "ERROR: Nenhum objeto selecionado.";

        throw new Error();

    }


    var keep =
        [];


    for (
        var i = 0;
        i < doc.selection.length;
        i++
    ) {

        keep.push(
            doc.selection[i]
        );

    }


    //================================================
    // 2. ORDENA SELEÇÃO
    //================================================

    sortItems(
        keep
    );


    //================================================
    // 3. DESIGN LAYER
    //================================================

    var designLayer =
        getDesignLayer(
            doc
        );


    //================================================
    // 4. REMOVE OBJETOS NÃO SELECIONADOS
    //================================================

    removeUnselectedItems(
        doc,
        keep
    );


    //================================================
    // 5. MOVE SELEÇÃO PARA DESIGN
    //================================================

    moveSelectionToDesign(
        keep,
        designLayer
    );


    //================================================
    // 6. REMOVE OUTRAS LAYERS
    //================================================

    removeOtherLayers(
        doc,
        designLayer
    );


    //================================================
    // 7. CRIA ARTBOARDS
    //================================================

    createArtboardsFromItems(
        doc,
        keep
    );


    //================================================
    // 8. LIMPA SWATCHES
    //================================================

    cleanSwatches(
        doc
    );


    //================================================
    // 9. FINALIZA
    //================================================

    doc.selection =
        keep;


    RESULT =
        "SUCCESS: Prod Preparation concluído.";

}


//==================================================
// EXECUÇÃO
//==================================================

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