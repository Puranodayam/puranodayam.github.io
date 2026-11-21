/* Puranodayam feedback page: a sponsor rates their annadanam with the private link you sent on WhatsApp
   (feedback.html?b=A0007&k=xxxxxxxx). Only that link works for that booking. */
(function () {
  'use strict';

  var C = window.SEVA_CONFIG || {};
  var API = String(C.API_URL || '').trim();
  var q = new URLSearchParams(location.search);
  var BOOKING = String(q.get('b') || '').trim().toUpperCase();
  var KEY = String(q.get('k') || '').trim().toLowerCase();
  var rating = 0;
  var info = null;

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
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

  function setRating(v) {
    rating = v;
    Array.prototype.forEach.call(document.querySelectorAll('#rate button'), function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-v')) <= v);
      b.setAttribute('aria-pressed', Number(b.getAttribute('data-v')) === v ? 'true' : 'false');
    });
  }

  function say(text, ok) {
    var m = $('fb-msg');
    m.textContent = text;
    m.className = 'msg ' + (ok ? 'ok' : 'err');
  }

  function showWho(d) {
    var box = $('who');
    box.textContent = '';
    box.appendChild(el('h2', null, '🙏 ' + d.name + ' గారు'));
    box.appendChild(el('p', null, niceDate(d.date) + ' న మీ ' + d.meals + ' భోజనాల అన్నదానం' +
      (d.occasion ? ' (' + d.occasion + ')' : '') + ' · బుకింగ్ ' + d.booking));
    if (!d.paid) {
      box.appendChild(el('p', 'msg err', 'ఈ బుకింగ్ చెల్లింపు ఇంకా నిర్ధారణ కాలేదు. అన్నదానం తర్వాత అభిప్రాయం ఇవ్వండి.'));
      return;
    }
    $('fb-form').hidden = false;
    if (d.given) {
      setRating(d.given.rating);
      $('fb-words').value = d.given.words || '';
      box.appendChild(el('p', 'tiny', 'మీరు ఇంతకు ముందే అభిప్రాయం ఇచ్చారు - మార్చాలనుకుంటే మళ్ళీ పంపండి.'));
    }
  }

  function showDone(res) {
    $('fb-form').hidden = true;
    var box = $('fb-done');
    box.textContent = '';
    box.appendChild(el('h3', null, '🙏 ధన్యవాదాలు, ' + res.name + ' గారు!'));
    box.appendChild(el('p', null, res.rating >= 4
      ? 'మీ మాటలు మాకు ఎంతో బలం. మీ కుటుంబం, స్నేహితులతో పంచుకోండి.'
      : 'మీ అభిప్రాయం మాకు చాలా ముఖ్యం. మేము మీతో మాట్లాడి మెరుగుపరుస్తాము.'));
    if (res.rating >= 4) {
      var share = el('a', 'btn-wa', 'WhatsApp లో షేర్ చేయండి · Share');
      share.target = '_blank';
      share.rel = 'noopener';
      share.href = 'https://wa.me/?text=' + encodeURIComponent('🙏 పురాణోదయం అన్నదాన సేవ - 100% శాకాహారం. నా రోజున ' +
        'అవసరమైన వారికి భోజనాలు అందించారు. మీరూ స్పాన్సర్ చేయవచ్చు: ' + location.origin +
        location.pathname.replace(/feedback\.html$/, '') + 'annadanam.html?s=ann-share');
      box.appendChild(share);
    }
    var c = info && info.contact;
    if (c && c.channel) {
      var ch = el('a', 'btn-channel', '📢 మా WhatsApp Channel ఫాలో అవ్వండి');
      ch.target = '_blank';
      ch.rel = 'noopener';
      ch.href = c.channel;
      box.appendChild(ch);
    }
    var back = el('a', 'btn-light', 'అన్నదాన సేవ పేజీ · Annadanam page');
    back.href = 'annadanam.html';
    back.style.display = 'block';
    back.style.textAlign = 'center';
    back.style.textDecoration = 'none';
    box.appendChild(back);
    box.hidden = false;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (!rating) return say('దయచేసి 1 నుండి 5 లో ఒకటి ఎంచుకోండి. · Please tap a number.', false);
    var btn = $('fb-btn');
    btn.disabled = true;
    fetch(API, { method: 'POST', body: JSON.stringify({ action: 'feedback', b: BOOKING, k: KEY, rating: rating,
      words: $('fb-words').value.replace(/\s+/g, ' ').trim(), show: $('fb-show').checked,
      website: ev.target.elements.website.value }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) return showDone(res);
        var err = res && res.error;
        say(err === 'words' ? 'మాటలో లింకులు, ఫోన్ నంబర్లు రాయకండి. · No links or phone numbers.'
          : err === 'busy' ? 'కొద్దిసేపు ఆగి మళ్ళీ ప్రయత్నించండి.'
          : err === 'link' ? 'ఈ లింక్ సరైనది కాదు. · This link is not valid.'
          : 'నెట్‌వర్క్ సమస్య - మళ్ళీ ప్రయత్నించండి. · Network problem.', false);
      })
      .catch(function () { say('నెట్‌వర్క్ సమస్య - మళ్ళీ ప్రయత్నించండి. · Network problem.', false); })
      .then(function () { btn.disabled = false; });
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('#rate button'), function (b) {
      b.addEventListener('click', function () { setRating(Number(b.getAttribute('data-v'))); });
    });
    $('fb-form').addEventListener('submit', onSubmit);
    if (!API || !/^A\d{4,}$/.test(BOOKING) || !/^[0-9a-f]{8}$/.test(KEY)) {
      $('who').textContent = 'ఈ లింక్ సరైనది కాదు. మేము పంపిన WhatsApp లింక్‌నే తెరవండి. · Please open the link we sent you.';
      return;
    }
    fetch(API + '?action=fbinfo&b=' + encodeURIComponent(BOOKING) + '&k=' + encodeURIComponent(KEY))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) {
          $('who').textContent = 'ఈ లింక్ సరైనది కాదు. మేము పంపిన WhatsApp లింక్‌నే తెరవండి. · Please open the link we sent you.';
          return;
        }
        info = d;
        showWho(d);
      })
      .catch(function () { $('who').textContent = 'నెట్‌వర్క్ సమస్య - పేజీని మళ్ళీ తెరవండి. · Network problem.'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
