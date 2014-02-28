LilypondFonts
=============

Small script to export SVG paths of Lilypond fonts to JSON.

Usage :

```
$ node LilypondFonts.js emmentaler-16.svg emmentaler-brace.svg > font.tmp.json
$ phantomjs LilypondFontsBBox.js fonts.tmp.json > font.json
```