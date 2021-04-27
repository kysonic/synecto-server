var request = require('request');
var User = require('../../models/user').User;
var fs = require('fs');
var path = require('path');
var uuid = require('uuid');

var gcs = require('@google-cloud/storage')({
    projectId: 'tenacious-works-175319',
    keyFilename: path.join(__dirname,'synecto-gcs-key.json')
});

var newBucketOptions = {
    location: 'US-EAST1',
    regional: true
};


function _getBucketName(user) {
    return 'synecto_'+user.local.email.replace('@','_').replace('.','_');
}

function _createBucket(err,user,cb) {
    if(!err || err.message!='Not Found') return cb(null);
    gcs.createBucket(_getBucketName(user), newBucketOptions, function(err, bucket, apiResponse){
        if(err) return cb(err);
        cb(null,bucket);
    });
}


/**
 * Upload file using user's credentials
 * @returns {Promise}
 */
module.exports.upload = function(userID,fls,uid) {
    return new Promise((resolve,reject)=>{
        User.findOne({_id:userID},(err,user)=>{
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            // Work with files

            uid = uuid.v4();
            let totalSize = 0;

            fls.forEach((file)=>{
                fls.newName = uid?uid+'-'+file.originalFilename:file.originalFilename;
                // Read file
                var fileSize = file.size;
                if(fileSize>50*1024*1024 && user.plan.name=='startup') return reject({code:'storageIsEmpty',message:'You cannot upload files more that 50MB. This function is allowed only for premium users.'});
                totalSize+=fileSize;
            });

            user.plan.upload = parseInt(user.plan.upload) + totalSize;
            if(user.plan.upload>=user.plan.storage*1024*1024) return reject({message:'You cannot upload this file because your data space is empty. Upgrade your plan to get more.'});

            var bucketName = _getBucketName(user);

            var bucket = gcs.bucket(bucketName);


            bucket.get(function(err){
                // Create bucket if not exist
                _createBucket(err,user,function(err){
                    if(err) return reject({message:err.message});

                    var bucket = gcs.bucket(bucketName);

                    const filePromises = fls.slice(0).map((fl)=>{
                        const fileName = uid?uid+'-'+fl.originalFilename:fl.originalFilename;
                        return bucket.upload(fl.path, {public:true,destination:fileName})
                    });

                    Promise.all(filePromises).then(function (files){
                        const uploaded = [];
                        files.forEach((file,i)=>{
                            const f = file[0].metadata;
                            const fileName = uid?uid+'-'+fls[i].originalFilename:fls[i].originalFilename;
                            f.name = fileName;
                            f.originalName = fileName;
                            f.uid = uid;
                            f.url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                            f.storage = 'gcs';
                            uploaded.push(f);
                        });
                        // Update user plan upload
                        const planUpload = user.plan.upload;
                        User.update({_id:user._id},user,function(err,user){
                            if(err) return reject({message:err.message});
                            global.io.to(userID).emit('planUpload',planUpload);
                            resolve(uploaded);
                        });
                    }).catch((err)=>{
                        if(err) return reject({message:err.message});
                    });

                })
            });

        });
    });
}

/**
 * Delete file from Google Cloud Storage  
 * @param path
 */
module.exports.delete = function(userID,flls) {
    return new Promise((resolve,reject)=>{
        User.findOne({_id:userID},(err,user)=>{
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            // Remove all fake files or files which was stored here accedently
            let fls = flls.filter((f)=>!f.data.fake && f.data.storage!='designmap' && f.data.storage!='google' && f.data.name!='Kitty.jpg');
            // Work with files
            let totalSize = 0;
            fls.forEach((file)=>totalSize+=parseInt(file.data.size));
            user.plan.upload = parseInt(user.plan.upload) - totalSize;
            const bucketName = _getBucketName(user);
            const bucket = gcs.bucket(bucketName);
            const filePromises = fls.slice(0).map((fl)=>{
                return bucket.file(fl.data.originalName).delete();
            });
            Promise.all(filePromises).then(()=>{
                const planUpload = user.plan.upload;
                User.update({_id:user._id},user,function(err,user){
                    if(err) return reject({message:err.message});
                    global.io.to(userID).emit('planUpload',planUpload);
                    resolve(planUpload);
                });
            }).catch((err)=>{
                if(err.message=='Not Found') return resolve();
                reject(err);
            });
        });
    })

}
