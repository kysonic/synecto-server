var router = require('express').Router();
// Libs
var googleDrive = require('../libs/storages/googleDrive');
// Middlewares
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
// Models
var Project = require('../models/project').Project;
var Folder = require('../models/folder').Folder;
var File = require('../models/file').File;
// Misc
var async = require('async');
var fileRemover = require('../libs/helpers/fileRemover');
var utils = require('../libs/helpers/utils');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
var gcs = require('../libs/storages/gcs');
// Regular expression for default scope
var ANY = /.*/;
var SEPARATOR = '/';
var POSSIBLE_QUERY_FIELDS = ['scope','removed','parent'];

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),ACL.can('read','folder'),this.getList);

        router.post('/',cors(corsOpts),auth,ACL.can('create','folder'),this.createFolder);
        router.get('/:id',cors(corsOpts),ACL.can('read','folder'),this.readFolder);
        router.put('/',cors(corsOpts),auth,ACL.can('update','folder'),this.updateFolder);
        router.delete('/',cors(corsOpts),auth,ACL.can('delete','folder'),this.deleteFolders);

        return router;
    },
    /**
     * Get folders list
     */
    getList: function(req,res,next){
        Folder.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).sort({path:1}).exec((err,folders)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!folders) return res.json({success:false,errors:{message:'Cannot find folders.'}});
            res.json({success:true,message:'Folders were fetched successfully',folders:folders,role:res.role});
        });
    },
    /**
     * Create new folder inside project
     */
    createFolder: function(req,res,next){
        delete req.body.data._id;
        req.body.data.owner = req.user._id;
        Folder.$insert(req.body.data,req.body.path,req.body.projectID).then((folder)=>{
            res.json({success:true,message:"Folder was created successfully.",folder:folder,role:res.role});
        },(err)=>{
            return res.json({success:false,errors:{type:"folderError",message:"Can't create folder.",details:err}});
        });
    },
    /**
     * Read folder
     */
    readFolder: function(req,res,next){
        Folder.findById(req.params.id,(err,folder)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!folder) return res.json({success:false,errors:{message:'Cannot find folder.'}});
            if(!req.query.tree) return res.json({success:true,folder:folder,message:'Folder was found properly.',role:res.role});
            // Build tree if tree query param was transmitted.
            Folder.$buildTree('/'+folder.name+'/',folder.scope,{removed:req.query.removed||false}).then((tree)=>{
                res.json({success:true,message:'Tree was built successfuly.',tree:tree});
            },(err)=>{
                res.json({success:false,errors: {type:'folderError',message:"Can't build tree",details:err}});
            });
        });
    },
    /**
     * Update folder
     */
    updateFolder: function(req,res,next){
        Folder.$update(req.body.data,req.body.path,req.body.projectID).then((folder)=>{
            res.json({success:true,message:"Folder was updated successfully.",folder:folder});
        },(err)=>{
            return res.json({success:false,errors:{type:"folderError",message:"Can't update folder.",details:err}});
        });
    },
    /**
     * Remove folder.
     * Find all dependencies like folders and
     * files and remove it as well
     */
    deleteFolders: function(req,res,next){
        async.concat(req.body.folders,function(folder,cb) {
            Folder.$getDescendants(Folder.$getFullPath(folder),folder.scope,true).then((folders)=>{
                cb(null,folders);
            }).catch((err)=>cb(err));
        },function(err,folders) {
            if(err) return res.json({success:false,errors:{type:"folderError",message:"Cannot get folder descendants",details:err}});
            const folderIds = folders.map((folder)=>folder._id);
            File.find({folder:{$in:folderIds}},(err,files)=>{
                if(err) return res.json({success:false,errors:{type:"folderError",message:"Cannot find files",details:err}});
                // Remove files from google drive or gcs
                fileRemover(files,res.project.owner).then((planUploaded)=>{
                    // Remove files in DB
                    Folder.find({'_id':{$in:req.body.folders.map((folder)=>folder._id)}},function(err,folders){
                        if(err)  return res.json({success:false,errors:{type:"fileError",message:"Cannot remove files"}});
                        const folderPromises = folders.map((folder)=>folder.remove());
                        Promise.all(folderPromises).then(()=>{
                            res.json({success:true,message:'Folders was removed successful'});
                        }).catch((err)=>res.json({success:false,errors:{type:"folderError",message:"Cannot remove folders",details:err}}));
                    });
                }).catch((err)=>res.json({success:false,errors:{type:"projectError",message:"Cannot remove folder.",details:err}}))
            });
        })
    }
};
