// 键盘布局数据 - 虚拟键盘渲染与按键名称映射
// 纯数据模块，可被 Node 测试和渲染层共用

// 6 行键盘布局，每个键包含 code（KeyboardEvent.code）、label（显示文本）、w（相对宽度）
const ROWS = [
  [
    { code: 'Escape', label: 'esc', w: 1 },
    { code: 'F1', label: 'F1', w: 1 }, { code: 'F2', label: 'F2', w: 1 },
    { code: 'F3', label: 'F3', w: 1 }, { code: 'F4', label: 'F4', w: 1 },
    { code: 'F5', label: 'F5', w: 1 }, { code: 'F6', label: 'F6', w: 1 },
    { code: 'F7', label: 'F7', w: 1 }, { code: 'F8', label: 'F8', w: 1 },
    { code: 'F9', label: 'F9', w: 1 }, { code: 'F10', label: 'F10', w: 1 },
    { code: 'F11', label: 'F11', w: 1 }, { code: 'F12', label: 'F12', w: 1 },
  ],
  [
    { code: 'Backquote', label: '`', w: 1 },
    { code: 'Digit1', label: '1', w: 1 }, { code: 'Digit2', label: '2', w: 1 },
    { code: 'Digit3', label: '3', w: 1 }, { code: 'Digit4', label: '4', w: 1 },
    { code: 'Digit5', label: '5', w: 1 }, { code: 'Digit6', label: '6', w: 1 },
    { code: 'Digit7', label: '7', w: 1 }, { code: 'Digit8', label: '8', w: 1 },
    { code: 'Digit9', label: '9', w: 1 }, { code: 'Digit0', label: '0', w: 1 },
    { code: 'Minus', label: '-', w: 1 }, { code: 'Equal', label: '=', w: 1 },
    { code: 'Backspace', label: 'Bksp', w: 2 },
  ],
  [
    { code: 'Tab', label: 'Tab', w: 1.5 },
    { code: 'KeyQ', label: 'Q', w: 1 }, { code: 'KeyW', label: 'W', w: 1 },
    { code: 'KeyE', label: 'E', w: 1 }, { code: 'KeyR', label: 'R', w: 1 },
    { code: 'KeyT', label: 'T', w: 1 }, { code: 'KeyY', label: 'Y', w: 1 },
    { code: 'KeyU', label: 'U', w: 1 }, { code: 'KeyI', label: 'I', w: 1 },
    { code: 'KeyO', label: 'O', w: 1 }, { code: 'KeyP', label: 'P', w: 1 },
    { code: 'BracketLeft', label: '[', w: 1 }, { code: 'BracketRight', label: ']', w: 1 },
    { code: 'Backslash', label: '\\', w: 1.5 },
  ],
  [
    { code: 'CapsLock', label: 'Caps', w: 1.75 },
    { code: 'KeyA', label: 'A', w: 1 }, { code: 'KeyS', label: 'S', w: 1 },
    { code: 'KeyD', label: 'D', w: 1 }, { code: 'KeyF', label: 'F', w: 1 },
    { code: 'KeyG', label: 'G', w: 1 }, { code: 'KeyH', label: 'H', w: 1 },
    { code: 'KeyJ', label: 'J', w: 1 }, { code: 'KeyK', label: 'K', w: 1 },
    { code: 'KeyL', label: 'L', w: 1 },
    { code: 'Semicolon', label: ';', w: 1 }, { code: 'Quote', label: "'", w: 1 },
    { code: 'Enter', label: 'Enter', w: 2.25 },
  ],
  [
    { code: 'ShiftLeft', label: 'Shift', w: 2.25 },
    { code: 'KeyZ', label: 'Z', w: 1 }, { code: 'KeyX', label: 'X', w: 1 },
    { code: 'KeyC', label: 'C', w: 1 }, { code: 'KeyV', label: 'V', w: 1 },
    { code: 'KeyB', label: 'B', w: 1 }, { code: 'KeyN', label: 'N', w: 1 },
    { code: 'KeyM', label: 'M', w: 1 }, { code: 'Comma', label: ',', w: 1 },
    { code: 'Period', label: '.', w: 1 }, { code: 'Slash', label: '/', w: 1 },
    { code: 'ShiftRight', label: 'Shift', w: 2.75 },
  ],
  [
    { code: 'ControlLeft', label: 'Ctrl', w: 1.25 },
    { code: 'AltLeft', label: 'Alt', w: 1.25 },
    { code: 'Space', label: 'Space', w: 6.25 },
    { code: 'AltRight', label: 'Alt', w: 1.25 },
    { code: 'ControlRight', label: 'Ctrl', w: 1.25 },
  ],
];

// 按键友好名称映射（用于统计展示与按键流水）
const KEY_NAMES = {
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', Enter: 'Enter', Space: '空格',
  ShiftLeft: '左 Shift', ShiftRight: '右 Shift',
  ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl',
  AltLeft: '左 Alt', AltRight: '右 Alt',
  CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

// 构建 code -> key 对象的映射表，便于快速查找
const KEY_MAP = {};
ROWS.forEach((row) => {
  row.forEach((k) => {
    KEY_MAP[k.code] = k;
  });
});

// 根据 code 获取按键友好名称
function keyName(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  const k = KEY_MAP[code];
  if (k) return k.label;
  return code;
}

module.exports = { ROWS, KEY_MAP, KEY_NAMES, keyName };
