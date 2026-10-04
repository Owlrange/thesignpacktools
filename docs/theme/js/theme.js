/* =========================================================
   The Sign Pack Tools
   CoderDocs-inspired MkDocs Theme
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const toggleButton = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("docs-sidebar");


    /* =====================================================
       MOBILE SIDEBAR TOGGLE
       ===================================================== */

    if (toggleButton && sidebar) {

        toggleButton.addEventListener("click", function () {

            document.body.classList.toggle("sidebar-visible");

        });

    }


    /* =====================================================
       CLOSE SIDEBAR WHEN A LINK IS CLICKED
       ===================================================== */

    if (sidebar) {

        const sidebarLinks = sidebar.querySelectorAll("a");

        sidebarLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                if (window.innerWidth <= 991) {

                    document.body.classList.remove("sidebar-visible");

                }

            });

        });

    }


    /* =====================================================
       CLOSE SIDEBAR WHEN CLICKING OUTSIDE
       ===================================================== */

    document.addEventListener("click", function (event) {

        if (!sidebar || !toggleButton) {
            return;
        }

        if (window.innerWidth > 991) {
            return;
        }

        const clickedInsideSidebar =
            sidebar.contains(event.target);

        const clickedToggle =
            toggleButton.contains(event.target);


        if (!clickedInsideSidebar && !clickedToggle) {

            document.body.classList.remove("sidebar-visible");

        }

    });
	
	  /* =====================================================
       H2 ANCHOR NAVIGATION
       ===================================================== */

    const docsSection = document.querySelector(".docs-section");
    const docsHeader = document.querySelector(".docs-header");

    if (docsSection && docsHeader) {

        const headings = docsSection.querySelectorAll("h2[id]");

        if (headings.length > 0) {

            const anchorNav = document.createElement("nav");

            anchorNav.className = "section-anchor-nav";
            anchorNav.setAttribute("aria-label", "Page sections");

            headings.forEach(function (heading) {

                const link = document.createElement("a");

                link.className = "section-anchor-link";
                link.href = "#" + heading.id;
                link.textContent = heading.textContent;

                anchorNav.appendChild(link);

            });

            docsHeader.insertAdjacentElement(
                "afterend",
                anchorNav
            );

        }

    };


    /* =====================================================
       H2 ANCHOR NAVIGATION
       ===================================================== */

    const docsSection = document.querySelector(".docs-section");
    const docsHeader = document.querySelector(".docs-header");

    if (docsSection && docsHeader) {

        const headings = docsSection.querySelectorAll("h2[id]");

        if (headings.length > 0) {

            const anchorNav = document.createElement("nav");

            anchorNav.className = "section-anchor-nav";
            anchorNav.setAttribute("aria-label", "Page sections");

            headings.forEach(function (heading) {

                const link = document.createElement("a");

                link.className = "section-anchor-link";
                link.href = "#" + heading.id;
                link.textContent = heading.textContent;

                anchorNav.appendChild(link);

            });

            docsHeader.insertAdjacentElement(
                "afterend",
                anchorNav
            );

        }

    }


    /* =====================================================
       HANDLE WINDOW RESIZE
       ===================================================== */

    window.addEventListener("resize", function () {

        if (window.innerWidth > 991) {

            document.body.classList.remove("sidebar-visible");

        }

    });
	
});