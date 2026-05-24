import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const uploadFile = vi.fn()
const getUploadUrl = vi.fn()
const send = vi.fn()
const newChannel = vi.fn((channelId: string, channelType: number) => ({ channelID: channelId, channelType }))

function normalizeMockMediaUrl(pathOrUrl: string, options: { baseUrl?: string; referenceUrl?: string } = {}) {
  const base = options.referenceUrl && /^https?:\/\//i.test(options.referenceUrl)
    ? options.referenceUrl.replace(/file\/upload.*$/, '')
    : (options.baseUrl || 'http://100.79.157.76:8090/v1/')
  return /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : new URL(pathOrUrl.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`).toString()
}

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    defaults: {
      baseURL: 'http://100.79.157.76:8090/v1/'
    },
    get: vi.fn(),
    post: vi.fn()
  },
  normalizeMediaUrl: vi.fn(normalizeMockMediaUrl),
  apiDelete: vi.fn(),
  StorageService: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn()
  }
}))

vi.mock('wukongimjssdk', () => {
  class MessageContent {
    encodeJSON() {
      return {}
    }
  }

  class MediaMessageContent extends MessageContent {
    file?: File
    extension = ''
    remoteUrl = ''
  }

  class MessageImage extends MediaMessageContent {
    width = 0
    height = 0
    remoteUrl = ''
    private _url = ''

    set url(value: string) {
      this._url = value
      this.remoteUrl = value
    }

    get url() {
      return this._url
    }

    get contentType() {
      return 2
    }

    encodeJSON() {
      return { width: this.width, height: this.height, url: this.remoteUrl || this.url }
    }
  }

  return {
    default: {
      shared: () => ({
        register: vi.fn(),
        getMessageContent: vi.fn(),
        newChannel,
        chatManager: { send }
      })
    },
    MessageContent,
    MediaMessageContent,
    MessageImage
  }
})

describe('message media sending', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    const api = await import('@tsdaodao/datasource-vue/api')
    vi.spyOn(api.commonApi, 'getUploadUrl').mockImplementation(getUploadUrl)
    vi.spyOn(api.commonApi, 'uploadFile').mockImplementation(uploadFile)
    vi.spyOn(api.commonApi, 'getChannelInfo').mockResolvedValue({
      channel_id: 'target',
      channel_type: 1,
      name: 'target',
      avatar: '',
      mute: 0,
      top: 0,
      save: 0
    })
  })

  it('uploads an image and sends a type 2 image message through the SDK', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'u1', name: 'Me' }

    const file = new File(['image-bytes'], 'hello world.png', { type: 'image/png' })
    getUploadUrl.mockResolvedValue({ url: 'http://api.example/file/upload?type=chat&path=/1/target/image.png' })
    uploadFile.mockResolvedValue({ path: 'file/preview/chat/1/target/image.png' })
    send.mockResolvedValue({
      messageID: 'm-image',
      messageSeq: 2,
      clientMsgNo: 'c-image',
      fromUID: 'u1',
      timestamp: 100,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: undefined
    })

    const store = useMessageStore()
    await store.sendMediaMessage('target', 1, file)

    expect(getUploadUrl).toHaveBeenCalledWith(expect.stringMatching(/^\/1\/target\/.+\.png$/), 'chat')
    const formData = uploadFile.mock.calls[0][1] as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('contenttype')).toBe('image/png')
    const sentContent = send.mock.calls[0][0]
    expect(sentContent.contentType).toBe(2)
    expect(sentContent.encodeJSON()).toEqual({
      width: 0,
      height: 0,
      url: 'http://api.example/file/preview/chat/1/target/image.png'
    })
    expect(newChannel).toHaveBeenCalledWith('target', 1)
  })

  it('uploads a regular file and sends a type 8 file message through the SDK', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'u1', name: 'Me' }

    const file = new File(['document'], 'report.pdf', { type: 'application/pdf' })
    getUploadUrl.mockResolvedValue({ url: 'file/upload?type=chat&path=/1/target/report.pdf' })
    uploadFile.mockResolvedValue({ path: 'file/preview/chat/1/target/report.pdf' })
    send.mockResolvedValue({
      messageID: 'm-file',
      messageSeq: 3,
      clientMsgNo: 'c-file',
      fromUID: 'u1',
      timestamp: 200,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: undefined
    })

    const store = useMessageStore()
    await store.sendMediaMessage('target', 1, file)

    const sentContent = send.mock.calls[0][0]
    expect(sentContent.contentType).toBe(8)
    expect(sentContent.encodeJSON()).toEqual({
      url: 'http://100.79.157.76:8090/v1/file/preview/chat/1/target/report.pdf',
      name: 'report.pdf',
      size: file.size
    })
  })

  it('keeps the local file card when the SDK echoes a filename text payload', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'u1', name: 'Me' }

    const file = new File(['document'], 'report.pdf', { type: 'application/pdf' })
    getUploadUrl.mockResolvedValue({ url: 'file/upload?type=chat&path=/1/target/report.pdf' })
    uploadFile.mockResolvedValue({ path: 'file/preview/chat/1/target/report.pdf' })
    send.mockResolvedValue({
      messageID: 'm-file',
      messageSeq: 3,
      clientMsgNo: 'c-file',
      fromUID: 'u1',
      timestamp: 200,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: {
        type: 1,
        content: 'report.pdf'
      }
    })

    const store = useMessageStore()
    await store.sendMediaMessage('target', 1, file)

    const list = store.getChannelMessages('target', 1)
    expect(list).toHaveLength(1)
    expect(list[0].content).toMatchObject({
      type: 8,
      name: 'report.pdf',
      size: file.size
    })
  })

  it('marks failed media uploads as retryable local messages', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'u1', name: 'Me' }

    const file = new File(['broken'], 'broken.png', { type: 'image/png' })
    getUploadUrl.mockRejectedValue(new Error('upload unavailable'))

    const store = useMessageStore()
    await expect(store.sendMediaMessage('target', 1, file)).rejects.toThrow('upload unavailable')

    const list = store.getChannelMessages('target', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      status: 'fail',
      retryable: true,
      content: {
        type: 2,
        name: 'broken.png',
        unavailable: true
      }
    })
  })
})
