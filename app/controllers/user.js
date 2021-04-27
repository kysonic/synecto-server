var express = require('express');
var router = express.Router();
var User = require('../models/user').User;
var EntryToken = require('../models/entryToken').EntryToken;
var InviteToken = require('../models/inviteToken').InviteToken;
var Project = require('../models/project').Project;
var Folder = require('../models/folder').Folder;
var File = require('../models/file').File;

var passport = require('../libs/login/passport');
var LocalStrategyHelper = require('../libs/login/passport-local-strategy').LocalStrategyHelper;
var utils = require('../libs/helpers/utils');
var multiparty = require('multiparty');
var locales = require('../locales');
var auth = require('../middlewares/passport-auth');
var tokenizer = require('../middlewares/tokenizer');
var request = require('request');
var googleDrive = require('../libs/storages/googleDrive');
var yandexDisk = require('../libs/storages/yandexDisk');
var cors = require('cors');
var corsOpts = require('../libs/corsOpts');
var img = require('../libs/img/img');
var fs = require('fs');
var mailer = require('../libs/helpers/mailer');
var mkdirp = require('mkdirp');

var PLANS = require('../libs/plans');
var initialData = require('../libs/helpers/initialData');


module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/is-auth',cors(corsOpts),this.isAuth);

        router.get('/',cors(corsOpts),this.user);
        router.put('/',cors(corsOpts),auth,this.updateUser);
        router.put('/password',cors(corsOpts),auth,this.updateUserPassword);

        router.post('/registration',cors(corsOpts),this.registration.bind(this));
        router.post('/google-registration',cors(corsOpts),this.googleRegistration.bind(this));
        router.post('/login',cors(corsOpts),this.login.bind(this));
        router.post('/google-login',cors(corsOpts),this.googleLogin.bind(this));
        router.post('/token',cors(corsOpts),this.loginWithToken.bind(this));
        router.get('/logout',cors(corsOpts),this.logout.bind(this));

        router.post('/google-account',cors(corsOpts),this.googleAccount);
        router.post('/yandex-account',cors(corsOpts),this.yandexAccount);
        router.post('/google-synecto-folder',cors(corsOpts),auth,this.createGoogleSynectoFolder);

        router.post('/upload-avatar',cors(corsOpts),auth,this.uploadAvatar);
        router.get('/remove-avatar',cors(corsOpts),auth,this.removeAvatar);
        router.post('/crop-avatar',cors(corsOpts),auth,this.cropAvatar);


        return router;
    },
    /**
     * Whether user is auth
     */
    isAuth: function(req,res,next) {
        res.json({success:true,isAuth:req.user});
    },
    /**
     * Get current user data
     */
    user: function(req,res,next){
        if(req.query.my) {
            var user = null;
            if(req.user) {
                user = Object.assign({},req.user.toObject());
                delete user.local.password;
            }
            return res.json({success:true,message:"User was obtained successfully.",user:user});
        }
        var q = req.query.q || '';
        User.find({$or:[{'local.email':new RegExp('.*'+q+'.*')},{'google.email':new RegExp('.*'+q+'.*')}]})
            .limit(10)
            .select({'projects':0,'system':0,'isPremium':0,'config':0,'local.password':0}).exec(function(err,users){
                if(err) return res.json({success:false,errors:{type:'userError',message:'Can\' fetch users',details:err}});
                res.json({success:true,message:'Users was fetched successfully.',users:users});
            });
    },
    /**
     * Update user data
     */
    updateUser: function(req,res,next) {
        // Prevent plans hacking
        req.body.plan = req.user.plan;
        req.body.online = req.user.online;
        // Remove local data
        delete req.body.local;
        User.update({_id:req.user.id},req.body,function(err){
            if(err) return res.json({success:false,errors:{type:'userError',message:"Can't save user",details:err}});
            User.findOne({_id:req.user.id},{'local.password':0},function(user){
                res.json({success:true,user:user,message:'User has been saved successfully!'});
            });
        });
    },
    /**
     * Update user data
     */
    updateUserPassword: function(req,res,next) {
        // Password is represented in data
        var password = req.body.password;
        var hashed = req.user.generateHash(password);
        req.user.local.password = hashed;
        req.user.save(function(err,data){
            if(err) return res.json({success:false,errors:{type:'userError',message:"Can't save user",details:err}});
            // E-Mail
            mailer.templater('password-changed',{
                 message: req.user.profile.name&&req.user.profile.lastName ? req.user.profile.name+' '+req.user.profile.lastName : req.user.local.email,
                 password: password
             },req.user.system.language).then(function(html){
                 mailer.mailgun.messages().send(Object.assign(mailer.options,{
                     subject:'Password was changed',
                     to: req.user.local.email,
                     html: html
                 }));
             });
            res.json({success:true,message:'User was updated.',newPassword:password,details:data});
        });
    },
    /**
     * Register new user.
     */
    registration: function(req,res,next){
        if(req.user) return res.json({success:false,errors:{type:'signupError',code:'USER_ALREADY_AUTHORIZED',message:'You already authorized'}});
        if(req.body.invtkn) return this.resolveInvkToken(req,res,next);
        // Simple flow
        passport.authenticate('local-signup', function(err, user, info) {
            if (err) return res.json({success: false, errors: err});
            if(info) return res.json({success: false, errors: info});
            // Initial data
            initialData.createProject(user).then(()=>{
                res.json({success:true,message:"User was registered successfully."});
            }).catch((err)=>{
                if (err) return res.json({success: false, errors: err});
            });

        }.bind(this))(req, res, next);
    },

    resolveInvkToken: function(req,res,next){
        passport.authenticate('local-invk-signup', function(err, user, info) {
            if (err) return res.json({success: false, errors: err});
            if(info) return res.json({success: false, errors: info});
            InviteToken.findOne({token:req.body.invtkn},function(err,token){
                if (err) return res.json({success: false, code: "InvkTokenError",errors: err});
                // Send mail
                LocalStrategyHelper.sendInviteEmail(user.local.email,token.ownerEmail,token.projectName,user.system.language);
                // Login
                req.logIn(user, function(err) {
                    if (err) return res.json({success: false, code: "InvkTokenError",errors: err});
                    global.io.setupRegisteredUser(user);
                    res.json({success:true,message:"User was registered successfully.",projectId:token.projectId,user:user});
                    token.remove();
                });
            });
        }.bind(this))(req, res, next);
    },
    /**
     * Signup\signin with google
     * @returns {*}
     */
    googleRegistration: function(req,res,next){
        if(req.user) return res.json({success:false,errors:{type:'signupError',code:'USER_ALREADY_AUTHORIZED',message:'You already authorized'}});
        var email = req.body.user.U3;
        var language = req.body.user.lang;
        if(req.body.invtkn) return this.googleInvkRegistration(req,res,next);
        User.findOne({'google.email':email},(err,user)=>{
            if(err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
            if(user) {
                req.logIn(user, function(err) {
                    if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
                    user.system.lastLogin = new Date();
                    user.save();
                    res.json({success:true,user:user,message:'You have signed in with google'});
                });
            }else {
                User.findOne({'local.email': email}).select({'local.password':0,'projects':0,'system.lastOpenedProject':0}).exec(function (err, user) {
                    if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                    if (user) {
                        user.google.email = email;
                        user.system.language = language;
                        // Save
                        user.save((err,user)=>{
                            if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                            req.logIn(user, function(err) {
                                if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
                                res.json({success:true,user:user,message:'Google account was bound to your account',signup:true});
                            });
                        });
                    }else {
                        var password = utils.generateUid(7);
                        var user = new User({
                            system: {
                                approved: true,
                                language: language,
                            },
                            local: {email:email},
                            google: {email:email}
                        });
                        user.local.password = user.generateHash(password);
                        // Fill user
                        if(req.body.user.ofa) user.profile.name = req.body.user.ofa;
                        if(req.body.user.wea) user.profile.lastName = req.body.user.wea;
                        // Save
                        user.save((err,user)=>{
                            if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                            req.logIn(user, function(err) {
                                if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
                                LocalStrategyHelper.sendEmail(email,password,false,language)
                                // Initial data
                                initialData.createProject(user).then(()=>{
                                    res.json({success:true,message:"Google auth success.",user:user,signup:true});
                                }).catch((err)=>{
                                    if (err) return res.json({success: false, errors: err});
                                });
                            });
                        });
                    }
                });
            }
        });
    },

    googleInvkRegistration: function(req,res,next){
        // Save
        InviteToken.findOne({token:req.body.invtkn},function(err,token){
            if (err) return res.json({success: false, code: "InvkTokenError",errors: err});

            const email = req.body.user.U3;
            const language = req.body.user.lang;
            const password = utils.generateUid(7);
            const user = new User({
                system: {
                    approved: true,
                    language: language,
                },
                local: {email:token.email},
                google: {email:email}
            });
            user.local.password = user.generateHash(password);
            // Fill user
            if(req.body.user.ofa) user.profile.name = req.body.user.ofa;
            if(req.body.user.wea) user.profile.lastName = req.body.user.wea;

            user.save(function(err){
                if (err) return res.json({success: false, code: "InvkTokenError", errors: {message:'This google account already bound to another account.'}});
                // Send mail
                LocalStrategyHelper.sendInviteEmail(user.local.email,token.ownerEmail,token.projectName,user.system.language);
                // Login
                req.logIn(user, function(err) {
                    if (err) return res.json({success: false, code: "InvkTokenError",errors: err});
                    global.io.setupRegisteredUser(user);
                    res.json({success:true,message:"User was registered successfully.",projectId:token.projectId,user:user,signup:true});
                    token.remove();
                });
            })

        });



    },
    /**
     * It is a hole in authorization system!
     * TODO: Check account man!
     * @returns {*}
     */
    googleLogin: function(req,res,next) {
        if(req.user) return res.json({success:false,errors:{type:'googleSigninError',code:'USER_ALREADY_AUTHORIZED',message:'You already authorized'}});
        var email = req.body.user.U3;
        User.findOne({'google.email':email},(err,user)=>{
            if(err) return res.json({success:false,errors:{type:"googleSigninError",message:"Cannot signup",details:err}});
            if(user) {
                req.logIn(user, function(err) {
                    if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
                    user.system.lastLogin = new Date();
                    user.save();
                    res.json({success:true,user:user,message:'Everything is ok'});
                });
                return;
            }
            return res.json({success:false,errors:{type:"googleSigninError",message:"You don't have associated google account.",details:err}});
        });
    },
    /**
     * Authorize user.
     */
    login: function(req,res,next){
        if(req.user) return res.json({success:false,errors:{type:'signinError',code:'USER_ALREADY_AUTHORIZED',message:'You already authorized'}});
        passport.authenticate('local-login', function(err, user, info) {
            this.handleLocalStrategy(req ,res, next, err, user, info);
        }.bind(this))(req, res, next);
    },
    /**
     * Authorize user.
     */
    loginWithToken: function(req,res,next){
        if(req.user) return res.json({success:false,errors:{type:'signinError',code:'USER_ALREADY_AUTHORIZED',message:'You already authorized'}});
        // Find token
        EntryToken.findOne({token:req.body.token},function(err,token){
            if(err) return res.json({success:false,errors:{type:"signinError",message:"Cannot find token",details:err}});
            if(!token) return res.json({success:false,errors:{type:"signinError",message:"Cannot find token"}});
            // Fetch user
            User.findOne({_id:token.userID }, function(err, user) {
                if (err) return res.json({success:false,errors:{type:"signinError",message:"Cannot find token",details:err}});
                if (!user) return res.json({success:false,errors:{type:"signinError",message:"User not found"}});
                if (!user.system.approved) return res.json({success:false,errors:{type:"signinError",message:"E-mail is not approved"}});
                token.remove();
                req.logIn(user, function(err) {
                    if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
                    res.json({success:true,user:user});
                });
            });
        });
    },
    /**
     * Logout.
     */
    logout: function(req,res,next){
        req.session.destroy(function (err) {
            if(err) return res.json({success:false,errors:{type:'userError',message:'Can\'t remove session'}})
            return res.json({success:true,message:'You has been logged out.'});
        });
    },
    /**
     * Because handling of sign up and sign in are similar
     * this function will handle each of them.
     */
    handleLocalStrategy: function(req, res, next, err, user, info){
        if (err) return res.json({success: false, errors: err});
        if(info) return res.json({success: false, errors: info});
        if(!user.system.approved) return res.json({success:false,errors:{type:"signinError",message:"E-mail is not approved"}});
        req.logIn(user, function(err) {
            if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }
            user.system.lastLogin = new Date();
            user.save();
            res.json({success:true,user:user,message:info?info.message:''});
        });
    },
    /**
     * Helper proxy route helping to obtain tokens from google.
     */
    googleAccount: function(req,res,next) {
        googleDrive.getToken(req.body).then(function(data){
            res.json(data);
        },function(err){
            res.json({success:false,errors:{type:'googleAccountError',message:'API doesn\'t work',details:err}});
        });
    },
    /**
     * Helper proxy route helping to obtain tokens from yandex.
     */
    yandexAccount: function(req,res,next) {
        yandexDisk.getToken(req.body).then(function(data){
            res.json(data);
        },function(err){
            res.json({success:false,errors:{type:'yandexAuthError',message:'API doesn\'t work',details:err}});
        })
    },
    /**
     * Assign folder id to google drive account
     */
    createGoogleSynectoFolder: function(req,res,next){
        googleDrive.createSynectoFolder(req.user.id).then(function(folderID){
            req.user.system.integrations.google.id = folderID;
            User.update({_id:req.user.id},req.user,function(err){
                if(err) return res.json({success:false,errors:{type:'googleDriveError',message:"Can't save user",details:err}});
                res.json({success:true,message:'Synecto folder id was updated successfuly.'});
            });
        },function(err){
            res.json({success:false,errors:{type:'googleDriveError',message:"Can't create Synecto folder",details:err}});
        });
    },
    /**
     * Upload tmp user's avatar
     */
    uploadAvatar: function(req,res,next) {
        if(!fs.existsSync('./public/uploads/users/'+req.user.local.email)) fs.mkdir('./public/uploads/users/'+req.user.local.email);
        mkdirp('/public/uploads/users/'+req.user.local.email+'/avatars/',function(){
            img.upload(req,{
                name: 'tmp',
                setTime:false,
                maxSize: 20 * 1024 * 1024,
                path:'./public/uploads/users/'+req.user.local.email+'/avatars/',
                supportMimeTypes: ['image/jpg', 'image/jpeg', 'image/png']}).then(function(data){
                res.json({success:true,message:'Avatar was upload successfully',file:data.file});
            }).catch(function(err){
                res.json({success:false,errors:{type:'userError',message:'Problem with avatar uploading',details:err}});
            });
        });
    },
    /**
     * Remove user's tmp avatar
     */
    removeAvatar: function(req,res,next) {
        if(fs.existsSync('./public'+req.query.path)) fs.unlink('./public'+req.query.path);
        res.json({success:true,message:'File was removed'});
    },
    /**
     * Remove user's tmp avatar
     */
    cropAvatar: function(req,res,next) {
        var pth = req.body.pth;
        img.crop({pth:pth,crop:req.body.crop,name:'avatar',setTime:false,resize:req.body.resize}).then(function(src){
            if(fs.existsSync('./public'+pth)) fs.unlink('./public'+pth);
            User.update({'local.email':req.user.local.email}, { $set: { avatar: src}}, function(err,updated){
                if(err) res.json({success:false,errors:err});
                else res.json({success:true,src:src});
            });
        },function(err){
            res.json({success:false,errors:err});
        });
    },
    upgradePlan: function(req,res,next){
        if(!req.body.userId) return res.json({success:false,message:'Cannot find user id'});
        const planData = PLANS[req.body.plan];
        const date = new Date();
        const month = date.getMonth();
        let year = date.getFullYear();
        const newMonth = month + req.body.months < 11 ? month + req.body.months : (month + req.body.months) - 12;
        if(month + req.body.months > 11) year++;
        date.setMonth(newMonth);
        date.setFullYear(year);
        planData.expired = date;
        // Update user
        User.findOne({_id:req.body.userId},function(err,user){
            if(err) return res.json({success:false, messaage:'Cannot find user',details:err});
            if(!user) return res.json({success:false, messaage:'Cannot find user',details:err});
            planData.upload = user.plan.upload;
            user.plan = planData;
            user.save(function(err){
                if(err) return res.json({success:false, messaage:'Cannot find user',details:err});
                res.json({success:true,plan:planData});
            });
        });
    }
};
