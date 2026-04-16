(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Resizer Pro V9", undefined, {resizeable: true});
        
        if (win !== null) {
            win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.spacing = 10; win.margins = 16;

            // --- SECTION DIMENSIONS ---
            var dimPanel = win.add("panel", undefined, "Dimensions (Top-Level uniquement)");
            dimPanel.orientation = "column"; dimPanel.alignChildren = ["left", "top"];
            var optResize = dimPanel.add("checkbox", undefined, "Changer les dimensions");
            var dimGroup = dimPanel.add("group");
            var curWidth = dimGroup.add("edittext", [0, 0, 50, 25], "1920");
            dimGroup.add("statictext", undefined, "x");
            var curHeight = dimGroup.add("edittext", [0, 0, 50, 25], "1080");
            curWidth.enabled = curHeight.enabled = optResize.value;
            optResize.onClick = function() { curWidth.enabled = curHeight.enabled = optResize.value; };

            // --- SECTION TEMPS ---
            var timePanel = win.add("panel", undefined, "Temps & Récursivité");
            timePanel.orientation = "column"; timePanel.alignChildren = ["left", "top"];
            var timeGroup = timePanel.add("group");
            timeGroup.add("statictext", undefined, "Durée (sec) :");
            var curDuration = timeGroup.add("edittext", [0, 0, 80, 25], "10");

            var optExtend = timePanel.add("checkbox", undefined, "Étendre les calques internes");
            optExtend.value = true;
            
            var optRecursive = timePanel.add("checkbox", undefined, "Appliquer aux sous-précomps (Récursif)");
            optRecursive.value = true;

            var btnApply = win.add("button", undefined, "Appliquer l'extension");

            // --- FONCTION DE TRAITEMENT DE POSITION ---
            function processPos(prop, offset) {
                if (prop.numKeys > 0) {
                    for (var k = 1; k <= prop.numKeys; k++) {
                        var val = prop.keyValue(k);
                        prop.setValueAtKey(k, (val instanceof Array) ? [val[0] + offset[0], val[1] + offset[1], (val[2] || 0)] : val + offset);
                    }
                } else {
                    var val = prop.value;
                    prop.setValue((val instanceof Array) ? [val[0] + offset[0], val[1] + offset[1], (val[2] || 0)] : val + offset);
                }
            }

            // --- FONCTION COEUR : TRAITEMENT RÉCURSIF ---
            function processCompRecursive(targetComp, newD, extendLayers, recursive) {
                targetComp.duration = newD;

                for (var j = 1; j <= targetComp.numLayers; j++) {
                    var l = targetComp.layer(j);

                    // Si c'est une pré-comp et qu'on est en mode récursif
                    if (l.source instanceof CompItem && recursive) {
                        processCompRecursive(l.source, newD, extendLayers, recursive);
                    }

                    // On étend le calque (qu'il soit une précompo ou un solide/image)
                    if (extendLayers && !l.locked) {
                        if (l.canEnableTimeRemapping) {
                            l.timeRemappingEnabled = true;
                            var tr = l.property("ADBE Time Remapping");
                            if (tr.numKeys > 1) tr.removeKey(tr.numKeys);
                        }
                        l.outPoint = newD;
                    }
                }
            }

            btnApply.onClick = function() {
                var activeComp = app.project.activeItem;
                if (!activeComp || activeComp.selectedLayers.length === 0) return alert("Sélectionne une pré-compo !");

                app.beginUndoGroup("Resizer V9 Recursive");
                
                var nW = parseInt(curWidth.text);
                var nH = parseInt(curHeight.text);
                var nD = parseFloat(curDuration.text);

                for (var i = 0; i < activeComp.selectedLayers.length; i++) {
                    var mainLayer = activeComp.selectedLayers[i];
                    if (mainLayer.source instanceof CompItem) {
                        var mainTarget = mainLayer.source;

                        // 1. GESTION DES DIMENSIONS (Uniquement sur la comp parente sélectionnée)
                        if (optResize.value) {
                            var offX = (nW - mainTarget.width) / 2;
                            var offY = (nH - mainTarget.height) / 2;
                            mainTarget.width = nW; mainTarget.height = nH;
                            
                            for (var k = 1; k <= mainTarget.numLayers; k++) {
                                var innerL = mainTarget.layer(k);
                                if (innerL.parent == null) {
                                    var p = innerL.property("ADBE Transform Group").property("ADBE Position");
                                    if (p.dimensionsSeparated) {
                                        processPos(innerL.property("ADBE Transform Group").property("ADBE Position_0"), offX);
                                        processPos(innerL.property("ADBE Transform Group").property("ADBE Position_1"), offY);
                                    } else { processPos(p, [offX, offY]); }
                                }
                            }
                        }

                        // 2. LANCEMENT DU TRAITEMENT DU TEMPS (Recursif ou non)
                        processCompRecursive(mainTarget, nD, optExtend.value, optRecursive.value);
                        
                        // Ajuster le calque dans la timeline actuelle
                        mainLayer.outPoint = mainLayer.inPoint + nD;
                    }
                }
                app.endUndoGroup();
                alert("Traitement récursif terminé !");
            };

            win.layout.layout(true);
            return win;
        }
    }

    var myWin = buildUI(thisObj);
    if (myWin instanceof Window) { myWin.center(); myWin.show(); }
})(this);