/* =========================================================
   智物精管 web 演示原型 —— 饮食 / 我的 / 拍照流程（第 1 部分）
   ========================================================= */
var MEALS = [
  { key: 'breakfast', label: '早餐', icon: '🌅' },
  { key: 'lunch', label: '午餐', icon: '☀️' },
  { key: 'dinner', label: '晚餐', icon: '🌙' },
  { key: 'snack', label: '加餐', icon: '🍪' }
];
function mealLabel(key) { for (var i = 0; i < MEALS.length; i++) if (MEALS[i].key === key) return MEALS[i].label; return key; }

/* ---------- 饮食视图 ---------- */
function renderDiet() {
  var today = todayISO();
  var m = getMeals(today);
  var all = m.breakfast.concat(m.lunch, m.dinner, m.snack);
  var kcal = sumKcal(all);
  var p = sumNut(all, 'p'), f = sumNut(all, 'f'), c = sumNut(all, 'c');
  var target = (DB.profile && DB.profile.targetKcal) || 1800;
  var pct = Math.min(130, Math.round(kcal / target * 100));
  var pCal = Math.round(p * 4 / Math.max(1, kcal) * 100);
  var fCal = Math.round(f * 9 / Math.max(1, kcal) * 100);
  var cCal = Math.max(0, 100 - pCal - fCal);

  var html = '<div class="card">';
  html += '<h3>🍱 今日饮食 <span class="muted">' + today + '</span></h3>';
  html += '<div style="display:flex;justify-content:space-between;font-size:12.5px"><span class="muted">目标 ' + target + ' kcal</span><span>' + (kcal > target ? '已超标 ⚠️' : '剩余 ' + Math.max(0, target - kcal) + ' kcal') + '</span></div>';
  html += '<div class="kcal-progress"><i style="width:' + pct + '%" class="' + (kcal > target ? 'over' : '') + '"></i></div>';
  html += '<div class="nutri-row">';
  html += '<div class="nutri"><div class="v">' + Math.round(kcal) + '</div><div class="k">千卡</div></div>';
  html += '<div class="nutri"><div class="v">' + Math.round(p) + 'g</div><div class="k">蛋白质 ' + pCal + '%</div></div>';
  html += '<div class="nutri"><div class="v">' + Math.round(f) + 'g</div><div class="k">脂肪 ' + fCal + '%</div></div>';
  html += '<div class="nutri"><div class="v">' + Math.round(c) + 'g</div><div class="k">碳水 ' + cCal + '%</div></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:8px;margin-top:6px">';
  html += '<button class="btn btn-primary" style="flex:1" onclick="openCapture(\'diet\')">📷 拍照记一餐</button>';
  html += '<button class="btn btn-ghost" style="flex:1" onclick="openManualDiet()">✍️ 手动记一笔</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="card"><h3>📈 近 7 日摄入</h3>' + trendHTML(target) + '</div>';

  MEALS.forEach(function (meal) {
    var arr = m[meal.key] || [];
    html += '<div class="meal-sec">';
    html += '<div class="meal-head"><span>' + meal.icon + ' ' + meal.label + '</span><span class="kcal">' + sumKcal(arr) + ' kcal</span></div>';
    if (arr.length === 0) {
      html += '<div class="muted" style="padding:4px 2px 10px">还没有记录</div>';
    } else {
      arr.forEach(function (d) {
        html += '<div class="diet-row">';
        html += '<div class="pic">' + (d.icon || '🍽️') + '</div>';
        html += '<div class="meta"><div class="nm">' + esc(d.name) + (d.isEstimated ? ' <span class="tag">AI估算</span>' : '') + '</div>';
        html += '<div class="sb">' + (d.portion || '') + (d.tip ? ' · ' + esc(d.tip) : '') + '</div></div>';
        html += '<div class="kcal">' + d.kcal + ' <span class="muted">kcal</span></div>';
        html += '<button class="btn btn-sm btn-danger" onclick="dietDelete(\'' + meal.key + '\',\'' + d.id + '\')">✕</button>';
        html += '</div>';
      });
    }
    html += '</div>';
  });

  html += '<div class="advice-card"><div class="title">💡 今日健康小建议</div><ul>' + adviceItems(kcal, p, f, c, target) + '</ul><div class="disclaimer">以上为生活化建议，仅供参考，不构成医疗建议。</div></div>';

  $('#view').innerHTML = html;
}

function trendHTML(target) {
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    var iso = MOCK.iso(d);
    var m = getMeals(iso);
    var kcal = sumKcal(m.breakfast.concat(m.lunch, m.dinner, m.snack));
    days.push({ iso: iso, kcal: kcal, label: (d.getMonth() + 1) + '/' + d.getDate() });
  }
  var max = Math.max(target * 1.2, 100);
  var html = '<div class="trend">';
  days.forEach(function (x) {
    var hgt = Math.max(3, Math.round(x.kcal / max * 100));
    html += '<div class="bar-col"><div class="bar' + (x.kcal > target ? ' hit' : '') + '" style="height:' + hgt + 'px"></div><span class="lbl">' + x.label + '</span></div>';
  });
  html += '</div>';
  return html;
}

function adviceItems(kcal, p, f, c, target) {
  var out = [];
  if (kcal === 0) {
    out.push('今天还没有饮食记录，记得拍一拍或手动记一笔哦。');
    return out.map(function (s) { return '<li>' + s + '</li>'; }).join('');
  }
  var diff = kcal - target;
  if (diff > 0) out.push('今日摄入 ' + Math.round(diff) + ' kcal 超出目标，建议晚餐/加餐选择清淡蔬果，或多走动消耗。');
  else out.push('今日距目标还差 ' + Math.round(-diff) + ' kcal，注意不要用高糖零食补差。');
  var pKcal = p * 4;
  var pRatio = Math.round(pKcal / Math.max(1, kcal) * 100);
  if (pRatio < 15) out.push('蛋白质占比偏低（约 ' + pRatio + '%），可增加鸡蛋、鸡胸、豆制品或牛奶。');
  var fKcal = f * 9;
  if (fKcal / Math.max(1, kcal) > 0.35) out.push('脂肪占比偏高，留意油炸与酱料，多用蒸煮代替煎炸。');
  if (c > 0 && c > 180) out.push('碳水偏多（约 ' + Math.round(c) + 'g），可把部分精制主食换成粗粮。');
  if (out.length === 0) out.push('今日整体均衡，继续保持规律三餐和足量饮水。');
  return out.map(function (s) { return '<li>' + s + '</li>'; }).join('');
}

/* 删除一条饮食记录 */
function dietDelete(meal, id) {
  var m = getMeals(todayISO());
  m[meal] = (m[meal] || []).filter(function (x) { return x.id !== id; });
  saveDB(); render(); toast('已删除');
}

/* 手动记一笔 */
function openManualDiet() {
  var html = modalHead('✍️ 手动记一笔');
  html += '<div class="field"><label>食物名称 *</label><input id="md_name" placeholder="如：苹果（1 个）" /></div>';
  html += '<div class="form-grid">';
  html += '<div class="field"><label>热量（千卡）*</label><input id="md_kcal" type="number" min="0" placeholder="如：95" /></div>';
  html += '<div class="field"><label>餐次</label><select id="md_meal">';
  MEALS.forEach(function (x) { html += '<option value="' + x.key + '">' + x.label + '</option>'; });
  html += '</select></div>';
  html += '</div>';
  html += '<button class="btn btn-primary btn-block" onclick="saveManualDiet()">保存</button>';
  openModal(html, true);
}
function saveManualDiet() {
  var name = ($('#md_name').value || '').trim();
  var kcal = parseFloat($('#md_kcal').value);
  if (!name || isNaN(kcal)) { toast('请填写名称与热量'); return; }
  var meal = $('#md_meal').value;
  var m = getMeals(todayISO());
  m[meal].push({ id: uid(), name: name, portion: '1 份', kcal: kcal, p: 0, f: 0, c: 0, isEstimated: false });
  saveDB(); closeModal(); render(); toast('已记录：' + name);
}

/* =========================================================
   第 2 部分：我的 / 拍照识别流程 / 初始化
   ========================================================= */
/* ---------- 我的视图 ---------- */
function renderProfile() {
  var p = DB.profile;
  var s = DB.settings;
  var html = accountCardHTML();
  html += '<div class="card"><h3>🧑‍⚕️ 健康档案</h3>';
  html += '<div class="form-grid">';
  html += '<div class="field"><label>性别</label><select id="p_gender" onchange="saveProfile()">';
  html += '<option value="男"' + (p.gender === '男' ? ' selected' : '') + '>男</option>';
  html += '<option value="女"' + (p.gender === '女' ? ' selected' : '') + '>女</option></select></div>';
  html += '<div class="field"><label>年龄</label><input id="p_age" type="number" min="10" max="100" value="' + (p.age || 22) + '" onchange="saveProfile()" /></div>';
  html += '<div class="field"><label>身高 cm</label><input id="p_height" type="number" value="' + (p.height || 170) + '" onchange="saveProfile()" /></div>';
  html += '<div class="field"><label>体重 kg</label><input id="p_weight" type="number" value="' + (p.weight || 60) + '" onchange="saveProfile()" /></div>';
  html += '<div class="field"><label>活动量</label><select id="p_activity" onchange="saveProfile()">';
  var acts = [[1.2, '久坐（几乎不运动）'], [1.375, '轻度（每周1-3次）'], [1.55, '中度（每周3-5次）'], [1.725, '高度（每周6-7次）']];
  acts.forEach(function (a) {
    html += '<option value="' + a[0] + '"' + (String(p.activity) === String(a[0]) ? ' selected' : '') + '>' + a[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div class="field"><label>目标</label><select id="p_goal" onchange="saveProfile()">';
  var goals = ['减脂', '保持', '增肌'];
  goals.forEach(function (g) { html += '<option' + (p.goal === g ? ' selected' : '') + '>' + g + '</option>'; });
  html += '</select></div>';
  html += '</div>';
  html += '<button class="btn btn-ghost btn-block" onclick="recalcTarget()">🔄 按档案重新计算每日目标</button>';
  html += '<div class="muted" id="targetMeta" style="margin-top:8px"></div>';
  html += '</div>';

  html += '<div class="card"><h3>⏰ 提醒设置</h3>';
  html += '<div class="about-line"><b>提前提醒天数：</b>' + (s.remindDays || [30, 7, 3]).join(' / ') + ' 天</div>';
  html += '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="p_notify"' + (s.notify ? ' checked' : '') + ' onchange="updateNotify(this.checked)" /> 开启临期提醒（页面角标 + 列表高亮）</label>';
  html += '</div>';

  html += '<div class="card"><h3>🗂 数据管理</h3>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button class="btn btn-ghost" style="flex:1" onclick="exportData()">⬇️ 导出数据(JSON)</button>';
  html += '<button class="btn btn-danger" style="flex:1" onclick="resetDemo()">♻️ 重置演示数据</button>';
  html += '</div></div>';

  html += '<div class="card"><h3>ℹ️ 关于本项目</h3>';
  html += '<div class="about-line"><b>产品：</b>智物精管 · 一站式生活数字化助手</div>';
  html += '<div class="about-line"><b>赛道：</b>软件开发方向一（AI 创新应用）</div>';
  html += '<div class="about-line"><b>形态：</b>本页为“网页版交互原型”，识别结果当前为本地模拟（演示模式）。</div>';
  html += '<div class="about-line"><b>真实接入：</b>把照片上传后端后，经“意图路由”调用视觉大模型 / OCR，返回结构与 docs/04 一致，即可替换模拟数据。</div>';
  html += '<div class="disclaimer">健康建议仅供参考，不构成医疗建议。数据保存在本机浏览器 localStorage。</div>';
  html += '</div>';

  $('#view').innerHTML = html;
  var ct = computeTarget(p);
  $('#targetMeta').textContent = '估算：基础代谢 ' + ct.bmr + ' kcal · 每日消耗(TDEE) ' + ct.tdee + ' kcal · 当前目标 ' + ct.target + ' kcal';
}

function saveProfile() {
  var p = DB.profile;
  p.gender = $('#p_gender').value;
  p.age = parseInt($('#p_age').value, 10) || 22;
  p.height = parseInt($('#p_height').value, 10) || 170;
  p.weight = parseInt($('#p_weight').value, 10) || 60;
  p.activity = parseFloat($('#p_activity').value) || 1.4;
  p.goal = $('#p_goal').value;
  saveDB();
}
function recalcTarget() {
  saveProfile();
  var ct = computeTarget(DB.profile);
  DB.profile.targetKcal = ct.target;
  saveDB(); render(); toast('每日目标更新为 ' + ct.target + ' kcal');
}
function updateNotify(v) { DB.settings.notify = !!v; saveDB(); toast(v ? '已开启提醒' : '已关闭提醒'); }

function exportData() {
  var blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  var d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = '智物精管-数据备份-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('已导出数据');
}
function resetDemo() {
  if (!window.confirm('确定重置为演示数据？当前数据将丢失。')) return;
  DB = MOCK.seed(); markSynced(nowUTC()); render(); toast('已重置演示数据');
}

/* ---------- 拍照识别流程 ---------- */
function openCapture(intent) {
  if (intent) { pickSource(intent); return; }
  var html = modalHead('📷 拍一下，智能识别');
  html += '<div class="muted" style="margin-bottom:12px">选择识别类型，系统将调用（演示为模拟）视觉大模型理解图片内容：</div>';
  html += '<div class="intent-grid">';
  html += '<button class="intent" onclick="pickSource(\'item\')"><div class="ic">📦</div><div class="nm">物品入库</div><div class="ds">识别分类并记录位置</div></button>';
  html += '<button class="intent" onclick="pickSource(\'expiry\')"><div class="ic">🏷️</div><div class="nm">记录保质期</div><div class="ds">OCR 日期 + 到期提醒</div></button>';
  html += '<button class="intent" onclick="pickSource(\'diet\')"><div class="ic">🍱</div><div class="nm">记一餐</div><div class="ds">识别菜品并估算热量</div></button>';
  html += '</div>';
  openModal(html, true);
}
function pickSource(intent) {
  var html = modalHead('📷 选择图片来源');
  html += '<div style="display:flex;flex-direction:column;gap:10px">';
  html += '<button class="btn btn-primary" onclick="startPick(\'' + intent + '\',\'camera\')">📷 拍照（调用摄像头）</button>';
  html += '<button class="btn btn-ghost" onclick="startPick(\'' + intent + '\',\'album\')">🖼️ 从相册选择</button>';
  html += '</div>';
  html += '<div class="muted" style="margin-top:12px">浏览器会请求相机/文件权限；本演示选择图片后进入“AI 识别（模拟）”。</div>';
  openModal(html, true);
}
function isTouch() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }

function startPick(intent, mode) {
  closeModal();
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (mode === 'camera' && isTouch()) input.setAttribute('capture', 'environment');
  input.onchange = function () {
    if (input.files && input.files[0]) handleFile(input.files[0], intent);
  };
  input.click();
}

function handleFile(file, intent) {
  var reader = new FileReader();
  reader.onload = function (ev) {
    showAnalyzing(ev.target.result);
    setTimeout(function () { produceMock(ev.target.result, intent); }, 1100);
  };
  reader.readAsDataURL(file);
}
function showAnalyzing(preview) {
  var html = '<div class="analyzing"><div class="spinner"></div><div class="t1" style="font-weight:700">AI 正在识别…</div>';
  html += '<div class="muted">演示模式：正在调用（模拟）视觉大模型 / OCR</div>';
  html += '<img class="preview-img" src="' + preview + '" alt="preview" />';
  html += '</div>';
  openModal(html, true);
}
function produceMock(preview, intent) {
  if (intent === 'expiry') openExpiryConfirm(preview);
  else if (intent === 'diet') openDietConfirm(preview);
  else openItemConfirm(preview);
}

/* ---------- 物品识别结果确认 ---------- */
function openItemConfirm(preview) {
  var cands = MOCK.recognizeItems();
  var locs = listLocations();
  var opt = locs.map(function (l) { return '<option value="' + esc(l) + '"></option>'; }).join('');
  var html = modalHead('📦 物品识别结果');
  html += '<div class="muted" style="margin-bottom:8px">演示识别到 ' + cands.length + ' 件物品，请核对后入库（名称/分类可修改）：</div>';
  html += '<img class="preview-img" src="' + preview + '" alt="preview" />';
  cands.forEach(function (c, i) {
    html += '<div class="card" id="crow' + i + '" style="padding:12px;margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>物品 ' + (i + 1) + '</b><span class="muted">置信 ' + Math.round(c.confidence * 100) + '%</span></div>';
    html += '<div class="form-grid">';
    html += '<div class="field full"><label>名称</label><input class="cname" value="' + esc(c.name) + '" /></div>';
    html += '<div class="field"><label>分类</label><select class="ccat">';
    CATS.forEach(function (x) { html += '<option' + (x === c.category ? ' selected' : '') + '>' + x + '</option>'; });
    html += '</select></div>';
    html += '<div class="field"><label>数量</label><input class="ccount" type="number" min="1" value="' + (c.count || 1) + '" /></div>';
    html += '<div class="field full"><label>存放位置</label><input class="cloc" list="clocList" value="' + esc(c.location || '') + '" /><datalist id="clocList">' + opt + '</datalist></div>';
    html += '<div class="field full"><label>备注</label><input class="cnote" value="' + esc(c.note || '') + '" /></div>';
    html += '</div>';
    html += '<button class="btn btn-sm btn-danger" onclick="removeCand(' + i + ')">移除这项</button>';
    html += '</div>';
  });
  html += '<button class="btn btn-primary btn-block" onclick="saveItemConfirm()">✅ 确认入库 ' + cands.length + ' 件</button>';
  openModal(html, true);
}
function removeCand(i) {
  var el = document.getElementById('crow' + i);
  if (el) el.remove();
}
function saveItemConfirm() {
  var rows = $$('.cand-row, [id^="crow"]').filter(function (el) { return el.style.display !== 'none'; });
  var added = 0;
  rows.forEach(function (row) {
    var name = (row.querySelector('.cname').value || '').trim();
    if (!name) return;
    DB.items.push({
      id: uid(), name: name, kind: 'object', status: 'active', icon: '',
      category: row.querySelector('.ccat').value || '其他',
      count: Math.max(1, parseInt(row.querySelector('.ccount').value, 10) || 1),
      location: (row.querySelector('.cloc').value || '').trim() || '未设置位置',
      note: (row.querySelector('.cnote').value || '').trim(),
      createdAt: todayISO(), expireDate: '', storage: ''
    });
    added++;
  });
  if (added === 0) { toast('请至少保留一项'); return; }
  saveDB(); closeModal(); go('items'); toast('已入库 ' + added + ' 件物品');
}

/* ---------- 保质期识别结果确认 ---------- */
function openExpiryConfirm(preview) {
  var e = MOCK.recognizeExpiry();
  var html = modalHead('🏷️ 保质期识别结果');
  html += '<div class="muted" style="margin-bottom:8px">OCR + 大模型识别（演示），请核对字段后保存，系统将自动开启到期提醒：</div>';
  html += '<img class="preview-img" src="' + preview + '" alt="preview" />';
  html += '<div class="advice-card" style="margin-bottom:12px"><b>识别结论：</b>' + esc(e.name) + '，预计到期日 ' + esc(e.expireDate) + '（' + (e.daysLeft < 0 ? '已过期' + Math.abs(e.daysLeft) + ' 天' : '剩 ' + e.daysLeft + ' 天') + '）</div>';
  html += '<div class="field"><label>名称 *</label><input id="ex_name" value="' + esc(e.name) + '" /></div>';
  html += '<div class="form-grid">';
  html += '<div class="field"><label>类型</label><select id="ex_kind">';
  html += '<option value="food"' + (e.kind === 'food' ? ' selected' : '') + '>食品</option>';
  html += '<option value="medicine"' + (e.kind === 'medicine' ? ' selected' : '') + '>药品</option>';
  html += '</select></div>';
  html += '<div class="field"><label>保存条件</label><select id="ex_storage">';
  var storages = ['常温避光', '冷藏 2-6℃', '冷冻', '阴凉干燥', '开封后冷藏'];
  storages.forEach(function (s) { html += '<option' + (s === e.storage ? ' selected' : '') + '>' + s + '</option>'; });
  html += '</select></div>';
  html += '<div class="field"><label>到期日</label><input id="ex_expire" type="date" value="' + esc(e.expireDate) + '" /></div>';
  html += '<div class="field"><label>数量</label><input id="ex_count" type="number" min="1" value="' + (e.count || 1) + '" /></div>';
  html += '</div>';
  html += '<button class="btn btn-primary btn-block" onclick="saveExpiryConfirm()">✅ 保存并开启提醒</button>';
  openModal(html, true);
}
function saveExpiryConfirm() {
  var name = ($('#ex_name').value || '').trim();
  var expire = $('#ex_expire').value;
  if (!name) { toast('请填写名称'); return; }
  if (!expire) { toast('请选择到期日'); return; }
  var kind = $('#ex_kind').value;
  DB.items.push({
    id: uid(), name: name, kind: kind, status: 'active', icon: '',
    category: kind === 'medicine' ? '药品' : '食品',
    count: Math.max(1, parseInt($('#ex_count').value, 10) || 1),
    location: kind === 'medicine' ? '药箱' : '冰箱·冷藏层',
    storage: $('#ex_storage').value,
    expireDate: expire, note: '', createdAt: todayISO()
  });
  saveDB(); closeModal(); go('expiry'); toast('已保存并开启到期提醒');
}

/* ---------- 饮食识别结果确认 ---------- */
function defaultMealByHour() {
  var h = new Date().getHours();
  if (h < 9) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}
function openDietConfirm(preview) {
  var dishes = MOCK.recognizeDiet();
  window.dietCands = dishes;
  var html = modalHead('🍱 拍照记一餐（识别结果）');
  html += '<div class="muted" style="margin-bottom:8px">识别到 ' + dishes.length + ' 项（演示），可修改菜名 / 份量 / 热量后保存：</div>';
  html += '<img class="preview-img" src="' + preview + '" alt="preview" />';
  html += '<div class="field"><label>餐次</label><select id="dc_meal">';
  MEALS.forEach(function (x) { html += '<option value="' + x.key + '"' + (x.key === defaultMealByHour() ? ' selected' : '') + '>' + x.label + '</option>'; });
  html += '</select></div>';
  dishes.forEach(function (d, i) {
    html += '<div class="card" id="drow' + i + '" data-idx="' + i + '" style="padding:12px;margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>' + (d.icon || '🍽️') + ' ' + esc(d.name) + '</b><span class="tag">AI估算</span></div>';
    html += '<div class="form-grid">';
    html += '<div class="field full"><label>菜名</label><input class="dname" value="' + esc(d.name) + '" /></div>';
    html += '<div class="field"><label>份量</label><select class="dportion">';
    var ps = ['少', '中', '多'];
    ps.forEach(function (x) { html += '<option' + (x === d.portion ? ' selected' : '') + '>' + x + '</option>'; });
    html += '</select></div>';
    html += '<div class="field"><label>热量 kcal</label><input class="dkcal" type="number" min="0" value="' + d.kcal + '" /></div>';
    html += '</div>';
    html += '<button class="btn btn-sm btn-danger" onclick="removeDrow(' + i + ')">移除这项</button>';
    html += '</div>';
  });
  html += '<button class="btn btn-primary btn-block" onclick="saveDietConfirm()">✅ 保存 ' + dishes.length + ' 项</button>';
  openModal(html, true);
}
function removeDrow(i) {
  var el = document.getElementById('drow' + i);
  if (el) el.remove();
}
function saveDietConfirm() {
  var meal = $('#dc_meal').value;
  var rows = $$('[id^="drow"]').filter(function (el) { return el.parentNode; });
  var added = 0;
  rows.forEach(function (row) {
    var name = (row.querySelector('.dname').value || '').trim();
    var kcal = parseFloat(row.querySelector('.dkcal').value);
    if (!name || isNaN(kcal)) return;
    var idx = parseInt(row.getAttribute('data-idx'), 10) || 0;
    var base = (window.dietCands && window.dietCands[idx]) || {};
    getMeals(todayISO())[meal].push({
      id: uid(), name: name, portion: row.querySelector('.dportion').value,
      kcal: Math.round(kcal), p: base.p || 0, f: base.f || 0, c: base.c || 0,
      isEstimated: true, tip: base.tip || '', icon: base.icon || ''
    });
    added++;
  });
  if (added === 0) { toast('请至少保留一项'); return; }
  saveDB(); closeModal(); go('diet'); toast('已记入' + mealLabel(meal) + ' ' + added + ' 项');
}

/* ---------- 初始化 ---------- */
window.addEventListener('hashchange', render);
if (!location.hash) history.replaceState(null, '', '#home');
render();
cloudAuto();



/* =========================================================
   第 3 部分：账号与云同步（依赖 js/cloud.js）
   ========================================================= */
function accountCardHTML() {
  var cfgReady = (typeof Cloud !== 'undefined') && Cloud.isReady();
  var logged = cfgReady && Cloud.isLoggedIn();
  var h = '<div class="card"><h3>👤 账号与云同步</h3>';
  if (!cfgReady) {
    h += '<div class="muted" style="margin-bottom:10px">云端尚未配置：账号与多端同步未启用。请在 <b>web/config.js</b> 填入 Supabase 的 URL 与 anon key（步骤见 docs/09）。</div>';
    h += '<div class="actions"><button class="btn btn-sm btn-ghost" onclick="toast(\'请先填写 web/config.js\')">配置说明</button></div>';
  } else if (!logged) {
    h += '<div class="muted" style="margin-bottom:10px">登录后，数据将自动备份到云端，并可在多台设备间同步；本地仍可离线使用。</div>';
    h += '<button class="btn btn-primary btn-block" onclick="openAuthModal()">🔐 登录 / 注册</button>';
  } else {
    h += '<div class="about-line"><b>状态：</b>✅ 已登录</div>';
    h += '<div class="about-line"><b>账号：</b>' + esc(Cloud.currentEmail()) + '</div>';
    h += '<div class="about-line"><b>同步：</b>本地改动后自动上传 · 支持手动“立即同步”</div>';
    h += '<div class="actions">';
    h += '<button class="btn btn-sm btn-primary" onclick="cloudSyncNow(true)">🔄 立即同步</button>';
    h += '<button class="btn btn-sm btn-ghost" onclick="cloudLogout()">退出登录</button>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function openAuthModal() {
  if (typeof Cloud === 'undefined' || !Cloud.isReady()) { toast('请先配置 web/config.js 中的 Supabase 信息'); return; }
  var html = modalHead('🔐 登录 / 注册');
  html += '<div class="field"><label>邮箱</label><input id="au_email" type="email" placeholder="you@example.com" /></div>';
  html += '<div class="field"><label>密码（至少 6 位）</label><input id="au_pass" type="password" placeholder="••••••••" /></div>';
  html += '<div class="field"><label>操作</label><select id="au_mode"><option value="login">登录</option><option value="signup">注册新账号</option></select></div>';
  html += '<div class="muted" style="margin-bottom:10px">数据按账号隔离存储，仅本人可见（数据库行级安全 RLS）。注册后若提示需确认邮箱，请先在邮箱点击确认，或在 Supabase 后台关闭 Email confirm。</div>';
  html += '<button class="btn btn-primary btn-block" onclick="authSubmit()">提交</button>';
  openModal(html, true);
}
function authSubmit() {
  var email = ($('#au_email').value || '').trim();
  var pass = $('#au_pass').value || '';
  var mode = $('#au_mode').value;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('邮箱格式不正确'); return; }
  if (pass.length < 6) { toast('密码至少 6 位'); return; }
  var btn = document.querySelector('#modal-root .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '请稍候…'; }
  function done() { if (btn) { btn.disabled = false; btn.textContent = '提交'; } }
  if (mode === 'signup') {
    Cloud.signUp(email, pass).then(function () {
      return Cloud.signIn(email, pass).catch(function () { return null; });
    }).then(function (sess) {
      done();
      if (sess) { toast('注册成功，已自动登录'); afterLogin(); }
      else { toast('注册成功，请查收验证邮件后登录'); closeModal(); }
    }).catch(function (e) { done(); toast('注册失败：' + (e && e.message)); });
  } else {
    Cloud.signIn(email, pass).then(function () {
      done(); toast('登录成功'); afterLogin();
    }).catch(function (e) { done(); toast('登录失败：' + (e && e.message)); });
  }
}
function afterLogin() { closeModal(); render(); cloudSyncNow(true); }
function cloudSyncNow(showToast) {
  if (typeof Cloud === 'undefined' || !Cloud.isReady()) { toast('云端未配置'); return; }
  if (!Cloud.isLoggedIn()) { toast('请先登录'); return; }
  if (showToast) toast('同步中…');
  Cloud.syncNow(true).then(function (res) {
    if (!res.ok) {
      if (res.reason === 'noauth') toast('登录已失效，请重新登录');
      else if (res.reason === 'noconfig') toast('云端未配置');
      return;
    }
    render();
    var map = { uploaded: '已上传到云端', downloaded: '已从云端拉取最新数据', insync: '数据已是最新' };
    toast(map[res.action] || '同步完成');
  }).catch(function (e) { toast('同步失败：' + (e && e.message)); });
}
function cloudLogout() {
  if (typeof Cloud === 'undefined') return;
  Cloud.signOut().then(function () { toast('已退出登录（本地数据保留）'); render(); });
}
/* 页面启动时：若已登录则静默拉取一次云端（不打扰） */
function cloudAuto() {
  if (typeof Cloud !== 'undefined' && Cloud.isReady && Cloud.isLoggedIn()) {
    Cloud.syncNow(true).catch(function () { /* 静默 */ });
  }
}

