// 换算管家 - 本地存储（历史记录 + 收藏 + 偏好）
// 纯逻辑层，不依赖 Electron，便于测试

const DEFAULT_STATE = {
  favorites: [], // [{ categoryId, fromUnitId, toUnitId }]
  history: [],   // [{ categoryId, fromUnitId, toUnitId, value, result, ts }]
  lastCategory: 'length',
  lastFromUnit: 'm'
};

const MAX_HISTORY = 50;

function createState(initial = {}) {
  return Object.assign({}, DEFAULT_STATE, initial);
}

function addHistory(state, entry) {
  if (!entry) return state;
  const hist = [entry, ...(state.history || [])].slice(0, MAX_HISTORY);
  return Object.assign({}, state, { history: hist });
}

function clearHistory(state) {
  return Object.assign({}, state, { history: [] });
}

function addFavorite(state, fav) {
  if (!fav) return state;
  const exists = (state.favorites || []).some(
    f => f.categoryId === fav.categoryId &&
         f.fromUnitId === fav.fromUnitId &&
         f.toUnitId === fav.toUnitId
  );
  if (exists) return state;
  return Object.assign({}, state, { favorites: [...(state.favorites || []), fav] });
}

function removeFavorite(state, fav) {
  const favs = (state.favorites || []).filter(
    f => !(f.categoryId === fav.categoryId &&
           f.fromUnitId === fav.fromUnitId &&
           f.toUnitId === fav.toUnitId)
  );
  return Object.assign({}, state, { favorites: favs });
}

function isFavorite(state, fav) {
  return (state.favorites || []).some(
    f => f.categoryId === fav.categoryId &&
         f.fromUnitId === fav.fromUnitId &&
         f.toUnitId === fav.toUnitId
  );
}

function setLast(state, last) {
  return Object.assign({}, state, { lastCategory: last.categoryId, lastFromUnit: last.fromUnitId });
}

module.exports = {
  DEFAULT_STATE,
  MAX_HISTORY,
  createState,
  addHistory,
  clearHistory,
  addFavorite,
  removeFavorite,
  isFavorite,
  setLast
};
