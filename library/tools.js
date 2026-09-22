// tools.js


const TOOLS = {

    preflight:{

        file:"preflight.jsx"

    },

    prodpreparation:{

        file:"ProdPreparation.jsx"

    },

    cutcontour:{

        file:"MakeCutContour.jsx"

    },

    boundingBox:{

        file:"MakeBoundingBox.jsx"

    },
	outline:{

        file:"MakeOutline.jsx"

    },

    bleed:{

        file:"bleed.jsx"

    },

    reference:{

        file:"MakeRef.jsx"

    },
	
	artboardcontour:{

        file:"ArtboardContour.jsx"

    },
	
	create:{

        file:"MakeNewArtboards.jsx"

    },
	
	grommets:{

			file:"Grommet-Holes_Marks.jsx"

		},


    export:{

        file:"exportFile.jsx"

    },
	
	areacalculator:{

        file:"AreaCalculator.jsx"

    },
	
	checkallcolors:{

        file:"CheckAllColors.jsx"

    },
	checkimagequality:{

        file:"CheckImageQuality.jsx"

    },
	
	flexisafeexport:{

        file:"FlexiSafeExport.jsx"

    },
	
	makecropmarksai:{

        file:"MakeCropMarksAI.jsx"

    },
	
	productionmarks:{

        file:"ProductionMarks.jsx"

    },
	
	renameArtboards:{

        file:"RenameArtboards.jsx"

    },
	
	sqftcalculator:{

        file:"SQFTCalculator.jsx"

    },
	
	sqftcallout:{

        file:"SQFTCallout.jsx"

    },
		
	pdf:{

        file:"ExportAllPDFs.jsx"

    }
	
	

};


// =====================================
// Executa a ferramenta selecionada
// =====================================

function runTool(id){

    if(TOOLS[id]){

        runJSX(
            TOOLS[id].file
        );

        return;

    }

    notify(
        id + " ainda não implementado.",
        "warning"
    );

}

function openHelp(url){

    window.cep.util.openURLInDefaultBrowser(url);

}