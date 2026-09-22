var cs = new CSInterface();

function runPreflight(){

    var resultElement =
        document.getElementById("result");

    // Inform user that processing has started.
    resultElement.innerHTML =
        '<div class="preflight-processing">' +
            'Processing runs in the background.<br>' +
            '(Illustrator may look frozen, but it hasn\'t crashed!)' +
        '</div>';

    cs.evalScript(
        "preflightRun()",
        function(result){

            if(
                !result ||
                result === "undefined"
            ){

                resultElement.innerHTML =
                    '<div class="preflight-result-item status-fail">' +
                        '<div class="preflight-result-header">' +
                            '<span class="preflight-result-check">' +
                                'Preflight' +
                            '</span>' +

                            '<span class="preflight-result-status">' +
                                'FAIL' +
                            '</span>' +
                        '</div>' +

                        '<div class="preflight-result-message">' +
                            'No result was returned from the preflight process.' +
                        '</div>' +
                    '</div>';

                return;
            }

            // The ExtendScript now returns HTML.
            resultElement.innerHTML =
                result;

        }
    );

}

function notifyPreflightReady(){

    var cs =
        new CSInterface();

    var event =
        new CSEvent(
            "com.caio.TheSignPackTools.preflight.ready"
        );

    event.scope =
        "APPLICATION";

    cs.dispatchEvent(event);

}


document.addEventListener(
    "DOMContentLoaded",
    notifyPreflightReady
);