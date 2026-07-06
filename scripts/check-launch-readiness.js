const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const requiredFiles = [
  'README.md',
  'docs/launch-gtm.md',
  'docs/launch-checklist.md',
  'docs/linkedin-cadence.md',
  'docs/product-hunt-listing.md',
  'media/icon.png',
  'media/png/gitrescue-product-hunt-card.png',
  'media/launch/product-hunt-01-hero.png',
  'media/launch/product-hunt-02-detection.png',
  'media/launch/product-hunt-03-explanation.png',
  'media/launch/product-hunt-04-safety.png',
  'media/launch/product-hunt-05-ask.png',
  'media/launch/product-hunt-06-sidebar.png',
  'media/launch/linkedin-01-story.png',
  'media/launch/linkedin-02-safety.png',
  'media/launch/linkedin-03-launch.png',
  'media/launch/linkedin-04-feedback.png',
  'media/launch/manifest.json',
  'scripts/setup-launch-demo-repo.sh',
]

function ok(message) {
  console.log(`ok  ${message}`)
}

function fail(message) {
  console.error(`ERR ${message}`)
  process.exitCode = 1
}

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim()
}

for (const file of requiredFiles) {
  if (fs.existsSync(path.join(root, file))) ok(`exists ${file}`)
  else fail(`missing ${file}`)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (pkg.publisher === 'rish106-hub' && pkg.name === 'git-rescue') ok('Marketplace ID remains rish106-hub.git-rescue')
else fail(`unexpected Marketplace ID ${pkg.publisher}.${pkg.name}`)

if (pkg.displayName === 'GitRescue') ok('displayName is GitRescue')
else fail(`displayName is ${pkg.displayName}`)

if (pkg.icon === 'media/icon.png') ok('Marketplace icon points to media/icon.png')
else fail(`unexpected icon path ${pkg.icon}`)

const dimensionExpectations = [
  ['media/launch/product-hunt-01-hero.png', 1270, 760],
  ['media/launch/product-hunt-02-detection.png', 1270, 760],
  ['media/launch/product-hunt-03-explanation.png', 1270, 760],
  ['media/launch/product-hunt-04-safety.png', 1270, 760],
  ['media/launch/product-hunt-05-ask.png', 1270, 760],
  ['media/launch/product-hunt-06-sidebar.png', 1270, 760],
  ['media/launch/linkedin-01-story.png', 1200, 1200],
  ['media/launch/linkedin-02-safety.png', 1200, 1200],
  ['media/launch/linkedin-03-launch.png', 1200, 1200],
  ['media/launch/linkedin-04-feedback.png', 1200, 1200],
]

for (const [file, width, height] of dimensionExpectations) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file])
  const actualWidth = Number(out.match(/pixelWidth: (\d+)/)?.[1])
  const actualHeight = Number(out.match(/pixelHeight: (\d+)/)?.[1])
  if (actualWidth === width && actualHeight === height) ok(`${file} is ${width}x${height}`)
  else fail(`${file} is ${actualWidth}x${actualHeight}, expected ${width}x${height}`)
}

try {
  const repo = JSON.parse(run('gh', ['repo', 'view', 'rish106-hub/gitdoc', '--json', 'isPrivate,visibility,homepageUrl,description']))
  if (repo.isPrivate) ok('GitHub repo is private')
  else fail('GitHub repo is not private')
  if ((repo.homepageUrl || '').includes('marketplace.visualstudio.com/items?itemName=rish106-hub.git-rescue')) ok('GitHub repo homepage points to Marketplace')
  else fail(`unexpected GitHub homepage ${repo.homepageUrl}`)
} catch (error) {
  fail(`could not verify GitHub repo via gh: ${error.message}`)
}

try {
  const response = run('curl', [
    '-sS',
    '-H', 'Content-Type: application/json',
    '-H', 'Accept: application/json;api-version=7.2-preview.1',
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
    '-d',
    '{"filters":[{"criteria":[{"filterType":7,"value":"rish106-hub.git-rescue"}]}],"flags":914}',
  ])
  const marketplace = JSON.parse(response)
  const extension = marketplace.results?.[0]?.extensions?.[0]
  if (extension?.displayName === 'GitRescue') ok('Marketplace displayName is GitRescue')
  else fail(`unexpected Marketplace displayName ${extension?.displayName}`)
} catch (error) {
  fail(`could not verify Marketplace API: ${error.message}`)
}

if (process.exitCode) process.exit(process.exitCode)
