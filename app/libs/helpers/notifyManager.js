var mailer = require('./mailer');
var User = require('../../models/user').User;
var locales = require('../../locales');
var async = require('async');
var mongoose = require('mongoose');

function workWithName(user) {
    var hasAName = user.profile.name&&user.profile.lastName;
    return hasAName?user.profile.name+' '+user.profile.lastName:user.local.email;
}

function resolveType(type) {
    var splitter = type.split('-');
    return splitter[0][0].toUpperCase()+splitter[0].substr(1,splitter[0].length)+(splitter[1]?' '+splitter[1]:'')+(splitter[2]?' '+splitter[2]:'');
}


function _sendToUser(userId,notification,sender,cb){
    User.findOne({_id:userId},function(err,recipient){
        if(err) return cb(err);
        if(!recipient) return cb({message:'There is no user with such id...'});
        if(recipient && recipient.config.notifier) {
            var lang = recipient.system.language || 'en';
            // Translate info
            var info = {
                from: {
                    k: (locales[lang||'en']['from'] || 'from')+':  ',
                    v:  workWithName(sender)
                }
            };
            if(notification.text.info) {
                const keys = Object.keys(notification.text.info).sort((a,b)=>a-b);
                keys.forEach((key)=>{
                    info[key] = {
                        k: (locales[lang||'en'][key] || key)+':  ',
                        v: notification.text.info[key]
                    }
                    if(key=='xlink') {
                        info[key] = {
                            k: '',
                            v: `<a style="display:inline-block; color: #fff" href="${notification.text.info[key]}">${locales[lang||'en']['link']}</a>`
                        }
                    }
                });
            }
            // Replacement
            if(notification.text.replacement) {
                notification.text.message = locales[lang||'en'][notification.text.message] || notification.text.message;
                Object.keys(notification.text.replacement).forEach((key)=>{
                    notification.text.message = notification.text.message.replace(key,notification.text.replacement[key]);
                });
            }
            // Templater
            mailer.templater('notification',Object.assign({
                title: locales[lang||'en'][notification.type] || resolveType(notification.type),
                message: notification.text.message
            },{info:info}),lang).then(function(html){
                mailer.mailgun.messages().send(Object.assign(mailer.options,{
                    subject:  locales[lang||'en'][notification.type]+(info&&info.project?' ['+info.project.v+']':''),
                    to: recipient.local.email,
                    html: html
                }),function(err,info){
                    if(err) console.log('Error',err);
                    console.log('Message sent: ' + info.response,info);
                });
                cb(null,html);
            });
        }
    });
}


module.exports = {
    sendMail: function(notification,sender){
        return new Promise(function(resolve,reject){
            async.each(notification.recipients,(recipient,clbk)=>{
                _sendToUser(recipient,notification,sender,clbk)
            },(err,result)=>{
                if(err) return reject(err);
                resolve(result);
            });
        });
    }
};
