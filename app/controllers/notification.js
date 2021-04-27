var router = require('express').Router();
// Models
var Notification = require('../models/notification').Notification;
// Accesses
var auth = require('../middlewares/passport-auth');
// Utils
var utils = require('../libs/helpers/utils');
var async = require('async');
var notifyManager = require('../libs/helpers/notifyManager');
// Cors
var cors = require('cors');
var corsOpts =require('../libs/corsOpts');
var smartUserPopulate = require('../libs/db/smartUserPopulate');
var POSSIBLE_QUERY_FIELDS = ['sender','recipient','read'];

var tokenizer = require('../middlewares/tokenizer');

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/',cors(corsOpts),this.getList);

        router.post('/',cors(corsOpts),this.createNotification);
        router.get('/:id',cors(corsOpts),auth,this.readNotification);
        router.put('/:id',cors(corsOpts),auth,this.updateNotification);
        router.delete('/:id',cors(corsOpts),auth,this.deleteNotification);
        router.delete('/',cors(corsOpts),auth,this.deleteNotifications);

        router.put('/',cors(corsOpts),auth,this.readNotifications);

        return router;
    },
    /**
     * Fetch Notifications By Query
     */
    getList: function(req,res,next){
        Notification.find({recipients:req.query.recipient}).populate('recipients').sort({created:'desc'}).lean().exec((err,notifications)=>{
            if(err) return res.json({success:false,errors:err.errors});
            if(!notifications) return res.json({success:false,errors:{message:'Cannot find notifications.'}});

            smartUserPopulate(notifications,'sender',['__v','system','google','config','isPremium']).then(()=>{
                res.json({success:true,message:"Notifications were received successfully.",notifications:notifications});
            }).catch((err)=>{
                res.json({success:false,errors:{message:"Error with population of user.",details:err}});
            });
        });
    },
    /**
     * Create new notification
     */
    createNotification: function(req,res,next){
        // Update sender to prevent hacking
        var notification = new Notification(req.body);
        notification.save(function(err,notification){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot create notification",details:err}});
            notifyManager.sendMail(notification,req.user).catch((e)=>console.log(e));
            res.json({success:true,message:"Notification was created successfully.",notification:notification});
        });
    },
    /**
     * Read notification
     */
    readNotification: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"notificationError",message:"You forgot to set notification id."}});
        Notification.findOne({_id:req.params.id},function(err,notification){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot read notification",details:err}});
            res.json({success:true,message:"Notification was obtained successfully.",notification:notification});
        });
    },
    /**
     * Update notification
     */
    updateNotification: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"notificationError",message:"You forgot to set notification id."}});
        Notification.update({_id:req.params.id},req.body,function(err,status){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot update notification",details:err}});
            res.json({success:true,status:status,message:"Notification was updated successfully."});
        });
    },
    /**
     * Delete notification
     */
    deleteNotification: function(req,res,next){
        if(!req.params.id) return res.json({success:false,errors:{type:"notificationError",message:"You forgot to set notification id."}});
        Notification.remove({_id:req.params.id},function(err){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot remove notification.",details:err}});
            res.json({success:true,message:"Notification was removed successfully."});
        });
    },
    /**
     * Delete notifications
     */
    deleteNotifications: function(req,res,next){
        if(!req.body || !req.body.ids) return   res.json({success:false, message: 'Cannot find ids'});
        Notification.remove({_id: {$in: req.body.ids}},function(err){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot remove notifications.",details:err}});
            res.json({success:true, message: 'All notifications are removed successfully!'});
        });

    },
    /**
     * Update all notifications represented in ids array. Set
     * {read:true}
     */
    readNotifications: function(req,res,next){
        if(!req.body.notifications) return res.json({success:false,errors:{type:"notificationError",message:"You forgot to set notification ids array."}});
        async.each(req.body.notifications,function(id,cb){
            Notification.update({_id:id},{read:true},function(err,status){
                if(err) return cb(err);
                cb(null,status);
            });
        },function(err,results){
            if(err) return res.json({success:false,errors:{type:"notificationError",message:"Cannot update notifications.",details:err}});
            res.json({success:true,status:results});
        });
    }
};


