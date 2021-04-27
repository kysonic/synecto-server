var mongoose = require('../libs/db/mongoose');
var async = require('async');
var Schema = mongoose.Schema;
// Plugins
var materialized = require('../libs/db/materialized');
var deepPopulate = require('mongoose-deep-populate')(mongoose);
// Misc
var log = require('../libs/log/log');
var Comment = require('./comment').Comment;

var taskSchema = new mongoose.Schema({
    name: String,
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null},
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null},
    description: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        default: 'task'
    },
    status: {
      type: String,
      default: 'incomplete',
      enum: ['in_progress','completed','incomplete','expired']
    },
    label: String,
    grade: {type: Schema.Types.Mixed, default: {}},
    time: {type: Schema.Types.Mixed, default: {spent:0,start:'',run:false,request:0}},
    parent: {type: String},
    created: { type: Date, default: Date.now },
    modified: { type: Date, default: Date.now },
    completed: { type: Date, default: Date.now },
    removed: { type: Boolean, default: false },
    removedBy: { type: Object, default: {user:null,default:Date.now} },
    expired: {type: Date, default: Date.now},
    files: [{type: Schema.Types.ObjectId,ref:'File'}],
    tasks: [{type: Schema.Types.ObjectId,ref:'Task'}],
    followers:[{type: Schema.Types.ObjectId, ref:'User'}],
    position: {type:Number,default:0},
    dependencies: [{type: String}]
});

taskSchema.plugin(deepPopulate,{populate:{'files':{match:{removed:false}}}});
taskSchema.plugin(materialized,{field:'name',separator:'/'});

// Remove file from task
taskSchema.post('remove',(doc)=>{
    // Remove all children on current level.
    Task.find({scope:doc.scope,path:Task.buildFullPath(doc)},(err,docs)=>{
        if(err) return log.debug(`[models:folder:post:remove]>Cannot find children. Details. ${err}`);
        docs.forEach((doc)=>{
            doc.remove((err,data)=>{
                if(err) return log.debug(`[models:folder:post:remove]>Cannot remove child folder. Details. ${err}`);
                log.debug(`[models:folder:post:remove]>Child folder was removed. Details. ${data}`);
            });
        });
    });
    Comment.find({task:doc._id}).remove().exec();
});

var Task = mongoose.model('task', taskSchema);

exports.Task = Task;

