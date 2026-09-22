window.onload = function(){

    // ==========================================
    // RELOAD PLUGIN
    // ==========================================

    function reloadPlugin(){

        location.reload();

    }
	
	function openPreflight(){

    var cs =
        new CSInterface();

    cs.requestOpenExtension(
        "com.caio.TheSignPackTools.preflight",
        ""
    );

}


    // ==========================================
    // DEV MODE
    // ==========================================

    var DEV_MODE =
        true;


    if(DEV_MODE){

        var reload =
            document.getElementById(
                "reload"
            );


        if(reload){

            reload.style.display =
                "flex";

            reload.onclick =
                reloadPlugin;

        }

    }


    // ==========================================
    // UI ELEMENTS
    // ==========================================

    var accordion =
        document.getElementById(
            "accordion"
        );


    var search =
        document.getElementById(
            "search"
        );


    if(!accordion){

        console.error(
            "Element #accordion not found."
        );

        return;

    }


    // ==========================================
    // INITIALIZE CACHE
    // ==========================================

    CACHE.initialize(
        function(cacheResult){

            if(
                !cacheResult ||
                !cacheResult.success
            ){

                notify(
                    "Unable to initialize the library.",
                    "error"
                );

                console.error(
                    cacheResult
                );

                return;

            }


            // ==================================
            // LOAD MENU
            // ==================================

            LOADER.load(
                "menu.js",
                function(menuResult){

                    if(
                        !menuResult ||
                        !menuResult.success
                    ){

                        notify(
                            "Unable to load the menu.",
                            "error"
                        );

                        console.error(
                            menuResult
                        );

                        return;

                    }


                    // ==============================
                    // INJECT MENU
                    // ==============================

                    LOADER.inject(
                        menuResult.content,
                        function(menuInjectResult){

                            if(
                                !menuInjectResult ||
                                !menuInjectResult.success
                            ){

                                notify(
                                    "Unable to initialize the menu.",
                                    "error"
                                );

                                console.error(
                                    menuInjectResult
                                );

                                return;

                            }


                            // ==========================
                            // VALIDATE MENU
                            // ==========================

                            if(
                                typeof MENU ===
                                "undefined"
                            ){

                                notify(
                                    "The library did not return the MENU object.",
                                    "error"
                                );

                                return;

                            }


                            // ==========================
                            // LOAD TOOLS
                            // ==========================

                            LOADER.load(
                                "tools.js",
                                function(toolsResult){

                                    if(
                                        !toolsResult ||
                                        !toolsResult.success
                                    ){

                                        notify(
                                            "Unable to load the tools.",
                                            "error"
                                        );

                                        console.error(
                                            toolsResult
                                        );

                                        return;

                                    }


                                    // ======================
                                    // INJECT TOOLS
                                    // ======================

                                    LOADER.inject(
                                        toolsResult.content,
                                        function(toolsInjectResult){

                                            if(
                                                !toolsInjectResult ||
                                                !toolsInjectResult.success
                                            ){

                                                notify(
                                                    "Unable to initialize the tools.",
                                                    "error"
                                                );

                                                console.error(
                                                    toolsInjectResult
                                                );

                                                return;

                                            }


                                            // ==================
                                            // VALIDATE TOOLS
                                            // ==================

                                            if(
                                                typeof TOOLS ===
                                                "undefined"
                                            ){

                                                notify(
                                                    "The library did not return the TOOLS object.",
                                                    "error"
                                                );

                                                return;

                                            }


                                            // ==================
                                            // CREATE MENU
                                            // ==================

                                            try{

                                                createAccordion(
                                                    accordion,
                                                    MENU
                                                );

                                            }
                                            catch(error){

                                                notify(
                                                    "Unable to create the menu.",
                                                    "error"
                                                );

                                                console.error(
                                                    error
                                                );

                                                return;

                                            }


                                            // ==================
                                            // ENABLE SEARCH
                                            // ==================

                                            if(search){

                                                search.addEventListener(
                                                    "input",
                                                    filterMenu
                                                );

                                            }


                                            // ==================
                                            // PLUGIN READY
                                            // ==================

                                            notify(
                                                "The Sign Pack Tools is ready.",
                                                "success"
                                            );


                                            // ==================
                                            // CHECK FOR UPDATES
                                            // ==================

                                            checkLibraryUpdate();

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        }
    );


    // ==========================================
    // CHECK LIBRARY UPDATES
    // ==========================================

    function checkLibraryUpdate(){

        if(
            typeof LIBRARY ===
            "undefined"
        ){

            return;

        }


        LIBRARY.checkUpdate(
            function(update){

                var versionElement =
                    document.getElementById(
                        "plugin-version"
                    );


                // ==============================
                // DISPLAY CURRENT VERSION
                // ==============================

                if(
                    versionElement
                ){

                    versionElement.textContent =
                        "V" +
                        LIBRARY.getVersion();

                }


                // ==============================
                // UPDATE CHECK FAILED
                // ==============================

                if(
                    !update ||
                    !update.success
                ){

                    return;

                }


                // ==============================
                // NO UPDATE AVAILABLE
                // ==============================

                if(
                    !update.hasUpdate
                ){

                    return;

                }


                // ==============================
                // MAJOR UPDATE
                // ==============================

                if(
                    update.updateType ===
                    "major"
                ){

                    notify(
                        "A new major version is available. " +
                        "Please contact support to update the library.",
                        "warning"
                    );

                    return;

                }


                // ==============================
                // PATCH / MINOR UPDATE
                // ==============================

                notify(
                    "New update found. Updating library...",
                    "info"
                );


                LIBRARY.update(
                    update.manifest,
                    function(result){

                        if(
                            !result ||
                            !result.success
                        ){

                            notify(
                                "Unable to complete the library update.",
                                "error"
                            );

                            return;

                        }


                        if(
                            versionElement
                        ){

                            versionElement.textContent =
                                "V" +
                                result.version;

                        }


                        notify(
                            "Library updated to V" +
                            result.version +
                            ". Reloading...",
                            "success"
                        );


                        setTimeout(
                            function(){

                                location.reload();

                            },
                            1200
                        );

                    }
                );

            }
        );

    }

};
// ==========================================
// OPEN PREFLIGHT WINDOW
// ==========================================


var preflightCS =
    new CSInterface();

var preflightOpening =
    false;

var PREFLIGHT_EXTENSION_ID =
    "com.caio.TheSignPackTools.preflight";

var PREFLIGHT_READY_EVENT =
    "com.caio.TheSignPackTools.preflight.ready";


preflightCS.addEventListener(
    PREFLIGHT_READY_EVENT,
    function(){

        if(!preflightOpening)
            return;

        preflightOpening =
            false;

        preflightCS.requestOpenExtension(
            PREFLIGHT_EXTENSION_ID,
            ""
        );

    }
);


window.openPreflight = function(){

    preflightOpening =
        true;

    preflightCS.requestOpenExtension(
        PREFLIGHT_EXTENSION_ID,
        ""
    );


    // Fallback caso o evento de carregamento
    // não seja recebido.
    setTimeout(function(){

        if(!preflightOpening)
            return;

        preflightOpening =
            false;

        preflightCS.requestOpenExtension(
            PREFLIGHT_EXTENSION_ID,
            ""
        );

    }, 700);

};