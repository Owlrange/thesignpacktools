

var doc = app.activeDocument;
app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

function getWhiteInkColor(doc) {

    var spot;

    try {
        spot = doc.spots.getByName("White Ink");
    } catch (e) {
        spot = doc.spots.add();
        spot.name = "White Ink";
        spot.colorType = ColorModel.SPOT;

        // Cor de visualização (pode ser qualquer uma)
        var cmyk = new CMYKColor();
        cmyk.cyan = 100;
        cmyk.magenta = 0;
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

// =========================
// Garante layer White Ink
// =========================
var WhiteInkLayer;
try {
    WhiteInkLayer = doc.layers.getByName("White Ink");
} catch (e) {
    WhiteInkLayer = doc.layers.add();
    WhiteInkLayer.name = "White Ink";
	WhiteInkLayer.color = criarCor(0, 255, 255);
}


// SpotColor CutContour
var WhiteInkColor = getWhiteInkColor(doc);

// Array para guardar todos os itens processados
var itemsToGroup = [];


// Loop da seleção
var sel = doc.selection;
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
    aplicarFill(item);

    itemsToGroup.push(item);
	
	originalItem.remove();
}


// Agrupar todos os itens processados
if (itemsToGroup.length > 1) {
    var finalGroup = doc.groupItems.add();
    for (var j = 0; j < itemsToGroup.length; j++) {
        itemsToGroup[j].move(finalGroup, ElementPlacement.PLACEATEND);
    }
    finalGroup.move(WhiteInkLayer, ElementPlacement.PLACEATBEGINNING);
} else if (itemsToGroup.length === 1) {
    itemsToGroup[0].move(WhiteInkLayer, ElementPlacement.PLACEATBEGINNING);
}

// =========================
// Função recursiva de stroke/fill
// =========================
function aplicarFill(item) {
    if (item.typename === "PathItem") {
        item.filled = true;
        item.stroked = false;
        item.fillColor = WhiteInkColor;
        return;
    }
    if (item.typename === "GroupItem") {
        for (var i = 0; i < item.pageItems.length; i++) {
            aplicarFill(item.pageItems[i]);
        }
        return;
    }
    if (item.typename === "CompoundPathItem") {
        for (var i = 0; i < item.pathItems.length; i++) {
            aplicarFill(item.pathItems[i]);
        }
        return;
    }
}
