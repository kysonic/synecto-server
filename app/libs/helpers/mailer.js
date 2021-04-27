var nodemailer = require('nodemailer');
var pug = require('pug');
var fs = require('fs');
var path = require('path');
var locales = require('../../locales');
var config = require('../../config');
//Mailgun
var mailgun = require('mailgun-js')({apiKey: config.get('mailgun').apiKey, domain: config.get('mailgun').domain});

// SMTP
smtpConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'designmap.io@gmail.com',
        pass: 'ioioio'
    }
};
// Default mail options
module.exports.options = {
    from: 'Synecto <email@synecto.io>',
    subject: 'Seynecto Reported',
    inline: path.join(__dirname, '../../../public/img/logo.png')
}
// Transporter
module.exports.transporter = nodemailer.createTransport(smtpConfig);
module.exports.mailgun = mailgun;

var presetLocales = {
    'welcome': [{title:'welcomeTitle'},{welcomeTokenMessage:'welcomeTokenMessage'},{message:'welcomeMessage'},{welcomeTileOne:'welcomeTileOne'},{welcomeTileTwo:'welcomeTileTwo'},{welcomeTileThree:'welcomeTileThree'},{welcomeTileFour:'welcomeTileFour'},{welcomePasswordTitle:'welcomePasswordTitle'}],
    'notification': [],
    'password-changed': [{title:'forgotPasswordTitle'},{forgotPasswordTitle:'forgotPasswordSubTitle'}],
    'password-restore': [{title:'restorePasswordTitle'},{restorePasswordTitle:'restorePasswordSubTitle'},{message:'restorePasswordMsg'},{restore:'restore'}],
    'invitation-success': [{title:'invtSuccessTitle'},{message:'invtSuccessMessage'}],
    'invite-user': [{title:'invitationTitle'},{subtitle:'invitationSubTitle'},{message:'inviteUserMsg'},{'youWereInvatedBy':'youWereInvatedBy'},{'toJoin':'toJoin'},{join:'join'},{projectEn:'projectEn'},{projectRu:'projectRu'}],
    'reapprove': [{title:'reapproveTitle'},{message:'reapproveMsg'},{reapprove:'reapprove'}],
    'betav3':[{greeting:'greeting'},{betav3Title:'betav3Title'},{betav3SubTitle:'betav3SubTitle'},{betav3Prop1:'betav3Prop1'},{wannaTry:'wannaTry'},{betav3Prop2:'betav3Prop2'},{betav3Ending:'betav3Ending'}],
    'success-payment':[{greeting:'greeting'},{paymentSuccessTitle:'paymentSuccessTitle'},{betav3Ending:'betav3Ending'},{plan:'plan'},{hasBeenConnected:'hasBeenConnected'},{details:'details'},{planManagement:'planManagement'}]
}

function extractLocals(tpl,lang){
    var locals = {};
    var preset = presetLocales[tpl] || [];
    preset.concat([{enjoy:'enjoy'},{teamMsg:'teamMsg'},{antonMsg:'antonMsg'},{visitApp:'visitApp'}]).forEach(function(local){
        var key = Object.keys(local)[0];
        locals[key] = locales[lang||'en'][local[key]] || local[key];
    });
    locals['lang'] = lang;
    return locals;
}

// Templater
module.exports.templater = function(tpl,locals,lang){
    return new Promise((resolve,reject)=>{
        fs.readFile(`./public/email-templates/${tpl}.pug`,function(err,template) {
            if(err) return reject(err);
            var fn = pug.compile(template, {filename:'pug'});
            var loc = Object.assign(extractLocals(tpl,lang),locals);
            resolve(fn(loc));
        });
    });
}
