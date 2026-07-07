// test/test.js — 二维码管家核心逻辑测试（不依赖 Electron）
// 运行：node test/test.js
const assert = require('assert');
const { generateDataURL, generateSVG, decodeFromPNGBuffer, decodeFromImageData } = require('../src/core/qr-core');
const {
  buildWiFi, buildVCard, buildEmail, buildSMS, buildPhone, buildURL, buildText,
  buildContent, parseContent
} = require('../src/core/template');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

async function main() {
  console.log('\n[1] 模板拼装');
  // WiFi
  ok('WiFi 标准', buildWiFi({ ssid: 'MyWiFi', password: 'pass123', encryption: 'WPA' }) === 'WIFI:T:WPA;S:MyWiFi;P:pass123;H:false;;');
  ok('WiFi 无密码', buildWiFi({ ssid: 'Open', encryption: 'nopass' }) === 'WIFI:T:nopass;S:Open;P:;H:false;;');
  ok('WiFi 隐藏', buildWiFi({ ssid: 'H', password: 'p', hidden: true }) === 'WIFI:T:WPA;S:H;P:p;H:true;;');
  ok('WiFi 特殊字符转义', buildWiFi({ ssid: 'a;b', password: 'c"d', encryption: 'WPA' }) === 'WIFI:T:WPA;S:a\\;b;P:c\\"d;H:false;;');
  ok('WiFi 空名返回 null', buildWiFi({ ssid: '', encryption: 'WPA' }) === null);
  // vCard
  const vc = buildVCard({ firstName: '三', lastName: '张', phone: '13800000000', email: 'a@b.com' });
  ok('vCard 包含 BEGIN/END', vc.includes('BEGIN:VCARD') && vc.includes('END:VCARD'));
  ok('vCard 包含姓名', vc.includes('张;三') && vc.includes('FN:三 张'));
  ok('vCard 包含电话', vc.includes('TEL;TYPE=CELL:13800000000'));
  ok('vCard 空字段过滤', !vc.includes('ORG:'));
  // 邮箱
  ok('email 简单', buildEmail({ to: 'a@b.com' }) === 'mailto:a@b.com');
  ok('email 带主题正文', buildEmail({ to: 'a@b.com', subject: 'Hi', body: '内容' }) === 'mailto:a@b.com?subject=Hi&body=%E5%86%85%E5%AE%B9');
  ok('email 空收件人 null', buildEmail({ to: '' }) === null);
  // 短信
  ok('sms 无内容', buildSMS({ phone: '13800000000' }) === 'SMSTO:13800000000');
  ok('sms 有内容', buildSMS({ phone: '138', message: 'hi' }) === 'SMSTO:138:hi');
  ok('sms 空号 null', buildSMS({ phone: '' }) === null);
  // 电话
  ok('phone', buildPhone({ phone: '13800000000' }) === 'tel:13800000000');
  ok('phone 空 null', buildPhone({ phone: '' }) === null);
  // URL
  ok('url 补协议', buildURL({ url: 'example.com' }) === 'https://example.com');
  ok('url 已有协议', buildURL({ url: 'http://a.com' }) === 'http://a.com');
  ok('url 空 null', buildURL({ url: '' }) === null);
  // 文本
  ok('text', buildText({ text: 'hello' }) === 'hello');
  ok('text 空 null', buildText({ text: '' }) === null);
  // buildContent 分发
  ok('buildContent text', buildContent('text', { text: 'x' }) === 'x');
  ok('buildContent url', buildContent('url', { url: 'a.com' }) === 'https://a.com');
  ok('buildContent 未知类型抛错', (() => { try { buildContent('xxx', {}); return false; } catch (e) { return e.code === 'BAD_TYPE'; } })());

  console.log('\n[2] 内容解析 parseContent');
  ok('parse wifi', parseContent('WIFI:T:WPA;S:Home;P:1234;H:false;;').type === 'wifi');
  ok('parse url', parseContent('https://a.com').type === 'url');
  ok('parse tel', parseContent('tel:13800000000').type === 'phone');
  ok('parse sms', parseContent('SMSTO:138:hi').type === 'sms');
  ok('parse mailto', parseContent('mailto:a@b.com').type === 'email');
  ok('parse vcard', parseContent('BEGIN:VCARD\nEND:VCARD').type === 'vcard');
  ok('parse text', parseContent('普通文本').type === 'text');

  console.log('\n[3] 二维码生成');
  // 生成 dataURL
  let r = await generateDataURL('Hello', { width: 320, margin: 2 });
  ok('生成返回 dataURL', typeof r.dataURL === 'string' && r.dataURL.startsWith('data:image/png'));
  ok('宽度记录正确', r.width === 320);
  // 容错级别
  const ecls = ['L', 'M', 'Q', 'H'];
  for (const e of ecls) {
    const rr = await generateDataURL('x', { errorCorrectionLevel: e, width: 200 });
    ok('容错 ' + e, rr.dataURL.startsWith('data:image/png'));
  }
  // 颜色
  const colored = await generateDataURL('color', { dark: '#007aff', light: '#ffffff', width: 240 });
  ok('自定义颜色', colored.dataURL.startsWith('data:image/png'));
  // 空内容抛错
  ok('空内容抛错', await (async () => { try { await generateDataURL(''); return false; } catch (e) { return e.code === 'EMPTY_TEXT'; } })());
  // 错误颜色
  ok('错误颜色抛错', await (async () => { try { await generateDataURL('x', { dark: 'red' }); return false; } catch (e) { return e.code === 'BAD_COLOR'; } })());
  // 错误容错
  ok('错误容错抛错', await (async () => { try { await generateDataURL('x', { errorCorrectionLevel: 'X' }); return false; } catch (e) { return e.code === 'BAD_ECL'; } })());
  // SVG
  const svg = await generateSVG('Hello SVG');
  ok('生成 SVG', typeof svg === 'string' && svg.includes('<svg'));
  // 中文内容
  const zh = await generateDataURL('你好世界，二维码管家', { width: 360 });
  ok('中文内容生成', zh.dataURL.startsWith('data:image/png'));

  console.log('\n[4] 生成 → 解码 闭环');
  // 生成后解码
  const samples = ['Hello QR', 'https://github.com', 'WIFI:T:WPA;S:Test;P:pass123;H:false;;', '中文内容测试 123', 'tel:13800000000'];
  for (const s of samples) {
    const gen = await generateDataURL(s, { width: 400, margin: 2 });
    const b64 = gen.dataURL.split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    const dec = decodeFromPNGBuffer(buf);
    ok('闭环: ' + s.slice(0, 20), dec && dec.data === s);
  }
  // 非图片 buffer
  ok('非法 buffer 返回 null', decodeFromPNGBuffer(Buffer.from('not an image')) === null);
  ok('空 buffer 返回 null', decodeFromPNGBuffer(Buffer.alloc(0)) === null);
  // decodeFromImageData 非法
  ok('非法 imageData 返回 null', decodeFromImageData(null, 10, 10) === null);

  console.log('\n[5] WiFi 二维码闭环（实际场景）');
  const wifiContent = buildWiFi({ ssid: '办公室WiFi', password: 'office@2026', encryption: 'WPA' });
  const wifiGen = await generateDataURL(wifiContent, { width: 420, errorCorrectionLevel: 'M' });
  const wifiBuf = Buffer.from(wifiGen.dataURL.split(',')[1], 'base64');
  const wifiDec = decodeFromPNGBuffer(wifiBuf);
  ok('WiFi 闭环解码一致', wifiDec && wifiDec.data === wifiContent);
  ok('WiFi 解码后可解析', parseContent(wifiDec.data).type === 'wifi');

  console.log('\n========================');
  console.log('  通过: ' + pass + '  失败: ' + fail);
  console.log('========================\n');
  if (fail > 0) { console.error('❌ 测试未通过'); process.exit(1); }
  console.log('✅ 全部测试通过');
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
