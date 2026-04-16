/* StrideUp_AutoProject.jsx (Startup)
    - Version 14.0 : Dossiers Bleus (index 8) + Comps couleur unique intelligente
    - Alignement parfait des colonnes & Sécurité Media Encoder
*/

(function () {
    // 1. SÉCURITÉ MÉDIA ENCODER
    if (typeof BridgeTalk === "undefined" || BridgeTalk.appName !== "aftereffects" || typeof Window === "undefined") return;

    function run() {
        try {
            if (typeof app === "undefined" || !app.project || app.isBackground) return;
            if (app.project.items.length > 1) return;

            var FPS = 30;
            var DURATION = 15;
            var LBL_W = 130;  
            var EDIT_W = 310;
            var FOLDER_COLOR = 8; // Couleur fixe pour l'arborescence (8 = Bleu)

            function clean(s) {
                s = (s || "").replace(/^\s+|\s+$/g, "");
                return s ? s.replace(/[\/]/g, "-").replace(/[\\:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_") : "";
            }

            // TROUVE UNE COULEUR DE COMP UNIQUE (Différente du bleu et de l'existant)
            function getUniqueCompLabel(folderColorId) {
                var usedLabels = {};
                usedLabels[folderColorId] = true; // On interdit la couleur des dossiers pour les comps

                // On scanne tout le projet pour voir ce qui est déjà pris
                for (var i = 1; i <= app.project.items.length; i++) {
                    var item = app.project.items[i];
                    if (item.label !== 0) usedLabels[item.label] = true;
                }

                var available = [];
                for (var j = 1; j <= 16; j++) {
                    if (!usedLabels[j]) available.push(j);
                }

                // On pioche dans les couleurs libres
                if (available.length > 0) {
                    return available[Math.floor(Math.random() * available.length)];
                }
                // Si tout est pris, on évite juste la couleur des dossiers
                var fallback = Math.floor(Math.random() * 15) + 1;
                return (fallback >= folderColorId) ? fallback + 1 : fallback;
            }

            var d = new Date();
            var ymStr = d.getFullYear() + "_" + ((d.getMonth() + 1) < 10 ? "0" + (d.getMonth() + 1) : (d.getMonth() + 1));

            // --- INTERFACE ---
            var w = new Window("dialog", "Stride-up – Nouvelle vidéo");
            w.orientation = "column"; w.alignChildren = ["fill", "top"]; w.spacing = 10; w.margins = 16;

            function addRow(parent, label) {
                var g = parent.add("group");
                g.alignment = "left";
                var st = g.add("statictext", undefined, label);
                st.preferredSize.width = LBL_W;
                var ed = g.add("edittext", undefined, "");
                ed.preferredSize.width = EDIT_W;
                return { group: g, edit: ed };
            }

            var gYM = w.add("group");
            gYM.alignment = "left";
            gYM.add("statictext", undefined, "ANNEE_MOIS").preferredSize.width = LBL_W;
            gYM.add("statictext", undefined, ymStr);

            var edClient = addRow(w, "CLIENT").edit;
            var gType = w.add("group");
            gType.alignment = "left";
            gType.add("statictext", undefined, "TYPE").preferredSize.width = LBL_W;
            var ddType = gType.add("dropdownlist", undefined, ["VIDEO", "GIF", "MOTION"]);
            ddType.preferredSize.width = EDIT_W; ddType.selection = 0;

            var edConcept = addRow(w, "CONCEPT").edit;
            var rowActeur = addRow(w, "CREATEUR/RICE");
            var rowHook = addRow(w, "NOM-HOOK");
            var edDesc = addRow(w, "DESCRIPTION").edit;

            var pFmt = w.add("panel", undefined, "Formats à créer");
            pFmt.orientation = "row"; pFmt.spacing = 30; pFmt.margins = 15;
            var cb916 = pFmt.add("checkbox", undefined, "9-16"); cb916.value = true;
            var cb45  = pFmt.add("checkbox", undefined, "4-5");  cb45.value = true;
            var cb11  = pFmt.add("checkbox", undefined, "1-1");  cb11.value = true;
            var cb169 = pFmt.add("checkbox", undefined, "16-9"); cb169.value = false;

            var pPrev = w.add("panel", undefined, "Aperçus des nomenclatures");
            pPrev.alignChildren = "left"; pPrev.spacing = 5;
            function addPrev(parent) {
                var ed = parent.add("edittext", undefined, "", {readonly: true});
                ed.preferredSize.width = 440; return ed;
            }
            var pr9 = addPrev(pPrev); var pr4 = addPrev(pPrev);
            var pr1 = addPrev(pPrev); var pr6 = addPrev(pPrev);

            function refreshUI() {
                var isUGC = (edConcept.text.toUpperCase() === "UGC");
                rowActeur.group.visible = rowHook.group.visible = isUGC;

                function build(fmt) {
                    var p = [ymStr, clean(edClient.text), ddType.selection.text];
                    if (isUGC) { p.push("UGC", clean(rowActeur.edit.text), "HOOK", clean(rowHook.edit.text)); }
                    else { p.push(clean(edConcept.text)); }
                    p.push(clean(edDesc.text), fmt);
                    return p.join("_").replace(/_+/g, "_");
                }

                pr9.text = build("9-16"); pr9.visible = cb916.value;
                pr4.text = build("4-5");  pr4.visible  = cb45.value;
                pr1.text = build("1-1");  pr1.visible  = cb11.value;
                pr6.text = build("16-9"); pr6.visible = cb169.value;
                w.layout.layout(true);
            }

            edConcept.onChanging = refreshUI;
            edClient.onChanging = edDesc.onChanging = rowActeur.edit.onChanging = rowHook.edit.onChanging = refreshUI;
            cb916.onClick = cb45.onClick = cb11.onClick = cb169.onClick = ddType.onChange = refreshUI;

            var gBtn = w.add("group"); gBtn.alignment = "right";
            var btnC = gBtn.add("button", undefined, "Annuler");
            var btnO = gBtn.add("button", undefined, "Créer", { name: "ok" });
            btnC.onClick = function () { w.close(0); };
            btnO.onClick = function () { w.close(1); };

            refreshUI();
            if (w.show() !== 1) return;

            // --- CRÉATION ---
            var compColor = getUniqueCompLabel(FOLDER_COLOR);
            var conceptStr = clean(edConcept.text);
            var isUGCF = (conceptStr.toUpperCase() === "UGC");

            app.beginUndoGroup("Stride-up: Init Project");
            
            function buildFinal(fmt) {
                var p = [ymStr, clean(edClient.text), ddType.selection.text];
                if (isUGCF) { p.push("UGC", clean(rowActeur.edit.text), "HOOK", clean(rowHook.edit.text)); }
                else { p.push(conceptStr); }
                p.push(clean(edDesc.text), fmt);
                return p.join("_").replace(/_+/g, "_");
            }

            function getF(n, p) {
                for (var i = 1; i <= app.project.items.length; i++) {
                    var item = app.project.items[i];
                    if (item instanceof FolderItem && item.name === n && item.parentFolder.id === p.id) return item;
                }
                var f = app.project.items.addFolder(n); 
                f.parentFolder = p;
                f.label = FOLDER_COLOR; // Dossiers fixés sur le BLEU (8)
                return f;
            }

            function makeC(n, p, width, height, color) {
                var c = app.project.items.addComp(n, width, height, 1.0, DURATION, FPS);
                c.parentFolder = p;
                c.label = color; // Les Comps prennent la couleur unique intelligente
                return c;
            }

            var root = app.project.rootFolder;
            var f01 = getF("01_COMPOSITIONS", root);
            var fA = getF("A_PRINCIPALES", f01);
            var fD = getF("C_DERUSH", f01);
            getF("B_PRECOMPS", f01);
            var f02 = getF("02_ASSETS", root);
            var fB = getF("B_AUDIO", f02);
            getF("A_VIDÉO", f02); getF("MUSIQUES", fB); getF("SFX", fB); getF("VO", fB);
            getF("C_CHARTE GRAPHIQUE", f02); getF("D_IMAGES", f02); getF("E_SOLIDES", f02); getF("F_SOUS-TITRES", f02);

            if (cb916.value) {
                makeC(buildFinal("9-16"), getF("9/16", fA), 1080, 1920, compColor);
                makeC(buildFinal("9-16") + "_DERUSH", fD, 1080, 1920, compColor);
            }
            if (cb45.value)  makeC(buildFinal("4-5"), getF("4/5", fA), 1080, 1350, compColor);
            if (cb11.value)  makeC(buildFinal("1-1"), getF("1/1", fA), 1080, 1080, compColor);
            if (cb169.value) makeC(buildFinal("16-9"), getF("16/9", fA), 1920, 1080, compColor);

            app.endUndoGroup();

        } catch (err) {}
    }

    app.scheduleTask("(" + run.toString() + ")();", 500, false);
})();