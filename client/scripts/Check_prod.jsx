var doc = app.activeDocument;


function main() {

    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }


    // Resultados
    var results = {
        colorMode: false,
        text: false,
        openPaths: false,
        cutContour: false,
        outline: false,
        boundingBox: false
    };

    // =========================
    // CHECKS
    // =========================

    // Color Mode
    results.colorMode = (doc.documentColorSpace === DocumentColorSpace.CMYK);

    // Textos editáveis
    results.text = (doc.textFrames.length === 0);

    // Nós abertos
    results.openPaths = !hasOpenPaths(doc);

    // Layers específicas
    checkLayerRules(doc, results);

    // =========================
    // UI
    // =========================

    showUI(results);
}

function hasLayer(name) {
    try {
        doc.layers.getByName(name);
        return true;
    } catch (e) {
        return false;
    }
}

// =========================
// FUNÇÕES
// =========================

function hasOpenPaths(doc) {
    var items = doc.pathItems;
    for (var i = 0; i < items.length; i++) {
        if (!items[i].closed) return true;
    }
    return false;
}

function checkLayerRules(doc, results) {

    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];

        if (!layer.visible || layer.locked) continue;

        if (layer.name === "CutContour") {
            results.cutContour = validateCutContour(layer, doc);
        }

        if (layer.name === "Outline") {
            results.outline = validateOutline(layer);
        }

        if (layer.name === "BoundingBox") {
            results.boundingBox = validateBoundingBox(layer);
        }
    }
}

function isValidCutContourColor(color) {

    if (color.typename !== "SpotColor") return false;

    if (color.spot.colorType !== ColorModel.SPOT ) return false;

    var name = color.spot.name.toLowerCase();

    if (name.indexOf("cutcontour") === -1) {
        return false;
    }


	return Math.abs(color.tint - 100) < 0.1;
}

function isBlack100(color) {


    if (!color || color.typename !== "CMYKColor") return false;

    return (
        color.black >= 99 &&
        color.cyan <= 1 &&
        color.magenta <= 1 &&
        color.yellow <= 1
    );
}

function collectPathItems(item, list) {

    if (item.typename === "PathItem") {
        list.push(item);
        return;
    }

    if (item.typename === "CompoundPathItem") {
        for (var i = 0; i < item.pathItems.length; i++) {
            list.push(item.pathItems[i]);
        }
        return;
    }

    if (item.typename === "GroupItem") {
        for (var j = 0; j < item.pageItems.length; j++) {
            collectPathItems(item.pageItems[j], list);
        }
    }
}

function validateCutContour(layer) {

    var paths = [];

    for (var i = 0; i < layer.pageItems.length; i++) {
        collectPathItems(layer.pageItems[i], paths);
    }

    if (paths.length === 0) return true;

    for (var p = 0; p < paths.length; p++) {
        var it = paths[p];

        if (it.filled) return false;
        if (!it.stroked) return false;
        if (it.strokeWidth >= 0.11 && it.strokeWidth <= 0.09) return false;
        if (!isValidCutContourColor(it.strokeColor)) return false;
    }

    return true;
}
function isStroke1pt(w) {
    return w >= 0.9 && w <= 1.1;
}

function validateOutline(layer) {

    var paths = [];

    for (var i = 0; i < layer.pageItems.length; i++) {
        collectPathItems(layer.pageItems[i], paths);
    }
    if (paths.length === 0) return true;

    for (var p = 0; p < paths.length; p++) {
        var it = paths[p];
		
        if (it.filled) return false;
        if (!it.stroked) return false;
        if (it.strokeWidth >= 0.11 && it.strokeWidth <= 0.09) return false;
		if (!isBlack100(it.strokeColor)) return false;
    }
	return true;
}



function validateBoundingBox(layer) {
    var items = layer.pageItems;
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.filled || it.stroked) return false;
    }
    return true;
}

function hasLayer(doc, name) {
    try {
        doc.layers.getByName(name);
        return true;
    } catch (e) {
        return false;
    }
}

// =========================
// UI
// =========================

function showUI(r) {

    var w = new Window("dialog", "Basic Preflight");
    w.orientation = "column";
    w.alignChildren = "left";

    function addCheck(label, value) {
        var cb = w.add("checkbox", undefined, label);
        cb.value = value;
        cb.enabled = true;
    }

    addCheck("Documento em CMYK", r.colorMode);
    addCheck("Sem textos editáveis", r.text);
    addCheck("Sem nós abertos", r.openPaths);
	if (hasLayer(doc, "CutContour")) {
    addCheck("CutContour OK", r.cutContour);
	}
    if (hasLayer(doc, "Outline")) {
		addCheck("Outline OK", r.outline);
		}
    if (hasLayer(doc, "BoundingBox")) {
		addCheck("BoundingBox OK", r.boundingBox);
		}

    w.add("button", undefined, "Fechar", {name:"ok"});
    w.show();
}

main();