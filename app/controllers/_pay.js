var router = require('express').Router();
var request = require('request');
var cors = require('cors');
var corsOpts = require('../libs/corsOpts');

var PLANS = require('../libs/plans');
var User = require('../models/user').User;
var auth = require('../middlewares/passport-auth');

var mailer = require('../libs/helpers/mailer');

var locales = require('../locales');
var moment = require('moment');
var config = require('../config');

/**
 * Send mail to user and admin
 */
function _sendMail(user,plan,total){
    mailer.templater('success-payment',{
        email: user.local.email,
        name: user.profile.name || (locales[user.system.language||'en']['friend']),
        planDetails: {
            name: plan.name,
            teamMembers: plan.teamMembers,
            storage: plan.storage/1024 + 'GB',
            expired: moment(plan.expired).format('DD-MM-YYYY')
        },
        locs: {
            ru: {
                name: 'План',
                teamMembers: 'Члены команды',
                storage: 'Место на диске',
                expired: 'Дата окончания'
            },
            en: {
                name: 'Plan',
                teamMembers: 'Team members',
                storage: 'Data space',
                expired: 'Expiration date'
            }
        }
    },user.system.language).then(function(html){
        // Send mail to customer
        mailer.mailgun.messages().send(Object.assign(mailer.options,{
            subject:'Success payment',
            to: user.local.email,
            html: html,
        }),function(err,body){
            console.log(err,body);
        });
        // Send mail to Admin
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <email@synecto.io>',
            subject:'Payment',
            to: config.get('adminMail'),
            text: `User "${user.local.email}" paid us ${total}$. Plan details ${JSON.stringify(plan)}`
        }));
    })
}

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));
        router.post('/',this.index);
        router.post('/downgrade',cors(corsOpts),auth,this.downgrade);
        router.post('/unsubscribe',cors(corsOpts),auth,this.unsubscribe);
        return router;
    },
    /**
     * Gumroad integration
     */
    index: function(req,res,next){
        if(!req.body.email || !req.body.seller_id) return res.json({success:false});
        if(req.body.seller_id!='k76sVtWpvkCJQNbstb0Snw==') return res.json({success:false});
        const planData = PLANS[req.body.product_id];
        if(!planData) return res.json({success:false});
        const total = req.body.price/100;
        const months = req.body.recurrence=='yearly' ? 12 : 1;
        // Payment success
        // Update user
        const date = new Date();
        const month = date.getMonth();
        let year = date.getFullYear();
        const to = months;
        const newMonth = month + to < 11 ? month + to : (month + to) - 12;
        if(month + to > 11) year++;
        date.setMonth(newMonth);
        date.setFullYear(year);
        planData.expired = date;
        planData.gumid = req.body.sale_id;
        // Update user
        User.findOne({'local.email':req.body.email},function(err,user){
            if(err) return res.json({success:false, message:'Cannot find user',details:err});
            if(!user) return res.json({success:false, message:'Cannot find user',details:err});
            planData.upload = user.plan.upload;
            user.plan = planData;
            user.save(function(err){
                if(err) return res.json({success:false, message:'Cannot find user',details:err});
                _sendMail(user,planData,total);
                res.json({success:true,plan:planData});
            });
        });
    },
    twoCO: function(req,res,next){
        if(!req.body.token || !req.body.plan || !req.body.userId) return res.json({success:false});
        const planData = PLANS[req.body.plan.name];
        const billingAddr = req.body.billingAddr;
        const total = planData.price * req.body.plan.months;
        // Request payment
        request.post({
            url: 'https://sandbox.2checkout.com/checkout/api/1/901355019/rs/authService',
            headers: {
                'Content-Type':'application/json'
            },
            body: JSON.stringify({
                sellerId: '901355019',
                privateKey: '07F68E40-3448-4299-B99C-80DC0257DEE7',
                merchantOrderId: 'd7as89mc',
                token: req.body.token,
                currency: 'USD',
                total: total,
                billingAddr: billingAddr
            })
        },function(err,response,body) {
            const data = JSON.parse(body);
            if(data.validationErrors)  return res.json({success:false,errors:validationErrors});
            if(data.exception) return res.json({success:false,errors:{message:data.exception.errorMsg}});
            if(data.response.responseCode!='APPROVED') return res.json({success:false,errors:data.response});
            // Update user
            const date = new Date();
            const month = date.getMonth();
            let year = date.getFullYear();
            const to = req.body.plan.months;
            const newMonth = month + to < 11 ? month + to : (month + to) - 12;
            if(month + to > 11) year++;
            date.setMonth(newMonth);
            date.setFullYear(year);
            planData.expired = date;
            // Update user
            User.findOne({_id:req.user._id},function(err,user){
                if(err) return res.json({success:false, message:'Cannot find user',details:err});
                if(!user) return res.json({success:false, message:'Cannot find user',details:err});
                planData.upload = user.plan.upload;
                user.plan = planData;
                user.save(function(err){
                    if(err) return res.json({success:false, message:'Cannot find user',details:err});
                    _sendMail(user,planData,total);
                    res.json({success:true,plan:planData});
                });
            });
        });
    },
    downgrade: function(req,res,next){
        const planData = PLANS['startup'];
        User.findOne({_id:req.user._id},function(err,user){
            if(err) return res.json({success:false, message:'Cannot find user',details:err});
            if(!user) return res.json({success:false, message:'Cannot find user',details:err});
            planData.upload = user.plan.upload;
            planData.expired = new Date(2090, 6, 7);
            user.plan = planData;
            user.save(function(err){
                if(err) return res.json({success:false, message:'Cannot find user',details:err});
                res.json({success:true,plan:planData});
            });
        });
    },
    unsubscribe: function(req,res,next){
        User.findOne({_id:req.user._id},function(err,user){
            if(err) return res.json({success:false, message:'Cannot find user',details:err});
            if(!user) return res.json({success:false, message:'Cannot find user',details:err});
            if(!user.plan.gumid) return res.json({success:false, message:'Cannot cancel subscription via API',details:err});
            request({
                url: 'https://api.gumroad.com/v2/sales/'+user.plan.gumid+'?access_token='+config.get('gumroad').token,
                method: "GET",
                headers: {
                    'Content-Type':'application/json'
                }
            },(err,response,body)=>{
                if(err) return res.json({success:false, message:'Cannot cancel subscription via API',details:err});
                if(typeof body=='string') body = JSON.parse(body);
                if(!body.success) return res.json({success:false, message:'Cannot cancel subscription via API',details:body});
                if(!body.sale) return res.json({success:false, message:'Cannot cancel subscription via API',details:body});
                const subId = body.sale.subscription_id;
                request({
                    url: 'https://api.gumroad.com/v2/resource_subscriptions/'+subId,
                    method: "DELETE",
                    headers: {
                        'Content-Type':'application/json'
                    },
                    body: JSON.stringify({
                        access_token: config.get('gumroad').token
                    })
                },(err,response,body)=>{
                    if(err) return res.json({success:false, message:'Cannot cancel subscription via API',details:err});
                    if(typeof body=='string') body = JSON.parse(body);
                    if(!body.success) return res.json({success:false, subscriptionId: subId, message:'Cannot cancel subscription via API',details:body});
                    const planData = PLANS['startup'];
                    planData.upload = user.plan.upload;
                    planData.expired = new Date(2090, 6, 7);
                    user.plan = planData;
                    user.save(function(err){
                        if(err) return res.json({success:false, message:'Cannot find user',details:err});
                        res.json({success:true,plan:planData});
                    });
                });
            });
        });
    }
};
