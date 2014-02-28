/* Imported from npm flat-fermata / adagio */

(function () {
  'use strict';

  /**
   * A SVG Path data helper
   * @constructor
   */
  function Path(d, x, y, scale) {
    this.d = d || null;
    this.x = x || 0;
    this.y = y || 0;
    this.scale = scale || 1;

    /* private */
    this._d = null;
  }

  /**
   * Reset the rendered path
   */
  Path.prototype.reset = function () {
    this._d = null;
  };


  var pathDataArgs = {
    M: 1,
    L: 1,
    S: 2,
    C: 3,
    Z: 0
  };

  /**
   * Render the this.scaled path to x, y
   */
  Path.prototype.render = function (d) {
    if (!d) {
      d = this.d;
    }
    else if (d !== this.d) {
      this.reset();
    }

    if (this._d !== null) {
      return this._d;
    }
 
    this._d = '';

    var dLength = d.length;
    for (var i = 0; i < d.length; ) {
      var action = d[i++];

      if (action === 'V') {
        this._path_data(action, this.y + d[i++] * -this.scale);
      }
      else if (action === 'H') {
        this._path_data(action, this.x + d[i++] * this.scale);
      }
      else if (action === 'v') {
        this._path_data(action, d[i++] * -this.scale);
      }
      else if (action === 'h') {
        this._path_data(action, d[i++] * this.scale);
      }
      else {
        var c = action.toUpperCase(), a = pathDataArgs[c];
        if (typeof(a) === 'number') {
          var args = [action];
          while (a-- > 0) {
            if (c === action) {
              args.push(
                this.x + d[i++] * this.scale,
                this.y + d[i++] * -this.scale
              );
            }
            else {
              args.push(d[i++] * this.scale, d[i++] * -this.scale);
            }
          }

          this._path_data.apply(this, args);
        }
        else {
          console.error('Unknown data: ' + c);
        }
      }
    }

    return this._d;
  };

  Path.prototype._path_data = function () {
    var args = Array.prototype.slice.call(arguments);
    this._d += args.shift() + args.join(',');
    return this;
  };

  // Expose
  exports.Path = Path;

}).call(this);
