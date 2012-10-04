LilypondFonts
=============

Small script to export SVG paths of Lilypond fonts to JSON.

Requirements:

```
$ npm install libxml-to-js
```

libxml-to-js: https://github.com/SaltwaterC/libxml-to-js

Usage:

```
$ node LilypondFonts.js emmentaler-16.svg emmentaler-brace.svg > font.json
```