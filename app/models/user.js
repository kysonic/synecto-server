var mongoose = require('../libs/db/mongoose');
var bcrypt = require('bcrypt-nodejs');
var async = require('async');

/*var DEFAULT_DATE = new Date();
DEFAULT_DATE.setFullYear(1900);
DEFAULT_DATE.setMonth(1);
DEFAULT_DATE.setDate(1);*/
var Schema = mongoose.Schema;

var schema = new mongoose.Schema({
    // Profile
    profile: {
        name: String,
        lastName: String,
        birthDate: {type: Date, default: Date.now},
        company: String,
        avatar: String,

        address: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        phoneNumber: String,
        agreedPersonal: {type: Boolean, default: false}
    },
    local: {
        email: {
            type: String,
            unique: true,
            required: true
        },
        password: {
            type: String
        }
    },
    google: {
       email: {
           type: String
       }
    },
    plan: {
        name:{type:String, default:'startup'},
        upload:{type:Number, default:0},
        teamMembers:{type:Number, default:2},
        storage:{type:Number, default:512},
        projects:{type:Number, default:3},
        expired: {type:Date,default: new Date(2090, 6, 7)}
    },
    // Systems
    system: {
        lastOpenedProject: String,
        lastChatReview: {type: Date, default: Date.now},
        lastLogin: {type: Date, default: Date.now},
        integrations: Object,
        tutorials: {type: Boolean,default: false},
        language: {type:String,default: 'en'},
        approved: {type:Boolean,default: false},
        appToken: {type: String}
    },
    // Configs
    config: {
        notifyLifeTime: {type: Number,default:1},
        totalStickersCount: {type: Number,default:20},
        stickersCount: {type: Number,default:5},
        synectoNews: {type: Boolean,default:true},
        notifier: {type: Boolean,default:true},
        systemAlerts: {type: Boolean,default:true}
    },
    created: {type: Date, default: Date.now},
    online: {type:Boolean,default:false}
});

// generating a hash
schema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
schema.methods.validPassword = function (password) {
    if(!this.local.password) return false;
    return bcrypt.compareSync(password, this.local.password);
};
/**
 * Remove user completely
 */
schema.methods.suicide = function(){
    // Models
    var Project = require('./project').Project;
    var Notification = require('./notification').Notification;
    return new Promise((resolve,reject)=>{
        async.parallel([
            (callback)=>{
                // Remove all user's projects
                Project.find({owner:this._id},(err,projects)=>{
                    if(err) return reject(err);
                    async.each(projects,(project,cb)=>{
                        project.remove((err)=>{
                            if(err) return reject(err);
                            cb(null);
                        });
                    },(err,results)=>{
                        if(err) return reject(err);
                        callback(null);
                    });
                });
            },
            (callback)=>{
                // Remove all user's notifications
                Notification.find({recipient:this._id},(err,notifies)=>{
                    if(err) return reject(err);
                    async.each(notifies,(notify,cb)=>{
                        notify.remove((err)=>{
                            if(err) return reject(err);
                            cb(null);
                        });
                    },(err,results)=>{
                        if(err) return reject(err);
                        callback(null);
                    });
                });
            }
        ],(err,results)=>{
            if(err) return reject(err);
            //Wait before all related entities will be removed
            setTimeout(function(){
                this.remove((err,res)=>{
                    if(err) return reject(err);
                    resolve(res);
                });
            }.bind(this),5000);
        });
    });
}

var User = mongoose.model('User', schema);


exports.User = User;

