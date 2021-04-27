var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;
// Plugins
var materialized = require('../libs/db/materialized');
var deepPopulate = require('mongoose-deep-populate')(mongoose);
// Models
var File = require('./file').File;
// Utils
var log = require('../libs/log/log');

var gcs = require('../libs/storages/gcs')

var folderSchema = new mongoose.Schema({
    name: String,
    owner: String,
    type: {type: String, default: 'folder'},
    removed: {type: Boolean, default: false},
    removedBy: { type: Object, default: {user:null,default:Date.now} },
    parent: {type: String},
    color: {type: String},
    created: { type: Date, default: Date.now },
    modified: { type: Date, default: Date.now },
    files: [{type: Schema.Types.ObjectId,ref:'File'}]
});

folderSchema.plugin(deepPopulate,{populate:{'files':{match:{removed:false}}}});
folderSchema.plugin(materialized,{field:'name',separator:'/'});

// Remove all related entities
folderSchema.post('remove',(doc)=>{
    log.debug(`[models:folder:post:remove]>Starting post remove hook. Details. ${doc}`);
    // Remove all children on current level.
    Folder.find({scope:doc.scope,path:Folder.buildFullPath(doc)},(err,docs)=>{
        if(err) return log.debug(`[models:folder:post:remove]>Cannot find children. Details. ${err}`);
        docs.forEach((doc)=>{
            doc.remove((err,data)=>{
                if(err) return log.debug(`[models:folder:post:remove]>Cannot remove child folder. Details. ${err}`);
                log.debug(`[models:folder:post:remove]>Child folder was removed. Details. ${data}`);
            });
        });
    });
    // Remove all files of this folder.
    File.find({folder:doc._id},(err,files)=>{
        if(err) return log.debug(`[models:folder:post:remove]>Cannot find files. Details. ${err}`);
        if(!files) return log.debug(`[models:folder:post:remove]>Cannot find files. Details. ${err}`);
        // Remove files db instances
        files.forEach((file)=>{
            file.remove((err,data)=>{
                if(err) return log.debug(`[models:folder:post:remove]>Cannot remove file. Details. ${err}`);
                log.debug(`[models:folder:post:remove]>File was removed. Details. ${data}`);
            });
        });
    });
});

var Folder = mongoose.model('Folder', folderSchema);

exports.Folder = Folder;

