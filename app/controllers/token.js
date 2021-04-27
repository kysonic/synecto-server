var router = require('express').Router();
var User = require('../models/user').User;
var EntryToken = require('../models/entryToken').EntryToken;
var InviteToken = require('../models/inviteToken').InviteToken;
var ApproveToken = require('../models/approveToken').ApproveToken;
var Project = require('../models/project').Project;
// Libs
var crypto = require('crypto');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
// Libs
var mailer = require('../libs/helpers/mailer');
var config = require('../config');

function _fetchToken(token,email) {
    return new Promise((resolve,reject)=>{
        if(token) return resolve(token);
        var token = new ApproveToken({email:email,token:ApproveToken.generate()});
        token.save(function(err,token){
            resolve(token);
        });
    });
}

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));
        router.post('/entry',cors(corsOpts),this.buildToken);
        router.post('/approve',cors(corsOpts),this.approveToken);
        router.get('/reapprove',cors(corsOpts),this.sendApproveMail);
        router.post('/invite',cors(corsOpts),this.createInviteToken);
        return router;
    },
    /**
     * Build special token to enter in Designmap if you forgot a password
     * @returns {*}
     */
    buildToken: function(req,res,next){
        if(!req.body.email) return res.json({success:false,errors:{type:"tokenError",message:"You should transmit email."}});
        User.findOne({'local.email':req.body.email},function(err,user){
            if(err) return res.json({success:false,errors:{type:"tokenError",message:"Cannot find user",details:err}});
            if(!user) return res.json({success:false,errors:{type:"tokenError",message:"There is no user with same e-mail"}});
            var entryToken = new EntryToken({userID:user._id,email:req.body.email});
            entryToken.token = crypto.randomBytes(32).toString('hex');
            entryToken.save(function(err){
                if(err) return res.json({success:false,errors:{type:"tokenError",message:"Cannot save token",details:err}});
                // Send e-mail
                mailer.templater('password-restore',{
                    token: config.get('appLink')+'settings?token='+entryToken.token
                },user.system.language).then(function(html){
                    mailer.mailgun.messages().send(Object.assign(mailer.options,{
                        subject:'Restore an access to account',
                        to: user.local.email,
                        html: html
                    }));
                });
                res.json({success:true,message:"Token was created."});
            });
        });
    },
    approveToken: function(req,res,next){
        if(!req.body.token) return res.json({success:false,errors:{type:"approveTokenError",message:"You should transmit token."}});
        // Find token
        ApproveToken.findOne({token:req.body.token},function(err,token){
            if(err) return res.json({success:false,errors:{type:"approveTokenError",message:"Problem with token fetching",details:err}});
            if(!token) return res.json({success:false,errors:{type:"approveTokenError",message:"There is no token"}});
            // Find user
            User.findOne({'local.email':token.email},function(err,user){
                if(err) return res.json({success:false,errors:{type:"tokenError",message:"Cannot find user",details:err}});
                if(!user) return res.json({success:false,errors:{type:"tokenError",message:"There is no user with same e-mail"}});
                // Approve!
                user.system.approved = true;
                user.save(function(err,user){
                    if(err) return res.json({success:false,errors:{type:"approveTokenError",message:"Cannot save user",details:err}});
                    token.remove();
                    res.json({success:true,message:"Email approving was successful",user:user});
                    /*req.logIn(user, function(err) {
                        if (err) { return res.json({success:false,errors:{type:'loginError',message:err.message}}) }

                    });*/
                });
            });
        });
    },
    /**
     * Send mail to approve e-mail
     * @returns {*}
     */
    sendApproveMail: function(req,res,next) {
        if(!req.query.email) return res.json({success:false,errors:{type:"approveTokenError",message:"You should transmit email."}});
        User.findOne({'local.email':req.query.email},function(err,user){
            if(err) return res.json({success:false,errors:{type:"approveTokenError",message:"Cannot find user",details:err}});
            if(!user) return res.json({success:false,errors:{type:"approveTokenError",message:"There is no user with same e-mail"}});
            if(user.system.approved) return res.json({success:false,errors:{type:"approveTokenError",message:"Email already approved"}});
            ApproveToken.findOne({email:req.query.email},function(err,token){
                if(err) return res.json({success:false,errors:{type:"approveTokenError",message:"Problem with token fetching",details:err}});
                _fetchToken(token,user.local.email).then(function(token){
                    mailer.templater('reapprove',{
                        token: config.get('appLink')+'?approveToken='+token.token
                    },user.system.language || req.query.lang).then(function(html){
                        res.json({success:true,message:"Everything is allright!"});
                        mailer.mailgun.messages().send(Object.assign(mailer.options,{
                            subject:'Email confirmation',
                            to: user.local.email,
                            html: html
                        }));
                    });
                }).catch(function(err){
                    console.log(err);
                });
            });
        });
    },
    /**
     * Create invintation token
     * @returns {*}
     */
    createInviteToken: function(req,res,next){
        if(!req.body.email) return res.json({success:false,errors:{type:"tokenError",message:"You should transmit email."}});
        User.findOne({'local.email':req.body.email},function(err,user){
            if(err) return res.json({success:false,errors:{type:"tokenError",message:"Cannot find user",details:err}});
            if(!req.body.projectId) return res.json({success:false,errors:{type:"tokenError",message:"Cannot find project id",details:err}});
            if(user) return res.json({success:false,errors:{type:"tokenError",message:"There is user with same email"}});
            var inviteToken = new InviteToken({email:req.body.email,projectId:req.body.projectId,projectName:req.body.projectName,ownerEmail:req.body.ownerEmail});
            inviteToken.token = InviteToken.generate();
            inviteToken.save(function(err){
                if(err) return res.json({success:false,errors:{type:"tokenError",message:"Cannot save token",details:err}});
                // Send e-mail
                mailer.templater('invite-user',{
                    token: config.get('appLink')+'?invtkn='+inviteToken.token+'&email='+req.body.email,
                    inviter: req.body.inviter,
                    projectName: req.body.projectName
                },req.body.language).then(function(html){
                    mailer.mailgun.messages().send(Object.assign(mailer.options,{
                        subject:'You got invitation',
                        to: req.body.email,
                        html: html
                    }));
                });
                res.json({success:true,message:"Token was created."});
            });
        });
    },
};
