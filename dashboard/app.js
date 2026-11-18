// Token Radar dashboard. Reads window.RADAR beside dashboard/.
// No network: every figure shown comes from data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var $ = function (id) { return document.getElementById(id); };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return String(Math.round(n * 10000) / 10000);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- model (tolerant of the newer radar-2 fields) ----------
  function model() { return DATA.model || {}; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Base multiple: the row's own value when present, else the category multiple
  // from the model, else the single base multiple.
  function baseMultipleOf(row) {
    var m = model();
    if (typeof row.base_multiple === 'number' && isFinite(row.base_multiple)) {
      return { value: row.base_multiple, label: 'Base multiple (row)' };
    }
    var cm = m.category_multiples;
    if (cm && typeof cm[row.category] === 'number' && isFinite(cm[row.category])) {
      return { value: cm[row.category], label: 'Category multiple (' + row.category + ')' };
    }
    return { value: m.base_multiple, label: 'Base multiple' };
  }
  function chainMultOf(row) {
    if (typeof row.chain_multiplier === 'number' && isFinite(row.chain_multiplier)) return row.chain_multiplier;
    return 1;
  }
  function growthOf(row, weight) {
    var m = model();
    var raw = (row.change_7d === null || row.change_7d === undefined) ? 0 : row.change_7d;
    var g = clamp(raw, m.growth_floor, m.growth_cap);
    var w = (weight === undefined || weight === null) ? m.growth_weight : weight;
    return { pct: g, mult: 1 + (g / 100) * w };
  }
  function maturityOf(row, range) {
    var m = model();
    var age = (row.age_days === null || row.age_days === undefined) ? m.unknown_age_days : row.age_days;
    var r = (range === undefined || range === null) ? m.maturity_range : range;
    return { age: age, mult: m.maturity_floor + (clamp(age, 0, m.maturity_days) / m.maturity_days) * r };
  }
  // Recompute one row's implied value; `over` carries sandbox overrides.
  function impliedOf(row, over) {
    var m = model();
    var base = baseMultipleOf(row).value * (over && over.baseScale ? over.baseScale : 1);
    var g = growthOf(row, over ? over.growthWeight : undefined);
    var mat = maturityOf(row, over ? over.maturityRange : undefined);
    var chain = chainMultOf(row);
    var v = Math.max(1, Math.round(row.tvl_usd * base * g.mult * mat.mult * chain));
    return { value: v, base: base, growth: g, maturity: mat, chain: chain };
  }

  // Farm plan: row's own steps when present, else derived locally.
  function chainOf(p) { return (p.chains && p.chains.length > 0) ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and hold the position.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and hold it.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and hold the position.';
  }
  function derivedFarmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet holding only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action each week: a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before withdrawing, check the protocol's own points page and claim only from its published link.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Log the wallet, the dates and every transaction so you can repeat or unwind the position.', cost: 'nothing but the log', time: '5 minutes' }
    ];
  }
  // The generator writes farm steps as one string each: "action Cost: X. Time: Y."
  function parseStep(s) {
    var at = s.indexOf(' Cost: ');
    if (at < 0) return { text: s, cost: '', time: '' };
    var rest = s.slice(at + 7);
    var tt = rest.indexOf(' Time: ');
    if (tt < 0) return { text: s.slice(0, at), cost: rest, time: '' };
    return { text: s.slice(0, at), cost: rest.slice(0, tt), time: rest.slice(tt + 7) };
  }
  function farmStepsOf(row) {
    if (Array.isArray(row.farm_steps) && row.farm_steps.length > 0) {
      return row.farm_steps.map(function (s) { return typeof s === 'string' ? parseStep(s) : s; });
    }
    return derivedFarmSteps(row);
  }

  var state = {
    q: '', category: 'all', chain: 'all', tab: 'pre-token',
    sort: 'implied', dir: -1, selected: null,
    sandbox: { baseScale: 1, growthWeight: null, maturityRange: null }
  };
  function sandboxActive() {
    var s = state.sandbox;
    return s.baseScale !== 1 || s.growthWeight !== null || s.maturityRange !== null;
  }
  function sandboxOverrides() {
    if (!sandboxActive()) return null;
    var m = model();
    return {
      baseScale: state.sandbox.baseScale,
      growthWeight: state.sandbox.growthWeight === null ? m.growth_weight : state.sandbox.growthWeight,
      maturityRange: state.sandbox.maturityRange === null ? m.maturity_range : state.sandbox.maturityRange
    };
  }

  // ---------- hash deep-links: #p=slug, #q=text, #category=x, #chain=x ----------
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    // Deep-links are absolute: a missing key resets that filter.
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.selected = null;
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    var url = next ? '#' + next : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }

  // ---------- filtering + sorting ----------
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function displayValue(r) {
    var over = sandboxOverrides();
    return over ? impliedOf(r, over).value : r.implied_value_usd;
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = (a.change_7d === null || a.change_7d === undefined) ? -Infinity : a.change_7d; bv = (b.change_7d === null || b.change_7d === undefined) ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = (a.age_days === null || a.age_days === undefined) ? Infinity : a.age_days; bv = (b.age_days === null || b.age_days === undefined) ? Infinity : b.age_days; }
      else { av = displayValue(a); bv = displayValue(b); } // 'implied' and 'rank' both sort by value
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // ---------- render: header, hero, controls ----------
  function renderMeta() {
    $('meta-asof').textContent = 'Snapshot ' + DATA.as_of;
    $('meta-model').textContent = 'Model ' + (DATA.model_version || 'radar');
  }
  function renderFacts() {
    var facts = [
      { n: DATA.watchlist_size + ' / ' + DATA.watchlist_size, s: 'Watchlist covered' },
      { n: String(DATA.board_size), s: 'Pre-token rows scored' },
      { n: String(DATA.early_size), s: 'Early rows below the floor' },
      { n: String(DATA.live_size), s: 'Live-token protocols set aside' }
    ];
    $('facts').innerHTML = facts.map(function (f) {
      return '<div class="fact"><b>' + esc(f.n) + '</b><span>' + esc(f.s) + '</span></div>';
    }).join('');
    $('hero').querySelector('h1').textContent = DATA.watchlist_size + ' watchlist protocols, ranked by implied value';
    var floorM = Math.round(DATA.floor_usd / 1e6);
    $('hero').querySelector('.lede').textContent = 'The board starts from the whole watchlist — every protocol with at least $' + floorM + 'M of TVL and no token on record — then adds the early radar below the floor. Each row is one model run on the snapshot figures: TVL, seven-day growth and age. Implied value is a model, not a price.';
  }
  function fillSelect(selectEl, values, allLabel) {
    var cur = state[selectEl.id]; // state is the source of truth, not the stale DOM value
    selectEl.innerHTML = '<option value="all">' + esc(allLabel) + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }
  function renderControls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.concat(DATA.live || []).reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    fillSelect($('category'), cats, 'All categories');
    fillSelect($('chain'), chains, 'All chains');
    $('q').value = state.q;
    $('tab-pre').setAttribute('aria-pressed', state.tab === 'pre-token' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
  }

  function rowHtml(r, rankShown, maxImplied) {
    var growth = r.change_7d === null || r.change_7d === undefined ? 'n/a' : fmtPct(r.change_7d);
    var gClass = (r.change_7d === null || r.change_7d === undefined) ? '' : (r.change_7d >= 0 ? ' pos' : ' neg');
    var shown = displayValue(r);
    var pct = Math.max(3, Math.round((shown / (maxImplied || 1)) * 100));
    var chains = (r.chains && r.chains.length) ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
    return '<tr class="' + (rankShown <= 3 ? 'top3' : '') + '" data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug) + '" tabindex="0">' +
      '<td class="num"><span class="rank-badge">' + rankShown + '</span></td>' +
      '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></div></td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="num' + gClass + '">' + growth + '</td>' +
      '<td class="num">' + fmtAge(r.age_days) + '</td>' +
      '<td><div class="implied-cell"><span class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span><span class="num">' + fmtUsd(shown) + '</span></div></td>' +
      '<td><span class="status pre">no token</span></td></tr>';
  }
  function renderBoard() {
    var list = sortedRows(filteredRows());
    var over = sandboxOverrides();
    var maxImplied = list.length ? Math.max.apply(null, list.map(displayValue)) : 1;
    var tbody = $('board-body');
    var empty = $('board-empty');
    if (list.length === 0) {
      tbody.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      tbody.innerHTML = list.map(function (r, i) {
        return rowHtml(r, over ? i + 1 : r.rank, maxImplied);
      }).join('');
    }
    $('count').textContent = list.length + ' rows shown' + (over ? ' · sandbox values' : '');
    // sort arrows
    var heads = document.querySelectorAll('#board-table th button[data-sort]');
    heads.forEach(function (b) {
      var base = b.getAttribute('data-label');
      b.innerHTML = esc(base) + (state.sort === b.getAttribute('data-sort') ? ' <span class="arrow" aria-hidden="true">' + (state.dir < 0 ? '▼' : '▲') + '</span>' : '');
    });
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
      });
    });
  }
  function renderLive() {
    var tbody = $('live-body');
    tbody.innerHTML = (DATA.live || []).map(function (r) {
      var chains = (r.chains && r.chains.length) ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain';
      var gClass = (r.change_7d === null || r.change_7d === undefined) ? '' : (r.change_7d >= 0 ? ' pos' : ' neg');
      return '<tr><td class="num">live</td>' +
        '<td><div class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(chains) + '</span></div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num' + gClass + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td><span class="status live">already trades</span></td></tr>';
    }).join('');
    $('count').textContent = (DATA.live || []).length + ' live-token protocols';
  }

  // ---------- render: methodology + category multiples ----------
  function renderMethod() {
    var m = model();
    var chainPart = (m.chain_bonus !== undefined && m.chain_bonus !== null)
      ? ' x (1 + chain bonus, capped at ' + m.chain_cap + ')'
      : '';
    $('formula').textContent = 'implied = round( tvl_usd x base_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ')' + chainPart + ' )';
    var notes = 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.';
    if (typeof m.overall_median === 'number') notes += ' Overall median market-cap-to-TVL ratio across live-token protocols: ' + m.overall_median + '.';
    notes += ' The early radar is every pre-token protocol below the watchlist floor, by TVL; live-token protocols are set aside with their market caps shown.';
    $('model-notes').textContent = notes;

    var cm = m.category_multiples;
    var samples = m.category_samples || {};
    var body = $('cat-body');
    if (cm && typeof cm === 'object' && Object.keys(cm).length > 0) {
      body.innerHTML = Object.keys(cm).sort(function (a, b) { return cm[b] - cm[a]; }).map(function (c) {
        var s = samples[c];
        return '<tr><td>' + esc(c) + '</td><td class="num">' + fmtMult(cm[c]) + '</td><td class="num">' + (s === undefined || s === null ? '—' : String(s)) + '</td></tr>';
      }).join('');
    } else {
      body.innerHTML = '<tr><td>All categories (base multiple)</td><td class="num">' + fmtMult(m.base_multiple) + '</td><td class="num">—</td></tr>';
    }
  }

  function renderFoot() {
    $('foot-source').textContent = 'Source: ' + DATA.source + ' · Snapshot as of ' + DATA.as_of + ' · Model ' + (DATA.model_version || 'radar') + '.';
  }

  var dialog = $('detail');
  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var calc = impliedOf(row);
    var base = baseMultipleOf(row);
    $('detail-kicker').textContent = 'Rank ' + row.rank + ' of ' + DATA.board_size + (sandboxActive() ? ' · sandbox values shown in the table' : '');
    $('detail-title').textContent = row.name;
    $('detail-sub').textContent = (row.category || 'Other') + ' on ' + ((row.chains && row.chains.length) ? row.chains.join(', ') : 'an unnamed chain');
    var growthLine = 'change_7d ' + fmtPct(row.change_7d) + ' clamped to ' + calc.growth.pct + '%';
    var maturityLine = 'age ' + fmtAge(row.age_days) + (row.age_days === null || row.age_days === undefined ? ' (unknown, uses ' + model().unknown_age_days + 'd)' : '');
    var chainLine = (typeof row.chain_multiplier === 'number') ? 'chain multiplier from the model' : 'no chain bonus in this snapshot\u2019s model';
    var rowsHtml = [
      ['TVL', fmtUsd(row.tvl_usd), ''],
      [base.label, fmtMult(base.value), ''],
      ['Growth multiplier', growthLine, fmtMult(calc.growth.mult)],
      ['Maturity multiplier', maturityLine, fmtMult(calc.maturity.mult)],
      ['Chain multiplier', chainLine, fmtMult(calc.chain)],
      ['Implied value', 'TVL x base x growth x maturity x chain', '']
    ].map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td class="num">' + esc(r[1]) + '</td><td class="num">' + esc(r[2]) + '</td></tr>';
    }).join('');
    rowsHtml += '<tr class="total"><td>Implied value (recomputed)</td><td></td><td class="num">' + fmtUsd(calc.value) + '</td></tr>';
    $('breakdown-body').innerHTML = rowsHtml;
    var note = $('recompute-note');
    if (calc.value === row.implied_value_usd) {
      note.innerHTML = '<span class="ok">Page recomputes ' + esc(fmtUsd(calc.value)) + ' — matches board.json.</span> This is an estimate, not a price.';
    } else {
      note.innerHTML = '<span class="warn">Page recomputes ' + esc(fmtUsd(calc.value)) + ', but the board carries ' + esc(fmtUsd(row.implied_value_usd)) + ' — the data may be stale.</span> This is an estimate, not a price.';
    }
    $('farm-steps').innerHTML = farmStepsOf(row).map(function (s) {
      var tail = [s.cost, s.time].filter(function (x) { return x; }).join(' · ');
      return '<li><b>' + esc(s.text) + '</b>' + (tail ? '<span class="cost">Cost: ' + esc(s.cost) + (s.time ? '. Time: ' + esc(s.time) + '.' : '.') + '</span>' : '') + '</li>';
    }).join('');
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else if (typeof dialog.showModal !== 'function') dialog.setAttribute('open', '');
    renderBoard();
  }
  function closeDetail() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener('close', function () {
    state.selected = null;
    writeHash();
    renderBoard();
  });
  $('detail-close').addEventListener('click', closeDetail);

  function syncSandboxOutputs() {
    var m = model();
    var s = state.sandbox;
    var base = s.baseScale;
    var gw = s.growthWeight === null ? m.growth_weight : s.growthWeight;
    var mr = s.maturityRange === null ? m.maturity_range : s.maturityRange;
    $('sb-base-out').textContent = base.toFixed(2) + 'x';
    $('sb-growth-out').textContent = gw.toFixed(2);
    $('sb-maturity-out').textContent = mr.toFixed(2);
    $('sb-base').value = String(base);
    $('sb-growth').value = String(gw);
    $('sb-maturity').value = String(mr);
  }
  function bindSandbox() {
    [['sb-base', 'baseScale'], ['sb-growth', 'growthWeight'], ['sb-maturity', 'maturityRange']].forEach(function (cfg) {
      $(cfg[0]).addEventListener('input', function (e) {
        state.sandbox[cfg[1]] = parseFloat(e.target.value);
        syncSandboxOutputs();
        $('sandbox-banner').hidden = !sandboxActive();
        if (state.tab === 'pre-token') renderBoard();
      });
    });
    $('sb-reset').addEventListener('click', function () {
      state.sandbox = { baseScale: 1, growthWeight: null, maturityRange: null };
      syncSandboxOutputs();
      $('sandbox-banner').hidden = true;
      if (state.tab === 'pre-token') renderBoard();
    });
    syncSandboxOutputs();
  }

  // ---------- top-level render ----------
  function render() {
    renderMeta();
    renderFacts();
    renderControls();
    renderMethod();
    renderFoot();
    $('hero').hidden = false;
    $('controls').hidden = false;
    $('method').hidden = false;
    $('foot').hidden = false;
    if (state.tab === 'pre-token') {
      $('board-panel').hidden = false;
      $('live-panel').hidden = true;
      renderBoard();
    } else {
      $('board-panel').hidden = true;
      $('live-panel').hidden = false;
      renderLive();
    }
    if (state.selected) openDetail(state.selected);
  }

  function bindControls() {
    $('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); renderBoard(); });
    $('category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); renderBoard(); });
    $('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderBoard(); });
    $('tab-pre').addEventListener('click', function () { state.tab = 'pre-token'; render(); });
    $('tab-live').addEventListener('click', function () { state.tab = 'live'; render(); });
    $('clear-filters').addEventListener('click', function () {
      state.q = ''; state.category = 'all'; state.chain = 'all';
      writeHash(); render();
    });
    document.querySelectorAll('#board-table th button[data-sort]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = (key === 'name') ? 1 : -1; }
        renderBoard();
      });
    });
    window.addEventListener('hashchange', function () {
      state.selected = null;
      readHash();
      render();
    });
  }

  if (!DATA || !Array.isArray(DATA.rows)) {
    $('nodata').hidden = false;
    return;
  }
  readHash();
  bindControls();
  bindSandbox();
  render();
})();
