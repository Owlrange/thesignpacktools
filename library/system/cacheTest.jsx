function testCachedJSX(){

    var file = new File(
        Folder.userData +
        "/TheSignPackTools/library/teste.jsx"
    );

    if(!file.exists){

        return "ERROR: test.jsx não encontrado.";

    }

    try{

        $.evalFile(file);

        return "SUCCESS: JSX executado.";

    }
    catch(e){

        return (
            "ERROR: " +
            e.message
        );

    }

}

testCachedJSX();