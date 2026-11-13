// ============================================================
// 生成参考定数评审页面（本地 HTML，可点选）
//
// 每首谱面给出四个候选值：水鱼 / AWMC / 均值 / 难度偏移，
// 由用户凭体感选一个，或填自己的数值。结果可一键复制。
//
// 用法: node scripts/gen-review-page.cjs
// 输出: awmc-review.local.html（命中 .gitignore 的 *.local.*）
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, '项目资料')
fs.mkdirSync(DATA_DIR, { recursive: true })
const OUT = path.join(DATA_DIR, 'awmc-review.local.html')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume()
        return resolve(get(new URL(res.headers.location, url).toString()))
      }
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function main() {
  const tags = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'awmc-tags.local.json'), 'utf8'))
  const music = await get('https://www.diving-fish.com/api/maimaidxprober/music_data')
  const stats = (await get('https://www.diving-fish.com/api/maimaidxprober/chart_stats')).charts
  const byId = new Map(music.map((s) => [Number(s.id), s]))

  const rows = []
  for (const [key, v] of Object.entries(tags)) {
    const [sid, kind, diff] = key.split(':')
    const dfId = kind === 'dx' ? Number(sid) + 10000 : Number(sid)
    const song = byId.get(dfId) || byId.get(Number(sid))
    if (!song) continue
    const lv = song.ds ? song.ds[Number(diff) - 2] : undefined
    if (typeof lv !== 'number' || lv < 13.0 || lv > 14.5) continue

    const arr = stats[String(dfId)] || stats[String(Number(sid))] || []
    const st = arr[Number(diff) - 2]
    const cls = v.tags && v.tags.difficultyClassification
    if (!st || !cls) continue

    const fish = Number(st.fit_diff)
    const awmc = cls.estimatedLevel
    const delta = awmc - fish
    rows.push({
      key,
      title: v.title,
      label: v.levelLabel,
      difficulty: (v.levelLabel || '').toUpperCase().includes('RE:MASTER') ? 'ReMaster'
        : (v.levelLabel || '').toUpperCase().includes('EXPERT') ? 'Expert' : 'Master',
      official: lv,
      fish,
      awmc,
      mean: (fish + awmc) / 2,
      cat: cls.tag,
      delta,
    })
  }

  // 正常谱取 |Δ|≥0.5，极端谱取 |Δ|≥1.0，凑约 30 首，按定数降序
  const normal = rows.filter((r) => r.cat === 'normal' && Math.abs(r.delta) >= 0.5)
  const extreme = rows.filter((r) => r.cat !== 'normal' && Math.abs(r.delta) >= 1.0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 11)
  const pick = [...normal, ...extreme].sort((a, b) => b.official - a.official || Math.abs(b.delta) - Math.abs(a.delta))

  const data = pick.map((r) => ({
    key: r.key,
    title: r.title,
    label: r.label,
    difficulty: r.difficulty,
    official: +r.official.toFixed(1),
    fish: +r.fish.toFixed(2),
    awmc: +r.awmc.toFixed(2),
    mean: +r.mean.toFixed(2),
    offset: +(r.difficulty === 'ReMaster' ? r.fish + 0.18 : r.difficulty === 'Expert' ? r.fish - 0.18 : r.fish).toFixed(2),
    cat: r.cat,
  }))

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>参考定数评审</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 16px; background: #f6f7f9; color: #1f2328; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .hint { font-size: 13px; color: #57606a; margin-bottom: 16px; line-height: 1.6; }
  .card { background: #fff; border: 1px solid #d8dee4; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .title { font-weight: 600; font-size: 15px; }
  .meta { font-size: 12px; color: #57606a; }
  .badge { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: #eef1f4; color: #57606a; }
  .badge.water { background: #ddf4ff; color: #0969da; }
  .badge.fake { background: #ffebe9; color: #cf222e; }
  .opts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
  .opt { border: 1px solid #d8dee4; border-radius: 8px; padding: 8px 6px; text-align: center; cursor: pointer; font-size: 13px; user-select: none; background: #fff; }
  .opt:hover { border-color: #8c959f; }
  .opt.sel { border-color: #1f883d; background: #dafbe1; font-weight: 600; }
  .opt .k { display: block; font-size: 11px; color: #57606a; margin-bottom: 2px; }
  .opt.sel .k { color: #1a7f37; }
  .custom { margin-top: 8px; display: flex; gap: 6px; align-items: center; font-size: 12px; color: #57606a; }
  .custom input { flex: 1; padding: 6px 8px; border: 1px solid #d8dee4; border-radius: 6px; font-size: 13px; }
  .bar { position: sticky; bottom: 0; background: #f6f7f9; padding: 12px 0; border-top: 1px solid #d8dee4; margin-top: 16px; }
  button { padding: 10px 18px; border-radius: 8px; border: none; background: #1f883d; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #1a7f37; }
  #out { width: 100%; box-sizing: border-box; margin-top: 10px; height: 160px; font-family: ui-monospace, monospace; font-size: 12px; padding: 8px; border: 1px solid #d8dee4; border-radius: 8px; display: none; }
  .count { font-size: 13px; color: #57606a; margin-left: 12px; }
</style>
</head>
<body>
<h1>参考定数评审</h1>
<div class="hint">
  每首选一个最接近你体感的定数。四个候选分别是：<b>水鱼</b>拟合、<b>AWMC</b> 回归预测、
  两者<b>均值</b>、按难度<b>偏移</b>（Expert −0.18 / Re:Master +0.18 / Master 不变）。<br>
  都不准就在下面输入框填你自己的数值（填了就优先用它）。共 ${data.length} 首。
</div>
<div id="list"></div>
<div class="bar">
  <button id="gen">生成结果</button><span class="count" id="count"></span>
  <textarea id="out" readonly></textarea>
</div>
<script>
const DATA = ${JSON.stringify(data)};
const answers = {};
const list = document.getElementById('list');

DATA.forEach((d, i) => {
  const card = document.createElement('div');
  card.className = 'card';
  const catClass = d.cat === 'water' ? 'water' : d.cat === 'fake' ? 'fake' : '';
  const catText = d.cat === 'water' ? '水' : d.cat === 'fake' ? '诈称' : '';
  card.innerHTML = \`
    <div class="head">
      <span class="title">\${i + 1}. \${d.title}</span>
      <span class="meta">\${d.label} · 官标 \${d.official}
        \${catText ? '<span class="badge ' + catClass + '">' + catText + '</span>' : ''}</span>
    </div>
    <div class="opts">
      \${['fish', 'awmc', 'mean', 'offset'].map((k) => {
        const names = { fish: '水鱼', awmc: 'AWMC', mean: '均值', offset: '偏移' };
        return \`<div class="opt" data-key="\${d.key}" data-choice="\${k}"><span class="k">\${names[k]}</span>\${d[k].toFixed(2)}</div>\`;
      }).join('')}
    </div>
    <div class="custom"><span>都不准 →</span><input type="number" step="0.1" placeholder="填你判断的定数" data-custom="\${d.key}"></div>
  \`;
  card.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (!opt) return;
    card.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel'));
    opt.classList.add('sel');
    answers[d.key] = { choice: opt.dataset.choice, value: Number(opt.textContent.replace(/[^0-9.]/g, '')) };
    updateCount();
  });
  card.querySelector('input[data-custom]').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (v === '') { delete answers[d.key + ':custom']; return; }
    answers[d.key + ':custom'] = { choice: 'custom', value: Number(v) };
    updateCount();
  });
  list.appendChild(card);
});

function updateCount() {
  const picked = DATA.filter((d) => answers[d.key] || answers[d.key + ':custom']).length;
  document.getElementById('count').textContent = \`已选 \${picked} / \${DATA.length}\`;
}

document.getElementById('gen').addEventListener('click', () => {
  const lines = [];
  DATA.forEach((d) => {
    const custom = answers[d.key + ':custom'];
    const picked = custom || answers[d.key];
    if (!picked) return;
    lines.push(\`\${d.key}\\t\${d.title}\\t官标\${d.official}\\t水鱼\${d.fish.toFixed(2)}\\tAWMC\${d.awmc.toFixed(2)}\\t→ \${picked.choice} \${picked.value.toFixed(2)}\`);
  });
  const out = document.getElementById('out');
  out.style.display = 'block';
  out.value = lines.join('\\n');
  out.select();
});
updateCount();
</script>
</body>
</html>`

  fs.writeFileSync(OUT, html, 'utf8')
  console.log(`生成 ${data.length} 首 → ${OUT}`)
  const byCat = {}
  for (const d of data) byCat[d.cat] = (byCat[d.cat] || 0) + 1
  console.log('分类:', JSON.stringify(byCat))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
