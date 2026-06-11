const fs = require('fs');
const lines = fs.readFileSync('tmp_chart2/maidata.txt','utf8').split('\n');
let inMaster = false;
let measureCount = 0;
let currentBPM = 200;
let bpm200Measures = 0;
let bpm160Measures = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('&inote_5=')) { inMaster = true; continue; }
  if (inMaster && line === 'E') break;
  if (!inMaster || !line || line.startsWith('&')) continue;
  
  const bpmMatch = line.match(/^\((\d+)\)/);
  if (bpmMatch) currentBPM = parseInt(bpmMatch[1]);
  
  measureCount++;
  if (currentBPM === 200) bpm200Measures++;
  else bpm160Measures++;
}

const total = (bpm200Measures * 1.2) + (bpm160Measures * 1.5);
console.log('BPM200: ' + bpm200Measures + '小节 × 1.2s = ' + (bpm200Measures * 1.2).toFixed(1) + 's');
console.log('BPM160: ' + bpm160Measures + '小节 × 1.5s = ' + (bpm160Measures * 1.5).toFixed(1) + 's');
console.log('总时长: ' + total.toFixed(1) + 's (约' + Math.round(total/60) + '分' + Math.round(total%60) + '秒)');
