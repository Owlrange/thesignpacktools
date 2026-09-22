#target illustrator

var doc = app.activeDocument;

if (doc.selection.length == 0) {
    alert("Selecione um ou mais objetos.");
}

for (var i = 0; i < doc.selection.length; i++) {

    var item = doc.selection[i];

    try {

        var b = item.geometricBounds;
        // [left, top, right, bottom]

        doc.artboards.add(b);

    } catch(e) {
        // ignora objetos que não possuem bounds
    }
}