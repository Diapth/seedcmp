import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import CardCell from '../../../packages/base-vue/src/components/messages/CardCell.vue'
import { detectDeploymentIntent } from '../src/utils/deploymentIntent'

describe('deployment confirmation card', () => {
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
      environment: 'staging'
    })
    expect(detectDeploymentIntent('我们讨论一下发布计划，不要现在执行')).toMatchObject({
      shouldConfirm: false
    })
  })

  it('wires deployment intent through the input and confirmation card action path', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')

    expect(input.default).toContain('detectDeploymentIntent')
    expect(input.default).toContain('addDeploymentConfirmationCard')
    expect(input.default).toContain('needsDeploymentConfirmation')
    expect(list.default).toContain('handleDeploymentCardAction')
    expect(list.default).toContain('clowderStore.sendConversationMessage')
  })
})
