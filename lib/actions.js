var utils = require('./utils'),
  async = require('async'),
  parser = require('libxml-to-js'),
  fs = require('fs');

(function () {
  'use strict';

  exports.fillOutput = function (mainGlyphes, alternateGlyphes, metaData, fontSvgs, callback) {
    var output = {
      glyphs: {}
    };

    utils.shallowExtend(output.glyphs, mainGlyphes);
    utils.shallowExtend(output.glyphs, alternateGlyphes);

    try {
      fillMetaData(output, metaData);
      fillSvgPath(output, fontSvgs);
      callback(null, output);
    } catch (e) {
      callback(e);
    }
  };

  var fillMetaData = function (output, metadata) {
    output.engravingDefaults = metadata.engravingDefaults;
    output.fontName = metadata.fontName;
    output.fontVersion = metadata.fontVersion;

    var sectionsToCopy = ['glyphBBoxes', 'glyphsWithAnchors'];
    for (var i = 0; i < sectionsToCopy.length; i++) {
      var sectionName = sectionsToCopy[i];
      var sectionToCopy = metadata[sectionName];
      for (var glyphName in output.glyphs) {
        var glyphMetadata = sectionToCopy[glyphName];
        if (typeof glyphMetadata === 'undefined') {
          if (sectionName === 'glyphBBoxes') { // weird, their should be bbox data for each glyph
            var msg = 'glyph name ' + glyphName +
              ' is not present inside the ' + sectionName + ' meta-data section';
            console.warn(msg);
            delete output.glyphs[glyphName];
          }
        } else {
          var glyphData = output.glyphs[glyphName];
          utils.shallowExtend(glyphData, glyphMetadata);
        }
      }
    }
  };

  var fillSvgPath = function (output, svgData) {
    if (!svgData.defs || !svgData.defs.font || !svgData.defs.font.glyph) {
      throw new Error('This XML is not a valid music font');
    } else {
      output.meta = svgData.defs.font['font-face']['@'];

      var glyphSvgs = svgData.defs.font.glyph;
      glyphSvgs = utils.indexArray(glyphSvgs, function getId(svgGlyph) {
        return svgGlyph['@']['glyph-name'];
      });

      for (var glyphName in output.glyphs) {
        var glyph = output.glyphs[glyphName];
        var codepoint = glyph.codepoint;
        codepoint = codepoint.replace(/^U\+/, 'uni');
        if (typeof glyphSvgs[codepoint] === 'undefined') {
          var msg = 'the glyph ' + glyphName + '[' + codepoint + '] does not appear in the svg file. ';
          console.warn(msg);
          delete output.glyphs[glyphName];
        } else {
          var glyphSvg = glyphSvgs[codepoint];
          glyph.path = glyphSvg['@'].d;
        }
      }
    }
  };

  exports.filterAlternatesGlyphes = function (glyphsWithAlternates, whiteList, callback) {
    var filteredGlyphsWithAlternates;
    if (whiteList.mainGlyphes) {
      filteredGlyphsWithAlternates = utils.filterProperties(glyphsWithAlternates, whiteList.mainGlyphes);
    } else {
      filteredGlyphsWithAlternates = glyphsWithAlternates;
    }

    var alternatesGlyphes = extractAlternates(filteredGlyphsWithAlternates);

    var filteredAlternatesGlyphes;
    if (whiteList.alternateGlyphes) {
      filteredAlternatesGlyphes = {};
      for (var glyphName in whiteList.alternateGlyphes) {
        if (typeof alternatesGlyphes[glyphName] !== 'undefined') {
          filteredAlternatesGlyphes[glyphName] = alternatesGlyphes[glyphName];
        } else {
          console.log('the alternate glyph ' + glyphName + ' is not inside the font metadata');
        }
      }
    } else {
      filteredAlternatesGlyphes = alternatesGlyphes;
    }

    callback(null, filteredAlternatesGlyphes);
  };

  var extractAlternates = function (glyphsWithAlternates) {
    var alternatesGlyphs = {};
    for (var glyphName in glyphsWithAlternates) {
      var glyphWithAlternates = glyphsWithAlternates[glyphName];
      glyphWithAlternates.alternates.forEach(function (alternate) {
        alternatesGlyphs[alternate.name] = {
          codepoint: alternate.codepoint
        };
      });
    }
    return alternatesGlyphs;
  };

  exports.filterMainGlyphes = function (glyphNames, whiteList, callback) {
    var filteredGlyphNames;

    if (whiteList.mainGlyphes) {
      filteredGlyphNames = {};
      for (var glyphName in whiteList.mainGlyphes) {
        if (typeof glyphNames[glyphName] === 'undefined') {
          return callback(new Error('the glyph ' + glyphName + 'from the white list is not defined in glyphnames.json'));
        } else {
          filteredGlyphNames[filteredGlyphNames] = glyphNames[glyphName];
        }
      }
    } else {
      filteredGlyphNames = glyphNames;
    }

    callback(null, filteredGlyphNames);
  };

  exports.loadWhiteList = function (whiteListPath, callback) {
    if (whiteListPath) {
      exports.loadAndParseJson(whiteListPath, callback);
    } else {
      var whiteList = {};
      callback(null, whiteList);
    }
  };

  exports.loadAndParseJson = function (path, callback) {
    async.waterfall([

      function loadFile(callback) {
        fs.readFile(path, 'utf-8', callback);
      },
      function parseFile(data, callback) {
        try {
          var json = JSON.parse(data);
          callback(null, json);
        } catch (e) {
          if (e instanceof SyntaxError) {
            callback(e);
          } else {
            throw e;
          }
        }
      }
    ], callback);
  };

  exports.loadAndParseXml = function (path, callback) {
    async.waterfall([

      function loadFile(callback) {
        fs.readFile(path, 'utf-8', callback);
      },
      parser
    ], callback);
  };

}).call(this);
