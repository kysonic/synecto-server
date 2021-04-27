var winston = require('winston');
winston.emitErrs = true;

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: ['debug'],
            filename: __dirname+'/../logs/all-logs.log',
            handleExceptions: true,
            json: false,
            maxsize: 5242880,
            maxFiles: 5,
            colorize: true
        })
    ],
    exitOnError: false
});
module.exports = {debug:console.log};