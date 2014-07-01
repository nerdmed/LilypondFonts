//
// LilypondFonts
//

var util = require('util'),
  fs = require('fs'),
  async = require('waterfall'),
  parser = require('libxml-to-js');

(function () {
  "use strict";

  if (process.argv.length <= 2) {
    console.error('Usage: node LilypondFonts.js glyphnames.json font_directory [whileListFile]');
    process.exit(1);
  }

  var METADATA_RELATIVE_PATH = '/metadata.json';
  var FONT_RELATIVE_PATH = '/font.svg';

  var output = {
    glyphs: {}
  };
  var fontDirectory = process.argv[2];
  var metadataPath = fontDirectory + METADATA_RELATIVE_PATH;
  var fontPath = fontDirectory + FONT_RELATIVE_PATH;
  var glyphNamesPath = process.argv[3];
  var whileListPath = process.argv[4];

  var fillMetaData = function (output, metadata, callback) {
    output.engravingDefaults = metadata.engravingDefaults;
    output.fontName = metadata.fontName;
    output.fontVersion = metadata.fontVersion;

    var sectionsToCopy = ['glyphBBoxes', 'glyphsWithAnchors'];
    for (var i = 0; i < sectionsToCopy.length; i++) {
      var sectionName = sectionsToCopy[i];
      var sectionToCopy = metadata[i];
      for (var glyphName in output) {
        var glyphMetadata = sectionToCopy[glyphName];
        if (typeof glyphMetadata === 'undefined') {
          var msg = 'glyph name ' + glyphName +
            ' is not present inside the ' + sectionName + 'meta-data section';
          return callback(new Error(msg));
        } else {
          var glyphData = output[glyphName];
          shallowExtend(glyphMetadata, glyphMetadata);
        }
      }
    }

    callback(null, output);
  };

  var shallowExtend = function (objToExtend, src) {
    for (var prop in src) {
      if (src.hasOwnProperty(src)) {
        objToExtend[prop] = src[prop];
      }
    }
  };

  var fillSvgPath = function (output, svgData, callback) {
    if (!svgData.defs || !svgData.defs.font || !svgData.defs.font.glyph) {
      callback(new Error('This XML is not a valid music font'));
    } else {
      output.meta = svgData.defs.font['font-face']['@'];

      var glyphSvgs = svgData.defs.font.glyph;
      glyphSvgs = indexArray(indexArray, function (svgGlyph) {
        return svgGlyph['@']['glyph-name'];
      });

      for (var glyphName in output.glyphs) {
        var glyph = output[glyphName];
        var codepoint = glyph.codepoint;
        codepoint = codepoint.replace(/^U\+/, 'uni');
        var glyphSvg = glyphSvgs[codepoint];
        glyph.path = glyphSvg['@'].d;
      }
    }
  };

  var indexArray = function (array, getId) {
    var index = {};
    array.forEach(function (item) {
      var id = getId(item);
      index[id] = item;
    });
    return index;
  };

  var loadFilteredGlyphNames = function (glyphNamesPath, whiteListPath, callback) {
    var parallelTasks = {
      glyphNames: loadAndParseJson.bind(null, glyphNamesPath)
    };
    if (whiteListPath) {
      parallelTasks.whiteList = loadAndParseJson.bind(null, whiteListPath);
    }
    async.parallel(
      parallelTasks,
      function (err, results) {
        if (err) {
          callback(err);
        } else if (results.whiteList) {
          filterMainGlyphes(results.glyphNames, results.whiteList, callback);
        } else {
          callback(null, results.glyphNames);
        }
      }
    );
  };

  var filterAlternativeGlyphes = function (output, glyphsWithAlternates, whiteList, callback) {
    var filteredGlyphsWithAlternates = filterProperties(glyphsWithAlternates, output);
    var alternatesGlyphes = flattenProperties(filteredGlyphsWithAlternates);
    var filteredAlternatesGlyphes = filterProperties(alternatesGlyphes, whiteList);

    for (var glyphName in whiteList.alternateGlyphes) {
      if (typeof filteredAlternatesGlyphes[glyphName] !== 'undefined') {
        output[glyphName] = filteredAlternatesGlyphes[glyphName];
      } else {
        console.log('the alternate glyph ' + glyphName + ' is not inside the font metadata');
      }
    }
    callback(null, output);
  };

  var filterProperties = function (object, whiteList) {
    var filtered = {};
    for (var prop in whiteList) {
      if (typeof object[prop] !== 'undefined') {
        filtered[prop] = object[prop];
      }
    }
    return filtered;
  };

  var flattenProperties = function (src) {
    var dest = {};
    for (var sectionName in src) {
      var section = src[sectionName];
      for (var prop in section) {
        dest[prop] = section[prop];
      }
    }
    return dest;
  };

  var filterMainGlyphes = function (glyphNames, whiteList, callback) {
    var filteredGlyphNames = {};
    for (var glyphName in whiteList.mainGlyphes) {
      if (typeof glyphNames[glyphName] === 'undefined') {
        return callback(new Error('the glyph ' + glyphName + 'from the white list is not defined in glyphnames.json'));
      } else {
        filteredGlyphNames[filteredGlyphNames] = glyphNames[glyphName];
      }
    }
    callback(null, filteredGlyphNames);
  };


  var loadAndParseJson = function (path, callback) {
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

  var loadAndParseXml = function (path, callback) {
    async.waterfall([

      function loadFile(callback) {
        fs.readFile(path, 'utf-8', callback);
      },
      parser
    ], callback);
  };


  util.puts(JSON.stringify(output)); // je me le garde sous le coude..

}).call(this);
