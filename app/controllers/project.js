var router = require('express').Router();
// Models
var Project = require('../models/project').Project;
var Folder = require('../models/folder').Folder;
var File = require('../models/file').File;
var User = require('../models/user').User;
// Accesses
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
var log = require('../libs/log/log');
// Misc
var async = require('async');
var fHelper = require('../libs/helpers/folderHelper');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
var gcs = require('../libs/storages/gcs');
var initialData = require('../libs/helpers/initialData');
var fileRemover = require('../libs/helpers/fileRemover');

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));
        
        router.get('/',cors(corsOpts),auth,this.getList);

        router.post('/',cors(corsOpts),auth,this.createProject);
        router.get('/:id',cors(corsOpts),auth,ACL.can('read','project'),this.readProject);
        router.put('/:id',cors(corsOpts),auth,ACL.can('update','project'),this.updateProject);
        router.delete('/:id',cors(corsOpts),auth,ACL.can('delete','project'),this.deleteProject);

        return router;
    },
    /**
     * Get User project List.
     * {name,id}
     */
    getList: function(req,res,next) {
        Project.find({owner:req.user._id}).lean().exec(function(err,projects){
            if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot find projects",details:err}});
            Project.find({users:{$in:[req.user._id.toString(),req.user._id]}}).populate('owner').lean().exec(function(err,shared){
                if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot find projects",details:err}});
                return res.json({success:true,
                    projects:projects.map(function(project){return {name:project.name,_id:project._id,closed:project.closed,views:project.views}}),
                    shared: shared.map(function(project){
                        const user = {
                            profile: project.owner.profile,
                            local: {
                                email: project.owner.local.email
                            }
                        };
                        return {name:project.name,_id:project._id,closed:project.closed,user:user, views: project.views}
                    })
                });
            });
        });
    },
    /**
     * Get project data by id.
     */
    readProject: function(req,res,next){
        Project.findById(req.params.id).populate('users','-plan -google -local.password -config -__v -isPremium').lean().exec(function(err,project){
            if(err) return res.json({success:false,errors:err.errors});
            if(!project) return res.json({success:false,errors:{message:'Cannot find project.'}});
            //if(project.closed) return res.json({success:false,errors:{message:'Project is closed'}});
            User.findOne({_id:project.owner},{
                    plan:0,
                    "local.password":0,
                    google:0,
                    config:0,__v:0,
                    'system.approved':0,
                    'system.language':0,
                    'system.lastChatReview':0,
                    'system.tutorials':0
            },function(err,user){
                // Inc views
                const upd = {$inc:{views:1}};
                // Resolve invited
                if(res.invited) {
                    const invIndx = project.invited.indexOf(req.user.local.email);
                    project.invited.splice(invIndx,1);
                    const users = project.users.map((user)=>user._id);
                    users.push(req.user._id);
                    upd['$set'] = {invited: project.invited,users:users};
                    project.users.push(req.user);
                }
                Project.update({_id:req.params.id},upd,(err,res)=>{});
                // Itegrations...
                user.system.integrations =  user.system.integrations || [];
                // Map integrations
                Object.keys(user.system.integrations).forEach((intKey)=>{
                    user.system.integrations[intKey] = user.system.integrations[intKey] ? !!user.system.integrations[intKey].token : false;
                });
                project.ownerData = user;
                if(user.plan.expired<new Date()) return res.json({success:false,errors:{code:'planExpired',message:'Your plan is expired. Upgrade it to proceed.'}});
                res.json({success:true,project:project,role:res.role,users:project.users.concat([user])});
            });
        });
    },
    /**
     * Create new empty project.
     * This operation also will create
     * first folder in project's structure
     */
    createProject: function(req,res,next) {
        Project.find({owner:req.user._id},function(err,docs){
            if(err) return res.json({success:false,errors:{type:'projectError',message:"Can't save project",details:err}});
            if(docs.length>=req.user.plan.projects) return res.json({success:false,errors:{type:'premiumError',message:"You can create only #COUNT# projects, according your plan.",details:err}});
            // Create new project
            var project = new Project({
                owner: req.user._id,
                name: req.body.name,
                users: []
            });
            // Save project
            project.save((err,project)=>{
                if(err) return res.json({success:false,errors:{type:'projectError',message:"Can't save project",details:err}});
                initialData.initialData(project,req.user).then(function(){
                    res.json({success:true,message:"Project was created successfully.",project:project});
                }).catch(function(err){ 
                    return res.json({success:false,errors:{type:'projectError',message:"Can't save project",details:err}});
                });
            });

        });
    },
    /**
     * Update project
     * @returns {*}
     */
    updateProject: function(req,res,next){
        if(req.body.users && req.body.users.length>req.user.plan.teamMembers) return res.json({success:false,errors:{message:"Do not try to cheat us man..."}});
        //if(req.body.users && req.body.users.length>10) return res.json({success:false,errors:{message:"Synecto beta version does not support more than 10 members..."}});
        Project.findById(req.params.id,(err,project)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!project) return res.json({success:false,errors:{message:'Cannot find project.'}});
            // User cannot be object, hook... shitty hook]
            const data = req.body;
            if(data.users) data.users = data.users.map((user)=>{
                return user&&user._id ? user._id : user;
            });
            const updated = Object.assign(project,data);
            Project.update({_id:project._id},updated,function(){
                if(err) return res.json({success:false,errors:err.errors});
                res.json({success:true,project:updated});
            });
        });
    },
    /**
     * Delete project
     */
    deleteProject: function(req,res,next){
        Project.findOne({_id:req.params.id},function(err,project){
            if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot remove project.",details:err}});
            // Find project's files
            File.find({project:project._id},(err,files)=>{
                if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot project files.",details:err}});
                //  Remove all project's files from storage at first
                fileRemover(files,project.owner).then(()=>{
                    project.remove((err,data)=>{
                        if(err) return res.json({success:false,errors:{type:"projectError",message:"Cannot remove project.",details:err}});
                        res.json({success:true,message:"Project was removed successfully."});
                    });
                }).catch((err)=>res.json({success:false,errors:{type:"projectError",message:"Cannot remove project.",details:err}}))
            });
        });
    }
};
