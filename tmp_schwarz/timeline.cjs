const fs = require('fs');
const lines = fs.readFileSync('tmp_schwarz/maidata.txt','utf8').split('\n');

function parseChart(startLine, endLine) {
  const result = [];
  let measure = 0;
  const bpm = 188;
  const spm = 60/bpm * 4; // seconds per measure
  
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i].trim();
    if (!line || line === 'E' || line.startsWith('&')) continue;
    
    measure++;
    const time = ((measure - 1) * spm).toFixed(1);
    const min = Math.floor(time / 60);
    const sec = (time % 60).toFixed(1).padStart(4, '0');
    const ts = min + ':' + sec;
    
    // Extract subdivision and clean notes
    const subMatch = line.match(/\{(\d+)\}/);
    const sub = subMatch ? subMatch[1] : '?';
    
    // Count actual notes (not commas)
    let clean = line.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '');
    clean = clean.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
    let noteCount = 0;
    if (clean) {
      const parts = clean.split(',');
      for (const p of parts) {
        const t = p.trim();
        if (!t) continue;
        const chords = t.split('/');
        for (const c of chords) {
          if (c.trim() && /^[1-8A-EC]/.test(c.trim())) noteCount++;
        }
      }
    }
    
    // Find shortest comma gap (for community tempo)
    const tokens = clean ? clean.split(',') : [];
    let minGap = Infinity;
    let notePositions = [];
    let commaRun = 0;
    for (const t of tokens) {
      const trimmed = t.trim();
      if (trimmed && /[1-8A-EC]/.test(trimmed)) {
        notePositions.push(commaRun);
        commaRun = 0;
      } else {
        commaRun++;
      }
    }
    // Find unique non-zero gaps
    const gaps = [...new Set(notePositions.slice(1))].filter(g => g > 0);
    if (gaps.length > 0) {
      minGap = Math.min(...gaps);
    }
    
    const tempo = minGap > 0 && minGap < Infinity ? sub + '÷' + minGap + '=' + (sub/minGap).toFixed(0) + '分' : sub + '分';
    
    result.push({
      measure, ts, sub, notes: noteCount, tempo
    });
  }
  return result;
}

// Master: lines 332-429 (0-indexed: 331-428)
// Re:Master: lines 431-528 (0-indexed: 430-527)

console.log('=== MASTER 14.3 ===\n');
console.log('小节 | 时间   | 拍号 | 音数 | 最快配置');
console.log('-'.repeat(55));
const master = parseChart(331, 428);
for (const r of master) {
  console.log(
    String(r.measure).padEnd(5) + '| ' +
    r.ts.padEnd(7) + '| ' +
    ('{'+r.sub+'}').padEnd(5) + '| ' +
    String(r.notes).padEnd(4) + '| ' +
    r.tempo
  );
}

console.log('\n\n=== Re:MASTER 14.9 ===\n');
console.log('小节 | 时间   | 拍号 | 音数 | 最快配置');
console.log('-'.repeat(55));
const remaster = parseChart(430, 527);
for (const r of remaster) {
  console.log(
    String(r.measure).padEnd(5) + '| ' +
    r.ts.padEnd(7) + '| ' +
    ('{'+r.sub+'}').padEnd(5) + '| ' +
    String(r.notes).padEnd(4) + '| ' +
    r.tempo
  );
}
