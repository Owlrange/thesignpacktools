const MENU = [

    {
		id: "newfile",
        title: "File Templates",
        icon: "icons/template.svg",

        tools: [

             {
                id: "standart",
                title: "Standart Template",
                description: "Create a standard design file.",
				help: "",
				tags: []
            },
			{
                id: "ADA",
                title: "ADA Template",
                description: "Create a ADA design file.",
				help: "https://netorgft7340194.sharepoint.com/sites/TheSignPack2/SitePages/ADA-%26-Wayfinding-Training.aspx?web=1",
				tags: [
					"ADA",
					"Grade II",
					"Tactile",
					"braille"
				]
            },
			{
                id: "vehicle",
                title: "Vechicle Template",
                description: "Create a Vehicle wrap design file.",
				help: "https://netorgft7340194.sharepoint.com/sites/TheSignPack2/SitePages/Vehicle-Graphics(1).aspx?web=1",
				tags: [
					"Wrap",
					"1/2",
					"1/4",
					"Full"
				]
            }

        ]

    },
	
	{
        id: "tools",
        title: "Tools",
        icon: "icons/artboards.svg",

        tools: [

            {
                id: "artboardcontour",
                title: "Artboard's Stroke",
                description: "Create a artboard Stroke.",
				help: "",
				tags: []
            },

            {
                id: "create",
                title: "Create Multiple Artboeards",
                description: "Create a new artboard for each object selected.",
				help: "",
				tags: []
            },

            {
                id: "reference",
                title: "Create Reference Layer",
                description: "Create the reference layer.",
				help: "",
				tags: []
            },

            {
                id: "pdf",
                title: "Save as pdf",
                description: "Save the artboards as pdf",
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
                id: "createArtboards",
                title: "Criar",
                description: "Cria novos Artboards.",
				help: "https://wiki...",
				tags: [
					"cut",
					"contour",
					"vinyl"
				]
            },

            {
                id: "renameArtboards",
                title: "Renomear",
                description: "Renomeia Artboards.",
				help: "https://wiki...",
				tags: [
					"cut",
					"contour",
					"vinyl"
				]
            }

        ]

    },
		
    {
        id: "production",
        title: "Produção",
        icon: "icons/production.svg",

        tools: [

            {
                id: "prodpreparation",
                title: "Prod Preparation",
                description: "Clean files, Delete layers...",
				help: "https://netorgft7340194.sharepoint.com/sites/TheSignPack2/SitePages/Production---Print-%26-Cut.aspx?web=1#getting-started",
				tags: [
					"pre",
					"prod",
					"pre flight"
				]
            },

            {
                id: "cutcontour",
                title: "Create Cut Contour",
                description: "For cutting flexible materials such as vinyl",
				help: "https://netorgft7340194.sharepoint.com/sites/TheSignPack2/SitePages/Production---Print-%26-Cut.aspx?web=1#getting-started",
				tags: [
					"cut",
					"contour",
					"vinyl"
				]
            },

            {
                id: "boundingBox",
                title: "Create Bounding Box.",
                description: "Used to define the overall dimensions of the white edge of artwork for sizing",
				help: "",
				tags: []
            },

            {
                id: "outline",
                title: "Create Outline",
                description: "for cutting rigid materials such as ACM, aluminum, and acrylic.",
				help: "",
				tags: []
            },
			
			
            {
                id: "grommets",
                title: "Grommets/Hole Marks",
                description: "Create grommets or holes marks on arteboard",
				help: "",
				tags: []
            },
			
            {
                id: "white ink",
                title: "Make White ink",
                description: "Prepares the object for white ink printing",
				help: "",
				tags: []
            },
			
			{
                id: "checkprod",
                title: "Pre-flighting",
                description: "Checks the file for potential production issues before manufacturing.",
				help: "",
				tags: []
            }

        ]

    }    

];