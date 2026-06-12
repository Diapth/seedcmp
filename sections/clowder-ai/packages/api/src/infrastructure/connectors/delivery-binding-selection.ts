import { catRegistry, type ConnectorThreadBinding } from '@cat-cafe/shared';

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
  if (normalized === 'coordinator' || normalized === 'pm') return true;
  const config = catId ? catRegistry.tryGet(catId)?.config : undefined;
  const identityText = [config?.name, config?.displayName, config?.nickname].filter(Boolean).join(' ');
  if (/(协调者|\bPM\b|orchestrator|coordinator)/i.test(identityText)) return true;
  const responsibilityText = [config?.roleDescription, config?.teamStrengths, config?.personality]
    .filter(Boolean)
    .join(' ');
  return /(显性\s*PM|交付聚合|结果合成|任务拆分|并行调度|多\s*Agent\s*调度|需求澄清)/i.test(
    responsibilityText,
  );
}
