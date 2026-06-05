import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import CardCell from '../../../packages/base-vue/src/components/messages/CardCell.vue'
import { detectDeploymentIntent } from '../src/utils/deploymentIntent'

describe('deployment confirmation card', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders deployment intent as an editable request card', async () => {
    const view = render(CardCell, {
      props: {
        isMe: false,
        message: {
          content: {
            type: 7,
            cardType: 'deployment',
            title: '确认部署',
            target: '待确认目标',
            environment: '待确认环境',
            status: 'needs_fields',
            missingFields: ['target', 'environment'],
            targetCandidates: [
              { id: 'workspace', label: '婚礼', value: '婚礼', source: 'active_workspace' }
            ],
            environmentCandidates: [
              { id: 'local', label: '本地', value: 'local' }
            ]
          }
        }
      }
    })

    expect(screen.getByText('确认部署')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('输入部署目标')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '本地' })).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '本地' }))
    expect(view.emitted('deployment-field-update')?.[0]?.[0]).toMatchObject({
      field: 'environment',
      value: 'local'
    })

    await fireEvent.click(screen.getByRole('button', { name: '婚礼' }))
    expect(view.emitted('deployment-field-update')?.[1]?.[0]).toMatchObject({
      field: 'target',
      value: '婚礼'
    })
  })

  it('detects deployment requests without treating every release discussion as confirmed deployment', () => {
    expect(detectDeploymentIntent('部署婚礼，环境是本地')).toMatchObject({
      shouldConfirm: true,
      target: '婚礼',
      environment: 'local',
      missingFields: [],
      reason: 'new_deployment_request'
    })
    expect(detectDeploymentIntent('把婚礼部署到本地')).toMatchObject({
      shouldConfirm: true,
      target: '婚礼',
      environment: 'local',
      missingFields: []
    })
    expect(detectDeploymentIntent('你来部署吧，给我网页', { hasActiveRequest: true })).toMatchObject({
      shouldConfirm: true,
      target: '网页',
      reason: 'deployment_field_update'
    })
    expect(detectDeploymentIntent('好的', { hasActiveRequest: true })).toMatchObject({
      shouldConfirm: false
    })
    expect(detectDeploymentIntent('猫猫，请部署到生产环境')).toMatchObject({
      shouldConfirm: true,
      environment: 'production'
    })
    expect(detectDeploymentIntent('deploy cat-cafe-web to staging')).toMatchObject({
      shouldConfirm: true,
      environment: 'staging',
      missingFields: []
    })
    expect(detectDeploymentIntent('帮我部署')).toMatchObject({
      shouldConfirm: true,
      target: '待确认目标',
      environment: '待确认环境',
      missingFields: ['target', 'environment']
    })
    expect(detectDeploymentIntent('给我生成预览链接')).toMatchObject({
      shouldConfirm: true,
      target: '待确认目标',
      environment: 'preview',
      missingFields: ['target']
    })
    expect(detectDeploymentIntent('打包源码 packages/site/index.html')).toMatchObject({
      shouldConfirm: true
    })
    expect(detectDeploymentIntent('我们讨论一下发布计划，不要现在执行')).toMatchObject({
      shouldConfirm: false
    })
  })

  it('renders deployment result controls and retry actions', async () => {
    const view = render(CardCell, {
      props: {
        isMe: false,
        message: {
          content: {
            type: 7,
            cardType: 'deployment',
            title: '确认部署',
            target: '活动页',
            environment: 'preview',
            status: 'failed',
            previewUrl: '/api/deployments/deploy-1/preview/',
            downloadUrl: '/api/deployments/deploy-1/download',
            logsSummary: ['Deployment job queued', 'Static preview generated'],
            failureReason: 'Source package failed'
          }
        }
      }
    })

    expect(screen.getByRole('button', { name: '打开预览' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载源码包' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(screen.getByText('Static preview generated')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '打开预览' }))
    await fireEvent.click(screen.getByRole('button', { name: '下载源码包' }))
    await fireEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(view.emitted('action')?.map(([payload]) => payload.action)).toEqual([
      'open-preview',
      'download',
      'retry'
    ])
  })

  it('keeps underspecified deployment cards from accidental confirmation', async () => {
    const emitted = render(CardCell, {
      props: {
        isMe: false,
        message: {
          content: {
            type: 7,
            cardType: 'deployment',
            title: '确认部署',
            target: '待确认目标',
            environment: '待确认环境',
            status: 'needs_fields',
            missingFields: ['target', 'environment']
          }
        }
      }
    })

    const confirm = screen.getByRole('button', { name: /确认部署/ })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/请先补充部署目标、部署环境/)).toBeInTheDocument()
    await fireEvent.click(confirm)
    expect(emitted.emitted('action')).toBeUndefined()

    await fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(emitted.emitted('action')?.[0]?.[0]).toMatchObject({ action: 'cancel' })
  })

  it('wires deployment intent through the input and confirmation card action path', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')

    expect(input.default).toContain('detectDeploymentIntent')
    expect(input.default).toContain('createDeploymentRequest')
    expect(input.default).toContain('updateDeploymentRequestFields')
    expect(input.default).toContain('loadActiveDeploymentRequest')
    expect(input.default).toContain('addDeploymentConfirmationCard')
    expect(input.default).toContain('buildDeploymentRequestCreatePayload')
    expect(input.default).toContain('buildDeploymentRequestUpdatePayload')
    expect(input.default).toContain('buildRecentDeploymentTargetCandidates')
    expect(input.default).toContain('shouldRouteDeploymentPromptToClowder')
    expect(list.default).toContain('handleDeploymentCardAction')
    expect(list.default).toContain('handleDeploymentFieldUpdate')
    expect(list.default).toContain('upsertDeploymentCardFromRequest')
    expect(list.default).toContain('clowderStore.sendDeploymentAction')
    expect(list.default).toContain('loadActiveDeploymentRequest')
    expect(list.default).toContain('loadDeploymentRequest')
    expect(list.default).toContain('startDeploymentPolling')
  })

  it('guards back-to-back target and environment edits against stale card state', async () => {
    const list = await import('../src/components/MessageList.vue?raw')

    expect(list.default).toContain('deploymentFieldQueues')
    expect(list.default).toContain('enqueueDeploymentFieldUpdate')
    expect(list.default).toContain('findDeploymentCardMessage(deploymentRequestId) || msg')
    expect(list.default).toContain("payload.field === 'target' ? fieldValue : existingTarget")
    expect(list.default).toContain("payload.field === 'environment' ? fieldValue : existingEnvironment")
  })

  it('adds a coordinator deployment result summary when polling reaches a terminal state', async () => {
    const list = await import('../src/components/MessageList.vue?raw')

    expect(list.default).toContain('deploymentResultSummaryKeys')
    expect(list.default).toContain('addDeploymentResultSummaryMessage')
    expect(list.default).toContain('Coordinator / Deployment 结果汇总')
    expect(list.default).toContain("connector: 'deployment-result'")
    expect(list.default).toContain('addDeploymentResultSummaryMessage(msg, deploymentRequest)')
  })
})
