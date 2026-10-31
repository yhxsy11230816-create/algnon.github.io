(() => {
  'use strict';
  const game = document.getElementById('game');
  const video = document.getElementById('openingVideo');
  const backdrop = document.getElementById('openingBackdrop');
  const controls = document.getElementById('openingControls');
  const playButton = document.getElementById('openingPlay');
  const replayButton = document.getElementById('openingReplay');
  const soundButton = document.getElementById('openingSound');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = true;
  let leaving = false;
  let manualPause = reducedMotion.matches;
  let playbackRequested = !manualPause;
  let failed = false;
  let leaveTimer;
  const blocked = () => document.hidden || document.getElementById('modal').open;

  video.muted = true;
  video.defaultMuted = true;
  video.loop = false;
  video.volume = 0.55;
  if (reducedMotion.matches) video.poster = 'assets/opening-final-frame.png';

  function updateButtons() {
    playButton.textContent = failed ? '动画暂不可用' : video.ended ? '播放开场' : video.paused ? '播放开场' : '暂停开场';
    playButton.disabled = failed;
    replayButton.disabled = failed;
    soundButton.disabled = failed;
    soundButton.textContent = video.muted ? '声音：关' : '声音：开';
    soundButton.setAttribute('aria-pressed', String(!video.muted));
  }

  async function play() {
    if (!active || leaving || failed || blocked()) return;
    manualPause = false;
    playbackRequested = true;
    try {
      await video.play();
      // A pending play promise must not restart media after entering the game.
      if (!active || leaving || blocked() || manualPause) video.pause();
    } catch {
      // Autoplay can be denied on low-power devices; keep a working play button.
      playbackRequested = false;
    }
    updateButtons();
  }

  function restart() {
    if (!active || leaving || failed) return;
    video.currentTime = 0;
    play();
  }

  function syncVisibility() {
    if (!active || blocked()) video.pause();
    else if (playbackRequested && !manualPause && !video.ended && !failed) play();
    updateButtons();
  }

  playButton.addEventListener('click', () => {
    if (video.ended) restart();
    else if (video.paused) play();
    else { manualPause = true; playbackRequested = false; video.pause(); }
    updateButtons();
  });
  replayButton.addEventListener('click', restart);
  soundButton.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted) window.GameAudio?.setMuted(false);
    updateButtons();
    if (!video.muted && video.ended) restart();
  });
  video.addEventListener('volumechange', updateButtons);
  video.addEventListener('play', updateButtons);
  video.addEventListener('pause', updateButtons);
  video.addEventListener('ended', () => { playbackRequested = false; updateButtons(); });
  function showFallback() {
    failed = true;
    playbackRequested = false;
    video.pause();
    backdrop.classList.add('video-unavailable');
    updateButtons();
  }
  video.addEventListener('error', showFallback);
  video.querySelector('source').addEventListener('error', showFallback);
  document.addEventListener('visibilitychange', syncVisibility);
  reducedMotion.addEventListener('change', e => {
    if (e.matches) { manualPause = true; playbackRequested = false; video.pause(); }
    updateButtons();
  });

  window.Opening = {
    setActive(value) {
      active = value;
      game.classList.toggle('is-intro', value);
      backdrop.hidden = !value;
      controls.hidden = !value;
      if (!value) { playbackRequested = false; video.pause(); }
      updateButtons();
    },
    syncVisibility,
    leave(onComplete) {
      if (leaving) return;
      leaving = true;
      video.pause();
      document.getElementById('startBtn').disabled = true;
      controls.hidden = true;
      const finish = () => {
        clearTimeout(leaveTimer);
        onComplete();
        game.classList.remove('opening-leaving');
      };
      if (reducedMotion.matches) finish();
      else {
        game.classList.add('opening-leaving');
        leaveTimer = setTimeout(finish, 420);
      }
    }
  };
  updateButtons();
  if (!reducedMotion.matches) play();
})();
