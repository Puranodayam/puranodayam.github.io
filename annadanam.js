/* Puranodayam annadanam page (sponsor-direct). Plain JavaScript, no libraries.
   We never take money: sponsors pledge here, then pay the caterer directly after the date is confirmed. */
(function () {
  'use strict';

  var C = window.SEVA_CONFIG || {};
  var API = String(C.API_URL || '').trim();
  var PAGE_URL = location.origin + location.pathname;
  var FEED_KEY = 'pv_ann_v1';
  var feed = null;

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function getItem(kind, key) {
    try { return window[kind].getItem(key); } catch (e) { return null; }
  }

  function setItem(kind, key, val) {
    try { window[kind].setItem(key, val); } catch (e) { /* private mode */ }
  }

  function rupees(n) {
    n = Number(n) || 0;
    try { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); } catch (e) { return '₹' + n; }
  }

  function niceDate(key) {
    var m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(key || '');
    try {
      return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('te-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return key;
    }
  }

  function driveThumb(id) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w600'; }
  function driveView(id) { return 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view'; }

  // ---------------------------------------------------------------- visit count (shows in the Daily report)
  function logVisit() {
    if (!API || getItem('sessionStorage', 'pv_scan_annadanam')) return;
    setItem('sessionStorage', 'pv_scan_annadanam', '1');
    var isNew = getItem('localStorage', 'pv_seen') ? '0' : '1';
    setItem('localStorage', 'pv_seen', String(Date.now()));
    try { fetch(API + '?action=scan&s=annadanam&n=' + isNew, { mode: 'no-cors' }).catch(function () {}); } catch (e) { /* old browser */ }
  }

  // ---------------------------------------------------------------- rendering
  function render(d) {
    feed = d || {};
    var t = feed.totals || {};
    $('t-done').textContent = String(t.done || 0);
    $('t-meals').textContent = String(t.meals || 0);
    $('t-sponsors').textContent = String(t.sponsors || 0);
    renderActive(feed.active || [], feed.waiting || 0);
    renderHistory(feed.history || []);
    updateCost();
    if (feed.updated) {
      var u = new Date(feed.updated);
      $('updated').textContent = 'చివరి అప్‌డేట్: ' +
        (isNaN(u) ? feed.updated : u.toLocaleString('te-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    }
  }

  function sponsorLine(s) {
    var li = el('li');
    li.appendChild(el('b', null, '🙏 ' + s.name));
    if (s.gothram) li.appendChild(document.createTextNode(' (' + s.gothram + ' గోత్రం)'));
    var what = [s.occasion, s.forWhom].filter(Boolean).join(' · ');
    li.appendChild(document.createTextNode((what ? ' - ' + what : '') + ' - ' + s.meals + ' భోజనాలు'));
    return li;
  }

  function sponsorList(list) {
    var ul = el('ul', 'sponsors');
    list.forEach(function (s) { ul.appendChild(sponsorLine(s)); });
    return ul;
  }

  function renderActive(active, waiting) {
    var box = $('active');
    box.textContent = '';
    if (!active.length) {
      box.appendChild(el('p', null, 'ప్రస్తుతం నమోదు జరుగుతున్న అన్నదానం లేదు. ఇప్పుడు నమోదు చేస్తే, తదుపరి అన్నదానంలో చేరుస్తాము.'));
      box.appendChild(el('p', 'tiny', 'No annadanam is open right now - pledge now and we add you to the next one.'));
      if (waiting > 0) box.appendChild(el('p', 'muted', waiting + ' భోజనాలు తదుపరి అన్నదానం కోసం ఎదురుచూస్తున్నాయి.'));
      return;
    }
    active.forEach(function (b) {
      var card = el('article', 'ann');
      var head = el('div', 'ann-head');
      head.appendChild(el('b', null, 'అన్నదానం #' + b.no));
      head.appendChild(el('span', 'status ' + b.status,
        b.status === 'confirmed' ? 'తేదీ ఖరారు' + (b.date ? ': ' + niceDate(b.date) : '') : 'స్పాన్సర్లు కావాలి'));
      card.appendChild(head);

      var facts = [];
      if (b.area) facts.push('📍 ' + b.area);
      if (b.cost) facts.push('ఒక్క భోజనం ' + rupees(b.cost));
      if (facts.length) card.appendChild(el('p', 'meta', facts.join(' · ')));

      if (b.goal) {
        var pct = Math.min(100, Math.round((b.pledged / b.goal) * 100));
        var bar = el('div', 'bar');
        var fill = el('i');
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        card.appendChild(bar);
        card.appendChild(el('p', 'meta', b.pledged + ' / ' + b.goal + ' భోజనాలు నమోదు · ' + b.paid + ' చెల్లించారు'));
      } else {
        card.appendChild(el('p', 'meta', b.pledged + ' భోజనాలు నమోదు · ' + b.paid + ' చెల్లించారు'));
      }

      if (b.status === 'confirmed') card.appendChild(payBox(b));
      if (b.sponsors && b.sponsors.length) card.appendChild(sponsorList(b.sponsors));
      box.appendChild(card);
    });
  }

  function payBox(b) {
    var pay = el('div', 'pay');
    pay.appendChild(el('b', null, '💳 చెల్లింపు: నేరుగా క్యాటరర్‌కు'));
    if (!b.upi) {
      pay.appendChild(el('p', null, 'చెల్లింపు వివరాలు మీకు ఫోన్‌లో తెలియజేస్తాము.'));
      return pay;
    }
    if (b.caterer) pay.appendChild(el('p', null, b.caterer));
    var row = el('div', 'upi');
    row.appendChild(el('code', null, b.upi));
    var copy = el('button', 'btn-copy', 'కాపీ');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = '✓ కాపీ అయింది'; };
      try {
        navigator.clipboard.writeText(b.upi).then(done, function () {});
      } catch (e) { /* no clipboard: the UPI ID is on screen */ }
    });
    row.appendChild(copy);
    pay.appendChild(row);
    var open = el('a', 'btn-upi', 'UPI యాప్‌లో తెరవండి');
    open.href = 'upi://pay?pa=' + encodeURIComponent(b.upi) + '&pn=' + encodeURIComponent(b.caterer || 'Caterer') +
      '&cu=INR&tn=' + encodeURIComponent('Annadanam ' + b.no);
    pay.appendChild(open);
    pay.appendChild(el('p', 'tiny', 'మీరు నమోదు చేసిన భోజనాలకు మాత్రమే చెల్లించండి (భోజనాలు × ' + rupees(b.cost) +
      '). క్యాటరర్ నిర్ధారించిన తర్వాత మీ పేరు ఇక్కడ కనిపిస్తుంది. · Pay only for the meals you pledged.'));
    return pay;
  }

  function mediaTile(item) {
    var tile = el('div', 'tile');
    if (item.kind === 'video' || item.kind === 'youtube') {
      var btn = el('button', 'play');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'వీడియో చూడండి · Play video');
      var img = el('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.kind === 'youtube' ? 'https://i.ytimg.com/vi/' + encodeURIComponent(item.id) + '/hqdefault.jpg'
                                        : driveThumb(item.id);
      img.onerror = function () { img.remove(); tile.classList.add('noimg-video'); };
      btn.appendChild(img);
      btn.appendChild(el('span', 'tri', '▶'));
      btn.addEventListener('click', function () {
        var f = el('iframe');
        f.src = item.kind === 'youtube'
          ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(item.id) + '?autoplay=1'
          : 'https://drive.google.com/file/d/' + encodeURIComponent(item.id) + '/preview';
        f.allow = 'autoplay; encrypted-media; fullscreen';
        f.setAttribute('allowfullscreen', '');
        f.title = 'Annadanam video';
        tile.classList.add('playing');
        tile.textContent = '';
        tile.appendChild(f);
      });
      tile.appendChild(btn);
      return tile;
    }
    var a = el('a');
    a.href = driveView(item.id);
    a.target = '_blank';
    a.rel = 'noopener';
    var pic = el('img');
    pic.loading = 'lazy';
    pic.alt = item.label || 'అన్నదానం ఫోటో';
    pic.src = driveThumb(item.id);
    pic.onerror = function () { pic.remove(); a.classList.add('noimg'); };
    a.appendChild(pic);
    if (item.label) a.appendChild(el('span', 'label', item.label));
    tile.appendChild(a);
    return tile;
  }

  function renderHistory(history) {
    if (!history.length) return;
    var box = $('history');
    box.textContent = '';
    history.forEach(function (b) {
      var card = el('article', 'ann');
      var head = el('div', 'ann-head');
      head.appendChild(el('b', null, 'అన్నదానం #' + b.no + (b.date ? ' · ' + niceDate(b.date) : '')));
      head.appendChild(el('span', 'veg-mini', 'శాకాహారం'));
      card.appendChild(head);
      var facts = [];
      if (b.served || b.paid) facts.push((b.served || b.paid) + ' భోజనాలు అందించాము');
      if (b.area) facts.push('📍 ' + b.area);
      if (facts.length) card.appendChild(el('p', 'meta', facts.join(' · ')));

      var items = (b.media || []).slice();
      if (b.youtube) items.push({ id: b.youtube, kind: 'youtube' });
      (b.bills || []).forEach(function (x) { items.push({ id: x.id, kind: x.kind, label: 'బిల్లు' }); });
      if (items.length) {
        var grid = el('div', 'media');
        items.forEach(function (it) { grid.appendChild(mediaTile(it)); });
        card.appendChild(grid);
      }
      if (b.note) card.appendChild(el('p', 'note', b.note));
      if (b.sponsors && b.sponsors.length) {
        card.appendChild(el('p', 'meta', 'స్పాన్సర్లు · Sponsors'));
        card.appendChild(sponsorList(b.sponsors));
      }
      box.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- loading
  function load() {
    if (!API) {
      $('active').textContent = 'ఈ పేజీ ఇంకా సిద్ధం కాలేదు. · This page is not ready yet.';
      return;
    }
    var cached = getItem('localStorage', FEED_KEY);
    if (cached) {
      try { render(JSON.parse(cached)); } catch (e) { /* ignore broken cache */ }
    }
    fetch(API + '?action=annadanam')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        render(d);
        setItem('localStorage', FEED_KEY, JSON.stringify(d));
      })
      .catch(function () {
        if (!cached) $('active').textContent = 'వివరాలు లోడ్ కాలేదు - కొద్దిసేపటి తర్వాత మళ్ళీ చూడండి.';
      });
  }

  // ---------------------------------------------------------------- pledge form
  var ERRORS = {
    empty: 'దయచేసి మీ పేరు రాయండి. · Please type your name.',
    short: 'పేరు కనీసం 2 అక్షరాలు ఉండాలి. · At least 2 letters.',
    link: 'లింకులు, ఈమెయిల్‌లు రాయకండి. · No links or emails.',
    digits: 'పేరులో ఫోన్ నంబర్ రాయకండి. · No phone numbers in the name.',
    gothram: 'గోత్రం సరిగా రాయండి. · Please check the gothram.',
    forWhom: '"ఎవరి పేరు మీద" సరిగా రాయండి. · Please check "in whose name".',
    occasion: 'సందర్భం సరిగా రాయండి. · Please check the occasion.',
    meals: 'భోజనాల సంఖ్య 1 నుండి 1000 వరకు. · Meals: 1 to 1000.',
    phone: 'ఫోన్ నంబర్ 10 అంకెలు ఉండాలి. · Phone must be 10 digits.',
    choose: 'పేరు చూపించాలా వద్దా ఎంచుకోండి. · Please choose Yes or No.',
    busy: 'కొద్దిసేపు ఆగి మళ్ళీ ప్రయత్నించండి. · Please try again in a minute.',
    net: 'నెట్‌వర్క్ సమస్య - మళ్ళీ ప్రయత్నించండి. · Network problem, please try again.',
    off: 'ఈ పేజీ ఇంకా సిద్ధం కాలేదు. · This page is not ready yet.'
  };

  function showMsg(text, ok) {
    var m = $('p-msg');
    m.textContent = text;
    m.className = 'msg ' + (ok ? 'ok' : 'err');
  }

  function openBatch() {
    var list = (feed && feed.active) || [];
    for (var i = list.length - 1; i >= 0; i--) if (list[i].status === 'open') return list[i];
    return null;
  }

  function updateCost() {
    var b = openBatch();
    var meals = Number($('p-meals').value) || 0;
    $('p-cost').textContent = b && b.cost && meals > 0
      ? 'సుమారు ' + rupees(meals * b.cost) + ' (ఒక్క భోజనం ' + rupees(b.cost) + ') - తేదీ ఖరారైన తర్వాత నేరుగా క్యాటరర్‌కు.'
      : '';
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    var name = $('p-name').value.replace(/\s+/g, ' ').trim();
    var meals = Number($('p-meals').value);
    var choice = form.querySelector('input[name="show"]:checked');
    if (!name) return showMsg(ERRORS.empty, false);
    if (Array.from(name).length < 2) return showMsg(ERRORS.short, false);
    if (!(meals >= 1 && meals <= 1000 && Math.floor(meals) === meals)) return showMsg(ERRORS.meals, false);
    var phone = $('p-phone').value.trim();
    if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''))) {
      return showMsg(ERRORS.phone, false);
    }
    if (!choice) return showMsg(ERRORS.choose, false);
    if (!API) return showMsg(ERRORS.off, false);

    var body = {
      action: 'pledge', name: name, gothram: $('p-gothram').value.trim(),
      showGothram: $('p-show-gothram').checked, occasion: $('p-occasion').value,
      occasionOther: $('p-occasion-other').value.trim(), forWhom: $('p-for').value.trim(),
      prefDate: $('p-date').value, meals: meals, phone: phone, show: choice.value === 'yes',
      website: form.elements.website.value
    };
    var btn = $('p-btn');
    btn.disabled = true;
    fetch(API, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) return showMsg(ERRORS[res && res.error] || ERRORS.net, false);
        showMsg('🙏 ధన్యవాదాలు, ' + (res.name || name) + '! ' + meals + ' భోజనాలు నమోదయ్యాయి. ఇప్పుడు డబ్బు చెల్లించకండి. ' +
          'తేదీ ఖరారైనప్పుడు క్యాటరర్ UPI ఈ పేజీలో కనిపిస్తుంది' + (phone ? ', మీకు ఫోన్‌లో కూడా తెలియజేస్తాము.' : '.') +
          ' · Thank you! Do not pay now.', true);
        var b = openBatch();
        if (b && res.batch === b.no) {
          b.pledged += meals;
          renderActive(feed.active, feed.waiting || 0);
        }
        form.reset();
        $('p-occasion-other').hidden = true;
        updateCost();
      })
      .catch(function () { showMsg(ERRORS.net, false); })
      .then(function () { btn.disabled = false; });
  }

  // ---------------------------------------------------------------- start
  function start() {
    $('pledge-form').addEventListener('submit', onSubmit);
    $('p-meals').addEventListener('input', updateCost);
    $('p-occasion').addEventListener('change', function () {
      $('p-occasion-other').hidden = this.value !== 'other';
    });
    var text = 'పురాణోదయం అన్నదాన సేవ - 100% శాకాహారం. మీ పుట్టినరోజు, పెళ్లి రోజు సందర్భంగా భోజనాలు స్పాన్సర్ చేయండి: ' +
      PAGE_URL + '?s=share';
    $('share-btn').href = 'https://wa.me/?text=' + encodeURIComponent(text);
    logVisit();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
