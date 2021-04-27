var request = require('request');
var User = require('../../models/user').User;
var config = require('../../config');
var fs = require('fs');
var imgConverter = require('../img/img-converter');
var log = require('../log/log');
var AWS = require('aws-sdk');
var path = require('path');
var uuid = require('uuid');

AWS.config.update({
    accessKeyId: config.get('AWS:AWS_ACCESS_KEY_ID'),
    secretAccessKey: config.get('AWS:AWS_SECRET_ACCESS_KEY'),
    region: config.get('AWS:AWS_REGION')
});

var s3 = new AWS.S3({apiVersion: '2006-03-01'});

Designmap = {};
Designmap.API = {
    upload: {Bucket: 'designmap', Key: '', Body: null},
    delete: {Bucket: 'designmap', Key: ''}
}
/**
 * Upload file using user's credentials
 * @returns {Promise}
 */
module.exports.upload = function(userID,file,uid) {
    return new Promise(function(resolve,reject){
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            // Generate name
            uid = uid && uid!=='null' ? uid : uuid.v4();
            var fileName = uid?uid+'-'+file.originalFilename:file.originalFilename;
            // Read file
            var fileSize = ((file.size/1024)/1024).toFixed(3);
            if(fileSize>10 && !user.isPremium) return reject({message:'You cannot upload files more that 10MB. This function is allowed only for premium users.'});
            // Restrictions for count of uploads
            if(user.system.s3Uploads===null || user.system.s3Uploads===undefined) user.system.s3Uploads = 100;
            user.system.s3Uploads-=fileSize;
            if(user.system.s3Uploads<=0) return reject({message:'You cannot upload more that 100 MB files here. This function is allowed only for premium users.'});
            user.save();
            // Get file content
            fs.readFile(file.path, function (err, fileData) {
                if(err) return reject(err);
                // Upload to bucket
                s3.upload(Object.assign(Designmap.API.upload,{Key:fileName,Body:fileData}), function(err, file) {
                    if(err) return reject(err);
                    file.name = fileName;
                    file.uid = uid;
                    file.url = file.Location;
                    file.storage = 'designmap';
                    file.size = fileSize;
                    imgConverter.processFile(file,fileData).then((file)=>{
                        log.debug('[designmap:upload]>Converter resolution "'+JSON.stringify(file)+'"');
                        resolve(file);
                    }).catch(reject);
                });
            }.bind(this));
        }.bind(this));
    }.bind(this));
}
/**
 * Delete file from dropBox
 * @param path
 */
module.exports.delete = function(userID,file) {
    return new Promise(function(resolve,reject){
        // Remove from s3
        s3.deleteObject(Object.assign(Designmap.API.delete,{Key:file.Key}), function(err, file) {
            if(err) return reject(err);
            resolve(file);
        });
    }.bind(this));
}
