var LOADER = {

    // ==========================================
    // LOAD FILE FROM CACHE
    // ==========================================

    load: function(
        relativePath,
        callback
    ){

        var filePath =
            CACHE.getFilePath(
                relativePath
            );


        if(!filePath){

            callback({

                success: false,

                error:
                    "Unable to resolve the cache file path."

            });

            return;

        }


        var result =
            cep.fs.readFile(
                filePath
            );


        if(
            result.err !== 0
        ){

            callback({

                success: false,

                error:
                    "Unable to read file:\n" +
                    filePath

            });

            return;

        }


        callback({

            success: true,

            path:
                filePath,

            content:
                result.data

        });

    },


    // ==========================================
    // INJECT SCRIPT INTO PAGE
    // ==========================================

    inject: function(
        content,
        callback
    ){

        try{

            var script =
                document.createElement(
                    "script"
                );


            script.type =
                "text/javascript";


            script.text =
                content;


            document.head.appendChild(
                script
            );


            callback({

                success: true

            });

        }
        catch(error){

            callback({

                success: false,

                error:
                    error.message

            });

        }

    }

};
