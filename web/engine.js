/*
 * p8mock - a small PICO-8-alike runtime for the browser.
 *
 * Runs a .p8 cart's Lua directly (via fengari, a Lua 5.3 VM in JS) against a
 * hand-written implementation of the PICO-8 draw/input/sound API. It is NOT an
 * emulator: there is no 6502-style memory model, no peek/poke, no fixed-point
 * arithmetic. It targets the subset of PICO-8 that primitive-drawn carts use.
 *
 * Rendering goes to a 128x128 indexed framebuffer (one palette index per byte),
 * which is then expanded to RGBA and blitted. Keeping the framebuffer indexed
 * matches how PICO-8 actually works and makes the renderer testable headlessly.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- palette

  // The 16 stock PICO-8 colors, as [r,g,b].
  var PALETTE = [
    [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81],
    [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
    [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
    [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]
  ];

  // ------------------------------------------------------------------- font

  // 3x5 glyphs, one entry per row, low 3 bits, bit 2 = leftmost pixel.
  // PICO-8 renders letters as small caps; lowercase input maps to these.
  var GLYPHS = {
    ' ': [0, 0, 0, 0, 0],
    '!': [2, 2, 2, 0, 2],
    '"': [5, 5, 0, 0, 0],
    '#': [5, 7, 5, 7, 5],
    '%': [5, 1, 2, 4, 5],
    '&': [6, 4, 7, 5, 3],
    "'": [2, 2, 0, 0, 0],
    '(': [1, 2, 2, 2, 1],
    ')': [4, 2, 2, 2, 4],
    '*': [5, 2, 7, 2, 5],
    '+': [0, 2, 7, 2, 0],
    ',': [0, 0, 0, 2, 4],
    '-': [0, 0, 7, 0, 0],
    '.': [0, 0, 0, 0, 2],
    '/': [1, 1, 2, 4, 4],
    ':': [0, 2, 0, 2, 0],
    ';': [0, 2, 0, 2, 4],
    '<': [1, 2, 4, 2, 1],
    '=': [0, 7, 0, 7, 0],
    '>': [4, 2, 1, 2, 4],
    '?': [7, 1, 3, 0, 2],
    '@': [7, 5, 7, 4, 3],
    '[': [3, 2, 2, 2, 3],
    '\\': [4, 4, 2, 1, 1],
    ']': [6, 2, 2, 2, 6],
    '^': [2, 5, 0, 0, 0],
    '_': [0, 0, 0, 0, 7],
    '`': [4, 2, 0, 0, 0],
    '{': [3, 2, 6, 2, 3],
    '|': [2, 2, 2, 2, 2],
    '}': [6, 2, 3, 2, 6],
    '~': [0, 3, 7, 6, 0],
    '0': [7, 5, 5, 5, 7],
    '1': [2, 6, 2, 2, 7],
    '2': [7, 1, 7, 4, 7],
    '3': [7, 1, 7, 1, 7],
    '4': [5, 5, 7, 1, 1],
    '5': [7, 4, 7, 1, 7],
    '6': [7, 4, 7, 5, 7],
    '7': [7, 1, 2, 2, 2],
    '8': [7, 5, 7, 5, 7],
    '9': [7, 5, 7, 1, 7],
    'a': [7, 5, 7, 5, 5],
    'b': [6, 5, 6, 5, 6],
    'c': [3, 4, 4, 4, 3],
    'd': [6, 5, 5, 5, 6],
    'e': [7, 4, 6, 4, 7],
    'f': [7, 4, 6, 4, 4],
    'g': [3, 4, 5, 5, 3],
    'h': [5, 5, 7, 5, 5],
    'i': [7, 2, 2, 2, 7],
    'j': [1, 1, 1, 5, 2],
    'k': [5, 5, 6, 5, 5],
    'l': [4, 4, 4, 4, 7],
    'm': [5, 7, 7, 5, 5],
    'n': [6, 5, 5, 5, 5],
    'o': [7, 5, 5, 5, 7],
    'p': [7, 5, 7, 4, 4],
    'q': [7, 5, 5, 7, 1],
    'r': [7, 5, 6, 5, 5],
    's': [3, 4, 7, 1, 6],
    't': [7, 2, 2, 2, 2],
    'u': [5, 5, 5, 5, 7],
    'v': [5, 5, 5, 5, 2],
    'w': [5, 5, 7, 7, 5],
    'x': [5, 5, 2, 5, 5],
    'y': [5, 5, 2, 2, 2],
    'z': [7, 1, 2, 4, 7]
  };

  // P8SCII control glyphs. These are 7 wide (advance 8) instead of 3 (advance 4).
  // Rows are 7 bits, bit 6 = leftmost.
  var WIDE_GLYPHS = {
    0x8b: [0x08, 0x18, 0x3e, 0x18, 0x08], // left arrow
    0x91: [0x08, 0x0c, 0x3e, 0x0c, 0x08], // right arrow
    0x94: [0x08, 0x1c, 0x3e, 0x08, 0x08], // up arrow
    0x83: [0x08, 0x08, 0x3e, 0x1c, 0x08], // down arrow
    0x8e: [0x1c, 0x22, 0x22, 0x22, 0x1c], // O button
    0x97: [0x22, 0x14, 0x08, 0x14, 0x22]  // X button
  };

  // --------------------------------------------------------- cart  parsing

  // Split a .p8 file into its __sections__.
  function parseCart(text) {
    var out = { lua: '', gfx: '', gff: '', map: '', sfx: '', music: '' };
    var lines = String(text).replace(/\r\n/g, '\n').split('\n');
    var current = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = /^__(\w+)__\s*$/.exec(line);
      if (m) { current = m[1]; if (!(current in out)) out[current] = ''; continue; }
      if (current === null) continue; // header lines before __lua__
      out[current] += line + '\n';
    }
    if (!out.lua.trim()) throw new Error('cart has no __lua__ section');
    return out;
  }

  // ------------------------------------------------------- lua dialect prep

  // PICO-8 accepts a handful of things stock Lua 5.3 rejects. Rewrite them.
  //
  // Rather than regexing the whole source (which corrupts string literals and
  // comments) we walk the text once, tracking whether we are inside a string,
  // a long bracket, or a comment, and only rewrite in live code.
  function preprocess(src) {
    var out = '';
    var i = 0;
    var n = src.length;
    var lineStart = 0;   // index in `out` where the current line began
    var lineHasCode = false;

    function atLineStartOfOut() { return out.length === lineStart; }

    while (i < n) {
      var c = src[i];

      // -- long bracket string / comment: [[ ... ]] or [=[ ... ]=]
      var lb = /^\[(=*)\[/.exec(src.slice(i, i + 16));
      if (lb) {
        var close = ']' + lb[1] + ']';
        var end = src.indexOf(close, i + lb[0].length);
        if (end === -1) end = n; else end += close.length;
        out += src.slice(i, end);
        i = end;
        lineHasCode = true;
        continue;
      }

      // -- comment
      if (c === '-' && src[i + 1] === '-') {
        var lbc = /^--\[(=*)\[/.exec(src.slice(i, i + 18));
        if (lbc) {
          var cl = ']' + lbc[1] + ']';
          var ce = src.indexOf(cl, i + lbc[0].length);
          if (ce === -1) ce = n; else ce += cl.length;
          out += src.slice(i, ce);
          i = ce;
          continue;
        }
        var nl = src.indexOf('\n', i);
        if (nl === -1) nl = n;
        out += src.slice(i, nl);
        i = nl;
        continue;
      }

      // -- quoted string
      if (c === '"' || c === "'") {
        var q = c;
        var j = i + 1;
        while (j < n) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === q) { j++; break; }
          if (src[j] === '\n') break; // unterminated; let Lua report it
          j++;
        }
        out += src.slice(i, j);
        i = j;
        lineHasCode = true;
        continue;
      }

      if (c === '\n') {
        out += c;
        i++;
        lineStart = out.length;
        lineHasCode = false;
        continue;
      }

      // -- `?` print shorthand, only as the first token on a line
      if (c === '?' && !lineHasCode && /^[ \t]*$/.test(out.slice(lineStart))) {
        var eol = src.indexOf('\n', i);
        if (eol === -1) eol = n;
        out += 'print(' + src.slice(i + 1, eol) + ')';
        i = eol;
        lineHasCode = true;
        continue;
      }

      // -- `!=` becomes `~=`
      if (c === '!' && src[i + 1] === '=') { out += '~='; i += 2; lineHasCode = true; continue; }

      // -- compound assignment: lhs op= rhs
      // Detected by looking backwards over the emitted line for a valid lvalue.
      var cmp = matchCompound(src, i);
      if (cmp) {
        var lhs = takeLvalue(out, lineStart);
        if (lhs !== null) {
          var eol2 = findStatementEnd(src, i + cmp.length);
          var rhs = src.slice(i + cmp.length, eol2);
          var name = lhs.trim();
          out = out.slice(0, out.length - lhs.length);
          out += name + ' = ' + name + ' ' + cmp.slice(0, -1) + ' (' + rhs + ')';
          i = eol2;
          lineHasCode = true;
          continue;
        }
      }

      out += c;
      if (!/\s/.test(c)) lineHasCode = true;
      i++;
    }

    return fixOneLineConditionals(out);
  }

  // Returns the compound operator text (e.g. "+=") at position i, or null.
  function matchCompound(src, i) {
    var two = src.slice(i, i + 3);
    if (two.slice(0, 2) === '..' && src[i + 2] === '=' && src[i + 3] !== '=') return '..=';
    var c = src[i];
    if ('+-*/%^\\'.indexOf(c) === -1) return null;
    if (src[i + 1] !== '=') return null;
    if (src[i + 2] === '=') return null; // e.g. `x == y` never reaches here, but be safe
    return c + '=';
  }

  // Walk backwards through already-emitted text to grab a simple lvalue:
  // identifiers, dots, and balanced [] indexing. Returns the raw text or null.
  function takeLvalue(out, lineStart) {
    var end = out.length;
    while (end > lineStart && /[ \t]/.test(out[end - 1])) end--;
    var k = end;
    var depth = 0;
    while (k > lineStart) {
      var ch = out[k - 1];
      if (ch === ']') { depth++; k--; continue; }
      if (ch === '[') { if (depth === 0) break; depth--; k--; continue; }
      if (depth > 0) { k--; continue; }
      if (/[A-Za-z0-9_.]/.test(ch)) { k--; continue; }
      break;
    }
    if (k >= end) return null;
    var text = out.slice(k, end);
    if (!/^[A-Za-z_]/.test(text)) return null;
    if (depth !== 0) return null;
    // Guard against keywords that can't be assigned to.
    if (/^(and|or|not|then|do|end|if|elseif|while|return|local)$/.test(text)) return null;
    return out.slice(k); // includes any trailing whitespace we skipped
  }

  // Words that end a statement and must not be swallowed into the right-hand
  // side of a compound assignment (`if a then x+=1 end` - the `end` is not
  // part of the expression). `and`/`or`/`not` are expression operators, so
  // they deliberately are not here.
  var STATEMENT_ENDERS = {
    end: 1, then: 1, 'do': 1, 'else': 1, elseif: 1, until: 1,
    'return': 1, 'break': 1, 'local': 1, 'if': 1, 'while': 1,
    'for': 1, 'repeat': 1, 'in': 1
  };

  // Find where the right-hand side of a compound assignment ends: end of line
  // or a statement-ending keyword, respecting brackets, strings and comments
  // so `x += f(a, b)` and `if c then x += 1 end` both work.
  function findStatementEnd(src, start) {
    var depth = 0;
    for (var i = start; i < src.length; i++) {
      var c = src[i];
      if (c === '\n' && depth <= 0) return i;
      if (c === ';' && depth <= 0) return i;
      if (c === '(' || c === '[' || c === '{') { depth++; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) return i; // closing a bracket we did not open
        depth--;
        continue;
      }
      if (c === '"' || c === "'") {
        var q = c; i++;
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
        continue;
      }
      if (c === '-' && src[i + 1] === '-') {
        var nl = src.indexOf('\n', i);
        return nl === -1 ? src.length : nl;
      }
      // A bare keyword at bracket depth 0 terminates the expression.
      if (depth === 0 && /[A-Za-z_]/.test(c) && !/[A-Za-z0-9_.:]/.test(src[i - 1] || ' ')) {
        var w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0];
        if (STATEMENT_ENDERS[w]) return i;
        i += w.length - 1;
      }
    }
    return src.length;
  }

  // PICO-8 allows `if (cond) stmt` and `while (cond) stmt` on one line with no
  // then/do/end. Expand those; leave normal multi-line forms alone.
  function fixOneLineConditionals(src) {
    return src.split('\n').map(function (line) {
      return expandShortForm(expandShortForm(line, 'if', 'then'), 'while', 'do');
    }).join('\n');
  }

  function expandShortForm(line, keyword, closer) {
    var re = new RegExp('^(\\s*)' + keyword + '\\s*\\(');
    var m = re.exec(line);
    if (!m) return line;

    // Find the matching close paren for the condition.
    var open = line.indexOf('(', m[1].length);
    var depth = 0, close = -1;
    for (var i = open; i < line.length; i++) {
      var c = line[i];
      if (c === '"' || c === "'") { var q = c; i++; while (i < line.length && line[i] !== q) { if (line[i] === '\\') i++; i++; } continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { close = i; break; } }
    }
    if (close === -1) return line;

    var tail = line.slice(close + 1);
    var code = tail.replace(/--.*$/, '').trim();
    // A real one-liner has a statement after the paren and no then/do keyword.
    if (!code) return line;
    if (new RegExp('^' + closer + '\\b').test(code)) return line;
    // `if (a) and (b) then ...` - the paren was just grouping, not the whole cond.
    if (/^(and|or|[=~<>+\-*\/%^.]|\])/.test(code)) return line;

    var cond = line.slice(open, close + 1);
    return m[1] + keyword + ' ' + cond + ' ' + closer + ' ' + code + ' end';
  }

  // ------------------------------------------------------------- framebuffer

  var W = 128, H = 128;

  // A 128x128 indexed-color screen plus the PICO-8 draw state that goes with
  // it (pen color, camera offset, clip rect, palette remap, text cursor).
  function Machine() {
    this.fb = new Uint8Array(W * H);
    this.reset();
  }

  Machine.prototype.reset = function () {
    this.fb.fill(0);
    this.camx = 0;
    this.camy = 0;
    this.pen = 6;
    this.cursorX = 0;
    this.cursorY = 0;
    this.clipX0 = 0; this.clipY0 = 0; this.clipX1 = W - 1; this.clipY1 = H - 1;
    this.drawPal = new Uint8Array(16);
    for (var i = 0; i < 16; i++) this.drawPal[i] = i;
  };

  // Resolve an optional color argument: PICO-8 keeps the last pen color when
  // the argument is omitted.
  Machine.prototype.setPen = function (c) {
    if (c !== undefined && c !== null && !isNaN(c)) this.pen = Math.floor(c) & 15;
    return this.pen;
  };

  // Plot in screen space (camera already applied), honouring clip + palette.
  Machine.prototype.px = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < this.clipX0 || x > this.clipX1 || y < this.clipY0 || y > this.clipY1) return;
    this.fb[y * W + x] = this.drawPal[c & 15];
  };

  Machine.prototype.pset = function (x, y, c) {
    this.px(x - this.camx, y - this.camy, this.setPen(c));
  };

  Machine.prototype.pget = function (x, y) {
    x = Math.floor(x - this.camx); y = Math.floor(y - this.camy);
    if (x < 0 || x >= W || y < 0 || y >= H) return 0;
    return this.fb[y * W + x];
  };

  Machine.prototype.cls = function (c) {
    var col = (c === undefined || c === null || isNaN(c)) ? 0 : Math.floor(c) & 15;
    this.fb.fill(col);
    this.clipX0 = 0; this.clipY0 = 0; this.clipX1 = W - 1; this.clipY1 = H - 1;
    this.cursorX = 0; this.cursorY = 0;
  };

  Machine.prototype.camera = function (x, y) {
    var ox = this.camx, oy = this.camy;
    this.camx = Math.floor(x || 0);
    this.camy = Math.floor(y || 0);
    return [ox, oy];
  };

  Machine.prototype.clip = function (x, y, w, h) {
    if (x === undefined || x === null) {
      this.clipX0 = 0; this.clipY0 = 0; this.clipX1 = W - 1; this.clipY1 = H - 1;
      return;
    }
    this.clipX0 = Math.max(0, Math.floor(x));
    this.clipY0 = Math.max(0, Math.floor(y));
    this.clipX1 = Math.min(W - 1, Math.floor(x + w) - 1);
    this.clipY1 = Math.min(H - 1, Math.floor(y + h) - 1);
  };

  // Horizontal span in screen space - the workhorse for filled shapes.
  Machine.prototype.hline = function (x0, x1, y, c) {
    if (x0 > x1) { var t = x0; x0 = x1; x1 = t; }
    y = Math.floor(y);
    if (y < this.clipY0 || y > this.clipY1) return;
    x0 = Math.max(this.clipX0, Math.floor(x0));
    x1 = Math.min(this.clipX1, Math.floor(x1));
    var col = this.drawPal[c & 15];
    var row = y * W;
    for (var x = x0; x <= x1; x++) this.fb[row + x] = col;
  };

  Machine.prototype.line = function (x0, y0, x1, y1, c) {
    var col = this.setPen(c);
    x0 = Math.floor(x0 - this.camx); y0 = Math.floor(y0 - this.camy);
    x1 = Math.floor(x1 - this.camx); y1 = Math.floor(y1 - this.camy);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  Machine.prototype.rect = function (x0, y0, x1, y1, c) {
    var col = this.setPen(c);
    x0 = Math.floor(x0 - this.camx); y0 = Math.floor(y0 - this.camy);
    x1 = Math.floor(x1 - this.camx); y1 = Math.floor(y1 - this.camy);
    if (x0 > x1) { var t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { var u = y0; y0 = y1; y1 = u; }
    this.hline(x0, x1, y0, col);
    this.hline(x0, x1, y1, col);
    for (var y = y0; y <= y1; y++) { this.px(x0, y, col); this.px(x1, y, col); }
  };

  Machine.prototype.rectfill = function (x0, y0, x1, y1, c) {
    var col = this.setPen(c);
    x0 = Math.floor(x0 - this.camx); y0 = Math.floor(y0 - this.camy);
    x1 = Math.floor(x1 - this.camx); y1 = Math.floor(y1 - this.camy);
    if (y0 > y1) { var u = y0; y0 = y1; y1 = u; }
    for (var y = y0; y <= y1; y++) this.hline(x0, x1, y, col);
  };

  // Midpoint circle. PICO-8's own rasterizer is a close cousin of this; the
  // visible difference is at most a pixel on small radii.
  Machine.prototype.circ = function (cx, cy, r, c) {
    var col = this.setPen(c);
    cx = Math.floor(cx - this.camx); cy = Math.floor(cy - this.camy);
    r = Math.floor(r);
    if (r < 0) return;
    if (r === 0) { this.px(cx, cy, col); return; }
    var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      this.px(cx + x, cy + y, col); this.px(cx - x, cy + y, col);
      this.px(cx + x, cy - y, col); this.px(cx - x, cy - y, col);
      this.px(cx + y, cy + x, col); this.px(cx - y, cy + x, col);
      this.px(cx + y, cy - x, col); this.px(cx - y, cy - x, col);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  };

  Machine.prototype.circfill = function (cx, cy, r, c) {
    var col = this.setPen(c);
    cx = Math.floor(cx - this.camx); cy = Math.floor(cy - this.camy);
    r = Math.floor(r);
    if (r < 0) return;
    if (r === 0) { this.px(cx, cy, col); return; }
    var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      this.hline(cx - x, cx + x, cy + y, col);
      this.hline(cx - x, cx + x, cy - y, col);
      this.hline(cx - y, cx + y, cy + x, col);
      this.hline(cx - y, cx + y, cy - x, col);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  };

  Machine.prototype.pal = function (from, to) {
    if (from === undefined || from === null) {
      for (var i = 0; i < 16; i++) this.drawPal[i] = i;
      return;
    }
    this.drawPal[Math.floor(from) & 15] = Math.floor(to) & 15;
  };

  // ------------------------------------------------------------------- text

  // `bytes` is a raw byte array so P8SCII glyphs (0x80+) survive intact.
  // Returns the x position just past the last glyph drawn.
  Machine.prototype.print = function (bytes, x, y, c) {
    if (x === undefined || x === null || isNaN(x)) {
      x = this.cursorX; y = this.cursorY;
      this.cursorY += 6;
    } else {
      this.cursorX = x;
      this.cursorY = y + 6;
    }
    var col = this.setPen(c);
    var sx = Math.floor(x - this.camx);
    var sy = Math.floor(y - this.camy);
    var penX = sx;

    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 10) { penX = sx; sy += 6; continue; }

      var wide = WIDE_GLYPHS[b];
      if (wide) {
        for (var wy = 0; wy < 5; wy++) {
          var wrow = wide[wy];
          for (var wx = 0; wx < 7; wx++) {
            if (wrow & (1 << (6 - wx))) this.px(penX + wx, sy + wy, col);
          }
        }
        penX += 8;
        continue;
      }

      var ch = String.fromCharCode(b);
      var g = GLYPHS[ch];
      if (!g && ch >= 'A' && ch <= 'Z') g = GLYPHS[ch.toLowerCase()];
      if (!g) g = (b < 32 || b > 126) ? null : GLYPHS['?'];
      if (g) {
        for (var gy = 0; gy < 5; gy++) {
          var grow = g[gy];
          for (var gx = 0; gx < 3; gx++) {
            if (grow & (1 << (2 - gx))) this.px(penX + gx, sy + gy, col);
          }
        }
      }
      penX += 4;
    }
    return penX + this.camx;
  };

  // Expand the indexed framebuffer into RGBA bytes for display or export.
  Machine.prototype.toRGBA = function (out) {
    var buf = out || new Uint8ClampedArray(W * H * 4);
    for (var i = 0; i < W * H; i++) {
      var rgb = PALETTE[this.fb[i] & 15];
      var o = i * 4;
      buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
    }
    return buf;
  };

  // -------------------------------------------------------------------- sfx

  // Each __sfx__ line is 8 header chars (flags, speed, loop start, loop end)
  // followed by 32 notes of 5 chars: pitch(2) waveform(1) volume(1) effect(1).
  function parseSfx(section) {
    var out = [];
    var lines = String(section).split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.length < 8) continue;
      var speed = parseInt(line.substr(2, 2), 16);
      var notes = [];
      for (var n = 0; n < 32; n++) {
        var off = 8 + n * 5;
        if (off + 5 > line.length) break;
        var chunk = line.substr(off, 5);
        notes.push({
          pitch: parseInt(chunk.substr(0, 2), 16) || 0,
          wave: parseInt(chunk.substr(2, 1), 16) || 0,
          volume: parseInt(chunk.substr(3, 1), 16) || 0,
          effect: parseInt(chunk.substr(4, 1), 16) || 0
        });
      }
      out.push({
        speed: speed || 16,
        loopStart: parseInt(line.substr(4, 2), 16) || 0,
        loopEnd: parseInt(line.substr(6, 2), 16) || 0,
        notes: notes
      });
    }
    return out;
  }

  // PICO-8 pitch 0..63 with 33 == A4 (440Hz), 12 semitones per octave.
  function pitchToFreq(p) {
    return 440 * Math.pow(2, (p - 33) / 12);
  }

  global.p8mock = {
    W: W,
    H: H,
    PALETTE: PALETTE,
    GLYPHS: GLYPHS,
    WIDE_GLYPHS: WIDE_GLYPHS,
    Machine: Machine,
    parseCart: parseCart,
    parseSfx: parseSfx,
    pitchToFreq: pitchToFreq,
    preprocess: preprocess
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
