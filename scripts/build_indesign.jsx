// voorignace: build an InDesign print file with the Figma exports (PDF) placed
// as linked graphics, one page per source file. Loaded by build.py, which defines CFG first.
// Only the document created by this script is touched and closed.
(function () {
  var log = [];
  var doc = null, tmpPreset = null;
  var prevUnits = app.scriptPreferences.measurementUnit;
  var prevUI = app.scriptPreferences.userInteractionLevel;
  var prevCrop = null;

  function writeLog() {
    var f = new File(CFG.log);
    f.encoding = "UTF-8";
    f.open("w"); f.write(log.join("\n")); f.close();
  }

  app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
  app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
  try {
    var W = CFG.width, H = CFG.height, b = CFG.bleed, n = CFG.src.length;

    doc = app.documents.add(false);
    var dp = doc.documentPreferences;
    dp.facingPages = false;
    dp.pageWidth = W; dp.pageHeight = H;
    dp.pagesPerDocument = n;
    dp.documentBleedUniformSize = true;
    dp.documentBleedTopOffset = b;
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];
    for (var m = 0; m < doc.pages.length; m++) {
      doc.pages[m].marginPreferences.properties = { top: 0, bottom: 0, left: 0, right: 0 };
    }

    var artLayer = doc.layers[0];
    artLayer.name = "Artwork";
    var bgLayer = null, bgSwatch = null;
    if (CFG.bg) {
      bgLayer = doc.layers.add({ name: "Background" });
      bgLayer.move(LocationOptions.AT_END);
      var hex = CFG.bg;
      bgSwatch = doc.colors.add({
        name: "Background " + hex, model: ColorModel.PROCESS, space: ColorSpace.RGB,
        colorValue: [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)]
      });
    }

    prevCrop = app.pdfPlacePreferences.pdfCrop;
    app.pdfPlacePreferences.pdfCrop = PDFCrop.CROP_MEDIA;

    var full = [-b, -b, H + b, W + b]; // [top, left, bottom, right]
    for (var i = 0; i < n; i++) {
      var page = doc.pages[i];
      if (bgLayer) {
        page.rectangles.add(bgLayer, undefined, undefined, {
          geometricBounds: full, fillColor: bgSwatch, strokeWeight: 0, name: "Background " + CFG.bg + " (bleed)"
        });
      }
      var frame = page.rectangles.add(artLayer, undefined, undefined, {
        geometricBounds: CFG.srcHasBleed ? full : [0, 0, H, W], strokeWeight: 0, name: CFG.labels[i]
      });
      frame.place(new File(CFG.src[i]));
      var g = frame.allGraphics[0];
      var gb = g.geometricBounds, fb = frame.geometricBounds;
      var ga = (gb[3] - gb[1]) / (gb[2] - gb[0]), fa = (fb[3] - fb[1]) / (fb[2] - fb[0]);
      if (Math.abs(ga - fa) / fa > 0.005) {
        log.push("warning: " + CFG.labels[i] + " aspect ratio differs from the trim size, artwork fitted and centred");
      }
      frame.fit(FitOptions.PROPORTIONALLY);
      frame.fit(FitOptions.CENTER_CONTENT);
    }

    doc = doc.save(new File(CFG.work));
    log.push("ok working file " + CFG.work + " | " + n + " page(s) " + W + " x " + H + " mm" +
      (b > 0 ? ", bleed " + b + " mm" : "") + ", artwork linked from Links/");

    if (CFG.pdf) {
      var base = app.pdfExportPresets.itemByName(CFG.preset);
      if (!base.isValid) throw new Error("PDF preset not found in InDesign: " + CFG.preset);
      tmpPreset = app.pdfExportPresets.add({ name: "voorignace temp " + new Date().getTime() });
      var props = base.properties;
      for (var k in props) {
        if (k == "name" || k == "parent" || k == "index" || k == "id" || k == "isValid" || k == "properties" || k == "eventListeners") continue;
        try { tmpPreset[k] = props[k]; } catch (e) {}
      }
      tmpPreset.useDocumentBleedWithPDF = b > 0;
      tmpPreset.cropMarks = !!CFG.marks;
      tmpPreset.bleedMarks = false; tmpPreset.registrationMarks = false;
      tmpPreset.colorBars = false; tmpPreset.pageInformationMarks = false;
      if (CFG.marks) {
        try { tmpPreset.cropMarkWeight = PDFMarkWeight.P25PT; } catch (e) {}
        try { tmpPreset.pageMarksOffset = Math.min(Math.max(b, 2.117), 25.4); } catch (e) {}
      }
      doc.exportFile(ExportFormat.PDF_TYPE, new File(CFG.pdf), false, tmpPreset);
      log.push("ok pdf " + CFG.pdf + " | " + CFG.preset + (CFG.marks ? ", crop marks" : ", no marks"));
    }
    doc.close(SaveOptions.NO); doc = null;
  } catch (e) {
    log.push("error: " + e.message + (e.line ? " (line " + e.line + ")" : ""));
    try { if (doc) doc.close(SaveOptions.NO); } catch (e2) {}
  }
  try { if (tmpPreset && tmpPreset.isValid) tmpPreset.remove(); } catch (e) {}
  try { if (prevCrop !== null) app.pdfPlacePreferences.pdfCrop = prevCrop; } catch (e) {}
  app.scriptPreferences.measurementUnit = prevUnits;
  app.scriptPreferences.userInteractionLevel = prevUI;
  writeLog();
})();
