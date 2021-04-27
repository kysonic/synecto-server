var router = require('express').Router();
// Models
var ACL = require('../models/ACL').ACL;
// Cors
var cors = require('cors');
var corsOpts = require('../libs/corsOpts');
// Config
var aclList = require('../config/acl.json');

module.exports = {
    routes: function() {
        router.options('*', cors(corsOpts));

        router.get('/:name',cors(corsOpts),this.readACL);

        router.get('/',this.actualize);

        return router;
    },
    /**
     * Receive ACL
     */
    readACL: function(req,res,next){
        var name = req.params.name || 'default';
        ACL.findOne({name:name},(err,acl)=>{
            if(err) return res.json({success:false,errors:{type:"aclError",message:"Cannot obtain acl",details:err}});
            res.json({success:true,message:"ACL was received successfully.",acl:acl,roles:acl.fetchRoles()});
        })
    },
    actualize: function(req,res,next){
        var name = req.params.name || 'default';
        ACL.findOne({name:name},(err,acl)=>{
            if(err) return res.json({success:false,errors:{type:"aclError",message:"Cannot update acl.",details:err}});
            if(acl) return ACL.update({name:name},{data:aclList},(err,acl)=>{
                if(err) return res.json({success:false,errors:{type:"aclError",message:"Cannot update acl.",details:err}});
                res.json({success:true,message:"ACL was actualized successfully.",acl:acl});
            });
            var acl = new ACL({
                name: name,
                data: aclList
            });
            acl.save((err)=>{
                if(err) return res.json({success:false,errors:{type:"aclError",message:"Cannot update acl.",details:err}});
                res.json({success:true,message:"ACL was actualized successfully.",acl:acl});
            });
        })

    }
};


