var mongoose = require('../libs/db/mongoose');
var crypto = require('crypto');

var schema = new mongoose.Schema({
    token: String,
    projectId: String,
    projectName: String,
    ownerEmail: String,
    email: String,
    createdAt: { type: Date, expires: 60*60*24*2 }
});

schema.pre('save',function(next){
    this.createdAt = new Date(); next();
});

/**
 * Generate token
 * @returns {string|*}
 */
schema.statics.generate = function(){
    return crypto.randomBytes(32).toString('hex');
}

var InviteToken = mongoose.model('inviteToken', schema);

exports.InviteToken = InviteToken;

