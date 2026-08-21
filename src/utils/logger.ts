import winston from 'winston';
import { env } from '../config/env';

const format =
  env.isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${extras}`;
        })
      );

export const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format,
  transports: [new winston.transports.Console()],
});
