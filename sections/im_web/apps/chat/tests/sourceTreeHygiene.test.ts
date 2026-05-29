import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('source tree hygiene', () => {
  it('does not track generated Vue sidecar artifacts', () => {
    const repoRoot = execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8'
    }).trim()
    const output = execSync(
      "git ls-files 'sections/im_web/**/*.vue.js' 'sections/im_web/**/*.vue__VLS_*.vue.js'",
      { cwd: repoRoot, encoding: 'utf8' }
    )
    const trackedSidecars = output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    expect(trackedSidecars).toEqual([])
  })
})
