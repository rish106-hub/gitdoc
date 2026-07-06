const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const outDir = path.resolve(__dirname, '../media/launch')
fs.mkdirSync(outDir, { recursive: true })

const ORANGE = '#F05033'
const INK = '#171717'
const PANEL = '#222222'
const MUTED = '#A8A29E'
const TEXT = '#FFFFFF'
const SOFT = '#FAFAF9'

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function icon(x, y, size) {
  const s = size / 128
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <rect width="128" height="128" rx="28" fill="${ORANGE}"/>
      <path d="M64 23L96 37V65C96 84.5 83.5 98.5 64 110C44.5 98.5 32 84.5 32 65V37L64 23Z" fill="#FFFFFF"/>
      <path d="M52 45V83M52 64L78 50" stroke="${ORANGE}" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="45" r="7.5" fill="${ORANGE}"/>
      <circle cx="52" cy="83" r="7.5" fill="${ORANGE}"/>
      <circle cx="78" cy="50" r="7.5" fill="${ORANGE}"/>
    </g>`
}

function text(x, y, content, size, weight = 700, fill = TEXT, anchor = 'start') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="0">${esc(content)}</text>`
}

function multiline(x, y, lines, size, weight = 600, fill = TEXT, gap = Math.round(size * 1.35)) {
  return lines.map((line, i) => text(x, y + i * gap, line, size, weight, fill)).join('\n')
}

function pill(x, y, label, width, fill = ORANGE) {
  return `<g transform="translate(${x} ${y})"><rect width="${width}" height="48" rx="24" fill="${fill}"/>${text(24, 32, label, 18, 800)}</g>`
}

function browserChrome() {
  return `
    <rect x="84" y="92" width="1102" height="576" rx="24" fill="${PANEL}"/>
    <rect x="84" y="92" width="1102" height="58" rx="24" fill="#2D2D2D"/>
    <circle cx="122" cy="121" r="8" fill="#FF5F57"/>
    <circle cx="150" cy="121" r="8" fill="#FFBD2E"/>
    <circle cx="178" cy="121" r="8" fill="#28C840"/>
    <rect x="228" y="108" width="420" height="26" rx="13" fill="#171717"/>
    ${text(250, 127, 'launch-demo — Visual Studio Code', 14, 600, '#D6D3D1')}
  `
}

function sidebar(active = 'GitRescue') {
  return `
    <rect x="84" y="150" width="72" height="518" fill="#1F1F1F"/>
    <rect x="156" y="150" width="250" height="518" fill="#252526"/>
    <circle cx="120" cy="196" r="15" fill="${ORANGE}"/>
    <rect x="105" y="242" width="30" height="30" rx="7" fill="#3A3A3A"/>
    <rect x="105" y="294" width="30" height="30" rx="7" fill="#3A3A3A"/>
    ${text(184, 196, active.toUpperCase(), 15, 800, '#D6D3D1')}
    ${text(184, 242, 'Actions', 18, 800)}
    ${text(184, 284, 'Ask GitRescue', 16, 650, '#E7E5E4')}
    ${text(184, 320, 'Explain a git error', 16, 650, '#E7E5E4')}
    ${text(184, 356, 'Check repository now', 16, 650, '#E7E5E4')}
    ${text(184, 412, 'Status', 18, 800)}
  `
}

function terminal(lines) {
  return `
    <rect x="436" y="188" width="684" height="332" rx="12" fill="#101010"/>
    ${lines.map((line, i) => text(466, 234 + i * 34, line, 20, 600, line.startsWith('$') ? '#D6D3D1' : '#9CDCFE')).join('\n')}
  `
}

function toast(title, body, button = 'Do the safe fix') {
  return `
    <g transform="translate(558 548)">
      <rect width="526" height="92" rx="12" fill="#303030"/>
      <rect x="0" y="0" width="6" height="92" rx="3" fill="${ORANGE}"/>
      ${text(24, 34, title, 20, 800)}
      ${text(24, 62, body, 15, 600, '#D6D3D1')}
      <rect x="382" y="26" width="120" height="38" rx="6" fill="${ORANGE}"/>
      ${text(442, 51, button, 14, 800, TEXT, 'middle')}
    </g>`
}

function phFrame(title, subtitle, body) {
  return `
<svg width="1270" height="760" viewBox="0 0 1270 760" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1270" height="760" fill="${SOFT}"/>
  <rect x="42" y="42" width="1186" height="676" rx="34" fill="${INK}"/>
  <path d="M898 80C1016 118 1124 224 1175 350C1222 468 1196 606 1136 718H808C746 630 732 512 770 400C812 276 828 156 898 80Z" fill="${ORANGE}" opacity=".20"/>
  ${icon(116, 112, 130)}
  ${text(282, 184, 'GitRescue', 66, 850)}
  ${text(120, 348, title, 60, 850)}
  ${text(124, 414, subtitle, 32, 700, '#E7E5E4')}
  ${multiline(126, 502, body, 24, 600, MUTED, 38)}
</svg>`
}

function vscodeShot(kind) {
  const scenarios = {
    detection: {
      title: 'Auto-detects Git trouble',
      status: 'Detached HEAD detected',
      terminal: ['$ git checkout 4f82c91', 'You are in detached HEAD state.', '$ # GitRescue notices immediately'],
      toast: ['GitRescue: Detached HEAD', 'Create a branch so this work stays reachable.', 'Create branch']
    },
    explanation: {
      title: 'Explains what happened',
      status: 'Plain-English explanation',
      terminal: ['$ GitRescue: Explain a Git Error', 'fatal: refusing to merge unrelated histories', 'Meaning: these repos do not share a starting point.'],
      toast: ['GitRescue: Unrelated histories', 'What it means, why it happened, and what to try next.', 'View output']
    },
    safety: {
      title: 'Guards risky actions',
      status: 'Two-step destructive confirmation',
      terminal: ['$ GitRescue: Undo Last Commit', 'This maps to: git reset HEAD~1', 'Changes stay in your working directory.'],
      toast: ['Confirm destructive action', 'Step 2 shows the exact command before execution.', 'Execute']
    },
    ask: {
      title: 'Ask in plain English',
      status: 'Intent routed to audited handler',
      terminal: ['$ GitRescue: Ask', 'undo my last commit', 'Matched: h5-undo-last-commit'],
      toast: ['GitRescue matched your intent', 'It can only route to fixed handler IDs.', 'Continue']
    },
    sidebar: {
      title: 'A live rescue panel',
      status: 'No git problems detected',
      terminal: ['$ GitRescue: Check Repository Now', 'All clear.', 'Actions and status stay one click away.'],
      toast: ['GitRescue is watching', 'Sidebar shows actions and current repo status.', 'Open']
    }
  }[kind]

  return `
<svg width="1270" height="760" viewBox="0 0 1270 760" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1270" height="760" fill="${SOFT}"/>
  <rect x="42" y="42" width="1186" height="676" rx="34" fill="${INK}"/>
  ${text(84, 82, scenarios.title, 34, 850)}
  ${browserChrome()}
  ${sidebar()}
  ${text(184, 456, scenarios.status, 16, 650, '#E7E5E4')}
  ${terminal(scenarios.terminal)}
  ${toast(...scenarios.toast)}
</svg>`
}

function linkedinFrame(title, subtitle, bullets = []) {
  return `
<svg width="1200" height="1200" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="1200" fill="${INK}"/>
  <path d="M808 42C948 94 1074 230 1137 396C1196 552 1170 763 1088 1200H720C634 1036 604 846 656 668C722 444 726 188 808 42Z" fill="${ORANGE}" opacity=".18"/>
  ${icon(92, 92, 132)}
  ${text(256, 174, 'GitRescue', 64, 850)}
  ${multiline(96, 394, title, 70, 850, TEXT, 86)}
  ${text(100, 590, subtitle, 34, 650, '#E7E5E4')}
  ${bullets.map((b, i) => `${text(128, 720 + i * 70, '•', 34, 900, ORANGE)}${text(168, 720 + i * 70, b, 31, 700, '#D6D3D1')}`).join('\n')}
  ${pill(94, 1030, 'No AI-generated Git commands', 340, ORANGE)}
</svg>`
}

const assets = [
  ['product-hunt-01-hero', phFrame('Git without the panic.', 'Plain-English Git fixes for VS Code and Cursor.', ['Detects confusing repo states', 'Explains what happened', 'Offers fixed, audited next steps'])],
  ['product-hunt-02-detection', vscodeShot('detection')],
  ['product-hunt-03-explanation', vscodeShot('explanation')],
  ['product-hunt-04-safety', vscodeShot('safety')],
  ['product-hunt-05-ask', vscodeShot('ask')],
  ['product-hunt-06-sidebar', vscodeShot('sidebar')],
  ['linkedin-01-story', linkedinFrame(['Git errors should not', 'make beginners feel stupid.'], 'That is the story behind GitRescue.', ['I kept seeing the same Git panic states', 'The fix was not more magic', 'It was clearer, safer recovery paths'])],
  ['linkedin-02-safety', linkedinFrame(['I refused to let it', 'invent Git commands.'], 'Because a confident wrong command can destroy trust.', ['Fixed audited handlers', 'execFile, never shell interpolation', 'Two-step confirmation for risky actions'])],
  ['linkedin-03-launch', linkedinFrame(['GitRescue is live.'], 'A VS Code/Cursor extension for common Git rescue moments.', ['Detached HEAD', 'Merge conflicts and rebases', 'Pasted Git errors explained plainly'])],
  ['linkedin-04-feedback', linkedinFrame(['Sometimes trust', 'beats magic.'], 'The launch lesson I want to keep building around.', ['Show the repo state', 'Explain without jargon', 'Make the safe next step obvious'])]
]

const manifest = []
for (const [name, svg] of assets) {
  const svgPath = path.join(outDir, `${name}.svg`)
  const pngPath = path.join(outDir, `${name}.png`)
  fs.writeFileSync(svgPath, svg)
  execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', pngPath], { stdio: 'ignore' })
  manifest.push({ name, svg: `media/launch/${name}.svg`, png: `media/launch/${name}.png` })
  console.log(`wrote ${pngPath}`)
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${path.join(outDir, 'manifest.json')}`)
