/* Puranodayam Seva page. Plain JavaScript, no libraries. */
(function () {
  'use strict';

  var C = window.SEVA_CONFIG || {};
  var API = String(C.API_URL || '').trim();
  var params = new URLSearchParams(location.search);
  var DEMO = params.has('demo');
  var SRC = cleanSrc(params.get('s'));
  var CHANNEL_ID = C.CHANNEL_ID || 'UC44-2FMB9xYlZwHpkNqA3cQ';
  var SUB_URL = 'https://www.youtube.com/channel/' + CHANNEL_ID + '?sub_confirmation=1';
  var PAGE_URL = location.origin + location.pathname;
  var FEED_KEY = 'pv_feed_v1';

  var sevaShown = 10;
  var namesShown = 60;
  var feed = null;

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function cleanSrc(s) {
    s = String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    return s || 'web';
  }

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }

  function getItem(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }

  function setItem(kind, key, val) {
    try { var s = store(kind); if (s) s.setItem(key, val); } catch (e) { /* private mode */ }
  }

  function compact(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    var units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        var s = v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10;
        return String(s).replace(/\.0$/, '') + units[i][1];
      }
    }
    return String(n);
  }

  function rupees(n) {
    n = Number(n) || 0;
    try { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); } catch (e) { return '₹' + n; }
  }

  function niceDate(key) {
    var m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(key || '');
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    try {
      return d.toLocaleDateString('te-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return key;
    }
  }

  function todayKey() {
    var d = new Date();
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** "తెలుగు / English" -> [telugu, english] */
  function twoLang(s) {
    var parts = String(s || '').split(' / ');
    return [parts[0].trim(), parts.slice(1).join(' / ').trim()];
  }

  // ---------------------------------------------------------- scan + taps
  function logScan() {
    if (!API || DEMO) return;
    var onceKey = 'pv_scan_' + SRC;
    if (getItem('sessionStorage', onceKey)) return;
    setItem('sessionStorage', onceKey, '1');
    var isNew = getItem('localStorage', 'pv_seen') ? '0' : '1';
    setItem('localStorage', 'pv_seen', String(Date.now()));
    var url = API + '?action=scan&s=' + encodeURIComponent(SRC) + '&n=' + isNew;
    try { fetch(url, { mode: 'no-cors' }).catch(function () {}); } catch (e) { /* old browser */ }
  }

  function logTap() {
    if (!API || DEMO) return;
    var url = API + '?action=tap&s=' + encodeURIComponent(SRC);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url)) return;
    } catch (e) { /* fall through */ }
    try { fetch(url, { mode: 'no-cors', keepalive: true }).catch(function () {}); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------- rendering
  function render(d) {
    feed = d || {};
    renderChannel(feed.channel);
    renderSeva(feed.seva);
    renderSupporters(feed.supporters, feed.scans);
    renderGrowth(feed.growth);
    renderVideos(feed.videos);
    if (feed.updated) {
      var t = new Date(feed.updated);
      $('updated').textContent = 'చివరి అప్‌డేట్: ' +
        (isNaN(t) ? feed.updated : t.toLocaleString('te-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    }
  }

  function renderChannel(ch) {
    if (!ch) return;
    $('st-subs').textContent = compact(ch.subscribers);
    $('st-videos').textContent = compact(ch.videos);
    $('st-views').textContent = compact(ch.views);
  }

  function renderSeva(seva) {
    var list = $('seva-list');
    var entries = (seva && seva.entries) || [];
    var sum = (seva && seva.summary) || {};
    if (!entries.length) {
      $('seva-totals').hidden = true;
      $('seva-more').hidden = true;
      return;
    }
    $('seva-totals').hidden = false;
    $('t-amount').textContent = rupees(sum.total);
    $('t-count').textContent = String(sum.count || entries.length);
    $('t-receipts').textContent = String(sum.receipts || 0);
    $('t-meals-box').hidden = !(sum.meals > 0);
    $('t-meals').textContent = String(sum.meals || 0);

    list.textContent = '';
    entries.slice(0, sevaShown).forEach(function (e) {
      var item = el('article', 'seva-item');
      item.appendChild(el('div', 'date', niceDate(e.date)));
      item.appendChild(el('div', 'amount', rupees(e.amount)));

      var place = twoLang(e.place);
      var p = el('div', 'place', place[0] || '-');
      if (place[1]) p.appendChild(el('small', null, place[1]));
      item.appendChild(p);

      var meta = [];
      if (e.devotees) {
        meta.push(String(e.devotees).split(/,\s*/).map(function (x) { return twoLang(x)[0]; }).join(', '));
      }
      if (e.meals > 0) meta.push(e.meals + ' భోజనాలు');
      if (meta.length) item.appendChild(el('div', 'meta', meta.join(' · ')));
      if (e.note) item.appendChild(el('p', 'note', e.note));

      if (e.receipts && e.receipts.length) {
        var box = el('div', 'receipts');
        e.receipts.forEach(function (id) {
          var a = el('a');
          a.target = '_blank';
          a.rel = 'noopener';
          var img = el('img');
          img.loading = 'lazy';
          img.alt = 'రసీదు / receipt';
          if (DEMO) {
            a.href = 'logo.png';
            img.src = 'logo-240.webp';
          } else {
            a.href = 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view';
            img.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w400';
          }
          img.onerror = function () { a.classList.add('noimg'); img.remove(); };
          a.appendChild(img);
          box.appendChild(a);
        });
        item.appendChild(box);
      }
      list.appendChild(item);
    });
    $('seva-more').hidden = entries.length <= sevaShown;
  }

  function renderSupporters(sup, scans) {
    sup = sup || { total: 0, shown: [] };
    var count = $('sup-count');
    count.textContent = sup.total > 0
      ? sup.total + ' మంది భక్తులు తమ పేరు చేర్చారు · ' + sup.total + ' devotees added their name'
      : 'మొదటి పేరు మీదే కావచ్చు! · Be the first to add your name';

    var list = $('sup-list');
    list.textContent = '';
    var names = (sup.shown || []).slice(0, namesShown);
    var groups = [];
    names.forEach(function (n) {
      var g = groups[groups.length - 1];
      if (!g || g.date !== n.date) { g = { date: n.date, names: [] }; groups.push(g); }
      g.names.push(n.name);
    });
    groups.forEach(function (g) {
      var day = el('div', 'sup-day');
      day.appendChild(el('h3', null, g.date === todayKey() ? 'ఈరోజు · Today' : niceDate(g.date)));
      var wrap = el('div', 'names');
      g.names.forEach(function (name) { wrap.appendChild(el('span', null, name)); });
      day.appendChild(wrap);
      list.appendChild(day);
    });
    $('sup-more').hidden = (sup.shown || []).length <= namesShown;

    if (scans && scans.total > 0) {
      $('scan-line').textContent = 'ఇప్పటివరకు ' + scans.total + ' సార్లు మా QR స్కాన్ చేశారు' +
        (scans.today ? ' · ఈరోజు ' + scans.today : '');
    }
  }

  function renderGrowth(points) {
    var card = $('growth-card');
    if (!points || points.length < 2) { card.hidden = true; return; }
    card.hidden = false;
    var W = 320, H = 90, pad = 6;
    var vals = points.map(function (p) { return Number(p.subs) || 0; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = Math.max(1, max - min);
    var pts = vals.map(function (v, i) {
      var x = pad + (W - 2 * pad) * (i / (vals.length - 1));
      var y = H - pad - (H - 2 * pad) * ((v - min) / span);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Subscribers from ' + vals[0] + ' to ' + vals[vals.length - 1]);
    var area = document.createElementNS(ns, 'polygon');
    area.setAttribute('points', pad + ',' + (H - pad) + ' ' + pts.join(' ') + ' ' + (W - pad) + ',' + (H - pad));
    area.setAttribute('fill', 'rgba(244,180,42,0.25)');
    var line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#7a1a0e');
    line.setAttribute('stroke-width', '2.5');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(area);
    svg.appendChild(line);
    var box = $('growth');
    box.textContent = '';
    box.appendChild(svg);
    var labels = el('div', 'growth-labels');
    labels.appendChild(el('span', null, niceDate(points[0].date) + ': ' + compact(vals[0])));
    labels.appendChild(el('span', null, niceDate(points[points.length - 1].date) + ': ' + compact(vals[vals.length - 1])));
    box.appendChild(labels);
  }

  function renderVideos(videos) {
    var card = $('videos-card');
    if (!videos || !videos.length) { card.hidden = true; return; }
    card.hidden = false;
    var box = $('videos');
    box.textContent = '';
    videos.forEach(function (v) {
      var a = el('a');
      a.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id);
      a.rel = 'noopener';
      var img = el('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = v.thumb || ('https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/mqdefault.jpg');
      a.appendChild(img);
      a.appendChild(el('span', null, v.title));
      box.appendChild(a);
    });
  }

  // ------------------------------------------------------------- loading
  function load() {
    if (DEMO) {
      $('demo-banner').hidden = false;
      fetch('demo-data.json').then(function (r) { return r.json(); }).then(render).catch(function () {});
      return;
    }
    if (!API) return;
    var cached = getItem('localStorage', FEED_KEY);
    if (cached) {
      try { render(JSON.parse(cached)); } catch (e) { /* ignore broken cache */ }
    }
    fetch(API + '?action=data')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        render(d);
        setItem('localStorage', FEED_KEY, JSON.stringify(d));
      })
      .catch(function () {
        if (!cached) $('updated').textContent = 'వివరాలు లోడ్ కాలేదు - కొద్దిసేపటి తర్వాత మళ్ళీ చూడండి.';
      });
  }

  // ------------------------------------------------------------- name form
  var ERRORS = {
    empty: 'దయచేసి మీ పేరు రాయండి. · Please type your name.',
    short: 'పేరు కనీసం 2 అక్షరాలు ఉండాలి. · At least 2 letters.',
    link: 'లింకులు, ఈమెయిల్‌లు రాయకండి. · No links or emails, please.',
    digits: 'ఫోన్ నంబర్లు రాయకండి. · No phone numbers, please.',
    busy: 'కొద్దిసేపు ఆగి మళ్ళీ ప్రయత్నించండి. · Please try again in a minute.',
    choose: 'పేరు చూపించాలా వద్దా ఎంచుకోండి. · Please choose Yes or No.',
    net: 'నెట్‌వర్క్ సమస్య - మళ్ళీ ప్రయత్నించండి. · Network problem, please try again.',
    off: 'ఈ పేజీ ఇంకా సిద్ధం కాలేదు. · This page is not ready yet.'
  };

  function showMsg(text, ok) {
    var m = $('name-msg');
    m.textContent = text;
    m.className = 'msg ' + (ok ? 'ok' : 'err');
  }

  function addNameLocally(name) {
    if (!feed) feed = {};
    if (!feed.supporters) feed.supporters = { total: 0, shown: [] };
    feed.supporters.shown.unshift({ date: todayKey(), name: name });
    renderSupporters(feed.supporters, feed.scans);
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    // form.name would be the FORM's own name attribute, so read the input by id
    var name = $('yt-name').value.replace(/\s+/g, ' ').trim();
    var choice = form.querySelector('input[name="show"]:checked');
    if (!name) return showMsg(ERRORS.empty, false);
    if (Array.from(name).length < 2) return showMsg(ERRORS.short, false);
    if ((name.match(/\d/g) || []).length >= 5) return showMsg(ERRORS.digits, false);
    if (!choice) return showMsg(ERRORS.choose, false);
    var show = choice.value === 'yes';

    var done = function (res) {
      if (!res || !res.ok) return showMsg(ERRORS[(res && res.error)] || ERRORS.net, false);
      var finalName = res.name || name;
      if (!res.duplicate) {
        if (feed && feed.supporters) feed.supporters.total = (feed.supporters.total || 0) + 1;
        if (res.shown) addNameLocally(finalName);
        else if (feed) renderSupporters(feed.supporters, feed.scans);
      }
      showMsg('🙏 ధన్యవాదాలు, ' + finalName + '! ' +
              (res.shown ? 'మీ పేరు చేరింది.' : 'మీ పేరు లెక్కలో చేరింది.'), true);
      form.reset();
    };

    if (DEMO) return done({ ok: true, name: name, shown: show });
    if (!API) return showMsg(ERRORS.off, false);

    var btn = $('name-btn');
    btn.disabled = true;
    fetch(API, {
      method: 'POST',
      body: JSON.stringify({ action: 'name', name: name, show: show, s: SRC, website: form.elements.website.value })
    })
      .then(function (r) { return r.json(); })
      .then(done)
      .catch(function () { showMsg(ERRORS.net, false); })
      .then(function () { btn.disabled = false; });
  }

  // ------------------------------------------------------------- start
  function start() {
    $('seva-text').textContent = C.SEVA_TEXT_TE || '';
    $('seva-text-en').textContent = C.SEVA_TEXT_EN || '';

    var sub = $('sub-btn');
    sub.href = SUB_URL;
    sub.addEventListener('click', logTap);

    var shareText = 'పురాణోదయం - తెలుగు భక్తి ఛానల్. అన్నదాన సేవ రసీదులు ఇక్కడ చూడండి: ' + PAGE_URL + '?s=share';
    $('share-btn').href = 'https://wa.me/?text=' + encodeURIComponent(shareText);

    $('name-form').addEventListener('submit', onSubmit);
    $('seva-more').addEventListener('click', function () { sevaShown += 20; renderSeva(feed && feed.seva); });
    $('sup-more').addEventListener('click', function () {
      namesShown += 120;
      renderSupporters(feed && feed.supporters, feed && feed.scans);
    });

    logScan();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
