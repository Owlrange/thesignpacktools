// tools.js


const TOOLS = {

    preflightcheck:{

        file:"Preflight_Check.jsx"

    },

    prodpreparation:{

        file:"ProdPreparation.jsx"

    },

    reference:{

        file:"MakeRef.jsx"

    },
	
	artboardcontour:{

        file:"ArtboardContour.jsx"

    },
	
		
	grommets:{

			file:"Grommet-Holes_Marks.jsx"

		},
	
	sqftcalculator:{

        file:"SQFT_Calculator.jsx"

    },

    	
	makecropmarksai:{

        file:"MakeCropMarksAI.jsx"

    },
			
	exportproduction:{

        file:"Export_Production_Files.jsx"

    },
	
	standardize:{

        file:"Standardize_PDFs.jsx"

    },
	
	helper:{

        file:"Production_Helper.jsx"

    },
	
	artboards:{

        file:"Artboards.jsx"

    },

    flexiexport:{

        file:"Flexi_Safe_Export.jsx"

    },

    scaling:{

        file:"scaling.jsx"

    },

    relink:{

        file:"Relink_Links.jsx"

    }

	
	

};


// =====================================
// Runs the selected tool
// =====================================

function runTool(id){

    if(TOOLS[id]){

        runJSX(
            TOOLS[id].file
        );

        return;

    }

    notify(
        id + " is not implemented yet.",
        "warning"
    );

}

function openHelp(url){

    window.cep.util.openURLInDefaultBrowser(url);

}