var router = require('express').Router();
// Models
var Comment = require('../models/comment').Comment;
// Accesses
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');
// Utils
var utils = require('../libs/helpers/utils');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
// Populate with fakers
var smartUserPopulate = require('../libs/db/smartUserPopulate');

var POSSIBLE_QUERY_FIELDS = ['project','file','comment','folder','owner','attaches' +
''];

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),auth,ACL.can('read','comment'),this.getList);

        router.post('/',cors(corsOpts),auth,ACL.can('create','comment'),this.createComment);
        router.get('/:id',cors(corsOpts),auth,ACL.can('read','comment'),this.readComment);
        router.put('/:id',cors(corsOpts),auth,ACL.comment('update','comment'),this.updateComment);
        router.delete('/:id',cors(corsOpts),auth,ACL.comment('delete','comment'),this.deleteComment);

        return router;
    },
    /**
     * Get Comments By Query
     */
    getList: function(req,res,next){
        Comment.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).lean().exec((err,comments)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!comments) return res.json({success:false,errors:{message:'Cannot find comments.'}});
            smartUserPopulate(comments,'owner',['__v','system','google','config','isPremium']).then(()=>{
                res.json({success:true,message:"Comments were received successfully.",comments:comments});
            }).catch((err)=>{
                res.json({success:false,errors:{message:"Error with population of user.",details:err}});
            });
        });
    },
    /**
     * Create new comment into folder
     */
    createComment: function(req,res,next){
        // Remove temporary id
        delete req.body.data._id;
        // Update owner to prevent hacking
        req.body.data.owner = req.user?req.user._id:req.body.data.owner;
        var comment = new Comment(req.body.data);
        comment.save(function(err,comment){
            if(err) return res.json({success:false,errors:{type:"commentError",message:"Cannot create comment",details:err}});
            res.json({success:true,message:"Comment was created successfully.",comment:comment});
        });
    },
    /**
     * Read comment
     */
    readComment: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"commentError",message:"You forgot to set comment id."}});
        Comment.findOne({_id:req.params.id},function(err,comment){
            if(err) return res.json({success:false,errors:{type:"commentError",message:"Cannot read comment",details:err}});
            res.json({success:true,message:"Comment was obtained successfully.",comment:comment});
        });
    },
    /**
     * Update comment
     */
    updateComment: function(req,res,next){
        var commentID = req.params.id;
        if(!commentID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set comment id parameter."}});
        Comment.findOne({_id:commentID},function(err,comment){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find comment.",details:err}});
            if(!comment) return res.json({success:false,errors:{type:"accessError",message:"There is no comment with same id.",details:err}});
            Object.assign(comment,req.body.data);
            comment.save(function(err,comment){
                if(err) return res.json({success:false,errors:{type:"commentError",message:"Cannot update comment",details:err}});
                res.json({success:true,message:"Comment was updated successfully.",comment:comment});
            });
        });
    },
    /**
     * Delete comment
     */
    deleteComment: function(req,res,next) {
        Comment.findOne({_id:req.params.id},function(err,comment){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find comment.",details:err}});
            if(!comment) return res.json({success:false,errors:{type:"accessError",message:"There is no comment with same id.",details:err}});
            Object.assign(comment,req.body.data);
            comment.remove(function(err,status){
                if(err) return res.json({success:false,errors:{type:"commentError",message:"Cannot update comment",details:err}});
                res.json({success:true,message:"Comment was removed successfully.",status:status});
            });
        });
    }
};


