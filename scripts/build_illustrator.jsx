// voorignace: build an Illustrator print file from Figma SVG (or PDF/AI) exports.
// Loaded by build.py, which defines CFG first. One artboard per source file.
// Only documents created or opened by this script are touched and closed.
(function () {
  var MM = 72 / 25.4;
  var log = [];
  var doc = null, srcDoc = null;
  var prevUI = app.userInteractionLevel;

  function writeLog() {
    var f = new File(CFG.log);
    f.encoding = "UTF-8";
    f.open("w"); f.write(log.join("\n")); f.close();
  }

  function cmykFromHex(hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var v;
    try {
      v = app.convertSampleColor(ImageColorSpace.RGB, [r, g, b], ImageColorSpace.CMYK, ColorConvertPurpose.defaultpurpose);
    } catch (e) {
      var rr = r / 255, gg = g / 255, bb = b / 255, k = 1 - Math.max(rr, gg, bb);
      v = k >= 1 ? [0, 0, 0, 100] : [(1 - rr - k) / (1 - k) * 100, (1 - gg - k) / (1 - k) * 100, (1 - bb - k) / (1 - k) * 100, k * 100];
    }
    var c = new CMYKColor();
    c.cyan = v[0]; c.magenta = v[1]; c.yellow = v[2]; c.black = v[3];
    return c;
  }

  function moveAllInto(container, group) {
    // Move every top-level item of a layer (and its sublayers) into group, keeping stacking order.
    for (var s = container.layers.length - 1; s >= 0; s--) moveAllInto(container.layers[s], group);
    container.locked = false; container.visible = true;
    for (var k = container.pageItems.length - 1; k >= 0; k--) {
      var it = container.pageItems[k];
      if (it === group || it.parent !== container) continue;
      try { it.locked = false; } catch (e) {}
      it.move(group, ElementPlacement.PLACEATBEGINNING);
    }
  }

  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
  try {
    var W = CFG.width * MM, H = CFG.height * MM, GAP = 20 * MM, n = CFG.src.length;
    var b = CFG.bleed * MM;
    var bpt = Math.round(b); // Illustrator stores document bleed in whole points

    doc = app.documents.add(DocumentColorSpace.CMYK, W, H, n);
    for (var i = 0; i < n; i++) {
      doc.artboards[i].artboardRect = [i * (W + GAP), 0, i * (W + GAP) + W, -H];
      doc.artboards[i].name = CFG.labels[i] || (CFG.name + " " + (i + 1));
    }
    if (CFG.bleed > 0) {
      try { doc.documentBleedLink = true; doc.documentBleedOffset = [bpt, bpt, bpt, bpt]; }
      catch (e) { log.push("note: document bleed setting not available, bleed is set in the PDF export only"); }
    }
    var artLayer = doc.layers[0];
    artLayer.name = "Artwork";
    var bgLayer = null;
    if (CFG.bg) {
      bgLayer = doc.layers.add();
      bgLayer.name = "Background";
      bgLayer.zOrder(ZOrderMethod.SENDTOBACK);
    }

    for (var j = 0; j < n; j++) {
      var ab = doc.artboards[j].artboardRect; // [left, top, right, bottom]
      var tw = CFG.srcHasBleed ? W + 2 * b : W, th = CFG.srcHasBleed ? H + 2 * b : H;
      var tcx = ab[0] + W / 2, tcy = ab[1] - H / 2;

      srcDoc = app.open(new File(CFG.src[j]));
      var sab = srcDoc.artboards[0].artboardRect;
      var sw = sab[2] - sab[0], sh = sab[1] - sab[3];
      var grp = srcDoc.layers[0].groupItems.add();
      moveAllInto(srcDoc, grp);
      // Reference rectangle = the source artboard (the Figma frame). Used to scale and place exactly,
      // because clipped groups can report bounds larger than what is visible.
      var ref = grp.pathItems.rectangle(sab[1], sab[0], sw, sh);
      ref.filled = false; ref.stroked = false; ref.name = "__voorignace_ref";

      var dup = grp.duplicate(artLayer, ElementPlacement.PLACEATEND);
      srcDoc.close(SaveOptions.DONOTSAVECHANGES); srcDoc = null;

      var sx = tw / sw, sy = th / sh, sc = Math.min(sx, sy) * 100;
      if (Math.abs(sx - sy) / Math.max(sx, sy) > 0.005) {
        log.push("warning: " + CFG.labels[j] + " aspect ratio differs from the trim size, artwork fitted and centred (" +
          (sw / MM).toFixed(1) + " x " + (sh / MM).toFixed(1) + " source units)");
      }
      dup.resize(sc, sc, true, true, true, true, sc, Transformation.CENTER);
      var r = dup.pathItems.getByName("__voorignace_ref");
      var gb = r.geometricBounds;
      dup.translate(tcx - (gb[0] + gb[2]) / 2, tcy - (gb[1] + gb[3]) / 2);
      r.remove();
      dup.name = CFG.labels[j];

      if (bgLayer) {
        var bgRect = bgLayer.pathItems.rectangle(ab[1] + b, ab[0] - b, W + 2 * b, H + 2 * b);
        bgRect.stroked = false; bgRect.filled = true; bgRect.fillColor = cmykFromHex(CFG.bg);
        bgRect.name = "Background " + CFG.bg + " (bleed)";
      }
    }

    var aiOpts = new IllustratorSaveOptions();
    aiOpts.pdfCompatible = true;
    doc.saveAs(new File(CFG.work), aiOpts);
    log.push("ok working file " + CFG.work + " | " + n + " artboard(s) " + CFG.width + " x " + CFG.height + " mm, CMYK" +
      (CFG.bleed > 0 ? ", bleed " + (bpt / MM).toFixed(2) + " mm" : ""));

    if (CFG.pdf) {
      var found = false, list = app.PDFPresetsList;
      for (var p = 0; p < list.length; p++) if (list[p] == CFG.preset) found = true;
      if (!found) throw new Error("PDF preset not found in Illustrator: " + CFG.preset);
      var o = new PDFSaveOptions();
      o.pDFPreset = CFG.preset;
      o.viewAfterSaving = false;
      o.preserveEditability = false;
      o.registrationMarks = false; o.colorBars = false; o.pageInformation = false;
      o.trimMarks = !!CFG.marks;
      if (CFG.marks) {
        o.trimMarkWeight = PDFTrimMarkWeight.TRIMMARKWEIGHT025;
        try { o.offset = Math.max(bpt, 6); } catch (e) {}
      }
      o.bleedLink = false;
      o.bleedOffsetRect = [bpt, bpt, bpt, bpt];
      doc.saveAs(new File(CFG.pdf), o);
      log.push("ok pdf " + CFG.pdf + " | " + CFG.preset + (CFG.marks ? ", crop marks" : ", no marks"));
    }
    doc.close(SaveOptions.DONOTSAVECHANGES); doc = null;
  } catch (e) {
    log.push("error: " + e.message + (e.line ? " (line " + e.line + ")" : ""));
    try { if (srcDoc) srcDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
    try { if (doc) doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e3) {}
  }
  app.userInteractionLevel = prevUI;
  writeLog();
})();
