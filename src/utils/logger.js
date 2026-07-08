const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

//Beautiful colored logs for development
const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss'}),
    printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
    })
);

const logger = winston.createLogger({
    level: 'info',
    //Use JSON format in production for log aggregators, pretty format in dev
    format: process.env.NODE_ENV === 'production' ? winston.format.json() : devFormat,
    transports: [
        new winston.transports.Console(),
    ],
});

module.exports = logger;