const fs = require('fs');

function countStats(chartFile, startLine, endLine) {
  const lines = fs.readFileSync(chartFile, 'utf8').split('\n');
  let bpm = 188;
  let measure = 0;
  const spm = () => 60/bpm * 4;
  
  const windows = []; // {notes, seconds, doubles, displacement}
  let currentWindow = { notes: 0, seconds: 0, doubles: 0, displaces: 0 };
  let prevPositions = [];
  
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i].trim();
    if (!line || line === 'E' || line.startsWith('&')) continue;
    
    const bpmMatch = line.match(/^\((\d+)\)/);
    if (bpmMatch) bpm = parseInt(bpmMatch[1]);
    
    measure++;
    const sec = spm();
    
    let clean = line.replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '');
    clean = clean.replace(/^[, ]+/, '').replace(/[, ]+$/, '');
    if (!clean) {
      if (currentWindow.notes > 0) {
        windows.push({...currentWindow});
        currentWindow = { notes: 0, seconds: 0, doubles: 0, displaces: 0 };
      }
      continue;
    }
    
    const parts = clean.split(',');
    let notes = 0, doubles = 0;
    let positions = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const chords = trimmed.split('/');
      let chordNotes = 0;
      for (const c of chords) {
        const ch = c.trim();
        if (ch && /^[1-8]/.test(ch)) {
          notes++;
          chordNotes++;
          const num = parseInt(ch.match(/^[1-8]/)[0]);
          positions.push(num);
        }
      }
      if (chordNotes >= 2) doubles++;
    }
    
    currentWindow.notes += notes;
    currentWindow.seconds += sec;
    currentWindow.doubles += doubles;
    
    // Track displacement (adjacent pair position changes)
    let displaces = 0;
    for (let j = 1; j < positions.length; j++) {
      const d = Math.min(Math.abs(positions[j] - positions[j-1]), 8 - Math.abs(positions[j] - positions[j-1]));
      if (d >= 1) displaces += d;
    }
    currentWindow.displaces += displaces;
    
    // Window boundary: empty measure or density drop
    if (notes / sec < 3 && currentWindow.notes > 20) {
      windows.push({...currentWindow});
      currentWindow = { notes: 0, seconds: 0, doubles: 0, displaces: 0 };
    }
  }
  if (currentWindow.notes > 0) windows.push(currentWindow);
  
  return windows;
}

function evaluateStamina(windows) {
  // Find the longest sustained window (>5 notes/s, >4s)
  const sustainedWindows = windows.filter(w => w.seconds >= 4 && w.notes/w.seconds >= 5);
  
  if (sustainedWindows.length === 0) return { score: 0, details: '无持续高密度段' };
  
  const longest = sustainedWindows.reduce((a,b) => a.seconds > b.seconds ? a : b);
  const densest = sustainedWindows.reduce((a,b) => (a.notes/a.seconds) > (b.notes/b.seconds) ? a : b);
  
  const avgDensity = longest.notes / longest.seconds;
  const doubleRatio = longest.doubles / Math.max(longest.notes, 1);
  const displacesPerNote = longest.displaces / Math.max(longest.notes, 1);
  
  // Stamina score = density × duration_factor × displacement_factor × double_factor
  const durationFactor = Math.log2(longest.seconds / 4 + 1); // Log scale, base at 4s
  const displacementFactor = 1 + displacesPerNote * 0.3;
  const doubleFactor = 1 + doubleRatio * 0.5;
  
  const score = avgDensity * durationFactor * displacementFactor * doubleFactor;
  
  return {
    score: Math.round(score * 10) / 10,
    longestWindow: `${longest.seconds.toFixed(1)}s`,
    avgDensity: avgDensity.toFixed(1),
    peakDensity: (densest.notes / densest.seconds).toFixed(1),
    doubleRatio: (doubleRatio * 100).toFixed(0) + '%',
    displacesPerNote: displacesPerNote.toFixed(1),
    details: `${longest.seconds.toFixed(0)}s窗口内 ${longest.notes}音, 双押${(doubleRatio*100).toFixed(0)}%, 位移${displacesPerNote.toFixed(1)}键/音`
  };
}

console.log('=== 封焔 Master (BPM200, 105+7节) ===');
const houen = countStats('tmp_chart2/maidata.txt', 381, 494);
const hResult = evaluateStamina(houen);
console.log('体力分:', hResult.score);
console.log('最长持续窗:', hResult.longestWindow);
console.log('窗内均密度:', hResult.avgDensity, '音/秒');
console.log('全曲峰密度:', hResult.peakDensity, '音/秒');
console.log(hResult.details);

console.log('\n=== Schwarzschild Master (BPM188, 96节) ===');
const schwarz = countStats('tmp_schwarz/maidata.txt', 331, 429);
const sResult = evaluateStamina(schwarz);
console.log('体力分:', sResult.score);
console.log('最长持续窗:', sResult.longestWindow);
console.log('窗内均密度:', sResult.avgDensity, '音/秒');
console.log('全曲峰密度:', sResult.peakDensity, '音/秒');
console.log(sResult.details);

console.log('\n=== 对比 ===');
console.log('封焔体力分:', hResult.score, 'vs Schwarzschild:', sResult.score);
console.log('差异:', ((hResult.score - sResult.score) / sResult.score * 100).toFixed(0) + '%');
