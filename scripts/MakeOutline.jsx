var RESULT = "";
var doc = null;
var black = null;

app.userInteractionLevel =
UserInteractionLevel.DISPLAYALERTS;

function criarCorlayer(r,g,b) {
    var cor = new RGBColor();
    cor.red = r;
    cor.green = g;
    cor.blue = b;
    return cor;
}

function criarSwatchBlack() {
    var cor = new CMYKColor();
    
	cor.cyan = 0;
	cor.magenta = 0;
	cor.yellow = 0;
	cor.black = 100;
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


// =========================
// Função recursiva de stroke/fill
// =========================
function aplicarStroke(item) {
    if (item.typename === "PathItem") {
        item.filled = false;
        item.stroked = true;
        item.strokeWidth = getStroke1pt(doc);
        item.strokeColor = black;
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
    outlineLayer = doc.layers.getByName("Outline");
} catch (e) {
    outlineLayer = doc.layers.add();
    outlineLayer.name = "Outline";
	outlineLayer.color = criarCorlayer(0, 0, 0);
}

// Agora valida a layer

	if(outlineLayer.locked){

		RESULT =
		"ERROR: A layer 'Outline' está bloqueada.";

		throw new Error();

	}

	if(!outlineLayer.visible){

		RESULT =
		"ERROR: A layer 'Outline' está oculta.";

		throw new Error();

	}


// =========================
// Cor preta
// =========================
black = criarSwatchBlack();

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
	};
}


var RESULT = "";

try{

    main();

    RESULT = "SUCCESS: Outline criado com sucesso.";


}
catch(e){

    if(RESULT == ""){

		RESULT =
		"Erro inesperado:\n" +
		e.message;

	}

}

RESULT;
