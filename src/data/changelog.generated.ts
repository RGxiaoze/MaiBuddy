// 自动生成，请勿手改。
// 重新生成：npm run gen:changelog

export interface ChangelogCommit {
  hash: string
  type: string
  message: string
  label: string
  color: string
}

export interface ChangelogEntry {
  date: string
  commits: ChangelogCommit[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    "date": "2026-11-12",
    "commits": [
      {
        "hash": "3ec650b",
        "type": "feat",
        "message": "探索卡补难度标签，推分卡改用「水分」替代「预计评级」",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "cfd0475",
        "type": "feat",
        "message": "探索梯度从投票前 50% 起，难度徽章更醒目",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "751847f",
        "type": "fix",
        "message": "探索页不再出现已玩谱面，难度上限改锚舒适区",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "f93fadd",
        "type": "fix",
        "message": "宴会场曲目回落到原曲曲绘",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9eb0e02",
        "type": "feat",
        "message": "曲绘改用本地 96px 缩略图",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "2b6e2a5",
        "type": "fix",
        "message": "空池不再放开推荐下限，预期评级改用实测成绩",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "1539289",
        "type": "feat",
        "message": "新增推荐算法校准脚本",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "bf3ce74",
        "type": "feat",
        "message": "按测试反馈重构推荐算法",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-11-11",
    "commits": [
      {
        "hash": "874d92d",
        "type": "feat",
        "message": "曲库支持按拟合定数筛选",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "ddf08e5",
        "type": "feat",
        "message": "变更日志过滤已下线板块的提交",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "c1bce50",
        "type": "feat",
        "message": "下线板块的页面源码不再进入打包产物",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "c6c8213",
        "type": "fix",
        "message": "旧框移植谱不再套用 2020 年度校正",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9c607b7",
        "type": "fix",
        "message": "版本筛选改用国服口径，修复排序与日服残留",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "874f7fc",
        "type": "feat",
        "message": "拟合定数三色显示 + 详情页折叠布局 + 筛选改用国服版本",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "e32ed27",
        "type": "fix",
        "message": "收回不可信样本的破顶放行，拟合定数展示区分来源",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9b4b1fc",
        "type": "feat",
        "message": "详情页版本改用国服口径，旧框曲沿用日服名",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "20b8071",
        "type": "fix",
        "message": "实装年数据在 dev 环境下加载失败导致校正失效",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "8a2562d",
        "type": "feat",
        "message": "拟合定数按实装年校正，早期曲标为不可信",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "a20b0d6",
        "type": "feat",
        "message": "补齐版本映射并生成实装年数据",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "5f7dc05",
        "type": "feat",
        "message": "AWMC 支持全量抓取，新增人工评审页生成脚本",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "764e9de",
        "type": "feat",
        "message": "14.9 起不标「轻松」，15 级一律挑战",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "ee0703f",
        "type": "feat",
        "message": "新增 B50 地板诊断脚本，忽略测试成绩 CSV",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "d913e6c",
        "type": "feat",
        "message": "推荐改按定数分档配额，低定数谱不再被高收益谱挤掉",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "f335427",
        "type": "feat",
        "message": "新增 AWMC 与水鱼拟合定数的分歧分析脚本",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "55a8faa",
        "type": "feat",
        "message": "新增 AWMC 校准数据取样脚本",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "d476804",
        "type": "feat",
        "message": "样本不可信的谱面不再被排除在破顶候选之外",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "1e25f59",
        "type": "feat",
        "message": "谱面特征补全至 1340 首，改用 download.wmc.pub 源",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-11-10",
    "commits": [
      {
        "hash": "446cc6e",
        "type": "fix",
        "message": "未知路径重定向到曲库页，避免畸形链接整页白屏",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "e0d4440",
        "type": "fix",
        "message": "授权被拒绝时给出明确提示，不再静默失败",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "1e60ec1",
        "type": "fix",
        "message": "落雪 OAuth 换用正式应用 ID，修正回调地址与成功提示",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "3520e4f",
        "type": "fix",
        "message": "整档样本稀薄时不套绝对下限，避免低档位误标",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "64d17e2",
        "type": "fix",
        "message": "样本可信度阈值改为中位数 30% 与绝对下限 12000",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "d4fb2ce",
        "type": "fix",
        "message": "旧统计缓存缺样本量时自动重新拉取",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "2bcfefb",
        "type": "feat",
        "message": "采集样本量判定可信度，修正隐藏区域曲目拟合偏低",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "779d25e",
        "type": "feat",
        "message": "推分定数上限改以 B1+0.2 为锚，特简单谱可放宽并封顶鸟",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "9431c26",
        "type": "feat",
        "message": "推分目标改按玩家自身水平（B50 同定数段中位数）",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "22dc8b7",
        "type": "fix",
        "message": "推分难度标签纳入玩家差距，避免 +19 分仍标轻松",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "2568c69",
        "type": "feat",
        "message": "代理不可达时自动展开并聚焦 Import-Token 输入",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "c0ceffd",
        "type": "feat",
        "message": "水鱼授权前探测代理可达性，不可达时提示改用 Token",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "3d91e91",
        "type": "feat",
        "message": "水鱼换票支持走 Worker 代理（VITE_DF_OAUTH_PROXY）",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "4f78fa7",
        "type": "feat",
        "message": "更新记录按天折叠，细节修正合并为一行",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "6583c42",
        "type": "fix",
        "message": "更新记录改为静态内联，修复线上 404",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "0045b03",
        "type": "feat",
        "message": "统计页维度取值与难度筛选改为下拉菜单",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "24f7497",
        "type": "feat",
        "message": "实装日期改由落雪曲库补齐（水鱼该字段全为空）",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "b8daac2",
        "type": "feat",
        "message": "新增实装日期排序，添加日期同值时退化排序",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "1b9454f",
        "type": "feat",
        "message": "版本与难度改下拉多选，统计口径排除宴会场",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "60e35c9",
        "type": "feat",
        "message": "成绩统计改为总览/B50/在线查分三 Tab，移除重复的推分表格",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "8c25f7a",
        "type": "feat",
        "message": "新增添加日期排序，检索与统计页默认按添加日期",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "0af2a52",
        "type": "feat",
        "message": "统计页内嵌匹配曲目列表，钻取改为页内筛选",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "dc9b6ab",
        "type": "fix",
        "message": "探索的久未游玩判定抽出纯函数，改用游玩日期种类判可信",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "a767bf6",
        "type": "feat",
        "message": "推分建议按池限量折叠，探索支持三个月未游玩复健",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "525e2af",
        "type": "feat",
        "message": "等级筛选改为全档位，宴会场默认隐藏并可开关",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-11-09",
    "commits": [
      {
        "hash": "be0f65c",
        "type": "fix",
        "message": "单曲 Rating 取整，避免总分出现小数",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "10111eb",
        "type": "feat",
        "message": "成绩导入导出支持落雪 CSV",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "2c34def",
        "type": "fix",
        "message": "曲绘改用落雪资源，修正 DX 曲目换算",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9886f85",
        "type": "feat",
        "message": "导入弹窗新增落雪账号入口",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "b9421c4",
        "type": "fix",
        "message": "修正落雪 OAuth 端点、凭据头与成绩字段对接错误",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "e339107",
        "type": "feat",
        "message": "落雪成绩读取与格式转换",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "cd79301",
        "type": "feat",
        "message": "退出水鱼授权 + 修复 GitHub Pages 子路径 404",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "5c1212f",
        "type": "feat",
        "message": "接入水鱼账号 OAuth（授权码 + PKCE，公开客户端）",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "7d912ef",
        "type": "fix",
        "message": "生产环境隐藏账号密码登录（跨域 cookie 不可用）",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "f1c5585",
        "type": "fix",
        "message": "组合筛选改为「同一谱面同时满足」，等级与定数改下拉",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "701b4ce",
        "type": "feat",
        "message": "曲目详情页重排——拟合定数前置 + 三率改档内排名",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "f1ba568",
        "type": "feat",
        "message": "全站页面背景，按「本页第一个封面」自动切换",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "f6a9c9d",
        "type": "fix",
        "message": "推分文案与实际目标档对齐",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "8cf8055",
        "type": "fix",
        "message": "池内非地板条目纳入推荐 + 推荐卡恢复难度提示",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "78e0425",
        "type": "fix",
        "message": "B15 候选不再共用 B35 的定数上限",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "501bb92",
        "type": "fix",
        "message": "暂时排除 Link 的 Re:MASTER（查分器上传异常）",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9f14f49",
        "type": "fix",
        "message": "推分折叠改为按「是否好推」，不再按池子隐藏",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "60593b0",
        "type": "fix",
        "message": "谱师 “H”ack 归并为 Jack（全角引号导致漏匹配）",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "af95f97",
        "type": "feat",
        "message": "谱师别名归一化 + 偏好加权 + 文档更新",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "fc7557a",
        "type": "feat",
        "message": "推荐卡片重做 + 推分分组 + 探索随机化与屏蔽",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "c5b993d",
        "type": "feat",
        "message": "推荐页新增「探索」Tab，替换越级榜",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "c73dc40",
        "type": "feat",
        "message": "新增 SSS 口径拟合定数",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "99f2a69",
        "type": "fix",
        "message": "谱师占位符 \"-\" 归一为「未知」，避免搜索误匹配",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "b7d2c33",
        "type": "fix",
        "message": "推荐与曲目详情的可读性问题",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "55ee876",
        "type": "feat",
        "message": "曲目检索支持按曲名排序",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "8b4e210",
        "type": "fix",
        "message": "全局数据初始化 + FC/FS 标签补全",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "01399c2",
        "type": "feat",
        "message": "成绩统计面板重构 + B50 曲绘链路统一",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-08-06",
    "commits": [
      {
        "hash": "5331baa",
        "type": "fix",
        "message": "曲绘 webp→PNG 回退链 + 卡片排版对齐",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "4a4c22a",
        "type": "fix",
        "message": "剔除无效曲绘 ID + 本地占位（难度色+曲名首字）",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "9527db1",
        "type": "fix",
        "message": "曲绘 ID 映射（DF songId→LXNS musicId）+ 卡片布局修正",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "1a3919a",
        "type": "feat",
        "message": "B50 展示改为曲绘横向小卡片网格（移动3列/桌面5列）",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "e6fe519",
        "type": "feat",
        "message": "个性化推荐 + 成绩管理重构 + 成绩统计页",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-06-12",
    "commits": [
      {
        "hash": "d7f4003",
        "type": "feat",
        "message": "谱面重命名脚本 {id}.txt → {曲名}[SD|DX].txt",
        "label": "新功能",
        "color": "green"
      }
    ]
  },
  {
    "date": "2026-06-11",
    "commits": [
      {
        "hash": "740b4d0",
        "type": "feat",
        "message": "LXNS CDN 谱面批量下载脚本 + npm run download:charts",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "ff909aa",
        "type": "feat",
        "message": "导入成功后 2.5s 自动关闭弹窗",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "cc9bf97",
        "type": "fix",
        "message": "全服统计卡片优雅降级 + 空缓存自动重试",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "418b567",
        "type": "feat",
        "message": "推分建议 AP 列始终显示 — P4 完成",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "be741e4",
        "type": "fix",
        "message": "导入弹窗布局 — 登录按钮独立成行 + body锁滚动",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "e341d25",
        "type": "fix",
        "message": "推分建议每池独立上限 + 全服统计不消失 + 双池扫描",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "a7975e2",
        "type": "feat",
        "message": "B35/B15 预览5条虚化 + 推分建议双池算法修复",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "db6c687",
        "type": "fix",
        "message": "渲染错误修复与代码隐患清理",
        "label": "修复",
        "color": "amber"
      }
    ]
  },
  {
    "date": "2026-06-06",
    "commits": [
      {
        "hash": "cfc17e7",
        "type": "fix",
        "message": "CI构建跳过prebuild，仅执行vite build",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "2254486",
        "type": "fix",
        "message": "GitHub Pages 部署基准路径 /MaiBuddy/",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "b9b04b2",
        "type": "fix",
        "message": "GitHub Pages 部署 — 修复 workflow 中文关键字 + 生产 API 直连",
        "label": "修复",
        "color": "amber"
      }
    ]
  },
  {
    "date": "2026-06-05",
    "commits": [
      {
        "hash": "8ca6037",
        "type": "feat",
        "message": "致谢内容全面完善",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "926476a",
        "type": "feat",
        "message": "导入进度反馈 + B15空位提醒",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "96ab008",
        "type": "feat",
        "message": "第一阶段增量优化 — 统计卡片、适应性分析、移动端适配、版本检测",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "453062f",
        "type": "feat",
        "message": "zone 扩展 + 加权难度分类 + UI 全面优化",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "0f1a9a8",
        "type": "feat",
        "message": "成绩导出/导入 + 暗色模式 + 推分目标达成率设置",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "772341a",
        "type": "feat",
        "message": "新增使用指南、更新记录、开发文档页面 + 页脚与侧边栏关于区",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "de23aaa",
        "type": "feat",
        "message": "版本显示名映射 — MiLK PLUS 显示为 maimai MiLK PLUS",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "587492a",
        "type": "fix",
        "message": "VERSION_ORDER 键对齐 Diving-Fish API 实际 from 值",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "1c12ebe",
        "type": "fix",
        "message": "版本排序改为动态查表 + 移除无用区域筛选",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "b37b808",
        "type": "fix",
        "message": "版本排序箭头失效 — 建立 VERSION_ORDER 映射表",
        "label": "修复",
        "color": "amber"
      },
      {
        "hash": "5cf9f5e",
        "type": "feat",
        "message": "全服达成分布新增「vs 官标定数」三行对比",
        "label": "新功能",
        "color": "green"
      },
      {
        "hash": "541b135",
        "type": "fix",
        "message": "getFitDiffAvg 参数修正",
        "label": "修复",
        "color": "amber"
      }
    ]
  }
]
