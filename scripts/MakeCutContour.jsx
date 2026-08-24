var RESULT = "";
var doc = null;
var cutColor = null;

app.userInteractionLevel =
UserInteractionLevel.DISPLAYALERTS;


function getCutContourColor(doc) {

    var spot;

    try {
        spot = doc.spots.getByName("CutContour");
    } catch (e) {
        spot = doc.spots.add();
        spot.name = "CutContour";
        spot.colorType = ColorModel.SPOT;

        // Cor de visualização (pode ser qualquer uma)
        var cmyk = new CMYKColor();
        cmyk.cyan = 0;
        cmyk.magenta = 100;
        cmyk.yellow = 0;
        cmyk.black = 0;

        spot.color = cmyk;
    }

    var spotColor = new SpotColor();
    spotColor.spot = spot;
    spotColor.tint = 100;

    return spotColor;
}

function criarCor(r, g, b) {
    var cor = new RGBColor();
    cor.red = r;
    cor.green = g;
    cor.blue = b;
    return cor;
}

function askDeleteOriginal() {

    var w = new Window("dialog", "CutContour – Objeto original");
    w.orientation = "column";
    w.alignChildren = "fill";

    w.add("statictext", undefined,
        "Deseja manter o objeto original?"
    );

    var btnGroup = w.add("group");
    btnGroup.alignment = "center";

    var keepBtn = btnGroup.add("button", undefined, "Manter original");
    var deleteBtn = btnGroup.add("button", undefined, "Remover original");

    var result = "keep";

    keepBtn.onClick = function () {
        result = "keep";
        w.close();
    };

    deleteBtn.onClick = function () {
        result = "delete";
        w.close();
    };

    w.show();

    return result;
}

function getStroke1pt(doc) {
    return 1 / doc.scaleFactor;
}
function main(){
	if (app.documents.length === 0) {

		RESULT = "ERROR: Nenhum documento aberto.";
		throw new Error();

}
	doc = app.activeDocument;
	app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

	
	// =========================
	// Garante layer Outline
	// =========================
	var outlineLayer;
	try {

		outlineLayer = doc.layers.getByName("CutContour");

	}
	catch(e){

		outlineLayer = doc.layers.add();
		outlineLayer.name = "CutContour";
		outlineLayer.color = criarCor(255,79,255);

	}

	// Agora valida a layer

	if(outlineLayer.locked){

		RESULT =
		"ERROR: A layer 'CutContour' está bloqueada.";

		throw new Error();

	}

	if(!outlineLayer.visible){

		RESULT =
		"ERROR: A layer 'CutContour' está oculta.";

		throw new Error();

	}


	// SpotColor CutContour
	cutColor = getCutContourColor(doc);

	// Array para guardar todos os itens processados
	var itemsToGroup = [];

	var userChoice = askDeleteOriginal();

	// Loop da seleção
	var sel = doc.selection;
	if (sel.length === 0) {

    RESULT = "ERROR: Nenhum objeto selecionado.";
	throw new Error();

}
	
	for (var i = 0; i < sel.length; i++) {
		var originalItem = sel[i];
		var item; // este será o item processado (outline ou duplicate)

		// Converter texto em outline
		if (originalItem.typename === "TextFrame") {
			item = originalItem.createOutline();
		} else {
			// Para qualquer outro tipo (PathItem, GroupItem, etc)
			item = originalItem.duplicate();
		}

		// Aplicar stroke/fill
		aplicarStroke(item);

		itemsToGroup.push(item);

		// só apaga se o usuário escolheu
		if (userChoice === "delete") {
			try {
				originalItem.remove();
			} catch (e) {}
		}
	}


	// Agrupar todos os itens processados
	if (itemsToGroup.length > 1) {
		var finalGroup = doc.groupItems.add();
		for (var j = 0; j < itemsToGroup.length; j++) {
			itemsToGroup[j].move(finalGroup, ElementPlacement.PLACEATEND);
		}
		finalGroup.move(outlineLayer, ElementPlacement.PLACEATBEGINNING);
	} else if (itemsToGroup.length === 1) {
		itemsToGroup[0].move(outlineLayer, ElementPlacement.PLACEATBEGINNING);
	}
}

// =========================
// Função recursiva de stroke/fill
// =========================
function aplicarStroke(item) {
    if (item.typename === "PathItem") {
        item.filled = false;
        item.stroked = true;
        item.strokeWidth = getStroke1pt(doc);
        item.strokeColor = cutColor;
        return;
    }
    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) {
            aplicarStroke(item.pageItems[i]);
        }
        return;
    }
    if (item.typename === "CompoundPathItem") {
        for (var i = 0; i < item.pathItems.length; i++) {
            aplicarStroke(item.pathItems[i]);
        }
        return;
    }
}

var RESULT = "";

try{

    main();

    RESULT = "SUCCESS: CutContour criado com sucesso.";


}
catch(e){

    if(RESULT == ""){

		RESULT =
		"Erro inesperado:\n" +
		e.message;

	}

}

RESULT;
