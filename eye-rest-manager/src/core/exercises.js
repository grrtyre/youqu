// exercises.js — 眼保健操动作库
// 职责：定义休息时引导用户执行的眼部放松动作，供休息覆盖层轮播展示
// 纯数据模块，便于测试

'use strict';

// 每个动作包含：标题、引导文字、建议持续秒数、图标符号（emoji 备用）
const EXERCISES = [
  {
    id: 'blink',
    title: '轻柔眨眼',
    instruction: '缓慢闭合双眼，停顿 2 秒，再缓缓睁开。重复数次，让泪膜重新滋润眼球。',
    durationSec: 20,
    icon: '👁'
  },
  {
    id: 'far-focus',
    title: '远眺 20 英尺',
    instruction: '将视线移向 6 米（20 英尺）以外的远处景物，放松睫状肌，持续约 20 秒。',
    durationSec: 20,
    icon: '🌅'
  },
  {
    id: 'rotate',
    title: '眼球转动',
    instruction: '保持头部不动，眼球顺时针缓慢转动 5 圈，再逆时针 5 圈，缓解眼肌疲劳。',
    durationSec: 30,
    icon: '🔄'
  },
  {
    id: 'palming',
    title: '掌心捂眼',
    instruction: '双手搓热，掌心轻覆于闭合的双眼上，感受温热与黑暗，深呼吸放松。',
    durationSec: 40,
    icon: '🤲'
  },
  {
    id: 'focus-shift',
    title: '远近聚焦',
    instruction: '先看鼻尖 3 秒，再望远处 3 秒，反复数次，训练眼睛对焦灵活性。',
    durationSec: 30,
    icon: '🔁'
  },
  {
    id: 'water-break',
    title: '起身喝水',
    instruction: '站起身走动几步，喝一口温水，让身体和眼睛都得到短暂休整。',
    durationSec: 30,
    icon: '💧'
  }
];

// 按休息类型选择合适的动作集
// - micro (20s)：只放短动作
// - short (3min)：放中等长度的多个动作
// - long (10min)：放全部动作
function pickExercises(type, durationSec) {
  if (type === 'micro') {
    return EXERCISES.filter(e => e.durationSec <= 20).slice(0, 3);
  }
  if (type === 'short') {
    return EXERCISES.filter(e => e.durationSec <= 30).slice(0, 4);
  }
  // long
  return EXERCISES.slice();
}

module.exports = {
  EXERCISES,
  pickExercises
};
