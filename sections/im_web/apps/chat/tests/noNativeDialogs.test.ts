import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const files = [
  '../src/components/MessageList.vue',
  '../src/views/GroupMemberList.vue',
  '../../../packages/base-vue/src/components/GroupSettingsDrawer.vue'
]

describe('component modal contract', () => {
  it('does not use browser-native alert, confirm, or prompt dialogs in user flows', () => {
    for (const file of files) {
      const source = readFileSync(resolve(__dirname, file), 'utf8')
      expect(source, file).not.toMatch(/window\.(alert|confirm|prompt)\s*\(/)
      expect(source, file).not.toMatch(/\b(alert|confirm|prompt)\s*\(/)
    }
  })
})
