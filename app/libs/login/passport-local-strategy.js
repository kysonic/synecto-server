var passport = require('./passport');
var User = require('../../models/user').User;
var ApproveToken = require('../../models/approveToken').ApproveToken;
var LocalStrategy = require('passport-local').Strategy;
var mailer = require('../helpers/mailer');
var config = require('../../config');
var path = require('path');
/**
 * Error Spec
 * type: authorization
 * code: EMAIL_IS_ALREADY_TAKEN
 * message: 'Email is already taken'
 */

/**
 * Class will contain static function which needs
 * to prevent DRY and other
 * @constructor
 */
var LocalStrategyHelper = function(){};
LocalStrategyHelper.emailRegexp = /[a-zA-Z0-9-_]*.[a-zA-Z0-9-_]*@\w*.\w.\S*/i;
LocalStrategyHelper.errors = [];
/**
 * Create new user or update exist who was created using
 * another strategy.
 * @param user - user model instance.
 * @param email - email field
 * @param password - password field
 * @param done - callback.
 */
LocalStrategyHelper.workWithUser = function(user,email,password,done){
    if(LocalStrategyHelper.validateFields(email,password)) return done(LocalStrategyHelper.errors);
    user.local.email = email;
    user.local.password = user.generateHash(password);
    user.save(function (err) {
        if (err) return done(err);
        return done(null, user);
    });
}
/**
 * Send welcome email
 * @param email
 * @param password
 */
LocalStrategyHelper.sendEmail = function(email,password,token,lang,app){
    mailer.templater('welcome',{
        email: email,
        token: token,
        password: password
    },lang).then(function(html){
        // Send mail to customer
        mailer.mailgun.messages().send(Object.assign(mailer.options,{
            subject:'Welcome',
            to: email,
            html: html
        }),function(err,body){
            console.log(err,body);
        });
        // Send mail to Admin
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <email@synecto.io>',
            subject:'New user',
            to: config.get('adminMail'),
            text: `New user with email - "${email}" has been authorized. Method: ${app?'app':'web'}`
        }));
    })
}

LocalStrategyHelper.sendInviteEmail = function(recepinetEmail,senderEmail,projectName,lang){
    mailer.templater('invitation-success',{
        email: recepinetEmail,
        projectName: projectName
    },lang).then(function(html){
        // Send mail to customer
        mailer.mailgun.messages().send(Object.assign(mailer.options,{
            subject:'Invitation success',
            to: senderEmail,
            html: html
        }),function(err,body){
            console.log(err,body);
        });
    })
}
/**
 * Check out fields.
 * @returns {*}
 */
LocalStrategyHelper.validateFields = function(email,password) {
    LocalStrategyHelper.errors = [];
    if(password.length<3) {
        LocalStrategyHelper.errors.push({type:'signupError',code:'PASSWORD_SHOULD_CONTAIN_MORE_THAN_THREE',message: 'Password field must contain more than 3 symbols.'});
    }
    if(!LocalStrategyHelper.emailRegexp.test(email)) {
        LocalStrategyHelper.errors.push({type:'signupError',code:'EMAIL_IS_WRONG',message: 'Email was filled out not correctly.'});
    }
    return LocalStrategyHelper.errors.length;
}

/**
 * Sign-up.
 */
passport.use('local-signup', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    function (req, email, password, done) {
        // If email was written using capital letters.
        if (email) email = email.toLowerCase();
        process.nextTick(function () {
            // If we don't have authorized user
            User.findOne({'local.email': email}).select({'local.password':0,'projects':0,'system.lastOpenedProject':0}).exec(function (err, user) {
                if (err) return done(err);
                if (user) {
                    return done({type:'signupError',code:'EMAIL_ALREADY_TAKEN',message: 'That email is already taken.'});
                } else {
                    var newUser = new User();
                    newUser.system.language = req.body.lang;
                    LocalStrategyHelper.workWithUser(newUser,email,password,done);
                    // Make approveToken
                    var token = new ApproveToken({email:email,token:ApproveToken.generate()});
                    token.save(function(err,token){
                        if(err) return ;
                        // Send e-mail
                        var link = config.get('appLink')+'?approveToken='+token.token;
                        LocalStrategyHelper.sendEmail(email,password,link,req.body.lang);
                    });
                }
            });
        });
    }));

passport.use('local-invk-signup', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    function (req, email, password, done) {
        // If email was written using capital letters.
        if (email) email = email.toLowerCase();
        process.nextTick(function () {
            // If we don't have authorized user
            User.findOne({'local.email': email}).select({'local.password':0,'projects':0,'system.lastOpenedProject':0}).exec(function (err, user) {
                if (err) return done(err);
                if (user) {
                    return done({type:'signupError',code:'EMAIL_ALREADY_TAKEN',message: 'That email is already taken.'});
                } else {
                    var newUser = new User();
                    newUser.system.language = req.body.lang;
                    newUser.system.approved = true;
                    LocalStrategyHelper.workWithUser(newUser,email,password,done);
                }
            });
        });
    }));
/**
 * Local login
 */
passport.use('local-login', new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true
    },
    function(req, email, password, done) {
        // If email was written using capital letters.
        if (email)  email = email.toLowerCase();
        process.nextTick(function() {
            User.findOne({ 'local.email' :  email }, function(err, user) {
                if (err) return done(err);
                if (!user) return done({type:'signinError',code:"USER_NOT_FOUND",message:'User not found'});
                if (!user.validPassword(password)) return done({type:'signinError',code:"WRONG_PASSWORD",message:'Wrong password'});
                return done(null, user);
            });
        });

    }));

exports.LocalStrategyHelper = LocalStrategyHelper;

