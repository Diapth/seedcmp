import { describe, expect, it } from 'vitest'

describe('clowder streaming merge contracts', () => {
  it('keeps Clowder stream merge keys and final cleanup in messageStore', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(source.default).toContain('clowder-stream-')
    expect(source.default).toContain('findMergeableLocalAiStream')
    expect(source.default).toContain('mergePersistedAiIntoLocal')
    expect(source.default).toContain('pruneDuplicateAiStreams')
  })
})
