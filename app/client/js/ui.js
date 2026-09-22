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

                        new CSInterface()
                            .openURLInDefaultBrowser(
                                tool.help
                            );

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

    var search =
        document.getElementById(
            "search"
        );


    if(!search){

        return;

    }


    var text =
        search.value.toLowerCase();


    // ======================================
    // SHOW FULL MENU
    // ======================================

    if(text === ""){

        renderMenu(
            MENU
        );

        return;

    }


    // ======================================
    // FILTER TOOLS
    // ======================================

    var filtered =
        MENU
            .map(function(category){

                var tools =
                    category.tools.filter(
                        function(tool){

                            return (
                                tool.title
                                    .toLowerCase()
                                    .indexOf(text) !== -1 ||

                                tool.description
                                    .toLowerCase()
                                    .indexOf(text) !== -1
                            );

                        }
                    );


                return {

                    id:
                        category.id,

                    title:
                        category.title,

                    icon:
                        category.icon,

                    tools:
                        tools

                };

            })
            .filter(
                function(category){

                    return (
                        category.tools.length >
                        0
                    );

                }
            );


    renderMenu(
        filtered
    );

}