const fs = require('fs');

// Key lines to recheck from 封焔 Master
const checks = {
  '封焔-481-1b↔5b交互': { line: '{48}1x/5x,,,2/6,,,3/7,,,4/8,,,1,,,2,,,3,,,4,,,1b,,5,,1b,,5,,1b,,5,,1b,,5,,1b,,5,,1b,,5,,', patterns: [
    ['1x/5x,,,2/6', 3], ['1b,,5', 2], ['1,,,2', 3]
  ]},
  '封焔-478-双押切分': { line: '{48}2b/8b,,,,,,1,,,1,,,1,,,,,,3b/7b,,,,,,1x/5x,,,,1/5,,,,1/5,,,,4x/8x,,,,4/8,,,,4/8', patterns: [
    ['1x/5x,,,,1/5', 4], ['1,,,1', 3]
  ]},
  '封焔-479-32分': { line: '{32}1x/5x,,2,,3,,4,,5/8,,7,,6,,5,,2x,3,2,,8,,1,,8,,1,,8', patterns: [
    ['1x/5x,,2', 2], ['8,,1', 2]
  ]},
  '封焔-469-24分': { line: '{24}1x-6[8:1]/5x-2[8:1],,,,,,1/5,,,,,,3/7,,,3/7,2/6,1/5,4/8', patterns: [
    ['1/5,,,,,,3/7', 6], ['3/7,,,,,,2/6', 6], ['3/7,,,3/7', 3]
  ]},
  '封焔-400-12分': { line: '{12}7,5,6,2,4,3,8,6,7,1,3,2', patterns: [
    ['7,5', 0]
  ]},
  'Schwarz-ReM-438-24分': { line: '{24}4/7,,8,,1,,2/6,,3,,4,,7,,6,4,5,,3/6,,2,,1', patterns: [
    ['4/7,,8', 2], ['8,,1', 2]
  ]},
  'Schwarz-ReM-494-48分': { line: '{48}6,,,5,,,6,,,5,,,6,,,,,,3,,,4,,,3,,,4,,,3', patterns: [
    ['6,,,5', 3], ['6,,,,,,3', 6]
  ]},
};

console.log('=== 社区拍数重算 ===\n');
for (const [name, data] of Object.entries(checks)) {
  console.log(name + ':');
  for (const [pattern, commas] of data.patterns) {
    const subMatch = data.line.match(/\{(\d+)\}/);
    const sub = subMatch ? parseInt(subMatch[1]) : '?';
    const tempo = sub / commas;
    console.log('  ' + pattern + ' (' + commas + '逗) → ' + sub + '÷' + commas + ' = ' + tempo.toFixed(1) + '分');
  }
  console.log('');
}
