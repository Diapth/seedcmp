import type { IConnectorPermissionStore } from './ConnectorPermissionStore.js';

export interface ImWebPermissionSnapshot {
  readonly connectorId: 'im-web';
  readonly externalChatId: string;
  readonly whitelistEnabled: boolean;
  readonly allowed: boolean;
  readonly adminOnlyCommands: boolean;
  readonly adminSenderIds: readonly string[];
  readonly disabledReason?: 'group_not_allowed' | 'command_admin_only';
}

export interface ImWebCommandPermissionInput {
  readonly senderId?: string;
  readonly command: string;
}

const ADMIN_COMMANDS = new Set(['/allow-group', '/deny-group']);

export class ImWebPermissionPolicy {
  readonly connectorId = 'im-web' as const;

  constructor(private readonly store: IConnectorPermissionStore) {}

  async evaluateGroup(
    externalChatId: string,
    _input: { senderId?: string } = {},
  ): Promise<ImWebPermissionSnapshot> {
    const whitelistEnabled = await this.store.isWhitelistEnabled(this.connectorId);
    const allowed = await this.store.isGroupAllowed(this.connectorId, externalChatId);
    const adminOnlyCommands = await this.store.isCommandAdminOnly(this.connectorId);
    const adminSenderIds = await this.store.getAdminOpenIds(this.connectorId);
    return {
      connectorId: this.connectorId,
      externalChatId,
      whitelistEnabled,
      allowed,
      adminOnlyCommands,
      adminSenderIds,
      disabledReason: allowed ? undefined : 'group_not_allowed',
    };
  }

  async canRunCommand(input: ImWebCommandPermissionInput): Promise<boolean> {
    const commandName = input.command.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
    if (!commandName.startsWith('/')) return true;
    const adminOnly = await this.store.isCommandAdminOnly(this.connectorId);
    if (!adminOnly && !ADMIN_COMMANDS.has(commandName)) return true;
    if (!input.senderId) return false;
    return this.store.isAdmin(this.connectorId, input.senderId);
  }
}
