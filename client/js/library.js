var LIBRARY = {

    version: "0.0.0",

    remoteVersion: null,

    updateType: null,

    repository:
        "https://raw.githubusercontent.com/Owlrange/thesignpacktools/refs/heads/main/",


    // ==========================================
    // LOAD LOCAL VERSION FROM CACHE
    // ==========================================

    getLocalVersion: function(callback){

        var versionPath =
            CACHE.getFilePath(
                "version.json"
            );


        var readFilePath =
            CACHE.getFilePath(
                "system/readFile.jsx"
            );


        var jsx =
            '$.evalFile(' +
            JSON.stringify(
                readFilePath
            ) +
            ');' +

            'readFile(' +
            JSON.stringify(
                versionPath
            ) +
            ');';


        cs.evalScript(
            jsx,
            function(result){

                if(
                    !result
                ){

                    callback(null);

                    return;

                }


                if(
                    result.indexOf(
                        "ERROR:"
                    ) === 0
                ){

                    callback(null);

                    return;

                }


                try{

                    var data =
                        JSON.parse(result);


                    LIBRARY.version =
                        data.version ||
                        "0.0.0";


                    callback(
                        LIBRARY.version
                    );

                }
                catch(error){

                    callback(null);

                }

            }
        );

    },


    // ==========================================
    // LOAD REMOTE MANIFEST
    // ==========================================

    getRemoteManifest: function(callback){

        var url =
            LIBRARY.repository +
            "version.json?" +
            Date.now();


        fetch(url)
        .then(function(response){

            if(!response.ok){

                throw new Error(
                    "HTTP " +
                    response.status
                );

            }


            return response.text();

        })
        .then(function(text){

            callback(
                JSON.parse(text)
            );

        })
        .catch(function(error){

            callback(null);

        });

    },


    // ==========================================
    // COMPARE VERSIONS
    // ==========================================

    compareVersions: function(
        localVersion,
        remoteVersion
    ){

        var local =
            localVersion
                .split(".")
                .map(Number);


        var remote =
            remoteVersion
                .split(".")
                .map(Number);


        var max =
            Math.max(
                local.length,
                remote.length
            );


        for(
            var i = 0;
            i < max;
            i++
        ){

            var localValue =
                local[i] || 0;


            var remoteValue =
                remote[i] || 0;


            if(
                remoteValue >
                localValue
            ){

                if(i === 0){

                    return "major";

                }


                if(i === 1){

                    return "minor";

                }


                return "patch";

            }


            if(
                remoteValue <
                localValue
            ){

                return "none";

            }

        }


        return "none";

    },


    // ==========================================
    // CHECK FOR UPDATES
    // ==========================================

    checkUpdate: function(callback){

        LIBRARY.getLocalVersion(
            function(localVersion){

                if(!localVersion){

                    callback({

                        success: false,

                        hasUpdate: false

                    });

                    return;

                }


                LIBRARY.getRemoteManifest(
                    function(manifest){

                        if(!manifest){

                            callback({

                                success: false,

                                hasUpdate: false

                            });

                            return;

                        }


                        var updateType =
                            LIBRARY.compareVersions(
                                localVersion,
                                manifest.version
                            );


                        LIBRARY.updateType =
                            updateType;


                        callback({

                            success: true,

                            hasUpdate:
                                updateType !== "none",

                            updateType:
                                updateType,

                            localVersion:
                                localVersion,

                            remoteVersion:
                                manifest.version,

                            manifest:
                                manifest

                        });

                    }
                );

            }
        );

    },


    // ==========================================
    // DOWNLOAD A FILE
    // ==========================================

    downloadFile: function(
        relativePath,
        callback
    ){

        var url =
            LIBRARY.repository +
            relativePath +
            "?" +
            Date.now();


        fetch(url)
        .then(function(response){

            if(!response.ok){

                throw new Error(
                    "HTTP " +
                    response.status
                );

            }


            return response.text();

        })
        .then(function(content){

            callback({

                success: true,

                path:
                    relativePath,

                content:
                    content

            });

        })
        .catch(function(error){

            callback({

                success: false,

                path:
                    relativePath,

                error:
                    error.message

            });

        });

    },


    // ==========================================
    // DOWNLOAD ALL FILES
    // ==========================================

    downloadFiles: function(
        files,
        index,
        downloaded,
        callback
    ){

        if(
            index >= files.length
        ){

            callback({

                success: true,

                files:
                    downloaded

            });

            return;

        }


        var currentFile =
            files[index];


        notify(
            "Downloading file " +
            (index + 1) +
            " of " +
            files.length +
            ":\n" +
            currentFile,
            "info"
        );


        LIBRARY.downloadFile(
            currentFile,
            function(result){

                if(!result.success){

                    notify(
                        "Unable to download:\n" +
                        currentFile +
                        "\n\n" +
                        result.error,
                        "error"
                    );


                    callback({

                        success: false,

                        error:
                            result.error

                    });

                    return;

                }


                downloaded.push(result);


                LIBRARY.downloadFiles(
                    files,
                    index + 1,
                    downloaded,
                    callback
                );

            }
        );

    },


    // ==========================================
    // WRITE FILE TO CACHE
    // ==========================================

    writeCacheFile: function(
        relativePath,
        content,
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
                    "Cache path is not available."

            });

            return;

        }


        var saveFilePath =
            CACHE.getFilePath(
                "system/saveFile.jsx"
            );


        if(!saveFilePath){

            callback({

                success: false,

                error:
                    "saveFile.jsx was not found in the cache."

            });

            return;

        }


        var base64;


        try{

            base64 =
                btoa(
                    unescape(
                        encodeURIComponent(
                            content
                        )
                    )
                );

        }
        catch(error){

            callback({

                success: false,

                error:
                    "Failed to encode the file."

            });

            return;

        }


        var jsx =
            '$.evalFile(' +
            JSON.stringify(
                saveFilePath
            ) +
            ');' +

            'saveFile(' +
            JSON.stringify(
                filePath
            ) +
            ',' +
            JSON.stringify(
                base64
            ) +
            ');';


        cs.evalScript(
            jsx,
            function(result){

                if(
                    result &&
                    result.indexOf(
                        "SUCCESS:"
                    ) === 0
                ){

                    callback({

                        success: true,

                        path:
                            filePath

                    });

                }
                else{

                    callback({

                        success: false,

                        error:
                            result ||
                            "Unknown error while writing the file."

                    });

                }

            }
        );

    },


    // ==========================================
    // UPDATE MULTIPLE CACHE FILES
    // ==========================================

    updateCacheFiles: function(
        files,
        index,
        callback
    ){

        if(
            !files ||
            files.length === 0
        ){

            callback({

                success: true

            });

            return;

        }


        if(
            index >= files.length
        ){

            callback({

                success: true

            });

            return;

        }


        var currentFile =
            files[index];


        notify(
            "Writing file " +
            (index + 1) +
            " of " +
            files.length +
            ":\n" +
            currentFile.path,
            "info"
        );


        LIBRARY.writeCacheFile(
            currentFile.path,
            currentFile.content,
            function(result){

                if(
                    !result ||
                    !result.success
                ){

                    notify(
                        "Unable to write:\n" +
                        currentFile.path +
                        "\n\n" +
                        (
                            result
                                ? result.error
                                : "Unknown error."
                        ),
                        "error"
                    );


                    callback({

                        success: false,

                        error:
                            result
                                ? result.error
                                : "Unknown error."

                    });

                    return;

                }


                LIBRARY.updateCacheFiles(
                    files,
                    index + 1,
                    callback
                );

            }
        );

    },


    // ==========================================
    // UPDATE LIBRARY
    // ==========================================

    update: function(
        manifest,
        callback
    ){

        if(
            !manifest
        ){

            callback({

                success: false,

                error:
                    "Invalid manifest."

            });

            return;

        }


        // ==========================================
        // BLOCK MAJOR UPDATES
        // ==========================================

        if(
            LIBRARY.updateType ===
            "major"
        ){

            notify(
                "A new major version is available. " +
                "Please contact support.",
                "warning"
            );


            callback({

                success: false,

                type:
                    "major"

            });

            return;

        }


        var files =
            manifest.files ||
            [];


        // ==========================================
        // DOWNLOAD FILES
        // ==========================================

        notify(
            "Downloading files for V" +
            manifest.version +
            "...",
            "info"
        );


        LIBRARY.downloadFiles(
            files,
            0,
            [],
            function(downloadResult){

                if(
                    !downloadResult ||
                    !downloadResult.success
                ){

                    callback({

                        success: false,

                        error:
                            downloadResult &&
                            downloadResult.error
                                ? downloadResult.error
                                : "Unable to download the files."

                    });

                    return;

                }


                // ==========================================
                // WRITE FILES TO CACHE
                // ==========================================

                LIBRARY.updateCacheFiles(
                    downloadResult.files,
                    0,
                    function(cacheResult){

                        if(
                            !cacheResult ||
                            !cacheResult.success
                        ){

                            callback({

                                success: false,

                                error:
                                    cacheResult &&
                                    cacheResult.error
                                        ? cacheResult.error
                                        : "Unable to write the files to the cache."

                            });

                            return;

                        }


                        // ==========================================
                        // UPDATE VERSION.JSON
                        // ==========================================

                        LIBRARY.writeCacheFile(
                            "version.json",
                            JSON.stringify(
                                manifest,
                                null,
                                4
                            ),
                            function(versionResult){

                                if(
                                    !versionResult ||
                                    !versionResult.success
                                ){

                                    callback({

                                        success: false,

                                        error:
                                            versionResult &&
                                            versionResult.error
                                                ? versionResult.error
                                                : "Unable to update version.json."

                                    });

                                    return;

                                }


                                // ==========================================
                                // UPDATE VERSION IN MEMORY
                                // ==========================================

                                LIBRARY.version =
                                    manifest.version;


                                callback({

                                    success: true,

                                    version:
                                        manifest.version

                                });

                            }
                        );

                    }
                );

            }
        );

    },


    // ==========================================
    // GET CURRENT VERSION
    // ==========================================

    getVersion: function(){

        return LIBRARY.version;

    }

};