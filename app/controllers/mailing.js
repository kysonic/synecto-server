var router = require('express').Router();
var notifyManager = require('../libs/helpers/notifyManager');
var mailer = require('../libs/helpers/mailer');
var User = require('../models/user').User;
var locales = require('../locales');
var path = require('path');

module.exports = {
    routes: function() {
        router.get('/',this.previewMail);
        router.get('/send',this.sendMail);
        router.get('/send-to-admins',this.sendToAdmins);
        return router;
    },
    previewMail: function(req,res,next){
        mailer.templater('betav3',{
            name: 'Rubindra',
        },'en').then(function(html){
            res.end(html);
        });
    },
    sendToAdmins: function (req,res,next) {
        ['soooyc@gmail.com','mrmoru@gmail.com'].forEach(function(email) {
            mailer.templater('betav3', {
                name: 'Rubindra'
            }, 'en').then(function (html) {
                mailer.mailgun.messages().send(Object.assign(mailer.options, {
                    subject: 'Example beta campaign e-mail',
                    to: email,
                    html: html,
                    inline: [
                        path.join(__dirname, '../../public/img/updates_logo.png'),
                        path.join(__dirname, '../../public/img/betav3/beta3_1.png'),
                        path.join(__dirname, '../../public/img/betav3/beta3_2.png'),
                        path.join(__dirname, '../../public/img/betav3/vk.png'),
                    ]
                }), (err, msg) => {
                    console.log(email, '>>>', err, msg);
                })
            })
        });
        res.json({success:true});
    },
    sendMail: function(req,res,next){
        User.find({},(err,users)=>{
            if(err) return res.json({success:false,error:err});
            if(!users) return res.json({success:false,message:'There is no user'});
            // Build stack email
            var usersPrms = users.map(function(user){
                let email = user.local.email;
                console.log(`Trying to send to ${email}`);
                return mailer.templater('betav3',{
                    name: user.profile.name || (locales[user.system.language||'en']['friend'])
                },user.system.language).then(function(html){
                    mailer.mailgun.messages().send(Object.assign(mailer.options,{
                        subject:'New Release',
                        to: user.local.email,
                        html: html,
                        inline: [
                            path.join(__dirname, '../../public/img/updates_logo.png'),
                            path.join(__dirname, '../../public/img/betav3/beta3_1.png'),
                            path.join(__dirname, '../../public/img/betav3/beta3_2.png'),
                            path.join(__dirname, '../../public/img/betav3/vk.png'),
                        ]
                    }),(err,msg)=>{console.log(email,'>>>',err,msg);})
                });
            });
            // Go!
            Promise.all(usersPrms).then(function(data){
                res.json({success:true})
            }).catch(function(err){
                res.json({success:false,err:err});
            })
        });

    }
};