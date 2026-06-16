/**********************************************************************
 * HDR to SDR (Rec.709)
 * Panneau dockable : convertit le(s) calque(s)/élément(s) HDR sélectionné(s)
 * en SDR Rec.709 via un vrai tone-mapping ffmpeg (zscale + tonemap),
 * réimporte le résultat et remplace la source du calque.
 *
 * Pré-requis :
 *   • Préférences > Scripts et expressions >
 *       « Autoriser les scripts à écrire des fichiers et accéder au réseau »  (coché)
 *   • Le dossier "HDR to SDR" (ffmpeg + hdr2sdr.sh) ne doit pas être déplacé.
 **********************************************************************/

(function (thisObj) {

    // --- Emplacement des outils (ffmpeg + hdr2sdr.sh) ---
    var TOOLS_DIR = "/Users/mael@stride-up.fr/Documents/Pour Claude Code/HDR to SDR";
    var SH = TOOLS_DIR + "/hdr2sdr.sh";

    // Échappe un argument pour le shell (entre guillemets doubles)
    function q(s) {
        s = String(s);
        s = s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\$/g, "\\$").replace(/`/g, "\\`");
        return '"' + s + '"';
    }

    function extFor(codec) { return (codec === "prores") ? "mov" : "mp4"; }

    function outPathFor(srcFile, codec) {
        var name = srcFile.name;
        var dot = name.lastIndexOf(".");
        var base = (dot >= 0) ? name.substring(0, dot) : name;
        return srcFile.path + "/" + base + "_SDR709." + extFor(codec);
    }

    // Récupère les sources à convertir : calques sélectionnés (compo active)
    // + éléments sélectionnés dans le panneau Projet. Renvoie une liste
    // { file: File, layers: [AVLayer...] } dédupliquée par chemin.
    function collectSources() {
        var map = {};   // fsName -> { file, layers }
        function add(item, layer) {
            if (!(item instanceof FootageItem)) return;
            if (!item.mainSource || !(item.mainSource instanceof FileSource) || !item.mainSource.file) return;
            var f = item.mainSource.file;
            var key = f.fsName;
            if (!map[key]) map[key] = { file: f, layers: [] };
            if (layer) map[key].layers.push(layer);
        }

        var ai = app.project.activeItem;
        if (ai && (ai instanceof CompItem)) {
            var sel = ai.selectedLayers;
            for (var i = 0; i < sel.length; i++) {
                if (sel[i].source) add(sel[i].source, sel[i]);
            }
        }
        var psel = app.project.selection;
        for (var j = 0; j < psel.length; j++) add(psel[j], null);

        var out = [];
        for (var k in map) if (map.hasOwnProperty(k)) out.push(map[k]);
        return out;
    }

    function makeProgress(total) {
        var w = new Window("palette", "HDR → SDR", undefined);
        w.alignChildren = ["fill", "top"]; w.margins = 16; w.spacing = 8;
        var lbl = w.add("statictext", undefined, "Préparation…"); lbl.preferredSize.width = 420;
        var bar = w.add("progressbar", undefined, 0, total); bar.preferredSize = [420, 12];
        var cnt = w.add("statictext", undefined, "0 / " + total);
        w.center(); w.show(); w.update();
        var done = 0;
        return {
            step: function (name) {
                if (name.length > 52) name = name.substring(0, 49) + "…";
                lbl.text = "Conversion : " + name; cnt.text = done + " / " + total; w.update();
            },
            tick: function () { done++; bar.value = done; w.update(); },
            close: function () { w.close(); }
        };
    }

    function run(codec, tonemap, force, replace) {
        if (!(app.project)) { alert("Ouvre un projet.", "HDR → SDR"); return; }

        var shFile = new File(SH);
        if (!shFile.exists) {
            alert("Script introuvable :\n" + SH + "\n\nLe dossier « HDR to SDR » a-t-il été déplacé ?", "HDR → SDR");
            return;
        }

        var sources = collectSources();
        if (sources.length === 0) {
            alert("Sélectionne un ou plusieurs calques (dans la compo)\nou éléments vidéo (dans le panneau Projet) à convertir.", "HDR → SDR");
            return;
        }

        // Vérifie l'accès système
        try {
            system.callSystem("/bin/echo test");
        } catch (e) {
            alert("Active d'abord :\nPréférences > Scripts et expressions >\n« Autoriser les scripts à écrire des fichiers et accéder au réseau ».", "HDR → SDR");
            return;
        }

        var prog = makeProgress(sources.length);
        var ok = 0, skipped = 0, failed = 0;
        var report = [];

        app.beginUndoGroup("HDR → SDR Rec.709");
        for (var i = 0; i < sources.length; i++) {
            var src = sources[i];
            prog.step(src.file.name);

            var cmd = "/bin/bash " + q(SH) + " -c " + codec + " -t " + tonemap +
                      (force ? " -f" : "") + " " + q(src.file.fsName) + " 2>&1";
            var result = system.callSystem(cmd);

            var outFile = new File(outPathFor(src.file, codec));
            if (outFile.exists && outFile.length > 0) {
                var imported = null;
                try {
                    var io = new ImportOptions(outFile);
                    if (io.canImportAs(ImportAsType.FOOTAGE)) io.importAs = ImportAsType.FOOTAGE;
                    imported = app.project.importFile(io);
                    // range dans le même dossier projet que la source si possible
                    if (src.file && imported && app.project.items) {
                        // (laisse à la racine, simple et prévisible)
                    }
                } catch (eImp) { imported = null; }

                if (imported && replace) {
                    for (var L = 0; L < src.layers.length; L++) {
                        try { src.layers[L].replaceSource(imported, true); } catch (eR) {}
                    }
                }
                ok++;
                report.push("✅ " + src.file.name);
            } else {
                // Pas de sortie : soit non-HDR (ignoré), soit erreur
                if (/ignor|pas HDR|semble pas HDR|⏭/.test(result)) {
                    skipped++; report.push("⏭️ " + src.file.name + " (pas détecté HDR)");
                } else {
                    failed++; report.push("❌ " + src.file.name);
                }
            }
            prog.tick();
        }
        app.endUndoGroup();
        prog.close();

        var msg = ok + " converti(s) en SDR Rec.709";
        if (skipped) msg += "\n" + skipped + " ignoré(s) (non HDR — coche « Forcer » si besoin)";
        if (failed)  msg += "\n" + failed + " échec(s)";
        msg += "\n\n" + report.join("\n");
        alert(msg, "HDR → SDR");
    }

    // ---------- Interface ----------
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", "HDR to SDR", undefined, { resizeable: true });
        pal.alignChildren = ["fill", "top"]; pal.spacing = 9; pal.margins = 14;

        var title = pal.add("statictext", undefined, "HDR → SDR (Rec.709)");
        try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 14); } catch (e) {}

        var desc = pal.add("statictext", undefined,
            "Tone-mapping ffmpeg sur le(s) calque(s) sélectionné(s).\nRéimporte le résultat et remplace la source.",
            { multiline: true });
        desc.preferredSize.height = 32;

        var row1 = pal.add("group"); row1.alignment = ["fill", "top"];
        row1.add("statictext", undefined, "Codec :");
        var ddCodec = row1.add("dropdownlist", undefined, ["ProRes 422 HQ", "H.264", "H.265"]);
        ddCodec.selection = 0; ddCodec.alignment = ["fill", "center"];

        var row2 = pal.add("group"); row2.alignment = ["fill", "top"];
        row2.add("statictext", undefined, "Tone-map :");
        var ddTone = row2.add("dropdownlist", undefined, ["hable", "mobius", "reinhard"]);
        ddTone.selection = 0; ddTone.alignment = ["fill", "center"];

        var chkReplace = pal.add("checkbox", undefined, "Remplacer la source du calque");
        chkReplace.value = true;
        var chkForce = pal.add("checkbox", undefined, "Forcer même si non détecté HDR");
        chkForce.value = false;

        var btn = pal.add("button", undefined, "Convertir la sélection");
        btn.onClick = function () {
            var codec = ["prores", "h264", "h265"][ddCodec.selection.index];
            var tone = ddTone.selection.text;
            run(codec, tone, chkForce.value, chkReplace.value);
        };

        var foot = pal.add("statictext", undefined, "Sélectionne des calques (compo) ou des vidéos (Projet).");
        try { foot.graphics.foregroundColor = foot.graphics.newPen(foot.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55, 1], 1); } catch (e) {}

        pal.layout.layout(true);
        return pal;
    }

    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) { myPanel.center(); myPanel.show(); }

})(this);
