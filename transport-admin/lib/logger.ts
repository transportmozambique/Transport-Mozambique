/**
 * Registo centralizado do painel de administração: controla a quantidade de mensagens em toda a
 * aplicação (detalhe em desenvolvimento, só erros em produção).
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL: LogLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'error';

const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const shouldLog = (level: LogLevel): boolean => {
  return levels[level] <= levels[LOG_LEVEL];
};

export const logger = {
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  },
};

// Diz se se está em modo de desenvolvimento
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
