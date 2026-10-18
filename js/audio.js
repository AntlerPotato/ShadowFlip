/**
 * 影翻棋 · 音效与背景音乐（落地页、对局页共用）
 *
 * - 背景音乐在三首曲子间随机轮播，每首结束后隔 2 秒换下一首
 * - 音乐开关存在 localStorage，两个页面之间保持一致
 * - 浏览器禁止自动播放时，等用户第一次点击或按键后再开始
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'shadowflip.music';
  const MUSIC_VOLUME = 0.3;
  const MUSIC = ['media/background1.wav', 'media/background2.wav', 'media/background3.wav'];
  const SOUNDS = {
    clack: 'media/ChessClack.wav',
    eat: 'media/eat.wav',
    choose: 'media/ChooseChess.mp3',
    takeBack: 'media/TakeBackOneMove.wav',
    start: 'media/GameStart.wav',
    clap: 'media/clap.wav',
  };

  const cache = {};
  const listeners = new Set();
  let musicOn = readPreference();
  let track = null;
  let trackIndex = -1;
  let waitingForGesture = false;

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  }

  function writePreference() {
    try {
      localStorage.setItem(STORAGE_KEY, musicOn ? 'on' : 'off');
    } catch (e) {
      // 隐私模式等情况下无法写入，忽略即可
    }
  }

  function sound(name) {
    if (!cache[name]) {
      cache[name] = new Audio(SOUNDS[name]);
      cache[name].preload = 'auto';
    }
    return cache[name];
  }

  function ignore(promise) {
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  /**
   * 播放一段音效
   * @param {keyof SOUNDS} name
   * @param {{ from?: number, until?: number }} [options] from：从第几秒开始；until：播放几秒后停下
   */
  function play(name, options) {
    const audio = sound(name);
    const from = (options && options.from) || 0;
    try {
      audio.currentTime = from;
    } catch (e) {
      // 元数据未加载时设置进度可能失败
    }
    ignore(audio.play());
    if (options && options.until) {
      clearTimeout(audio.stopTimer);
      audio.stopTimer = setTimeout(() => stop(name), options.until * 1000);
    }
    return audio;
  }

  function stop(name) {
    const audio = cache[name];
    if (!audio) return;
    clearTimeout(audio.stopTimer);
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (e) {
      // 同上
    }
  }

  function pickTrack() {
    let index;
    do {
      index = Math.floor(Math.random() * MUSIC.length);
    } while (index === trackIndex && MUSIC.length > 1);
    trackIndex = index;
    return MUSIC[index];
  }

  function startMusic() {
    if (!musicOn) return;
    if (!track) {
      track = new Audio(pickTrack());
      track.volume = MUSIC_VOLUME;
      track.addEventListener('ended', () => {
        track = null;
        setTimeout(startMusic, 2000);
      });
    }
    const attempt = track.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(waitForGesture);
  }

  // 自动播放被拦截：等用户第一次交互后再播放
  function waitForGesture() {
    if (waitingForGesture) return;
    waitingForGesture = true;
    const resume = () => {
      waitingForGesture = false;
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      startMusic();
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  function setMusic(on) {
    musicOn = on;
    writePreference();
    if (on) startMusic();
    else if (track) track.pause();
    listeners.forEach((fn) => fn(musicOn));
  }

  function toggleMusic() {
    setMusic(!musicOn);
  }

  /**
   * 绑定音乐开关按钮：同步 aria-pressed，点击切换
   * @param {HTMLButtonElement} button
   */
  function bindMusicToggle(button) {
    const update = () => button.setAttribute('aria-pressed', String(musicOn));
    button.addEventListener('click', toggleMusic);
    listeners.add(update);
    update();
  }

  // 预加载常用的短音效
  ['clack', 'eat', 'choose', 'takeBack', 'start'].forEach(sound);

  root.ShadowFlipAudio = {
    play,
    stop,
    startMusic,
    setMusic,
    toggleMusic,
    bindMusicToggle,
    isMusicOn: () => musicOn,
  };
})(window);
