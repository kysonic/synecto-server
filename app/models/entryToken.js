var mongoose = require('../libs/db/mongoose');

var schema = new mongoose.Schema({
    token: String,
    userID: String,
    email: String,
    createdAt: { type: Date, expires: 60*20 }
});

schema.pre('save',function(next){
    this.createdAt = new Date(); next();
});

var EntryToken = mongoose.model('entryToken', schema);

exports.EntryToken = EntryToken;

