/* Original, offline chapter score and small UI/footstep sounds. No external media requests. */
(() => {
  'use strict';
  const STORAGE = 'algernon-chapter-two-audio-v1';
  const settings = { music: .32, effects: .55, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    for (const key of ['music', 'effects']) {
      if (Number.isFinite(saved[key])) settings[key] = Math.max(0, Math.min(1, saved[key]));
    }
    if (typeof saved.muted === 'boolean') settings.muted = saved.muted;
  } catch { /* file:// and private browsing may not allow storage. */ }

  let context, master, musicBus, effectsBus, noise;
  let musicBuffer, musicSource, rendering, mode = 'intro';
  let walking = false, nextStep = 0, stepIndex = 0, lastClick = -1;
  let suspendedByPage = false, unavailable = false, musicFailed = false;
  const soundButton = document.getElementById('soundBtn');
  const frequency = note => 440 * 2 ** ((note - 69) / 12);
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch {} };

  function ramp(node, value, seconds = .04) {
    if (!context || !node) return;
    node.gain.cancelScheduledValues(context.currentTime);
    node.gain.setTargetAtTime(value, context.currentTime, seconds);
  }
  function update() {
    ramp(master, settings.muted ? 0 : .8);
    ramp(musicBus, mode === 'intro' ? 0 : settings.music * (mode === 'story' ? .85 : 1), .16);
    ramp(effectsBus, settings.effects);
    soundButton.textContent = unavailable ? '声音不可用' : settings.muted ? '声音：关' : '声音设置';
    soundButton.setAttribute('aria-label', unavailable ? '此浏览器暂不支持声音' : '打开声音设置' + (settings.muted ? '，当前静音' : ''));
    soundButton.disabled = unavailable;
    const status = document.getElementById('audioPlaybackStatus');
    if (status) status.textContent = settings.muted ? '声音已关闭。' : mode === 'intro' ? '走进这一天后，背景音乐会开始播放。' : musicFailed ? '音乐暂不可用，按钮与脚步音效仍可使用。' : !settings.music ? '背景音乐音量为 0。' : context?.state !== 'running' ? '点击按钮即可继续播放声音。' : musicSource ? '背景音乐正在播放。' : '正在准备背景音乐…';
  }

  function init() {
    if (context) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { unavailable = true; update(); return false; }
    try {
      context = new AudioContext();
      master = context.createGain();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      master.gain.value = settings.muted ? 0 : .8;
      musicBus.gain.value = 0;
      effectsBus.gain.value = settings.effects;
      musicBus.connect(master); effectsBus.connect(master); master.connect(context.destination);
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * .16), context.sampleRate);
      const samples = noise.getChannelData(0);
      let seed = 7189;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 16807) % 2147483647;
        samples[i] = seed / 1073741823.5 - 1;
      }
      context.onstatechange = () => {
        update();
        if (context.state === 'running') startMusic();
        else { walking = false; nextStep = 0; }
      };
      update();
      return true;
    } catch { unavailable = true; update(); return false; }
  }

  // A 16-bar, 72 bpm felt-keyboard piece, with a quiet pad and room tail.
  // Render once; a single buffer source loops across all locations and choices.
  async function renderMusic() {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('Offline audio is unavailable');
    const rate = 32000, beat = 60 / 72, cycle = 16 * 4 * beat, tail = 5;
    const offline = new Offline(2, Math.ceil((cycle + tail) * rate), rate);
    const bus = offline.createBiquadFilter();
    bus.type = 'lowpass'; bus.frequency.value = 2600; bus.Q.value = .4;
    bus.connect(offline.destination);
    const reverb = offline.createConvolver(), wet = offline.createGain();
    const impulse = offline.createBuffer(2, rate * 2, rate);
    let seed = 18271;
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 16807) % 2147483647;
        samples[i] = (seed / 1073741823.5 - 1) * (1 - i / samples.length) ** 3;
      }
    }
    reverb.buffer = impulse; wet.gain.value = .23;
    bus.connect(reverb); reverb.connect(wet); wet.connect(offline.destination);
    const wave = offline.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, .23, .08, .035, .012, .004]));
    function note(midi, time, duration, velocity, pan = 0, pad = false) {
      const osc = offline.createOscillator(), gain = offline.createGain(), stereo = offline.createStereoPanner();
      osc.frequency.value = frequency(midi);
      if (pad) osc.type = 'sine'; else osc.setPeriodicWave(wave);
      stereo.pan.value = pan;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(velocity, time + (pad ? .65 : .012));
      if (pad) {
        gain.gain.setValueAtTime(velocity, time + duration - .9);
        gain.gain.linearRampToValueAtTime(0, time + duration);
      } else gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      osc.connect(gain); gain.connect(stereo); stereo.connect(bus);
      osc.start(time); osc.stop(time + duration + .01);
    }
    const harmony = [[48,55,59,64],[47,55,62,67],[45,52,55,60],[40,47,55,59],[41,48,57,60],[40,48,55,64],[38,45,53,60],[43,50,57,62]];
    const melody = [
      [[0,76,2],[2.5,74,1]], [[0,71,2],[3,67,1]],
      [[.5,74,2],[3,71,1]], [[0,69,2.5]],
      [[0,72,1.5],[2,71,1],[3,69,1]], [[0,67,3]],
      [[.5,71,2],[3,67,1]], [[0,64,2.5]],
      [[0,69,2],[2.5,72,1]], [[0,76,2.5],[3,74,1]],
      [[0,72,2],[2.5,67,1]], [[.5,64,2.5]],
      [[0,65,1.5],[2,69,1.5]], [[0,72,2],[2.5,69,1]],
      [[0,67,2],[2.5,69,1]], [[0,71,2],[2.5,74,1]]
    ];
    for (let bar = 0; bar < 16; bar++) {
      const chord = harmony[Math.floor(bar / 2)], start = bar * 4 * beat;
      note(chord[0], start, 3.8, .16, -.18);
      [1,2,3].forEach((n, i) => note(chord[n], start + (i + .5) * beat, 3.1, .065, .1 + i * .08));
      if (bar % 2 === 0) chord.slice(1).forEach((n, i) => note(n - 12, start, 7.5 * beat, .016, (i - 1) * .28, true));
      melody[bar].forEach(([offset, midi, length]) => note(midi, start + offset * beat, length * beat + 1.4, .13, -.08));
    }
    const rendered = await offline.startRendering();
    const length = Math.round(cycle * rate), loop = context.createBuffer(2, length, rate);
    let peak = 0;
    for (let c = 0; c < 2; c++) {
      const source = rendered.getChannelData(c), target = loop.getChannelData(c);
      target.set(source.subarray(0, length));
      // Fold the final decay into the beginning, so the loop boundary remains natural.
      for (let i = length; i < source.length; i++) target[i - length] += source[i];
      for (const value of target) peak = Math.max(peak, Math.abs(value));
    }
    const gain = peak ? .78 / peak : 1;
    for (let c = 0; c < 2; c++) {
      const samples = loop.getChannelData(c);
      for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    }
    return loop;
  }
  function startMusic() {
    if (!context || context.state !== 'running' || document.hidden || mode === 'intro') return;
    if (!musicBuffer) {
      if (!rendering) rendering = renderMusic().then(buffer => { musicBuffer = buffer; if (buffer) startMusic(); }).catch(() => { musicFailed = true; update(); });
      return;
    }
    if (musicSource) return;
    musicSource = context.createBufferSource();
    musicSource.buffer = musicBuffer; musicSource.loop = true;
    musicSource.connect(musicBus); musicSource.start();
    update();
  }
  async function unlock() {
    if (document.hidden || !init()) return;
    try {
      if (context.state !== 'running') await context.resume();
      if (document.hidden) { await context.suspend(); return; }
      suspendedByPage = false;
      startMusic();
    } catch { /* The next real gesture can retry a blocked audio context. */ }
  }
  function audible() { return context?.state === 'running' && !settings.muted && !document.hidden; }
  function transient(type, pitch, endPitch, duration, level, destination = effectsBus) {
    const t = context.currentTime, osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(endPitch, t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(level, t + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain); gain.connect(destination); osc.start(t); osc.stop(t + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  function click() {
    if (!audible() || !settings.effects || context.currentTime - lastClick < .045) return;
    lastClick = context.currentTime;
    transient('sine', 740, 460, .065, .17);
  }
  function footstep() {
    if (!audible() || !settings.effects) return;
    const t = context.currentTime, source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    const stereo = context.createStereoPanner(), side = stepIndex++ % 2 ? 1 : -1;
    source.buffer = noise; filter.type = 'lowpass'; filter.frequency.value = side > 0 ? 820 : 690;
    stereo.pan.value = side * .15;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.32, t + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .12);
    source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(effectsBus);
    source.start(t); source.stop(t + .14);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect(); };
    transient('sine', side > 0 ? 124 : 114, 55, .11, .23);
  }
  function walk(moving) {
    if (!moving || mode !== 'street' || !audible()) { walking = false; nextStep = 0; return; }
    if (!walking || context.currentTime >= nextStep) { footstep(); nextStep = context.currentTime + .29; }
    walking = true;
  }
  function setMuted(value) {
    settings.muted = !!value;
    if (settings.muted) {
      const video = document.getElementById('openingVideo');
      if (video) video.muted = true;
    }
    save(); update();
  }
  function buildSettings() {
    const box = document.createElement('div'); box.className = 'audio-settings';
    const intro = document.createElement('p');
    intro.textContent = mode === 'intro' ? '走进这一天后，柔和的键盘音乐会随章节播放。' : '静静想一想 · 第二章配乐。阅读时音乐会稍微放轻。';
    box.append(intro);
    const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'audio-mute'; mute.dataset.audioSilent = 'true';
    const refreshMute = () => { mute.textContent = settings.muted ? '开启声音' : '静音所有声音'; mute.setAttribute('aria-pressed', String(settings.muted)); };
    mute.onclick = () => { unlock(); setMuted(!settings.muted); refreshMute(); };
    refreshMute(); box.append(mute);
    for (const [key, label] of [['music','背景音乐'],['effects','按钮与脚步音效']]) {
      const row = document.createElement('div'); row.className = 'audio-row';
      const text = document.createElement('label'); text.htmlFor = 'volume-' + key; text.textContent = label;
      const value = document.createElement('output'); value.htmlFor = 'volume-' + key;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1'; slider.id = 'volume-' + key;
      slider.value = String(Math.round(settings[key] * 100)); value.textContent = slider.value + '%';
      slider.oninput = () => { settings[key] = Number(slider.value) / 100; value.textContent = slider.value + '%'; save(); update(); };
      row.append(text, value, slider); box.append(row);
    }
    const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = '试听脚步声'; preview.dataset.audioSilent = 'true';
    preview.onclick = () => unlock().then(footstep); box.append(preview);
    const status = document.createElement('p'); status.id = 'audioPlaybackStatus'; status.setAttribute('aria-live', 'polite');
    status.textContent = settings.muted ? '声音已关闭。' : musicSource ? '背景音乐正在播放。' : mode === 'intro' ? '走进这一天后，背景音乐会开始播放。' : musicFailed ? '音乐暂不可用。' : '正在准备背景音乐…'; box.append(status);
    const hint = document.createElement('p'); hint.textContent = '切换到其他标签页会自动暂停声音。音量设置会在此浏览器中保留。'; box.append(hint);
    return box;
  }
  document.addEventListener('pointerdown', e => {
    if (e.target.closest?.('button, #line, input[type=range]')) unlock();
  }, true);
  document.addEventListener('keydown', e => {
    if (!e.repeat && ['Enter',' ','a','A','d','D','e','E','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) unlock();
  }, true);
  document.addEventListener('click', e => {
    const button = e.target.closest?.('button');
    if (!button || button.disabled || button.dataset.audioSilent || ['left','right','next'].includes(button.id)) return;
    unlock().then(click);
  }, true);
  document.addEventListener('visibilitychange', () => {
    walk(false);
    if (!context) return;
    if (document.hidden) {
      suspendedByPage = true;
      context.suspend().catch(() => {});
    } else if (suspendedByPage) unlock();
  });
  window.addEventListener('pagehide', () => { walk(false); context?.suspend().catch(() => {}); });
  window.addEventListener('pageshow', () => { if (context) unlock(); });
  window.GameAudio = {
    unlock, click, walk, setMuted, buildSettings,
    setMode(value) { mode = value; walk(false); update(); startMusic(); }
  };
  update();
})();
