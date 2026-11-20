/* Puranodayam annadanam page: a sponsor books meals for their own special day and pays the CATERER directly
   (now, or after we contact them). Food is served on that day only after full payment. We never take money. */
(function () {
  'use strict';

  var C = window.SEVA_CONFIG || {};
  var API = String(C.API_URL || '').trim();
  var PAGE_URL = location.origin + location.pathname;
  var FEED_KEY = 'pv_ann_v2';
  var OFFICIAL = 'puranodayam.github.io'; // the real address - shown so sponsors can spot a fake copy of this page
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

  function settings() { return (feed && feed.settings) || { cost: 0, payNow: false, minDate: '', maxDate: '' }; }

  // ---------------------------------------------------------------- visit count (shows in the Daily report)
  function logVisit() {
    // ?s=ann-a5 / ann-sticker / ann-mobile from the annadanam QR stickers; plain visits count as "annadanam"
    var tag = String(new URLSearchParams(location.search).get('s') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
    var src = /^ann-/.test(tag) ? tag : 'annadanam';
    if (!API || getItem('sessionStorage', 'pv_scan_' + src)) return;
    setItem('sessionStorage', 'pv_scan_' + src, '1');
    var isNew = getItem('localStorage', 'pv_seen') ? '0' : '1';
    setItem('localStorage', 'pv_seen', String(Date.now()));
    try { fetch(API + '?action=scan&s=' + encodeURIComponent(src) + '&n=' + isNew, { mode: 'no-cors' }).catch(function () {}); } catch (e) { /* old browser */ }
  }

  // ---------------------------------------------------------------- rendering
  function render(d) {
    feed = d || {};
    var t = feed.totals || {};
    $('t-done').textContent = String(t.done || 0);
    $('t-meals').textContent = String(t.meals || 0);
    $('t-sponsors').textContent = String(t.sponsors || 0);
    var s = settings();
    if (s.minDate) $('p-date').min = s.minDate;
    if (s.maxDate) $('p-date').max = s.maxDate;
    var nowRadio = document.querySelector('input[name="pay"][value="now"]');
    nowRadio.disabled = !s.payNow;
    $('pay-now-label').classList.toggle('off', !s.payNow);
    if (!s.payNow && nowRadio.checked) nowRadio.checked = false;
    renderUpcoming(feed.upcoming || []);
    renderHistory(feed.history || []);
    updateTotal();
    if (feed.updated) {
      var u = new Date(feed.updated);
      $('updated').textContent = 'చివరి అప్‌డేట్: ' +
        (isNaN(u) ? feed.updated : u.toLocaleString('te-IN', { dateStyle: 'medium', timeStyle: 'short' }));
    }
  }

  function sponsorLine(s) {
    var li = el('li');
    if (!s.name) {
      li.appendChild(el('b', null, '🙏 ఒక భక్తుడు'));
      li.appendChild(document.createTextNode(' - ' + s.meals + ' భోజనాలు'));
      return li;
    }
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

  function renderUpcoming(list) {
    var box = $('upcoming');
    box.textContent = '';
    if (!list.length) {
      box.appendChild(el('p', 'muted', 'ఇంకా బుకింగ్‌లు లేవు - మీ రోజును మొదట బుక్ చేయండి! · No paid bookings yet.'));
      return;
    }
    list.forEach(function (u) {
      var card = el('article', 'ann');
      var head = el('div', 'ann-head');
      head.appendChild(el('b', null, '📅 ' + niceDate(u.date)));
      head.appendChild(el('span', 'status ' + (u.past ? 'open' : 'confirmed'), u.past ? 'ఫోటోలు త్వరలో' : u.meals + ' భోజనాలు'));
      card.appendChild(head);
      card.appendChild(sponsorList(u.sponsors || []));
      box.appendChild(card);
    });
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
    history.forEach(function (h) {
      var card = el('article', 'ann');
      var head = el('div', 'ann-head');
      head.appendChild(el('b', null, '📅 ' + niceDate(h.date)));
      head.appendChild(el('span', 'veg-mini', 'శాకాహారం'));
      card.appendChild(head);
      var facts = [];
      if (h.served) facts.push(h.served + ' భోజనాలు అందించాము');
      if (h.area) facts.push('📍 ' + h.area);
      if (facts.length) card.appendChild(el('p', 'meta', facts.join(' · ')));
      var items = (h.media || []).slice();
      if (h.youtube) items.push({ id: h.youtube, kind: 'youtube' });
      (h.bills || []).forEach(function (x) { items.push({ id: x.id, kind: x.kind, label: 'బిల్లు' }); });
      if (items.length) {
        var grid = el('div', 'media');
        items.forEach(function (it) { grid.appendChild(mediaTile(it)); });
        card.appendChild(grid);
      }
      if (h.note) card.appendChild(el('p', 'note', h.note));
      if (h.sponsors && h.sponsors.length) {
        card.appendChild(el('p', 'meta', 'స్పాన్సర్లు · Sponsors'));
        card.appendChild(sponsorList(h.sponsors));
      }
      box.appendChild(card);
    });
  }

  function updateTotal() {
    var cost = settings().cost;
    var meals = Number($('p-meals').value) || 0;
    var box = $('p-total');
    box.textContent = '';
    if (cost > 0 && meals > 0) {
      box.appendChild(el('b', null, 'మొత్తం: ' + rupees(meals * cost)));
      box.appendChild(el('small', null, '(' + meals + ' భోజనాలు × ' + rupees(cost) + ') · Total'));
    } else if (meals > 0) {
      box.appendChild(el('small', null, 'మొత్తం మేము ఫోన్‌లో తెలియజేస్తాము · We will tell you the total'));
    }
  }

  // ---------------------------------------------------------------- loading
  function load() {
    if (!API) {
      $('upcoming').textContent = 'ఈ పేజీ ఇంకా సిద్ధం కాలేదు. · This page is not ready yet.';
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
        if (!cached) $('upcoming').textContent = 'వివరాలు లోడ్ కాలేదు - కొద్దిసేపటి తర్వాత మళ్ళీ చూడండి.';
      });
  }

  // ---------------------------------------------------------------- booking form
  var ERRORS = {
    empty: 'దయచేసి మీ పేరు రాయండి. · Please type your name.',
    short: 'పేరు కనీసం 2 అక్షరాలు ఉండాలి. · At least 2 letters.',
    link: 'లింకులు, ఈమెయిల్‌లు రాయకండి. · No links or emails.',
    digits: 'పేరులో ఫోన్ నంబర్ రాయకండి. · No phone numbers in the name.',
    gothram: 'గోత్రం సరిగా రాయండి. · Please check the gothram.',
    forWhom: '"ఎవరి పేరు మీద" సరిగా రాయండి. · Please check "in whose name".',
    occasion: 'సందర్భం సరిగా రాయండి. · Please check the occasion.',
    meals: 'భోజనాల సంఖ్య 1 నుండి 1000 వరకు. · Meals: 1 to 1000.',
    date: 'దయచేసి సరైన తేదీ ఎంచుకోండి. · Please pick a valid date.',
    phone: 'సరైన 10 అంకెల ఫోన్ నంబర్ రాయండి. · Please type a 10-digit phone number.',
    pay: 'చెల్లింపు ఎప్పుడో ఎంచుకోండి. · Please choose when you will pay.',
    choose: 'పేరు చూపించాలా వద్దా ఎంచుకోండి. · Please choose Yes or No.',
    busy: 'కొద్దిసేపు ఆగి మళ్ళీ ప్రయత్నించండి. · Please try again in a minute.',
    limit: 'ఈ ఫోన్ నంబర్‌తో ఈరోజు ఇప్పటికే 3 బుకింగ్‌లు చేశారు. రేపు మళ్ళీ ప్రయత్నించండి. · This phone already made 3 bookings today.',
    net: 'నెట్‌వర్క్ సమస్య - మళ్ళీ ప్రయత్నించండి. · Network problem, please try again.',
    off: 'ఈ పేజీ ఇంకా సిద్ధం కాలేదు. · This page is not ready yet.'
  };

  function showMsg(text, ok) {
    var m = $('p-msg');
    m.textContent = text;
    m.className = 'msg ' + (ok ? 'ok' : 'err');
  }

  function cleanPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  }

  function showResult(res, phone) {
    var box = $('result');
    box.textContent = '';
    box.appendChild(el('h3', null, '🙏 ధన్యవాదాలు, ' + res.name + '!'));
    var facts = el('dl', 'facts');
    [['బుకింగ్ నంబర్', res.booking], ['తేదీ', niceDate(res.date)], ['భోజనాలు', String(res.meals)],
     ['మొత్తం', res.amount ? rupees(res.amount) : 'ఫోన్‌లో తెలియజేస్తాము']].forEach(function (f) {
      facts.appendChild(el('dt', null, f[0]));
      facts.appendChild(el('dd', null, f[1]));
    });
    box.appendChild(facts);

    if (res.pay && !res.pay.upi && res.pay.phone) {
      box.appendChild(phonePay(res));
    } else if (res.pay) {
      var pay = el('div', 'pay');
      pay.appendChild(el('b', null, '💳 ఇప్పుడు చెల్లించండి: నేరుగా క్యాటరర్‌కు · Pay the caterer'));
      pay.appendChild(el('p', 'tiny', '✅ చెల్లించే ముందు: అడ్రస్ బార్‌లో ' + OFFICIAL + ' ఉందో చూసుకోండి.'));
      if (res.pay.caterer) pay.appendChild(el('p', null, res.pay.caterer));
      var row = el('div', 'upi');
      row.appendChild(el('code', null, res.pay.upi));
      var copy = el('button', 'btn-copy', 'కాపీ');
      copy.type = 'button';
      copy.addEventListener('click', function () {
        try {
          navigator.clipboard.writeText(res.pay.upi).then(function () { copy.textContent = '✓ కాపీ అయింది'; }, function () {});
        } catch (e) { /* no clipboard: the UPI ID is on screen */ }
      });
      row.appendChild(copy);
      pay.appendChild(row);
      var open = el('a', 'btn-upi', 'UPI యాప్‌లో ' + rupees(res.pay.amount) + ' చెల్లించండి');
      // keep "@" literal in pa= (some UPI apps do not decode %40)
      open.href = 'upi://pay?pa=' + encodeURIComponent(res.pay.upi).replace(/%40/g, '@') +
        '&pn=' + encodeURIComponent(res.pay.caterer || 'Caterer') +
        '&am=' + encodeURIComponent(String(res.pay.amount)) + '&cu=INR&tn=' + encodeURIComponent('Annadanam ' + res.booking);
      pay.appendChild(open);
      pay.appendChild(el('p', 'tiny', 'పూర్తి మొత్తం ' + rupees(res.pay.amount) + ' చెల్లించండి. క్యాటరర్ నిర్ధారించిన తర్వాత ' +
        'మేము మీకు WhatsApp చేస్తాము, ఆ రోజు భోజనం అందిస్తాము. · Pay the full amount; we confirm on WhatsApp.'));
      box.appendChild(pay);
    } else {
      box.appendChild(el('p', 'contact', '📞 మీ వివరాలు సేవ్ అయ్యాయి. మేము మీకు ' + phone +
        ' కి కాల్ / WhatsApp చేస్తాము. ఇప్పుడు డబ్బు చెల్లించకండి. · Saved - we will call or WhatsApp you.'));
    }
    box.appendChild(el('p', 'tiny', 'మీ బుకింగ్ నంబర్ ' + res.booking + ' గుర్తుంచుకోండి. పూర్తి చెల్లింపు అందిన తర్వాతే మీ రోజున భోజనం అందిస్తాము.'));
    var again = el('button', 'btn-light', 'ఇంకో బుకింగ్ · Book again');
    again.type = 'button';
    again.addEventListener('click', function () {
      box.hidden = true;
      $('pledge-form').hidden = false;
    });
    box.appendChild(again);
    $('pledge-form').hidden = true;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** "Pay now" when the caterer gave a PhonePe / Google Pay NUMBER (not a UPI ID): send money to that number. */
  function phonePay(res) {
    var pay = el('div', 'pay');
    pay.appendChild(el('b', null, '📱 ఇప్పుడు చెల్లించండి: నేరుగా క్యాటరర్‌కు · Pay the caterer'));
    pay.appendChild(el('p', 'tiny', '✅ చెల్లించే ముందు: అడ్రస్ బార్‌లో ' + OFFICIAL + ' ఉందో చూసుకోండి.'));
    if (res.pay.caterer) pay.appendChild(el('p', null, res.pay.caterer));
    pay.appendChild(el('p', null, 'PhonePe / Google Pay / Paytm నంబర్:'));
    var row = el('div', 'upi');
    row.appendChild(el('code', null, res.pay.phone));
    var copy = el('button', 'btn-copy', 'కాపీ');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      try {
        navigator.clipboard.writeText(res.pay.phone).then(function () { copy.textContent = '✓ కాపీ అయింది'; }, function () {});
      } catch (e) { /* no clipboard: the number is on screen */ }
    });
    row.appendChild(copy);
    pay.appendChild(row);
    pay.appendChild(el('p', 'amount-line', 'పంపాల్సిన మొత్తం: ' + rupees(res.pay.amount)));
    var steps = el('ol', 'pay-steps');
    ['PhonePe (లేదా Google Pay) తెరవండి', '"To Mobile Number" / "Pay phone number" ఎంచుకోండి',
     'పై నంబర్ ఇచ్చి ' + rupees(res.pay.amount) + ' పంపండి', 'నోట్‌లో బుకింగ్ నంబర్ ' + res.booking + ' రాయండి']
      .forEach(function (t) { steps.appendChild(el('li', null, t)); });
    pay.appendChild(steps);
    pay.appendChild(el('p', 'tiny', 'పూర్తి మొత్తం ' + rupees(res.pay.amount) + ' చెల్లించండి. క్యాటరర్ నిర్ధారించిన తర్వాత ' +
      'మేము మీకు WhatsApp చేస్తాము, ఆ రోజు భోజనం అందిస్తాము. · Pay the full amount; we confirm on WhatsApp.'));
    return pay;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    var s = settings();
    var date = $('p-date').value;
    var name = $('p-name').value.replace(/\s+/g, ' ').trim();
    var meals = Number($('p-meals').value);
    var phone = cleanPhone($('p-phone').value);
    var pay = form.querySelector('input[name="pay"]:checked');
    var show = form.querySelector('input[name="show"]:checked');
    if (!date || (s.minDate && date < s.minDate) || (s.maxDate && date > s.maxDate)) {
      return showMsg(s.minDate ? 'తేదీ ' + niceDate(s.minDate) + ' లేదా తర్వాత ఎంచుకోండి. · Pick ' + s.minDate + ' or later.'
                               : ERRORS.date, false);
    }
    if (!(meals >= 1 && meals <= 1000 && Math.floor(meals) === meals)) return showMsg(ERRORS.meals, false);
    if (!name) return showMsg(ERRORS.empty, false);
    if (Array.from(name).length < 2) return showMsg(ERRORS.short, false);
    if (!phone) return showMsg(ERRORS.phone, false);
    if (!pay) return showMsg(ERRORS.pay, false);
    if (!show) return showMsg(ERRORS.choose, false);
    if (!API) return showMsg(ERRORS.off, false);

    var body = {
      action: 'pledge', date: date, name: name, gothram: $('p-gothram').value.trim(),
      showGothram: $('p-show-gothram').checked, occasion: $('p-occasion').value,
      occasionOther: $('p-occasion-other').value.trim(), forWhom: $('p-for').value.trim(),
      meals: meals, phone: phone, pay: pay.value, show: show.value === 'yes', website: form.elements.website.value
    };
    var btn = $('p-btn');
    btn.disabled = true;
    showMsg('', true);
    fetch(API, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          if (res && res.error === 'date' && res.minDate) {
            return showMsg('తేదీ ' + niceDate(res.minDate) + ' లేదా తర్వాత ఎంచుకోండి. · Pick ' + res.minDate + ' or later.', false);
          }
          return showMsg(ERRORS[res && res.error] || ERRORS.net, false);
        }
        showResult(res, phone);
        form.reset();
        $('p-occasion-other').hidden = true;
        updateTotal();
      })
      .catch(function () { showMsg(ERRORS.net, false); })
      .then(function () { btn.disabled = false; });
  }

  // ---------------------------------------------------------------- start
  function start() {
    $('pledge-form').addEventListener('submit', onSubmit);
    $('p-meals').addEventListener('input', updateTotal);
    $('p-occasion').addEventListener('change', function () {
      $('p-occasion-other').hidden = this.value !== 'other';
    });
    var text = 'పురాణోదయం అన్నదాన సేవ - 100% శాకాహారం. మీ పుట్టినరోజు, పెళ్లి రోజు రోజున భోజనాలు స్పాన్సర్ చేయండి: ' +
      PAGE_URL + '?s=share';
    $('share-btn').href = 'https://wa.me/?text=' + encodeURIComponent(text);
    updateTotal();
    logVisit();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
