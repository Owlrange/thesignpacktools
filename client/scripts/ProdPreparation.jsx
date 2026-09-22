var doc = app.activeDocument;
var nomeLayer = "Design";
var novaCor;
var desingLayer;
var layersData

if (doc.selection.length === 0) {
    alert("Selecione pelo menos um objeto.");
} else {

    var keep = doc.selection;

    function isChildOf(item, parent) {
        while (item.parent) {
            if (item.parent === parent) return true;
            item = item.parent;
        }
        return false;
    }

    function shouldKeep(item) {
        for (var i = 0; i < keep.length; i++) {
            if (item === keep[i]) return true;
            if (isChildOf(item, keep[i])) return true;
            if (isChildOf(keep[i], item)) return true;
        }
        return false;
    }

    for (var i = doc.pageItems.length - 1; i >= 0; i--) {
        var item = doc.pageItems[i];
        try {
            if (!shouldKeep(item)) {
                item.remove();
            }
        } catch (e) {}
    }

    doc.selection = keep;
}

designLayer = doc.layers.getByName("Design");
// Move todos os itens mantidos pra layer "Design"
for (var i = 0; i < keep.length; i++) {
    try {
        keep[i].move(designLayer, ElementPlacement.PLACEATEND);
    } catch (e) {}
}


// Função para criar cor RGB
function criarCor(r, g, b) {
    var cor = new RGBColor();
    cor.red = r;
    cor.green = g;
    cor.blue = b;
    return cor;
}

function layerExiste(doc, nome) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === nome) {
            return true;
        }
    }
    return false;
}

function getLayerByName(doc, nome) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === nome) {
            return doc.layers[i];
        }
    }
    return null;
}


var nomeProtegido = "Design";
var layerProtegida = null;

// Primeiro: encontrar a layer protegida
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name === nomeProtegido) {
        layerProtegida = doc.layers[i];
        break;
    }
}

if (layerProtegida === null) {
    alert('Layer "' + nomeProtegido + '" não encontrada. Nada foi apagado.');
}

// Depois: apagar todas as outras
for (var i = doc.layers.length - 1; i >= 0; i--) {
	
	var l = doc.layers[i];
    if (l !== layerProtegida) {
        // desbloqueia e mostra
        l.locked = false;
        l.visible = true;

        // remove
        l.remove();
    }
}


novaCor = criarCor(255, 102, 0); // Orange
layer = getLayerByName(doc, nomeLayer);
if (layer === null) {
    alert("Layer não encontrada: " + nomeLayer);
} else {
    layer.color = novaCor;
}

function isInsideArtboard(item, abRect) {
    var b = item.visibleBounds; // [left, top, right, bottom]

    return !(
        b[2] < abRect[0] || // totalmente à esquerda
        b[0] > abRect[2] || // totalmente à direita
        b[1] < abRect[3] || // totalmente abaixo
        b[3] > abRect[1]    // totalmente acima
    );
}

// Percorre de trás pra frente (IMPORTANTE)
for (var i = doc.artboards.length - 1; i >= 0; i--) {

    var ab = doc.artboards[i];
    var abRect = ab.artboardRect;

    var hasContent = false;

    for (var j = 0; j < doc.pageItems.length; j++) {
        try {
            if (isInsideArtboard(doc.pageItems[j], abRect)) {
                hasContent = true;
                break;
            }
        } catch (e) {}
    }

    // Remove se estiver vazio (mas mantém pelo menos 1 artboard)
    if (!hasContent && doc.artboards.length > 1) {
        doc.artboards.remove(i);
    }
}

