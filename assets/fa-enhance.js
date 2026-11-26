/* ==========================================================================
   بهبودهای رابط کاربری فارسی برای Docsify
   - گروه‌های تاشوی سایدبار
   - دکمهٔ قبلی/بعدی و زمان مطالعه
   - دکمهٔ کپی کد
   - نوار ابزار: حالت تیره و اندازهٔ متن
   - نرمال‌سازی جست‌وجو (ي/ك عربی و ارقام عربی)
   پیش از docsify.min.js بارگذاری شود؛ پلاگین‌ها در window.FaPlugins قرار می‌گیرند.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return FA_DIGITS.charAt(d); }); }

  /* ---------- تم و اندازهٔ متن ---------- */
  var FS_MIN = 15, FS_MAX = 22;

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var btn = document.querySelector('.fa-tools [data-act="theme"]');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', t === 'dark' ? 'حالت روشن' : 'حالت تیره');
      btn.title = btn.getAttribute('aria-label');
    }
  }
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function applyFontSize(px) {
    px = Math.max(FS_MIN, Math.min(FS_MAX, px));
    root.style.setProperty('--fa-fs', px + 'px');
    lsSet('fa-fs', String(px));
    return px;
  }
  function currentFontSize() {
    var v = parseInt(lsGet('fa-fs'), 10);
    return isNaN(v) ? 17 : v;
  }

  function buildToolbar() {
    if (document.querySelector('.fa-tools')) return;
    var bar = document.createElement('div');
    bar.className = 'fa-tools';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'تنظیمات نمایش');
    bar.innerHTML =
      '<button type="button" data-act="theme"></button>' +
      '<button type="button" data-act="fs-down" aria-label="کوچک‌تر کردن متن" title="کوچک‌تر کردن متن">A−</button>' +
      '<button type="button" data-act="fs-up" aria-label="بزرگ‌تر کردن متن" title="بزرگ‌تر کردن متن">A+</button>';
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'theme') {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        lsSet('fa-theme', next);
        applyTheme(next);
      } else if (act === 'fs-up') {
        applyFontSize(currentFontSize() + 1);
      } else if (act === 'fs-down') {
        applyFontSize(currentFontSize() - 1);
      }
    });
    document.body.appendChild(bar);
    applyTheme(currentTheme());
  }

  /* ---------- سایدبار: گروه‌های تاشو ---------- */
  function loadOpen() {
    try { return JSON.parse(lsGet('fa-open-groups') || '{}') || {}; } catch (e) { return {}; }
  }
  function saveOpen(map) { lsSet('fa-open-groups', JSON.stringify(map)); }

  function enhanceSidebar() {
    var items = document.querySelectorAll('.sidebar-nav > ul > li');
    if (!items.length) return;
    var open = loadOpen();
    Array.prototype.forEach.call(items, function (li) {
      var head = null, sub = null;
      Array.prototype.forEach.call(li.children, function (c) {
        if (!head && (c.tagName === 'STRONG' || c.tagName === 'P')) head = c;
        if (!sub && c.tagName === 'UL') sub = c;
      });
      if (!head || !sub) return;
      var key = head.textContent.trim();
      var hasActive = !!sub.querySelector('li.active');
      li.classList.add('fa-group');
      li.classList.toggle('fa-current', hasActive);
      if (hasActive) open[key] = true;
      li.classList.toggle('fa-open', !!open[key]);
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', open[key] ? 'true' : 'false');
    });
    saveOpen(open);
  }

  function toggleGroup(head) {
    var li = head.parentElement;
    var isOpen = li.classList.toggle('fa-open');
    head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var open = loadOpen();
    open[head.textContent.trim()] = isOpen;
    saveOpen(open);
  }
  function groupHeadFrom(target) {
    if (!target || !target.closest) return null;
    var h = target.closest('.sidebar-nav > ul > li.fa-group > strong, .sidebar-nav > ul > li.fa-group > p');
    return h;
  }
  document.addEventListener('click', function (e) {
    var h = groupHeadFrom(e.target);
    if (h) toggleGroup(h);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var h = groupHeadFrom(e.target);
    if (h) { e.preventDefault(); toggleGroup(h); }
  });

  /* ---------- قبلی / بعدی ---------- */
  function normPath(href) {
    try { href = decodeURIComponent(href); } catch (e) { /* keep */ }
    return href.replace(/^#/, '').split('?')[0].replace(/\.md$/, '');
  }
  function addPager(vm) {
    var section = document.querySelector('.markdown-section');
    if (!section || section.querySelector('.fa-pager')) return;
    var links = Array.prototype.filter.call(
      document.querySelectorAll('.sidebar-nav a[href^="#/"]'),
      function (a) { return !a.closest('.app-sub-sidebar'); }
    );
    var cur = normPath('#' + (vm.route.path || '/'));
    var idx = -1;
    links.forEach(function (a, i) {
      if (idx < 0 && normPath(a.getAttribute('href')) === cur) idx = i;
    });
    if (idx < 0) return;
    var prev = links[idx - 1], next = links[idx + 1];
    if (!prev && !next) return;
    var nav = document.createElement('nav');
    nav.className = 'fa-pager';
    nav.setAttribute('aria-label', 'صفحهٔ قبلی و بعدی');
    function item(a, cls, label, arrow) {
      var el = document.createElement('a');
      el.href = a.getAttribute('href');
      el.className = cls;
      var s = document.createElement('small'); s.textContent = label;
      var t = document.createElement('span'); t.textContent = a.textContent.trim();
      el.appendChild(s); el.appendChild(t);
      return el;
    }
    if (prev) nav.appendChild(item(prev, 'fa-prev', '→ قبلی'));
    if (next) nav.appendChild(item(next, 'fa-next', 'بعدی ←'));
    section.appendChild(nav);
  }

  /* ---------- زمان مطالعه ---------- */
  function addReadingTime(vm) {
    var section = document.querySelector('.markdown-section');
    if (!section || section.querySelector('.fa-meta')) return;
    if ((vm.route.path || '/') === '/') return;
    var h1 = section.querySelector('h1');
    if (!h1) return;
    var clone = section.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('pre, .mermaid, .fa-pager'), function (n) { n.remove(); });
    var words = (clone.textContent || '').trim().split(/\s+/).length;
    if (words < 250) return;
    var min = Math.max(1, Math.round(words / 200));
    var meta = document.createElement('div');
    meta.className = 'fa-meta';
    meta.textContent = '⏱ حدود ' + toFa(min) + ' دقیقه مطالعه';
    h1.insertAdjacentElement('afterend', meta);
  }

  /* ---------- دکمهٔ کپی کد ---------- */
  function addCopyButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.markdown-section pre'), function (pre) {
      if (pre.querySelector('.fa-copy') || pre.classList.contains('mermaid') || pre.getAttribute('data-lang') === 'mermaid') return;
      var code = pre.querySelector('code') || pre;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fa-copy';
      b.textContent = 'کپی';
      b.setAttribute('aria-label', 'کپی کد');
      b.addEventListener('click', function () {
        var text = code.textContent;
        function ok() { b.textContent = 'کپی شد ✓'; setTimeout(function () { b.textContent = 'کپی'; }, 1500); }
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); ok(); } catch (e) { /* ignore */ }
          ta.remove();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok, fallback);
        } else { fallback(); }
      });
      pre.appendChild(b);
    });
  }

  /* ---------- جست‌وجو: یکسان‌سازی حروف و ارقام ---------- */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('.search')) return;
    var v = t.value;
    var n = v.replace(/ي|ى/g, 'ی').replace(/ك/g, 'ک')
             .replace(/[٠-٩]/g, function (d) { return FA_DIGITS.charAt(d.charCodeAt(0) - 0x0660); });
    if (n !== v) {
      var p = t.selectionStart;
      t.value = n;
      try { t.setSelectionRange(p, p); } catch (err) { /* ignore */ }
    }
  }, true);

  /* ---------- پلاگین Docsify ---------- */
  window.FaPlugins = [
    function (hook, vm) {
      hook.mounted(function () { buildToolbar(); });
      hook.doneEach(function () {
        buildToolbar();
        addReadingTime(vm);
        addCopyButtons();
        // سایدبار ممکن است کمی دیرتر از محتوا رندر شود
        var run = function () { enhanceSidebar(); addPager(vm); };
        run();
        setTimeout(run, 60);
      });
    }
  ];
})();
