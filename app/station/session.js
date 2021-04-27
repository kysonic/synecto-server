var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var config = require('../config');
var mongoose = require('../libs/db/mongoose');

module.exports = function(app){
    app.sessionMiddleware = session({
        secret: config.get('session:secret'),
        resave: true,
        saveUninitialized: true,
        store: new MongoStore({
            mongooseConnection: mongoose.connection
        })
    })
    app.use(app.sessionMiddleware);
}
