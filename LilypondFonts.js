//
// LilypondFonts
//

var util = require('util'),
    fs = require('fs'),
    parser = require('libxml-to-js');

(function () {
    "use strict";

    if (process.argv.length <= 2) {
        console.error('Usage: node LilypondFonts.js [font.svg ...]');
        process.exit(1);
    }

    var output = { glyphs: {} }, done = process.argv.length - 2;
    for (var i = 2 ; i < process.argv.length ; ++i) {
        var xml = fs.readFileSync(process.argv[i], 'utf-8');

        parser(xml, function (error, result) {
            if (error) {
                console.error(error);
            } else {
                if (!result.defs || !result.defs.font || !result.defs.font.glyph) {
                    console.error('This XML is not a Lilypond font : ' + process.argv[i]);
                }
                else {
                    output.meta = result.defs.font['font-face'];

                    for (var j = 0 ; j < result.defs.font.glyph.length ; ++j) {
                        output.glyphs[result.defs.font.glyph[j]['@']['glyph-name']] = result.defs.font.glyph[j]['@'].d;
                    }

                    if (--done === 0) {
                        util.puts(JSON.stringify(output));
                    }
                }
            }
        });
    }

}).call(this);