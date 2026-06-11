const fs = require('fs');
const lines = fs.readFileSync('tmp_schwarz/maidata.txt','utf8').split('\n');

function countNotes(line) {
  let clean = line.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '');
  clean = clean.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
  if (!clean) return 0;
  let count = 0;
  const parts = clean.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const chords = trimmed.split('/');
    for (const chord of chords) {
      const c = chord.trim();
      if (!c) continue;
      if (/^[1-8]/.test(c) || /^[A-E]/.test(c) || c === 'C' || /^C1/.test(c)) count++;
    }
  }
  return count;
}

const charts = {};
let current = null;
let currentBPM = 188;
let measureCount = 0;

for (const line of lines) {
  const t = line.trim();
  const m = t.match(/^&inote_(\d)=/);
  if (m) {
    current = m[1];
    charts[current] = { bpm: 188, measures: 0, notes: 0, touch: 0, slide: 0, hold: 0, break_: 0, ex: 0, startLine: null };
    currentBPM = 188;
    measureCount = 0;
    continue;
  }
  if (!current) continue;
  if (t === 'E' || (t.startsWith('&') && !t.startsWith('&inote'))) {
    const c = charts[current];
    c.totalSec = c.measures * (60 / c.bpm) * 4;
    current = null;
    continue;
  }
  if (!t) continue;
  
  const bpmMatch = t.match(/^\((\d+)\)/);
  if (bpmMatch) currentBPM = parseInt(bpmMatch[1]);
  
  measureCount++;
  const c = charts[current];
  c.measures++;
  c.notes += countNotes(t);
  
  // Count touch notes
  const touchCount = (t.match(/[A-E]\d|C1[^h]|C(?!1)/g) || []).length;
  c.touch += touchCount;
  
  // Count slides (anything with - or < or > or v or V or w or pp or qq or s or z)
  const slideCount = (t.match(/[1-8][bhx]?[-<≥≤>Vv]|[1-8][bhx]?(?:pp|qq|w|s|z)/g) || []).length;
  c.slide += slideCount;
  
  // Count holds
  const holdCount = (t.match(/h\[/g) || []).length;
  c.hold += holdCount;
  
  // Count breaks
  const breakCount = (t.match(/[1-8]b[^h]/g) || []).length;
  c.break_ += breakCount;
  
  // Count Ex
  const exCount = (t.match(/[1-8]x/g) || []).length;
  c.ex += exCount;
}

const diffs = ['2','3','4','5','6'];
const names = {2:'Basic',3:'Advanced',4:'Expert',5:'Master',6:'Re:Master'};
const lvs = {2:'7.0',3:'9.7',4:'12.9',5:'14.3',6:'14.9'};

console.log('=== Schwarzschild 全难度对比 ===\n');
console.log('难度     | 等级  | 小节 | 时长   | 总音 | 音/秒 | Touch | Slide | Hold | Break | Ex');
console.log('-'.repeat(85));
for (const d of diffs) {
  const c = charts[d];
  if (!c) continue;
  const dens = (c.notes / c.totalSec).toFixed(1);
  console.log(
    names[d].padEnd(9) + '| ' +
    lvs[d].padEnd(5) + '| ' +
    String(c.measures).padEnd(5) + '| ' +
    (c.totalSec.toFixed(0)+'s').padEnd(6) + '| ' +
    String(c.notes).padEnd(5) + '| ' +
    dens.padEnd(6) + '| ' +
    String(c.touch).padEnd(6) + '| ' +
    String(c.slide).padEnd(6) + '| ' +
    String(c.hold).padEnd(5) + '| ' +
    String(c.break_).padEnd(6) + '| ' +
    String(c.ex)
  );
}
