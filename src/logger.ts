import * as fs from 'fs';
import * as path from 'path';

// Check if running in MCP mode (with --stdio argument)
const isMcpMode = process.argv.includes('--stdio');

// Create logs directory if it doesn't exist and configure log file
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir) && !isMcpMode) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file path
const timestamp = new Date().toISOString().replace(/:/g, '-');
const logFile = !isMcpMode ? path.join(logsDir, `mcp-server-${timestamp}.log`) : '';

// In MCP mode, completely disable all logging to avoid breaking the JSON-RPC protocol
export const logger = {
    info: (...args: any[]) => {
        if (!isMcpMode) {
            console.log(`[INFO] ${args.join(' ')}`);
        }
    },
    warn: (...args: any[]) => {
        if (!isMcpMode) {
            console.warn(`[WARN] ${args.join(' ')}`);
        }
    },
    error: (...args: any[]) => {
        if (!isMcpMode) {
            console.error(`[ERROR] ${args.join(' ')}`);
        }
    },
    debug: (...args: any[]) => {
        if (!isMcpMode && process.env.LOG_LEVEL === 'debug') {
            console.debug(`[DEBUG] ${args.join(' ')}`);
        }
    }
};

// Log startup mode - but only in non-MCP mode
if (!isMcpMode) {
    logger.info(`Logger initialized in standard mode`);
}

// Disable error handling in MCP mode to avoid any console output
if (!isMcpMode) {
    // For standard mode only
    process.on('uncaughtException', (err) => {
        logger.error(`Uncaught exception: ${err.message}\n${err.stack}`);
    });
}