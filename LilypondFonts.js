//
// LilypondFonts
//

var fs = require('fs'),
  path = require('path'),
  console = require('console'),
  os = require('os'),
  async = require('waterfall'),
  parser = require('libxml-to-js'),
  yargs = require('yargs');

(function () {
  "use strict";

  var METADATA_RELATIVE_PATH = 'metadata.json';
  var FONT_RELATIVE_PATH = 'font.svg';
  var FILE_MODE = 1204; // 0644

  yargs.alias('f', 'font');
  yargs.alias('m', 'metadata');
  yargs.alias('o', 'output');
  yargs.alias('w', 'whiteList');
  yargs.alias('i', 'indent');
  yargs.demand(['f', 'm', 'o']);
  yargs.describe({
    'f': 'The font folder',
    'm': 'The SMuFL `glyphnames.json` file',
    'o': 'Path to the output file',
    'w': 'optional path to a white list file to filter glyphes to include in the output',
    'i': 'optional indent value for pretty print'
  });

  var usageMsg = 'Convert a SMuFL font to a json file to be used by Adagio music library' + os.EOL +
    'The font folder must contains 2 files:' + os.EOL +
    ' - ' + FONT_RELATIVE_PATH + ', an xml file containing the svg paths' + os.EOL +
    ' - ' + METADATA_RELATIVE_PATH + ', a json file containing the font metadata';
  yargs.usage(usageMsg);
  yargs.example('$0 -f ./bravura-1.02 -o ./smufl-metadata-1.0/glyphnames.json -o ./fonts/bravura.json -w ./filter/whiteList.json -i 2', 'generate a formatted json using a filter');

  var argv = yargs.argv;

  var fontDirectory = argv.f;
  var metadataPath = fontDirectory + path.sep + METADATA_RELATIVE_PATH;
  var fontPath = fontDirectory + path.sep + FONT_RELATIVE_PATH;
  var glyphNamesPath = argv.m;
  var whiteListPath = argv.w;
  var outputPath = argv.o;
  var indentValue = argv.i;

  async.auto({
    whiteList: function (callback) {
      loadWhiteList(whiteListPath, callback);
    },
    mainGlyphes: function (callback) {
      loadAndParseJson(glyphNamesPath, callback);
    },
    metaData: function (callback) {
      loadAndParseJson(metadataPath, callback);
    },
    filteredMainGlyphes: ['mainGlyphes', 'whiteList',
      function (callback, results) {
        filterMainGlyphes(results.mainGlyphes, results.whiteList, callback);
    }],
    filteredAlternateGlyphes: ['metaData', 'whiteList',
      function (callback, results) {
        var glyphsWithAlternates = results.metaData.glyphsWithAlternates;
        filterAlternatesGlyphes(glyphsWithAlternates, results.whiteList, callback);
    }],
    fontSvgs: function (callback) {
      loadAndParseXml(fontPath, callback);
    },
    output: ['filteredAlternateGlyphes', 'filteredMainGlyphes', 'metaData', 'fontSvgs',
      function (callback, results) {
        var mainGlyphes = results.filteredMainGlyphes;
        var alternateGlyphes = results.filteredAlternateGlyphes;
        var metaData = results.metaData;
        var fontSvgs = results.fontSvgs;
        fillOutput(mainGlyphes, alternateGlyphes, callback);
    }],
    write: ['output',
      function (callback, results) {
        var output = results.output;
        var outputStr = JSON.stringify(output, null, indentValue);
        console.info('writting ' + outputPath);
        fs.writeFile(outputPath, outputStr, {
          mode: FILE_MODE
        }, callback);
    }]
  }, function (err) {
    if (err) {
      console.error(err.message);
    }
  });

  var fillOutput = function (mainGlyphes, alternateGlyphes, metaData, fontSvgs, callback) {
    var output = {
      glyphs: {}
    };

    shallowExtend(output.glyphs, mainGlyphes);
    shallowExtend(output.glyphs, alternateGlyphes);

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
      var sectionToCopy = metadata[i];
      for (var glyphName in output) {
        var glyphMetadata = sectionToCopy[glyphName];
        if (typeof glyphMetadata === 'undefined') {
          var msg = 'glyph name ' + glyphName +
            ' is not present inside the ' + sectionName + 'meta-data section';
          throw new Error(msg);
        } else {
          var glyphData = output[glyphName];
          shallowExtend(glyphMetadata, glyphMetadata);
        }
      }
    }
  };

  var shallowExtend = function (objToExtend, src) {
    for (var prop in src) {
      if (src.hasOwnProperty(src)) {
        objToExtend[prop] = src[prop];
      }
    }
  };

  var fillSvgPath = function (output, svgData) {
    if (!svgData.defs || !svgData.defs.font || !svgData.defs.font.glyph) {
      throw new Error('This XML is not a valid music font');
    } else {
      output.meta = svgData.defs.font['font-face']['@'];

      var glyphSvgs = svgData.defs.font.glyph;
      glyphSvgs = indexArray(indexArray, function getId(svgGlyph) {
        return svgGlyph['@']['glyph-name'];
      });

      for (var glyphName in output.glyphs) {
        var glyph = output[glyphName];
        var codepoint = glyph.codepoint;
        codepoint = codepoint.replace(/^U\+/, 'uni');
        if (typeof glyphSvgs[codepoint] === 'undefined') {
          throw new Error('the glyph ' + glyphName + '[' + codepoint + '] does not appear in the svg file. ');
        }
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

  var filterAlternatesGlyphes = function (glyphsWithAlternates, whiteList, callback) {
    var filteredGlyphsWithAlternates;
    if (whiteList.mainGlyphes) {
      filteredGlyphsWithAlternates = filterProperties(glyphsWithAlternates, whiteList.mainGlyphes);
    } else {
      filteredGlyphsWithAlternates = glyphsWithAlternates;
    }

    var alternatesGlyphes = flattenProperties(filteredGlyphsWithAlternates);

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

  var loadWhiteList = function (whiteListPath, callback) {
    if (whiteListPath) {
      loadAndParseJson(whiteListPath, callback);
    } else {
      var whiteList = {};
      callback(null, whiteList);
    }
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

}).call(this);
