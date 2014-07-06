var polyfill = require('./polyfill');

(function () {
  'use strict';

  exports.shallowExtend = function (objToExtend, src) {
    for (var prop in src) {
      if (src.hasOwnProperty(prop)) {
        objToExtend[prop] = src[prop];
      }
    }
  };

  exports.indexArray = function (array, getId) {
    var index = {};
    array.forEach(function (item) {
      var id = getId(item);
      index[id] = item;
    });
    return index;
  };


  exports.filterProperties = function (object, whiteList) {
    var filtered = {};
    for (var prop in whiteList) {
      if (typeof object[prop] !== 'undefined') {
        filtered[prop] = object[prop];
      }
    }
    return filtered;
  };

  exports.unicodeToString = function (unicode) {
    var str = 'U+' + polyfill.codePointAt.call(unicode, 0).toString(16).toUpperCase();
    return str;
  };

}).call(this);
