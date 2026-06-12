import type { ConnectorThreadBinding } from '@cat-cafe/shared';

export function selectDeliveryBindings<T extends ConnectorThreadBinding>(bindings: readonly T[]): T[] {
  const imWebGroupBindings = bindings.filter(
    (binding) => binding.connectorId === 'im-web' && externalChatChannelType(binding.externalChatId) === '2',
  );
  if (imWebGroupBindings.length === 0) return [...bindings];
  return bindings.filter(
    (binding) => binding.connectorId !== 'im-web' || externalChatChannelType(binding.externalChatId) === '2',
  );
}

function externalChatChannelType(externalChatId: string): string {
  return String(externalChatId || '').split(':', 1)[0] ?? '';
}
