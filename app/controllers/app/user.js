var express = require('express');
var router = express.Router();
var crypto = require('crypto');

var User = require('../../models/user').User;
var Project = require('../../models/project').Project;
var Folder = require('../../models/folder').Folder;
var File = require('../../models/file').File;
var ApproveToken = require('../../models/approveToken').ApproveToken;
var LocalStrategyHelper = require('../../libs/login/passport-local-strategy').LocalStrategyHelper;
var config = require('../../config');
var utils = require('../../libs/helpers/utils');
var locales = require('../../locales');
var _ = require('lodash');
var initialData = require('../../libs/helpers/initialData');

function passToken(req,res,next) {
    const email = req.query.email || req.body.email;
    const token = req.query.token || req.body.token;
    User.findOne({'local.email':email,'system.appToken':token},{profile:1,_id:1,'plan':1,'system.language':1,'system.appToken':1,'local.email':1,},(err,user)=>{
        if(err) return res.json({success:false,errors:{message:'Cannot find user'}});
        if(!user) return res.json({success:false,errors:{message:'Cannot find user'}});
        res.user = user;
        next();
    });
}



module.exports = {
    routes: function(){
        router.post('/login',this.login.bind(this));
        router.post('/google-registration',this.googleRegistration.bind(this));
        router.post('/register',this.register.bind(this));
        router.get('/projects', passToken, this.projects.bind(this));
        return router;
    },
    login: function(req,res,next){
        User.findOne({'local.email':req.body.email},(err,user)=>{
            if(err) return res.json({success:false,errors:{message:'Cannot find user'}});
            if(!user.validPassword(req.body.password)) return res.json({success:false,errors:{message:'Password is wrong'}});
            if(!user.system.approved) return res.json({success:false,errors:{message:"Your email wasn't approved"}});
            _userLogin(user,res);
        });
    },
    projects: function(req,res,next) {
        Project.find({owner:res.user._id}).populate('owner').lean().exec(function(err,projects){
            if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot find projects",details:err}});
            Project.find({users:{$in:[res.user._id.toString(),res.user._id]}}).populate('owner').lean().exec(function(err,shared){
                if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot find projects",details:err}});
                const allProjects = projects.concat(shared);
                res.json({success:true,projects:allProjects, user: res.user});
            });
        });
    },
    register: function(req,res,next){
        const {email,password} = req.body;
        User.findOne({'local.email': email}).select({'local.password':0,'projects':0,'system.lastOpenedProject':0}).exec(function (err, user) {
            if (err) return res.json({success:false,errors:{message:'Database error'}});
            if (user) return res.json({success:false,errors:{message:'This email is already taken'}});
            // Create new
            var user = new User();
            // Token to auth by designmapp
            user.system.appToken = crypto.randomBytes(32).toString('hex');
            user.system.language = req.body.lang;
            user.local.email = email;
            user.local.password = user.generateHash(password);
            //Save user
            user.save(function (err) {
                if (err) return res.json({success:false,errors:{message:'Cannot save user'}});
                initialData.createProject(user).then(function(){
                    res.json({success:true,message:"User was registered successfully."});
                });
                // Make approveToken
                var approveToken = new ApproveToken({email:email,token:ApproveToken.generate()});
                approveToken.save(function(err,token){
                    if(err) return ;
                    // Send e-mail
                    var link = config.get('appLink')+'?approveToken='+token.token;
                    LocalStrategyHelper.sendEmail(email,password,link,req.body.lang,true);
                });
            });
        });
    },
    googleRegistration: function(req,res,next){
        var email = req.body.user.email;
        var language = req.body.user.locale;
        User.findOne({'google.email':email},(err,user)=>{
            if(err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Database error",details:err}});
            if(user) return _userLogin(user,res);

            User.findOne({'local.email': email}).select({'local.password':0,'projects':0,'system.lastOpenedProject':0}).exec(function (err, user) {
                if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                if (user) {
                    user.google.email = email;
                    user.system.language = language;
                    // Save
                    user.save((err,user)=>{
                        if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                        _userLogin(user,res);
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
                    if(req.body.user.given_name) user.profile.name = req.body.user.given_name;
                    if(req.body.user.family_name) user.profile.lastName = req.body.user.wea;
                    // Save
                    user.save((err,user)=>{
                        if (err) return res.json({success:false,errors:{type:"googleRegistrationError",message:"Cannot signup",details:err}});
                        LocalStrategyHelper.sendEmail(email,password,false,language,true);
                        _createProject(user,res,function(){
                            _userLogin(user,res);
                        });
                    });
                }
            });
        });
    }
}

function _userLogin(user,res){
    const token = user.system.appToken = crypto.randomBytes(32).toString('hex');
    user.save((err,user)=>{
        if(err) return res.json({success:false,errors:{message:'Cannot save user'}});
        const preparedUser = _.omit(user.toObject(),["isPremium","system","config","local","google"]);
        preparedUser.local = {email:user.local.email};
        preparedUser.system = {appToken:token};
        res.json({success:true,user:preparedUser});
    });
}