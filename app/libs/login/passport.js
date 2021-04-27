/**
 * Here will be placed common function for passport.
 */
var passport = require('passport');
var User = require('../../models/user').User;

/**
 * Serialize user for the session
 */
passport.serializeUser(function(user, done) {
    done(null, user.id);
});
/**
 * Deserialize user. Get all their data.
 */
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

module.exports = passport;
