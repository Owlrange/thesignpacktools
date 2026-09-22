#target illustrator

var RESULT = "";
var doc = app.activeDocument;
var artboards = doc.artboards;
var black = null;
var outlineLayer = null;


//====================================
// Cor da layer
//====================================
function criarCorlayer() {

    var cor = new RGBColor();

    cor.red = 0;
    cor.green = 0;
    cor.blue = 0;

    return cor;

}


//====================================
// Espessura de 1 pt considerando Scale Factor
//====================================
function getStroke1pt(doc) {

    if (doc.scaleFactor)
        return 1 / doc.scaleFactor;

    return 1;

}


//====================================
// Layer Outline
//====================================
function getOutlineLayer(doc) {

    try {

        return doc.layers.getByName("Outline");

    }
    catch(e) {

        var layer = doc.layers.add();

        layer.name = "Outline";
        layer.printable = false;
        layer.color = criarCorlayer();

        return layer;

    }

}


//====================================
// Preto CMYK
//====================================
function getBlack() {

    var black = new CMYKColor();

    black.cyan = 0;
    black.magenta = 0;
    black.yellow = 0;
    black.black = 100;

    return black;

}


//====================================
// Seleção de Artboards
//====================================
function askArtboards(doc) {

    var w = new Window(
        "dialog",
        "Select Artboards"
    );

    w.orientation = "column";
    w.alignChildren = "fill";
    w.spacing = 8;
    w.margins = 12;


    //====================================
    // Título
    //====================================

    w.add(
        "statictext",
        undefined,
        "Selecione as artboards:"
    );
	
	//====================================
    // Select All / Select None
    //====================================

    var selectionButtons =
        w.add(
            "group"
        );

    selectionButtons.alignment =
        "center";


    var selectAll =
        selectionButtons.add(
            "button",
            undefined,
            "Select All"
        );


    var selectNone =
        selectionButtons.add(
            "button",
            undefined,
            "Select None"
        );


    //====================================
    // Select All
    //====================================

    selectAll.onClick = function() {

        for (
            var i = 0;
            i < list.items.length;
            i++
        ) {

            list.items[i].selected = true;

        }

        updateCounter();

    };


    //====================================
    // Select None
    //====================================

    selectNone.onClick = function() {

        for (
            var i = 0;
            i < list.items.length;
            i++
        ) {

            list.items[i].selected = false;

        }

        updateCounter();

    };


    //====================================
    // Lista de Artboards
    //====================================

    var list = w.add(
        "listbox",
        undefined,
        undefined,
        {
            multiselect: true
        }
    );

    list.preferredSize = [
        320,
        250
    ];


    //====================================
    // Adiciona Artboards
    //====================================

    for (
        var i = 0;
        i < doc.artboards.length;
        i++
    ) {

        var item = list.add(
            "item",
            doc.artboards[i].name
        );

        // Guarda o índice da artboard
        item.artboardIndex = i;

    }


    //====================================
    // Contador
    //====================================

    var counter =
        w.add(
            "statictext",
            undefined,
            "0 de " +
            doc.artboards.length +
            " selecionadas"
        );


    //====================================
    // Atualiza contador
    //====================================

    function updateCounter() {

        var selection = list.selection;

        var count = 0;

        if (selection) {

            if (selection instanceof Array) {

                count = selection.length;

            }
            else {

                count = 1;

            }

        }

        counter.text =
            count +
            " de " +
            doc.artboards.length +
            " selecionadas";

    }


    // Atualiza quando a seleção muda
    list.onChange =
        updateCounter;


    


    //====================================
    // OK / Cancel
    //====================================

    var buttons =
        w.add(
            "group"
        );

    buttons.alignment =
        "center";


    var ok =
        buttons.add(
            "button",
            undefined,
            "Create"
        );


    var result = null;

    //====================================
    // OK
    //====================================

    ok.onClick = function() {

        var selection =
            list.selection;


        if (!selection) {

            alert(
                "Selecione pelo menos uma artboard."
            );

            return;

        }


        if (!(selection instanceof Array)) {

            selection = [
                selection
            ];

        }


        result = [];


        for (
            var i = 0;
            i < selection.length;
            i++
        ) {

            result.push(
                selection[i].artboardIndex
            );

        }


        w.close();

    };


    //====================================
    // Abre janela
    //====================================

    w.show();


    return result;

}


//====================================
// MAIN
//====================================
function main() {

    outlineLayer =
        getOutlineLayer(doc);

    black =
        getBlack();

    var stroke =
        getStroke1pt(doc);


    //====================================
    // Escolhe as Artboards
    //====================================

    var selectedArtboards =
        askArtboards(doc);


    // Cancelou
    if (selectedArtboards === null) {

        RESULT =
            "WARNING: Operação cancelada.";

        return;

    }


    //====================================
    // Cria Outline
    //====================================

    for (
        var i = 0;
        i < selectedArtboards.length;
        i++
    ) {

        var index =
            selectedArtboards[i];


        var r =
            doc.artboards[index].artboardRect;


        var shape =
            outlineLayer.pathItems.rectangle(
                r[1],
                r[0],
                r[2] - r[0],
                r[1] - r[3]
            );


        shape.stroked = true;
        shape.filled = false;
        shape.strokeWidth = stroke;
        shape.strokeColor = black;

    }

}


//====================================
// EXECUÇÃO
//====================================

try {

    main();

    if (RESULT === "") {

        RESULT =
            "SUCCESS: Contornos criado com sucesso.";

    }

}
catch(e) {


        RESULT =
            "Erro inesperado:\n" +
            e.message;



}


RESULT;