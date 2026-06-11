const fs = require('fs');
const lines = fs.readFileSync('tmp_chart2/maidata.txt','utf8').split('\n');
let inMaster = false;
let measureCount = 0;
let currentBPM = 200;
let totalNotes = 0;
let totalMeasures = 0;
const sections = [];

function countNotes(line) {
  let clean = line.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '');
  clean = clean.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
  if (!clean) return 0;
  const parts = clean.split(',');
  let count = 0;
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

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('&inote_5=')) { inMaster = true; continue; }
  if (inMaster && line === 'E') break;
  if (!inMaster || !line || line.startsWith('&')) continue;
  
  const bpmMatch = line.match(/^\((\d+)\)/);
  if (bpmMatch) currentBPM = parseInt(bpmMatch[1]);
  
  measureCount++;
  const notes = countNotes(line);
  totalNotes += notes;
  totalMeasures++;
  
  const sectionIdx = Math.floor((measureCount - 1) / 4);
  if (!sections[sectionIdx]) sections[sectionIdx] = { startMeasure: measureCount, notes: 0, measures: 0, bpm: currentBPM };
  sections[sectionIdx].notes += notes;
  sections[sectionIdx].measures++;
  sections[sectionIdx].bpm = currentBPM;
}

console.log('=== 密度统计 (Master 14.8, BPM200, 1小节=1.2s) ===\n');
sections.forEach((s, i) => {
  const spm = (60 / s.bpm) * 4;
  const avg = s.notes / s.measures;
  const dens = avg / spm;
  const bar = '#'.repeat(Math.round(dens));
  const label = '组' + (i+1) + ' 节' + s.startMeasure + '-' + (s.startMeasure + s.measures - 1);
  console.log(label + ' | ' + s.notes + '音/' + s.measures + '节 | ' + avg.toFixed(1) + '音/节 | ' + dens.toFixed(1) + '音/秒 | ' + bar);
});
console.log('\n峰值密度组:');
const peak = sections.reduce((a,b) => (b.notes/b.measures) > (a.notes/a.measures) ? b : a);
console.log('组' + (sections.indexOf(peak)+1) + ' (' + (peak.notes/peak.measures).toFixed(1) + '音/节)');
console.log('\n总计: ' + totalNotes + '音符 / ' + totalMeasures + '小节');
