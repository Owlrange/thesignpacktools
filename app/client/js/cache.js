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
        // CACHE MANAGER
        // ==========================================

        var jsxPath =
            extensionPath +
            "/library/system/cacheManager.jsx";


        // ==========================================
        // LIBRARY SOURCE
        // ==========================================

        var sourcePath =
            extensionPath +
            "/library";


        var jsx =
            '$.evalFile(' +
            JSON.stringify(
                jsxPath
            ) +
            ');' +

            'initializeLibraryCache(' +
            JSON.stringify(
                sourcePath
            ) +
            ');';


        cs.evalScript(
            jsx,
            function(result){

                if(
                    !result ||
                    result.indexOf(
                        "ERROR:"
                    ) === 0
                ){

                    callback({

                        success: false,

                        error:
                            result ||
                            "Unable to initialize the cache."

                    });

                    return;

                }


                var libraryPath =
                    result.replace(
                        /^SUCCESS:/,
                        ""
                    );


                CACHE.libraryPath =
                    libraryPath.replace(
                        /\\/g,
                        "/"
                    );


                CACHE.rootPath =
                    CACHE.libraryPath.replace(
                        /\/library$/,
                        ""
                    );


                callback({

                    success: true,

                    rootPath:
                        CACHE.rootPath,

                    libraryPath:
                        CACHE.libraryPath

                });

            }
        );

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
