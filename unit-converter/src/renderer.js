// 渲染进程逻辑 - 单位转换器
const { categories, convert, formatNumber } = window.UnitConverter;

let currentCategory = 'length';

// 初始化类别选择器
function initCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = '';
  Object.keys(categories).forEach(key => {
    const cat = categories[key];
    const pill = document.createElement('button');
    pill.className = 'cat-pill' + (key === currentCategory ? ' active' : '');
    pill.textContent = `${cat.icon} ${cat.name}`;
    pill.dataset.key = key;
    pill.addEventListener('click', () => {
      currentCategory = key;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      populateUnits();
      doConvert();
    });
    container.appendChild(pill);
  });
}

// 填充单位下拉框
function populateUnits() {
  const cat = categories[currentCategory];
  const fromSelect = document.getElementById('fromUnit');
  const toSelect = document.getElementById('toUnit');
  const keys = Object.keys(cat.units);

  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';
  keys.forEach((key, i) => {
    const opt1 = document.createElement('option');
    opt1.value = key;
    opt1.textContent = cat.units[key].name;
    fromSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = key;
    opt2.textContent = cat.units[key].name;
    toSelect.appendChild(opt2);
  });

  // 默认选择前两个不同单位
  fromSelect.selectedIndex = 0;
  toSelect.selectedIndex = keys.length > 1 ? 1 : 0;
}

// 执行转换并更新界面
function doConvert() {
  const input = parseFloat(document.getElementById('inputValue').value);
  const fromUnit = document.getElementById('fromUnit').value;
  const toUnit = document.getElementById('toUnit').value;

  const resultEl = document.getElementById('resultValue');
  if (isNaN(input)) {
    resultEl.textContent = '—';
    updateReference(NaN, fromUnit);
    return;
  }

  try {
    const result = convert(currentCategory, input, fromUnit, toUnit);
    resultEl.textContent = formatNumber(result);
    updateReference(input, fromUnit);
  } catch (e) {
    resultEl.textContent = '错误';
  }
}

// 更新全单位参考表
function updateReference(value, fromUnit) {
  const cat = categories[currentCategory];
  const list = document.getElementById('referenceList');
  const countEl = document.getElementById('referenceCount');
  list.innerHTML = '';

  const keys = Object.keys(cat.units).filter(k => k !== fromUnit);
  countEl.textContent = `${keys.length} 项`;

  keys.forEach(key => {
    const item = document.createElement('div');
    item.className = 'ref-item';

    let val;
    if (isNaN(value)) {
      val = '—';
    } else {
      val = formatNumber(convert(currentCategory, value, fromUnit, key));
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ref-name';
    nameSpan.textContent = cat.units[key].name;

    const valSpan = document.createElement('span');
    valSpan.className = 'ref-value';
    valSpan.textContent = val;

    item.appendChild(nameSpan);
    item.appendChild(valSpan);
    list.appendChild(item);
  });
}

// 交换单位
function swapUnits() {
  const fromSelect = document.getElementById('fromUnit');
  const toSelect = document.getElementById('toUnit');
  const inputEl = document.getElementById('inputValue');

  const fromKey = fromSelect.value;
  const toKey = toSelect.value;

  fromSelect.value = toKey;
  toSelect.value = fromKey;

  // 把结果填入输入框
  const resultText = document.getElementById('resultValue').textContent;
  if (resultText !== '—' && resultText !== '错误') {
    inputEl.value = parseFloat(resultText) || inputEl.value;
  }
  doConvert();
}

// 复制结果
function copyResult() {
  const text = document.getElementById('resultValue').textContent;
  if (!text || text === '—' || text === '错误') return;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copied');
    btn.querySelector('.copy-text').textContent = '已复制';
    showToast('已复制到剪贴板');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.querySelector('.copy-text').textContent = '复制';
    }, 1500);
  });
}

// 显示提示
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

// 绑定事件
document.getElementById('inputValue').addEventListener('input', doConvert);
document.getElementById('fromUnit').addEventListener('change', doConvert);
document.getElementById('toUnit').addEventListener('change', doConvert);
document.getElementById('swapBtn').addEventListener('click', swapUnits);
document.getElementById('copyBtn').addEventListener('click', copyResult);

// 启动
initCategories();
populateUnits();
doConvert();
