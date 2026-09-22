

var doc = app.activeDocument;

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
var outlineLayer;
try {
    outlineLayer = doc.layers.getByName("BoundingBox");
} catch (e) {
    outlineLayer = doc.layers.add();
    outlineLayer.name = "BoundingBox";
	outlineLayer.color = criarCor(153, 204, 0);
}




// =========================
// Processa seleção
// =========================
for (var i = doc.selection.length - 1; i >= 0; i--) {
    processItem(doc.selection[i]);
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
