var express = require('express');
var router = express.Router();

var User = require('../../models/user').User;
var File = require('../../models/file').File;
var Folder = require('../../models/folder').Folder;
var Project = require('../../models/project').Project;
var multiparty = require('multiparty');
var fs = require('fs');


var gcs = require('../../libs/storages/gcs');


function passToken(req,res,next) {
    const email = req.query.email || req.body.email;
    const token = req.query.token || req.body.token;
    User.findOne({'local.email':email,'system.appToken':token},(err,user)=>{
        if(err) return res.json({success:false,errors:{message:'Cannot find user'}});
        if(!user) return res.json({success:false,errors:{message:'Cannot find user'}});
        res.user = user;
        next();
    });
}

module.exports = {
    routes: function(){
        router.post('/',passToken,this.uploadFile.bind(this));
        return router;
    },
    uploadFile(req,res,next){
        var form = new multiparty.Form();
        form.parse(req, function(err, fields, files) {
            if(err) return res.json({success:false,errors:{message:'Cannot parse file info...'}})
            if(fields.file) return _uploadScreen(req,res,fields.file[0]);
            if(files.file) return _uploadFile(req,res,files.file[0]);
        });
    }
}

function _uploadScreen(req,res,base64File){
    const fileData = base64File;
    const tmpPath = `./public/tmp/screen-${res.user._id}.jpg`;
    const fileName = req.query.name || `screen-${new Date().getTime()}.jpg`;
    fs.writeFile(tmpPath,fileData,'base64',(err,hasWritten)=>{
        const file = {
            originalFilename: fileName,
            path: tmpPath,
            size: 3000
        };
        fs.stat(file.path,(err,stat)=>{
            if (err) return res.json({success: false, errors: {type: "fileError", message: "Cannot get file stat.", details: err}});
            if (!stat) return res.json({success: false, errors: {type: "fileError", message: "Cannot get file stat."}});
            file.size = stat.size;
            gcs.upload(res.user._id,[file]).then((storedFiles)=>{
                console.log(storedFiles);
                const storedFile = storedFiles[0];
                //Add children to appropriate foldernpm
                const file = new File({data:storedFile});
                // Save relatives
                file.project = req.query.project;
                file.owner = res.user._id;
                file.followers = [res.user._id];
                _resolveFolder(req.query.project,res.user._id).then(function(folder){
                    // Parent entity
                    file.folder = folder._id;
                    // Save
                    file.save((err,file)=> {
                        if (err) return res.json({success: false, errors: {type: "fileError", message: "Cannot save file.", details: err}});
                        // Emit
                        global.io.to(req.query.project).emit('action', {type:'ADD_FILE',data: file,uid:'syenctoapp'});
                        fs.unlink(tmpPath);
                        // Pin file id to appropriate folder
                        res.json({success: true, message: "File was created successfully.", file: file});
                    });
                })

            });
        });
    })
}

function _uploadFile(req,res,file){
    gcs.upload(res.user._id,[file]).then((storedFiles)=>{
        const storedFile = storedFiles[0];
        //Add children to appropriate folder
        const file = new File({data:storedFile});
        // Save relatives
        file.project = req.query.project;
        file.owner = res.user._id;
        // Parent entity
        file.folder = null;
        // Save
        file.save((err,file)=> {
            if (err) return res.json({success: false, errors: {type: "fileError", message: "Cannot save file.", details: err}});
            // Emit
            global.io.to(req.query.project).emit('action', {type:'ADD_FILE',data: file,uid:'syenctoapp'});
            // Pin file id to appropriate folder
            res.json({success: true, message: "File was created successfully.", file: file});
        });

    });
}

function _resolveFolder(projectId,userId){
    return new Promise(function(resolve,reject){
        Folder.findOne({scope:projectId,name:'Drops'}, function(err,folder){
            if(err) return reject(err);
            if(folder) return resolve(folder);
            Folder.$insert({name:'Drops',owner:userId,path:null,parent:null,color:'#ccc',files:[],removed:false},null,projectId).then((fldr)=>{
                global.io.to(projectId).emit('action', {type:'ADD_FOLDER',data: fldr,uid:'syenctoapp'})
                resolve(fldr);
            });
        })
    })
}
