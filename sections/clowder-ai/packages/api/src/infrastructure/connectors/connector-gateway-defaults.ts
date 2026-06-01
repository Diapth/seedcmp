import { createCatId, type CatId } from '@cat-cafe/shared';

export function resolveConnectorGatewayDefaultCatId(defaultCatId: CatId | string | null | undefined): CatId {
  return createCatId(defaultCatId || 'opus');
}
