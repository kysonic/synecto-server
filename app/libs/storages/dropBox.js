var request = require('request');
var User = require('../../models/user').User;
var fs = require('fs');
var imgConverter = require('../img/img-converter');
var log = require('../log/log');
var uuid = require('uuid');
Dropbox = {};
Dropbox.API = {
    upload: 'https://content.dropboxapi.com/2/files/upload',
    shareLink: 'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
    delete: 'https://api.dropboxapi.com/2/files/delete',
    preview: 'https://content.dropboxapi.com/2/files/get_preview'
}
/**
 * Upload file using user's credentials
 * @param userID - user id
 * @param file - file binary
 * @returns {Promise}
 */
module.exports.upload = function(userID,file,uid) {
    return new Promise(function(resolve,reject){
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.storages.dropBox) return reject({message:'User doesn\'t have dropBox token.'});
            // Read file
            fs.readFile(file.path, function read(err, data) {
                if(err) return reject(err);
                // Generate name
                uid = uid && uid!=='null' ? uid : uuid.v4();
                var fileName = uid?uid+'-'+file.originalFilename:file.originalFilename;
                log.debug('[dropBox:upload]>Attempt to upload file "'+fileName+'"');
                // Transmit file to Dropbox
                request.post({
                    url: Dropbox.API.upload,
                    headers: {
                        'Authorization': 'Bearer '+user.system.storages.dropBox.token,
                        'Dropbox-API-Arg': JSON.stringify({path: "/"+fileName,mode: 'add',autorename: true}),
                        'Content-Type':"text/plain; charset=dropbox-cors-hack"
                    },
                    body: data
                },function(err,res,file){
                    if(err) return reject(err);
                    try {
                        var file = JSON.parse(file);
                    }catch(e){
                        reject(e);
                    }
                    log.debug('[dropBox:upload]>Response from dropbox "'+JSON.stringify(file)+'"');
                    // Obtain specific share data from dropbox
                    request.post({
                        url: Dropbox.API.shareLink,
                        headers: {
                            'Authorization': 'Bearer '+user.system.storages.dropBox.token,
                            'Content-Type': "application/json"
                        },
                        body: JSON.stringify({path:file.path_lower})
                    },function(err,res,share){
                        if(err) return reject(err);
                        try {var share = JSON.parse(share);}catch(e){reject(e);}
                        file.url = share.url.replace('dl=0','dl=1');
                        file.storage = 'dropBox';
                        file.size = file.size/1024;
                        log.debug('[dropBox:upload]>Checkout uid "'+uid+'"');
                        if(!uid) return resolve(file);
                        imgConverter.processFile(file,data).then((file)=>{
                            log.debug('[dropBox:upload]>Converter resolution "'+JSON.stringify(file)+'"');
                            resolve(file);
                        }).catch(reject);
                    });

                })
            });
        });
    });
}
/**
 * Delete file from dropBox
 * @param path
 */
module.exports.delete = function(userID,file) {
    return new Promise(function(resolve,reject){
        // Find user to fetch token
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.storages.dropBox) return reject({message:'User doesn\'t have dropBox token.'});
            // Make a request to api
            request.post({
                url: Dropbox.API.delete,
                headers: {
                    'Authorization': 'Bearer '+user.system.storages.dropBox.token,
                    'Content-Type':"application/json"
                },
                body: JSON.stringify({path:file.path_lower})
            },function(err,res,body){
                if(err) return reject(err);
                resolve(body);
            });
        });
    });
}
