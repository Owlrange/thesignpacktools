function readFile(
    filePath
){

    try{

        var file =
            new File(
                filePath
            );


        if(!file.exists){

            return (
                "ERROR:File not found."
            );

        }


        file.encoding =
            "UTF-8";


        if(!file.open("r")){

            return (
                "ERROR:Unable to open the file."
            );

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
