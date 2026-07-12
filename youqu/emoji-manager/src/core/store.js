// src/core/store.js — 收藏与历史记录存储（使用 electron-store）
const Store = require('electron-store');

const store = new Store({ name: 'emoji-manager-config' });

const FAV_KEY = 'favorites';
const HIST_KEY = 'history';
const HIST_MAX = 50;

// ============ 收藏 ============
function getFavorites() {
  return store.get(FAV_KEY, []);
}

function isFavorite(char) {
  const favs = getFavorites();
  return favs.some(f => f.c === char);
}

function addFavorite(item) {
  const favs = getFavorites();
  if (!favs.some(f => f.c === item.c)) {
    favs.unshift({ c: item.c, n: item.n, k: item.k, cat: item.cat });
    store.set(FAV_KEY, favs);
  }
  return favs;
}

function removeFavorite(char) {
  let favs = getFavorites();
  favs = favs.filter(f => f.c !== char);
  store.set(FAV_KEY, favs);
  return favs;
}

function toggleFavorite(item) {
  if (isFavorite(item.c)) {
    removeFavorite(item.c);
    return { ok: true, isFav: false, favorites: getFavorites() };
  }
  addFavorite(item);
  return { ok: true, isFav: true, favorites: getFavorites() };
}

// ============ 历史 ============
function getHistory() {
  return store.get(HIST_KEY, []);
}

function addHistory(item) {
  let hist = getHistory();
  hist = hist.filter(h => h.c !== item.c);
  hist.unshift({ c: item.c, n: item.n, k: item.k, cat: item.cat, t: Date.now() });
  if (hist.length > HIST_MAX) hist = hist.slice(0, HIST_MAX);
  store.set(HIST_KEY, hist);
  return hist;
}

function clearHistory() {
  store.set(HIST_KEY, []);
  return [];
}

module.exports = {
  getFavorites, isFavorite, addFavorite, removeFavorite, toggleFavorite,
  getHistory, addHistory, clearHistory
};
