/**********************************************************************
 * Import Files AE
 * Panneau dockable pour importer un dossier en recréant toute son
 * arborescence (dossiers + sous-dossiers) dans le panneau Projet,
 * avec chaque média rangé dans le bon dossier.
 *
 *  • Ignore les dossiers vides (création paresseuse : un dossier AE
 *    n'apparaît que s'il reçoit au moins un média).
 *  • Anti-doublon : saute les fichiers déjà présents dans le projet.
 *
 * Installation : placer ce .jsx dans le dossier "ScriptUI Panels"
 *   d'After Effects, puis le lancer depuis le menu Fenêtre.
 **********************************************************************/

(function (thisObj) {

    // Extensions médias reconnues par After Effects
    var MEDIA = {
        mov:1, mp4:1, m4v:1, avi:1, mxf:1, mkv:1, mpg:1, mpeg:1, mts:1, m2ts:1,
        png:1, jpg:1, jpeg:1, tif:1, tiff:1, psd:1, ai:1, eps:1, exr:1, tga:1,
        dpx:1, gif:1, bmp:1, heic:1, webp:1, svg:1, wav:1, mp3:1, aif:1, aiff:1,
        aac:1, m4a:1, caf:1, mogrt:1
    };

    function isMedia(name) {
        var d = name.lastIndexOf(".");
        if (d < 0) return false;
        return MEDIA[name.substring(d + 1).toLowerCase()] === 1;
    }

    var stats = { imported: 0, failed: 0, folders: 0, skipped: 0 };

    // Index des fichiers déjà présents dans le projet (clé = chemin disque)
    function buildExistingIndex() {
        var idx = {};
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FootageItem && it.mainSource &&
                (it.mainSource instanceof FileSource) && it.mainSource.file) {
                idx[it.mainSource.file.fsName] = true;
            }
        }
        return idx;
    }

    // Compte récursivement les médias d'un dossier (pour la barre de progression)
    function countMedia(folder) {
        var n = 0;
        var entries = folder.getFiles();
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e instanceof Folder) n += countMedia(e);
            else if (isMedia(e.displayName || e.name)) n++;
        }
        return n;
    }

    // Petite fenêtre de progression
    function makeProgress(total) {
        var w = new Window("palette", "Import Files AE", undefined);
        w.alignChildren = ["fill", "top"];
        w.margins = 16; w.spacing = 8;
        var lbl = w.add("statictext", undefined, "Préparation…");
        lbl.preferredSize.width = 380;
        var bar = w.add("progressbar", undefined, 0, total);
        bar.preferredSize = [380, 12];
        var cnt = w.add("statictext", undefined, "0 / " + total);
        w.center(); w.show(); w.update();
        var done = 0;
        return {
            tick: function (name) {
                done++;
                bar.value = done;
                if (name.length > 46) name = name.substring(0, 43) + "…";
                lbl.text = name;
                cnt.text = done + " / " + total;
                w.update();
            },
            close: function () { w.close(); }
        };
    }

    // Tri : dossiers d'abord, puis fichiers, ordre alphabétique
    function sortEntries(entries) {
        entries.sort(function (a, b) {
            var ad = (a instanceof Folder) ? 0 : 1;
            var bd = (b instanceof Folder) ? 0 : 1;
            if (ad !== bd) return ad - bd;
            return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
        });
        return entries;
    }

    /**
     * Parcourt un dossier source. Le dossier AE n'est créé (via getParent,
     * qui crée aussi les ancêtres au besoin) que lorsqu'un média est
     * réellement ajouté → les dossiers vides ne sont jamais créés.
     */
    function importTree(srcFolder, getParent, existing, skipDup, prog) {
        var aeFolder = null;
        function ensure() {
            if (!aeFolder) {
                aeFolder = app.project.items.addFolder(srcFolder.name);
                var p = getParent();
                if (p) aeFolder.parentFolder = p;
                stats.folders++;
            }
            return aeFolder;
        }

        var entries = sortEntries(srcFolder.getFiles());
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e instanceof Folder) {
                importTree(e, ensure, existing, skipDup, prog);    // récursion paresseuse
            } else if (isMedia(e.displayName || e.name)) {
                if (prog) prog.tick(e.displayName || e.name);
                if (skipDup && existing[e.fsName]) { stats.skipped++; continue; }
                try {
                    var io = new ImportOptions(e);
                    if (io.canImportAs(ImportAsType.FOOTAGE)) io.importAs = ImportAsType.FOOTAGE;
                    var it = app.project.importFile(io);
                    it.parentFolder = ensure();
                    existing[e.fsName] = true;                     // évite un doublon dans le même run
                    stats.imported++;
                } catch (err) {
                    stats.failed++;
                }
            }
        }
    }

    // Dossier projet cible selon la sélection
    function getSelectedFolder() {
        var sel = app.project.selection;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof FolderItem) return sel[i];
        }
        return null;
    }

    function doImport(useSelection, skipDup) {
        var src = Folder.selectDialog("Choisis le dossier à importer (toute son arborescence sera recréée)");
        if (!src) return;

        stats = { imported: 0, failed: 0, folders: 0, skipped: 0 };
        var target = useSelection ? getSelectedFolder() : null;
        var existing = skipDup ? buildExistingIndex() : {};

        var total = countMedia(src);
        var prog = (total > 0) ? makeProgress(total) : null;

        app.beginUndoGroup("Import Files AE — " + src.name);
        try {
            importTree(src, function () { return target; }, existing, skipDup, prog);
        } catch (e) {
            alert("Erreur : " + e.toString(), "Import Files AE");
        }
        app.endUndoGroup();
        if (prog) prog.close();

        var msg = stats.imported + " média(s) importé(s)\n"
                + stats.folders + " dossier(s) créé(s)";
        if (stats.skipped) msg += "\n" + stats.skipped + " doublon(s) ignoré(s)";
        if (stats.failed)  msg += "\n" + stats.failed + " échec(s)";
        msg += target ? "\n→ dans le dossier « " + target.name + " »"
                      : "\n→ à la racine du projet";
        if (stats.imported === 0 && stats.skipped === 0 && stats.folders === 0)
            msg = "Aucun média trouvé dans ce dossier.";
        alert(msg, "Import Files AE");
    }

    // ---------- Interface ----------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Import Files AE", undefined, { resizeable: true });

        pal.alignChildren = ["fill", "top"];
        pal.spacing = 10;
        pal.margins = 14;

        var title = pal.add("statictext", undefined, "Importer un dossier dans le projet");
        try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 14); } catch (e) {}

        var desc = pal.add("statictext", undefined,
            "Recrée l'arborescence (dossiers + sous-dossiers) et importe\nles médias dans le bon dossier. Les dossiers vides sont ignorés.",
            { multiline: true });
        desc.preferredSize.height = 34;

        var chkSel = pal.add("checkbox", undefined, "Dans le dossier sélectionné du projet");
        chkSel.value = false;
        chkSel.helpTip = "Si coché et qu'un dossier est sélectionné dans le panneau Projet,\nl'arborescence y sera placée. Sinon : racine du projet.";

        var chkDup = pal.add("checkbox", undefined, "Sauter les fichiers déjà importés");
        chkDup.value = true;
        chkDup.helpTip = "Évite de réimporter en double les médias déjà présents dans le projet\n(pratique pour relancer sur un dossier mis à jour).";

        var btn = pal.add("button", undefined, "Choisir un dossier à importer…");
        btn.onClick = function () {
            if (app.project === null) { alert("Ouvre d'abord un projet.", "Import Files AE"); return; }
            doImport(chkSel.value, chkDup.value);
        };

        var foot = pal.add("statictext", undefined, "Astuce : relance pour ajouter d'autres dossiers.");
        try { foot.graphics.foregroundColor = foot.graphics.newPen(foot.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55, 1], 1); } catch (e) {}

        pal.layout.layout(true);
        return pal;
    }

    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }

})(this);
