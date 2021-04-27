var router = require('express').Router();
var request = require('request');
var cors = require('cors');
var corsOpts = require('../libs/corsOpts');
var ObjectId = require('mongoose').Types.ObjectId;

var PLANS = require('../libs/plans');
var User = require('../models/user').User;
var auth = require('../middlewares/passport-auth');
var tokenizer = require('../middlewares/tokenizer');

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

function _countDate(months) {
    const date = new Date();
    const month = date.getMonth();
    let year = date.getFullYear();
    const to = months;
    const newMonth = month + to < 11 ? month + to : (month + to) - 12;
    if(month + to > 11) year++;
    date.setMonth(newMonth);
    date.setFullYear(year);
    return date;
}

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));
        router.post('/',cors(corsOpts),auth,this.index);
        router.post('/unsubscribe',cors(corsOpts),auth,this.unsubscribe);
        router.get('/setup',tokenizer,this.setupPlan);
        return router;
    },
    /**
     * Pure email orders integraion
     */
    index: function(req,res,next){
        const planData = PLANS[req.body.plan.name];
        if(!planData) return res.json({success:false,errors:{message:'There is no such plan...'}});
        planData.userId = req.body.userId;
        planData.months = req.body.plan.months;
        planData.link = `${config.get('ownUrl')}/pay/setup?token=${config.get('paymentToken')}&plan=${req.body.plan.name    }&userId=${req.body.userId}&months=${req.body.plan.months}`;

        // Send me a message
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <email@synecto.io>',
            subject:'Payment Order',
            to: config.get('adminMail'),
            html: `<pre style="font-size: 20px">
                    ${JSON.stringify(planData,null,4)}
                   </pre>`
        }));

        res.json({success:true,message:'Your order has been sent. We will answer you during 1 work day.'});

    },

    unsubscribe: function(req,res,next){
        if(!req.body.userId) return res.json({success:false,errors:{message:'There is no userID...'}});
        // Send me a message
        mailer.transporter.sendMail(Object.assign({
            from: 'Synecto <email@synecto.io>',
            subject:'Payment Unsubscribe',
            to: config.get('adminMail'),
            html: `${config.get('ownUrl')}pay/setup?token=${config.get('paymentToken')}&plan=startup&userId=${req.body.userId}&months=12`
        }));
        res.json({success:true,message:'Your order has been sent. We will answer you during 1 work day.'});
    },

    setupPlan: function(req,res,next){
        if(!req.query.userId) return res.json({success:false,errors:{message:'There is no userID...'}});
        if(!req.query.plan) return res.json({success:false,errors:{message:'There is no plan name...'}});
        if(!req.query.months) return res.json({success:false,errors:{message:'There is no months...'}});
        const oid = new ObjectId(req.query.userId.toString());
        User.findOne({_id:oid},function(err,user){
            if(err) return res.json({success:false, message:'Cannot find user',details:err});
            if(!user) return res.json({success:false, message:'Cannot find user',details:err});
            const planData = PLANS[req.query.plan];
            if(!planData) return res.json({success:false,errors:{message:'There is no plan data...'}});
            planData.upload = user.plan.upload;
            planData.expired = _countDate(req.query.months);
            user.plan = planData;
            user.save(function(err){
                if(err) return res.json({success:false, message:'Cannot find user',details:err});
                const total = planData.price*req.query.months;
                _sendMail(user,planData,total);
                res.json({success:true,plan:planData});
            });
        });
    }
};
