var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;
// Related models
var File = require('./file').File;
var Comment = require('./comment').Comment;
var log = require('../libs/log/log');

var stickerSchema = new mongoose.Schema({
    position: Object,
    scale: Number,
    owner: { type: Schema.Types.Mixed, ref: 'User' },
    file: String,
    folder: String,
    project: String,
    comments: [{type: Schema.Types.ObjectId,ref:'Sticker'}]
});
/**
 * Find all of user's stickers from bunch
 * @param stickers - sticker bunch
 * @param ownerId - owner ID
 * @returns {Array}
 */
stickerSchema.statics.usersStickers = function(stickers,ownerId){
    var usersStickers = [];
    stickers.forEach((sticker)=>{
        if(sticker.owner&&sticker.owner._id==ownerId) usersStickers.push(sticker);
    });
    return usersStickers;
}


stickerSchema.post('remove',(doc)=>{
    log.debug(`[models:sticker:post:remove]>Starting post remove hook. Details. ${doc}`);
    //Remove all related comments
    Comment.find({sticker:doc._id}).remove().exec();
});

var Sticker = mongoose.model('Sticker', stickerSchema);

exports.Sticker = Sticker;

