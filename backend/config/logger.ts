import { createLogger, format, transports } from 'winston';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: isProd
        ? format.json()
        : format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message}${extras}`;
            })
          ),
    }),
  ],
});

if (isProd) {
  logger.add(new transports.File({
    filename: path.join('/app/logs', 'app.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 7,
    tailable: true,
  }));
}

// Stream for Morgan HTTP logging
(logger as any).stream = {
  write: (message: any) => logger.http(message.trim()),
};

export = logger;
