// ============================================================
// THE SIGN PACK TOOLS
// PREFLIGHT
// ============================================================


// ============================================================
// DOCUMENT
// ============================================================

var doc = app.activeDocument;


// ============================================================
// EXPECTED STROKE
// ============================================================

var expectedStroke = getStroke1pt(doc);

function getStroke1pt(doc){

    return 1 / doc.scaleFactor;

}


// ============================================================
// PRODUCTION LAYERS
// ============================================================

var PRODUCTION_LAYERS = [
    "CutContour",
    "Outline",
    "BoundingBox",
    "White Ink",
    "Braille",
    "Grommets",
    "Holes"
];


// ============================================================
// PRODUCTION HELPERS
// ============================================================

function isProductionLayerName(name){

    for(var i = 0; i < PRODUCTION_LAYERS.length; i++){

        if(name === PRODUCTION_LAYERS[i]){
            return true;
        }

    }

    return false;

}


function getProductionLayer(item){

    var parent = item.parent;

    while(parent){

        if(parent.typename === "Layer"){

            if(isProductionLayerName(parent.name)){
                return parent;
            }

            return null;

        }

        parent = parent.parent;

    }

    return null;

}


function getProductionRoot(item){

    var layer = getProductionLayer(item);

    if(!layer){
        return null;
    }

    var current = item;

    while(
        current.parent &&
        current.parent.typename !== "Layer"
    ){

        current = current.parent;

    }

    return current;

}


function registerProductionLayer(context, layerName){

    if(!layerName){
        return;
    }

    if(layerName === "CutContour"){
        context.hasCutContour = true;
    }

    else if(layerName === "Outline"){
        context.hasOutline = true;
    }

    else if(layerName === "BoundingBox"){
        context.hasBoundingBox = true;
    }

    else if(layerName === "White Ink"){
        context.hasWhiteInk = true;
    }

    else if(layerName === "Braille"){
        context.hasBraille = true;
    }

    else if(layerName === "Grommets"){
        context.hasGrommets = true;
    }

    else if(layerName === "Holes"){
        context.hasHoles = true;
    }

}


// ============================================================
// COLOR HELPERS
// ============================================================

function isValidCutContourColor(color){

    if(!color){
        return false;
    }

    if(color.typename !== "SpotColor"){
        return false;
    }

    if(!color.spot){
        return false;
    }

    if(color.spot.name !== "CutContour"){
        return false;
    }

    if(Math.round(color.tint) !== 100){
        return false;
    }

    return true;

}


function isValidOutlineColor(color){

    if(!color){
        return false;
    }

    if(color.typename !== "CMYKColor"){
        return false;
    }

    if(
        Math.round(color.cyan) !== 0 ||
        Math.round(color.magenta) !== 0 ||
        Math.round(color.yellow) !== 0 ||
        Math.round(color.black) !== 100
    ){
        return false;
    }

    return true;

}


function isValidWhiteInkColor(color){

    if(!color){
        return false;
    }

    if(color.typename !== "SpotColor"){
        return false;
    }

    if(!color.spot){
        return false;
    }

    if(color.spot.name !== "White Ink"){
        return false;
    }

    if(Math.round(color.tint) !== 100){
        return false;
    }

    return true;

}


// ========================================================
// VERIFICA OPEN PATH RECURSIVAMENTE
// ========================================================

function hasOpenPathRecursive(item){

    // ----------------------------------------------
    // ITEM INVÁLIDO
    // ----------------------------------------------

    if(!item){

        return false;

    }


    // ----------------------------------------------
    // PATH ITEM
    // ----------------------------------------------

    if(
        item.typename === "PathItem"
    ){

        if(item.clipping){

            return false;

        }

        if(!item.closed){

            return true;

        }

        return false;

    }


    // ----------------------------------------------
    // COMPOUND PATH
    // ----------------------------------------------

    if(
        item.typename === "CompoundPathItem"
    ){

        for(
            var i = 0;
            i < item.pathItems.length;
            i++
        ){

            var path =
                item.pathItems[i];

            if(
                path &&
                !path.closed
            ){

                return true;

            }

        }

        return false;

    }


    // ----------------------------------------------
    // GROUP
    // ----------------------------------------------

    if(
        item.typename === "GroupItem"
    ){

        for(
            var i = 0;
            i < item.pageItems.length;
            i++
        ){

            if(
                hasOpenPathRecursive(
                    item.pageItems[i]
                )
            ){

                return true;

            }

        }

        return false;

    }


    // ----------------------------------------------
    // OUTROS TIPOS
    // ----------------------------------------------

    return false;

}


// ============================================================
// PRODUCTION STRUCTURAL CHECKS
// ============================================================

function hasImageRecursive(item){

    if(
        item.typename === "RasterItem" ||
        item.typename === "PlacedItem"
    ){
        return true;
    }


    if(
        item.typename === "GroupItem" ||
        item.typename === "Layer"
    ){

        for(var i = 0; i < item.pageItems.length; i++){

            if(hasImageRecursive(item.pageItems[i])){
                return true;
            }

        }

    }


    return false;

}


function hasClippingMaskRecursive(item){

    if(item.typename === "GroupItem"){

        if(item.clipped){
            return true;
        }

        for(var i = 0; i < item.pageItems.length; i++){

            if(hasClippingMaskRecursive(item.pageItems[i])){
                return true;
            }

        }

    }


    if(item.typename === "PathItem"){

        if(item.clipping){
            return true;
        }

    }


    if(item.typename === "CompoundPathItem"){

        for(var i = 0; i < item.pathItems.length; i++){

            if(item.pathItems[i].clipping){
                return true;
            }

        }

    }


    return false;

}


// ============================================================
// ITEM VALIDATORS
// ============================================================


// ------------------------------------------------------------
// CUT CONTOUR
// ------------------------------------------------------------

function validateCutContourItem(item){

    if(
        item.typename === "RasterItem" ||
        item.typename === "PlacedItem"
    ){

        return {
            valid: false,
            message: "Images are not allowed in CutContour."
        };

    }


    if(
        item.typename !== "PathItem" &&
        item.typename !== "CompoundPathItem" &&
        item.typename !== "GroupItem"
    ){

        return {
            valid: false,
            message: "Unsupported object in CutContour."
        };

    }


    if(hasOpenPathRecursive(item)){

        return {
            valid: false,
            message: "Open paths are not allowed in CutContour."
        };

    }


    if(hasClippingMaskRecursive(item)){

        return {
            valid: false,
            message: "Clipping masks are not allowed in CutContour."
        };

    }


    var paths = [];


    function collectPaths(obj){

        if(obj.typename === "PathItem"){

            paths.push(obj);

        }

        else if(obj.typename === "CompoundPathItem"){

            for(var i = 0; i < obj.pathItems.length; i++){
                paths.push(obj.pathItems[i]);
            }

        }

        else if(
            obj.typename === "GroupItem" ||
            obj.typename === "Layer"
        ){

            for(var i = 0; i < obj.pageItems.length; i++){
                collectPaths(obj.pageItems[i]);
            }

        }

    }


    collectPaths(item);


    for(var i = 0; i < paths.length; i++){

        var path = paths[i];


        if(!path.stroked){

            return {
                valid: false,
                message: "CutContour objects must have a stroke."
            };

        }


        if(!isValidCutContourColor(path.strokeColor)){

            return {
                valid: false,
                message: "CutContour must use the CutContour spot color."
            };

        }


        if(
            Math.abs(path.strokeWidth - expectedStroke) >
            0.001
        ){

            return {
                valid: false,
                message: "CutContour stroke must be 1 pt."
            };

        }

    }


    return {
        valid: true
    };

}


// ------------------------------------------------------------
// OUTLINE / HOLES
// ------------------------------------------------------------

function validateOutlineLikeItem(item){

    if(
        item.typename === "RasterItem" ||
        item.typename === "PlacedItem"
    ){

        return {
            valid: false,
            message: "Images are not allowed in Outline/Holes."
        };

    }


    if(
        item.typename !== "PathItem" &&
        item.typename !== "CompoundPathItem" &&
        item.typename !== "GroupItem"
    ){

        return {
            valid: false,
            message: "Unsupported object in Outline/Holes."
        };

    }


    if(hasOpenPathRecursive(item)){

        return {
            valid: false,
            message: "Open paths are not allowed in Outline/Holes."
        };

    }


    if(hasClippingMaskRecursive(item)){

        return {
            valid: false,
            message: "Clipping masks are not allowed in Outline/Holes."
        };

    }


    var paths = [];


    function collectPaths(obj){

        if(obj.typename === "PathItem"){

            paths.push(obj);

        }

        else if(obj.typename === "CompoundPathItem"){

            for(var i = 0; i < obj.pathItems.length; i++){
                paths.push(obj.pathItems[i]);
            }

        }

        else if(
            obj.typename === "GroupItem" ||
            obj.typename === "Layer"
        ){

            for(var i = 0; i < obj.pageItems.length; i++){
                collectPaths(obj.pageItems[i]);
            }

        }

    }


    collectPaths(item);


    for(var i = 0; i < paths.length; i++){

        var path = paths[i];


        if(!path.stroked){

            return {
                valid: false,
                message: "Outline/Holes objects must have a stroke."
            };

        }


        if(!isValidOutlineColor(path.strokeColor)){

            return {
                valid: false,
                message: "Outline/Holes must use 100% black CMYK."
            };

        }


        if(
            Math.abs(path.strokeWidth - expectedStroke) >
            0.001
        ){

            return {
                valid: false,
                message: "Outline/Holes stroke must be 1 pt."
            };

        }

    }


    return {
        valid: true
    };

}


// ------------------------------------------------------------
// BOUNDING BOX
// ------------------------------------------------------------

function validateBoundingBoxItem(item){

    if(
        item.typename === "RasterItem" ||
        item.typename === "PlacedItem"
    ){

        return {
            valid: false,
            message: "Images are not allowed in BoundingBox."
        };

    }


    if(
        item.typename !== "PathItem" &&
        item.typename !== "CompoundPathItem" &&
        item.typename !== "GroupItem"
    ){

        return {
            valid: false,
            message: "Unsupported object in BoundingBox."
        };

    }


    if(hasOpenPathRecursive(item)){

        return {
            valid: false,
            message: "Open paths are not allowed in BoundingBox."
        };

    }


    if(hasClippingMaskRecursive(item)){

        return {
            valid: false,
            message: "Clipping masks are not allowed in BoundingBox."
        };

    }


    var paths = [];


    function collectPaths(obj){

        if(obj.typename === "PathItem"){

            paths.push(obj);

        }

        else if(obj.typename === "CompoundPathItem"){

            for(var i = 0; i < obj.pathItems.length; i++){
                paths.push(obj.pathItems[i]);
            }

        }

        else if(
            obj.typename === "GroupItem" ||
            obj.typename === "Layer"
        ){

            for(var i = 0; i < obj.pageItems.length; i++){
                collectPaths(obj.pageItems[i]);
            }

        }

    }


    collectPaths(item);


    for(var i = 0; i < paths.length; i++){

        var path = paths[i];


        if(path.stroked){

            return {
                valid: false,
                message: "BoundingBox objects must not have a stroke."
            };

        }


        if(path.filled){

            return {
                valid: false,
                message: "BoundingBox objects must not have a fill."
            };

        }

    }


    return {
        valid: true
    };

}


// ------------------------------------------------------------
// WHITE INK
// ------------------------------------------------------------

function validateWhiteInkItem(item){

    if(
        item.typename === "RasterItem" ||
        item.typename === "PlacedItem"
    ){

        return {
            valid: false,
            message: "Images are not allowed in White Ink."
        };

    }


    if(
        item.typename !== "PathItem" &&
        item.typename !== "CompoundPathItem" &&
        item.typename !== "GroupItem"
    ){

        return {
            valid: false,
            message: "Unsupported object in White Ink."
        };

    }


    if(hasOpenPathRecursive(item)){

        return {
            valid: false,
            message: "Open paths are not allowed in White Ink."
        };

    }


    if(hasClippingMaskRecursive(item)){

        return {
            valid: false,
            message: "Clipping masks are not allowed in White Ink."
        };

    }


    var paths = [];


    function collectPaths(obj){

        if(obj.typename === "PathItem"){

            paths.push(obj);

        }

        else if(obj.typename === "CompoundPathItem"){

            for(var i = 0; i < obj.pathItems.length; i++){
                paths.push(obj.pathItems[i]);
            }

        }

        else if(
            obj.typename === "GroupItem" ||
            obj.typename === "Layer"
        ){

            for(var i = 0; i < obj.pageItems.length; i++){
                collectPaths(obj.pageItems[i]);
            }

        }

    }


    collectPaths(item);


    for(var i = 0; i < paths.length; i++){

        var path = paths[i];


        if(!path.filled){

            return {
                valid: false,
                message: "White Ink objects must have a fill."
            };

        }


        if(path.stroked){

            return {
                valid: false,
                message: "White Ink objects must not have a stroke."
            };

        }


        if(!isValidWhiteInkColor(path.fillColor)){

            return {
                valid: false,
                message: "White Ink must use the White Ink spot color."
            };

        }

    }


    return {
        valid: true
    };

}


// ============================================================
// IMAGE QUALITY
// ============================================================

function getImagePPI(item, scaleFactor){

    try{

        var m = item.matrix;

        var scaleX = Math.sqrt(
            m.mValueA * m.mValueA +
            m.mValueB * m.mValueB
        );

        scaleX = scaleX * scaleFactor;


        if(scaleX > 0){

            return Math.round(72 / scaleX);

        }

    }

    catch(e){

        return 0;

    }


    return 0;

}


function getImageName(item){

    try{

        if(item.name){
            return item.name;
        }

    }

    catch(e){}


    try{

        if(
            item.typename === "PlacedItem" &&
            item.file
        ){

            if(item.file.displayName){
                return item.file.displayName;
            }

            if(item.file.name){
                return item.file.name;
            }

        }

    }

    catch(e){}


    return "Unnamed image";

}


function isTrueSpotColor(color) {
    try {
        return (
            color &&
            color.typename === "SpotColor" &&
            color.spot &&
            color.spot.colorType === ColorModel.SPOT
        );
    } catch (e) {
        return false;
    }
}

function isSpotUsedInDocument(doc, targetSpot) {
    var pathItems = doc.pathItems;
    var textFrames = doc.textFrames;
    var i;
    var j;

    for (i = 0; i < pathItems.length; i++) {
        var path = pathItems[i];

        try {
            if (
                path.filled &&
                path.fillColor.typename === "SpotColor" &&
                path.fillColor.spot === targetSpot
            ) {
                return true;
            }
        } catch (eFill) {}

        try {
            if (
                path.stroked &&
                path.strokeColor.typename === "SpotColor" &&
                path.strokeColor.spot === targetSpot
            ) {
                return true;
            }
        } catch (eStroke) {}
    }

    for (i = 0; i < textFrames.length; i++) {
        for (j = 0; j < textFrames[i].characters.length; j++) {
            try {
                var attributes =
                    textFrames[i].characters[j].characterAttributes;

                if (
                    attributes.fillColor.typename === "SpotColor" &&
                    attributes.fillColor.spot === targetSpot
                ) {
                    return true;
                }
            } catch (eTextFill) {}

            try {
                var strokeAttributes =
                    textFrames[i].characters[j].characterAttributes;

                if (
                    strokeAttributes.strokeColor.typename === "SpotColor" &&
                    strokeAttributes.strokeColor.spot === targetSpot
                ) {
                    return true;
                }
            } catch (eTextStroke) {}
        }
    }

    return false;
}

function isPatternUsedInDocument(doc, targetPattern) {
    var pathItems = doc.pathItems;
    var textFrames = doc.textFrames;
    var i;
    var j;

    for (i = 0; i < pathItems.length; i++) {
        var path = pathItems[i];

        try {
            if (
                path.filled &&
                path.fillColor.typename === "PatternColor" &&
                path.fillColor.pattern === targetPattern
            ) {
                return true;
            }
        } catch (eFill) {}

        try {
            if (
                path.stroked &&
                path.strokeColor.typename === "PatternColor" &&
                path.strokeColor.pattern === targetPattern
            ) {
                return true;
            }
        } catch (eStroke) {}
    }

    for (i = 0; i < textFrames.length; i++) {
        for (j = 0; j < textFrames[i].characters.length; j++) {
            try {
                var attributes =
                    textFrames[i].characters[j].characterAttributes;

                if (
                    attributes.fillColor.typename === "PatternColor" &&
                    attributes.fillColor.pattern === targetPattern
                ) {
                    return true;
                }
            } catch (eTextFill) {}

            try {
                var strokeAttributes =
                    textFrames[i].characters[j].characterAttributes;

                if (
                    strokeAttributes.strokeColor.typename === "PatternColor" &&
                    strokeAttributes.strokeColor.pattern === targetPattern
                ) {
                    return true;
                }
            } catch (eTextStroke) {}
        }
    }

    return false;
}

function inspectSwatches(doc) {
    var result = {
        hasDirtySwatches: false,
        hasUsedPattern: false,
        dirtySwatchNames: []
    };

    for (var i = 0; i < doc.swatches.length; i++) {
        try {
            var swatch = doc.swatches[i];
            var color = swatch.color;
            var colorType = color.typename;

            // Allowed defaults
            if (
                swatch.name === "[None]" ||
                swatch.name === "[Registration]" ||
                colorType === "NoColor"
            ) {
                continue;
            }

            // Allowed only when a true Spot is used in artwork
            if (colorType === "SpotColor" && isTrueSpotColor(color)) {
                if (isSpotUsedInDocument(doc, color.spot)) {
                    continue;
                }
            }

            // Pattern in use cannot be cleaned automatically.
            if (colorType === "PatternColor") {
				if (isPatternUsedInDocument(doc, color.pattern)) {
					result.hasUsedPattern = true;
					continue;
				}
			}

            result.hasDirtySwatches = true;
            result.dirtySwatchNames.push(swatch.name);

        } catch (e) {
            result.hasDirtySwatches = true;
            result.dirtySwatchNames.push("Unknown swatch");
        }
    }

    return result;
}


// ============================================================
// PREFLIGHT
// ============================================================

var PREFLIGHT = {

    context: null,


    // --------------------------------------------------------
    // DISCOVER
    // --------------------------------------------------------

    discover: function(){

        this.context = {

            hasImages: false,
            hasEditableText: false,
            hasClippingMask: false,
            hasExternalLinks: false,

            hasCutContour: false,
            hasOutline: false,
            hasBoundingBox: false,
            hasWhiteInk: false,
            hasBraille: false,
            hasGrommets: false,
            hasHoles: false,
			
			hasDirtySwatches: false,
			hasUsedPattern: false,
			dirtySwatchNames: [],

            productionObjects: []

        };


        for(var i = 0; i < doc.pageItems.length; i++){

            var item = doc.pageItems[i];


            // ----------------------------------------------
            // IMAGES
            // ----------------------------------------------

            if(
                item.typename === "RasterItem" ||
                item.typename === "PlacedItem"
            ){

                this.context.hasImages = true;

            }


            // ----------------------------------------------
            // TEXT
            // ----------------------------------------------

            if(item.typename === "TextFrame"){

                try{

                    if(item.kind !== TextType.POINTTEXT ||
                       item.kind === TextType.POINTTEXT){

                        this.context.hasEditableText = true;

                    }

                }

                catch(e){

                    this.context.hasEditableText = true;

                }

            }


            // ----------------------------------------------
            // CLIPPING MASK
            // ----------------------------------------------

            if(hasClippingMaskRecursive(item)){

                this.context.hasClippingMask = true;

            }


            // ----------------------------------------------
            // EXTERNAL LINK
            // ----------------------------------------------

            if(item.typename === "PlacedItem"){

                this.context.hasExternalLinks = true;

            }


            // ----------------------------------------------
            // PRODUCTION
            // ----------------------------------------------

            var productionLayer = getProductionLayer(item);

            if(productionLayer){

                registerProductionLayer(
                    this.context,
                    productionLayer.name
                );


                var root = getProductionRoot(item);

                if(root){

                    var alreadyRegistered = false;

                    for(
                        var p = 0;
                        p < this.context.productionObjects.length;
                        p++
                    ){

                        if(
                            this.context.productionObjects[p] === root
                        ){

                            alreadyRegistered = true;
                            break;

                        }

                    }


                    if(!alreadyRegistered){

                        this.context.productionObjects.push(root);

                    }

                }

            }

        }
		var swatchInspection =
    inspectSwatches(doc);

this.context.hasDirtySwatches =
    swatchInspection.hasDirtySwatches;

this.context.hasUsedPattern =
    swatchInspection.hasUsedPattern;

this.context.dirtySwatchNames =
    swatchInspection.dirtySwatchNames;


        return this.context;

    },


    // --------------------------------------------------------
    // APPLICABLE CHECKS
    // --------------------------------------------------------

    getApplicableChecks: function(){

        var checks = [];


        checks.push("colorMode");
        checks.push("editableText");
        checks.push("openPaths");
        checks.push("clippingMask");
        checks.push("externalLinks");
		checks.push("swatches");


        if(this.context.hasImages){

            checks.push("imageQuality");

        }


        if(this.context.hasCutContour){

            checks.push("cutContour");

        }


        if(this.context.hasOutline){

            checks.push("outline");

        }


        if(this.context.hasHoles){

            checks.push("holes");

        }


        if(this.context.hasBoundingBox){

            checks.push("boundingBox");

        }


        if(this.context.hasWhiteInk){

            checks.push("whiteInk");

        }


        return checks;

    },


    // --------------------------------------------------------
    // COLOR MODE
    // --------------------------------------------------------

    validateColorMode: function(){

        if(
            doc.documentColorSpace === DocumentColorSpace.CMYK
        ){

            return {

                check: "Color Mode",
                status: "pass",
                message: "Document is in CMYK color mode."

            };

        }


        return {

            check: "Color Mode",
            status: "warning",
            message: "Document is not in CMYK color mode. Please check if there is a client spec"

        };

    },


    // --------------------------------------------------------
    // EDITABLE TEXT
    // --------------------------------------------------------

    validateEditableText: function(){

        if(this.context.hasEditableText){

            return {

                check: "Editable Text",
                status: "warning",
                message: "Editable text was found in the document. Please check if there is a client spec"

            };

        }


        return {

            check: "Editable Text",
            status: "pass",
            message: "No editable text found."

        };

    },


    // ========================================================
// OPEN PATHS
// ========================================================

validateOpenPaths: function(){

    var objects =
        this.context.productionObjects;


    for(
        var i = 0;
        i < objects.length;
        i++
    ){

        var productionObject =
            objects[i];


        if(
            hasOpenPathRecursive(
                productionObject.item
            )
        ){

            var objectName =
                "Unnamed Object";


            try{

                objectName =
                    productionObject.item.name ||
                    productionObject.item.typename;

            }
            catch(eName){

                objectName =
                    productionObject.item.typename;

            }


            return {

                check:
                    "Open Paths",

                status:
                    "fail",

                message:
                    "Open path found. " +
                    "Layer: " +
                    productionObject.layerName +
                    ". Object: " +
                    objectName +
                    " (" +
                    productionObject.item.typename +
                    ")."

            };

        }

    }


    return {

        check:
            "Open Paths",

        status:
            "pass",

        message:
            "No open paths found in production layers."

    };

},


    // --------------------------------------------------------
    // CLIPPING MASK
    // --------------------------------------------------------

    validateClippingMask: function(){

        if(this.context.hasClippingMask){

            return {

                check: "Clipping Mask",
                status: "fail",
                message: "Clipping masks were found in the document."

            };

        }


        return {

            check: "Clipping Mask",
            status: "pass",
            message: "No clipping masks found."

        };

    },


    // --------------------------------------------------------
    // EXTERNAL LINKS
    // --------------------------------------------------------

    validateExternalLinks: function(){

        for(var i = 0; i < doc.placedItems.length; i++){

            var item = doc.placedItems[i];

            try{

                if(item.file){

                    return {

                        check: "External Links",
                        status: "fail",
                        message: "External linked images were found in the document."

                    };

                }

            }

            catch(e){}

        }


        return {

            check: "External Links",
            status: "pass",
            message: "No external links found."

        };

    },


    // --------------------------------------------------------
    // IMAGE QUALITY
    // --------------------------------------------------------

    validateImageQuality: function(){

    var images = [];

    var lowDpiImages = [];
    var scanErrors = [];


    // ----------------------------------------------
    // DESIGN LAYER
    // ----------------------------------------------

    var designLayer = null;


    for(var i = 0; i < doc.layers.length; i++){

        if(doc.layers[i].name === "Design"){

            designLayer = doc.layers[i];
            break;

        }

    }


    // ----------------------------------------------
    // NO DESIGN LAYER
    // ----------------------------------------------

    if(!designLayer){

        return {

            check: "Image Quality",
            status: "pass",
            message:
                "No Design layer found. Image quality check not applicable."

        };

    }


    // ----------------------------------------------
    // COLLECT IMAGES FROM DESIGN
    // ----------------------------------------------

    function collectImages(container){

        try{

            for(var i = 0; i < container.pageItems.length; i++){

                var item = container.pageItems[i];


                // --------------------------------------
                // PLACED ITEM
                // --------------------------------------

                if(item.typename === "PlacedItem"){

                    images.push(item);

                }


                // --------------------------------------
                // RASTER ITEM
                // --------------------------------------

                else if(item.typename === "RasterItem"){

                    images.push(item);

                }


                // --------------------------------------
                // GROUP
                // --------------------------------------

                else if(item.typename === "GroupItem"){

                    collectImages(item);

                }


                // --------------------------------------
                // COMPOUND PATH
                // --------------------------------------

                else if(item.typename === "CompoundPathItem"){

                    collectImages(item);

                }

            }

        }

        catch(e){

            // Ignore container errors.
            // Individual images are evaluated below.

        }

    }


    // ----------------------------------------------
    // DESIGN LAYER ITEMS
    // ----------------------------------------------

    collectImages(designLayer);


    // ----------------------------------------------
    // SCAN
    // ----------------------------------------------

    for(var i = 0; i < images.length; i++){

        var image = images[i];
        var name = getImageName(image);
        var ppi = 0;


        try{

            ppi = getImagePPI(
                image,
                doc.scaleFactor
            );


            // --------------------------------------
            // LOW DPI
            // --------------------------------------

            if(ppi > 0 && ppi < 150){

                lowDpiImages.push({

                    name: name,
                    ppi: ppi

                });

            }


            // --------------------------------------
            // UNDETERMINED
            // --------------------------------------

            else if(ppi <= 0){

                scanErrors.push(name);

            }

        }

        catch(e){

            scanErrors.push(name);

        }

    }


    // ----------------------------------------------
    // FAIL
    // ----------------------------------------------

    if(lowDpiImages.length > 0){

        var failMessage =
            "Low DPI images found: ";


        for(var i = 0; i < lowDpiImages.length; i++){

            if(i > 0){
                failMessage += ", ";
            }


            failMessage +=
                lowDpiImages[i].name +
                " (" +
                lowDpiImages[i].ppi +
                " DPI)";

        }


        // If there are also unreadable images,
        // mention them in the same result.

        if(scanErrors.length > 0){

            failMessage +=
                ". " +
                scanErrors.length +
                " image(s) could not be evaluated.";

        }


        return {

            check: "Image Quality",
            status: "fail",
            message: failMessage

        };

    }


    // ----------------------------------------------
    // WARNING
    // ----------------------------------------------

    if(scanErrors.length > 0){

        var warningMessage =
            "Image DPI could not be determined for " +
            scanErrors.length +
            " image(s): ";


        for(var i = 0; i < scanErrors.length; i++){

            if(i > 0){
                warningMessage += ", ";
            }


            warningMessage +=
                scanErrors[i];

        }


        return {

            check: "Image Quality",
            status: "warning",
            message: warningMessage

        };

    }


    // ----------------------------------------------
    // PASS
    // ----------------------------------------------

    return {

        check: "Image Quality",
        status: "pass",
        message:
            "All images in the Design layer are 150 DPI or higher."

    };

},


    // --------------------------------------------------------
    // CUT CONTOUR
    // --------------------------------------------------------

    validateCutContour: function(){

        for(
            var i = 0;
            i < this.context.productionObjects.length;
            i++
        ){

            var root = this.context.productionObjects[i];

            var layer = getProductionLayer(root);

            if(
                !layer ||
                layer.name !== "CutContour"
            ){

                continue;

            }


            var result = validateCutContourItem(root);

            if(!result.valid){

                return {

                    check: "CutContour",
                    status: "fail",
                    message: result.message

                };

            }

        }


        return {

            check: "CutContour",
            status: "pass",
            message: "CutContour is valid."

        };

    },


    // --------------------------------------------------------
    // OUTLINE
    // --------------------------------------------------------

    validateOutline: function(){

        for(
            var i = 0;
            i < this.context.productionObjects.length;
            i++
        ){

            var root = this.context.productionObjects[i];

            var layer = getProductionLayer(root);

            if(
                !layer ||
                layer.name !== "Outline"
            ){

                continue;

            }


            var result = validateOutlineLikeItem(root);

            if(!result.valid){

                return {

                    check: "Outline",
                    status: "fail",
                    message: result.message

                };

            }

        }


        return {

            check: "Outline",
            status: "pass",
            message: "Outline is valid."

        };

    },


    // --------------------------------------------------------
    // HOLES
    // --------------------------------------------------------

    validateHoles: function(){

        for(
            var i = 0;
            i < this.context.productionObjects.length;
            i++
        ){

            var root = this.context.productionObjects[i];

            var layer = getProductionLayer(root);

            if(
                !layer ||
                layer.name !== "Holes"
            ){

                continue;

            }


            var result = validateOutlineLikeItem(root);

            if(!result.valid){

                return {

                    check: "Holes",
                    status: "fail",
                    message: result.message

                };

            }

        }


        return {

            check: "Holes",
            status: "pass",
            message: "Holes is valid."

        };

    },


    // --------------------------------------------------------
    // BOUNDING BOX
    // --------------------------------------------------------

    validateBoundingBox: function(){

        for(
            var i = 0;
            i < this.context.productionObjects.length;
            i++
        ){

            var root = this.context.productionObjects[i];

            var layer = getProductionLayer(root);

            if(
                !layer ||
                layer.name !== "BoundingBox"
            ){

                continue;

            }


            var result = validateBoundingBoxItem(root);

            if(!result.valid){

                return {

                    check: "BoundingBox",
                    status: "fail",
                    message: result.message

                };

            }

        }


        return {

            check: "BoundingBox",
            status: "pass",
            message: "BoundingBox is valid."

        };

    },


    // --------------------------------------------------------
    // WHITE INK
    // --------------------------------------------------------

    validateWhiteInk: function(){

        for(
            var i = 0;
            i < this.context.productionObjects.length;
            i++
        ){

            var root = this.context.productionObjects[i];

            var layer = getProductionLayer(root);

            if(
                !layer ||
                layer.name !== "White Ink"
            ){

                continue;

            }


            var result = validateWhiteInkItem(root);

            if(!result.valid){

                return {

                    check: "White Ink",
                    status: "fail",
                    message: result.message

                };

            }

        }


        return {

            check: "White Ink",
            status: "pass",
            message: "White Ink is valid."

        };

    },
	
	validateSwatches: function(){

		var dirtySwatches =
			this.context.dirtySwatchNames || [];


		// Swatches that can be removed automatically
		// are still present in the panel.
		if(
			this.context.hasDirtySwatches
		){

			return {

				check: "Swatches",
				status: "fail",
				message:
					"Swatches panel is not clean. Remove unused or process swatches."

			};

		}


		// A used Pattern cannot be safely removed
		// without removing it from the artwork first.
		if(
			this.context.hasUsedPattern
		){

			return {

				check: "Swatches",
				status: "warning",
				message:
					"A pattern is in use make sure is necessary."

			};

		}


		return {

			check: "Swatches",
			status: "pass",
			message:
				"Swatches panel is clean."

		};

	},


    // --------------------------------------------------------
    // FORMAT RESULT
    // --------------------------------------------------------

    formatResult: function(result){

        return (
            '<div class="preflight-result-item status-' +
            result.status +
            '" id="result-' +
            result.check +
            '">' +

                '<div class="preflight-result-header">' +

                    '<span class="preflight-result-check">' +
                        result.check +
                    ': </span>' +

                    '<span class="preflight-result-status">' +
                        '<b>' +
                            result.status.toUpperCase() +
                        '</b>' +
                    '</span>' +

                '</div>' +

                '<div class="preflight-result-message">' +
                    result.message +
                '</div>' +

            '</div>'
        );

    },


    // --------------------------------------------------------
    // RUN
    // --------------------------------------------------------

    run: function(){

        this.discover();

        var checks = this.getApplicableChecks();

        var results = [];


        for(var i = 0; i < checks.length; i++){

            var check = checks[i];


            if(check === "colorMode"){

                results.push(
                    this.formatResult(
                        this.validateColorMode()
                    )
                );

            }


            else if(check === "editableText"){

                results.push(
                    this.formatResult(
                        this.validateEditableText()
                    )
                );

            }


            else if(check === "openPaths"){

                results.push(
                    this.formatResult(
                        this.validateOpenPaths()
                    )
                );

            }


            else if(check === "clippingMask"){

                results.push(
                    this.formatResult(
                        this.validateClippingMask()
                    )
                );

            }


            else if(check === "externalLinks"){

                results.push(
                    this.formatResult(
                        this.validateExternalLinks()
                    )
                );

            }


            else if(check === "imageQuality"){

                results.push(
                    this.formatResult(
                        this.validateImageQuality()
                    )
                );

            }


            else if(check === "cutContour"){

                results.push(
                    this.formatResult(
                        this.validateCutContour()
                    )
                );

            }


            else if(check === "outline"){

                results.push(
                    this.formatResult(
                        this.validateOutline()
                    )
                );

            }


            else if(check === "holes"){

                results.push(
                    this.formatResult(
                        this.validateHoles()
                    )
                );

            }


            else if(check === "boundingBox"){

                results.push(
                    this.formatResult(
                        this.validateBoundingBox()
                    )
                );

            }


            else if(check === "whiteInk"){

                results.push(
                    this.formatResult(
                        this.validateWhiteInk()
                    )
                );

            }
			
			else if(check === "swatches"){

				results.push(
					this.formatResult(
						this.validateSwatches()
					)
				);

			}

        }


        return results.join("");

    }

};


// ============================================================
// RUN PREFLIGHT
// ============================================================

PREFLIGHT.run();