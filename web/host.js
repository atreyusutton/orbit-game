/*
 * p8mock host - the browser half: canvas, keyboard, touch, WebAudio, loop.
 * Everything DOM-flavoured lives here so engine.js/runtime.js stay testable
 * under node.
 */
(function (global) {
  'use strict';

  var engine = global.p8mock;

  // ------------------------------------------------------------------ audio

  function SfxPlayer() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  SfxPlayer.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return; // no audio support; game still plays silently
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      if (global.console) console.warn('[p8mock] audio unavailable:', err);
      this.ctx = null;
    }
  };

  SfxPlayer.prototype.noise = function () {
    if (this.noiseBuf) return this.noiseBuf;
    var len = this.ctx.sampleRate * 0.5;
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  };

  // PICO-8 waveform index -> closest WebAudio oscillator type.
  var WAVE_TYPE = ['triangle', 'sawtooth', 'sawtooth', 'square', 'square', 'sine', 'noise', 'sawtooth'];

  SfxPlayer.prototype.play = function (index, sfxData) {
    this.ensure();
    if (!this.ctx || !sfxData) return;
    var s = sfxData[index];
    if (!s) return;

    // Trailing silent notes just pad the pattern; find the real end.
    var last = -1;
    for (var i = 0; i < s.notes.length; i++) if (s.notes[i].volume > 0) last = i;
    if (last < 0) return;

    var dur = Math.max(s.speed, 1) / 120;
    var t0 = this.ctx.currentTime + 0.001;

    for (var n = 0; n <= last; n++) {
      var note = s.notes[n];
      if (note.volume <= 0) continue;
      this._note(note, t0 + n * dur, dur);
    }
  };

  SfxPlayer.prototype._note = function (note, when, dur) {
    var ctx = this.ctx;
    var type = WAVE_TYPE[note.wave] || 'triangle';
    var freq = engine.pitchToFreq(note.pitch);
    var gain = ctx.createGain();
    var peak = (note.volume / 7) * 0.5;

    // Tiny attack/release so notes do not click.
    var atk = Math.min(0.005, dur * 0.2);
    var rel = Math.min(0.03, dur * 0.5);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + atk);
    gain.gain.setValueAtTime(peak, Math.max(when + atk, when + dur - rel));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    gain.connect(this.master);

    var src;
    if (type === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = this.noise();
      src.loop = true;
      // Colour the noise by pitch so high blips read as high.
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(freq * 2, ctx.sampleRate / 2 - 1000);
      bp.Q.value = 1.2;
      src.connect(bp); bp.connect(gain);
    } else {
      src = ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(freq, when);
      src.connect(gain);
    }
    src.start(when);
    src.stop(when + dur + 0.02);
  };

  // ------------------------------------------------------------------ input

  // Keyboard -> PICO-8 button index.
  var KEYMAP = {
    ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3,
    a: 0, d: 1, w: 2, s: 3,
    z: 4, c: 4, n: 4,
    x: 5, v: 5, m: 5
  };

  // -------------------------------------------------------------------- host

  function Host(cartText, canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.image = this.ctx.createImageData(engine.W, engine.H);
    this.sfx = new SfxPlayer();
    this.paused = false;
    this.started = false;

    var self = this;
    this.runtime = new engine.Runtime(cartText, {
      fengari: global.fengari,
      seed: (Date.now() & 0x7fffffff) || 1,
      onSfx: function (n, data) { self.sfx.play(n, data); }
    });

    this._bindKeys();
    this._bindTouch(opts.touchRoot);
  }

  Host.prototype._bindKeys = function () {
    var self = this;
    function set(e, down) {
      var b = KEYMAP[e.key] !== undefined ? KEYMAP[e.key] : KEYMAP[e.key.toLowerCase()];
      if (b === undefined) return;
      e.preventDefault();
      self.sfx.ensure();
      self.runtime.setButton(b, down);
    }
    global.addEventListener('keydown', function (e) { set(e, true); }, { passive: false });
    global.addEventListener('keyup', function (e) { set(e, false); }, { passive: false });
    // Never leave a button stuck down when focus leaves the page.
    global.addEventListener('blur', function () {
      for (var i = 0; i < 6; i++) self.runtime.setButton(i, false);
    });
  };

  Host.prototype._bindTouch = function (root) {
    if (!root) return;
    var self = this;
    var els = root.querySelectorAll('[data-btn]');
    Array.prototype.forEach.call(els, function (el) {
      var b = parseInt(el.getAttribute('data-btn'), 10);
      function on(e) { e.preventDefault(); self.sfx.ensure(); self.runtime.setButton(b, true); el.classList.add('is-down'); }
      function off(e) { e.preventDefault(); self.runtime.setButton(b, false); el.classList.remove('is-down'); }
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    });
  };

  Host.prototype.blit = function () {
    this.runtime.machine.toRGBA(this.image.data);
    this.ctx.putImageData(this.image, 0, 0);
  };

  // Draw a readable error panel instead of freezing on a Lua error.
  Host.prototype.drawError = function () {
    var m = this.runtime.machine;
    m.camera(0, 0);
    m.cls(1);
    var msg = String(this.runtime.error || 'unknown error');
    m.print(strBytes('lua error'), 4, 4, 8);
    var line = '', y = 14;
    for (var i = 0; i < msg.length && y < 120; i++) {
      line += msg[i];
      if (line.length >= 30 || i === msg.length - 1) {
        m.print(strBytes(line), 2, y, 7);
        line = ''; y += 7;
      }
    }
    this.blit();
  };

  function strBytes(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  Host.prototype.start = function () {
    if (this.started) return;
    this.started = true;

    this.runtime.init();
    if (this.runtime.error) { this.drawError(); return; }

    var self = this;
    var step = 1 / this.runtime.fps;
    var acc = 0;
    var last = (global.performance || Date).now();

    function frame(now) {
      global.requestAnimationFrame(frame);
      if (self.runtime.error) return;
      if (self.paused) { last = now; return; }

      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // after a tab stall, do not fast-forward
      acc += dt;

      var ticks = 0;
      while (acc >= step && ticks < 8) {
        self.runtime.update();
        acc -= step;
        ticks++;
        if (self.runtime.error) { self.drawError(); return; }
      }
      if (ticks > 0) {
        self.runtime.draw();
        if (self.runtime.error) { self.drawError(); return; }
        self.blit();
      }
    }
    global.requestAnimationFrame(frame);

    global.document.addEventListener('visibilitychange', function () {
      self.paused = global.document.hidden;
    });
  };

  engine.Host = Host;
  engine.SfxPlayer = SfxPlayer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
