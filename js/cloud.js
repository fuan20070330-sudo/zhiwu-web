/* =========================================================
   智物精管 · 云端账号与同步引擎（Supabase REST）
   依赖：web/config.js（SUPABASE_URL / SUPABASE_ANON_KEY）
         js/app.js 暴露的 DB / ensureMeta / markSynced / applyRemoteSnapshot
   说明：数据以“整份快照”存取（表 user_data），登录后自动同步；
         本地离线照常用，联网保存时自动上传。
   ========================================================= */
window.Cloud = (function () {
  'use strict';
  var CFG = (window.APP_CONFIG) || {};
  var AUTH_KEY = 'zhiwu_auth_v1';
  var DEBOUNCE_MS = 1500;
  var timer = null;

  function isReady() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); }
  function base() { return String(CFG.SUPABASE_URL).replace(/\/+$/, ''); }

  /* ---------- 基础请求 ---------- */
  function parseText(t) {
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return { raw: t }; }
  }
  function http(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t) {
        var data = parseText(t);
        if (!r.ok) {
          var msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + r.status);
          var err = new Error(msg);
          err.status = r.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function hdrs(extra) {
    var h = { 'apikey': CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function authHdrs(token) { return hdrs({ 'Authorization': 'Bearer ' + token }); }

  /* ---------- 会话存取 ---------- */
  function readAuth() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeAuth(a) {
    try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
  }
  function isLoggedIn() {
    var a = readAuth();
    return !!(a && a.access_token && a.email);
  }
  function currentEmail() { var a = readAuth(); return a ? (a.email || '') : ''; }

  /* ---------- 认证 ---------- */
  function signUp(email, password) {
    return http(base() + '/auth/v1/signup', {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ email: email, password: password })
    }).then(function (data) {
      return { ok: true, data: data };
    });
  }
  function signIn(email, password) {
    return http(base() + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ email: email, password: password })
    }).then(function (data) {
      if (!data.access_token) throw new Error('登录失败：未返回令牌');
      writeAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        email: (data.user && data.user.email) || email,
        updated_at: new Date().toISOString()
      });
      return data;
    });
  }
  function refresh(a) {
    return http(base() + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ refresh_token: a.refresh_token })
    }).then(function (data) {
      if (!data.access_token) throw new Error('刷新令牌失败');
      writeAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token || a.refresh_token,
        email: a.email, updated_at: new Date().toISOString()
      });
      return data.access_token;
    });
  }
  function me(token) {
    return http(base() + '/auth/v1/user', { headers: authHdrs(token) });
  }
  /* 返回 {user, token} 或 null（未登录/失效） */
  function ensureSession() {
    var a = readAuth();
    if (!a || !a.access_token) return Promise.resolve(null);
    return me(a.access_token).then(function (u) {
      return { user: u, token: a.access_token };
    }).catch(function (err) {
      if (err.status === 401 && a.refresh_token) {
        return refresh(a).then(function (tk) {
          return me(tk).then(function (u) { return { user: u, token: tk }; });
        }).catch(function () { writeAuth(null); return null; });
      }
      writeAuth(null);
      return null;
    });
  }
  function signOut() { writeAuth(null); return Promise.resolve(); }

  /* ---------- 云数据（表 user_data，RLS 只允许本人读写） ---------- */
  function pull(token, uid) {
    var q = 'user_id=eq.' + encodeURIComponent(uid);
    return http(base() + '/rest/v1/user_data?select=payload,updated_at&' + q, {
      headers: authHdrs(token)
    }).then(function (rows) {
      if (!rows || !rows.length) return null;
      return { payload: rows[0].payload, updatedAt: rows[0].updated_at };
    });
  }
  function push(token, uid, snapshot) {
    var h = authHdrs(token);
    h['Prefer'] = 'resolution=merge-duplicates,return=representation';
    return http(base() + '/rest/v1/user_data?on_conflict=user_id', {
      method: 'POST', headers: h,
      body: JSON.stringify({ user_id: uid, payload: snapshot, updated_at: new Date().toISOString() })
    }).then(function (rows) {
      if (rows && rows[0]) return rows[0].updated_at;
      return new Date().toISOString();
    });
  }

  function ts(x) { var t = Date.parse(x); return isNaN(t) ? 0 : t; }

  /* ---------- 同步主流程 ----------
     afterLogin=true：若本地是“未改动的初始演示数据”，直接采用云端，避免误覆盖 */
  function syncNow(afterLogin) {
    if (!isReady()) return Promise.resolve({ ok: false, reason: 'noconfig' });
    return ensureSession().then(function (sess) {
      if (!sess) return { ok: false, reason: 'noauth' };
      var uid = sess.user.id;
      ensureMeta();
      var localDirty = !!DB.meta.dirty;
      var localTime = ts(DB.meta.updatedAt);
      return pull(sess.token, uid).then(function (row) {
        if (!row) {
          /* 云端还没有数据 → 上传本地（首次使用/第一台设备） */
          return push(sess.token, uid, DB).then(function (serverTime) {
            markSynced(serverTime);
            return { ok: true, action: 'uploaded', uid: uid };
          });
        }
        var cloudTime = ts(row.updatedAt);
        if (afterLogin && !localDirty) {
          applyRemoteSnapshot(row.payload);
          return { ok: true, action: 'downloaded', uid: uid };
        }
        if (localTime > cloudTime) {
          return push(sess.token, uid, DB).then(function (serverTime) {
            markSynced(serverTime);
            return { ok: true, action: 'uploaded', uid: uid };
          });
        }
        if (cloudTime > localTime) {
          applyRemoteSnapshot(row.payload);
          return { ok: true, action: 'downloaded', uid: uid };
        }
        return { ok: true, action: 'insync', uid: uid };
      });
    });
  }

  /* 本地每次保存后防抖自动上传 */
  function scheduleSync() {
    if (!isReady() || !isLoggedIn()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      syncNow(false).catch(function (e) { console.warn('云同步失败：', e && e.message); });
    }, DEBOUNCE_MS);
  }

  return {
    isReady: isReady,
    isLoggedIn: isLoggedIn,
    currentEmail: currentEmail,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    syncNow: syncNow,
    scheduleSync: scheduleSync
  };
})();

/* 页面启动自动同步（确保 Cloud 已就绪后触发） */
if (typeof cloudAuto === 'function') { cloudAuto(); }

