
var RESULT = "";
var doc = null;
var outlineLayer = null;

doc = app.activeDocument;

function criarCorlayer() {
    var cor = new RGBColor();
    cor.red = 255;
    cor.green = 60;
    cor.blue = 60;
    return cor;
}

function main(){

try {
    outlineLayer = doc.layers.getByName("Ref");
	
	RESULT =
		"ERROR: A layer 'Ref' já existe.";

		throw new Error();
	
} catch (e) {
    outlineLayer = doc.layers.add();
    outlineLayer.name = "Ref";
	outlineLayer.printable = false;
	outlineLayer.color = criarCorlayer();
}

if(outlineLayer.locked){

		RESULT =
		"ERROR: A layer 'Ref' está bloqueada.";

		throw new Error();

	}

	if(!outlineLayer.visible){

		RESULT =
		"ERROR: A layer 'Ref' está oculta.";

		throw new Error();

	}

}

try{

    main();

    RESULT = "SUCCESS: Ref criado com sucesso.";


}
catch(e){

    if(RESULT == ""){

		RESULT =
		"Erro inesperado:\n" +
		e.message;

	}

}

RESULT;
