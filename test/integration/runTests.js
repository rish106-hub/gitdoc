const path = require('path')
const { runTests } = require('@vscode/test-electron')

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../')
  const extensionTestsPath = path.resolve(__dirname, './suite/index')

  await runTests({ extensionDevelopmentPath, extensionTestsPath })
}

main().catch(err => {
  console.error('Integration test runner failed:', err)
  process.exit(1)
})
