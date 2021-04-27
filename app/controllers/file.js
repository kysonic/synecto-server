var router = require('express').Router();
// Models
var Folder = require('../models/folder').Folder;
var File = require('../models/file').File;
var Project = require('../models/project').Project;
// Accesses
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
// Misc
var https = require('https');
var multiparty = require('multiparty');
var utils = require('../libs/helpers/utils');
var request = require('request');
var fs = require('fs');
var async = require('async');
var imgConverter = require('../libs/img/img-converter');
var log = require('../libs/log/log');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');

var smartUserPopulate = require('../libs/db/smartUserPopulate');

var fileRemover = require('../libs/helpers/fileRemover');
var gcs = require('../libs/storages/gcs');
var googleDrive = require('../libs/storages/googleDrive');

var SUPPORTED_STORAGES = ['dropBox','googleDrive','yandexDisk','designmap','gcs'];

// Regular expression for default scope
var ANY = /.*/;
var POSSIBLE_QUERY_FIELDS = ['scope','removed','folder','project','task'];
var actions = {
    '$exist': {'$ne':null}
}
function buildQuery(query){
    var q = {};
    Object.keys(query).forEach(function(f){
        var v = query[f];
        q[f] = actions[v] || v;
    });
    return q;
}

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),ACL.can('read','file'),this.getList);

        router.post('/',cors(corsOpts),auth,ACL.can('create','file'),this.createFiles);
        router.post('/doc',cors(corsOpts),auth,ACL.can('create','file'),this.createDoc);
        router.get('/:id',cors(corsOpts),auth,ACL.can('read','file'),this.readFile);
        router.put('/:id',cors(corsOpts),auth,ACL.can('update','file'),this.updateFile);
        router.delete('/',cors(corsOpts),auth,ACL.can('delete','file'),this.deleteFiles);

        router.put('/:id/follow',cors(corsOpts),auth,ACL.can('read','project'),this.followFile);
        router.delete('/:id/follow',cors(corsOpts),auth,ACL.can('read','project'),this.unfollowFile);

        /*router.put('/preview/:id',cors(corsOpts),auth,ACL.can('update','file'),this.uploadPreview);*/

        return router;
    },
    /**
     * Get folders list
     */
    getList: function(req,res,next){
        File.find(buildQuery(utils.keep(req.query,POSSIBLE_QUERY_FIELDS))).lean().exec((err,files)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!files) return res.json({success:false,errors:{message:'Cannot find files.'}});
            res.json({success:true,message:"Files were received successfully.",files:files});
        });
    },
    /**
     * Deprecated
     */
    __createFile: function(req,res,next){
        var form = new multiparty.Form();
        form.parse(req, function(err, fields, files) {
            if(err) return res.json({success:false,errors:{type:'fileError',message:"Can't receive file.",details:err}});
            // Get appropriate fields
            var storage = fields.storage[0];
            var id = fields.id[0];
            // Check storage
            if(SUPPORTED_STORAGES.indexOf(storage)==-1) return res.json({success:false,errors:{type:'fileError',message:"This file storage isn't supported."}});
            if(!res.project || !res.project.owner) return res.json({success:false,errors:{type:'fileError',message:"Project owner not found."}});
            if(!(req.query.folder||req.query.task)) return res.json({success:false,errors:{type:"fileError",message:"Parent id not found",details:err}});
            // Upload file using appropriate library (DropBox,GoogleDrive,YandexDisk, whatever)
            require('../libs/storages/'+storage).upload(res.project.owner,files.file[0],id).then(function(storedFile){
                //Add children to appropriate folder
                var file = new File({data:storedFile});
                // Save relatives
                file.project = res.project._id;
                file.owner = res.project.owner;
                // Parent entity
                file.folder = req.query.folder;
                file.task = req.query.task;
                // Save
                file.save((err,file)=>{
                    if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot save file.",details:err}});
                    // Pin file id to appropriate folder
                    res.json({success:true,message:"File was created successfully.",file:file});
                });
            }).catch(function(err){
                log.debug('[file:upload]>Problem with file uploading "'+JSON.stringify(err)+'"');
                res.json({success:false,errors:{type:'fileError',message:"Can't upload file",details:err}});
            });
        });
    },
    createDoc: function(req,res,next){
        if(!req.body.type || !req.body.name) return res.json({success:false,errors:{message:'Cannot find required info'}});
        googleDrive.createDoc(res.project.owner,req.body,req.body.parent).then(function(storedFile){
            const file = new File({data:storedFile});
            // Save relatives
            file.project = res.project._id;
            file.owner = res.project.owner;
            // Parent entity
            file.folder = req.query.folder;
            // Save
            file.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot save file.",details:err}});
                // Pin file id to appropriate folder
                res.json({success:true,message:"File was created successfully.",file:file});
            });
        }).catch(function(err){
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot save file.",details:err}});
        });
    },
    /**
     * Crate file entity and upload on storage
     * Supports multi files
     */
    createFiles: function(req,res,next){
        var form = new multiparty.Form();
        form.parse(req, function(err, fields, files) {
            if(err) return res.json({success:false,errors:{type:'fileError',message:"Can't receive file.",details:err}});
            // Get appropriate fields
            var id = fields.id[0];
            if(!res.project || !res.project.owner) return res.json({success:false,errors:{type:'fileError',message:"Project owner not found."}});
            if(!(req.query.folder||req.query.task)) return res.json({success:false,errors:{type:"fileError",message:"Parent id not found",details:err}});
            // Upload in storage
            gcs.upload(res.project.owner,files.files,id).then(function(storedFiles){
                //Add children to appropriate folder
                const promises = storedFiles.slice(0).map((file)=>{
                    const f = new File({data:file});
                    // Save relatives
                    f.project = res.project._id;
                    f.owner = req.user._id;
                    // Parent entity
                    f.folder = req.query.folder;
                    f.task = req.query.task;
                    // Followers
                    f.followers = [res.project.owner];
                    if(res.project.owner!=req.user._id) f.followers.push(req.user._id);
                    // Save
                    return f.save();
                });
                Promise.all(promises).then(function(files){
                    res.json({success:true,files:files});
                }).catch((e)=>{
                    res.json({success:false,errors:{type:'fileError',message:"Can't upload file",details:e}});
                });
            }).catch(function(err){
                log.debug('[file:upload]>Problem with file uploading "'+JSON.stringify(err)+'"');
                res.json({success:false,errors:{type:'fileError',message:"Can't upload file",details:err}});
            });
        });
    },
    /**
     * Read file
     */
    readFile: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"fileError",message:"You forgot to set file id."}});
        File.findById(req.params.id,(err,file)=>{
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            if(!file) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            // Find project role
            Project.findOne({_id:file.project},function(err,project){
                let role = 'all';
                // Are you an owner? Go ahead! You have full access anyway.
                if(req.user&&req.user._id==project.owner) role = 'project-owner';
                if(req.user&&project.users.indexOf(req.user._id)!==-1) role = 'project-co-author';
                let docs = project.users.map((userId)=>{ return {user:userId} });
                docs.push({user:project.owner});
                smartUserPopulate(docs,'user',['__v','system','google','config','isPremium']).then(()=>{
                    res.json({success:true,message:"File was fetched successfully",file:file,role:role,users:docs.map(user=>user.user)});
                });
            });

        });
    },
    /**
     * Update file
     */
    updateFile: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"fileError",message:"You forgot to set file id."}});
        File.findById(req.params.id,(err,file)=>{
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            Object.assign(file,req.body.data);
            file.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot update file",details:err}});
                res.json({success:true,message:"File was updated successfully.",file:file});
            });
        })
    },
    /**
     * Delete file
     */
    deleteFiles: function(req,res,next){
        if(!req.body.files) return res.json({success:false,errors:{type:"fileError",message:"Cannot find files ."}});
        // Separate docs and storage files
        fileRemover(req.body.files,res.project.owner).then(function(planUpload){
            // Remove files in DB
            File.find({'_id':{$in:req.body.files.map((file)=>file._id)}},function(err,files){
                if(err)  return res.json({success:false,errors:{type:"fileError",message:"Cannot remove files"}});
                const filePromises = files.map((file)=>file.remove());
                Promise.all(filePromises).then(()=>{
                    res.json({success:true,message:'Files was removed successful'});
                }).catch((err)=>{
                    return res.json({success:false,errors:{type:"fileError",message:"Cannot remove files",details:err}});
                });
            });
        }).catch((err)=>{
            return res.json({success:false,errors:{type:"fileError",message:"Cannot remove files",details:err}});
        });
    },
    /**
     * Update file
     */
    followFile: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"fileError",message:"You forgot to set file id."}});
        File.findById(req.params.id,(err,file)=>{
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            const followers = file.followers || [];
            if(followers.indexOf(req.body.follower)!==-1) return res.json({success:false,errors:{type:"fileError",message:"You are already there",details:err}});
            followers.push(req.body.follower);
            file.followers = followers;
            file.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot update file",details:err}});
                res.json({success:true,message:"File was updated successfully.",file:file});
            });
        })
    },
    /**
     * Update file
     */
    unfollowFile: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"fileError",message:"You forgot to set file id."}});
        File.findById(req.params.id,(err,file)=>{
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            const followers = file.followers || [];
            if(followers.indexOf(req.body.follower)==-1) return res.json({success:false,errors:{type:"fileError",message:"You are already gone",details:err}});
            followers.splice(followers.indexOf(req.body.follower),1);
            file.followers = followers;
            file.save((err,file)=>{
                if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot update file",details:err}});
                res.json({success:true,message:"File was updated successfully.",file:file});
            });
        })
    },
    /**
     * Deprecated...
     * Upload preview image (psd,ai,eps, big data)
     * @returns {*}
     */
    uploadPreview: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"fileError",message:"You forgot to set file id."}});
        File.findById(req.params.id,(err,file)=>{
            if(err) return res.json({success:false,errors:{type:"fileError",message:"Cannot find file",details:err}});
            // Check storage
            if(SUPPORTED_STORAGES.indexOf(file.data.storage)==-1) return res.json({success:false,errors:{type:'fileError',message:"This file storage isn't supported."}});
            if(!res.project || !res.project.owner) return res.json({success:false,errors:{type:'fileError',message:"Project owner not found."}});
            if(!file.data.preview) return res.json({success:false,errors:{type:'fileError',message:"There is no temp file preview."}});
            // Upload file using appropriate library (DropBox,GoogleDrive,YandexDisk, whatever)
            var splitter = file.data.preview.split('/');
            // Upload and then remove tmp file.
            async.waterfall([
                    function(cb){
                        // Upload
                        require('../libs/storages/'+file.data.storage).upload(res.project.owner,{path:file.data.preview,originalFilename:splitter[splitter.length-1],headers:{'content-type':'image/png'}}).then(function(storedFile){
                            file.preview = storedFile;
                            file.save().then(function(){
                                cb(null,file);
                            }).catch(function(err){
                                cb(err);
                            });
                        },function(err){
                            cb(err);
                        });
                    },
                    function(file,cb){
                        // Remove Tmp file
                        fs.unlink(file.data.preview,function(err){
                            if(err) return cb(err);
                            cb(null,file);
                        });
                    }
                ],
                function(err,file){
                    if(err) return res.json({success:false,errors:{message:'Cannot save file',details:err,type:'fileError'}});
                    res.json({success:true,file:file});
                });
        })
    }
};
