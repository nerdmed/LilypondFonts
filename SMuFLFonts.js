//
// LilypondFonts
//

var path = require('path'),
  console = require('console'),
  os = require('os'),
  fs = require('fs');

var async = require('async'),
  yargs = require('yargs');

var actions = require('./lib/actions');

(function () {
  "use strict";

  // Constants
  var METADATA_RELATIVE_PATH = 'metadata.json';
  var FONT_RELATIVE_PATH = 'font.svg';
  var FILE_MODE = 1204; // 0644

  var USAGE_MSG = 'Convert a SMuFL font to a json file to be used by Adagio music library' + os.EOL +
    'The font folder must contains 2 files:' + os.EOL +
    ' - ' + FONT_RELATIVE_PATH + ', an xml file containing the svg paths' + os.EOL +
    ' - ' + METADATA_RELATIVE_PATH + ', a json file containing the font metadata';


  // Command line parsing
  var argv = yargs.alias('f', 'font')
    .alias('m', 'metadata')
    .alias('o', 'output')
    .alias('w', 'whiteList')
    .alias('i', 'indent')
    .demand(['f', 'm', 'o'])
    .describe({
      'f': 'The font folder',
      'm': 'The SMuFL `glyphnames.json` file',
      'o': 'Path to the output file',
      'w': 'optional path to a white list file to filter glyphes to include in the output',
      'i': 'optional indent value for pretty print'
    })
    .usage(USAGE_MSG)
    .example('$0 -f ./bravura-1.02 -m ./smufl-metadata-1.0/glyphnames.json -o ./fonts/bravura.json -w ./filter/whiteList.json -i 2', 'generate a formatted json using a filter')
    .argv;

  // Arguments
  var fontDirectory = argv.f;
  var metadataPath = fontDirectory + path.sep + METADATA_RELATIVE_PATH;
  var fontPath = fontDirectory + path.sep + FONT_RELATIVE_PATH;
  var glyphNamesPath = argv.m;
  var whiteListPath = argv.w;
  var outputPath = argv.o;
  var indentValue = argv.i;

  // Async workflow
  async.auto({
    whiteList: function (callback) {
      if (whiteListPath) {
        console.info('[LOADING] ' + whiteListPath);
      }
      actions.loadWhiteList(whiteListPath, callback);
    },
    mainGlyphes: function (callback) {
      console.info('[LOADING] ' + glyphNamesPath);
      actions.loadAndParseJson(glyphNamesPath, callback);
    },
    metaData: function (callback) {
      console.info('[LOADING] ' + metadataPath);
      actions.loadAndParseJson(metadataPath, callback);
    },
    filteredMainGlyphes: ['mainGlyphes', 'whiteList',
      function (callback, results) {
        console.info('[FILERING] main glyphes');
        actions.filterMainGlyphes(results.mainGlyphes, results.whiteList, callback);
    }],
    filteredAlternateGlyphes: ['metaData', 'whiteList',
      function (callback, results) {
        console.info('[FILTERING] alternates glyphes');
        var glyphsWithAlternates = results.metaData.glyphsWithAlternates;
        actions.filterAlternatesGlyphes(glyphsWithAlternates, results.whiteList, callback);
    }],
    fontSvgs: function (callback) {
      console.info('[LOADING] ' + fontPath);
      actions.loadAndParseXml(fontPath, callback);
    },
    output: ['filteredAlternateGlyphes', 'filteredMainGlyphes', 'metaData', 'fontSvgs',
      function (callback, results) {
        console.info('[GENERATE-OUTPUT]');
        var mainGlyphes = results.filteredMainGlyphes;
        var alternateGlyphes = results.filteredAlternateGlyphes;
        var metaData = results.metaData;
        var fontSvgs = results.fontSvgs;
        actions.fillOutput(mainGlyphes, alternateGlyphes, metaData, fontSvgs, callback);
    }],
    write: ['output',
      function (callback, results) {
        var output = results.output;
        var outputStr = JSON.stringify(output, null, indentValue);
        console.info('[WRITE] ' + outputPath);
        fs.writeFile(outputPath, outputStr, {
          mode: FILE_MODE
        }, callback);
    }]

  }, function (err) {
    if (err) {
      console.error(err.message);
      console.log(err.stack);
      process.exit(1);
    } else {
      console.info('[DONE]');
      process.exit(0);
    }
  });

}).call(this);
