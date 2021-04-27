var router = require('express').Router();
var User = require('../models/user').User;
var Message = require('../models/message').Message;
var mailer = require('../libs/helpers/mailer');
var config = require('../config');
var request = require('request');
var cors = require('cors');
var corsOpts = require('../libs/corsOpts');
var async = require('async');

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));
        router.get('/',this.index);
        router.get('/suicide/:email',this.suicide);
        router.post('/support-message',cors(corsOpts),this.supportMessage);
        router.post('/qpq-message',cors(corsOpts),this.qpqMessage);

        return router;
    },
    index: function(req,res,next){
        res.render('pages/index',{title: 'Synecto',isAuth:req.isAuthenticated()});
    },
    suicide: function(req,res,next){
        if(req.query.token!='kytokenioioioio$$') return res.json({success:false,message:'Token is wrong!'});
        User.findOne({'local.email':req.params.email},(err,user)=>{
            if(err) return res.json({success:false,error:err});
            if(!user) return res.json({success:false,message:'There is no user'});
            user.suicide().then((response)=>{
                res.json({success:true,response:response});
            }).catch((err)=>{
                res.json({success:false,error:err});
            });
        });
    },
    supportMessage: function(req,res){
        // Send mail to Admin
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <email@designmap.io>',
            subject:'Support message',
            to: config.get('adminMail'),
            text: `User with name - ${req.body.name} and email - ${req.body.email} sent a message: ${req.body.message}`
        }));
        res.json({success:true});
    },
    qpqMessage: function(req,res){
        // Send mail to Admin
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <support@synecto.io>',
            subject:'QPQ Request',
            to: config.get('adminMail'),
            text: `User email - ${req.body.email} - wants to connect Quid Pro Quo program! Wow! Really? Ok. Don't forget to send approvation and instructions.`
        }));
        res.json({success:true});
    }
};
