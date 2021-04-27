var router = require('express').Router();
// Models
var Sticker = require('../models/sticker').Sticker;
// Accesses
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
// Utils
var utils = require('../libs/helpers/utils');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
// Models
var Project = require('../models/project').Project;
var User = require('../models/user').User;
var smartUserPopulate = require('../libs/db/smartUserPopulate');

var POSSIBLE_QUERY_FIELDS = ['project','file','folder','owner'];

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),auth,ACL.can('read','project'),this.getList);

        router.post('/',cors(corsOpts),auth,ACL.can('create','sticker'),this.createSticker);
        router.get('/:id',cors(corsOpts),auth,ACL.can('read','sticker'),this.readSticker);
        router.put('/:id',cors(corsOpts),auth,ACL.sticker('update','sticker'),this.updateSticker);
        router.delete('/:id',cors(corsOpts),auth,ACL.sticker('delete','sticker'),this.deleteSticker);

        return router;
    },
    /**
     * Get Stickers By Query
     * populate('owner','-system -google -local -config -__v -isPremium')
     */
    getList: function(req,res,next){
        Sticker.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).lean().exec((err,stickers)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!stickers) return res.json({success:false,errors:{message:'Cannot find stickers.'}});
            smartUserPopulate(stickers,'owner',['__v','system','google','local','config','isPremium']).then(()=>{
                res.json({success:true,message:"Stickers were received successfully.",stickers:stickers});
            }).catch((err)=>{
                res.json({success:false,errors:{message:"Error with population of user.",details:err}});
            });
        });
    },
    /**
     * Create new sticker into folder
     */
    createSticker: function(req,res,next){
        // Remove temporary id
        delete req.body.data._id;
        // Update owner to prevent hacking
        req.body.data.owner = req.user ? req.user._id : req.body.data.owner;
        var sticker = new Sticker(req.body.data);
        Sticker.find({file:req.body.data.file}).lean().exec(function(err,stickers){
            if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot find stickers",details:err}});
            // Find project
            Project.findOne({_id:req.body.data.project},function(err,project){
                if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot find project.",details:err}});
                if(!project) return res.json({success:false,errors:{type:"stickerError",message:"Cannot find project.",details:err}});
                // Find project owner
                User.findOne({_id:project.owner},function(err,user){
                    if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot find project owner.",details:err}});
                    if(stickers.length >= user.config.totalStickersCount) return res.json({success:false,errors:{type:"stickerError",message:`Sticker max count restriction`,count:user.config.totalStickersCount}});
                    const stickerOwner = req.user || req.body.data.owner;
                    if(Sticker.usersStickers(stickers,stickerOwner._id).length >= user.config.stickersCount) return res.json({success:false,errors:{type:"stickerError",message:`Stickerer us's restriction`,count:user.config.stickersCount}});
                    sticker.save(function(err,sticker){
                        if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot create sticker",details:err}});
                        res.json({success:true,message:"Sticker was created successfully.",sticker:sticker});
                    });
                });
            });
        });
    },
    /**
     * Read sticker
     */
    readSticker: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"stickerError",message:"You forgot to set sticker id."}});
        Sticker.findOne({_id:req.params.id},function(err,sticker){
            if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot read sticker",details:err}});
            res.json({success:true,message:"Sticker was obtained successfully.",sticker:sticker});
        });
    },
    /**
     * Update sticker
     */
    updateSticker: function(req,res,next){
        var stickerID = req.params.id;
        if(!stickerID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set sticker id parameter."}});
        Sticker.findOne({_id:stickerID},function(err,sticker){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find sticker.",details:err}});
            if(!sticker) return res.json({success:false,errors:{type:"accessError",message:"There is no sticker with same id.",details:err}});
            Object.assign(sticker,req.body.data);
            sticker.save(function(err,sticker){
                if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot update sticker",details:err}});
                res.json({success:true,message:"Sticker was updated successfully.",sticker:sticker});
            });
        });
    },
    /**
     * Delete sticker
     */
    deleteSticker: function(req,res,next){
        var stickerID = req.params.id;
        if(!stickerID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set sticker id parameter."}});
        Sticker.findOne({_id:stickerID},function(err,sticker){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find sticker.",details:err}});
            if(!sticker) return res.json({success:false,errors:{type:"accessError",message:"There is no sticker with same id.",details:err}});
            sticker.remove(function(err,status){
                if(err) return res.json({success:false,errors:{type:"stickerError",message:"Cannot remove sticker",details:err}});
                res.json({success:true,message:"Sticker was remove successfully.",status:status});
            });
        });

    }
};


