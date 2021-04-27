var Project = require('../models/project').Project;
var Sticker = require('../models/sticker').Sticker;
var Message = require('../models/message').Message;
var Comment = require('../models/comment').Comment;
var Task = require('../models/task').Task;
var mongoose = require('mongoose');
/**
 * ACL middleware.
 * There is necessity to define who can\cannot work with
 * appropriate entity and action. entity_action = [role1,role2,role3]
 * roles - arbitrary strings
 * project_create = ['owner','co-author']
 */

function _equals(u1,cuid) {
    const id = u1._id || u1;
    return cuid.equals(id);
}

/**
 * Project roles will be defined according
 * project owner and appropriate shares
 * @param action - CRUD
 * @param entity - project,folder,file etc.
 * @returns {function(this:exports)}
 */
module.exports.can = function(action,entity) {
    return function(req,res,next) {
        var projectID = req.body.scope || req.query.scope || req.body.projectID || req.query.projectID || req.query.project || req.body.project  || req.params.id;
        if(!projectID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set project id parameter."}});
        Project.findOne({_id:projectID},function(err,project){
            if(err) return res.json({success:false,errors: {type:'accessError',message:"Can't find project",details:err}});
            if(!project) return res.json({success:false,errors: {type:'accessError',message:"There is no project with same id.",details:err}});
            // Maybe it will be useful to transmit project entity further
            res.project = project;
            res.role = 'all';
            // Are you an owner? Go ahead! You have full access anyway.
            if(_equals(project.owner,req.user._id)) res.role = 'project-owner';
            if(project.users.indexOf(req.user._id.toString())!==-1) res.role = 'project-co-author';
            if(project.invited.indexOf(req.user.local.email.toString())!==-1) {res.invited=true;res.role = 'project-co-author'};
            if(!req.ACL.data[action+'_'+entity]) return res.json({success:false,errors: {type:'accessError',message:"Something wrong with ACL."}});
            if(req.ACL.data[action+'_'+entity].indexOf(res.role)==-1) return res.json({success:false,errors: {type:'accessError',message:"You don't have access to manage this "+entity}});
            next();
        }.bind(this))
    }.bind(this);
}
/**
 * Accesses for stickers
 * @returns {function(this:exports)}
 */
module.exports.sticker = function(action){
    var role = null;
    return function(req,res,next) {
        var stickerID = req.params.id;
        if(!stickerID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set sticker id parameter."}});
        Sticker.findOne({_id:stickerID},function(err,sticker){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find sticker.",details:err}});
            if(!sticker) return res.json({success:false,errors:{type:"accessError",message:"There is no sticker with same id.",details:err}});
            res.sticker = sticker;
            Project.findOne({_id:sticker.project},function(err,project){
                if(err) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                if(!project) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                res.project = project;

                res.role = 'all';
                if(_equals(project.owner,req.user._id)) res.role = 'project-owner';
                if(project.users.indexOf(req.user._id.toString())!==-1) res.role = 'project-co-author';
                if(_equals(sticker.owner,req.user._id)) res.role = 'sticker-owner';

                if(!req.ACL.data[action+'_sticker']) return res.json({success:false,errors: {type:'accessError',message:"Something wrong with ACL."}});
                if(req.ACL.data[action+'_sticker'].indexOf(res.role)==-1) return res.json({success:false,errors: {type:'accessError',message:"You don't have access to manage this sticker"}});

                next();
            });
        });
    }.bind(this);
};

/**
 * Accesses for comments
 * @returns {function(this:exports)}
 */
module.exports.comment = function(action){
    var role = null;
    return function(req,res,next) {
        var commentID = req.params.id;
        if(!commentID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set comment id parameter."}});
        Comment.findOne({_id:commentID},function(err,comment){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find comment.",details:err}});
            if(!comment) return res.json({success:false,errors:{type:"accessError",message:"There is no comment with same id.",details:err}});
            res.comment = comment;
            Project.findOne({_id:comment.project},function(err,project){
                if(err) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                if(!project) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                res.project = project;

                res.role = 'all';
                if(_equals(project.owner,req.user._id)) res.role = 'project-owner';
                if(project.users.indexOf(req.user._id.toString())!==-1) res.role = 'project-co-author';
                if(_equals(comment.owner,req.user._id)) res.role = 'comment-owner';

                if(!req.ACL.data[action+'_comment']) return res.json({success:false,errors: {type:'accessError',message:"Something wrong with ACL."}});
                if(req.ACL.data[action+'_comment'].indexOf(res.role)==-1) return res.json({success:false,errors: {type:'accessError',message:"You don't have access to manage this comment"}});

                next();
            });
        });
    }.bind(this);
};

/**
 * Accesses for messages
 * @returns {function(this:exports)}
 */
module.exports.message = function(action){
    var role = null;
    return function(req,res,next) {
        var messageID = req.params.id;
        if(!messageID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set message id parameter."}});
        Message.findOne({_id:messageID},function(err,message){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find message.",details:err}});
            if(!message) return res.json({success:false,errors:{type:"accessError",message:"There is no message with same id.",details:err}});
            res.comment = message;
            Project.findOne({_id:message.project},function(err,project){
                if(err) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                if(!project) return res.json({success:false,errors:{type:'accessError',message:"Project is not found"}});
                res.project = project;

                res.role = 'all';
                if(_equals(project.owner,req.user._id)) res.role = 'project-owner';
                if(project.users.indexOf(req.user._id.toString())!==-1) res.role = 'project-co-author';
                if(_equals(message.owner,req.user._id)) res.role = 'message-owner';


                if(!req.ACL.data[action+'_message']) return res.json({success:false,errors: {type:'accessError',message:"Something wrong with ACL."}});
                if(req.ACL.data[action+'_message'].indexOf(res.role)==-1) return res.json({success:false,errors: {type:'accessError',message:"You don't have access to manage this comment"}});

                next();
            });
        });
    }.bind(this);
};

/**
 * Accesses for tasks
 * @returns {function(this:exports)}
 */
module.exports.task = function(action){
    var role = null;
    return function(req,res,next) {
        var taskID = req.body.path;
        if(!taskID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set task id parameter."}});
        Task.findOne({_id:taskID},function(err,task){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find task.",details:err}});
            if(!task) return res.json({success:false,errors:{type:"accessError",message:"There is no task with same id.",details:err}});
            res.task = task;
            Project.findOne({_id:task.scope},function(err,project){
                res.role = '';
                if(project.owner==req.user._id) res.role+= 'project-owner';
                if(task.owner.equals(req.user._id)) res.role+= ',task-owner';
                if(project.users.indexOf(req.user._id)!==-1) res.role+=',project-co-author';
                if(task.assignee && task.assignee.equals(req.user._id)) res.role+=',assignee';

                role = res.role || 'xxx';

                if(!req.ACL.data[action+'_task']) return res.json({success:false,errors: {type:'accessError',message:"Something wrong with ACL."}});
                if(!_checkStringRoles(req.ACL.data[action+'_task'],role)) return res.json({success:false,errors: {type:'accessError',message:"You don't have access to manage this task"}});
                next();
            });
        });
    }.bind(this);
};

function _checkStringRoles(data,roleString){
    const roles = roleString.split(',');
    let fit = false;
    roles.forEach((role)=>{if(data.indexOf(role)!==-1) fit = true;});
    return fit;
}
