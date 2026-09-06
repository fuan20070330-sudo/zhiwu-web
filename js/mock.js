/* =========================================================
   智物精管 web 演示原型 —— 模拟 AI 识别 + 演示种子数据
   说明：真实版本将把图片上传后端，经“意图路由”调用视觉大
   模型/OCR（返回 JSON Schema 与 docs/04 一致），此处以本地
   模拟数据替代，便于纯前端演示完整交互闭环。
   ========================================================= */
(function () {
  'use strict';

  function addDays(base, n) {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }
  function iso(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function daysAgo(n) { return iso(addDays(new Date(), -n)); }

  /* ---------- 物品（通用物品池，用于“模拟物品识别”） ---------- */
  const itemPool = [
    { name: '无线鼠标', category: '数码', location: '书桌抽屉', note: '黑色 罗技', icon: '🖱️' },
    { name: 'HDMI 视频线', category: '数码', location: '客厅电视柜·第2层', note: '长约 1.5 米', icon: '🔌' },
    { name: '手机充电线', category: '数码', location: '卧室床头柜', note: 'Type-C 快充', icon: '🔋' },
    { name: '蓝牙耳机', category: '数码', location: '书包夹层', note: '白色 入耳式', icon: '🎧' },
    { name: '雨伞', category: '日用品', location: '玄关柜', note: '黑色折叠伞', icon: '☂️' },
    { name: '指甲剪套装', category: '日用品', location: '卫生间镜柜', note: '含指甲锉', icon: '✂️' },
    { name: '身份证', category: '证件票据', location: '钱包卡位', note: '妥善保管', icon: '🪪' },
    { name: '宿舍钥匙', category: '证件票据', location: '书包内袋', note: '带门禁卡', icon: '🔑' },
    { name: '保温杯', category: '日用品', location: '办公桌', note: '500ml 灰色', icon: '🥤' },
    { name: '笔记本(文具)', category: '文具', location: '书桌书架', note: 'A5 横线', icon: '📓' },
    { name: '签字笔', category: '文具', location: '笔筒', note: '黑色 0.5mm', icon: '🖊️' },
    { name: '螺丝刀套装', category: '工具', location: '工具箱', note: '十字/一字', icon: '🪛' },
    { name: '羽毛球拍', category: '运动户外', location: '阳台储物柜', note: '碳素 单支', icon: '🏸' },
    { name: '围巾', category: '衣物', location: '衣柜上层', note: '灰色针织', icon: '🧣' },
    { name: '吹风机', category: '小家电', location: '卫生间镜柜', note: '1600W', icon: '💨' }
  ];

  /* ---------- 包装食品/药品池（用于“模拟保质期识别”） ---------- */
  // daysLeft：相对今天的剩余天数（负数=已过期）
  const expiryPool = [
    { name: '风味酸奶(原味)', kind: 'food', storage: '冷藏 2-6℃', daysLeft: 3, count: 2, icon: '🥛', note: '净含量 100g×8' },
    { name: '纯牛奶(250ml)', kind: 'food', storage: '常温避光', daysLeft: 6, count: 6, icon: '🥛', note: '利乐包' },
    { name: '挂面(1kg)', kind: 'food', storage: '常温干燥', daysLeft: 120, count: 1, icon: '🍜', note: '保质期 12 个月' },
    { name: '沙拉酱(蛋黄味)', kind: 'food', storage: '开封后冷藏', daysLeft: -2, count: 1, icon: '🥗', note: '已开封' },
    { name: '感冒灵颗粒', kind: 'medicine', storage: '密封 阴凉', daysLeft: 1, count: 1, icon: '💊', note: '有效期至' },
    { name: '维生素C泡腾片', kind: 'medicine', storage: '密封 阴凉', daysLeft: 40, count: 1, icon: '💊', note: '建议 3 个月内用完' }
  ];

  /* ---------- 菜品池（用于“模拟拍照记一餐”） ---------- */
  const dietPool = [
    { name: '黄焖鸡米饭', kcal: 720, p: 38, f: 26, c: 86, icon: '🍗', tip: '油偏多' },
    { name: '番茄炒蛋盖饭', kcal: 560, p: 22, f: 18, c: 78, icon: '🍅', tip: '整体均衡' },
    { name: '兰州牛肉拉面', kcal: 550, p: 25, f: 16, c: 78, icon: '🍜', tip: '汤偏咸' },
    { name: '鸡胸肉沙拉', kcal: 320, p: 38, f: 9, c: 22, icon: '🥗', tip: '高蛋白低脂' },
    { name: '清炒时蔬', kcal: 90, p: 3, f: 5, c: 9, icon: '🥬', tip: '少油版' },
    { name: '米饭(小碗)', kcal: 230, p: 4, f: 1, c: 52, icon: '🍚', tip: '主食' },
    { name: '可乐(330ml)', kcal: 142, p: 0, f: 0, c: 35, icon: '🥤', tip: '含糖饮料' },
    { name: '无糖豆浆(杯)', kcal: 70, p: 5, f: 2, c: 8, icon: '🥛', tip: '早餐推荐' },
    { name: '煎蛋(1个)', kcal: 95, p: 6, f: 7, c: 1, icon: '🍳', tip: '少油煎' },
    { name: '麻辣烫(中碗)', kcal: 680, p: 30, f: 30, c: 65, icon: '🍲', tip: '注意酱料热量' }
  ];

  /* ---------- 模拟识别函数（返回结构与 docs/04 的 JSON Schema 对齐） ---------- */
  function recognizeItems() {
    const n = 1 + Math.floor(Math.random() * 2); // 1~2 件
    const picked = [];
    const used = new Set();
    while (picked.length < n && picked.length < itemPool.length) {
      const idx = Math.floor(Math.random() * itemPool.length);
      if (used.has(idx)) continue;
      used.add(idx);
      const it = itemPool[idx];
      picked.push({
        name: it.name, category: it.category, location: it.location,
        note: it.note, icon: it.icon, count: 1, confidence: +(0.82 + Math.random() * 0.17).toFixed(2)
      });
    }
    return picked;
  }

  function recognizeExpiry() {
    const it = expiryPool[Math.floor(Math.random() * expiryPool.length)];
    const today = new Date();
    const exp = addDays(today, it.daysLeft);
    return {
      name: it.name, kind: it.kind, storage: it.storage, count: it.count,
      icon: it.icon, note: it.note, confidence: +(0.85 + Math.random() * 0.14).toFixed(2),
      expireDate: iso(exp), daysLeft: it.daysLeft
    };
  }

  function recognizeDiet() {
    // 随机 1 主菜 + 概率配主食/饮料
    const picked = [];
    const add = (pool) => {
      const it = pool[Math.floor(Math.random() * pool.length)];
      picked.push({
        name: it.name, icon: it.icon, kcal: it.kcal, p: it.p, f: it.f, c: it.c,
        tip: it.tip, portion: '中', isEstimated: true
      });
    };
    add(dietPool.slice(0, 5));          // 主菜
    if (Math.random() > 0.3) add([dietPool[5]]);            // 米饭
    if (Math.random() > 0.55) add(dietPool.slice(6, 10));   // 饮品/小食
    return picked;
  }

  /* ---------- 首次进入的演示种子数据 ---------- */
  function seed() {
    const items = [
      // 通用物品
      { id: 'it1', name: 'HDMI 视频线', category: '数码', location: '客厅电视柜·第2层', note: '长约 1.5 米', icon: '🔌', count: 1, status: 'active', kind: 'object', createdAt: daysAgo(20) },
      { id: 'it2', name: '无线鼠标', category: '数码', location: '书桌抽屉', note: '黑色 罗技', icon: '🖱️', count: 1, status: 'active', kind: 'object', createdAt: daysAgo(15) },
      { id: 'it3', name: '手机充电线', category: '数码', location: '卧室床头柜', note: 'Type-C 快充', icon: '🔋', count: 2, status: 'active', kind: 'object', createdAt: daysAgo(12) },
      { id: 'it4', name: '蓝牙耳机', category: '数码', location: '书包夹层', note: '白色 入耳式', icon: '🎧', count: 1, status: 'active', kind: 'object', createdAt: daysAgo(6) },
      { id: 'it5', name: '雨伞', category: '日用品', location: '玄关柜', note: '黑色折叠伞', icon: '☂️', count: 1, status: 'active', kind: 'object', createdAt: daysAgo(4) },
      // 食品 / 药品（带到期）
      { id: 'it6', name: '风味酸奶(原味)', kind: 'food', category: '食品', location: '冰箱·冷藏层', icon: '🥛', count: 2, status: 'active', storage: '冷藏 2-6℃', expireDate: iso(addDays(new Date(), 3)), createdAt: daysAgo(9) },
      { id: 'it7', name: '纯牛奶(250ml)', kind: 'food', category: '食品', location: '储物柜', icon: '🥛', count: 6, status: 'active', storage: '常温避光', expireDate: iso(addDays(new Date(), 6)), createdAt: daysAgo(8) },
      { id: 'it8', name: '挂面(1kg)', kind: 'food', category: '食品', location: '厨房橱柜', icon: '🍜', count: 1, status: 'active', storage: '常温干燥', expireDate: iso(addDays(new Date(), 120)), createdAt: daysAgo(30) },
      { id: 'it9', name: '沙拉酱(蛋黄味)', kind: 'food', category: '食品', location: '冰箱·冷藏层', icon: '🥗', count: 1, status: 'active', storage: '开封后冷藏', expireDate: iso(addDays(new Date(), -2)), createdAt: daysAgo(20) },
      { id: 'it10', name: '感冒灵颗粒', kind: 'medicine', category: '药品', location: '药箱', icon: '💊', count: 1, status: 'active', storage: '密封 阴凉', expireDate: iso(addDays(new Date(), 1)), createdAt: daysAgo(60) }
    ];

    const today = iso(new Date());
    const dietLog = {};
    dietLog[today] = {
      breakfast: [],
      lunch: [
        { id: 'd1', name: '黄焖鸡米饭', icon: '🍗', portion: '中', kcal: 720, p: 38, f: 26, c: 86, isEstimated: true, tip: '油偏多' },
        { id: 'd2', name: '可乐(330ml)', icon: '🥤', portion: '1瓶', kcal: 142, p: 0, f: 0, c: 35, isEstimated: true, tip: '含糖饮料' }
      ],
      dinner: [],
      snack: []
    };

    return {
      version: 1,
      profile: { gender: '男', age: 21, height: 175, weight: 65, activity: 1.4, goal: '减脂', targetKcal: 1800 },
      settings: { remindDays: [30, 7, 3], notify: true },
      items: items,
      dietLog: dietLog
    };
  }

  window.MOCK = {
    itemPool: itemPool,
    expiryPool: expiryPool,
    dietPool: dietPool,
    recognizeItems: recognizeItems,
    recognizeExpiry: recognizeExpiry,
    recognizeDiet: recognizeDiet,
    seed: seed,
    daysAgo: daysAgo,
    iso: iso,
    addDays: addDays
  };
})();
