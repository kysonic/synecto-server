var passport = require('../libs/login/passport');
module.exports = function (app) {
    app.use(passport.initialize());
    app.use(passport.session());
}