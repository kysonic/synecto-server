var router = require('express').Router();
// Middlewares
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
var premium = require('../middlewares/premium');
// Models
var Project = require('../models/project').Project;
var Task = require('../models/task').Task;
var User = require('../models/user').User;
var File = require('../models/file').File;
var Notification = require('../models/notification').Notification;
// Misc
var async = require('async');
var utils = require('../libs/helpers/utils');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
// Regular expression for default scope
var ANY = /.*/;
var SEPARATOR = '/';
var POSSIBLE_QUERY_FIELDS = ['scope','removed','parent','status'];

var assigneeFields = ['status'];
var tokenizer = require('../middlewares/tokenizer');
var notifyManager = require('../libs/helpers/notifyManager');
var config = require('../config');

function checkAssigneeUpdateField(data) {
    var is = false;
    for(var p in data) {
        if(assigneeFields.indexOf(p)==-1) is = true;
    }
    return is;
}

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),ACL.can('read','task'),this.getList);
        router.get('/check-expired',tokenizer,this.checkExpired);

        router.post('/',cors(corsOpts),auth,ACL.can('create','task'),this.createTask);
        router.get('/:id',cors(corsOpts),ACL.task('read'),this.readTask);
        router.put('/',cors(corsOpts),auth,ACL.task('update'),this.updateTask);
        router.delete('/',cors(corsOpts),auth,ACL.can('delete','project'),this.deleteTasks);

        router.put('/:id/follow',cors(corsOpts),auth,ACL.can('read','project'),this.followTask);
        router.delete('/:id/follow',cors(corsOpts),auth,ACL.can('read','project'),this.unfollowTask);

        router.put('/position',cors(corsOpts),auth,ACL.can('update','task'),this.updateTasksPosition);

        return router;
    },
    /**
     * Get tasks list
     */
    getList: function(req,res,next){
        Task.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).sort({path:1}).exec((err,tasks)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!tasks) return res.json({success:false,errors:{message:'Cannot find tasks.'}});
            res.json({success:true,message:'Tasks were fetched successfully',tasks:tasks,role:res.role});
        });
    },
    /**
     * Create new task inside project
     */
    createTask: function(req,res,next){
        delete req.body.data._id;
        // Followers
        req.body.data.followers = [res.project.owner];
        if(res.project.owner!=req.user._id) req.body.data.followers.push(req.user._id);
        // Insert
        Task.$insert(req.body.data,req.body.path,req.body.projectID).then((task)=>{
            res.json({success:true,message:"Task was created successfully.",task:task});
        },(err)=>{
            return res.json({success:false,errors:{type:"taskError",message:"Can't create task.",details:err}});
        });
    },
    /**
     * Read task
     */
    readTask: function(req,res,next){
        Task.findById(req.params.id,(err,task)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!task) return res.json({success:false,errors:{message:'Cannot find task.'}});
            if(!req.query.tree) return res.json({success:true,task:task,message:'Task was found properly.',role:res.role});
            // Build tree if tree query param was transmitted.
            Task.$buildTree('/'+task.name+'/',task.scope,{removed:req.query.removed||false}).then((tree)=>{
                res.json({success:true,message:'Tree was built successfully.',tree:tree});
            },(err)=>{
                res.json({success:false,errors: {type:'taskError',message:"Can't build tree",details:err}});
            });
        });
    },
    /**
     * Update task
     */
    updateTask: function(req,res,next){
        if(res.role=='assignee' && (checkAssigneeUpdateField(req.data))) return;
        Task.$update(req.body.data,req.body.path,req.body.projectID).then((task)=>{
            // Can't populate. Made it's by itself
            res.json({success:true,message:"Task was updated successfully.",task:task});
        },(err)=>{
            console.log(err);
            return res.json({success:false,errors:{type:"taskError",message:"Can't update task.",details:err}});
        });
    },
    /**
     * Remove task.
     * Find all dependencies like sub-tasks and
     * files and remove it as well
     */
    deleteTasks: function(req,res,next){
        Task.find({'_id':{$in:req.body.tasks.map((task)=>task._id)}},function(err,tasks){
            if(err)  return res.json({success:false,errors:{type:"taskError",message:"Cannot remove tasks"}});
            const folderPromises = tasks.map((folder)=>folder.remove());
            Promise.all(folderPromises).then(()=>{
                res.json({success:true,message:'Tasks was removed successful'});
            }).catch((err)=>res.json({success:false,errors:{type:"folderError",message:"Cannot remove tasks",details:err}}));
        });
    },
    /**
     * Follow task
     */
    followTask: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"taskError",message:"You forgot to set task id."}});
        Task.findById(req.params.id,(err,task)=>{
            if(err) return res.json({success:false,errors:{type:"taskError",message:"Cannot find task",details:err}});
            const followers = task.followers || [];
            if(followers.indexOf(req.body.follower)!==-1) return res.json({success:false,errors:{type:"taskError",message:"You are already there",details:err}});
            followers.push(req.body.follower);
            task.followers = followers;
            task.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"taskError",message:"Cannot update task",details:err}});
                res.json({success:true,message:"Task was updated successfully.",task:task});
            });
        })
    },
    /**
     * Follow task
     */
    unfollowTask: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"taskError",message:"You forgot to set task id."}});
        Task.findById(req.params.id,(err,task)=>{
            if(err) return res.json({success:false,errors:{type:"taskError",message:"Cannot find task",details:err}});
            const followers = task.followers || [];
            if(followers.indexOf(req.body.follower)==-1) return res.json({success:false,errors:{type:"taskError",message:"You are already gone",details:err}});
            followers.splice(followers.indexOf(req.body.follower),1);
            task.followers = followers;
            task.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"taskError",message:"Cannot update task",details:err}});
                res.json({success:true,message:"Task was updated successfully.",task:task});
            });
        })
    },
    /**
     * Update task
     */
    updateTasksPosition: function(req,res,next){
        const tasks = req.body.tasks;
        const promises = tasks.map((task)=>Task.update({_id:task._id},{$set:{position:task.position}}));
        Promise.all(promises).then((result)=>{
            res.json({success:true,message:"Positions were updated.",task:result});
        }).catch((err)=>{
            if(err) return res.json({success:false,errors:{type:"taskError",message:"Cannot update tasks position",details:err}});
        })
    },

    /**
     * Check all user's expired tasks
     */
    checkExpired: function(req,res,next){
        User.find({},function (err,users) {
            if(err) return res.json({success:false,errors:err});
            async.each(users,function(user,cb){
                const date = new Date();
                date.setHours(date.getHours() + 24);
                const today = new Date();
                Task.find({assignee:user._id,expired:{$lt:date,$gt:today},status:{$ne:'completed'}},function(err,tasks){
                    if(tasks.length) {
                        var notification = new Notification({
                            sender: user._id,
                            recipients: [user._id],
                            type: 'deadline',
                            text: {
                                message: 'You have tasks requiring your attention. Go to Synecto to find more information.',
                                replacement: {},
                                info: {
                                    xlink: config.get('appLink')
                                }
                            }
                        });
                        notification.save(function(err,notification){
                            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot create notification",details:err}});
                            notifyManager.sendMail(notification,user).catch((e)=>console.log(e));
                        });
                    }
                    cb(null,tasks);
                })
            },
            function(err,results){
                if(err) return res.json({success:false,errors:err});
                res.json({success:true,results: results});
            });
        })
    }
};
