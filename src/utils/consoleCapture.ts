/**
 * Console Log Capture Utility
 * Captures console messages for bug reporting
 */

export interface ConsoleLogEntry {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

const MAX_LOGS = 100;
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /secret/i,
  /authorization/i,
  /bearer/i,
];

class ConsoleCapture {
  private logs: ConsoleLogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    // Override console methods
    this.interceptConsole();
  }

  private interceptConsole() {
    const self = this;

    console.log = function (...args: unknown[]) {
      self.captureLog('log', args);
      self.originalConsole.log(...args);
    };

    console.info = function (...args: unknown[]) {
      self.captureLog('info', args);
      self.originalConsole.info(...args);
    };

    console.warn = function (...args: unknown[]) {
      self.captureLog('warn', args);
      self.originalConsole.warn(...args);
    };

    console.error = function (...args: unknown[]) {
      self.captureLog('error', args);
      self.originalConsole.error(...args);
    };

    console.debug = function (...args: unknown[]) {
      self.captureLog('debug', args);
      self.originalConsole.debug(...args);
    };
  }

  private captureLog(type: ConsoleLogEntry['type'], args: unknown[]) {
    try {
      // Convert arguments to string
      const message = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');

      // Filter sensitive data
      if (this.containsSensitiveData(message)) {
        return; // Don't capture sensitive logs
      }

      // Add to logs array
      const entry: ConsoleLogEntry = {
        type,
        message: message.substring(0, 500), // Limit message length
        timestamp: new Date().toISOString(),
      };

      this.logs.push(entry);

      // Keep only the last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs.shift();
      }
    } catch (error) {
      // Fail silently to avoid infinite loops
      this.originalConsole.error('Console capture error:', error);
    }
  }

  private containsSensitiveData(message: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
  }

  public getLogs(): ConsoleLogEntry[] {
    return [...this.logs];
  }

  public getRecentLogs(count: number = 50): ConsoleLogEntry[] {
    return this.logs.slice(-count);
  }

  public clearLogs() {
    this.logs = [];
  }

  public restore() {
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
  }
}

// Create singleton instance
let captureInstance: ConsoleCapture | null = null;

export function initConsoleCapture(): ConsoleCapture {
  if (!captureInstance) {
    captureInstance = new ConsoleCapture();
  }
  return captureInstance;
}

export function getConsoleCapture(): ConsoleCapture | null {
  return captureInstance;
}

export function getConsoleLogs(): ConsoleLogEntry[] {
  return captureInstance ? captureInstance.getLogs() : [];
}

export function getRecentConsoleLogs(count: number = 50): ConsoleLogEntry[] {
  return captureInstance ? captureInstance.getRecentLogs(count) : [];
}
