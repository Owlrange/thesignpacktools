
/**
 * Artboard Renamer for Adobe Illustrator
 * Prompts for prefix, suffix, numbering options, and renames all artboards.
 */

if (app.documents.length === 0) {
    alert("No document open. Please open a document with artboards.");
} else {
    var doc = app.activeDocument;

    // Build the UI
    var dlg = new Window("dialog", "Batch Rename Artboards");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.spacing = 10;
    dlg.margins = 16;

    // Prefix
    var prefixGroup = dlg.add("group");
    prefixGroup.add("statictext", undefined, "Prefix:");
    var prefixInput = prefixGroup.add("edittext", undefined, "");
    prefixInput.characters = 25;

    // Separator
    var sepGroup = dlg.add("group");
    sepGroup.add("statictext", undefined, "Separator:");
    var separatorInput = sepGroup.add("edittext", undefined, "_");
    separatorInput.characters = 5;

    // Numbering checkbox and options
    var numberingGroup = dlg.add("group");
    numberingGroup.orientation = "row";
    var numberingCheckbox = numberingGroup.add("checkbox", undefined, "Include numbering");
    numberingCheckbox.value = true;

    var startNumGroup = dlg.add("group");
    startNumGroup.add("statictext", undefined, "Start at:");
    var startNumInput = startNumGroup.add("edittext", undefined, "1");
    startNumInput.characters = 5;

    var paddingGroup = dlg.add("group");
    paddingGroup.add("statictext", undefined, "Padding:");
    var paddingInput = paddingGroup.add("edittext", undefined, "2");
    paddingInput.characters = 5;

    // Suffix
    var suffixGroup = dlg.add("group");
    suffixGroup.add("statictext", undefined, "Suffix:");
    var suffixInput = suffixGroup.add("edittext", undefined, "");
    suffixInput.characters = 25;

    // Preview area
    var previewGroup = dlg.add("group");
    previewGroup.orientation = "column";
    previewGroup.alignment = ["fill", "top"];
    previewGroup.add("statictext", undefined, "Example names (first 3):");
    var previewText = previewGroup.add("edittext", undefined, "", { multiline: true, readonly: true });
    previewText.preferredSize = [350, 60];

    // Buttons
    var btnGroup = dlg.add("group");
    btnGroup.alignment = ["right", "bottom"];
    var okBtn = btnGroup.add("button", undefined, "Rename", { name: "ok" });
    var cancelBtn = btnGroup.add("button", undefined, "Cancel", { name: "cancel" });

    // Function to update preview
    function updatePreview() {
        var prefix = prefixInput.text;
        var separator = separatorInput.text;
        var includeNum = numberingCheckbox.value;
        var start = parseInt(startNumInput.text, 10);
        if (isNaN(start) || start < 0) start = 1;
        var padding = parseInt(paddingInput.text, 10);
        if (isNaN(padding) || padding < 0) padding = 0;
        var suffix = suffixInput.text;

        var examples = [];
        for (var i = 0; i < 3; i++) {
            var numPart = "";
            if (includeNum) {
                var cur = start + i;
                var numStr = cur.toString();
                if (padding > 0) {
                    while (numStr.length < padding) {
                        numStr = "0" + numStr;
                    }
                }
                numPart = separator + numStr;
            }
            var name = prefix + numPart + (suffix ? separator + suffix : "");
            examples.push(name);
        }
        previewText.text = examples.join("\r");
    }

    // Wire events
    prefixInput.onChanging = updatePreview;
    separatorInput.onChanging = updatePreview;
    numberingCheckbox.onClick = updatePreview;
    startNumInput.onChanging = updatePreview;
    paddingInput.onChanging = updatePreview;
    suffixInput.onChanging = updatePreview;

    // Initial preview
    updatePreview();

    okBtn.onClick = function () {
        var prefix = prefixInput.text;
        var separator = separatorInput.text;
        var includeNum = numberingCheckbox.value;
        var start = parseInt(startNumInput.text, 10);
        if (isNaN(start) || start < 0) start = 1;
        var padding = parseInt(paddingInput.text, 10);
        if (isNaN(padding) || padding < 0) padding = 0;
        var suffix = suffixInput.text;

        if (!prefix && !includeNum && !suffix) {
            alert("You must provide at least one of: prefix, numbering, or suffix.");
            return;
        }

        var abCount = doc.artboards.length;
        for (var i = 0; i < abCount; i++) {
            var base = "";
            if (prefix) base += prefix;
            if (includeNum) {
                var cur = start + i;
                var numStr = cur.toString();
                if (padding > 0) {
                    while (numStr.length < padding) {
                        numStr = "0" + numStr;
                    }
                }
                if (base && separator) base += separator;
                base += numStr;
            }
            if (suffix) {
                if (base && separator) base += separator;
                base += suffix;
            }
            if (base === "") base = "Artboard " + (i + 1);
            try {
                doc.artboards[i].name = base;
            } catch (e) {}
        }

        dlg.close();
    };

    cancelBtn.onClick = function () {
        dlg.close();
    };

    dlg.center();
    dlg.show();
}
