/* StrideUp_AddVideo_Panel.jsx
    Dockable ScriptUI Panel (Window > ...)

    ✅ Version 12.0 : Couleur aléatoire excluant UNIQUEMENT les couleurs de compositions existantes
    ✅ Alignement Pixel-Perfect (130px / 310px) - Miroir du Startup
    ✅ Couleur unique pour tous les formats créés en une session
*/

(function (thisObj) {

    // ---------------- helpers ----------------
    function clean(s) {
        s = (s || "").replace(/^\s+|\s+$/g, "");
        return s ? s.replace(/[\/]/g, "-").replace(/[\\:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_") : "";
    }

    function pad2(n) { return (n < 10) ? ("0" + n) : ("" + n); }
    function currentYearMonth() {
        var d = new Date();
        return { yyyy: d.getFullYear(), mm: pad2(d.getMonth() + 1) };
    }

    function joinParts(parts) {
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] !== null && parts[i] !== undefined && parts[i] !== "") out.push(parts[i]);
        }
        return out.join("_").replace(/_+/g, "_");
    }

    var FORMATS = {
        "9-16": { w: 1080, h: 1920, folderName: "9/16" },
        "4-5":  { w: 1080, h: 1350, folderName: "4/5" },
        "1-1":  { w: 1080, h: 1080, folderName: "1/1" },
        "16-9": { w: 1920, h: 1080, folderName: "16/9" }
    };

    var FPS = 30;
    var DURATION = 15;
    var LBL_W = 130; // Aligné sur Startup v9.0
    var EDIT_W = 310; // Aligné sur Startup v9.0

    // ---------------- project item helpers ----------------
    function findItemByNameInParent(name, parent, kind) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (!it) continue;
            if (it.name === name && it.parentFolder === parent) {
                if (kind === "folder" && it instanceof FolderItem) return it;
                if (kind === "comp" && it instanceof CompItem) return it;
            }
        }
        return null;
    }

    function ensureFolder(name, parent) {
        var f = findItemByNameInParent(name, parent, "folder");
        if (f) return f;
        f = app.project.items.addFolder(name);
        f.parentFolder = parent;
        return f;
    }

    // FONCTION POUR TROUVER UNE COULEUR NON UTILISÉE PAR UNE COMPOSITION
    function getUnusedCompLabelIndex() {
        var usedLabels = {};
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            // On vérifie UNIQUEMENT les compositions existantes
            if (item instanceof CompItem) {
                var label = item.label;
                if (label !== 0) usedLabels[label] = true;
            }
        }

        var availableLabels = [];
        for (var j = 1; j <= 16; j++) {
            if (!usedLabels[j]) availableLabels.push(j);
        }

        if (availableLabels.length > 0) {
            return availableLabels[Math.floor(Math.random() * availableLabels.length)];
        }
        return Math.floor(Math.random() * 16) + 1;
    }

    function createComp(name, parentFolder, w, h, labelIndex) {
        var c = app.project.items.addComp(name, w, h, 1.0, DURATION, FPS);
        c.parentFolder = parentFolder;
        c.label = labelIndex;
        return c;
    }

    function ensureMonthlyTree(selectedFormats) {
        var root = app.project.rootFolder;
        var f01 = ensureFolder("01_COMPOSITIONS", root);
        var fA = ensureFolder("A_PRINCIPALES", f01);
        var bins = {};
        for (var k in selectedFormats) {
            if (selectedFormats[k] === true) bins[k] = ensureFolder(FORMATS[k].folderName, fA);
        }
        ensureFolder("B_PRECOMPS", f01);
        var derush = ensureFolder("C_DERUSH", f01);

        var f02 = ensureFolder("02_ASSETS", root);
        ensureFolder("A_VIDÉO", f02);
        var bAudio = ensureFolder("B_AUDIO", f02);
        ensureFolder("MUSIQUES", bAudio); ensureFolder("SFX", bAudio); ensureFolder("VO", bAudio);
        ensureFolder("C_CHARTE GRAPHIQUE", f02);
        ensureFolder("D_IMAGES", f02);
        ensureFolder("E_SOLIDES", f02);
        ensureFolder("F_SOUS-TITRES", f02);

        return { bins: bins, derush: derush };
    }

    // ---------------- UI ----------------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Stride-up – Nouvelle vidéo", undefined, { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 10;
        pal.margins = 16;

        var ym = currentYearMonth();
        var ymStr = ym.yyyy + "_" + ym.mm;

        var gYM = pal.add("group");
        gYM.alignment = "left";
        gYM.add("statictext", undefined, "ANNEE_MOIS").preferredSize.width = LBL_W;
        gYM.add("statictext", undefined, ymStr);

        function addRow(parent, label) {
            var g = parent.add("group");
            g.alignment = "left";
            var st = g.add("statictext", undefined, label);
            st.preferredSize.width = LBL_W;
            var ed = g.add("edittext", undefined, "");
            ed.preferredSize.width = EDIT_W;
            return { group: g, edit: ed };
        }

        var edClient = addRow(pal, "CLIENT").edit;
        
        var gType = pal.add("group");
        gType.alignment = "left";
        gType.add("statictext", undefined, "TYPE").preferredSize.width = LBL_W;
        var ddType = gType.add("dropdownlist", undefined, ["VIDEO", "GIF", "MOTION"]);
        ddType.preferredSize.width = EDIT_W; ddType.selection = 0;

        var edConcept = addRow(pal, "CONCEPT").edit;

        var rowActeur = addRow(pal, "CREATEUR/RICE");
        var rowHook = addRow(pal, "NOM-HOOK");

        var edDesc = addRow(pal, "DESCRIPTION").edit;

        var pFmt = pal.add("panel", undefined, "Formats à créer");
        pFmt.orientation = "row"; pFmt.spacing = 30; pFmt.margins = 15;
        var cb916 = pFmt.add("checkbox", undefined, "9-16"); cb916.value = true;
        var cb45  = pFmt.add("checkbox", undefined, "4-5");  cb45.value = true;
        var cb11  = pFmt.add("checkbox", undefined, "1-1");  cb11.value = true;
        var cb169 = pFmt.add("checkbox", undefined, "16-9"); cb169.value = false;

        var pPrev = pal.add("panel", undefined, "Aperçus des nomenclatures");
        pPrev.alignChildren = "left"; pPrev.spacing = 5;
        function addPrevField() {
            var ed = pPrev.add("edittext", undefined, "", {readonly: true});
            ed.preferredSize.width = 440; return ed;
        }
        var pr9 = addPrevField(); var pr4 = addPrevField();
        var pr1 = addPrevField(); var pr6 = addPrevField();

        function refreshUI() {
            var isUGC = (edConcept.text.toUpperCase() === "UGC");
            rowActeur.group.visible = isUGC;
            rowHook.group.visible = isUGC;

            function build(fmt) {
                var p = [ymStr, clean(edClient.text), ddType.selection ? ddType.selection.text : ""];
                if (isUGC) { p.push("UGC", clean(rowActeur.edit.text), "HOOK", clean(rowHook.edit.text)); }
                else { p.push(clean(edConcept.text)); }
                p.push(clean(edDesc.text), fmt);
                return joinParts(p);
            }

            pr9.text = build("9-16"); pr9.visible = cb916.value;
            pr4.text = build("4-5");  pr4.visible  = cb45.value;
            pr1.text = build("1-1");  pr1.visible  = cb11.value;
            pr6.text = build("16-9"); pr6.visible = cb169.value;
            pal.layout.layout(true);
        }

        edClient.onChanging = edConcept.onChanging = edDesc.onChanging = 
        rowActeur.edit.onChanging = rowHook.edit.onChanging = refreshUI;
        cb916.onClick = cb45.onClick = cb11.onClick = cb169.onClick = ddType.onChange = refreshUI;

        var gBtn = pal.add("group");
        gBtn.alignment = "right";
        var btnReset = gBtn.add("button", undefined, "Reset");
        var btnCreate = gBtn.add("button", undefined, "Créer");

        btnReset.onClick = function () {
            edClient.text = edConcept.text = edDesc.text = rowActeur.edit.text = rowHook.edit.text = "";
            cb916.value = cb45.value = cb11.value = true; cb169.value = false;
            refreshUI();
        };

        btnCreate.onClick = function () {
            var selected = { "9-16": cb916.value, "4-5": cb45.value, "1-1": cb11.value, "16-9": cb169.value };
            var isUGC = (edConcept.text.toUpperCase() === "UGC");
            
            if (isUGC && (!rowActeur.edit.text || !rowHook.edit.text)) {
                alert("Si CONCEPT = UGC, CREATEUR/RICE et NOM-HOOK sont obligatoires.");
                return;
            }

            app.beginUndoGroup("StrideUp: Add Video");
            
            // On cherche une couleur non utilisée par les COMPS
            var sharedColor = getUnusedCompLabelIndex();
            
            var tree = ensureMonthlyTree(selected);

            for (var fKey in selected) {
                if (selected[fKey]) {
                    var fmt = FORMATS[fKey];
                    var name = (function(){
                        var p = [ymStr, clean(edClient.text), ddType.selection.text];
                        if (isUGC) { p.push("UGC", clean(rowActeur.edit.text), "HOOK", clean(rowHook.edit.text)); }
                        else { p.push(clean(edConcept.text)); }
                        p.push(clean(edDesc.text), fKey);
                        return joinParts(p);
                    })();
                    createComp(name, tree.bins[fKey], fmt.w, fmt.h, sharedColor);
                }
            }

            if (selected["9-16"]) {
                var derushName = pr9.text + "_DERUSH";
                createComp(derushName, tree.derush, 1080, 1920, sharedColor);
            }

            app.endUndoGroup();
        };

        refreshUI();
        pal.onResizing = pal.onResize = function () { this.layout.resize(); };
        return pal;
    }

    var pal = buildUI(thisObj);
    if (pal instanceof Window) { pal.center(); pal.show(); }

})(this);