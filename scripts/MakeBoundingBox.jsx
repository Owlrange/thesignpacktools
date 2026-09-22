var RESULT = "";
var doc = null;
var outlineLayer = null;

app.userInteractionLevel =
UserInteractionLevel.DISPLAYALERTS;

function criarCor(r, g, b) {
    var cor = new RGBColor();
    cor.red = r;
    cor.green = g;
    cor.blue = b;
    return cor;
}

// =========================
// Garante layer Outline
// =========================

function main(){

doc = app.activeDocument;
try {
    outlineLayer = doc.layers.getByName("BoundingBox");
} catch (e) {
    outlineLayer = doc.layers.add();
    outlineLayer.name = "BoundingBox";
	outlineLayer.color = criarCor(153, 204, 0);
}

if(outlineLayer.locked){

		RESULT =
		"ERROR: A layer 'BoundingBox' está bloqueada.";

		throw new Error();

	}

	if(!outlineLayer.visible){

		RESULT =
		"ERROR: A layer 'BoundingBox' está oculta.";

		throw new Error();

	}


// =========================
// Processa seleção
// =========================
var sel = doc.selection;
if (sel.length === 0) {

    RESULT = "ERROR: Nenhum objeto selecionado.";
	throw new Error();

}
for (var i = doc.selection.length - 1; i >= 0; i--) {
    processItem(sel[i]);
};

}


function askDeleteOriginal() {

    var w = new Window("dialog", "BondingBox – Objeto original");
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

// =========================
// Função principal
// =========================
function processItem(item) {

    // Duplica
    var copy = item.duplicate();

    // Move para layer Outline
    copy.move(outlineLayer, ElementPlacement.PLACEATBEGINNING);

    // Texto → outline
    if (copy.typename === "TextFrame") {
        copy.createOutline();
    }

    aplicarStroke(copy);
	var userChoice = askDeleteOriginal();
	// só apaga se o usuário escolheu
	if (userChoice === "delete") {
		try {
			item.remove();
		} catch (e) {}
	}
}

// =========================
// Aplica stroke recursivamente
// =========================
function aplicarStroke(item) {

    // Path simples
    if (item.typename === "PathItem") {

        item.filled = false;

        item.stroked = false;

        return;
    }

    // Grupo
    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) {
            aplicarStroke(item.pageItems[i]);
        }
        return;
    }

    // Compound Path
    if (item.typename === "CompoundPathItem") {
        for (var i = 0; i < item.pathItems.length; i++) {
            aplicarStroke(item.pathItems[i]);
        }
        return;
    }
	
	
}

try{

    main();

    RESULT = "SUCCESS: BoundingBox criado com sucesso.";


}
catch(e){

    if(RESULT == ""){

		RESULT =
		"Erro inesperado:\n" +
		e.message;

	}

}

RESULT;
