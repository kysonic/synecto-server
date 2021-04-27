
var express = require('express');
var path = require('path');
var EventEmitter = require('events');
var app = express();
/**
 * App global configuration
 */
require('./app/bootstrap')(app);
/**npm asdadnpm
 * Configuration
 */
require('./app/libs/login/passport-local-strategy');
/**
 * Stations (Is a grouped middleware)
 */
require('./app/station/statics')(app);
//require('./app/station/domainErrorHandler')(app);
require('./app/station/log')(app);
require('./app/station/parser')(app);
require('./app/station/session')(app);
require('./app/station/passport')(app);
require('./app/station/acl')(app);
require('./app/station/qa')(app);
require('./app/station/routes')(app);
require('./app/station/error')(app);


module.exports = app;
