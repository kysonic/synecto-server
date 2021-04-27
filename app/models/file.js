var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;
// Storages
var storages = {};
// Removing
/*storages.dropBox = require('../libs/storages/dropBox');
storages.googleDrive = require('../libs/storages/googleDrive');
storages.yandexDisk = require('../libs/storages/yandexDisk');
storages.designmap = require('../libs/storages/designmap');*/
/*storages.gcs = require('../libs/storages/gcs');*/
// Utils
var log = require('../libs/log/log');

var fileSchema = new mongoose.Schema({
    data: Object,
    preview: Object,
    owner: String,
    project: String,
    folder: String,
    task: String,
    completed: {type: Boolean,default: false},
    stickers: [{type: Schema.Types.ObjectId, ref:'Sticker'}],
    description: {type: String, default: ''},
    type: {type: String, default: 'file'},
    locked: {type: Boolean, default: false},
    removed: {type: Boolean, default: false},
    removedBy: { type: Object, default: {user:null,default:Date.now} },
    created: { type: Date, default: Date.now },
    modified: { type: Date, default: Date.now },
    followers:[{type: Schema.Types.ObjectId, ref:'User'}],
});

// Remove ids in related  folder
fileSchema.post('remove',(doc)=>{
    const Sticker = require('./sticker').Sticker;

    log.debug(`[models:file:post:remove]>Starting post remove hook. Details. ${doc}`);

    Sticker.find({file:doc._id},(err,stickers)=>{
        if(err) return log.debug(`[models:file:post:remove]>Cannot find stickers. Details. ${err}`);
        if(!stickers) return log.debug(`[models:file:post:remove]>Cannot find stickers. Details. ${err}`);
        // Removing
        stickers.forEach((sticker)=>{
            sticker.remove((err,data)=>{
                if(err) return log.debug(`[models:file:post:remove]>Cannot remove sticker. Details. ${err}`);
                log.debug(`[models:file:post:remove]>Sticker was removed. Details. ${data}`);
            });
        });
    });

    // Remove associated file from storage

});


var File = mongoose.model('File', fileSchema);

exports.File = File;

