var router = require('express').Router();
// Models
var Message = require('../models/message').Message;
// Utils
var utils = require('../libs/helpers/utils');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
// Accesses
var ACL = require('../middlewares/ACL');
var auth = require('../middlewares/passport-auth');

var POSSIBLE_QUERY_FIELDS = ['project','message','owner'];

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),auth,ACL.can('read','message'),this.getList);
        router.get('/count',cors(corsOpts),auth,ACL.can('read','message'),this.getCount);

        router.post('/',cors(corsOpts),auth,ACL.can('create','message'),this.createMessage);
        router.get('/:id',cors(corsOpts),auth,ACL.can('read','message'),this.readMessage);
        router.put('/:id',cors(corsOpts),auth,ACL.message('update','message'),this.updateMessage);
        router.delete('/:id',cors(corsOpts),auth,ACL.message('delete','message'),this.deleteMessage);

        return router;
    },
    /**
     * Get Messages By Query
     */
    getList: function(req,res,next){
        const mdb = Message.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).sort({created:-1}).lean();
        if(req.query.skip) mdb.skip(+req.query.skip);
        if(req.query.mpr) mdb.limit(+req.query.mpr);
        mdb.populate('owner','-system -google -local.password -config -__v -isPremium').exec((err,messages)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!messages) return res.json({success:false,errors:{message:'Cannot find messages.'}});
            res.json({success:true,message:"Messages were received successfully.",messages:messages});
        });
    },
    /**
     * Get messages count
     * for certain project
     */
    getCount: function(req,res,next){
        Message.find(utils.keep(req.query,POSSIBLE_QUERY_FIELDS)).lean().count().exec(function(err,count){
            if(err) return res.json({success:false,errors:err.errors});
            res.json({success:true,message:"Messages count was received successfully.",count:count});
        });
    },
    /**
     * Create new message into folder
     */
    createMessage: function(req,res,next){
        // Remove temporary id
        delete req.body.data._id;
        // Update owner to prevent hacking
        req.body.data.owner = req.user?req.user._id:req.body.data.owner;
        req.body.data.created = new Date();
        var message = new Message(req.body.data);
        message.save(function(err,message){
            if(err) return res.json({success:false,errors:{type:"messageError",message:"Cannot create message",details:err}});
            res.json({success:true,message:"Message was created successfully.",message:message});
        });
    },
    /**
     * Read message
     */
    readMessage: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"messageError",message:"You forgot to set message id."}});
        Message.findOne({_id:req.params.id},function(err,message){
            if(err) return res.json({success:false,errors:{type:"messageError",message:"Cannot read message",details:err}});
            res.json({success:true,message:"Message was obtained successfully.",message:message});
        });
    },
    /**
     * Update message
     */
    updateMessage: function(req,res,next){
        var messageID = req.params.id;
        if(!messageID) return res.json({success:false,errors:{type:'accessError',message:"You forgot to set message id parameter."}});
        Message.findOne({_id:messageID},function(err,message){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find message.",details:err}});
            if(!message) return res.json({success:false,errors:{type:"accessError",message:"There is no message with same id.",details:err}});
            Object.assign(message,req.body.data);
            message.save(function(err,message){
                if(err) return res.json({success:false,errors:{type:"messageError",message:"Cannot update message",details:err}});
                res.json({success:true,message:"Message was updated successfully.",message:message});
            });
        });
    },
    /**
     * Delete message
     */
    deleteMessage: function(req,res,next) {
        Message.findOne({_id:req.params.id},function(err,message){
            if(err) return res.json({success:false,errors:{type:"accessError",message:"Cannot find message.",details:err}});
            if(!message) return res.json({success:false,errors:{type:"accessError",message:"There is no message with same id.",details:err}});
            Object.assign(message,req.body.data);
            message.remove(function(err,status){
                if(err) return res.json({success:false,errors:{type:"messageError",message:"Cannot update message",details:err}});
                res.json({success:true,message:"Message was removed successfully.",status:status});
            });
        });
    }
};


