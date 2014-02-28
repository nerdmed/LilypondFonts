//
// LilypondFonts
//

var fs = require('fs'),
    args = require('system').args,
    page = require('webpage').create(),
    Path = require('./lib/Path').Path;

if (args.length != 2) {
  console.error('Usage: LilypondFontsBBox.js glyphs.json');
  phantom.exit(0);
}

page.content = '<html><body><svg><path id="glyph"></path></svg></body></html>';

var glyphs = JSON.parse(fs.read(args[1]));

for (var glyName in glyphs.glyphs) {
  if (!glyphs.glyphs[glyName].d) {
    delete glyphs.glyphs[glyName];
    continue;
  }
  glyphs.glyphs[glyName]._d = new Path(glyphs.glyphs[glyName].d.match(/[a-zA-Z]|[0-9\-]+/g)).render();
}

var result = page.evaluate(function (glyphs) {
  for (var glyName in glyphs.glyphs) {
    var pathNode = document.getElementById('glyph');
    pathNode.setAttribute('d', glyphs.glyphs[glyName]._d);
    delete glyphs.glyphs[glyName]._d;
    glyphs.glyphs[glyName].h = Math.round(pathNode.getBBox().height);
    glyphs.glyphs[glyName].w = Math.round(pathNode.getBBox().width);
  }
  return glyphs;
}, glyphs);

console.log(JSON.stringify(result));
phantom.exit();