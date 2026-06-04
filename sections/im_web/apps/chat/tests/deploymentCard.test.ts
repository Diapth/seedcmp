import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import CardCell from '../../../packages/base-vue/src/components/messages/CardCell.vue'
import { detectDeploymentIntent } from '../src/utils/deploymentIntent'

describe('deployment confirmation card', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders deployment intent as an explicit confirmable card', () => {
    render(CardCell, {
      props: {
        isMe: false,
        message: {
          content: {
            type: 7,
            cardType: 'deployment',
            title: '确认部署',
            target: 'cat-cafe-web',
            environment: 'production',
            status: 'pending_confirmation'
          }
        }
      }
    })

    expect(screen.getByText('确认部署')).toBeInTheDocument()
    expect(screen.getByText('cat-cafe-web')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认部署' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('detects deployment requests without treating every release discussion as confirmed deployment', () => {
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
    expect(detectDeploymentIntent('我们讨论一下发布计划，不要现在执行')).toMatchObject({
      shouldConfirm: false
    })
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
    expect(input.default).toContain('addDeploymentConfirmationCard')
    expect(input.default).toContain('needsDeploymentConfirmation')
    expect(input.default).toContain('deploymentRequestId')
    expect(list.default).toContain('handleDeploymentCardAction')
    expect(list.default).toContain('clowderStore.sendDeploymentAction')
    expect(list.default).toContain('deploymentRequestId')
  })
})
