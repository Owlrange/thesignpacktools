const MENU = [

    	
	{
        id: "tools",
        title: "Tools",
        icon: "icons/artboards.svg",

        tools: [
		
			{
                id: "reference",
                title: "Create Reference Layer",
                description: "Create the reference layer.",
				help: "",
				tags: [layer]
            },

            {
                id: "artboardcontour",
                title: "Artboard's Stroke",
                description: "Create an artboard stroke.",
				help: "",
				tags: []
            },

            {
                id: "artboards",
                title: "Artboards",
                description: "Create a new artboard for each object selected.",
				help: "",
				tags: []
            },


            {
                id: "exportproduction",
                title: "Export To Production",
                description: "Export Production Files",
				help: "",
				tags: []
            },

            {
                id: "flexiexport",
                title: "Safe Export To Flexi",
                description: "Export to open in Flexi without any issues.",
				help: "",
				tags: []
            },

            {
                id: "standardize",
                title: "Standardize Layout",
                description: "Make the multi-page presentation PDF, all pages the same size",
				help: "",
				tags: [Presentation, PDF]
            },
			
			
						
			{
                id: "makecropmarksai",
                title: "Make CropMarks",
                description: "Create Cropmarks",
				help: "",
				tags: []
            }
			
            

        ]

    },
	
	{
        id: "design",
        title: "Design Tools",
        icon: "icons/design.svg",

        tools: [

            		
				
						
			{
                id: "sqftcalculator",
                title: "SQFT Calculator",
                description: "Calculate the SQFT",
				help: "",
				tags: []
            },


            {
                id: "relink",
                title: "Relink Missing Links",
                description: "Fix missing or wrong links and embedded images",
				help: "",
				tags: [Image]
            },

            {
                id: "scaling",
                title: "Scaling",
                description: "Scale objects while maintaining aspect ratio",
				help: "",
				tags: []
            }
		
			
			

        ]

    },
		
    {
        id: "production",
        title: "Production",
        icon: "icons/production.svg",

        tools: [

            {
                id: "prodpreparation",
                title: "Prod Preparation",
                description: "Clean files, Delete layers...",
				help: {
					type: "url",
					url: "https://netorgft7340194.sharepoint.com/sites/TheSignPack2/SitePages/Production---Print-%26-Cut.aspx?web=1#getting-started"
				},
				tags: [
					"pre",
					"prod",
					"pre flight"
				]
            },
			
            {
                id: "helper",
                title: "Production Helper",
                description: "Help you to create a production file",
				help: "",
				tags: []
            },
           
			
			 {
                id: "grommets",
                title: "Grommets/Hole Marks",
                description: "Create grommets or holes marks on artboard",
				help: "",
				tags: []
            },
			
			{
                id: "preflightcheck",
                title: "Pre-flighting",
                description: "Checks the file for potential production issues before manufacturing.",
				help: "",
				tags: []
            }
			

        ]

    }    

];