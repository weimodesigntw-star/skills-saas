/**
 * Unified Logger
 *
 * 統一日誌工具 — 根據環境自動控制日誌輸出層級
 *
 * - production：只輸出 warn 和 error
 * - development：輸出所有層級（debug, info, warn, error）
 *
 * 使用方式：
 *   import { logger } from '@/lib/logger';
 *   logger.info('[Module]', 'message', { extra: 'data' });
 *   logger.error('[Module]', 'something failed', error);
 */

const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return { message: arg.message, stack: arg.stack };
    }
    return arg;
  });
}

function log(level: LogLevel, ...args: unknown[]) {
  // 在生產環境中，只輸出 warn 和 error
  if (isProduction && (level === 'debug' || level === 'info')) {
    return;
  }

  const formatted = formatArgs(args);
  const timestamp = new Date().toISOString();

  switch (level) {
    case 'debug':
      console.debug(`[${timestamp}]`, ...formatted);
      break;
    case 'info':
      console.log(`[${timestamp}]`, ...formatted);
      break;
    case 'warn':
      console.warn(`[${timestamp}]`, ...formatted);
      break;
    case 'error':
      console.error(`[${timestamp}]`, ...formatted);
      break;
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
