// renderer.js — 渲染层逻辑
// 职责：渲染事件列表、Hero、弹窗交互、搜索筛选

// 农历查表（与 date-utils.js 一致，renderer 端独立实现以避免 require）
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252
];
function lYearDays(y){let s=348;for(let i=0x8000;i>0x8;i>>=1)s+=(LUNAR_INFO[y-1900]&i)?1:0;return s+leapDays(y);}
function leapDays(y){return leapMonth(y)?((LUNAR_INFO[y-1900]&0x10000)?30:29):0;}
function leapMonth(y){return LUNAR_INFO[y-1900]&0xf;}
function monthDays(y,m){return (LUNAR_INFO[y-1900]&(0x10000>>m))?30:29;}
function solarToLunar(date){
  const base=new Date(1900,0,31);let off=Math.round((date-base)/86400000),i,temp=0;
  for(i=1900;i<2101&&off>0;i++){temp=lYearDays(i);off-=temp;}
  if(off<0){off+=temp;i--;}
  const year=i;const leap=leapMonth(year);let isLeap=false;
  for(i=1;i<13&&off>0;i++){
    if(leap>0&&i===leap+1&&!isLeap){i--;isLeap=true;temp=leapDays(year);}else{temp=monthDays(year,i);}
    if(isLeap&&i===leap+1)isLeap=false;off-=temp;
  }
  if(off===0&&leap>0&&i===leap+1){if(isLeap)isLeap=false;else{isLeap=true;i--;}}
  if(off<0){off+=temp;i--;}
  const month=i,day=off+1;
  const gz=TIAN_GAN[(year-4)%10]+DI_ZHI[(year-4)%12];
  return {year,month,day,isLeap,monthName:(isLeap?'闰':'')+LUNAR_MONTHS[month-1]+'月',dayName:LUNAR_DAYS[day-1],ganZhi:gz,zodiac:ZODIAC[(year-4)%12]};
}

// ===== 状态 =====
const CATEGORY_LABELS = { life:'生活', work:'工作', study:'学习', anniversary:'纪念日', festival:'节日', other:'其他' };
// 分类色：中等饱和度，避免刺眼，与苹果白底色协调
const CATEGORY_COLORS = { life:'#30b76c', work:'#0a7fea', study:'#4ab8e8', anniversary:'#e85a8a', festival:'#e8893c', other:'#8e8e93' };

let allEvents = [];
let editingId = null;
let selectedColor = '#007aff';
let statusFilter = 'all';
let searchKeyword = '';
let categoryFilter = 'all';

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const grid = $('grid');
const heroNumber = $('heroNumber');
const heroTitle = $('heroTitle');
const heroDate = $('heroDate');
const heroLabel = $('heroLabel');
const heroNote = $('heroNote');

// ===== 工具 =====
function pad(n){return String(n).padStart(2,'0');}
function formatDate(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseDate(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function daysBetween(a,b){const x=new Date(a.getFullYear(),a.getMonth(),a.getDate());const y=new Date(b.getFullYear(),b.getMonth(),b.getDate());return Math.round((y-x)/86400000);}
function weekdayCN(d){return ['日','一','二','三','四','五','六'][d.getDay()];}

// 农历年度重复：基于 baseDate 农历月日，在 from 当年/次年查公历
function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap){
  for(let i=0;i<400;i++){
    const d=new Date(lunarYear,0,1+i);
    if(d.getFullYear()>lunarYear+1)break;
    const l=solarToLunar(d);
    if(l.year===lunarYear&&l.month===lunarMonth&&l.day===lunarDay&&l.isLeap===!!isLeap)return d;
  }
  return null;
}
function nextOccurrence(event, from){
  if(!event||!event.date)return null;
  if(!event.repeat||event.repeat==='none')return parseDate(event.date);
  from=from||new Date();
  const base=parseDate(event.date);if(!base)return null;
  if(event.calendar==='lunar'){
    const bl=solarToLunar(base);
    const y=from.getFullYear();
    let s=lunarToSolar(y,bl.month,bl.day,bl.isLeap);
    if(s&&s>=new Date(from.getFullYear(),from.getMonth(),from.getDate()))return s;
    return lunarToSolar(y+1,bl.month,bl.day,bl.isLeap);
  }
  const y=from.getFullYear();
  const c=new Date(y,base.getMonth(),base.getDate());
  if(c>=new Date(from.getFullYear(),from.getMonth(),from.getDate()))return c;
  return new Date(y+1,base.getMonth(),base.getDate());
}

function computeStatus(event, from){
  const base=from||new Date();
  const next=nextOccurrence(event,base);
  if(!next)return {nextDate:null,days:0,past:false,isToday:false};
  const days=daysBetween(base,next);
  return {nextDate:next,nextDateStr:formatDate(next),days,past:days<0,isToday:days===0,lunar:event.calendar==='lunar'?solarToLunar(next):null};
}

function relativeText(days){
  if(days===0)return '就是今天';
  if(days>0){
    if(days===1)return '明天';
    if(days<30)return `还有 ${days} 天`;
    if(days<365)return `还有 ${Math.round(days/30)} 个月`;
    return `还有 ${Math.floor(days/365)} 年`;
  }
  const a=-days;
  if(a===1)return '昨天';
  if(a<30)return `已过 ${a} 天`;
  if(a<365)return `已过 ${Math.round(a/30)} 个月`;
  return `已过 ${Math.floor(a/365)} 年`;
}

function toast(msg){
  const t=$('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2200);
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ===== 渲染 =====
function render(){
  const today=new Date();
  // 顶栏日期（精简）
  const tl=solarToLunar(today);
  $('todayLabel').textContent=`${formatDate(today)} 星期${weekdayCN(today)} · 农历${tl.monthName}${tl.dayName}`;

  // 筛选
  let list=allEvents.map(e=>({event:e,status:computeStatus(e,today)}));
  if(searchKeyword){
    const k=searchKeyword.toLowerCase();
    list=list.filter(x=>x.event.title.toLowerCase().includes(k)||(x.event.note||'').toLowerCase().includes(k));
  }
  if(categoryFilter!=='all')list=list.filter(x=>x.event.category===categoryFilter);
  if(statusFilter==='upcoming')list=list.filter(x=>x.status.days>=0);
  else if(statusFilter==='past')list=list.filter(x=>x.status.days<0);

  // 排序：置顶→未来升序→过去降序
  list.sort((a,b)=>{
    if(a.event.pinned!==b.event.pinned)return a.event.pinned?-1:1;
    const af=a.status.days>=0,bf=b.status.days>=0;
    if(af&&bf)return a.status.days-b.status.days;
    if(af&&!bf)return -1;
    if(!af&&bf)return 1;
    return b.status.days-a.status.days;
  });

  $('countHint').textContent=`共 ${list.length} 个事件`;

  // Hero：取第一个未来事件（无事件时隐藏，避免与空状态冗余）
  const heroEl=$('hero');
  if(allEvents.length===0){
    heroEl.style.display='none';
  }else{
    heroEl.style.display='flex';
    const heroCand=list.find(x=>x.status.days>=0)||list[0];
    renderHero(heroCand,today);
  }

  // 空状态
  if(list.length===0){
    grid.innerHTML='';
    $('emptyState').style.display='block';
    return;
  }
  $('emptyState').style.display='none';

  grid.innerHTML=list.map(x=>renderCard(x,today)).join('');
  // 绑定点击
  grid.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click',()=>openEdit(el.dataset.id));
  });
}

function renderHero(x,today){
  if(!x){heroLabel.textContent='暂无事件';heroTitle.textContent='—';heroDate.textContent='点击「新建事件」开始记录';heroNote.textContent='';heroNumber.innerHTML='—';return;}
  const {event,status}=x;
  const days=status.days;
  let numHtml='';
  if(days===0){numHtml='今天';heroLabel.textContent='就是今天';}
  else if(days>0){
    numHtml=`${Math.abs(days)}<span class="unit">天</span>`;
    heroLabel.textContent=days===1?'明天':'距离还有';
  }else{
    numHtml=`${Math.abs(days)}<span class="unit">天</span>`;
    heroLabel.textContent='已过去';
  }
  heroTitle.textContent=event.title;
  const l=status.lunar;
  const dateStr=status.nextDateStr+` 星期${weekdayCN(status.nextDate)}`+(l?` · 农历${l.monthName}${l.dayName}`:'');
  heroDate.textContent=dateStr;
  heroNote.textContent=event.note||'';
  heroNumber.innerHTML=numHtml;
}

function renderCard(x,today){
  const {event,status}=x;
  const color=CATEGORY_COLORS[event.category]||event.color||'#007aff';
  const soft=hexToRgba(color,0.12);
  const days=status.days;
  let numText,unitText,label;
  if(days===0){numText='今天';unitText='';label='当天';}
  else if(days>0){numText=Math.abs(days);unitText='天';label=relativeText(days);}
  else{numText=Math.abs(days);unitText='天';label=relativeText(days);}
  const cls=days>=0?'future':'past';
  const l=status.lunar;
  const mainDate=`${status.nextDateStr} 星期${weekdayCN(status.nextDate)}`;
  const subParts=[];
  if(l) subParts.push(`农历${l.monthName}${l.dayName}`);
  if(event.repeat==='yearly') subParts.push('每年');
  const subDate=subParts.join(' · ');
  return `
  <div class="card ${event.pinned?'pinned':''}" data-id="${event.id}" style="--card-color:${color};--card-color-soft:${soft}">
    <div class="card-head">
      <span class="card-cat" style="color:${color};background:${soft}">${CATEGORY_LABELS[event.category]||'其他'}</span>
      ${event.pinned?'<span class="card-pin">★</span>':''}
    </div>
    <div class="card-title">${escapeHtml(event.title)}</div>
    <div class="card-date">${mainDate}${subDate?`<span class="card-date-sub"> · ${subDate}</span>`:''}</div>
    <div class="card-days">
      <span class="card-days-num ${cls}">${numText}</span>
      ${unitText?`<span class="card-days-unit">${unitText}</span>`:''}
      <span class="card-days-label">${label}</span>
    </div>
    ${l?`<div class="card-lunar">${l.ganZhi}年 · ${l.zodiac}</div>`:''}
  </div>`;
}

function hexToRgba(hex,a){
  const m=/^#?([0-9a-f]{6})$/i.exec(hex);
  if(!m)return `rgba(0,122,255,${a})`;
  const n=parseInt(m[1],16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

// ===== 弹窗 =====
function openAdd(){
  editingId=null;
  $('modalTitle').textContent='新建事件';
  $('deleteBtn').style.display='none';
  $('fTitle').value='';
  $('fDate').value=formatDate(new Date());
  $('fCalendar').value='solar';
  $('fRepeat').value='none';
  $('fCategory').value='life';
  $('fNote').value='';
  $('fPinned').checked=false;
  selectColor('#007aff');
  $('modalMask').classList.add('show');
  setTimeout(()=>$('fTitle').focus(),50);
}

function openEdit(id){
  const event=allEvents.find(e=>e.id===id);
  if(!event)return;
  editingId=id;
  $('modalTitle').textContent='编辑事件';
  $('deleteBtn').style.display='inline-block';
  $('fTitle').value=event.title;
  $('fDate').value=event.date;
  $('fCalendar').value=event.calendar;
  $('fRepeat').value=event.repeat;
  $('fCategory').value=event.category;
  $('fNote').value=event.note||'';
  $('fPinned').checked=!!event.pinned;
  selectColor(event.color||CATEGORY_COLORS[event.category]||'#007aff');
  $('modalMask').classList.add('show');
}

function closeModal(){$('modalMask').classList.remove('show');}

function selectColor(c){
  selectedColor=c;
  document.querySelectorAll('.color-dot').forEach(d=>{
    d.classList.toggle('active',d.dataset.color===c);
    if(d.dataset.color===c)d.style.color=c;
  });
}

async function saveEvent(){
  const title=$('fTitle').value.trim();
  if(!title){toast('请填写事件名称');return;}
  const date=$('fDate').value;
  if(!date){toast('请选择日期');return;}
  const raw={
    title,
    date,
    calendar:$('fCalendar').value,
    repeat:$('fRepeat').value,
    category:$('fCategory').value,
    color:selectedColor,
    note:$('fNote').value.trim(),
    pinned:$('fPinned').checked
  };
  if(editingId){
    const r=await window.api.updateEvent(editingId,raw);
    if(r&&!r.error){toast('已更新');}
    else{toast('更新失败');return;}
  }else{
    const r=await window.api.addEvent(raw);
    if(r&&!r.error){toast('已创建');}
    else{toast('创建失败');return;}
  }
  closeModal();
  await reload();
}

async function deleteEvent(){
  if(!editingId)return;
  if(!confirm('确定删除这个事件吗？'))return;
  const r=await window.api.deleteEvent(editingId);
  if(r===true||r.ok){toast('已删除');closeModal();await reload();}
  else toast('删除失败');
}

async function reload(){
  allEvents=await window.api.loadEvents();
  render();
}

// ===== 事件绑定 =====
function bind(){
  $('addBtn').addEventListener('click',openAdd);
  $('modalCloseBtn').addEventListener('click',closeModal);
  $('cancelBtn').addEventListener('click',closeModal);
  $('saveBtn').addEventListener('click',saveEvent);
  $('deleteBtn').addEventListener('click',deleteEvent);
  $('modalMask').addEventListener('click',(e)=>{if(e.target===$('modalMask'))closeModal();});
  document.querySelectorAll('.color-dot').forEach(d=>{
    d.addEventListener('click',()=>selectColor(d.dataset.color));
  });
  $('searchInput').addEventListener('input',(e)=>{searchKeyword=e.target.value.trim();render();});
  $('categoryFilter').addEventListener('change',(e)=>{categoryFilter=e.target.value;render();});
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click',()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      statusFilter=t.dataset.status;
      render();
    });
  });
  $('exportBtn').addEventListener('click',async()=>{
    const r=await window.api.exportEvents();
    if(r&&r.ok)toast('已导出到：'+r.path);
    else if(r&&r.error)toast('导出失败：'+r.error);
  });
  $('importBtn').addEventListener('click',async()=>{
    const r=await window.api.importEvents();
    if(r&&r.ok){toast(`已导入，共 ${r.count} 个事件`);await reload();}
    else if(r&&r.error)toast('导入失败：'+r.error);
  });
  $('afdianLink').addEventListener('click',async()=>{
    await window.api.openExternal('https://www.ifdian.net/a/giquwei');
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape' && $('modalMask').classList.contains('show'))closeModal();
    if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();openAdd();}
  });
}

// ===== 启动 =====
(async function init(){
  bind();
  await reload();
})();
