// 打字测试引擎 - 计算准确率、WPM、错误字符
// 纯逻辑模块，可被 Node 测试

class TypingTest {
  constructor(text) {
    this.text = text || '';
    this.typed = ''; // 用户已输入的字符
    this.startTime = null;
    this.endTime = null;
    this.errors = 0; // 累计错误按键数
    this.finished = false;
  }

  // 开始计时
  start() {
    if (this.startTime === null) this.startTime = Date.now();
  }

  // 输入一个字符（key 对应 text 中的下一个期望字符）
  // 返回 { ok, finished, expected }
  input(ch) {
    if (this.finished) return { ok: false, finished: true, expected: '' };
    this.start();
    const expected = this.text[this.typed.length] || '';
    if (ch === expected) {
      this.typed += ch;
      if (this.typed.length >= this.text.length) {
        this.finished = true;
        this.endTime = Date.now();
      }
      return { ok: true, finished: this.finished, expected };
    }
    this.errors += 1;
    return { ok: false, finished: false, expected };
  }

  // 退格
  backspace() {
    if (this.typed.length > 0) {
      this.typed = this.typed.slice(0, -1);
    }
  }

  // 计算准确率（按字符数）
  accuracy() {
    const total = this.typed.length + this.errors;
    if (total === 0) return 100;
    return Math.round((this.typed.length / total) * 100);
  }

  // 计算用时（秒）
  durationSec() {
    if (this.startTime === null) return 0;
    const end = this.endTime || Date.now();
    return Math.max(0.001, (end - this.startTime) / 1000);
  }

  // 计算 WPM（每分钟单词数，标准：5 字符 = 1 词）
  wpm() {
    if (this.startTime === null) return 0;
    const mins = this.durationSec() / 60;
    if (mins <= 0) return 0;
    const words = this.typed.length / 5;
    return Math.round(words / mins);
  }

  // 序列化
  toJSON() {
    return {
      text: this.text,
      typed: this.typed,
      startTime: this.startTime,
      endTime: this.endTime,
      errors: this.errors,
      finished: this.finished,
    };
  }

  // 反序列化
  static fromJSON(data) {
    const t = new TypingTest(data.text || '');
    t.typed = data.typed || '';
    t.startTime = data.startTime || null;
    t.endTime = data.endTime || null;
    t.errors = data.errors || 0;
    t.finished = !!data.finished;
    return t;
  }

  // 重置
  reset() {
    this.typed = '';
    this.startTime = null;
    this.endTime = null;
    this.errors = 0;
    this.finished = false;
  }
}

// 打字测试语料库（中英文混合）
const SAMPLES = [
  'The quick brown fox jumps over the lazy dog.',
  'Stay hungry, stay foolish. Keep moving forward every day.',
  'Practice makes perfect. The more you type, the faster you become.',
  'Technology is best when it brings people together.',
  'Simplicity is the ultimate sophistication in modern design.',
  '专注当下，把每一件小事做到极致，时间会给你答案。',
  '每一次敲击键盘，都是与计算机的一次对话。',
  '优秀的工具让复杂的事情变简单，让简单的事情更高效。',
];

function randomSample() {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
}

module.exports = { TypingTest, SAMPLES, randomSample };
