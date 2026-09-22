

var doc = app.activeDocument;

function criarCorlayer() {
    var cor = new RGBColor();
    cor.red = 255;
    cor.green = 60;
    cor.blue = 60;
    return cor;
}


var outlineLayer;
try {
    outlineLayer = doc.layers.getByName("Ref");
} catch (e) {
    outlineLayer = doc.layers.add();
    outlineLayer.name = "Ref";
	outlineLayer.printable = false;
	outlineLayer.color = criarCorlayer();
}
