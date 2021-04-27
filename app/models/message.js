var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;

var messageSchema = new mongoose.Schema({
    text: String,
    owner: { type: Schema.Types.Mixed, ref: 'User' },
    project: String,
    likes: {type: Array, default: []},
    created: {type: Date, default: Date.now},
    attaches: [{type: Schema.Types.Mixed}]
});

var Message = mongoose.model('message', messageSchema);

exports.Message = Message;

