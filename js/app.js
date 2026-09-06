/* =========================================================
   智物精管 web 演示原型 —— 核心逻辑（第 1 部分）
   依赖 js/mock.js（window.MOCK）
   ========================================================= */
var KEY = 'zhiwu_v1';
var DB = loadDB();

/* ---------- 工具 ---------- */
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function todayISO() { return MOCK.iso(new Date()); }
function daysUntil(dateISO) {
  if (!dateISO) return null;
  var t0 = new Date(); t0.setHours(0, 0, 0, 0);
  var d = new Date(dateISO + 'T00:00:00');
  return Math.round((d - t0) / 86400000);
}
function fmt(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return '已过期 ' + Math.abs(days) + ' 天';
  if (days === 0) return '今天到期';
  return '剩 ' + days + ' 天';
}
function fallbackIcon(item) {
  if (item.icon) return item.icon;
  var map = { '数码': '🔌', '文具': '🖊️', '药品': '💊', '食品': '🥫', '日用品': '🧴', '工具': '🪛', '衣物': '👕', '证件票据': '🪪', '运动户外': '🏸', '小家电': '💨', '其他': '📦' };
  return map[item.category] || '📦';
}

/* ---------- 数据存储 ---------- */
var applyingRemote = false;
function deviceId() {
  try {
    var k = 'zhiwu_device';
    var v = localStorage.getItem(k);
    if (!v) { v = 'dev-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v); }
    return v;
  } catch (e) { return 'dev-anon'; }
}
function nowUTC() { return new Date().toISOString(); }
function ensureMeta() {
  if (!DB.meta) DB.meta = {};
  if (!DB.meta.deviceId) DB.meta.deviceId = deviceId();
  if (!DB.meta.updatedAt) DB.meta.updatedAt = nowUTC();
  if (DB.meta.dirty === undefined) DB.meta.dirty = false;
}
function loadDB() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (d && d.items && d.dietLog) { if (!d.meta) d.meta = {}; return d; }
    }
  } catch (e) { /* file:// 下可能不可用，退回内存 */ }
  var s = MOCK.seed();
  if (!s.meta) s.meta = {};
  s.meta.deviceId = deviceId();
  s.meta.updatedAt = nowUTC();
  s.meta.dirty = false;
  return s;
}
function saveDB(skipRemote) {
  ensureMeta();
  if (!applyingRemote) { DB.meta.updatedAt = nowUTC(); DB.meta.dirty = true; }
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { /* 忽略配额/隐私模式错误 */ }
  if (!skipRemote && !applyingRemote && typeof Cloud !== 'undefined' && Cloud.isReady && Cloud.isReady() && Cloud.isLoggedIn()) {
    Cloud.scheduleSync();
  }
}
/* 云同步成功后：记录服务端时间，标记为已同步（不再触发上传） */
function markSynced(serverTime) {
  applyingRemote = true;
  ensureMeta();
  DB.meta.updatedAt = serverTime || nowUTC();
  DB.meta.dirty = false;
  saveDB(true);
  applyingRemote = false;
}
/* 拉取云端快照并应用到本地 */
function applyRemoteSnapshot(snap) {
  applyingRemote = true;
  DB = snap;
  ensureMeta();
  DB.meta.dirty = false;
  saveDB(true);
  applyingRemote = false;
  render();
}

/* ---------- 数据辅助 ---------- */
function activeItems() { return DB.items.filter(function (i) { return i.status !== 'done'; }); }
function expiringItems() {
  return activeItems().filter(function (i) { return i.expireDate; });
}
function getMeals(dateISO) {
  if (!DB.dietLog[dateISO]) DB.dietLog[dateISO] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  return DB.dietLog[dateISO];
}
function sumKcal(arr) { return arr.reduce(function (s, x) { return s + (Number(x.kcal) || 0); }, 0); }
function sumNut(arr, k) { return arr.reduce(function (s, x) { return s + (Number(x[k]) || 0); }, 0); }
function allTodayMeals() {
  var m = getMeals(todayISO());
  return m.breakfast.concat(m.lunch, m.dinner, m.snack);
}
function expiryLevel(days) {
  if (days === null) return null;
  if (days < 0) return { key: 'expired', label: '已过期', cls: 'red', sort: 0 };
  if (days <= 7) return { key: 'soon7', label: '7 天内到期', cls: 'orange', sort: 1 };
  if (days <= 30) return { key: 'soon30', label: '30 天内到期', cls: 'amber', sort: 2 };
  return { key: 'normal', label: '正常', cls: 'green', sort: 3 };
}
function daysChip(days) {
  var lv = expiryLevel(days);
  if (!lv) return '';
  return '<span class="days ' + lv.cls + '">' + fmt(days) + '</span>';
}
function computeTarget(p) {
  var w = Number(p.weight) || 60, h = Number(p.height) || 170, a = Number(p.age) || 22;
  var bmr = p.gender === '女' ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5;
  var tdee = Math.round(bmr * (Number(p.activity) || 1.4));
  var adj = p.goal === '减脂' ? -300 : (p.goal === '增肌' ? 200 : 0);
  var target = Math.max(1200, tdee + adj);
  return { bmr: Math.round(bmr), tdee: tdee, target: target };
}
function listLocations() {
  var set = {};
  DB.items.forEach(function (i) { if (i.location) set[i.location] = 1; });
  var base = ['书桌抽屉', '客厅电视柜·第2层', '卧室床头柜', '冰箱·冷藏层', '厨房橱柜', '药箱', '玄关柜'];
  base.forEach(function (x) { if (!set[x]) set[x] = 1; });
  return Object.keys(set);
}

/* ---------- 导航 / 路由 ---------- */
function go(view) {
  if (('#' + view) === location.hash) { render(); }
  else { location.hash = view; }
}
function currentView() {
  return (location.hash || '#home').replace('#', '') || 'home';
}
function render() {
  var v = currentView();
  var map = {
    home: renderHome,
    items: renderItems,
    expiry: renderExpiry,
    diet: renderDiet,
    profile: renderProfile
  };
  (map[v] || renderHome)();
  $$('#mainnav .nav-item').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-view') === v);
  });
  updateExpiryBadge();
  window.scrollTo(0, 0);
}

/* 底部导航角标：临期(<=7天+过期) 数量 */
function updateExpiryBadge() {
  var n = countUrgent();
  var nav = $('#mainnav .nav-item[data-view="expiry"] span');
  if (!nav) return;
  nav.textContent = n > 0 ? '⏰' : '⏰';
  nav.setAttribute('data-badge', n > 0 ? String(n) : '');
}
function countUrgent() {
  return expiringItems().filter(function (i) {
    var d = daysUntil(i.expireDate);
    return d !== null && d <= 7;
  }).length;
}
function statCounts() {
  return {
    items: activeItems().length,
    urgent: countUrgent(),
    expired: expiringItems().filter(function (i) { return daysUntil(i.expireDate) < 0; }).length,
    kcal: sumKcal(allTodayMeals()),
    target: (DB.profile && DB.profile.targetKcal) || 1800
  };
}

/* ---------- 首页视图 ---------- */
function renderHome() {
  var st = statCounts();
  var exp = expiringItems().slice().sort(function (a, b) {
    return (daysUntil(a.expireDate) || 0) - (daysUntil(b.expireDate) || 0);
  }).filter(function (i) { return daysUntil(i.expireDate) <= 30; }).slice(0, 3);
  var recent = activeItems().slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); }).slice(0, 3);

  var html = '';
  html += '<div class="hero-capture" onclick="openCapture()">';
  html += '  <div class="big">📷</div>';
  html += '  <div><div class="t1">拍一下，管理生活</div><div class="t2">物品入库 / 保质期 / 记一餐 · 一次拍照智能识别</div></div>';
  html += '</div>';

  html += '<div class="stat-grid">';
  html += '<div class="stat"><div class="num">' + st.items + '</div><div class="lbl">物品总数</div></div>';
  html += '<div class="stat"><div class="num ' + (st.urgent > 0 ? 'warn' : '') + '">' + st.urgent + '</div><div class="lbl">临期/过期</div></div>';
  html += '<div class="stat"><div class="num">' + st.kcal + '</div><div class="lbl">今日摄入 kcal</div></div>';
  html += '</div>';

  html += '<div class="card"><h3>⏰ 临期提醒 <span class="link" onclick="go(\'expiry\')">全部 →</span></h3>';
  if (exp.length === 0) {
    html += '<div class="muted">暂无临期物品，继续保持 ✅</div>';
  } else {
    exp.forEach(function (i) {
      var d = daysUntil(i.expireDate);
      html += '<div class="expiry-row" style="padding:7px 0;border-bottom:1px solid var(--line)">';
      html += '  <div class="pic">' + fallbackIcon(i) + '</div>';
      html += '  <div class="meta"><div class="name">' + esc(i.name) + '</div><div class="sub">' + esc(i.location || '') + (i.storage ? ' · ' + esc(i.storage) : '') + '</div></div>';
      html += '  <div class="right">' + daysChip(d) + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<div class="card"><h3>📦 最近入库 <span class="link" onclick="go(\'items\')">物品库 →</span></h3>';
  if (recent.length === 0) { html += '<div class="muted">还没有物品，点上方“拍一下”入库吧</div>'; }
  else {
    recent.forEach(function (i) {
      html += '<div class="expiry-row" style="padding:7px 0;border-bottom:1px solid var(--line)" onclick="openItemDetail(\'' + i.id + '\')">';
      html += '  <div class="pic">' + fallbackIcon(i) + '</div>';
      html += '  <div class="meta"><div class="name">' + esc(i.name) + '</div><div class="sub">📍 ' + esc(i.location || '未设置位置') + '</div></div>';
      html += '  <div class="right"><span class="tag cat">' + esc(i.category || '其他') + '</span></div>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<div class="card"><h3>🍱 今日饮食 <span class="link" onclick="go(\'diet\')">详情 →</span></h3>';
  var pct = Math.min(100, Math.round(st.kcal / st.target * 100));
  html += '<div style="display:flex;justify-content:space-between;font-size:12.5px"><span class="muted">目标 ' + st.target + ' kcal</span><span>' + (st.kcal > st.target ? '已超标 ⚠️' : '进度 ' + pct + '%') + '</span></div>';
  html += '<div class="kcal-progress"><i style="width:' + pct + '%" class="' + (st.kcal > st.target ? 'over' : '') + '"></i></div>';
  html += '</div>';

  $('#view').innerHTML = html;
}

/* =========================================================
   第 2 部分：物品库 / 保质期 视图与操作
   ========================================================= */
var CATS = ['数码', '文具', '药品', '食品', '日用品', '工具', '厨具', '衣物', '证件票据', '运动户外', '小家电', '其他'];
var itemQ = '';
var itemCat = '全部';

function catSelect(sel, cur) {
  var s = '<option value="">请选择</option>';
  CATS.forEach(function (c) { s += '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + c + '</option>'; });
  return '<select id="' + sel + '">' + s + '</select>';
}

/* ---------- 物品库视图 ---------- */
function renderItems() {
  var list = activeItems().slice();
  var kw = itemQ.trim().toLowerCase();
  if (kw) {
    list = list.filter(function (i) {
      return (i.name || '').toLowerCase().indexOf(kw) >= 0 ||
        (i.location || '').toLowerCase().indexOf(kw) >= 0 ||
        (i.category || '').toLowerCase().indexOf(kw) >= 0 ||
        (i.note || '').toLowerCase().indexOf(kw) >= 0;
    });
  }
  if (itemCat !== '全部') list = list.filter(function (i) { return (i.category || '其他') === itemCat; });
  list.sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

  var cats = ['全部'];
  activeItems().forEach(function (i) { if (cats.indexOf(i.category) < 0) cats.push(i.category); });

  var html = '<div class="card" style="padding:12px">';
  html += '<div class="searchbar"><input id="itemSearch" placeholder="🔍 搜索名称 / 位置 / 分类…" value="' + esc(itemQ) + '" oninput="itemSearch(this.value)" /></div>';
  html += '<div class="chips">';
  cats.forEach(function (c) {
    html += '<button class="chip' + (c === itemCat ? ' active' : '') + '" onclick="itemCatFilter(\'' + c + '\')">' + esc(c) + '</button>';
  });
  html += '</div>';
  html += '<button class="btn btn-primary btn-block" onclick="openItemForm(null)">＋ 手动添加物品</button>';
  html += '</div>';

  if (list.length === 0) {
    html += '<div class="empty"><div class="ic">📭</div><p>没有找到相关物品</p></div>';
  } else {
    html += '<div class="item-grid">';
    list.forEach(function (i) { html += itemCardHTML(i); });
    html += '</div>';
  }
  $('#view').innerHTML = html;
}
function itemSearch(v) { itemQ = v; renderItems(); }
function itemCatFilter(c) { itemCat = c; renderItems(); }

function itemCardHTML(i) {
  var d = i.expireDate ? daysUntil(i.expireDate) : null;
  var h = '<div class="item-card" onclick="openItemDetail(\'' + i.id + '\')">';
  h += '<div class="pic">' + fallbackIcon(i) + '</div>';
  h += '<div class="meta">';
  h += '<div class="name">' + esc(i.name) + '</div>';
  h += '<div class="sub">📍 ' + esc(i.location || '未设置位置') + (i.count > 1 ? ' · ×' + i.count : '') + '</div>';
  h += '<div class="foot">';
  h += '<span class="tag cat">' + esc(i.category || '其他') + '</span>';
  if (i.kind === 'food') h += '<span class="tag">食品</span>';
  if (i.kind === 'medicine') h += '<span class="tag">药品</span>';
  if (d !== null) h += daysChip(d);
  h += '</div></div></div>';
  return h;
}

/* ---------- 保质期视图 ---------- */
function expiryGroups() {
  var g = { expired: [], soon7: [], soon30: [], normal: [] };
  expiringItems().forEach(function (i) {
    var d = daysUntil(i.expireDate);
    var lv = expiryLevel(d);
    if (lv) g[lv.key].push(i);
  });
  var cmp = function (a, b) { return (daysUntil(a.expireDate) || 0) - (daysUntil(b.expireDate) || 0); };
  g.expired.sort(cmp); g.soon7.sort(cmp); g.soon30.sort(cmp); g.normal.sort(cmp);
  return g;
}

function renderExpiry() {
  var g = expiryGroups();
  var html = '<div class="card" style="padding:12px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">';
  html += '<div><b style="font-size:16px">⏰ 保质期提醒</b><div class="muted">临期分级 · 及时处理不浪费</div></div>';
  html += '<button class="btn btn-primary btn-sm" onclick="openCapture(\'expiry\')">📷 扫描包装</button>';
  html += '</div></div>';

  var groups = [
    { key: 'expired', title: '已过期', dot: 'red' },
    { key: 'soon7', title: '7 天内到期', dot: 'orange' },
    { key: 'soon30', title: '30 天内到期', dot: 'amber' },
    { key: 'normal', title: '正常（>30 天）', dot: 'green' }
  ];
  var total = g.expired.length + g.soon7.length + g.soon30.length + g.normal.length;
  if (total === 0) {
    html += '<div class="empty"><div class="ic">🎉</div><p>还没有食品/药品记录，点“扫描包装”拍一个吧</p></div>';
  } else {
    groups.forEach(function (gr) {
      var arr = g[gr.key];
      if (arr.length === 0) return;
      html += '<div class="group-title"><span class="dot ' + gr.dot + '"></span>' + gr.title + '<span class="cnt">' + arr.length + ' 件</span></div>';
      arr.forEach(function (i) {
        var d = daysUntil(i.expireDate);
        var isFood = i.kind !== 'medicine';
        html += '<div class="card" style="padding:12px;margin-bottom:8px">';
        html += '<div class="expiry-row">';
        html += '<div class="pic">' + fallbackIcon(i) + '</div>';
        html += '<div class="meta"><div class="name">' + esc(i.name) + (i.count > 1 ? ' <span class="muted">×' + i.count + '</span>' : '') + '</div>';
        html += '<div class="sub">📍 ' + esc(i.location || '') + (i.storage ? ' · ' + esc(i.storage) : '') + '</div></div>';
        html += '<div class="right">' + daysChip(d) + '<div class="muted" style="margin-top:2px">' + esc(i.expireDate) + '</div></div>';
        html += '</div>';
        html += '<div class="actions">';
        html += '<button class="btn btn-sm btn-primary" onclick="expireAction(\'' + i.id + '\',\'' + (isFood ? 'eat' : 'use') + '\')">' + (isFood ? '✅ 已食用' : '✅ 已用完') + '</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="expireAction(\'' + i.id + '\',\'discard\')">🗑 已丢弃</button>';
        html += '<button class="btn btn-sm btn-ghost" onclick="openItemDetail(\'' + i.id + '\')">✎ 编辑</button>';
        html += '</div></div>';
      });
    });
  }
  $('#view').innerHTML = html;
}

/* 处理临期：食用/用完/丢弃 -> 状态置 done */
function expireAction(id, act) {
  var item = null;
  DB.items.forEach(function (i) { if (i.id === id) item = i; });
  if (!item) return;
  if (act === 'eat' || act === 'use') { item.status = 'done'; item.doneNote = act === 'eat' ? '已食用' : '已用完'; }
  else { item.status = 'done'; item.doneNote = '已丢弃'; }
  saveDB();
  render();
  toast('已处理：' + item.name);
}

/* =========================================================
   第 3 部分：模态框 / Toast / 物品表单
   ========================================================= */
function openModal(html, center) {
  var mask = document.createElement('div');
  mask.className = 'modal-mask' + (center ? ' center' : '');
  mask.innerHTML = '<div class="modal">' + html + '</div>';
  mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
  var root = $('#modal-root');
  root.innerHTML = '';
  root.appendChild(mask);
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function modalHead(title) {
  return '<div class="modal-head"><h2>' + title + '</h2><button class="modal-close" onclick="closeModal()">×</button></div>';
}
function toast(msg) {
  var old = $('.toast'); if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 2200);
}

/* ---------- 物品 新建/编辑 表单 ---------- */
function openItemForm(item) {
  var isNew = !item;
  var it = item || { id: null, name: '', kind: 'object', category: '', count: 1, location: '', note: '', storage: '', expireDate: '' };
  var locs = listLocations();
  var opt = locs.map(function (l) { return '<option value="' + esc(l) + '"></option>'; }).join('');

  var html = modalHead(isNew ? '📦 物品入库' : '✎ 编辑物品');
  html += '<div class="field"><label>名称 *</label><input id="f_name" placeholder="例如：无线鼠标" value="' + esc(it.name) + '" /></div>';
  html += '<div class="form-grid">';
  html += '<div class="field"><label>类型</label><select id="f_kind" onchange="toggleKindFields()">';
  html += '<option value="object"' + (it.kind === 'object' ? ' selected' : '') + '>普通物品</option>';
  html += '<option value="food"' + (it.kind === 'food' ? ' selected' : '') + '>食品（需记保质期）</option>';
  html += '<option value="medicine"' + (it.kind === 'medicine' ? ' selected' : '') + '>药品（需记有效期）</option>';
  html += '</select></div>';
  html += '<div class="field"><label>分类</label>' + catSelect('f_cat', it.category) + '</div>';
  html += '<div class="field"><label>数量</label><input id="f_count" type="number" min="1" value="' + (it.count || 1) + '" /></div>';
  html += '<div class="field"><label>存放位置</label><input id="f_loc" list="locList" placeholder="如：书桌抽屉" value="' + esc(it.location || '') + '" /><datalist id="locList">' + opt + '</datalist></div>';
  html += '<div class="field full"><label>备注（品牌/颜色等）</label><input id="f_note" placeholder="可选" value="' + esc(it.note || '') + '" /></div>';
  html += '</div>';

  html += '<div id="expiryFields" style="display:none">';
  html += '<div class="form-grid">';
  html += '<div class="field"><label>保存条件</label><select id="f_storage">';
  var storages = ['常温避光', '冷藏 2-6℃', '冷冻', '阴凉干燥', '开封后冷藏'];
  storages.forEach(function (s) { html += '<option' + (s === it.storage ? ' selected' : '') + '>' + s + '</option>'; });
  html += '</select></div>';
  html += '<div class="field"><label>到期日</label><input id="f_expire" type="date" value="' + esc(it.expireDate || '') + '" /></div>';
  html += '</div>';
  html += '<label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)"><input type="checkbox" id="f_remind" checked /> 启用到期提醒</label>';
  html += '</div>';

  html += '<div style="display:flex;gap:10px;margin-top:6px">';
  html += '<button class="btn btn-primary" style="flex:1" onclick="saveItemForm()">保存</button>';
  if (!isNew) html += '<button class="btn btn-danger" onclick="deleteItem(\'' + it.id + '\')">删除</button>';
  html += '</div>';

  openModal(html, true);
  toggleKindFields();
}
function toggleKindFields() {
  var k = $('#f_kind') ? $('#f_kind').value : 'object';
  var box = $('#expiryFields');
  if (box) box.style.display = (k === 'food' || k === 'medicine') ? 'block' : 'none';
}

function saveItemForm() {
  var name = ($('#f_name').value || '').trim();
  if (!name) { toast('请填写名称'); return; }
  var kind = $('#f_kind').value;
  var isFood = (kind === 'food' || kind === 'medicine');
  var data = {
    name: name,
    kind: kind,
    category: $('#f_cat').value || '其他',
    count: Math.max(1, parseInt($('#f_count').value, 10) || 1),
    location: ($('#f_loc').value || '').trim() || '未设置位置',
    note: ($('#f_note').value || '').trim(),
    storage: isFood ? $('#f_storage').value : '',
    expireDate: isFood ? ($('#f_expire').value || '') : ''
  };
  var idInput = $('#f_id');
  var existingId = idInput ? idInput.value : null;

  // 判断当前是否为编辑（通过隐藏 input 或全局标记）
  var target = null;
  DB.items.forEach(function (i) { if (i.id === existingId) target = i; });
  if (target) {
    Object.keys(data).forEach(function (k) { target[k] = data[k]; });
    toast('已保存：' + name);
  } else {
    var item = {
      id: uid(), status: 'active', icon: '',
      createdAt: todayISO(), doneNote: ''
    };
    Object.keys(data).forEach(function (k) { item[k] = data[k]; });
    DB.items.push(item);
    toast('已入库：' + name);
  }
  saveDB(); closeModal(); render();
}

function deleteItem(id) {
  if (!window.confirm('确定删除该物品？此操作不可恢复。')) return;
  DB.items = DB.items.filter(function (i) { return i.id !== id; });
  saveDB(); closeModal(); render();
  toast('已删除');
}

function openItemDetail(id) {
  var it = null;
  DB.items.forEach(function (i) { if (i.id === id) it = i; });
  if (!it) return;
  openItemForm(it);
  // 记录当前编辑 id
  var hid = document.createElement('input');
  hid.type = 'hidden'; hid.id = 'f_id'; hid.value = it.id;
  $('#modal-root .modal').appendChild(hid);
}


