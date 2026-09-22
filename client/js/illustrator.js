const cs = new CSInterface();


// ==========================================
// EXECUTE JSX SCRIPT
// ==========================================

function runJSX(file){

    // ==========================================
    // GET SCRIPT PATH FROM CACHE
    // ==========================================

    var scriptPath =
        CACHE.getFilePath(
            "scripts/" + file
        );


    // ==========================================
    // VALIDATE CACHE
    // ==========================================

    if(!scriptPath){

        notify(
            "Cached library is not available.",
            "error"
        );

        return;

    }


    scriptPath =
        scriptPath.replace(
            /\\/g,
            "/"
        );


    // ==========================================
    // EXECUTE JSX THROUGH ILLUSTRATOR
    // ==========================================

    var script =
        '$.evalFile(' +
        JSON.stringify(
            scriptPath
        ) +
        ')';


    cs.evalScript(
        script,
        function(result){

            result =
                String(result || "")
                    .replace(
                        /^\s+|\s+$/g,
                        ""
                    );


            if(
                result.indexOf(
                    "SUCCESS:"
                ) === 0
            ){

                notify(
                    result.replace(
                        "SUCCESS:",
                        ""
                    ),
                    "success"
                );

            }

            else if(
                result.indexOf(
                    "ERROR:"
                ) === 0
            ){

                notify(
                    result.replace(
                        "ERROR:",
                        ""
                    ),
                    "error"
                );

            }

            else if(
                result.indexOf(
                    "WARNING:"
                ) === 0
            ){

                notify(
                    result.replace(
                        "WARNING:",
                        ""
                    ),
                    "warning"
                );

            }

            else{

                notify(
                    result,
                    "info"
                );

            }

        }
    );

}