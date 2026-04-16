/* StrideUp_BrandPalette_Presets.jsx
    Dockable ScriptUI Panel

    ✅ Version 22.0 : Reset synchronisé (Couleurs + Menu déroulant)
    ✅ Sécurité anti-effacement avec confirmation
    ✅ Format ultra-compact
*/

(function (thisObj) {
    var HASH_W = 15, EDIT_W = 80, BTN_SML = 30;
    var currentHexList = []; 
    var swatches = []; 

    function getStoredPresets() {
        if (app.settings.haveSetting("StrideUp_Colors", "BrandPresets")) {
            return eval(app.settings.getSetting("StrideUp_Colors", "BrandPresets"));
        }
        return {}; 
    }

    function savePresetsToPrefs(obj) {
        app.settings.saveSetting("StrideUp_Colors", "BrandPresets", obj.toSource());
    }

    function hexToVec(hex) {
        hex = hex.replace("#", "").replace(/\s/g, "");
        if (hex.length !== 6) return null;
        return [parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(2, 4), 16) / 255, parseInt(hex.substring(4, 6), 16) / 255];
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", "StrideUp Brand", undefined, {resizeable: true});
        pal.orientation = "column"; pal.alignChildren = ["left", "top"]; pal.spacing = 8; pal.margins = 10;

        // --- LIGNE 1 : Saisie et Reset ---
        var gInput = pal.add("group"); gInput.spacing = 5;
        gInput.add("statictext", undefined, "#").preferredSize.width = HASH_W; //
        var edHex = gInput.add("edittext", undefined, "F54927"); edHex.preferredSize.width = EDIT_W; //
        var btnAdd = gInput.add("button", undefined, "+"); btnAdd.preferredSize.width = BTN_SML;
        var btnReset = gInput.add("button", undefined, "↻"); btnReset.preferredSize.width = BTN_SML; //

        // --- LIGNE 2 : Menu des Presets ---
        var gPresets = pal.add("group");
        var ddPresets = gPresets.add("dropdownlist", undefined, ["— Presets —"]);
        ddPresets.selection = 0;
        ddPresets.preferredSize.width = EDIT_W + HASH_W + (BTN_SML * 2) + 15; //

        // --- LIGNE 3 : Zone des Swatches ---
        var gSwatches = pal.add("group"); gSwatches.spacing = 6; gSwatches.preferredSize.height = 45; 

        // --- LIGNE 4 : Actions de Gestion ---
        var gActions = pal.add("group"); gActions.spacing = 5;
        var btnSave = gActions.add("button", undefined, "Save preset");
        btnSave.preferredSize.width = (ddPresets.preferredSize.width / 2) + 10;
        
        var btnDel = gActions.add("button", undefined, "Delete"); 
        btnDel.preferredSize.width = (ddPresets.preferredSize.width / 2) - 5;

        // --- Logique d'affichage ---
        function drawSwatches() {
            for (var i = swatches.length - 1; i >= 0; i--) gSwatches.remove(swatches[i]);
            swatches = [];
            for (var j = 0; j < currentHexList.length; j++) {
                var vec = hexToVec(currentHexList[j]);
                if (vec) {
                    var s = gSwatches.add("panel", undefined); s.preferredSize = [40, 40]; //
                    s.graphics.backgroundColor = s.graphics.newBrush(s.graphics.BrushType.SOLID_COLOR, [vec[0], vec[1], vec[2], 1]);
                    swatches.push(s);
                }
            }
            pal.layout.layout(true);
        }

        function processAdd() {
            var val = edHex.text.replace("#", "").replace(/\s/g, "");
            if (val.length !== 6) return;
            if (currentHexList.length >= 5) currentHexList.shift(); //
            currentHexList.push(val); drawSwatches();
        }

        btnAdd.onClick = edHex.onEnterKey = processAdd; //

        // --- RESET SYNCHRONISÉ ---
        btnReset.onClick = function() { 
            currentHexList = []; 
            drawSwatches(); 
            ddPresets.selection = 0; // Remet le menu sur "— Presets —"
        };

        btnSave.onClick = function() {
            if (currentHexList.length === 0) return;
            var brandName = prompt("Nom de la marque :", "Ma Marque");
            if (!brandName) return;
            var all = getStoredPresets(); all[brandName] = currentHexList.slice();
            savePresetsToPrefs(all); updateDropdown();
        };

        btnDel.onClick = function() {
            if (ddPresets.selection.index === 0) return;
            var brandToDelete = ddPresets.selection.text;
            if (confirm("Voulez-vous vraiment supprimer le preset '" + brandToDelete + "' ?")) {
                var all = getStoredPresets();
                delete all[brandToDelete];
                savePresetsToPrefs(all);
                updateDropdown();
                currentHexList = []; 
                drawSwatches();
            }
        };

        ddPresets.onChange = function() {
            if (!this.selection || this.selection.index === 0) return;
            var all = getStoredPresets();
            currentHexList = all[this.selection.text] || [];
            drawSwatches();
        };

        function updateDropdown() {
            var all = getStoredPresets(); ddPresets.removeAll();
            ddPresets.add("item", "— Presets —");
            for (var name in all) if (all.hasOwnProperty(name)) ddPresets.add("item", name);
            ddPresets.selection = 0;
        }

        updateDropdown(); pal.layout.layout(true); return pal;
    }

    var pal = buildUI(thisObj);
    if (pal instanceof Window) pal.show();
})(this);