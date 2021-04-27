var mongoose = require('../libs/db/mongoose');
var crypto = require('crypto');

var schema = new mongoose.Schema({
    token: String,
    email: String
});
/**
 * Generate token
 * @returns {string|*}
 */
schema.statics.generate = function(){
    return crypto.randomBytes(32).toString('hex');
}

var ApproveToken = mongoose.model('approveToken', schema);

exports.ApproveToken = ApproveToken;

