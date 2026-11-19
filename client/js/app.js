window.onload = function(){

    // ==========================================
    // RELOAD PLUGIN
    // ==========================================

    function reloadPlugin(){

        location.reload();

    }
	
	


    // ==========================================
    // RELOAD BUTTON = CHECK FOR UPDATES NOW + RELOAD
    // ==========================================

    var reloadButton = document.getElementById("reload");

    if(reloadButton){

        reloadButton.style.display = "flex";

        reloadButton.onclick = function(){

            forceUpdate();

        };

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
    //
    // Runs when the panel opens and then every 10 minutes, so nobody
    // keeps working with old scripts. Quiet when offline.

    var CHECK_EVERY_MS = 10 * 60 * 1000;
    // (the first check can start before this line runs, so these keep a value already set)
    var checking = checking || false;
    var majorWarned = majorWarned || false;

    function setVersionLabel(){

        var el = document.getElementById("plugin-version");

        if(el){
            el.textContent = "V" + LIBRARY.getVersion();
        }

    }


    // Progress: download 0-60%, writing 60-95%, finish 100%
    function onLibraryProgress(phase, done, total, name){

        var pct = 0;
        var text = "Updating library...";

        if(phase === "start"){
            text = "Updating library to " + name + "...";
        }
        else if(phase === "download"){
            pct = total > 0 ? (done / total) * 60 : 0;
            text = "Updating library: downloading " + done + " of " + total;
        }
        else if(phase === "write"){
            pct = 60 + (total > 0 ? (done / total) * 35 : 0);
            text = "Updating library: installing " + (done + 1) + " of " + total;
        }

        showUpdateBar(text, pct, "");

    }


    // Connection state shown under the title
    function setConnection(state, detail){

        var el = document.getElementById("update-state");

        if(!el){
            return;
        }

        el.className = state;

        if(state === "ok"){
            el.textContent = "\u25CF Up to date";
            el.title = "The library is up to date.";
        }
        else if(state === "offline"){
            el.textContent = "\u25CF Offline: cannot check for updates";
            el.title = "No internet connection. The panel keeps working with the library already installed.";
        }
        else if(state === "update"){
            el.textContent = "\u25CF Updating...";
            el.title = "";
        }
        else{
            el.textContent = "\u25CF Cannot reach the library";
            el.title = detail || "";
        }

    }


    var forceRequested = false;

    function checkLibraryUpdate(force){

        if(
            typeof LIBRARY === "undefined" ||
            checking
        ){
            return;
        }

        checking = true;

        LIBRARY.checkUpdate(function(update){

            setVersionLabel();

            var wasForced = (force === true);

            // could not check: offline, no access, ...
            if(!update || !update.success){

                checking = false;

                var offline = !!(update && update.offline);

                setConnection(
                    offline ? "offline" : "error",
                    update && update.error ? update.error : ""
                );

                if(wasForced){

                    try{
                        window.localStorage.setItem(
                            "tspJustChecked",
                            offline ? "offline" : "error"
                        );
                    }
                    catch(eLsF){}

                    location.reload();

                }

                return;

            }

            setConnection("ok");

            // up to date
            if(!update.hasUpdate){

                checking = false;

                if(wasForced){

                    try{
                        window.localStorage.setItem("tspJustChecked", "ok");
                    }
                    catch(eLsG){}

                    location.reload();

                }

                return;

            }

            // a new major version is never installed by itself
            if(update.updateType === "major"){

                checking = false;

                if(!majorWarned){

                    majorWarned = true;

                    notify(
                        "A new major version is available. " +
                        "Please contact support to update the library.",
                        "warning"
                    );

                }

                return;

            }

            LIBRARY.onProgress = onLibraryProgress;

            setConnection("update");

            showUpdateBar(
                "Update found (V" + update.remoteVersion + "). Starting...",
                0,
                ""
            );

            LIBRARY.update(update.manifest, function(result){

                LIBRARY.onProgress = null;

                if(!result || !result.success){

                    checking = false;

                    setConnection("error", "The update could not be completed.");

                    showUpdateBar("Library update failed. Will try again.", 100, "failed");
                    hideUpdateBar(8000);

                    notify(
                        "Unable to complete the library update.",
                        "error"
                    );

                    return;

                }

                setVersionLabel();

                showUpdateBar("Updated to V" + result.version + ". Reloading...", 100, "done");

                try{
                    window.localStorage.setItem("tspJustUpdated", result.version);
                }
                catch(eLs){}

                setTimeout(function(){

                    location.reload();

                }, 1200);

            });

        });

    }


    // ==========================================
    // AFTER A RELOAD: SHOW THAT IT UPDATED
    // ==========================================

    try{

        var justUpdated = window.localStorage.getItem("tspJustUpdated");
        var justChecked = window.localStorage.getItem("tspJustChecked");

        if(justUpdated){

            window.localStorage.removeItem("tspJustUpdated");

            showUpdateBar("Library updated to V" + justUpdated, 100, "done");
            hideUpdateBar(8000);

        }
        else if(justChecked){

            window.localStorage.removeItem("tspJustChecked");

            if(justChecked === "ok"){
                showUpdateBar("Reloaded. The library is up to date.", 100, "done");
                hideUpdateBar(5000);
            }
            else if(justChecked === "offline"){
                showUpdateBar("No internet: the library could not be updated.", 100, "failed");
                hideUpdateBar(8000);
            }
            else{
                showUpdateBar("Could not reach the library to check for updates.", 100, "failed");
                hideUpdateBar(8000);
            }

        }

    }
    catch(eLs2){}


    // ==========================================
    // CHECK AGAIN EVERY 10 MINUTES (and when the panel is shown again)
    // ==========================================

    var lastCheckMs = new Date().getTime();

    setInterval(function(){

        lastCheckMs = new Date().getTime();
        checkLibraryUpdate();

    }, CHECK_EVERY_MS);

    document.addEventListener("visibilitychange", function(){

        if(
            !document.hidden &&
            new Date().getTime() - lastCheckMs > 2 * 60 * 1000
        ){
            lastCheckMs = new Date().getTime();
            checkLibraryUpdate();
        }

    });


    // ==========================================
    // RELOAD BUTTON: CHECK NOW (does not wait for the 10 minutes)
    // ==========================================

    function forceUpdate(){

        if(checking){

            notify(
                "Already checking for updates...",
                "info"
            );

            return;

        }

        showUpdateBar("Checking for updates...", 10, "");

        checkLibraryUpdate(true);

    }


    // ==========================================
    // INTERNET COMES AND GOES
    // ==========================================

    window.addEventListener("offline", function(){

        setConnection("offline");

    });

    window.addEventListener("online", function(){

        checkLibraryUpdate();

    });


    // ==========================================
    // ALT + CLICK ON THE VERSION = RELOAD THE PANEL
    // ==========================================

    var versionLabel = document.getElementById("plugin-version");

    if(versionLabel){

        versionLabel.addEventListener("click", function(e){

            if(e.altKey){
                reloadPlugin();
            }

        });

    }

};
