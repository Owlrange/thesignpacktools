#target illustrator

var doc = app.activeDocument;

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
function getStroke1pt(doc)
{
    if (doc.scaleFactor)
        return 1 / doc.scaleFactor;

    return 1;
}

//====================================
// Layer Outline
//====================================
function getOutlineLayer(doc)
{
    try
    {
        return doc.layers.getByName("Outline");
    }
    catch(e)
    {
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
function getBlack()
{
    var black = new CMYKColor();
    black.cyan = 0;
    black.magenta = 0;
    black.yellow = 0;
    black.black = 100;
    return black;
}

//====================================
// Verifica se um ponto está dentro da Artboard
//====================================
function pointInArtboard(x, y, rect)
{
    return (
        x >= rect[0] &&
        x <= rect[2] &&
        y <= rect[1] &&
        y >= rect[3]
    );
}

//====================================
// MAIN
//====================================

var outlineLayer = getOutlineLayer(doc);
var black = getBlack();
var stroke = getStroke1pt(doc);

// Marca quais artboards possuem objetos
var usedArtboards = [];

for (var i = 0; i < doc.artboards.length; i++)
    usedArtboards[i] = false;

// Percorre cada objeto APENAS UMA VEZ
for (var i = 0; i < doc.pageItems.length; i++)
{
    var item = doc.pageItems[i];

    if (item.hidden || item.locked)
        continue;

    // Ignora objetos da própria layer Outline
    if (item.layer == outlineLayer)
        continue;

    try
    {
        var b = item.visibleBounds;

        // Centro do objeto
        var cx = (b[0] + b[2]) / 2;
        var cy = (b[1] + b[3]) / 2;

        // Descobre em qual artboard ele está
        for (var a = 0; a < doc.artboards.length; a++)
        {
            if (usedArtboards[a])
                continue;

            if (pointInArtboard(cx, cy, doc.artboards[a].artboardRect))
            {
                usedArtboards[a] = true;
                break;
            }
        }
    }
    catch(e){}
}

// Desenha apenas nas artboards utilizadas
for (var a = 0; a < doc.artboards.length; a++)
{
    if (!usedArtboards[a])
        continue;

    var r = doc.artboards[a].artboardRect;

    var shape = outlineLayer.pathItems.rectangle(
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