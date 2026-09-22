function readFile(filePath){

    try{

        var file =
            new File(filePath);


        if(!file.exists){

            return "ERROR:Arquivo não encontrado.";

        }


        file.encoding =
            "UTF-8";


        if(!file.open("r")){

            return "ERROR:Não foi possível abrir o arquivo.";

        }


        var content =
            file.read();


        file.close();


        return content;

    }
    catch(error){

        return (
            "ERROR:" +
            error.message
        );

    }

}