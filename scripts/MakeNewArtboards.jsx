#target illustrator

var RESULT = "";
var doc = app.activeDocument;

var COLUMN_TOLERANCE = 2;

app.userInteractionLevel =
    UserInteractionLevel.DISPLAYALERTS;


//==================================================
// MAIN
//==================================================

function main() {

    if (doc.selection.length === 0) {

        RESULT =
            "ERROR: Selecione um ou mais objetos.";

        throw new Error();

    }


    //================================================
    // Captura objetos selecionados
    //================================================

    var items = [];


    for (
        var i = 0;
        i < doc.selection.length;
        i++
    ) {

        var item =
            doc.selection[i];


        try {

            // Verifica se possui bounds válidos
            item.geometricBounds;

            items.push(item);

        }
        catch (e) {

            // Ignora objetos sem bounds

        }

    }


    if (items.length === 0) {

        RESULT =
            "ERROR: Nenhum objeto possui limites geométricos válidos.";

        throw new Error();

    }


    //================================================
    // Ordenação
    //
    // Prioridade:
    // 1. Esquerda → direita
    // 2. Cima → baixo somente quando
    //    X for praticamente igual
    //================================================

    items.sort(
        function(a, b) {

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


            // Objetos praticamente na mesma coluna
            if (
                Math.abs(
                    aLeft - bLeft
                ) <= COLUMN_TOLERANCE
            ) {

                // Mais alto primeiro
                return bTop - aTop;

            }


            // Prioridade absoluta:
            // esquerda → direita

            return aLeft - bLeft;

        }
    );


    //================================================
    // Cria Artboards
    //================================================

    for (
        var i = 0;
        i < items.length;
        i++
    ) {

        var bounds =
            items[i].geometricBounds;


        doc.artboards.add(
            bounds
        );

    }

}


//==================================================
// EXECUÇÃO
//==================================================

try {

    main();

    RESULT =
        "SUCCESS: Artboards criadas com sucesso.";

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