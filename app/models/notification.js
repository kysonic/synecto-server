var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;

var notificationSchema = new mongoose.Schema({
    text:  Schema.Types.Mixed,
    type:  String,
    sender: { type: Schema.Types.Mixed, ref: 'User' },
    recipients: [{type: Schema.Types.ObjectId, ref:'User'}],
    read: {type: Boolean, default: false},
    created: {type: Date, default: Date.now}
});


var Notification = mongoose.model('Notification', notificationSchema);

exports.Notification = Notification;

