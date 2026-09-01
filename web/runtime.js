/*
 * p8mock runtime - binds a cart's Lua to the PICO-8 API.
 *
 * Deliberately free of DOM and audio: it owns the Lua state and the
 * framebuffer only. The host (browser page or a test script) drives it by
 * calling init()/update()/draw() and reading machine.fb. That split is what
 * lets the whole thing be rendered and diffed headlessly under node.
 */
(function (global) {
  'use strict';

  var engine = global.p8mock;
  if (!engine) throw new Error('p8mock engine.js must load before runtime.js');

  // Table and string helpers. Far less error-prone to express in Lua than to
  // bind one by one from JS.
  var PRELUDE = [
    'function add(t, v, i)',
    '  if t == nil then return end',
    '  if i == nil then t[#t + 1] = v else table.insert(t, i, v) end',
    '  return v',
    'end',
    'function del(t, v)',
    '  if t == nil then return end',
    '  for i = 1, #t do',
    '    if t[i] == v then table.remove(t, i) return v end',
    '  end',
    'end',
    'function deli(t, i)',
    '  if t == nil then return end',
    '  if i == nil then i = #t end',
    '  return table.remove(t, i)',
    'end',
    'function count(t, v)',
    '  if t == nil then return 0 end',
    '  if v == nil then return #t end',
    '  local n = 0',
    '  for i = 1, #t do if t[i] == v then n = n + 1 end end',
    '  return n',
    'end',
    // Deletion-safe: when an item is removed mid-loop the next one shifts into
    // the same index, so only advance when the current slot did not change.
    'function all(t)',
    '  if t == nil or #t == 0 then return function() end end',
    '  local i, prev = 1, nil',
    '  return function()',
    '    if t[i] == prev then i = i + 1 end',
    '    prev = t[i]',
    '    return prev',
    '  end',
    'end',
    'function foreach(t, f) for v in all(t) do f(v) end end',
    'function sub(s, i, j) return string.sub(s, i, j) end',
    'function chr(...) return string.char(...) end',
    'function ord(s, i) return string.byte(s, i or 1) end',
    'function split(s, sep, convert)',
    '  if sep == nil then sep = "," end',
    '  if convert == nil then convert = true end',
    '  local out = {}',
    '  local pattern = "([^" .. sep .. "]*)" .. sep .. "?"',
    '  for field in string.gmatch(tostring(s), pattern) do',
    '    local v = field',
    '    if convert and tonumber(field) then v = tonumber(field) end',
    '    out[#out + 1] = v',
    '  end',
    '  if #out > 0 and out[#out] == "" then out[#out] = nil end',
    '  return out',
    'end',
    'flip = function() end',
    'music = function() end',
    'menuitem = function() end',
    'extcmd = function() end',
    'palt = function() end',
    'fillp = function() end',
    'poke = function() end',
    'peek = function() return 0 end',
    'memcpy = function() end',
    'memset = function() end',
    'cartdata = function() return false end',
    'dget = function() return 0 end',
    'dset = function() end',
    'spr = function() end',
    'sspr = function() end',
    'map = function() end',
    'mget = function() return 0 end',
    'mset = function() end',
    'fget = function() return false end',
    'fset = function() end'
  ].join('\n');

  // PICO-8 prints numbers without a trailing ".0" and to at most 4 decimals.
  function fmtNum(v) {
    if (!isFinite(v)) return v > 0 ? '32767' : '-32768';
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  function Runtime(cartText, opts) {
    opts = opts || {};
    var fengari = opts.fengari || global.fengari;
    if (!fengari) throw new Error('fengari not available');

    this.fengari = fengari;
    this.cart = engine.parseCart(cartText);
    this.sfxData = engine.parseSfx(this.cart.sfx);
    this.machine = new engine.Machine();
    this.onSfx = opts.onSfx || function () {};
    this.onPrinth = opts.onPrinth || function (s) { if (global.console) console.log('[printh]', s); };

    // Button state: 6 buttons, player 0. `held` counts frames since press.
    this.held = [0, 0, 0, 0, 0, 0];
    this.down = [false, false, false, false, false, false];

    // Seedable PRNG so headless renders are reproducible.
    this.seed = (opts.seed >>> 0) || 0x2f6e2b1;

    this.frame = 0;
    this.error = null;
    this.fps = 30;

    this._boot(opts);
  }

  Runtime.prototype._rnd01 = function () {
    var s = this.seed;
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    this.seed = s;
    return s / 4294967296;
  };

  Runtime.prototype._boot = function (opts) {
    var f = this.fengari;
    var lua = f.lua, lauxlib = f.lauxlib, lualib = f.lualib;
    var L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    this.L = L;

    this._registerApi();

    var run = function (src, chunkname) {
      var st = lauxlib.luaL_loadbuffer(L, f.to_luastring(src), null, f.to_luastring(chunkname));
      if (st !== lua.LUA_OK) throw new Error('load ' + chunkname + ': ' + f.to_jsstring(lua.lua_tostring(L, -1)));
      st = lua.lua_pcall(L, 0, 0, 0);
      if (st !== lua.LUA_OK) throw new Error('run ' + chunkname + ': ' + f.to_jsstring(lua.lua_tostring(L, -1)));
    };

    run(PRELUDE, '=p8mock-prelude');
    run(engine.preprocess(this.cart.lua), '@cart');

    this.fps = this._hasGlobal('_update60') ? 60 : 30;
    this._updateName = this._hasGlobal('_update60') ? '_update60'
      : (this._hasGlobal('_update') ? '_update' : null);
    this._hasDraw = this._hasGlobal('_draw');
    this._hasInit = this._hasGlobal('_init');
  };

  Runtime.prototype._hasGlobal = function (name) {
    var f = this.fengari, lua = f.lua, L = this.L;
    lua.lua_getglobal(L, f.to_luastring(name));
    var is = lua.lua_type(L, -1) === lua.LUA_TFUNCTION;
    lua.lua_settop(L, -2);
    return is;
  };

  // Call a global Lua function with no args, capturing any error.
  Runtime.prototype._call = function (name) {
    if (this.error) return false;
    var f = this.fengari, lua = f.lua, L = this.L;
    lua.lua_getglobal(L, f.to_luastring(name));
    if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) { lua.lua_settop(L, -2); return false; }
    var st = lua.lua_pcall(L, 0, 0, 0);
    if (st !== lua.LUA_OK) {
      this.error = f.to_jsstring(lua.lua_tostring(L, -1));
      lua.lua_settop(L, -2);
      if (global.console) console.error('[p8mock] lua error in ' + name + ': ' + this.error);
      return false;
    }
    return true;
  };

  Runtime.prototype.init = function () {
    if (this._hasInit) this._call('_init');
  };

  Runtime.prototype.update = function () {
    // Advance button hold counters once per simulated frame.
    for (var i = 0; i < 6; i++) this.held[i] = this.down[i] ? this.held[i] + 1 : 0;
    this.frame++;
    if (this._updateName) this._call(this._updateName);
  };

  Runtime.prototype.draw = function () {
    if (this._hasDraw) this._call('_draw');
  };

  Runtime.prototype.setButton = function (i, isDown) {
    if (i >= 0 && i < 6) this.down[i] = !!isDown;
  };

  // PICO-8 btnp: fires on press, then repeats every 4 frames after 15 held.
  Runtime.prototype._btnp = function (i) {
    var h = this.held[i];
    return h === 1 || (h > 15 && (h - 16) % 4 === 0);
  };

  Runtime.prototype._registerApi = function () {
    var self = this;
    var f = this.fengari;
    var lua = f.lua, L = this.L;
    var m = this.machine;

    function num(i, def) {
      if (lua.lua_isnoneornil(L, i)) return def;
      var v = lua.lua_tonumber(L, i);
      return (v === undefined || v === null || isNaN(v)) ? def : v;
    }
    function optcol(i) {
      return lua.lua_isnoneornil(L, i) ? undefined : lua.lua_tonumber(L, i);
    }
    function def(name, fn) {
      lua.lua_pushcfunction(L, fn);
      lua.lua_setglobal(L, f.to_luastring(name));
    }
    // Raw bytes for a value, so P8SCII glyphs (0x80+) are not mangled by a
    // UTF-8 round trip.
    function bytesOf(i) {
      var t = lua.lua_type(L, i);
      if (t === lua.LUA_TNUMBER) return f.to_luastring(fmtNum(lua.lua_tonumber(L, i)));
      if (t === lua.LUA_TSTRING) return lua.lua_tostring(L, i);
      if (t === lua.LUA_TBOOLEAN) return f.to_luastring(lua.lua_toboolean(L, i) ? 'true' : 'false');
      if (t === lua.LUA_TNIL || t === lua.LUA_TNONE) return f.to_luastring('[nil]');
      return f.to_luastring('[' + f.to_jsstring(lua.lua_typename(L, t)) + ']');
    }

    // -- graphics
    def('cls', function () { m.cls(num(1, 0)); return 0; });
    def('pset', function () { m.pset(num(1, 0), num(2, 0), optcol(3)); return 0; });
    def('pget', function () { lua.lua_pushnumber(L, m.pget(num(1, 0), num(2, 0))); return 1; });
    def('line', function () { m.line(num(1, 0), num(2, 0), num(3, 0), num(4, 0), optcol(5)); return 0; });
    def('rect', function () { m.rect(num(1, 0), num(2, 0), num(3, 0), num(4, 0), optcol(5)); return 0; });
    def('rectfill', function () { m.rectfill(num(1, 0), num(2, 0), num(3, 0), num(4, 0), optcol(5)); return 0; });
    def('circ', function () { m.circ(num(1, 0), num(2, 0), num(3, 4), optcol(4)); return 0; });
    def('circfill', function () { m.circfill(num(1, 0), num(2, 0), num(3, 4), optcol(4)); return 0; });
    def('camera', function () { m.camera(num(1, 0), num(2, 0)); return 0; });
    def('clip', function () {
      if (lua.lua_isnoneornil(L, 1)) m.clip();
      else m.clip(num(1, 0), num(2, 0), num(3, 128), num(4, 128));
      return 0;
    });
    def('color', function () { m.setPen(num(1, 6)); return 0; });
    def('cursor', function () { m.cursorX = num(1, 0); m.cursorY = num(2, 0); if (!lua.lua_isnoneornil(L, 3)) m.setPen(num(3, 6)); return 0; });
    def('pal', function () {
      if (lua.lua_isnoneornil(L, 1)) m.pal();
      else m.pal(num(1, 0), num(2, 0));
      return 0;
    });
    def('print', function () {
      var b = bytesOf(1);
      var x = lua.lua_isnoneornil(L, 2) ? undefined : num(2, 0);
      var r = m.print(b, x, num(3, 0), optcol(4));
      lua.lua_pushnumber(L, r);
      return 1;
    });

    // -- math. PICO-8 angles are turns (0..1) and its sin is inverted.
    def('flr', function () { lua.lua_pushnumber(L, Math.floor(num(1, 0))); return 1; });
    def('ceil', function () { lua.lua_pushnumber(L, Math.ceil(num(1, 0))); return 1; });
    def('abs', function () { lua.lua_pushnumber(L, Math.abs(num(1, 0))); return 1; });
    def('sgn', function () { lua.lua_pushnumber(L, num(1, 0) >= 0 ? 1 : -1); return 1; });
    def('sqrt', function () { var v = num(1, 0); lua.lua_pushnumber(L, v < 0 ? 0 : Math.sqrt(v)); return 1; });
    def('sin', function () { lua.lua_pushnumber(L, -Math.sin(num(1, 0) * 2 * Math.PI)); return 1; });
    def('cos', function () { lua.lua_pushnumber(L, Math.cos(num(1, 0) * 2 * Math.PI)); return 1; });
    def('atan2', function () {
      var dx = num(1, 0), dy = num(2, 0);
      var a = Math.atan2(-dy, dx) / (2 * Math.PI);
      lua.lua_pushnumber(L, a - Math.floor(a));
      return 1;
    });
    def('min', function () { lua.lua_pushnumber(L, Math.min(num(1, 0), num(2, 0))); return 1; });
    def('max', function () { lua.lua_pushnumber(L, Math.max(num(1, 0), num(2, 0))); return 1; });
    def('mid', function () {
      var a = num(1, 0), b = num(2, 0), c = num(3, 0);
      lua.lua_pushnumber(L, Math.max(Math.min(a, b), Math.min(Math.max(a, b), c)));
      return 1;
    });
    def('rnd', function () {
      if (lua.lua_type(L, 1) === lua.LUA_TTABLE) {
        var n = lua.lua_rawlen(L, 1);
        if (n === 0) return 0;
        lua.lua_rawgeti(L, 1, Math.floor(self._rnd01() * n) + 1);
        return 1;
      }
      lua.lua_pushnumber(L, self._rnd01() * num(1, 1));
      return 1;
    });
    def('srand', function () { self.seed = (Math.floor(num(1, 0)) >>> 0) || 1; return 0; });

    // -- conversion
    def('tostr', function () { lua.lua_pushstring(L, bytesOf(1)); return 1; });
    def('tonum', function () {
      var v = lua.lua_tonumber(L, 1);
      if (v === undefined || v === null || isNaN(v)) return 0;
      lua.lua_pushnumber(L, v);
      return 1;
    });

    // -- input
    def('btn', function () {
      if (lua.lua_isnoneornil(L, 1)) {
        var mask = 0;
        for (var i = 0; i < 6; i++) if (self.down[i]) mask |= (1 << i);
        lua.lua_pushnumber(L, mask);
        return 1;
      }
      lua.lua_pushboolean(L, self.down[Math.floor(num(1, 0))] ? 1 : 0);
      return 1;
    });
    def('btnp', function () {
      if (lua.lua_isnoneornil(L, 1)) {
        var mask = 0;
        for (var i = 0; i < 6; i++) if (self._btnp(i)) mask |= (1 << i);
        lua.lua_pushnumber(L, mask);
        return 1;
      }
      lua.lua_pushboolean(L, self._btnp(Math.floor(num(1, 0))) ? 1 : 0);
      return 1;
    });

    // -- sound / misc
    def('sfx', function () { self.onSfx(Math.floor(num(1, -1)), self.sfxData); return 0; });
    def('time', function () { lua.lua_pushnumber(L, self.frame / self.fps); return 1; });
    def('t', function () { lua.lua_pushnumber(L, self.frame / self.fps); return 1; });
    def('stat', function () { lua.lua_pushnumber(L, 0); return 1; });
    def('printh', function () { self.onPrinth(f.to_jsstring(bytesOf(1))); return 0; });
  };

  engine.Runtime = Runtime;
  engine.fmtNum = fmtNum;
})(typeof globalThis !== 'undefined' ? globalThis : this);
