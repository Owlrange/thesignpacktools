var CACHE = {

    rootPath: null,

    libraryPath: null,


    // ==========================================
    // INITIALIZE CACHE
    // ==========================================

    initialize: function(callback){

        var extensionPath =
            cs.getSystemPath(
                SystemPath.EXTENSION
            );

        extensionPath =
            extensionPath.replace(
                /\\/g,
                "/"
            );


        // ==========================================
        // LIBRARY INSIDE THE EXTENSION
        // ==========================================
        //
        // The Library lives inside the extension folder.
        // Updates are written directly to it.

        CACHE.rootPath =
            extensionPath;

        CACHE.libraryPath =
            extensionPath +
            "/library";


        if(
            window.cep.fs.stat(
                CACHE.libraryPath
            ).err !== 0
        ){

            callback({

                success: false,

                error:
                    "Library folder not found:\n" +
                    CACHE.libraryPath

            });

            return;

        }


        callback({

            success: true,

            rootPath:
                CACHE.rootPath,

            libraryPath:
                CACHE.libraryPath

        });

    },


    // ==========================================
    // GET CACHE ROOT PATH
    // ==========================================

    getRootPath: function(){

        return CACHE.rootPath;

    },


    // ==========================================
    // GET LIBRARY PATH
    // ==========================================

    getLibraryPath: function(){

        return CACHE.libraryPath;

    },


    // ==========================================
    // BUILD FILE PATH
    // ==========================================

    getFilePath: function(relativePath){

        if(
            !CACHE.libraryPath
        ){

            return null;

        }


        relativePath =
            relativePath.replace(
                /^[\\/]+/,
                ""
            );


        return (
            CACHE.libraryPath +
            "/" +
            relativePath
        );

    }

};
