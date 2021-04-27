var request = require('request');
var User = require('../../models/user').User;
var config = require('../../config');
var fs = require('fs');
var imgConverter = require('../img/img-converter');
var log = require('../log/log');
var uuid = require('uuid');
Yandex = {};
Yandex.API = {
    uploadLink: 'https://cloud-api.yandex.net/v1/disk/resources/upload',
    token: 'https://oauth.yandex.ru/token',
    meta: 'https://cloud-api.yandex.net/v1/disk/resources',
    delete: 'https://cloud-api.yandex.net/v1/disk/resources',
    download: 'https://cloud-api.yandex.net/v1/disk/resources/download'
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
            if(!user.system.storages.yandexDisk) return reject({message:'User doesn\'t have yandexDisk token.'});
            // Generate name
            uid = uid && uid!=='null' ? uid : uuid.v4();
            var fileName = uid?uid+'-'+file.originalFilename:file.originalFilename;
            // Read file
            fs.readFile(file.path, function (err, fileData) {
                if(err) return reject(err);
                // Get Yandex Upload url
                request.get({
                    url: Yandex.API.uploadLink+'?path=app:/'+fileName+'&overwrite=true&fields=name,size,mime_type',
                    headers: {
                        'Authorization': 'OAuth '+user.system.storages.yandexDisk.token
                    },
                    json:true
                },function(err,response,body){
                    if(err) return reject(err);
                    if(body.error) return reject(body.error);
                    // Upload file
                    log.debug('[yandexDisk:upload]>Attempt to upload file "'+fileName+'"');
                    request.put({
                        url:body.href,
                        body: fileData
                    },function(err,response,body){
                        if(err) return reject(err);
                        if(response.statusCode!=201) return reject({errors:err,message:'Uploading error'});
                        if(body.error) return reject(body.error);
                        log.debug('[yandexDisk:upload]>Attempt to get file meta data "'+fileName+'"');
                        // Get meta data
                        request.get({
                            url: Yandex.API.meta+'?path=app:/'+fileName+'&fields=name,size,type,mime_type',
                            headers: {
                                'Authorization': 'OAuth '+user.system.storages.yandexDisk.token
                            },
                            json: true
                        },function(err,response,file){
                            if(err) return reject(err);
                            if(file.error) return reject(file.error);
                            // Set public access to resource
                            log.debug('[yandexDisk:upload]>Attempt to get download ' +
                            ' link "'+fileName+'"');
                            request.get({
                                url: Yandex.API.download+'?path=app:/'+fileName,
                                headers: {
                                    'Authorization': 'OAuth '+user.system.storages.yandexDisk.token
                                },
                                json: true
                            },function(err,response,download){
                                if(err) return reject(err);
                                if(download.error) return reject(download.error);
                                file.url = download.href;
                                file.size = file.size/1024;
                                file.storage = 'yandexDisk';
                                if(!uid) return resolve(file);
                                imgConverter.processFile(file,fileData).then((file)=>{
                                    log.debug('[dropBox:upload]>Converter resolution "'+JSON.stringify(file)+'"');
                                    resolve(file);
                                }).catch(reject);
                            });
                        });
                    });

                });
            }.bind(this));
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
            url: Yandex.API.token,
            form: data
        },function(err,response,body){
            if(err) return reject(err);
            console.log(err,body);
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
 * Delete file from dropBox
 * @param path
 */
module.exports.delete = function(userID,file) {
    return new Promise(function(resolve,reject){
        // Find user to fetch token
        User.findOne({_id:userID},function(err,user){
            if(err) return reject(err);
            if(!user) return reject({message:'User not found.'});
            if(!user.system.storages.yandexDisk) return reject({message:'User doesn\'t have yandexDisk token.'});
            // Make a request to api
            request.del({
                url: Yandex.API.delete+'?path=app:/'+file.name+'&permanently=true',
                headers: {
                    'Authorization': 'OAuth '+user.system.storages.yandexDisk.token
                }
            },function(err,res,body){
                console.log(err,body);
                if(err) return reject(err);
                if(body.error) return reject(body.error);
                resolve(body);
            });
        });
    }.bind(this));
}
