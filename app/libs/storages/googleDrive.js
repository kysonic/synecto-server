var request = require('request');
var User = require('../../models/user').User;
var fs = require('fs');
var imgConverter = require('../img/img-converter');
var config = require('../../config');
var uuid = require('uuid');
Google = {};
Google.API = {
    upload: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    uploadDoc: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media',
    share: 'https://www.googleapis.com/drive/v3/files/#FILE_ID#/permissions',
    list: 'https://www.googleapis.com/drive/v3/files',
    delete: 'https://www.googleapis.com/drive/v3/files/',
    token: 'https://accounts.google.com/o/oauth2/token?approval_prompt=force',
    get: 'https://www.googleapis.com/drive/v3/files/',
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
            if(!user.system.integrations.google) return reject({message:'User doesn\'t have googleDrive token.'});
            // Read file
            
            fs.readFile(file.path, function (err, data) {
                if(err) return reject(err);
                // GDrive
                var DesignmapFolder = [];
                DesignmapFolder.push(user.system.integrations.google.id);
                
                this.resolveToken(user).then(function(){
                    // Generate name
                    uid = uid && uid!=='null' ? uid : uuid.v4();
                    var fileName = uid?uid+'-'+file.originalFilename:file.originalFilename;
                    // Upload file to Google Drive
                    request.post({
                        url: Google.API.upload,
                        headers: {
                            'Authorization': 'Bearer '+user.system.integrations.google.token
                        },
                        multipart:  [
                            {
                                'Content-Type': 'application/json; charset=UTF-8',
                                'body': JSON.stringify({'name':fileName,parents:DesignmapFolder}) //parents: [ 'appDataFolder']
                            },
                            {
                                'Content-Type': file.headers['content-type'],
                                'body': data
                            }
                        ]
                    },function(err,resp,body){
                        if(err) return reject(err);
                        try {var file = JSON.parse(body);}catch(e){if(err) return reject(e);}
                        if(file.error) return reject(file.error);
                        
                        // Get meta data
                        request.get({
                            url: Google.API.get+file.id+'?fields=size%2CwebContentLink',
                            headers: {
                                'Authorization': 'Bearer '+user.system.integrations.google.token
                            }
                        },function(err,response,body){
                            try {var metaData = JSON.parse(body);}catch(e){if(err) return reject(e);}
                            
                            if(metaData.error) return reject(metaData.error);
                            // Make a request to api
                            file.url = metaData.webContentLink;
                            file.size = metaData.size/1024;
                            file.storage = 'googleDrive';
                            // Maybe this file has to be converted.
                            if(!uid) return resolve(file);
                            // Convert it
                            imgConverter.processFile(file,data).then((file)=>{
                                resolve(file);
                            }).catch(reject);
                        });
                    });
                },function(err){
                    reject(err);
                })
            }.bind(this));
        }.bind(this));
    }.bind(this));
};
const MIME_TYPES = {
    'doc': 'application/vnd.google-apps.document',
    'sheet': 'application/vnd.google-apps.spreadsheet',
    'slide': 'application/vnd.google-apps.presentation',
};
const EDITOR_TYPES = {
    'doc': 'document',
    'sheet': 'spreadsheets',
    'slide': 'presentation',
};
/**
 * Create Google Drive Office Doc
 * @param userID
 * @returns {Promise}
 */
module.exports.createDoc = function(userID,data,uniqId) {
    return new Promise(function(resolve,reject){
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.integrations.google) return reject({message:'User doesn\'t have googleDrive token.'});
            // GDrive
            this.resolveToken(user).then(function(){
                // Generate name
                let uid = uniqId || uuid.v4();
                const fileName = uid+'-'+data.name;
                // Upload file to Google Drive
                this.resolveSynectoFolder(user).then(function(folderId){
                    const SynectoFolder = [];
                    SynectoFolder.push(folderId);
                    request.post({
                        url: Google.API.upload,
                        headers: {
                            'Authorization': 'Bearer '+user.system.integrations.google.token
                        },
                        multipart:  [
                            {
                                'Content-Type': 'application/json; charset=UTF-8',
                                'body': JSON.stringify({'name': fileName, parents: SynectoFolder,mimeType:MIME_TYPES[data.type]}) //parents: [ 'appDataFolder']
                            }
                        ]
                    },function(err,resp,body){
                        if(err) return reject(err);
                        try {var file = JSON.parse(body);}catch(e){if(err) return reject(e);}
                        if(file.error) return reject(file.error);

                        // Get meta data
                        request.get({
                            url: Google.API.get+file.id+'?fields=id%2Csize%2CwebContentLink',
                            headers: {
                                'Authorization': 'Bearer '+user.system.integrations.google.token
                            }
                        },function(err,response,body){
                            try {var metaData = JSON.parse(body);}catch(e){if(err) return reject(e);}

                            if(metaData.error) return reject(metaData.error);

                            file.size = metaData.size/1024;
                            file.storage = 'google';
                            file.type = data.type;
                            file.url = `https://docs.google.com/${EDITOR_TYPES[data.type]}/d/${metaData.id}/edit`;
                            // Make a request to api
                            resolve(file);
                        });
                    });
                });
            }.bind(this),function(err){
                reject(err);
            });
        }.bind(this));
    }.bind(this));
}
/**
 * Because google drive token is short lived we have to
 * refresh it.
 */
module.exports.resolveToken = function(user){
    return new Promise(function(resolve,reject) {
        if(Date.now()<user.system.integrations.google.expires) {return resolve();}
        this.getRefresh(user.system.integrations.google.refresh).then(function(data){
            user.system.integrations.google.token = data.access_token;
            user.system.integrations.google.expires = Date.now() + data.expires_in;
            User.update({_id:user.id},user,function(err){
                if(err) return reject(err);
                resolve(data);
            });
        },function(err){
            reject(err);
        })
    }.bind(this));
}/**
 * Because google drive token is short lived we have to
 * refresh it.
 */
module.exports.resolveSynectoFolder = function(user){
    return new Promise(function(resolve,reject) {
        request.get({
            url: Google.API.get+user.system.integrations.google.id+'?fields=id%2Csize%2CwebContentLink',
            headers: {
                'Authorization': 'Bearer '+user.system.integrations.google.token
            }
        },function(err,res,body){
            if(err) return reject(err);
            const data = JSON.parse(body);
            if(data.id) return resolve(data.id);
            if(data.error && data.error.code==404) {
                this.createSynectoFolder(user._id).then(function(folderId){
                    resolve(folderId);
                }).catch(reject);
            }
        }.bind(this));
    }.bind(this));
}
/**
 * Get Access and Refresh token by Authorization code
 * @param data
 * @returns {Promise}
 */
module.exports.getToken = function(data){
    return new Promise(function(resolve,reject){
        request.post({
            url: Google.API.token,
            form: data
        },function(err,response,body){
            if(err) return reject(err)
            try{
                var data = JSON.parse(body);
            }catch(e){
                return reject(e);
            }
            if(data.error) return reject(data.error);
            resolve(data);
        });
    });
}
/**
 * Get access token by refresh token
 * @param data
 * @returns {Promise}
 */
module.exports.getRefresh = function(refreshToken){
    return new Promise(function(resolve,reject){
        request.post({
            url: Google.API.token,
            form: {
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                client_id: config.get('storages:googleDrive').clientID,
                client_secret: config.get('storages:googleDrive').clientSecret
            }
        },function(err,response,body){
            if(err) return reject(err)
            try{
                var data = JSON.parse(body);
            }catch(e){
                return reject(e);
            }
            if(data.error) return reject(data.error);
            resolve(data);
        });
    });
}
/**
 * Create DesignMap Folder
 * @returns {Promise}
 */
module.exports.createSynectoFolder = function(userID,file,uid) {
    return new Promise(function(resolve,reject){
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.integrations.google) return reject({message:'User doesn\'t have googleDrive token.'});
            // Create DesignMap folder if not exist
            request.get({
                url: Google.API.list+"?q=name = 'Synecto' and mimeType = 'application/vnd.google-apps.folder' and trashed = false&spaces=drive",
                headers: {
                    'Authorization': 'Bearer '+user.system.integrations.google.token
                }
            },function(err,resp,body){
                if(err) return reject(err);
                var data = JSON.parse(body);
                if(data.files.length) return resolve(data.files[0].id);
                request.post({
                    url: Google.API.upload,
                    headers: {
                        'Authorization': 'Bearer '+user.system.integrations.google.token
                    },
                    multipart:  [
                        {
                            'Content-Type': 'application/json; charset=UTF-8',
                            'body': JSON.stringify({'name': 'Synecto','mimeType' : 'application/vnd.google-apps.folder'})
                        }
                    ]
                },function(err,resp,body){
                    if(err) return reject(err);
                    var data = JSON.parse(body);
                    var folderID = data.id;
                    // Share folder
                    request.post({
                        url: Google.API.share.replace('#FILE_ID#',data.id),
                        headers: {
                            'Authorization': 'Bearer '+user.system.integrations.google.token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            role: 'writer',
                            type: 'anyone'
                        })
                    },function(err,resp,body){
                        if(err) return reject(err);
                        resolve(folderID);
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
module.exports.delete = function(userID,files) {
    return new Promise(function(resolve,reject){
        // Find user to fetch token
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.integrations.google) return reject({message:'User doesn\'t have googleDrive token.'});
            // Make a request to api
            this.resolveToken(user).then(function(){
                Promise.all(files.map(file=>{
                    return new Promise((resolve,reject)=>{
                        request.del({
                            url: Google.API.delete+file.data.id,
                            headers: {
                                'Authorization': 'Bearer '+user.system.integrations.google.token
                            }
                        },(err,response,body)=>{
                            if(err) return reject(err);
                            resolve(body);
                        })
                    })
                })).then((result)=>{
                    resolve(result);
                }).catch(reject);

            },function(err){
                reject(err);
            });
        }.bind(this));
    }.bind(this));
}
