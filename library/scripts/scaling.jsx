#target illustrator

var RESULT = "";

(function () {

    var doc = null;
    var sel = null;

    // -------------------------
    // SCALE DATA
    // -------------------------

    var SCALES = [
        { label: '1" = 1" (Full Scale)', value: 12.0 },
        { label: '1" = 1\' (12th Scale)', value: 1.0 },
        { label: '7/8" = 1\'', value: 0.875 },
        { label: '3/4" = 1\'', value: 0.75 },
        { label: '5/8" = 1\'', value: 0.625 },
        { label: '1/2" = 1\'', value: 0.5 },
        { label: '3/8" = 1\'', value: 0.375 },
        { label: '1/4" = 1\'', value: 0.25 },
        { label: '3/16" = 1\'', value: 0.1875 },
        { label: '1/8" = 1\'', value: 0.125 },
        { label: '1/16" = 1\'', value: 0.0625 },
        { label: '1/32" = 1\'', value: 0.03125 }
    ];

    var CUSTOM_LABEL = "Custom...";
    var CUSTOM_PLACEHOLDER = 'e.g. 5/16" = 1\'';

    var startingScale = SCALES[1].value;
    var targetScale = SCALES[1].value;

    var previewItems = [];

    // -------------------------
    // VALIDATION
    // -------------------------

    if (app.documents.length === 0) {
        RESULT = "ERROR: Please open a document first.";
        return;
    }

    doc = app.activeDocument;
    sel = doc.selection;

    if (!sel || sel.length === 0) {
        RESULT = "ERROR: Select artwork first.";
        return;
    }

    // -------------------------
    // CUSTOM SCALE PARSER
    //
    // Accepted examples:
    // 5/16" = 1'
    // 0.6" = 1'
    // 1" = 2'
    // -------------------------

    function trimText(value) {
        return value.replace(/^\s+|\s+$/g, "");
    }

    function parseNumberOrFraction(value) {
        value = trimText(value);

        if (value.indexOf("/") !== -1) {
            var fraction = value.split("/");

            if (fraction.length !== 2) {
                return null;
            }

            var numerator = parseFloat(trimText(fraction[0]));
            var denominator = parseFloat(trimText(fraction[1]));

            if (
                isNaN(numerator) ||
                isNaN(denominator) ||
                denominator === 0
            ) {
                return null;
            }

            return numerator / denominator;
        }

        var numberValue = parseFloat(value);

        if (isNaN(numberValue)) {
            return null;
        }

        return numberValue;
    }

    function parseCustomScale(value) {
        value = trimText(value);

        var match = value.match(
            /^(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*"\s*=\s*(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*'$/
        );

        if (!match) {
            return null;
        }

        var drawingInches =
            parseNumberOrFraction(match[1]);

        var realFeet =
            parseNumberOrFraction(match[2]);

        if (
            drawingInches === null ||
            realFeet === null ||
            drawingInches <= 0 ||
            realFeet <= 0
        ) {
            return null;
        }

        return {
            value: drawingInches / realFeet,
            label: value
        };
    }

    // -------------------------
    // PLACEHOLDER HELPERS
    // -------------------------

    function setPlaceholder(input) {
        input.text = CUSTOM_PLACEHOLDER;
        input.isPlaceholder = true;
    }

    function clearPlaceholder(input) {
        if (!input.isPlaceholder) {
            return;
        }

        input.text = "";
        input.isPlaceholder = false;
    }

    function getCustomInputValue(input) {
        if (input.isPlaceholder) {
            return "";
        }

        return input.text;
    }

    // -------------------------
    // CORE SCALING
    // -------------------------

    function getFactorPercent() {
        return (targetScale / startingScale) * 100;
    }

    function scaleItems(items) {
        var factor = getFactorPercent();

        for (var i = 0; i < items.length; i++) {
            items[i].resize(
                factor,
                factor,
                true,
                true,
                true,
                true,
                factor,
                Transformation.CENTER
            );
        }
    }

    // -------------------------
    // PREVIEW SYSTEM
    // -------------------------

    function clearPreview() {
        for (var i = 0; i < previewItems.length; i++) {
            try {
                previewItems[i].remove();
            } catch (e) {}
        }

        previewItems = [];
    }

    function updatePreview() {
        clearPreview();

        if (!previewCheckbox.value) {
            try {
                app.redraw();
            } catch (e) {}

            return;
        }

        for (var i = 0; i < sel.length; i++) {
            var duplicate = sel[i].duplicate();

            previewItems.push(duplicate);
        }

        scaleItems(previewItems);

        try {
            app.redraw();
        } catch (e) {}
    }

    // -------------------------
    // LABEL
    // -------------------------

    function createScaleLabel(scaleLabel) {
        var labelText =
            "SCALE: " +
            scaleLabel;

        var bounds = sel[0].visibleBounds;

        for (var i = 1; i < sel.length; i++) {
            var itemBounds = sel[i].visibleBounds;

            bounds = [
                Math.min(bounds[0], itemBounds[0]),
                Math.max(bounds[1], itemBounds[1]),
                Math.max(bounds[2], itemBounds[2]),
                Math.min(bounds[3], itemBounds[3])
            ];
        }

        var textFrame = doc.textFrames.add();

        textFrame.contents = labelText;
        textFrame.position = [bounds[0], bounds[3] - 20];
        textFrame.textRange.characterAttributes.size = 12;
    }

    // -------------------------
    // UI
    // -------------------------

    var dlg = new Window("dialog", "Scale Converter");

    dlg.orientation = "column";
    dlg.alignChildren = "left";

    var row = dlg.add("group");

    row.orientation = "row";

    // Starting Scale

    var startGroup = row.add("group");

    startGroup.orientation = "column";
    startGroup.alignChildren = "left";

    startGroup.add(
        "statictext",
        undefined,
        "Starting Scale"
    );

    var startDropdown =
        startGroup.add("dropdownlist");

    for (var i = 0; i < SCALES.length; i++) {
        startDropdown.add("item", SCALES[i].label);
    }

    startDropdown.add("item", CUSTOM_LABEL);
    startDropdown.selection = 1;

    var startCustomInput =
        startGroup.add("edittext", undefined, "");

    startCustomInput.characters = 16;
    startCustomInput.visible = false;
    startCustomInput.helpTip =
        'Format: 5/16" = 1\'';

    setPlaceholder(startCustomInput);

    row.add("statictext", undefined, " → ");

    // Target Scale

    var targetGroup = row.add("group");

    targetGroup.orientation = "column";
    targetGroup.alignChildren = "left";

    targetGroup.add(
        "statictext",
        undefined,
        "Target Scale"
    );

    var targetDropdown =
        targetGroup.add("dropdownlist");

    for (var j = 0; j < SCALES.length; j++) {
        targetDropdown.add("item", SCALES[j].label);
    }

    targetDropdown.add("item", CUSTOM_LABEL);
    targetDropdown.selection = 1;

    var targetCustomInput =
        targetGroup.add("edittext", undefined, "");

    targetCustomInput.characters = 16;
    targetCustomInput.visible = false;
    targetCustomInput.helpTip =
        'Format: 5/16" = 1\'';

    setPlaceholder(targetCustomInput);

    var inputStatus =
        dlg.add("statictext", undefined, "");

    inputStatus.preferredSize.width = 340;

    var previewCheckbox =
        dlg.add("checkbox", undefined, "Preview");

    previewCheckbox.value = true;

    var btns = dlg.add("group");

    var okBtn =
        btns.add("button", undefined, "Apply");

    var cancelBtn =
        btns.add("button", undefined, "Cancel");

    // -------------------------
    // SCALE UI HELPERS
    // -------------------------

    function isCustomSelected(dropdown) {
        return (
            dropdown.selection &&
            dropdown.selection.index === SCALES.length
        );
    }

    function getScaleData(dropdown, customInput) {
        if (!dropdown.selection) {
            return null;
        }

        if (!isCustomSelected(dropdown)) {
            return {
                value: SCALES[dropdown.selection.index].value,
                label: SCALES[dropdown.selection.index].label
            };
        }

        return parseCustomScale(
            getCustomInputValue(customInput)
        );
    }

    function getConfiguredScales() {
        var startData =
            getScaleData(
                startDropdown,
                startCustomInput
            );

        if (!startData) {
            inputStatus.text =
                'Enter a valid Starting Scale. Example: 5/16" = 1\'';

            return null;
        }

        var targetData =
            getScaleData(
                targetDropdown,
                targetCustomInput
            );

        if (!targetData) {
            inputStatus.text =
                'Enter a valid Target Scale. Example: 5/16" = 1\'';

            return null;
        }

        inputStatus.text = "";

        return {
            start: startData,
            target: targetData
        };
    }

    function refreshPreview() {
        var scales = getConfiguredScales();

        clearPreview();

        if (!scales) {
            try {
                app.redraw();
            } catch (e) {}

            return;
        }

        startingScale = scales.start.value;
        targetScale = scales.target.value;

        updatePreview();
    }

    function updateCustomInputVisibility() {
        startCustomInput.visible =
            isCustomSelected(startDropdown);

        targetCustomInput.visible =
            isCustomSelected(targetDropdown);

        dlg.layout.layout(true);
    }

    // -------------------------
    // EVENTS
    // -------------------------

    startDropdown.onChange = function () {
        updateCustomInputVisibility();
        refreshPreview();
    };

    targetDropdown.onChange = function () {
        updateCustomInputVisibility();
        refreshPreview();
    };

    startCustomInput.onActivate = function () {
        clearPlaceholder(startCustomInput);
    };

    startCustomInput.onDeactivate = function () {
        if (trimText(startCustomInput.text) === "") {
            setPlaceholder(startCustomInput);
        }
    };

    startCustomInput.onChanging = function () {
        startCustomInput.isPlaceholder = false;
        refreshPreview();
    };

    targetCustomInput.onActivate = function () {
        clearPlaceholder(targetCustomInput);
    };

    targetCustomInput.onDeactivate = function () {
        if (trimText(targetCustomInput.text) === "") {
            setPlaceholder(targetCustomInput);
        }
    };

    targetCustomInput.onChanging = function () {
        targetCustomInput.isPlaceholder = false;
        refreshPreview();
    };

    previewCheckbox.onClick = function () {
        try {
            refreshPreview();
        } catch (e) {
            clearPreview();

            RESULT =
                "ERROR: Could not update the scale preview.\n" +
                e.message;

            dlg.close();
        }
    };

    okBtn.onClick = function () {
        try {
            var scales = getConfiguredScales();

            if (!scales) {
                return;
            }

            startingScale = scales.start.value;
            targetScale = scales.target.value;

            previewCheckbox.value = false;

            clearPreview();

            scaleItems(sel);

            createScaleLabel(scales.target.label);

            try {
                app.redraw();
            } catch (e) {}

            RESULT =
                "SUCCESS: Scale conversion completed.";

            dlg.close();

        } catch (e) {
            clearPreview();

            RESULT =
                "ERROR: Scale conversion failed.\n" +
                e.message;

            dlg.close();
        }
    };

    cancelBtn.onClick = function () {
        clearPreview();

        RESULT = "ERROR: Cancelled";

        dlg.close();
    };

    // -------------------------
    // INITIAL PREVIEW
    // -------------------------

    updateCustomInputVisibility();

    try {
        refreshPreview();
    } catch (e) {
        clearPreview();

        RESULT =
            "ERROR: Could not create the scale preview.\n" +
            e.message;

        return;
    }

    dlg.show();

})();

RESULT;