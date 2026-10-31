/* Warm and decode a small number of images at a time; keep the previous scene while loading. */
(() => {
  const assets = window.GAME_DATA.assets, cache = new Map();
  function load(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = new Promise(resolve => {
      const image = new Image(); image.decoding = 'async';
      image.onload = () => {
        const decoded = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.then(() => resolve(true));
      };
      image.onerror = () => { cache.delete(url); resolve(false); };
      image.src = url;
    });
    cache.set(url, promise); return promise;
  }
  const versions = new WeakMap();
  window.MediaCache = {
    load,
    background(element, url) {
      versions.set(element, url);
      load(url).then(ok => {
        if (ok && versions.get(element) === url) element.style.backgroundImage = `url("${url}")`;
      });
    }
  };
  const priority = ['STREET', 'WALKER', 'BAKERY', '查理'];
  const queue = [...new Set([...priority.map(k => assets[k]), ...Object.values(assets)])];
  async function worker() { while (queue.length) await load(queue.shift()); }
  worker(); worker();
})();
