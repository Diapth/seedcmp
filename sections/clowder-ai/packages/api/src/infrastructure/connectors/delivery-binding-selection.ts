import type { ConnectorThreadBinding } from '@cat-cafe/shared';

export interface DeliveryBindingSelectionContext {
  readonly catId?: string | undefined;
}

export function selectDeliveryBindings<T extends ConnectorThreadBinding>(
  bindings: readonly T[],
  context: DeliveryBindingSelectionContext = {},
): T[] {
  const imWebGroupBindings = bindings.filter(
    (binding) => binding.connectorId === 'im-web' && externalChatChannelType(binding.externalChatId) === '2',
  );
  if (imWebGroupBindings.length === 0) return [...bindings];
  if (isCoordinatorCat(context.catId)) {
    const imWebDirectBindings = bindings.filter(
      (binding) => binding.connectorId === 'im-web' && externalChatChannelType(binding.externalChatId) === '1',
    );
    if (imWebDirectBindings.length > 0) {
      return bindings.filter(
        (binding) => binding.connectorId !== 'im-web' || externalChatChannelType(binding.externalChatId) === '1',
      );
    }
  }
  return bindings.filter(
    (binding) => binding.connectorId !== 'im-web' || externalChatChannelType(binding.externalChatId) === '2',
  );
}

function externalChatChannelType(externalChatId: string): string {
  return String(externalChatId || '').split(':', 1)[0] ?? '';
}

function isCoordinatorCat(catId: string | undefined): boolean {
  const normalized = String(catId || '').trim().toLowerCase();
  return normalized === 'coordinator' || normalized === 'pm';
}
