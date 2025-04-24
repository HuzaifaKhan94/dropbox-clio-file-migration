// utils/logger.js
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

// Define the file transport with daily rotation
const fileRotateTransport = new transports.DailyRotateFile({
  dirname: 'logs',                   // folder to write logs
  filename: 'migration-%DATE%.log',  // file pattern
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',                   // keep logs for 14 days
  level: 'info'
});

// Create the logger
const logger = createLogger({
    level: 'info',
    format: format.combine(
      format.errors({ stack: true }),                 // ← here
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // If there’s a stack (because you logged an Error), print it
        const errorPart = stack ? `\n${stack}` : '';
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}${errorPart}`;
      })
    ),
    transports: [
      new transports.Console({ level: 'debug' }),
      new transports.DailyRotateFile({
        dirname: 'logs',
        filename: 'migration-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info'
      })
    ],
    exitOnError: false
});

module.exports = logger;
