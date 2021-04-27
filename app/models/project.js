var mongoose = require('../libs/db/mongoose');
var Schema = mongoose.Schema;
// Models
var Folder = require('./folder').Folder;
var File = require('./file').File;
var Task = require('./task').Task;
// Utils
var log = require('../libs/log/log');

var schema = new mongoose.Schema({
    owner: {type: String, ref: 'User'},
    name: String,
    closed: {type:Boolean,default:false},
    users: [{type: Schema.Types.Mixed, ref: 'User'}],
    invited: [],
    views: {type: Number,default:0},
    settings: {
        type: Object,
        default: {
            taskManager: {
                type: Object,
                labels: []
            }
        }
    }
});


// Remove associated with project data
schema.post('remove', (doc) => {
    log.debug(`[models:project:post:remove]>Starting post remove hook. Details. ${doc}`);

    // Remove all folders on first level
    Folder.find({scope: doc._id, path: null}, (err, docs) => {
        if (err) return log.debug(`[models:project:post:remove]>Cannot find base folders. Details. ${err}`);
        docs.forEach((doc) => {
            doc.remove((err, data) => {
                if (err) return log.debug(`[models:project:post:remove]>Cannot remove folder. Details. ${err}`);
                log.debug(`[models:project:post:remove]>Base folder was removed. Details. ${data}`);
            });
        });
    });
    // Remove all files on first level
    File.find({project: doc._id, path: null}, (err, docs) => {
        if (err) return log.debug(`[models:project:post:remove]>Cannot find base files. Details. ${err}`);
        docs.forEach((doc) => {
            doc.remove((err, data) => {
                if (err) return log.debug(`[models:project:post:remove]>Cannot remove file. Details. ${err}`);
                log.debug(`[models:project:post:remove]>Base file was removed. Details. ${data}`);
            });
        });
    });
    // Remove all tasks on first level
    Task.find({scope: doc._id, path: null}, (err, docs) => {
        if (err) return log.debug(`[models:project:post:remove]>Cannot find base folder. Details. ${err}`);
        docs.forEach((doc) => {
            doc.remove((err, data) => {
                if (err) return log.debug(`[models:project:post:remove]>Cannot remove folder. Details. ${err}`);
                log.debug(`[models:project:post:remove]>Base task was removed. Details. ${data}`);
            });
        });
    });
});

var Project = mongoose.model('Project', schema);

exports.Project = Project;

