function createAccordion(container, menu){

    menu.forEach(function(category){

        // ==========================================
        // CATEGORY CONTAINER
        // ==========================================

        var item =
            document.createElement("div");

        item.className =
            "item";


        // ==========================================
        // CATEGORY TITLE
        // ==========================================

        var title =
            document.createElement("button");

        title.className =
            "title";


        var left =
            document.createElement("div");

        left.className =
            "title-left";


        var img =
            document.createElement("img");

        img.className =
            "category-icon";

        img.src =
            category.icon;


        var text =
            document.createElement("span");

        text.textContent =
            category.title;


        left.appendChild(img);
        left.appendChild(text);


        // ==========================================
        // CATEGORY ARROW
        // ==========================================

        var arrow =
            document.createElement("img");

        arrow.className =
            "arrow";

        arrow.src =
            "icons/arrow.svg";


        title.appendChild(left);
        title.appendChild(arrow);


        // ==========================================
        // TOOLS CONTAINER
        // ==========================================

        var content =
            document.createElement("div");

        content.className =
            "content";


        // ==========================================
        // CREATE TOOL BUTTONS
        // ==========================================

        category.tools.forEach(function(tool){

            var button =
                document.createElement("button");

            button.className =
                "tool";

            button.title =
                tool.description;

            // text used by the search box (name, description and tags)
            button.setAttribute(
                "data-search",
                (
                    tool.title + " " +
                    (tool.description || "") + " " +
                    (tool.tags || []).join(" ")
                ).toLowerCase()
            );


            // ======================================
            // TOOL TITLE
            // ======================================

            var label =
                document.createElement("span");

            label.textContent =
                tool.title;

            button.appendChild(label);


            // ======================================
            // HELP BUTTON
            // ======================================

            if(tool.help){

                var help =
                    document.createElement("img");

                help.className =
                    "tool-help";

                help.src =
                    "icons/help.svg";

                help.title =
                    "Open documentation for " +
                    tool.title;


                button.appendChild(help);


               help.onclick =
					function(e){

						e.stopPropagation();


						// ======================================
						// LOCAL DOCUMENTATION
						// ======================================

						if(
							tool.help &&
							tool.help.type === "local"
						){

							var localPath =
								CACHE.getFilePath(
									tool.help.path
								);


							if(!localPath){

								notify(
									"Documentation is not available.",
									"error"
								);

								return;

							}

							var fileURL =
								"file:///" +
								localPath.replace(
									/\\/g,
									"/"
								);

							window.cep.util.openURLInDefaultBrowser(
								fileURL
							);

							return;

						}


						// ======================================
						// EXTERNAL URL
						// ======================================

						if(
							tool.help &&
							tool.help.type === "url"
						){

							 window.cep.util.openURLInDefaultBrowser(
        tool.help.url
    );

							return;

						}

					};

            }


            // ======================================
            // TOOL ACTION
            // ======================================

            button.onclick =
                function(){

                    runTool(
                        tool.id
                    );

                };


            content.appendChild(
                button
            );

        });


        // ==========================================
        // BUILD CATEGORY
        // ==========================================

        item.appendChild(title);
        item.appendChild(content);

        container.appendChild(item);


        // ==========================================
        // CATEGORY TOGGLE
        // ==========================================

        title.onclick =
            function(){

                item.classList.toggle(
                    "open"
                );


                var opened =
                    item.classList.contains(
                        "open"
                    );

                item.setAttribute(
                    "data-user-open",
                    opened ? "1" : "0"
                );


                if(opened){

                    content.style.maxHeight =
                        content.scrollHeight +
                        "px";

                }
                else{

                    content.style.maxHeight =
                        "0px";

                }

            };

    });

}


// ==========================================
// RENDER MENU
// ==========================================

function renderMenu(menu){

    var accordion =
        document.getElementById(
            "accordion"
        );


    if(!accordion){

        return;

    }


    accordion.innerHTML =
        "";


    createAccordion(
        accordion,
        menu
    );

}


// ==========================================
// FILTER MENU
// ==========================================

function filterMenu(){

    var search = document.getElementById("search");
    var accordion = document.getElementById("accordion");

    if(!search || !accordion){
        return;
    }

    var text = search.value.toLowerCase().replace(/^\s+|\s+$/g, "");

    var items = accordion.querySelectorAll(".item");

    for(var i = 0; i < items.length; i++){

        var item = items[i];
        var content = item.querySelector(".content");
        var tools = item.querySelectorAll(".tool");
        var matches = 0;

        for(var t = 0; t < tools.length; t++){

            var ok =
                text === "" ||
                (tools[t].getAttribute("data-search") || "").indexOf(text) !== -1;

            tools[t].style.display = ok ? "" : "none";

            if(ok){ matches++; }

        }

        if(text === ""){

            // back to what the person had open before searching
            var wasOpen = item.getAttribute("data-user-open") === "1";

            item.style.display = "";
            item.classList.toggle("open", wasOpen);
            content.style.maxHeight = wasOpen ? content.scrollHeight + "px" : "0px";

        }
        else if(matches > 0){

            // open the categories that have a match
            item.style.display = "";
            item.classList.add("open");
            content.style.maxHeight = content.scrollHeight + "px";

        }
        else{

            item.style.display = "none";

        }

    }

}


// ==========================================
// UPDATE BAR (bottom of the panel)
// ==========================================

var updateBarTimer = null;

function showUpdateBar(text, percent, state){

    var bar = document.getElementById("updateBar");
    var label = document.getElementById("updateText");
    var fill = document.getElementById("updateFill");

    if(!bar || !label || !fill){
        return;
    }

    if(updateBarTimer){
        clearTimeout(updateBarTimer);
        updateBarTimer = null;
    }

    bar.className = state || "";
    label.textContent = text;
    fill.style.width = Math.max(0, Math.min(100, percent)) + "%";

}

function hideUpdateBar(delayMs){

    var bar = document.getElementById("updateBar");

    if(!bar){
        return;
    }

    if(updateBarTimer){
        clearTimeout(updateBarTimer);
    }

    updateBarTimer = setTimeout(function(){
        bar.className = "hidden";
        updateBarTimer = null;
    }, delayMs || 0);

}
