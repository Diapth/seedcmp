export type LocalPreviewFailureReason =
  | 'port_binding_forbidden'
  | 'port_in_use'
  | 'command_failed'
  | 'timeout'
  | 'route_unreachable'
  | 'unknown';

export type LocalPreviewNotAttemptedReason =
  | 'environment_forbids_ports'
  | 'no_start_script'
  | 'not_needed'
  | 'unknown';

export type LocalPreviewStatus =
  | {
      status: 'started';
      url: string;
      host: string;
      port: number;
      route?: string;
      pid?: number;
    }
  | {
      status: 'failed';
      attemptedUrl: string;
      host: string;
      port: number;
      route?: string;
      reason: LocalPreviewFailureReason;
      error: string;
      command?: string;
      cwd?: string;
      sourcePath?: string;
    }
  | {
      status: 'not_attempted';
      reason: LocalPreviewNotAttemptedReason;
      attemptedUrl?: string;
      route?: string;
      command?: string;
      cwd?: string;
      sourcePath?: string;
    };

export interface LocalPreviewAttemptInput {
  host?: string;
  port?: number;
  route?: string;
  pid?: number;
  command?: string;
  cwd?: string;
  sourcePath?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
  healthCheckOk?: boolean;
  healthCheckError?: string;
  notAttemptedReason?: LocalPreviewNotAttemptedReason;
}

function normalizeHost(value?: string) {
  const host = String(value || '').trim();
  return host || '127.0.0.1';
}

function normalizeRoute(value?: string) {
  const route = String(value || '').trim();
  if (!route) return '';
  return route.startsWith('/') ? route : `/${route}`;
}

function attemptedUrl(host: string, port?: number, route?: string) {
  const safePort = Number.isFinite(port) && Number(port) > 0 ? Number(port) : 0;
  const path = normalizeRoute(route);
  return `http://${host}${safePort ? `:${safePort}` : ''}${path}`;
}

function combinedOutput(input: LocalPreviewAttemptInput) {
  return [input.stderr, input.stdout, input.healthCheckError].filter(Boolean).join('\n');
}

export function classifyLocalPreviewFailure(output: string, input: Pick<LocalPreviewAttemptInput, 'timedOut' | 'exitCode'> = {}): LocalPreviewFailureReason {
  if (input.timedOut) return 'timeout';
  if (/\blisten\s+EPERM\b|EACCES.*listen|permission denied.*listen/i.test(output)) return 'port_binding_forbidden';
  if (/\bEADDRINUSE\b|address already in use/i.test(output)) return 'port_in_use';
  if (/health check|ECONNREFUSED|ENOTFOUND|404|route.*not.*found|not reachable/i.test(output)) return 'route_unreachable';
  if (typeof input.exitCode === 'number' && input.exitCode !== 0) return 'command_failed';
  return 'unknown';
}

export function classifyLocalPreviewAttempt(input: LocalPreviewAttemptInput): LocalPreviewStatus {
  const host = normalizeHost(input.host);
  const port = Number(input.port || 0);
  const route = normalizeRoute(input.route);
  const url = attemptedUrl(host, port, route);

  if (input.notAttemptedReason) {
    return {
      status: 'not_attempted',
      reason: input.notAttemptedReason,
      attemptedUrl: url,
      ...(route ? { route } : {}),
      ...(input.command ? { command: input.command } : {}),
      ...(input.cwd ? { cwd: input.cwd } : {}),
      ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
    };
  }

  if (input.healthCheckOk === true && port > 0) {
    return {
      status: 'started',
      url,
      host,
      port,
      ...(route ? { route } : {}),
      ...(input.pid ? { pid: input.pid } : {}),
    };
  }

  const output = combinedOutput(input);
  const reason = classifyLocalPreviewFailure(output, input);
  const error = output.trim() || 'Preview process was not verified reachable; no working URL was produced.';
  return {
    status: 'failed',
    attemptedUrl: url,
    host,
    port,
    ...(route ? { route } : {}),
    reason,
    error,
    ...(input.command ? { command: input.command } : {}),
    ...(input.cwd ? { cwd: input.cwd } : {}),
    ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
  };
}

export function formatLocalPreviewHandoff(status: LocalPreviewStatus): string {
  if (status.status === 'started') {
    return `本地预览已启动：${status.url}${status.route ? `\nRoute: ${status.route}` : ''}`;
  }
  const lines = status.status === 'failed'
    ? [
        `本地预览不可用：我尝试启动 ${status.attemptedUrl}，但没有得到可访问服务。`,
        `原因：${status.reason}`,
        `错误：${status.error}`,
      ]
    : [
        `本地预览未启动：${status.reason}`,
        status.attemptedUrl ? `尝试地址：${status.attemptedUrl}` : '',
      ];
  if ('route' in status && status.route) lines.push(`Route: ${status.route}`);
  if ('sourcePath' in status && status.sourcePath) lines.push(`源码路径：${status.sourcePath}`);
  if ('cwd' in status && status.cwd) lines.push(`cwd：${status.cwd}`);
  if ('command' in status && status.command) lines.push(`命令：${status.command}`);
  return lines.filter(Boolean).join('\n');
}
