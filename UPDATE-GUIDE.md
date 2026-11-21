# eFootball League: update guide (VS Code)

Work on a copy of your `index.html` first. In VS Code press **Ctrl+F**, paste the *Find* text (the first line is enough), then edit that spot. Do the steps **in order**, because later steps search for text that earlier steps created. A finished, tested copy of the whole file is also provided as `index.html` if you prefer to just replace yours.

## SQL to run first (Supabase > SQL Editor > New query > Run)

```sql
-- Playoff scores (Part A)
alter table playoffs
  add column if not exists home_goals int,
  add column if not exists away_goals int,
  add column if not exists home_team text,
  add column if not exists away_team text;

-- Transfers (Part C)
create table if not exists transfers (
  id bigint generated always as identity primary key,
  season int not null,
  player text not null,
  from_team text not null,
  to_team text not null,
  fee text,
  created_at timestamptz default now()
);
alter table transfers enable row level security;
create policy "read transfers" on transfers for select using (true);
create policy "admin write transfers" on transfers for all to authenticated using (true) with check (true);
```

## Part A: Playoff scores and team stats (Season 2 onwards)

### Step 1: Seasons: tag Season 1 and 2 with a league, and turn on playoff scores for Season 2

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
playoff: "six" },
    2: { name: "Season 2", teams: TEAMS_S2, schedule: SCHEDULE_S2, playoff: "six" },
```

**Replace with:**

```js
playoff: "six", league: "main" },
    2: { name: "Season 2", teams: TEAMS_S2, schedule: SCHEDULE_S2, playoff: "six", league: "main", playoffScores: true },
```

### Step 2: Mini League: tag it and turn on playoff scores

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
playoff: "six", single: true,
```

**Replace with:**

```js
playoff: "six", single: true, league: "mini", playoffScores: true,
```

### Step 3: Add a variable to hold playoff scores

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
let playoffWinners = {};
```

**Replace with:**

```js
let playoffWinners = {};
  let playoffScores = {};    // stage -> {home, away, hg, ag}
```

### Step 4: Load playoff scores from the database

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
    playoffWinners = {};
    allPlayoffs.forEach(function (p) { if ((p.season || 1) === currentSeason) { playoffWinners[p.stage] = p.winner; } });
```

**Replace with:**

```js
    playoffWinners = {}; playoffScores = {};
    allPlayoffs.forEach(function (p) {
      if ((p.season || 1) !== currentSeason) { return; }
      playoffWinners[p.stage] = p.winner;
      if (p.home_goals !== null && p.home_goals !== undefined && p.away_goals !== null && p.away_goals !== undefined && p.home_team && p.away_team) {
        playoffScores[p.stage] = { home: p.home_team, away: p.away_team, hg: p.home_goals, ag: p.away_goals };
      }
    });
```

### Step 5: Season picker grouped into Main League and Mini League

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
    document.getElementById("seasonSel").innerHTML = nos.map(function (n) {
      return "<option value='" + n + "'" + (n === currentSeason ? " selected" : "") + ">" + esc(SEASONS[n].name) + "</option>";
    }).join("");
```

**Replace with:**

```js
    function opts(list) {
      return list.map(function (n) { return "<option value='" + n + "'" + (n === currentSeason ? " selected" : "") + ">" + esc(SEASONS[n].name) + "</option>"; }).join("");
    }
    document.getElementById("seasonSel").innerHTML =
      "<optgroup label='Main League'>" + opts(nos.filter(function (n) { return SEASONS[n].league !== "mini"; })) + "</optgroup>" +
      "<optgroup label='Mini League'>" + opts(nos.filter(function (n) { return SEASONS[n].league === "mini"; })) + "</optgroup>";
```

### Step 6: Playoff cards with score boxes and league form (adds new functions)

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
function matchCard(stage, title, note, a, b, color) {
```

**Replace with:**

```js
function formDots(code) {
    const row = buildStandings().find(function (r) { return r.code === code; });
    return row ? "<span class='form'>" + row.form.slice(-5).map(function (f) { return "<span class='" + f + "'>" + f + "</span>"; }).join("") + "</span>" : "";
  }

  async function savePlayoff(stage, a, b) {
    if (!isAdmin) return;
    const hv = document.getElementById("ph-" + stage).value, av = document.getElementById("pa-" + stage).value;
    const pick = document.getElementById("pw-" + stage);
    const hasScore = hv !== "" && av !== "";
    let winner = pick ? pick.value : "";
    if (hasScore && Number(hv) !== Number(av)) { winner = Number(hv) > Number(av) ? a : b; }
    if (!hasScore && !winner) {
      const del = await sb.from("playoffs").delete().eq("season", currentSeason).eq("stage", stage);
      delete playoffWinners[stage]; delete playoffScores[stage];
      setStatus(del.error ? "Could not save: " + del.error.message : ""); render(); return;
    }
    if (!winner) { setStatus("Draw: pick who won on penalties, then it saves."); return; }
    const row = { season: currentSeason, stage: stage, winner: winner };
    if (hasScore) { row.home_goals = Number(hv); row.away_goals = Number(av); row.home_team = a; row.away_team = b; }
    else { row.home_goals = null; row.away_goals = null; row.home_team = null; row.away_team = null; }
    const res = await sb.from("playoffs").upsert(row, { onConflict: "season,stage" });
    setStatus(res.error ? "Could not save: " + res.error.message : "");
    if (!res.error) {
      playoffWinners[stage] = winner;
      if (hasScore) { playoffScores[stage] = { home: a, away: b, hg: Number(hv), ag: Number(av) }; } else { delete playoffScores[stage]; }
      toast("Saved ✓");
    }
    render();
  }

  function matchCard(stage, title, note, a, b, color) {
    if (SEASONS[currentSeason].playoffScores) { return matchCardScores(stage, title, note, a, b, color); }
    return matchCardOld(stage, title, note, a, b, color);
  }

  function matchCardScores(stage, title, note, a, b, color) {
    let html = "<div class='pocard' style='border-left-color:" + color + "'>";
    html += "<b style='color:" + color + "'>" + title + "</b><small>" + note + "</small>";
    if (!(a && b)) { return html + "<div class='vs'>" + (a ? teams[a] : "TBD") + " <span style='color:var(--muted)'>vs</span> " + (b ? teams[b] : "TBD") + "</div></div>"; }
    const sc = playoffScores[stage] && playoffScores[stage].home === a && playoffScores[stage].away === b ? playoffScores[stage] : null;
    const w = validWinner(stage, a, b);
    html += "<div class='vs'>" + teams[a] + "<br>" + formDots(a) + "</div>";
    if (isAdmin) {
      html += "<div style='margin:8px 0'><input id='ph-" + stage + "' type='number' min='0' style='width:52px;text-align:center' value='" + (sc ? sc.hg : "") + "' onchange=\"savePlayoff('" + stage + "','" + a + "','" + b + "')\"> : " +
        "<input id='pa-" + stage + "' type='number' min='0' style='width:52px;text-align:center' value='" + (sc ? sc.ag : "") + "' onchange=\"savePlayoff('" + stage + "','" + a + "','" + b + "')\"></div>";
    } else {
      html += "<div class='score' style='margin:8px 0'>" + (sc ? sc.hg + " : " + sc.ag : "vs") + "</div>";
    }
    html += "<div class='vs'>" + teams[b] + "<br>" + formDots(b) + "</div>";
    if (isAdmin) {
      html += "<select id='pw-" + stage + "' onchange=\"savePlayoff('" + stage + "','" + a + "','" + b + "')\"><option value=''>Winner (set automatically; pick if drawn)</option>" +
        "<option value='" + a + "'" + (w === a ? " selected" : "") + ">" + teams[a] + "</option><option value='" + b + "'" + (w === b ? " selected" : "") + ">" + teams[b] + "</option></select>";
    } else {
      const pens = sc && sc.hg === sc.ag && w ? " (on penalties)" : "";
      html += "<div>" + (w ? "Winner: <b>" + teams[w] + "</b>" + pens : "<span style='color:var(--muted)'>Not played yet</span>") + "</div>";
    }
    return html + "</div>";
  }

  function matchCardOld(stage, title, note, a, b, color) {
```

### Step 7: Team page: call the new All competitions card

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
html += "<div class='card'><h3>Points progress</h3>" + pointsChart(done) + "</div>";
```

**Replace with:**

```js
html += allCompetitionsCard(code, row);
    html += "<div class='card'><h3>Points progress</h3>" + pointsChart(done) + "</div>";
```

### Step 8: Team page: add the helper functions

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
  function pageTeam() {
```

**Replace with:**

```js
const STAGE_NAMES = { q1: "Qualifier 1", ko1: "Knockout 1", ko2: "Knockout 2", el: "Eliminator", el1: "Eliminator 1", q2: "Qualifier 2", f: "Final" };

  function teamPlayoffGames(code) {
    return Object.keys(playoffScores).filter(function (st) { return playoffScores[st].home === code || playoffScores[st].away === code; }).map(function (st) {
      const s = playoffScores[st], isH = s.home === code;
      const gf = isH ? s.hg : s.ag, ga = isH ? s.ag : s.hg;
      let res = gf > ga ? "W" : gf < ga ? "L" : "D";
      return { stage: st, opp: isH ? s.away : s.home, gf: gf, ga: ga, res: res, pens: gf === ga && playoffWinners[st] === code ? "won on pens" : (gf === ga ? "lost on pens" : "") };
    });
  }

  function allCompetitionsCard(code, row) {
    const po = teamPlayoffGames(code);
    if (!SEASONS[currentSeason].playoffScores) { return ""; }
    const t = { p: row.played, w: row.won, d: row.drawn, l: row.lost, gf: row.gf, ga: row.ga };
    po.forEach(function (g) { t.p++; t.gf += g.gf; t.ga += g.ga; if (g.res === "W") { t.w++; } else if (g.res === "L") { t.l++; } else { t.d++; } });
    function cell(label, v) { return "<div class='stat'><b>" + v + "</b><small>" + label + "</small></div>"; }
    let html = "<div class='card'><h3>All competitions <span style='color:var(--muted);font-size:13px;font-weight:400'>league + playoffs</span></h3>" +
      "<div class='stats'>" + cell("Played", t.p) + cell("W-D-L", t.w + "-" + t.d + "-" + t.l) + cell("Goals", t.gf + ":" + t.ga) + cell("Goal diff", (t.gf - t.ga > 0 ? "+" : "") + (t.gf - t.ga)) + "</div>";
    html += po.length ? "<h3 style='margin-top:14px'>Playoff games</h3>" + po.map(function (g) {
      return "<div class='tm'><span class='pill " + g.res + "'>" + g.res + "</span><span>" + STAGE_NAMES[g.stage] + " vs " + teams[g.opp] + (g.pens ? " <small style='color:var(--muted)'>(" + g.pens + ")</small>" : "") + "</span><b>" + g.gf + " - " + g.ga + "</b></div>";
    }).join("") : "<p class='legend'>No playoff games played yet. The table above counts league games only.</p>";
    return html + "</div>";
  }

  function pageTeam() {
```

## Part B: Stage 2 (News, qualification tracker, title race)

### Step 9: Add News and Race tabs to the main tab list

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
const tabs = ["Standings", "Fixtures", "Playoffs",
```

**Replace with:**

```js
const tabs = ["Standings", "News", "Race", "Fixtures", "Playoffs",
```

### Step 10: Add them to the Mini League tab list

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
tabs: ["Standings", "Fixtures", "Playoffs", "Squads", "Golden Boot", "Admin"]
```

**Replace with:**

```js
tabs: ["Standings", "News", "Race", "Fixtures", "Playoffs", "Squads", "Golden Boot", "Admin"]
```

### Step 11: Connect the tabs to their pages

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
const pages = { Standings: pageStandings,
```

**Replace with:**

```js
const pages = { News: pageNews, Race: pageRace, Standings: pageStandings,
```

### Step 12: Add the news feed, qualification tracker and title race chart

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
  function render() {
```

**Replace with:**

```js
// =============== STAGE 2: NEWS, QUALIFICATION TRACKER, TITLE RACE ===============
  function isPlayed(r) { return r && r.h !== "" && r.a !== "" && r.h !== null && r.a !== null && r.h !== undefined; }
  function endRun(form, ok) { let n = 0; for (let i = form.length - 1; i >= 0 && ok(form[i]); i--) { n++; } return n; }

  function buildNews() {
    const items = [], table = buildStandings(), fx = buildFixtures();
    let last = -1;
    fx.forEach(function (rd, i) { if (rd.some(function (m) { return isPlayed(results[m.id]); })) { last = i; } });
    if (last < 0 && !Object.keys(playoffScores).length) { return [{ icon: "🕐", title: "Season not started", text: "Match reports appear here automatically after the first result." }]; }
    if (playoffWinners.f) {
      const sc = playoffScores.f;
      items.push({ icon: "🏆", title: teams[playoffWinners.f] + " are champions!", text: sc ? "Final: " + teams[sc.home] + " " + sc.hg + " - " + sc.ag + " " + teams[sc.away] + "." : "They won the playoff Final." });
    }
    Object.keys(playoffScores).filter(function (k) { return k !== "f"; }).forEach(function (k) {
      const sc = playoffScores[k];
      items.push({ icon: "⚔️", title: STAGE_NAMES[k] + ": " + teams[playoffWinners[k] || sc.home] + " go through", text: teams[sc.home] + " " + sc.hg + " - " + sc.ag + " " + teams[sc.away] + "." });
    });
    if (last >= 0) {
      const lead = table[0], gap = lead.points - table[1].points;
      items.push({ icon: "🛡️", title: teams[lead.code] + " lead the table", text: lead.points + " points" + (gap ? ", " + gap + " clear of " + teams[table[1].code] : ", level with " + teams[table[1].code]) + " after round " + (last + 1) + "." });
      const ms = fx[last].filter(function (m) { return isPlayed(results[m.id]); });
      let big = null, goals = null, draws = 0;
      ms.forEach(function (m) {
        const h = Number(results[m.id].h), a = Number(results[m.id].a);
        if (h === a) { draws++; }
        if (!big || Math.abs(h - a) > big.d) { big = { d: Math.abs(h - a), m: m, h: h, a: a }; }
        if (!goals || h + a > goals.t) { goals = { t: h + a, m: m, h: h, a: a }; }
      });
      if (big && big.d > 0) { items.push({ icon: "💥", title: "Round " + (last + 1) + " big win", text: teams[big.m.home] + " " + big.h + " - " + big.a + " " + teams[big.m.away] + " (margin " + big.d + ")." }); }
      if (goals && goals.t >= 5 && goals !== big) { items.push({ icon: "⚽", title: "Goal fest in round " + (last + 1), text: teams[goals.m.home] + " " + goals.h + " - " + goals.a + " " + teams[goals.m.away] + ": " + goals.t + " goals." }); }
      if (draws) { items.push({ icon: "🤝", title: draws + (draws === 1 ? " draw" : " draws") + " in round " + (last + 1), text: "Points shared in " + draws + " of " + ms.length + " matches." }); }
    }
    table.forEach(function (r) {
      const w = endRun(r.form, function (f) { return f === "W"; }), u = endRun(r.form, function (f) { return f !== "L"; }), l = endRun(r.form, function (f) { return f === "L"; });
      if (w >= 3) { items.push({ icon: "🔥", title: teams[r.code] + " on fire", text: w + " wins in a row." }); }
      else if (u >= 5) { items.push({ icon: "🧱", title: teams[r.code] + " unbeaten", text: u + " games without defeat." }); }
      if (l >= 3) { items.push({ icon: "📉", title: teams[r.code] + " in a slump", text: l + " defeats in a row." }); }
    });
    const boot = typeof bootTotals === "function" ? bootTotals() : [];
    if (boot.length) { items.push({ icon: "👟", title: "Golden Boot: " + boot[0].player, text: boot[0].goals + " goals for " + teams[boot[0].team] + "." }); }
    return items;
  }

  function pageNews() {
    return "<div class='po'>" + buildNews().map(function (n) {
      return "<div class='pocard' style='border-left-color:var(--gold)'><b style='font-size:18px'>" + n.icon + " " + esc(n.title) + "</b><div class='legend' style='margin-top:6px'>" + esc(n.text) + "</div></div>";
    }).join("") + "</div><p class='legend'>News is generated automatically from results, playoffs and goals.</p>";
  }

  function qualStatus() {
    const table = buildStandings(), q = qualifiers(), total = SCHEDULE.length;
    const rows = table.map(function (r) { return { r: r, left: total - r.played, max: r.points + 3 * (total - r.played) }; });
    return rows.map(function (x, i) {
      const others = rows.filter(function (y) { return y.r.code !== x.r.code; });
      const canCatch = others.filter(function (y) { return y.max >= x.r.points; }).length;
      const ahead = others.filter(function (y) { return y.r.points > x.max; }).length;
      const shield = others.every(function (y) { return y.max < x.r.points; });
      let st = "hunt", label = "In the hunt";
      if (x.left === 0 && i < q) { st = "in"; label = "Qualified"; }
      else if (canCatch < q) { st = "in"; label = "Qualified"; }
      else if (ahead >= q) { st = "out"; label = "Eliminated"; }
      if (shield) { label = "🛡️ Shield won"; }
      return { code: x.r.code, pos: i + 1, pts: x.r.points, left: x.left, max: x.max, st: st, label: label };
    });
  }

  const LINE_COLORS = ["#2ecc88", "#f5b301", "#ef4444", "#3b82f6", "#a855f7", "#f97316", "#14b8a6", "#ec4899", "#eab308", "#94a3b8"];

  function raceChart() {
    const fx = buildFixtures(), codes = Object.keys(teams), pts = {};
    codes.forEach(function (c) { pts[c] = [0]; });
    let rounds = 0;
    fx.forEach(function (rd, i) {
      const add = {}; let any = false;
      codes.forEach(function (c) { add[c] = 0; });
      rd.forEach(function (m) {
        const r = results[m.id]; if (!isPlayed(r)) { return; }
        any = true; const h = Number(r.h), a = Number(r.a);
        if (h > a) { add[m.home] += 3; } else if (h < a) { add[m.away] += 3; } else { add[m.home]++; add[m.away]++; }
      });
      if (any) { rounds = i + 1; }
      codes.forEach(function (c) { pts[c].push(pts[c][i] + add[c]); });
    });
    if (rounds < 1) { return "<p class='legend'>The chart appears after the first result.</p>"; }
    const W = 640, H = 300, L = 34, B = 24, T = 10, R = 10;
    let max = 3; codes.forEach(function (c) { max = Math.max(max, pts[c][rounds]); });
    const x = function (i) { return L + (W - L - R) * i / Math.max(rounds, 1); }, y = function (v) { return T + (H - T - B) * (1 - v / max); };
    const order = buildStandings().map(function (r) { return r.code; });
    let svg = "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;height:auto'>";
    for (let g = 0; g <= 4; g++) { const v = Math.round(max * g / 4); svg += "<line x1='" + L + "' x2='" + (W - R) + "' y1='" + y(v) + "' y2='" + y(v) + "' stroke='var(--line)'/><text x='4' y='" + (y(v) + 4) + "' fill='var(--muted)' font-size='11'>" + v + "</text>"; }
    for (let i = 0; i <= rounds; i++) { svg += "<text x='" + x(i) + "' y='" + (H - 6) + "' fill='var(--muted)' font-size='10' text-anchor='middle'>" + (i || "") + "</text>"; }
    order.slice().reverse().forEach(function (c) {
      const rank = order.indexOf(c), col = LINE_COLORS[rank % 10], top = rank < 3;
      svg += "<polyline fill='none' stroke='" + col + "' stroke-width='" + (top ? 3 : 1.5) + "' opacity='" + (top ? 1 : .55) + "' points='" + pts[c].slice(0, rounds + 1).map(function (v, i) { return x(i) + "," + y(v); }).join(" ") + "'/>";
    });
    svg += "</svg><div class='legend' style='display:flex;flex-wrap:wrap;gap:4px 14px'>" + order.map(function (c, i) { return "<span><b style='color:" + LINE_COLORS[i % 10] + "'>●</b> " + esc(teams[c]) + "</span>"; }).join("") + "</div>";
    return svg;
  }

  function pageRace() {
    let html = "<div class='card'><h3>Title race <span class='legend'>points after each round</span></h3>" + raceChart() + "</div>";
    html += "<div class='card'><h3>Qualification tracker <span class='legend'>top " + qualifiers() + " reach the playoffs</span></h3><div class='scroll'><table><tr><th>#</th><th class='left'>Team</th><th>Pts</th><th>Left</th><th>Max pts</th><th>Status</th></tr>";
    html += qualStatus().map(function (x) {
      const col = x.st === "in" ? "var(--accent)" : x.st === "out" ? "var(--red)" : "var(--gold)";
      return "<tr><td>" + x.pos + "</td><td class='left'>" + esc(teams[x.code]) + "</td><td class='pts'>" + x.pts + "</td><td>" + x.left + "</td><td>" + x.max + "</td><td style='color:" + col + ";font-weight:700'>" + x.label + "</td></tr>";
    }).join("");
    return html + "</table></div><p class='legend'>Status counts points only. Teams level on points are split by goal difference, so a team marked Qualified or Eliminated is mathematically certain.</p></div>";
  }

  function render() {
```

## Part C: Stage 3 (Awards night and Transfers)

### Step 13: Add a variable for transfers

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
let allResults = [], allPlayoffs = [], allGoals = [], allSquads = [];
```

**Replace with:**

```js
let allResults = [], allPlayoffs = [], allGoals = [], allSquads = [], allTransfers = [];
```

### Step 14: Load the transfers table

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
const g = await sb.from("goals").select("*");
```

**Replace with:**

```js
const g = await sb.from("goals").select("*");
    const tr = await sb.from("transfers").select("*").order("id", { ascending: false });
```

### Step 15: Store the loaded transfers

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
allGoals = g.error ? [] : g.data;
```

**Replace with:**

```js
allGoals = g.error ? [] : g.data;
    allTransfers = tr.error ? [] : tr.data;
```

### Step 16: Add Awards and Transfers tabs to the main tab list

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
const tabs = ["Standings", "News", "Race", "Fixtures", "Playoffs",
```

**Replace with:**

```js
const tabs = ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers",
```

### Step 17: Add them to the Mini League tab list

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
tabs: ["Standings", "News", "Race", "Fixtures", "Playoffs", "Squads"
```

**Replace with:**

```js
tabs: ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers", "Squads"
```

### Step 18: Connect the tabs to their pages

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
const pages = { News: pageNews,
```

**Replace with:**

```js
const pages = { Awards: pageAwards, Transfers: pageTransfers, News: pageNews,
```

### Step 19: Add the awards night and transfers page

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
  function render() {
```

**Replace with:**

```js
// =============== STAGE 3: AWARDS NIGHT + TRANSFERS ===============
  function pageAwards() {
    const table = buildStandings(), fx = buildFixtures().flat();
    const done = table.every(function (r) { return r.played === SCHEDULE.length; });
    const boot = typeof bootTotals === "function" ? bootTotals() : [];
    function best(key, dir) { return table.slice().sort(function (a, b) { return dir * (a[key] - b[key]); })[0]; }
    let big = null;
    fx.forEach(function (m) { const r = results[m.id]; if (!isPlayed(r)) { return; } const d = Math.abs(r.h - r.a); if (!big || d > big.d) { big = { d: d, m: m, r: r }; } });
    const cards = [];
    function aw(icon, title, code, detail) { cards.push("<div class='pocard' style='border-left-color:var(--gold)'><small>" + icon + " " + title + "</small><div style='display:flex;align-items:center;gap:10px'>" +
      (code ? "<span class='badge big'>" + initials(teams[code]) + "</span>" : "") + "<div><b style='font-size:18px'>" + esc(code ? teams[code] : detail[0]) + "</b><div class='legend'>" + esc(code ? detail[0] : detail[1]) + "</div></div></div></div>"); }
    if (playoffWinners.f) { aw("🏆", "Champions", playoffWinners.f, ["Playoff winners"]); }
    if (table[0].played > 0) { aw("🛡️", done ? "League Shield" : "League Shield (leaders now)", table[0].code, [table[0].points + " points"]); }
    if (boot.length) { aw("👟", "Golden Boot", boot[0].team, [boot[0].player + " · " + boot[0].goals + " goals"]); }
    if (table[0].played > 0) {
      const a = best("gf", -1), d = best("ga", 1), w = best("won", -1);
      aw("⚔️", "Best attack", a.code, [a.gf + " goals scored"]); aw("🧤", "Best defence", d.code, [d.ga + " goals conceded"]); aw("💪", "Most wins", w.code, [w.won + " wins"]);
    }
    if (big && big.d > 0) { aw("💥", "Biggest win", big.r.h > big.r.a ? big.m.home : big.m.away, [teams[big.m.home] + " " + big.r.h + " - " + big.r.a + " " + teams[big.m.away]]); }
    if (!cards.length) { return "<div class='card'><p class='legend'>Awards appear as the season is played.</p></div>"; }
    return "<p class='legend'>" + (done ? "Final awards for the season." : "Provisional awards: they update with every result.") + "</p><div class='po'>" + cards.join("") + "</div>";
  }

  async function saveTransfer() {
    if (!isAdmin) { return; }
    const row = { season: currentSeason, player: document.getElementById("trP").value.trim(), from_team: document.getElementById("trF").value,
                  to_team: document.getElementById("trT").value, fee: document.getElementById("trFee").value.trim() };
    if (!row.player || row.from_team === row.to_team) { setStatus("Enter a player and choose two different clubs."); return; }
    const res = await sb.from("transfers").insert(row).select();
    if (res.error) { setStatus("Could not save: " + res.error.message); return; }
    setStatus(""); allTransfers = res.data.concat(allTransfers); toast("Transfer added ✓"); render();
  }

  async function deleteTransfer(id) {
    if (!isAdmin || !confirm("Delete this transfer?")) { return; }
    const res = await sb.from("transfers").delete().eq("id", id);
    if (res.error) { setStatus("Could not delete: " + res.error.message); return; }
    allTransfers = allTransfers.filter(function (t) { return t.id !== id; }); render();
  }

  function pageTransfers() {
    const list = allTransfers.filter(function (t) { return t.season === currentSeason; });
    const opts = Object.keys(teams).map(function (c) { return "<option value='" + c + "'>" + esc(teams[c]) + "</option>"; }).join("");
    let html = "";
    if (isAdmin) {
      html += "<div class='card'><h3>Add a transfer</h3><input id='trP' placeholder='Player name'> <select id='trF'>" + opts + "</select> <select id='trT'>" + opts + "</select> <input id='trFee' placeholder='Fee or note (optional)'> <button class='btn' onclick='saveTransfer()'>Add</button></div>";
    }
    html += "<div class='card'><h3>Transfers <span class='legend'>" + esc(SEASONS[currentSeason].name) + "</span></h3>";
    html += list.length ? list.map(function (t) {
      return "<div class='tm'><span><b>" + esc(t.player) + "</b> " + (teams[t.from_team] ? esc(teams[t.from_team]) : "?") + " → <b>" + (teams[t.to_team] ? esc(teams[t.to_team]) : "?") + "</b>" +
        (t.fee ? " <small style='color:var(--muted)'>(" + esc(t.fee) + ")</small>" : "") + "</span>" + (isAdmin ? "<button class='btn out' onclick='deleteTransfer(" + t.id + ")'>✕</button>" : "") + "</div>";
    }).join("") : "<p class='legend'>No transfers recorded for this season.</p>";
    return html + "</div>";
  }

  function render() {
```

## Part D: Redesign (Season 2 onwards, dark mode)

### Step 20: Add the new look (CSS) just before the closing head tag

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
</head>
```

**Replace with:**

```js
<style id="redesign">
/* NEW LOOK: applies to every season except Season 1, and only in dark mode */
html:not([data-season="1"]):not([data-theme="light"]) {
  --bg:#070a1c; --card:#0d1330; --line:#2a3566; --accent:#f2b705; --gold:#f2b705; --red:#e11d2e;
  & body { background:radial-gradient(1100px 560px at 85% -8%, rgba(60,90,220,.28), transparent), var(--bg); }
  & header { clip-path:polygon(0 0,100% 0,100% 90%,0 100%); padding-bottom:48px;
    background:linear-gradient(112deg,#070a1c 0 58%,var(--red) 58% 59.5%,#0d1330 59.5%); }
  & header h1 { font-size:clamp(30px,6vw,58px); font-style:italic; line-height:1; }
  & header .seasonName { color:var(--gold); }
  & nav { background:rgba(7,10,28,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
  & nav button { transform:skewX(-12deg); margin:6px 3px; border-bottom:0; }
  & nav button.on { background:var(--gold); color:#070a1c; }
  & .card, & .pocard { position:relative; background:linear-gradient(160deg,rgba(18,28,72,.85),rgba(9,14,42,.9)); border:1px solid var(--line); border-radius:4px;
    clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%); }
  & .card::before { content:""; position:absolute; left:0; top:0; width:64px; height:3px; background:var(--gold); }
  & tr.top4 { background:rgba(242,183,5,.08); } & tr.top4 td:first-child { box-shadow:inset 4px 0 0 var(--gold); }
  & .rounds button.on, & .btn { background:var(--gold); color:#070a1c; }
  & .btn:hover { box-shadow:0 6px 16px rgba(242,183,5,.35); }
  & #app { perspective:1200px; }
  & #app.enter > * { animation:flipIn .65s cubic-bezier(.2,.8,.2,1) both; transform-origin:50% 0; }
}
@keyframes flipIn { from { opacity:0; transform:rotateX(-16deg) translateY(30px); } to { opacity:1; transform:none; } }
.hero { display:flex; align-items:center; gap:18px; padding:22px; margin-bottom:16px; border:1px solid var(--gold);
  background:linear-gradient(100deg,rgba(242,183,5,.18),transparent 60%); clip-path:polygon(0 0,100% 0,100% 78%,calc(100% - 30px) 100%,0 100%); }
.hero .badge { width:84px; height:84px; font-size:24px; flex:none; } .hero small { color:var(--gold); letter-spacing:3px; }
.hero h2 { font-size:clamp(26px,5vw,46px); font-style:italic; text-transform:uppercase; margin:0; line-height:1.05; }
.strip { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); margin-bottom:16px; }
.strip div { background:var(--card); padding:14px; text-align:center; }
.strip b { display:block; font:700 28px "Oswald",sans-serif; color:var(--gold); }
.strip small { color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-size:11px; }
#wipe { position:fixed; inset:0; z-index:9999; pointer-events:none; overflow:hidden; }
#wipe i { position:absolute; top:-5%; bottom:-5%; width:48%; transform:translateX(-130%) skewX(-14deg); }
#wipe i:nth-child(1) { background:var(--red); } #wipe i:nth-child(2) { background:var(--gold); } #wipe i:nth-child(3) { background:#0d1330; }
#wipe.go i { animation:wipe .75s cubic-bezier(.7,0,.3,1) both; }
#wipe.go i:nth-child(2) { animation-delay:.07s; } #wipe.go i:nth-child(3) { animation-delay:.14s; }
@keyframes wipe { from { transform:translateX(-130%) skewX(-14deg); } 50% { transform:translateX(105%) skewX(-14deg); } to { transform:translateX(260%) skewX(-14deg); } }
@media (prefers-reduced-motion:reduce) { #wipe { display:none; } }
</style>
</head>
```

### Step 21: Add the hero banner and stat strip to Standings

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
app.innerHTML = loaded ? pages[currentTab]() : skeleton();
```

**Replace with:**

```js
app.innerHTML = loaded ? (currentTab === "Standings" && currentSeason !== 1 ? heroStrip() : "") + pages[currentTab]() : skeleton();
```

### Step 22: Play the sliding overlay when a tab changes

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
lastKey = key;
```

**Replace with:**

```js
lastKey = key;
      playWipe();
```

### Step 23: Add the hero, overlay and 3D tilt helpers

**Find** this (searching just the first line is enough), then replace the whole matching piece with the code below it.

```js
  function render() {
```

**Replace with:**

```js
// =============== REDESIGN HELPERS (Season 2 onwards) ===============
  function heroStrip() {
    const table = buildStandings(), lead = table[0], played = getPlayedMatches();
    if (!played.length) { return ""; }
    const goals = played.reduce(function (n, m) { return n + m.homeGoals + m.awayGoals; }, 0);
    function cell(v, l) { return "<div><b>" + v + "</b><small>" + l + "</small></div>"; }
    return "<div class='hero'><span class='badge big'>" + initials(teams[lead.code]) + "</span><div><small>LEAGUE LEADERS</small><h2>" + esc(teams[lead.code]) + "</h2>" +
      "<div class='legend'>" + lead.points + " pts · " + lead.won + "W " + lead.drawn + "D " + lead.lost + "L · GD " + (lead.gf - lead.ga) + "</div></div></div>" +
      "<div class='strip'>" + cell(played.length, "Matches played") + cell(goals, "Goals") + cell((goals / played.length).toFixed(1), "Goals / match") + cell(lead.points, "Leader points") + cell(SCHEDULE.length, "Rounds") + "</div>";
  }

  function playWipe() {
    if (currentSeason === 1 || document.documentElement.getAttribute("data-theme") === "light") { return; }
    let w = document.getElementById("wipe");
    if (!w) { w = document.createElement("div"); w.id = "wipe"; w.innerHTML = "<i></i><i></i><i></i>"; document.body.appendChild(w); }
    w.classList.remove("go"); void w.offsetWidth; w.classList.add("go");
  }

  // 3D tilt on cards (mouse only)
  document.addEventListener("pointermove", function (e) {
    if (currentSeason === 1 || e.pointerType !== "mouse") { return; }
    const c = e.target.closest ? e.target.closest(".pocard,.hero") : null;
    document.querySelectorAll(".tilting").forEach(function (x) { if (x !== c) { x.classList.remove("tilting"); x.style.transform = ""; } });
    if (!c) { return; }
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    c.classList.add("tilting"); c.style.transform = "perspective(900px) rotateY(" + (px * 7) + "deg) rotateX(" + (-py * 7) + "deg)";
  });

  function render() {
```

## After the steps

1. Save, open the site in a browser and press Ctrl+F5.
2. Season 1 keeps its old look. Season 2 and the Mini League get the new look; the light theme keeps the old look.
3. Log in as admin and test: a playoff score, a transfer, then check News, Race, Awards.
4. Upload `index.html` to GitHub as usual.

If something is blank, press F12 and check the Console tab for a red error. The most common cause is a missed step or a step done out of order.

## Part E: Mobile optimisation (do after Part D)

Steps 24-27. Phones get a bottom tab bar, a compact standings table (tap **Full stats** to see all columns), bigger touch targets, no zoom-on-tap in inputs, and lighter animations.

### Step 24: Allow safe-area spacing on notched phones (viewport tag)

**Find** (first line is enough), replace the matching piece with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**Replace with:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### Step 25: Standings: compact mobile table with a Full stats button

**Find** (first line is enough), replace the matching piece with:

```html
<div class='card scroll'><table><tr><th>#</th><th class='left'>Team</th><th>P</th>
```

**Replace with:**

```html
<button class='btn out mfull' onclick='toggleFull(this)'>⇄ Full stats</button><div class='card scroll'><table class='st'><tr><th>#</th><th class='left'>Team</th><th>P</th>
```

### Step 26: Add the button's helper function

**Find** (first line is enough), replace the matching piece with:

```html
  function render() {
```

**Replace with:**

```html
function toggleFull(b) { b.nextElementSibling.querySelector("table").classList.toggle("full"); }

  function render() {
```

### Step 27: Add the mobile layout (CSS) just before the closing head tag

**Find** (first line is enough), replace the matching piece with:

```html
</head>
```

**Replace with:**

```html
<style id="mobile">
/* MOBILE: phones and small tablets */
.mfull { display:none; }
@media (max-width:700px) {
  :root:root:root:root {
    & html, & body { -webkit-text-size-adjust:100%; -webkit-tap-highlight-color:transparent; }
    & header { padding:16px 14px 34px; }
    & header h1 { font-size:26px; }
    & header p { font-size:12px; }
    & .themebtn { top:10px; right:10px; padding:6px 10px; font-size:12px; }
    & .ticker { font-size:13px; }
    & nav { position:fixed; top:auto; bottom:0; left:0; right:0; z-index:60; padding:0 4px env(safe-area-inset-bottom,0px);
      border-top:1px solid var(--line); border-bottom:0; box-shadow:0 -8px 24px rgba(0,0,0,.45); scroll-snap-type:x proximity; background:rgba(7,10,28,.96); }
    & nav button { flex:none; margin:0; transform:none; min-height:50px; padding:12px 14px; font-size:14px; scroll-snap-align:center; }
    & nav button.on { background:none; color:var(--gold); border-bottom:3px solid var(--gold); }
    & main { padding:14px 10px calc(84px + env(safe-area-inset-bottom,0px)); }
    & .toast { bottom:calc(80px + env(safe-area-inset-bottom,0px)); }
    & .card { padding:12px; margin-bottom:12px; }
    & input, & select, & textarea { font-size:16px; }
    & .btn { min-height:44px; }
    & .rounds { flex-wrap:nowrap; overflow-x:auto; padding-bottom:6px; -webkit-overflow-scrolling:touch; }
    & .rounds button { flex:none; min-width:44px; min-height:40px; }
    & .match { gap:6px; font-size:14px; }
    & .match input { width:54px; height:44px; }
    & .score { min-width:56px; }
    & .po, & .two, & .sq { grid-template-columns:1fr; }
    & .stats { grid-template-columns:repeat(3,1fr); }
    & .plist { columns:1; }
    & .hero { padding:16px; gap:12px; } & .hero .badge { width:60px; height:60px; font-size:18px; }
    & .strip b { font-size:22px; } & .strip div { padding:10px 4px; }
    & #app.enter tr { animation:none; }
    & #wipe.go i { animation-duration:.5s; }
    & table.st { min-width:0; }
    & table.st th, & table.st td { padding:9px 4px; font-size:14px; }
    & table.st th:nth-child(n+4):nth-child(-n+8), & table.st td:nth-child(n+4):nth-child(-n+8) { display:none; }
    & table.st td.left { white-space:normal; }
    & table.st.full { min-width:520px; }
    & table.st.full th:nth-child(n+4):nth-child(-n+8), & table.st.full td:nth-child(n+4):nth-child(-n+8) { display:table-cell; }
    & .mfull { display:block; margin:0 0 8px auto; min-height:36px; padding:6px 12px; font-size:13px; }
    & .modalbox { max-height:86vh; overflow:auto; }
  }
}
@media (hover:none) { nav button:hover, .rounds button:hover, .btn:hover { transform:none; } }
</style>
</head>
```

## Part F: Smoother transitions and no countdown (do after Part E)

**Step 28: remove the countdown screen.** Delete this block near the top of the body (just after the `<body>` tag):

```html
<div id="intro">
  <div class="i-top">eFootball League · <span class="seasonName">Season 2</span></div>
  <div class="count" id="count"></div>
  <div class="i-skip">Tap to skip</div>
</div>
```

**Step 29: remove the countdown script, keep the app install code.** Near the very bottom, find the line `// =============== OPENING COUNTDOWN ===============`. Select everything from that line down to and including the `})();` line just above `</script>`, and replace it with:

```js
// lets the site be installed as an app
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
```

### Step 30: Tab buttons: give each a data-tab

**Find** (first line is enough), replace the matching piece with:

```js
return "<button class='" + (t === currentTab ? "on" : "") + "' onclick=
```

**Replace with:**

```js
return "<button data-tab='" + t + "' class='" + (t === currentTab ? "on" : "") + "' onclick=
```

### Step 31: Tab bar: build the text first

**Find** (first line is enough), replace the matching piece with:

```js
document.getElementById("nav").innerHTML = seasonTabs().map(function (t) {
```

**Replace with:**

```js
const navHtml = seasonTabs().map(function (t) {
```

### Step 32: Tab bar: highlight in place after building

**Find** (first line is enough), replace the matching piece with:

```js
}).join("") + installButton();
```

**Replace with:**

```js
}).join("") + installButton();
    setNav(navHtml);
```

### Step 33: Remove the sliding overlay call

**Find** (first line is enough), replace the matching piece with:

```js
lastKey = key;
      playWipe();
```

**Replace with:**

```js
lastKey = key;
```

### Step 34: Smooth light/dark switch

**Find** (first line is enough), replace the matching piece with:

```js
function toggleTheme() {
```

**Replace with:**

```js
function toggleTheme() {
    document.documentElement.classList.add("theming");
    setTimeout(function () { document.documentElement.classList.remove("theming"); }, 450);
```

### Step 35: Smooth page transition code (replaces the start of render)

**Find** (first line is enough), replace the matching piece with:

```js
  function render() {
```

**Replace with:**

```js
// ---- smooth transitions ----
  if (document.startViewTransition) { document.documentElement.classList.add("vt"); }
  let lastSeasonShown = null;

  // keeps the tab buttons in place and only moves the highlight, so the change can animate
  function setNav(html) {
    const nav = document.getElementById("nav");
    const sig = html.replace(/class='on'/g, "class=''");
    if (nav.getAttribute("data-sig") !== sig) { nav.innerHTML = html; nav.setAttribute("data-sig", sig); }
    nav.querySelectorAll("button[data-tab]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === currentTab); });
    const on = nav.querySelector("button.on");
    if (on && nav.scrollTo) { nav.scrollTo({ left: on.offsetLeft - nav.clientWidth / 2 + on.offsetWidth / 2, behavior: "smooth" }); }
  }

  function render() {
    const key = currentTab + (currentTab === "Fixtures" ? currentRound : "");
    const changed = loaded && lastKey !== "" && (key !== lastKey || currentSeason !== lastSeasonShown);
    lastSeasonShown = currentSeason;
    const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (changed && document.startViewTransition && !calm) { document.startViewTransition(function () { renderNow(); }); }
    else { renderNow(); }
  }

  function renderNow() {
```

### Step 36: Smooth transition styles (CSS) before the closing head tag

**Find** (first line is enough), replace the matching piece with:

```js
</head>
```

**Replace with:**

```js
<style id="smooth">
/* SMOOTH TRANSITIONS */
#app { view-transition-name:page; }
::view-transition-old(root), ::view-transition-new(root) { animation:none; }
::view-transition-old(page) { animation:pgOut .16s ease both; }
::view-transition-new(page) { animation:pgIn .36s cubic-bezier(.22,.9,.3,1) both; }
@keyframes pgOut { to { opacity:0; transform:translateY(-6px); } }
@keyframes pgIn { from { opacity:0; transform:translateY(14px); } }
html.vt #app.enter > *, html.vt #app.enter tr { animation:none !important; }
:root:root:root:root #app.enter > * { animation:fadeUp .4s ease both; }
nav button, .rounds button, .btn, .themebtn, select { transition:color .3s ease, background-color .3s ease, border-color .3s ease, transform .2s ease, box-shadow .3s ease; }
html.theming, html.theming *, html.theming *::before, html.theming *::after { transition:background-color .4s ease, color .4s ease, border-color .4s ease, fill .4s ease, stroke .4s ease !important; }
@media (prefers-reduced-motion:reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation:none !important; } #app.enter > * { animation:none !important; } }
</style>
</head>
```

## Part G: Poster style with player photos (do after Part F)

**Photos:** make a folder named `players` next to `index.html`. Add one PNG per player named after the player as typed in the squad, lower case with hyphens: `John Smith` becomes `players/john-smith.png`. A transparent cut-out PNG looks best. Missing photos show a silhouette (cards) or the club logo (hero). The hero picture is the club's top scorer, or the first player in the squad if nobody has scored.

### Step 37: Standings: use the new leader hero

**Find** (first line is enough), replace the matching piece with:

```js
(currentTab === "Standings" && currentSeason !== 1 ? heroStrip() : "")
```

**Replace with:**

```js
(currentTab === "Standings" && currentSeason !== 1 ? heroLeader() : "")
```

### Step 38: Team page: player cards instead of a text list

**Find** (first line is enough), replace the matching piece with:

```js
"<ol class='plist'>" + list.map(function (p) { return "<li>" + esc(p) + goalTag(code, p) + "</li>"; }).join("") + "</ol>"
```

**Replace with:**

```js
playerCards(code, list)
```

### Step 39: Team page: add the hero at the top

**Find** (first line is enough), replace the matching piece with:

```js
let html = "<button class='btn out back' onclick=\"currentTab='Standings';render()\">← Back to standings</button>";
```

**Replace with:**

```js
let html = "<button class='btn out back' onclick=\"currentTab='Standings';render()\">← Back to standings</button>";
    if (currentSeason !== 1) { html += heroTeam(code); }
```

### Step 40: Add the player photo helpers, hero and cards (JS)

**Find** (first line is enough), replace the matching piece with:

```js
  function render() {
```

**Replace with:**

```js
// =============== PLAYER PHOTO HERO + CARDS ===============
  // Photos live in a folder called "players" next to index.html, named by the player's name:
  // "John Smith" -> players/john-smith.png (a transparent PNG cut-out looks best)
  function playerBase(p) { return String(p).split("(")[0].split(" - ")[0].trim(); }
  function slug(n) { return playerBase(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function playerImg(name, cls) {
    return "<img class='" + cls + "' src='players/" + slug(name) + ".png' alt='' loading='lazy' onerror=\"this.style.display='none'\">";
  }
  function starPlayer(code) {
    const top = (typeof bootTotals === "function" ? bootTotals() : []).filter(function (g) { return g.team === code; })[0];
    if (top) { return top.player; }
    const sq = squads[code]; const list = sq ? playerList(sq.players) : [];
    return list.length ? list[0] : "";
  }
  function heroBase(code, label, extra) {
    const c = (typeof CLUBS !== "undefined" && CLUBS[teams[code]]) || { bg: "#d3122b", fg: "#fff" };
    const star = starPlayer(code);
    return "<div class='h2' style='--club:" + c.bg + "'><div class='h2-dots'></div><div class='h2-circle'></div><div class='h2-name'>" + esc(teams[code]) + "</div>" +
      "<span class='badge big h2-logo'>" + initials(teams[code]) + "</span>" + (star ? playerImg(star, "h2-player") : "") +
      "<div class='h2-info'><small>" + label + "</small><h2>" + esc(teams[code]) + "</h2>" + extra + "</div></div>";
  }
  function heroLeader() {
    const table = buildStandings(), lead = table[0], played = getPlayedMatches();
    if (!played.length) { return ""; }
    const goals = played.reduce(function (n, m) { return n + m.homeGoals + m.awayGoals; }, 0);
    function cell(v, l) { return "<div><b>" + v + "</b><small>" + l + "</small></div>"; }
    return heroBase(lead.code, "LEAGUE LEADERS", "<div class='legend'>" + lead.points + " pts · " + lead.won + "W " + lead.drawn + "D " + lead.lost + "L · GD " + (lead.gf - lead.ga) + "</div>" +
      "<button class='btn' onclick=\"openTeam('" + lead.code + "')\">Team profile</button>") +
      "<div class='strip'>" + cell(played.length, "Matches") + cell(goals, "Goals") + cell((goals / played.length).toFixed(1), "Goals / match") + cell(lead.points, "Leader pts") + "</div>";
  }
  function heroTeam(code) {
    const row = buildStandings().find(function (r) { return r.code === code; });
    const sq = squads[code] || { owner: "" };
    const form = row.form.slice(-5).map(function (f) { return "<span class='" + f + "'>" + f + "</span>"; }).join("");
    return heroBase(code, "OWNER · " + (sq.owner ? esc(sq.owner) : "TBA"), "<div class='form'>" + form + "</div>");
  }
  function playerCards(code, list) {
    return "<div class='plcs'>" + list.map(function (p, i) {
      return "<div class='plc'><span class='plc-no'>" + (i + 1) + "</span>" + playerImg(p, "plc-img") + "<div class='plc-name'>" + esc(playerBase(p)) + goalTag(code, p) + "</div></div>";
    }).join("") + "</div>";
  }

  function render() {
```

### Step 41: Add the poster style (CSS) before the closing head tag

**Find** (first line is enough), replace the matching piece with:

```js
</head>
```

**Replace with:**

```js
<style id="posters">
/* POSTER STYLE: ink-black, halftone dots, club-colour circles, giant type */
.h2 { position:relative; overflow:hidden; isolation:isolate; min-height:340px; margin-bottom:16px; background:#0c0d16; border:1px solid var(--line); }
.h2-dots { position:absolute; inset:0; z-index:-1; background-image:radial-gradient(rgba(255,255,255,.1) 1.2px,transparent 1.7px); background-size:12px 12px; }
.h2-circle { position:absolute; right:-8%; top:50%; width:min(80vw,430px); aspect-ratio:1; transform:translateY(-50%); border-radius:50%; background:var(--club); z-index:-1; }
.h2-name { position:absolute; left:14px; top:6px; right:0; font:700 clamp(54px,17vw,150px)/.9 "Oswald",sans-serif; text-transform:uppercase; color:transparent; -webkit-text-stroke:1.5px rgba(255,255,255,.3); pointer-events:none; word-break:break-word; }
.h2 .h2-logo.badge { position:absolute; right:15%; top:50%; margin:0; width:min(32vw,150px); height:min(32vw,150px); transform:translateY(-50%); }
.h2-player { position:absolute; right:0; bottom:0; height:108%; max-width:72%; object-fit:contain; object-position:bottom right; filter:drop-shadow(0 10px 24px rgba(0,0,0,.55)); z-index:1; }
.h2-info { position:absolute; left:0; bottom:0; z-index:2; max-width:62%; padding:16px; background:linear-gradient(90deg,rgba(12,13,22,.92),transparent); }
.h2-info small { color:var(--gold); letter-spacing:3px; font-size:11px; }
.h2-info h2 { margin:2px 0 6px; font-size:clamp(24px,5vw,40px); font-style:italic; text-transform:uppercase; line-height:1.05; }
.plcs { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; }
.plc { position:relative; aspect-ratio:3/4; overflow:hidden; background:linear-gradient(180deg,#1a1d33,#0b0c16); border:1px solid var(--line); }
.plc::before { content:""; position:absolute; inset:0; opacity:.16; background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='32' r='16' fill='white'/%3E%3Cpath d='M14 100c0-26 16-40 36-40s36 14 36 40z' fill='white'/%3E%3C/svg%3E") center 35%/72% no-repeat; }
.plc-no { position:absolute; left:8px; top:0; z-index:2; font:700 36px "Oswald",sans-serif; color:rgba(255,255,255,.38); }
.plc-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; }
.plc-name { position:absolute; left:0; right:0; bottom:0; z-index:2; padding:24px 8px 8px; background:linear-gradient(transparent,rgba(0,0,0,.88)); font:600 14px "Oswald",sans-serif; text-transform:uppercase; }
html:not([data-season="1"]):not([data-theme="light"]):root:root {
  & body { background:#08090f; }
  & body::before { content:""; position:fixed; inset:0; pointer-events:none; z-index:0; background-image:radial-gradient(rgba(255,255,255,.055) 1px,transparent 1.5px); background-size:14px 14px; }
  & main { position:relative; z-index:1; }
  & .thead { display:none; }
  & .stat b, & .strip b { font-family:"Oswald",sans-serif; font-size:34px; color:var(--gold); }
}
@media (max-width:700px) { .h2 { min-height:320px; } .h2-info { max-width:100%; padding:14px; } .plcs { grid-template-columns:repeat(2,1fr); } }
</style>
</head>
```

## Part H: Comic Awards, colour-block Playoffs and online player photos (do after Part G)

**Online photos:** if `players/john-smith.png` does not exist, the site looks the player up on Wikipedia and shows that photo (only when the page describes a footballer). Results are remembered in the browser so each name is looked up once. Online photos are rectangles, so their edges fade out. Use full real names in squads (for example "First Last") for the best matches; nicknames will not match.

### Step 42: Online photo lookup (Wikipedia) added before playerBase

**Find** (first line is enough), replace the matching piece with:

```js
  function playerBase(p) {
```

**Replace with:**

```js
const photoCache = {};
  function wikiPhoto(name) {
    const k = slug(name);
    if (photoCache[k] !== undefined) { return Promise.resolve(photoCache[k]); }
    try { const c = localStorage.getItem("pp:" + k); if (c !== null) { photoCache[k] = c === "-" ? null : c; return Promise.resolve(photoCache[k]); } } catch (e) {}
    return fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(playerBase(name).replace(/ /g, "_")))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        const ok = d && d.type === "standard" && /footbal|soccer|goalkeeper|midfielder|defender|forward|striker|winger/i.test(d.description || "");
        const url = ok && d.thumbnail ? d.thumbnail.source : null;
        photoCache[k] = url; try { localStorage.setItem("pp:" + k, url || "-"); } catch (e) {}
        return url;
      }).catch(function () { return null; });
  }
  // players/ folder first; if that file is missing, look the player up online
  function photoFallback(img) {
    if (img.getAttribute("data-tried")) { img.style.display = "none"; return; }
    img.setAttribute("data-tried", "1");
    wikiPhoto(img.getAttribute("data-name")).then(function (url) {
      if (url) { img.classList.add("online"); img.src = url; } else { img.style.display = "none"; }
    });
  }

  function playerBase(p) {
```

### Step 43: Photos: try the online lookup when a file is missing

**Find** (first line is enough), replace the matching piece with:

```js
.png' alt='' loading='lazy' onerror=\"this.style.display='none'\">";
```

**Replace with:**

```js
.png' alt='' loading='lazy' data-name='" + esc(playerBase(name)) + "' onerror=\"photoFallback(this)\">";
```

### Step 44: Awards: comic-panel photo on each award

**Find** (first line is enough), replace the matching piece with:

```js
(code ? "<span class='badge big'>" + initials(teams[code]) + "</span>" : "")
```

**Replace with:**

```js
(code ? playerImg(starPlayer(code), "cm-img") + "<span class='badge big'>" + initials(teams[code]) + "</span>" : "")
```

### Step 45: Awards: comic panel layout class

**Find** (first line is enough), replace the matching piece with:

```js
"</p><div class='po'>" + cards.join("")
```

**Replace with:**

```js
"</p><div class='po comic'>" + cards.join("")
```

### Step 46: Playoffs: pass the card colour (do this in BOTH places it appears: two playoff card functions)

**Find** (first line is enough), replace the matching piece with:

```js
style='border-left-color:" + color + "'>"
```

**Replace with:**

```js
style='border-left-color:" + color + ";--pc:" + color + "'>"
```

### Step 47: Add comic panel and colour block styles (CSS)

**Find** (first line is enough), replace the matching piece with:

```js
</head>
```

**Replace with:**

```js
<style id="posters2">
/* online photos are rectangular, so fade their edges */
.h2-player.online { height:100%; width:auto; max-width:62%; object-fit:cover; -webkit-mask-image:linear-gradient(to right,transparent,#000 28%); mask-image:linear-gradient(to right,transparent,#000 28%); }
.cm-img { position:absolute; right:0; bottom:0; height:100%; width:55%; object-fit:cover; object-position:top; opacity:.9; -webkit-mask-image:linear-gradient(to right,transparent,#000 40%); mask-image:linear-gradient(to right,transparent,#000 40%); }
html:not([data-season="1"]):not([data-theme="light"]):root:root {
  /* comic panels (Awards) */
  & .po.comic { gap:6px; padding:6px; background:#000; }
  & .po.comic .pocard { position:relative; overflow:hidden; min-height:150px; border:0; border-radius:0; color:#fff; clip-path:polygon(0 0,100% 0,95% 100%,0 100%); background:var(--pc,#e11d2e); }
  & .po.comic .pocard::after { content:""; position:absolute; inset:0; pointer-events:none; background-image:radial-gradient(rgba(0,0,0,.28) 1.6px,transparent 2.2px); background-size:9px 9px; }
  & .po.comic .pocard > * { position:relative; z-index:1; }
  & .po.comic .pocard small { color:#fff; font:700 22px "Oswald",sans-serif; text-transform:uppercase; text-shadow:2px 2px 0 rgba(0,0,0,.45); }
  & .po.comic .legend { color:rgba(255,255,255,.92); }
  & .po.comic .pocard:nth-child(6n+1) { --pc:#16a34a; } & .po.comic .pocard:nth-child(6n+2) { --pc:#f59e0b; } & .po.comic .pocard:nth-child(6n+3) { --pc:#2563eb; }
  & .po.comic .pocard:nth-child(6n+4) { --pc:#dc2626; } & .po.comic .pocard:nth-child(6n+5) { --pc:#0891b2; } & .po.comic .pocard:nth-child(6n) { --pc:#db2777; }
  /* colour blocks (Playoffs) */
  & .pocard[style*="--pc"] { background:var(--pc); border:0; border-radius:36px 8px 36px 8px; clip-path:none; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.35); }
  & .pocard[style*="--pc"] b { color:#fff !important; font-size:20px; }
  & .pocard[style*="--pc"] small, & .pocard[style*="--pc"] .vs { color:rgba(255,255,255,.95); }
}
</style>
</head>
```

## Part I: eFootball-style player cards (do after Part H)

**Run this SQL first (Supabase > SQL Editor):**

```sql
create table if not exists player_cards (
  id bigint generated always as identity primary key,
  season int not null,
  team text not null,
  player text not null,
  image_url text,
  overall int,
  position text,
  max_level int,
  card_type text default 'Standard',
  foot text,
  form text,
  pas int, spd int, sho int, dri int,
  unique (season, team, player)
);
alter table player_cards enable row level security;
create policy "read cards" on player_cards for select using (true);
create policy "admin write cards" on player_cards for all to authenticated using (true) with check (true);
```

**Using it:** log in as admin, open the **Cards** tab, pick a team, paste an image link (or `players/name.png`), fill the details and press Save card. Cards then show in that team's squad and in the leader banner.

### Step 48: Variable for cards

**Find** (first line is enough), replace the matching piece with:

```js
allTransfers = [];
```

**Replace with:**

```js
allTransfers = [], allCards = [];
```

### Step 49: Load the player_cards table

**Find** (first line is enough), replace the matching piece with:

```js
const tr = await sb.from("transfers").select("*").order("id", { ascending: false });
```

**Replace with:**

```js
const tr = await sb.from("transfers").select("*").order("id", { ascending: false });
    const pc = await sb.from("player_cards").select("*");
```

### Step 50: Store the loaded cards

**Find** (first line is enough), replace the matching piece with:

```js
allTransfers = tr.error ? [] : tr.data;
```

**Replace with:**

```js
allTransfers = tr.error ? [] : tr.data;
    allCards = pc.error ? [] : pc.data;
```

### Step 51: Add the Cards tab to the main tab list

**Find** (first line is enough), replace the matching piece with:

```js
const tabs = ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers",
```

**Replace with:**

```js
const tabs = ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers", "Cards",
```

### Step 52: Add the Cards tab to the Mini League tab list

**Find** (first line is enough), replace the matching piece with:

```js
tabs: ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers", "Squads"
```

**Replace with:**

```js
tabs: ["Standings", "News", "Race", "Fixtures", "Playoffs", "Awards", "Transfers", "Cards", "Squads"
```

### Step 53: Connect the tab to its page

**Find** (first line is enough), replace the matching piece with:

```js
const pages = { Awards: pageAwards,
```

**Replace with:**

```js
const pages = { Cards: pageCards, Awards: pageAwards,
```

### Step 54: Leader banner: use the card image when there is one

**Find** (first line is enough), replace the matching piece with:

```js
(star ? playerImg(star, "h2-player") : "")
```

**Replace with:**

```js
(star ? heroPhoto(code, star) : "")
```

### Step 55: Squad: show the card when the player has one

**Find** (first line is enough), replace the matching piece with:

```js
return "<div class='plc'><span class='plc-no'>"
```

**Replace with:**

```js
const fc = findCard(code, p); if (fc) { return cardHtml(fc, p, false); }
      return "<div class='plc'><span class='plc-no'>"
```

### Step 56: Add the card maker and drawing code (JS)

**Find** (first line is enough), replace the matching piece with:

```js
  function playerBase(p) {
```

**Replace with:**

```js
// =============== EFOOTBALL-STYLE PLAYER CARDS ===============
  let cardTeam = "T1";
  function findCard(code, name) {
    const k = slug(name);
    return allCards.find(function (c) { return c.season === currentSeason && c.team === code && slug(c.player) === k; }) || null;
  }
  function safeUrl(u) { return /^(https?:\/\/|players\/)/i.test(u || "") ? u : ""; }
  function heroPhoto(code, star) {
    const c = findCard(code, star);
    if (c && safeUrl(c.image_url)) { return "<img class='h2-player' src='" + esc(safeUrl(c.image_url)) + "' alt='' onerror=\"this.style.display='none'\">"; }
    return playerImg(star, "h2-player");
  }
  function cardHtml(c, name, admin) {
    const st = [["PAS", c.pas], ["SPD", c.spd], ["SHO", c.sho], ["DRI", c.dri]].map(function (x) { return "<div><b>" + (x[1] === null || x[1] === undefined ? "-" : x[1]) + "</b><small>" + x[0] + "</small></div>"; }).join("");
    const img = safeUrl(c.image_url) ? "<img class='efc-img' src='" + esc(safeUrl(c.image_url)) + "' alt='' loading='lazy' onerror=\"this.style.display='none'\">" : "";
    return "<div class='efc t-" + slug(c.card_type || "standard") + "'><div class='efc-top'><b>" + (c.overall || "-") + "</b><span>" + esc(c.position || "") + "</span></div>" + img +
      "<div class='efc-body'><div class='efc-name'>" + esc(playerBase(name || c.player)) + "</div><div class='efc-stats'>" + st + "</div>" +
      "<div class='efc-meta'>" + esc(c.card_type || "Standard") + (c.max_level ? " · Lv " + c.max_level : "") + (c.foot ? " · " + esc(c.foot) : "") + (c.form ? " · Form " + esc(c.form) : "") + "</div>" +
      (admin ? "<div class='efc-adm'><button class='btn out' onclick='editCard(" + c.id + ")'>Edit</button><button class='btn out' onclick='deleteCard(" + c.id + ")'>✕</button></div>" : "") + "</div></div>";
  }
  function num(id) { const v = document.getElementById(id).value; return v === "" ? null : Number(v); }
  async function saveCard() {
    if (!isAdmin) { return; }
    const player = document.getElementById("cdP").value.trim();
    if (!player) { setStatus("Enter the player name."); return; }
    const url = document.getElementById("cdImg").value.trim();
    if (url && !safeUrl(url)) { setStatus("The image link must start with https:// or players/"); return; }
    const row = { season: currentSeason, team: cardTeam, player: player, image_url: url || null, overall: num("cdOvr"), position: document.getElementById("cdPos").value.trim().toUpperCase(),
      max_level: num("cdLvl"), card_type: document.getElementById("cdType").value, foot: document.getElementById("cdFoot").value, form: document.getElementById("cdForm").value.trim(),
      pas: num("cdPas"), spd: num("cdSpd"), sho: num("cdSho"), dri: num("cdDri") };
    const res = await sb.from("player_cards").upsert(row, { onConflict: "season,team,player" }).select();
    if (res.error) { setStatus("Could not save: " + res.error.message); return; }
    setStatus(""); const saved = res.data[0];
    allCards = allCards.filter(function (c) { return !(c.season === saved.season && c.team === saved.team && c.player === saved.player); }).concat([saved]);
    toast("Card saved ✓"); render();
  }
  async function deleteCard(id) {
    if (!isAdmin || !confirm("Delete this card?")) { return; }
    const res = await sb.from("player_cards").delete().eq("id", id);
    if (res.error) { setStatus("Could not delete: " + res.error.message); return; }
    allCards = allCards.filter(function (c) { return c.id !== id; }); render();
  }
  function editCard(id) {
    const c = allCards.find(function (x) { return x.id === id; }); if (!c) { return; }
    const set = function (i, v) { document.getElementById(i).value = (v === null || v === undefined) ? "" : v; };
    set("cdP", c.player); set("cdImg", c.image_url); set("cdOvr", c.overall); set("cdPos", c.position); set("cdLvl", c.max_level); set("cdType", c.card_type || "Standard");
    set("cdFoot", c.foot); set("cdForm", c.form); set("cdPas", c.pas); set("cdSpd", c.spd); set("cdSho", c.sho); set("cdDri", c.dri);
    document.getElementById("cdP").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function pageCards() {
    if (!teams[cardTeam]) { cardTeam = Object.keys(teams)[0]; }
    const sq = squads[cardTeam] ? playerList(squads[cardTeam].players) : [];
    const mine = allCards.filter(function (c) { return c.season === currentSeason && c.team === cardTeam; });
    let html = "<div class='card'><h3>Player cards</h3><select onchange=\"cardTeam=this.value;render()\">" + Object.keys(teams).map(function (c) {
      return "<option value='" + c + "'" + (c === cardTeam ? " selected" : "") + ">" + esc(teams[c]) + "</option>"; }).join("") + "</select></div>";
    html += mine.length ? "<div class='efcs'>" + mine.map(function (c) { return cardHtml(c, c.player, isAdmin); }).join("") + "</div>" : "<div class='card'><p class='legend'>No cards added for this team yet.</p></div>";
    if (isAdmin) {
      const types = ["Standard", "Epic", "Big Time", "Featured", "Legend"].map(function (t) { return "<option>" + t + "</option>"; }).join("");
      html += "<div class='card'><h3>Add or edit a card</h3><datalist id='cdPl'>" + sq.map(function (p) { return "<option value='" + esc(playerBase(p)) + "'>"; }).join("") + "</datalist>" +
        "<div class='cform'><input id='cdP' list='cdPl' placeholder='Player name'><input id='cdImg' placeholder='Image link (https://... or players/x.png)'><input id='cdOvr' type='number' placeholder='Overall'><input id='cdPos' placeholder='Position (CF)'>" +
        "<input id='cdLvl' type='number' placeholder='Max level'><select id='cdType'>" + types + "</select><select id='cdFoot'><option value=''>Foot</option><option>Right</option><option>Left</option></select><input id='cdForm' placeholder='Form (A-E)'>" +
        "<input id='cdPas' type='number' placeholder='PAS'><input id='cdSpd' type='number' placeholder='SPD'><input id='cdSho' type='number' placeholder='SHO'><input id='cdDri' type='number' placeholder='DRI'></div>" +
        "<p class='legend'>Saving a card for a player that already has one replaces it.</p><button class='btn' onclick='saveCard()'>Save card</button></div>";
    }
    return html;
  }

  function playerBase(p) {
```

### Step 57: Add the card styles (CSS)

**Find** (first line is enough), replace the matching piece with:

```js
</head>
```

**Replace with:**

```js
<style id="efcards">
.efcs { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin-bottom:16px; }
.efc { --c1:#9ca3af; --c2:#1f2937; position:relative; aspect-ratio:3/4.3; border-radius:14px; overflow:hidden; color:#fff; border:2px solid var(--c1); background:linear-gradient(160deg,var(--c1),var(--c2) 70%); box-shadow:0 8px 20px rgba(0,0,0,.4); }
.efc.t-epic { --c1:#a855f7; --c2:#2e1065; } .efc.t-big-time { --c1:#fb923c; --c2:#431407; } .efc.t-featured { --c1:#22c55e; --c2:#052e16; } .efc.t-legend { --c1:#f5b301; --c2:#3f2a05; }
.efc-top { position:absolute; left:9px; top:6px; z-index:3; line-height:1; text-shadow:0 2px 4px rgba(0,0,0,.6); }
.efc-top b { display:block; font:700 32px "Oswald",sans-serif; } .efc-top span { display:block; font:600 12px "Oswald",sans-serif; letter-spacing:1px; }
.efc-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; z-index:1; }
.efc-body { position:absolute; left:0; right:0; bottom:0; z-index:3; padding:26px 8px 8px; background:linear-gradient(transparent,rgba(0,0,0,.9) 40%); }
.efc-name { font:700 16px "Oswald",sans-serif; text-transform:uppercase; text-align:center; }
.efc-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:2px; text-align:center; margin:4px 0; }
.efc-stats b { display:block; font:700 15px "Oswald",sans-serif; } .efc-stats small { font-size:9px; letter-spacing:.5px; opacity:.8; }
.efc-meta { font-size:10px; text-align:center; opacity:.85; }
.efc-adm { display:flex; gap:6px; justify-content:center; margin-top:6px; } .efc-adm .btn { padding:3px 10px; font-size:12px; }
.cform { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; margin-bottom:10px; }
</style>
</head>
```

## Part J: New league logo and header (do after Part I)

**Files to upload to GitHub next to index.html:** `logo.svg` (the logo), and replace your existing home-screen icons with `apple-touch-icon.png`, `icon-192.png` and `icon-512.png`. If your `manifest.json` lists icons with other file names, either save the new icons under those names or tell me what it says and I will adjust it.

### Step 58: Replace the whole header block (from <header> to </header>)

**Find:**

```html
<header>
  <div class="wrap">
    <h1><span class="spin">🛡️</span> eFootball League <span class="seasonName">Season 2</span></h1>
    <p id="subTitle">10 teams · home &amp; away · 18 rounds · top 6 to the playoffs</p>
    <label class="sbar">Season <select id="seasonSel" onchange="switchSeason(this.value)"></select></label>
    <button id="themeBtn" class="themebtn" onclick="toggleTheme()"></button>
  </div>
</header>
```

**Replace with:**

```html
<header class="brand">
  <div class="wrap brand-row">
    <div class="brand-logo"><svg class='brand-svg' role='img' aria-label='eFootball Friends League logo' viewBox='0 0 120 128'><defs><linearGradient id='lg1' x1='0' y1='0' x2='0.4' y2='1'><stop offset='0' stop-color='#ff3b4a'/><stop offset='.55' stop-color='#c1121f'/><stop offset='1' stop-color='#5a0000'/></linearGradient><linearGradient id='lg2' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffe27a'/><stop offset='1' stop-color='#d99a00'/></linearGradient></defs><path d='M60 4 L110 18 V66 C110 94 90 112 60 124 C30 112 10 94 10 66 V18 Z' fill='url(#lg2)'/><path d='M60 10 L104 22 V66 C104 91 86 107 60 118 C34 107 16 91 16 66 V22 Z' fill='url(#lg1)'/><circle cx='60' cy='52' r='25' fill='none' stroke='#f5b301' stroke-width='1' opacity='.5'/><circle cx='60.0' cy='21.0' r='2.3' fill='#f5b301'/><circle cx='78.2' cy='26.9' r='2.3' fill='#f5b301'/><circle cx='89.5' cy='42.4' r='2.3' fill='#f5b301'/><circle cx='89.5' cy='61.6' r='2.3' fill='#f5b301'/><circle cx='78.2' cy='77.1' r='2.3' fill='#f5b301'/><circle cx='60.0' cy='83.0' r='2.3' fill='#f5b301'/><circle cx='41.8' cy='77.1' r='2.3' fill='#f5b301'/><circle cx='30.5' cy='61.6' r='2.3' fill='#f5b301'/><circle cx='30.5' cy='42.4' r='2.3' fill='#f5b301'/><circle cx='41.8' cy='26.9' r='2.3' fill='#f5b301'/><circle cx='60' cy='52' r='20' fill='#fff'/><circle cx='60' cy='52' r='20' fill='none' stroke='#111827' stroke-width='2'/><line x1='60.0' y1='44.0' x2='60.0' y2='33.0' stroke='#111827' stroke-width='2.2' stroke-linecap='round'/><line x1='67.6' y1='49.5' x2='78.1' y2='46.1' stroke='#111827' stroke-width='2.2' stroke-linecap='round'/><line x1='64.7' y1='58.5' x2='71.2' y2='67.4' stroke='#111827' stroke-width='2.2' stroke-linecap='round'/><line x1='55.3' y1='58.5' x2='48.8' y2='67.4' stroke='#111827' stroke-width='2.2' stroke-linecap='round'/><line x1='52.4' y1='49.5' x2='41.9' y2='46.1' stroke='#111827' stroke-width='2.2' stroke-linecap='round'/><polygon points='60.0,44.0 67.6,49.5 64.7,58.5 55.3,58.5 52.4,49.5' fill='#111827'/><path d='M30 104 Q60 116 90 104' fill='none' stroke='#f5b301' stroke-width='3' stroke-linecap='round' opacity='.9'/></svg></div>
    <div class="brand-text">
      <div class="brand-kicker">eFootball Friends</div>
      <div class="brand-title">League <span class="seasonName">Season 2</span></div>
      <p id="subTitle">10 teams · home &amp; away · 18 rounds · top 6 to the playoffs</p>
    </div>
    <div class="brand-tools">
      <label class="sbar">Season <select id="seasonSel" onchange="switchSeason(this.value)"></select></label>
      <button id="themeBtn" class="themebtn" onclick="toggleTheme()"></button>
    </div>
  </div>
</header>
```

### Step 59: Add the logo as the browser-tab icon

**Find:**

```html
<link rel="apple-touch-icon" href="apple-touch-icon.png">
```

**Replace with:**

```html
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 128'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0.4' y2='1'%3E%3Cstop offset='0' stop-color='%23ff3b4a'/%3E%3Cstop offset='.55' stop-color='%23c1121f'/%3E%3Cstop offset='1' stop-color='%235a0000'/%3E%3C/linearGradient%3E%3ClinearGradient id='y' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ffe27a'/%3E%3Cstop offset='1' stop-color='%23d99a00'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M60 4 L110 18 V66 C110 94 90 112 60 124 C30 112 10 94 10 66 V18 Z' fill='url%28%23y%29'/%3E%3Cpath d='M60 10 L104 22 V66 C104 91 86 107 60 118 C34 107 16 91 16 66 V22 Z' fill='url%28%23g%29'/%3E%3Ccircle cx='60' cy='52' r='25' fill='none' stroke='%23f5b301' stroke-width='1' opacity='.5'/%3E%3Ccircle cx='60.0' cy='21.0' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='78.2' cy='26.9' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='89.5' cy='42.4' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='89.5' cy='61.6' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='78.2' cy='77.1' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='60.0' cy='83.0' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='41.8' cy='77.1' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='30.5' cy='61.6' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='30.5' cy='42.4' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='41.8' cy='26.9' r='2.3' fill='%23f5b301'/%3E%3Ccircle cx='60' cy='52' r='20' fill='%23fff'/%3E%3Ccircle cx='60' cy='52' r='20' fill='none' stroke='%23111827' stroke-width='2'/%3E%3Cline x1='60.0' y1='44.0' x2='60.0' y2='33.0' stroke='%23111827' stroke-width='2.2' stroke-linecap='round'/%3E%3Cline x1='67.6' y1='49.5' x2='78.1' y2='46.1' stroke='%23111827' stroke-width='2.2' stroke-linecap='round'/%3E%3Cline x1='64.7' y1='58.5' x2='71.2' y2='67.4' stroke='%23111827' stroke-width='2.2' stroke-linecap='round'/%3E%3Cline x1='55.3' y1='58.5' x2='48.8' y2='67.4' stroke='%23111827' stroke-width='2.2' stroke-linecap='round'/%3E%3Cline x1='52.4' y1='49.5' x2='41.9' y2='46.1' stroke='%23111827' stroke-width='2.2' stroke-linecap='round'/%3E%3Cpolygon points='60.0%2C44.0 67.6%2C49.5 64.7%2C58.5 55.3%2C58.5 52.4%2C49.5' fill='%23111827'/%3E%3Cpath d='M30 104 Q60 116 90 104' fill='none' stroke='%23f5b301' stroke-width='3' stroke-linecap='round' opacity='.9'/%3E%3C/svg%3E">
```

### Step 60: Add the new header styles (CSS) before the closing head tag

**Find:**

```html
</head>
```

**Replace with:**

```html
<style id="brand">
/* NEW HEADER + LOGO */
:root:root:root:root header.brand { position:relative; overflow:hidden; clip-path:none; padding:22px 16px 26px; border-bottom:0; box-shadow:inset 0 -3px 0 var(--gold);
  background:radial-gradient(640px 240px at 10% 0,rgba(225,29,46,.55),transparent 70%),radial-gradient(500px 200px at 95% 100%,rgba(245,179,1,.14),transparent 70%),linear-gradient(180deg,#14050b,#0b1220); }
header.brand::before { content:""; position:absolute; right:-90px; top:-60px; width:300px; height:300px; border:2px solid rgba(255,255,255,.08); border-radius:50%; }
header.brand::after { content:""; position:absolute; right:60px; top:-40px; bottom:-40px; width:2px; background:rgba(255,255,255,.07); transform:skewX(-14deg); border:0; border-radius:0; height:auto; }
.brand-row { position:relative; z-index:1; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
.brand-logo { flex:none; width:84px; filter:drop-shadow(0 6px 14px rgba(225,29,46,.45)); animation:logoFloat 4.5s ease-in-out infinite alternate; }
.brand-svg { display:block; width:100%; height:auto; }
@keyframes logoFloat { from { transform:translateY(0) rotate(-1.5deg); } to { transform:translateY(-5px) rotate(1.5deg); } }
.brand-text { flex:1 1 260px; min-width:0; }
.brand-kicker { color:var(--gold); font:600 12px "Oswald",sans-serif; letter-spacing:6px; text-transform:uppercase; }
.brand-title { font:700 clamp(42px,9vw,78px)/.92 "Oswald",sans-serif; font-style:italic; text-transform:uppercase; letter-spacing:2px; color:#fff; }
.brand-title .seasonName { display:inline-block; vertical-align:middle; margin-left:10px; padding:4px 12px; border-radius:20px; background:var(--gold); color:#111; font:600 14px "Oswald",sans-serif; font-style:normal; letter-spacing:1px; transform:translateY(-4px); }
header.brand #subTitle { margin:8px 0 0; color:#d7dcec; font-size:13px; }
.brand-tools { position:relative; z-index:1; display:flex; align-items:center; gap:8px; margin-left:auto; flex-wrap:wrap; }
:root:root:root:root header.brand .themebtn { position:static; }
@media (max-width:700px) {
  :root:root:root:root header.brand { padding:16px 14px 20px; }
  .brand-logo { width:62px; } .brand-row { gap:12px; } .brand-text { flex:1 1 0; }
  .brand-kicker { letter-spacing:4px; font-size:11px; } .brand-title { font-size:40px; }
  .brand-title .seasonName { display:block; width:max-content; margin:6px 0 0; transform:none; }
  .brand-tools { width:100%; margin-left:0; }
}
@media (prefers-reduced-motion:reduce) { .brand-logo { animation:none; } }
</style>
</head>
```
