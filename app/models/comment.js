var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;
// Related models
var log = require('../libs/log/log');

var commentSchema = new mongoose.Schema({
    text: String,
    likes: {type: Array, default: []},
    owner: { type: Schema.Types.Mixed, ref: 'User' },
    sticker: String,
    task: String,
    file: String,
    folder: String,
    project: String,
    created: {type: Date, default: Date.now},
    attaches: [{type: Schema.Types.Mixed}]
});

var Comment = mongoose.model('Comment', commentSchema);

exports.Comment = Comment;

