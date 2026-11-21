/* Admin one-tap approve: opened from the "✅ Approve payment" button in your email (approve.html?b=A0002&t=<16 code>).
   Opening the page changes nothing; only the Approve / Cancel buttons (POST) change the booking. */
(function () {
  'use strict';

  var C = window.SEVA_CONFIG || {};
  var API = String(C.API_URL || '').trim();
  var q = new URLSearchParams(location.search);
  var B = String(q.get('b') || '').trim().toUpperCase();
  var T = String(q.get('t') || '').trim().toLowerCase();
  var info = null;

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function rupees(n) {
    n = Number(n) || 0;
    try { return '₹' + n.toLocaleString('en-IN'); } catch (e) { return '₹' + n; }
  }

  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? String(iso || '') : d.toLocaleString('te-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  var STATE = {
    pending: '⏳ ఇంకా చెల్లించాను అనలేదు · No claim yet',
    checking: '🟡 చెల్లించాను అంటున్నారు - మీ చెక్ కోసం · Says paid - check it',
    paid: '✅ ఆమోదించబడింది · Approved (paid)',
    cancelled: '❌ రద్దు · Cancelled'
  };

  function show(d) {
    var box = $('info');
    box.textContent = '';
    box.appendChild(el('h2', null, d.booking + ' · ' + d.name));
    var dl = el('dl');
    [['స్థితి · Status', STATE[d.status] || d.status], ['మొత్తం · Amount', d.amount ? rupees(d.amount) : '-'],
     ['UTR', d.utr || '(ఇవ్వలేదు - స్క్రీన్‌షాట్ అడగండి)'], ['తేదీ · Date', d.date], ['భోజనాలు · Meals', d.meals],
     ['సందర్భం · Occasion', d.occasion || '-'], ['ఫోన్ · Phone', d.phone || '-'],
     ['చెల్లించాను అన్నది · Claimed', d.claimedAt ? when(d.claimedAt) : '-']].forEach(function (r) {
      dl.appendChild(el('dt', null, r[0]));
      dl.appendChild(el('dd', null, String(r[1])));
    });
    box.appendChild(dl);
    if (d.status === 'paid' || d.status === 'cancelled') {
      box.appendChild(el('p', 'msg ' + (d.status === 'paid' ? 'ok' : 'err'), 'ఇప్పటికే నిర్ణయం అయింది - మార్పు లేదు. · Already decided.'));
      return;
    }
    $('seen-text').textContent = 'క్యాటరర్ UPI యాప్‌లో ' + (d.amount ? rupees(d.amount) : 'ఈ మొత్తం') +
      (d.utr ? ' (UTR …' + d.utr.slice(-4) + ')' : '') + ' వచ్చింది చూశాను · I saw this money arrive';
    $('actions').hidden = false;
  }

  function decide(decision) {
    var btns = [$('approve'), $('cancel')];
    btns.forEach(function (b) { b.disabled = true; });
    fetch(API, { method: 'POST', body: JSON.stringify({ action: 'approve', b: B, t: T, decision: decision,
                                                         checked: $('seen').checked }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        var done = $('done');
        done.textContent = '';
        if (!r || !r.ok) {
          done.appendChild(el('p', 'msg err', r && r.error === 'check' ? 'ముందు టిక్ చేయండి. · Tick the box first.'
            : 'పని కాలేదు - మళ్ళీ ప్రయత్నించండి. · Did not work, try again.'));
          done.hidden = false;
          btns.forEach(function (b) { b.disabled = false; });
          $('approve').disabled = !$('seen').checked;
          return;
        }
        $('actions').hidden = true;
        var statusCell = $('info').querySelector('dd');
        if (statusCell) statusCell.textContent = STATE[r.status] || r.status;
        done.appendChild(el('p', 'status-chip ' + (r.status === 'paid' ? 'ok' : 'bad'),
          r.unchanged ? 'ఇప్పటికే నిర్ణయం అయింది: ' + r.status : (r.status === 'paid' ? '✅ ఆమోదించబడింది - పేజీలో కనిపిస్తుంది.' : '❌ రద్దు చేయబడింది.')));
        if (r.wa) {
          var wa = el('a', 'btn-wa', r.status === 'paid' ? '💬 ' + info.name + ' కు WhatsApp లో తెలియజేయండి'
                                                       : '💬 ' + info.name + ' కు రద్దు విషయం తెలియజేయండి');
          wa.href = r.wa;
          wa.target = '_blank';
          wa.rel = 'noopener';
          done.appendChild(wa);
        }
        done.hidden = false;
      })
      .catch(function () {
        btns.forEach(function (b) { b.disabled = false; });
        $('approve').disabled = !$('seen').checked;
      });
  }

  function start() {
    $('seen').addEventListener('change', function () { $('approve').disabled = !this.checked; });
    $('approve').addEventListener('click', function () { decide('paid'); });
    $('cancel').addEventListener('click', function () {
      if (window.confirm('ఈ బుకింగ్ రద్దు చేయాలా? · Cancel this booking?')) decide('cancelled');
    });
    if (!API || !/^A\d{4,}$/.test(B) || !/^[0-9a-f]{16}$/.test(T)) {
      $('info').textContent = 'ఈ లింక్ సరైనది కాదు. · This link is not valid.';
      return;
    }
    fetch(API + '?action=adminfo&b=' + encodeURIComponent(B) + '&t=' + encodeURIComponent(T))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) { $('info').textContent = 'ఈ లింక్ సరైనది కాదు. · This link is not valid.'; return; }
        info = d;
        show(d);
      })
      .catch(function () { $('info').textContent = 'నెట్‌వర్క్ సమస్య - పేజీని మళ్ళీ తెరవండి.'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
