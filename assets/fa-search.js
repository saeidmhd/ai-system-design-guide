/* ==========================================================================
   جست‌وجوی فارسی برای Docsify (جایگزین search.min.js)

   چرا پلاگین پیش‌فرض کنار گذاشته شد؟
   - پلاگین Docsify کل ایندکس (حدود ۵ میلیون نویسه) را در localStorage ذخیره می‌کند.
     سقف localStorage حدود ۵ مگابایت است؛ ذخیره‌سازی خطای «exceeded the quota» می‌داد،
     اما زمان انقضا ذخیره می‌شد. نتیجه: جست‌وجو فقط بار اول کار می‌کرد و از بازدید دوم
     به بعد با TypeError از کار می‌افتاد.

   این ماژول:
   - ایندکس را در IndexedDB نگه می‌دارد (بدون محدودیت ۵ مگابایتی)؛
   - اگر IndexedDB در دسترس نبود، فقط در حافظه کار می‌کند و خطا نمی‌دهد؛
   - ي/ك عربی، ارقام فارسی/عربی، نیم‌فاصله، اعراب و کشیده را یکسان می‌کند؛
   - همهٔ کلمه‌های جست‌وجو باید در یک بخش باشند (AND)، نه هر کدام (OR)؛
   - نتیجه‌ها را بر اساس ربط مرتب می‌کند و حداکثر ۴۰ نتیجه نشان می‌دهد.

   پس از fa-enhance.js و پیش از docsify.min.js بارگذاری شود.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {
    placeholder: 'جست‌وجو…',
    noData: 'نتیجه‌ای پیدا نشد',
    building: 'در حال آماده‌سازی فهرست جست‌وجو…',
    partial: 'فهرست هنوز کامل نیست؛ ممکن است برخی نتایج بعداً اضافه شوند.',
    maxAge: 24 * 60 * 60 * 1000,   // اعتبار ایندکس ذخیره‌شده (یک روز)
    maxResults: 40,
    concurrency: 6,
    version: 1,                    // با تغییر ساختار ایندکس، این عدد را زیاد کنید
    dbName: 'fa-search',
    store: 'kv',
    key: 'index'
  };

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA_DIGITS.charAt(d); }); }

  /* ---------- نرمال‌سازی متن فارسی ---------- */
  var FOLD = {
    'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه',
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا'
  };
  function foldChar(ch) {
    var c = ch.charCodeAt(0);
    // نیم‌فاصله، اتصال‌دهنده، علامت‌های جهت، خط‌تیره نرم، کشیده، اعراب
    if (c === 0x200C || c === 0x200D || c === 0x200E || c === 0x200F || c === 0x00AD ||
        c === 0x0640 || c === 0x0670 || (c >= 0x064B && c <= 0x065F)) return '';
    if (c >= 0x06F0 && c <= 0x06F9) return String.fromCharCode(c - 0x06F0 + 48);
    if (c >= 0x0660 && c <= 0x0669) return String.fromCharCode(c - 0x0660 + 48);
    var f = FOLD[ch];
    if (f) return f;
    return ch.toLowerCase();
  }
  function norm(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) out += foldChar(s.charAt(i));
    return out;
  }
  // نسخهٔ نرمال‌شده + نگاشت هر نویسه به جایگاهش در متن اصلی (برای هایلایت)
  function normMap(s) {
    var t = [], map = [];
    for (var i = 0; i < s.length; i++) {
      var f = foldChar(s.charAt(i));
      for (var k = 0; k < f.length; k++) { t.push(f.charAt(k)); map.push(i); }
    }
    return { t: t.join(''), map: map };
  }
  function tokenize(q) {
    return norm(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- تبدیل Markdown به بخش‌های قابل جست‌وجو ---------- */
  function inlineToText(line) {
    return line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/`+/g, '')
      .replace(/\*+|~~/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/^\s*(?:>\s*)+/, '')
      .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parsePage(path, md, vm) {
    var slugify = window.Docsify && window.Docsify.slugify;
    var lines = md.replace(/\r/g, '').split('\n');
    var entries = [];
    var pageTitle = '';
    var cur = { h: '', a: '', body: [] };
    var inCode = false, skipCode = false, fence = '';

    function flush() {
      var body = cur.body.join(' ').replace(/\s+/g, ' ').trim();
      if (body || cur.h) entries.push({ p: path, t: pageTitle, h: cur.h, a: cur.a, b: body });
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fm = line.match(/^\s*(```+|~~~+)\s*([\w-]*)/);
      if (fm) {
        if (!inCode) { inCode = true; fence = fm[1].charAt(0); skipCode = fm[2].toLowerCase() === 'mermaid'; }
        else if (fm[1].charAt(0) === fence) { inCode = false; skipCode = false; }
        continue;
      }
      if (inCode) {
        if (!skipCode && line.trim()) cur.body.push(line.trim());
        continue;
      }
      var hm = line.match(/^(#{1,3})\s+(.*?)(?:\s+#+)?\s*$/);
      if (hm) {
        var text = inlineToText(hm[2]).replace(/\{docsify-ignore(?:-all)?\}/g, '').trim();
        if (!text) continue;
        flush();
        if (hm[1].length === 1 && !pageTitle) pageTitle = text;
        cur = { h: text, a: slugify ? slugify(text) : '', body: [] };
        continue;
      }
      if (/^\s*\|?[\s:\-|]+\|?\s*$/.test(line) && line.indexOf('-') > -1) continue; // خط جدا‌کنندهٔ جدول
      if (/^\s*<!--/.test(line) || /^\s*-->/.test(line)) continue;
      var t = inlineToText(line);
      if (t) cur.body.push(t);
    }
    flush();
    if (slugify && slugify.clear) slugify.clear();

    if (!pageTitle) {
      var fallback = path.replace(/^\//, '').replace(/\.md$/, '');
      pageTitle = fallback ? (entries.length && entries[0].h ? entries[0].h : fallback) : 'خانه';
    }
    entries.forEach(function (e) { e.t = pageTitle; if (!e.h) e.h = pageTitle; });
    return entries;
  }

  /* ---------- ذخیره‌سازی (IndexedDB؛ در صورت نبود، فقط حافظه) ---------- */
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      try {
        if (!window.indexedDB) return reject(new Error('no indexedDB'));
        var r = indexedDB.open(CFG.dbName, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(CFG.store); };
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
        r.onblocked = function () { reject(new Error('blocked')); };
      } catch (e) { reject(e); }
    });
  }
  function idbGet() {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var q = db.transaction(CFG.store, 'readonly').objectStore(CFG.store).get(CFG.key);
        q.onsuccess = function () { resolve(q.result || null); db.close(); };
        q.onerror = function () { reject(q.error); db.close(); };
      });
    }).catch(function () { return null; });
  }
  function idbSet(value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(CFG.store, 'readwrite');
        tx.objectStore(CFG.store).put(value, CFG.key);
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = tx.onabort = function () { db.close(); resolve(false); };
      });
    }).catch(function () { return false; });
  }
  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }
  // کلیدهای قدیمیِ پلاگین پیش‌فرض (بخشی از سهمیهٔ localStorage را می‌گرفتند)
  function cleanLegacyKeys() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('docsify.search.') === 0) localStorage.removeItem(k);
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------- وضعیت ایندکس ---------- */
  var state = {
    entries: [],     // آیتم‌ها همراه با فیلدهای نرمال‌شده
    total: 0,        // تعداد صفحه‌هایی که باید ایندکس شوند
    done: 0,
    complete: false,
    started: false,
    paths: []
  };

  function prepare(e) {
    e.nh = norm(e.h); e.nt = norm(e.t); e.nb = norm(e.b);
    return e;
  }

  function collectPaths() {
    var seen = {}, out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.sidebar-nav a[href^="#/"]'), function (a) {
      if (a.classList.contains('section-link') || a.closest('.app-sub-sidebar')) return;
      var h = a.getAttribute('href').slice(1).split('?')[0];
      try { h = decodeURIComponent(h); } catch (e) { /* keep */ }
      if (!seen[h]) { seen[h] = 1; out.push(h); }
    });
    return out;
  }

  function crawl(vm, paths, onPage) {
    return new Promise(function (resolve) {
      var idx = 0, finished = 0, failed = 0;
      function next() {
        if (idx >= paths.length) return;
        var path = paths[idx++];
        fetch(vm.router.getFile(path), { credentials: 'same-origin' })
          .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
          .then(function (md) { return parsePage(path, md, vm); })
          .catch(function () { failed++; return []; })
          .then(function (list) {
            finished++;
            onPage(list, finished);
            if (finished === paths.length) resolve({ failed: failed });
            else next();
          });
      }
      var n = Math.min(CFG.concurrency, paths.length);
      if (!n) return resolve({ failed: 0 });
      for (var i = 0; i < n; i++) next();
    });
  }

  var searchHook = function () { /* در buildUI جایگزین می‌شود */ };
  var hookTimer = null;
  function notify(final) {                    // هنگام ایندکس تدریجی، رندر مکرر نتایج را کم می‌کند
    clearTimeout(hookTimer);
    if (final) searchHook();
    else hookTimer = setTimeout(searchHook, 250);
  }

  function startIndexing(vm) {
    if (state.started) return;
    state.started = true;
    var paths = collectPaths();
    if (!paths.length) { state.started = false; return; }
    state.paths = paths;
    state.total = paths.length;
    var sig = hashStr(paths.join('|'));

    idbGet().then(function (cached) {
      var usable = cached && cached.v === CFG.version && Array.isArray(cached.entries) && cached.entries.length;
      var fresh = usable && cached.sig === sig && (Date.now() - cached.savedAt) < CFG.maxAge;
      if (usable) {
        state.entries = cached.entries.map(prepare);
        state.done = state.total;
        state.complete = !!fresh;   // اگر کهنه بود، نتایج قبلی را نشان بده و در پس‌زمینه تازه کن
        notify(true);
        if (fresh) return;
      }
      var collected = [];
      return crawl(vm, paths, function (list, n) {
        list.forEach(prepare);                   // هر صفحه فقط یک بار پردازش می‌شود
        Array.prototype.push.apply(collected, list);
        if (!usable) {                           // ایندکس تدریجی: هر صفحه که آماده شد قابل جست‌وجوست
          state.entries = collected;
          state.done = n;
          notify(false);
        }
      }).then(function (res) {
        state.entries = collected;
        state.done = state.total;
        state.complete = true;
        notify(true);
        // فقط اگر همهٔ صفحه‌ها با موفقیت خوانده شد ذخیره کن تا ایندکس ناقص ماندگار نشود
        if (!res.failed && collected.length) {
          var plain = collected.map(function (e) { return { p: e.p, t: e.t, h: e.h, a: e.a, b: e.b }; });
          return idbSet({ v: CFG.version, sig: sig, savedAt: Date.now(), entries: plain });
        }
      });
    }).catch(function (err) {
      if (window.console) console.warn('fa-search: indexing failed', err);
    });
  }

  /* ---------- جست‌وجو ---------- */
  function countOcc(hay, needle, cap) {
    var n = 0, i = -1;
    while (n < cap && (i = hay.indexOf(needle, i + 1)) > -1) n++;
    return n;
  }

  function runQuery(q) {
    var tokens = tokenize(q);
    if (!tokens.length) return { tokens: tokens, hits: [] };
    var phrase = tokens.join(' ');
    var hits = [];
    for (var i = 0; i < state.entries.length; i++) {
      var e = state.entries[i], score = 0, ok = true;
      for (var k = 0; k < tokens.length; k++) {
        var tk = tokens[k];
        var inH = e.nh.indexOf(tk) > -1, inT = e.nt.indexOf(tk) > -1;
        var cB = countOcc(e.nb, tk, 5);
        if (!inH && !inT && !cB) { ok = false; break; }
        score += (inH ? 6 : 0) + (inT ? 2 : 0) + cB;
      }
      if (!ok) continue;
      if (tokens.length > 1) {
        if (e.nh.indexOf(phrase) > -1) score += 8;
        else if (e.nb.indexOf(phrase) > -1) score += 4;
      }
      hits.push({ e: e, score: score });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return { tokens: tokens, hits: hits.slice(0, CFG.maxResults), total: hits.length };
  }

  // هایلایت: همهٔ رخدادهای کلمه‌ها را در متن اصلی علامت می‌زند
  function highlight(text, tokens) {
    var nm = normMap(text), ranges = [];
    tokens.forEach(function (tk) {
      var i = -1;
      while ((i = nm.t.indexOf(tk, i + 1)) > -1) ranges.push([nm.map[i], nm.map[i + tk.length - 1] + 1]);
    });
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [ranges[0].slice()];
    for (var r = 1; r < ranges.length; r++) {
      var last = merged[merged.length - 1];
      if (ranges[r][0] <= last[1]) last[1] = Math.max(last[1], ranges[r][1]);
      else merged.push(ranges[r].slice());
    }
    var out = '', pos = 0;
    merged.forEach(function (m) {
      out += esc(text.slice(pos, m[0])) + '<em class="search-keyword">' + esc(text.slice(m[0], m[1])) + '</em>';
      pos = m[1];
    });
    return out + esc(text.slice(pos));
  }

  // بخشی از متن را حول اولین کلمهٔ پیداشده برش می‌دهد و هایلایت می‌کند
  // (عنوان‌ها در بعضی صفحه‌ها یک پاراگراف کامل‌اند و باید کوتاه شوند)
  function excerpt(text, tokens, maxLen, lead) {
    if (!text) return '';
    if (text.length <= maxLen) return highlight(text, tokens);
    var nm = normMap(text), first = -1;
    tokens.forEach(function (tk) {
      var i = nm.t.indexOf(tk);
      if (i > -1 && (first < 0 || i < first)) first = i;
    });
    var from = first > -1 ? Math.max(0, nm.map[first] - lead) : 0;
    var to = Math.min(text.length, from + maxLen);
    return (from > 0 ? '… ' : '') + highlight(text.slice(from, to), tokens) + (to < text.length ? ' …' : '');
  }

  /* ---------- رابط کاربری ---------- */
  function buildUI(vm) {
    var aside = document.querySelector('aside.sidebar') || document.querySelector('.sidebar');
    if (!aside || aside.querySelector('.search')) return !!aside;

    var box = document.createElement('div');
    box.className = 'search';
    box.innerHTML =
      '<div class="input-wrap">' +
        '<input type="search" dir="rtl" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
        'enterkeyhint="search" aria-label="جست‌وجو در راهنما" placeholder="' + esc(CFG.placeholder) + '">' +
        '<div class="clear-button" role="button" aria-label="پاک کردن جست‌وجو" tabindex="-1">' +
          '<svg width="26" height="24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ccc"/>' +
          '<path stroke="white" stroke-width="2" d="M8.25,8.25,15.75,15.75"/>' +
          '<path stroke="white" stroke-width="2" d="M8.25,15.75,15.75,8.25"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="results-panel" role="region" aria-live="polite"></div>';
    aside.insertBefore(box, aside.firstChild);

    var input = box.querySelector('input');
    var panel = box.querySelector('.results-panel');
    var clearBtn = box.querySelector('.clear-button');
    var wrap = box.querySelector('.input-wrap');
    var timer = null;

    function render() {
      var q = input.value.trim();
      if (!q) {
        panel.classList.remove('show'); clearBtn.classList.remove('show');
        panel.innerHTML = '';
        aside.classList.remove('fa-searching');
        return;
      }
      panel.classList.add('show'); clearBtn.classList.add('show');
      aside.classList.add('fa-searching');

      var res = runQuery(q);
      var html = '';
      if (!state.complete && state.entries.length) html += '<p class="fa-search-status">' + esc(CFG.partial) + '</p>';
      if (res.hits.length) {
        res.hits.forEach(function (h) {
          var e = h.e;
          var href = vm.router.toURL(e.p, e.a ? { id: e.a } : {});
          var title = e.h === e.t ? excerpt(e.t, res.tokens, 80, 15)
            : '<span class="fa-hit-page">' + excerpt(e.t, res.tokens, 50, 10) + '</span> › ' + excerpt(e.h, res.tokens, 90, 20);
          html += '<div class="matching-post"><a href="' + esc(href) + '"><h2>' + title + '</h2><p>' +
                  excerpt(e.b, res.tokens, 175, 45) + '</p></a></div>';
        });
        if (res.total > res.hits.length) {
          html += '<p class="fa-search-status">' + esc(toFa(res.total)) + ' نتیجه یافت شد؛ ' +
                  esc(toFa(res.hits.length)) + ' مورد برتر نمایش داده شد. عبارت را دقیق‌تر کنید.</p>';
        }
      } else if (!state.complete) {
        var pct = state.total ? Math.round(state.done / state.total * 100) : 0;
        html += '<p class="empty">' + esc(CFG.building) + ' ' + esc(toFa(pct)) + '٪</p>';
      } else {
        html += '<p class="empty">' + esc(CFG.noData) + '</p>';
      }
      panel.innerHTML = html;
    }
    searchHook = function () { if (input.value.trim()) render(); };

    function schedule() { clearTimeout(timer); timer = setTimeout(render, 120); }
    input.addEventListener('input', schedule);
    input.addEventListener('focus', function () { startIndexing(vm); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { input.value = ''; render(); }
      else if (ev.key === 'Enter') {
        var a = panel.querySelector('.matching-post a');
        if (a) { ev.preventDefault(); location.hash = a.getAttribute('href'); }
      }
    });
    wrap.addEventListener('click', function (ev) {
      if (ev.target.tagName !== 'INPUT') { input.value = ''; render(); input.focus(); }
    });
    // کلیک داخل کادر جست‌وجو نباید دراور موبایل را ببندد (Docsify روی body بسته شدن را مدیریت می‌کند)؛
    // فقط کلیک روی نتیجه‌ها (که ناوبری می‌کنند) اجازهٔ عبور دارد.
    box.addEventListener('click', function (ev) {
      if (!ev.target.closest('a')) ev.stopPropagation();
    });
    return true;
  }

  /* ---------- پلاگین Docsify ---------- */
  var plugin = function (hook, vm) {
    var built = false;
    function ensureUI() { if (!built) built = buildUI(vm); }
    hook.mounted(function () { cleanLegacyKeys(); ensureUI(); });
    hook.doneEach(function () {
      ensureUI();
      // اگر ایندکس ذخیره‌شده وجود دارد زود بارگذاری شود؛ در غیر این صورت پس از کمی بیکاری شروع می‌شود
      var go = function () { startIndexing(vm); };
      if (!state.started) {
        setTimeout(function () {
          if (!state.started) go();
        }, 2500);
      }
    });
  };

  (window.FaPlugins = window.FaPlugins || []).push(plugin);
})();
