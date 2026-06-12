// ============================================================
// 谱面文件重命名: {id}.txt → {曲名}[{类型}].txt
// 用法: node scripts/rename-charts.cjs
// ============================================================

const fs = require('fs')
const path = require('path')

const DIR = path.resolve(__dirname, '..', '参考谱面')

function extractTitle(content) {
  // Search first 30 lines for title (not always line 1)
  const lines = content.split('\n').slice(0, 30)
  for (const line of lines) {
    const match = line.match(/^&title=(.+)/)
    if (!match) continue
    const raw = match[1].trim()
    const typeMatch = raw.match(/\[(SD|DX)\]$/)
    const type = typeMatch ? typeMatch[1] : ''
    const title = typeMatch ? raw.slice(0, -4).trim() : raw
    return { title, type }
  }
  return null
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.txt') && /^\d+\.txt$/.test(f))
let renamed = 0
let skipped = 0

for (const file of files) {
  const oldPath = path.join(DIR, file)
  const content = fs.readFileSync(oldPath, 'utf8')
  const info = extractTitle(content)
  if (!info || !info.title) { skipped++; continue }
  
  // Sanitize filename: remove chars invalid on Windows
  const safeTitle = info.title.replace(/[<>:"/\\|?*]/g, '')
  const suffix = info.type ? `[${info.type}]` : ''
  const newName = `${safeTitle}${suffix}.txt`
  const newPath = path.join(DIR, newName)
  
  if (oldPath === newPath) { skipped++; continue }
  
  // Handle duplicates: append (2), (3) etc.
  let finalPath = newPath
  let dup = 2
  while (fs.existsSync(finalPath) && finalPath !== oldPath) {
    finalPath = path.join(DIR, `${safeTitle}${suffix}(${dup}).txt`)
    dup++
  }
  
  fs.renameSync(oldPath, finalPath)
  renamed++
}

console.log(`${renamed} 个文件已重命名, ${skipped} 个跳过`)
