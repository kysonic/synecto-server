var gm = require('gm').subClass({imageMagick: true});
var log = require('../log/log');

var CONFIG = {
    tmpPath: './public/tmp/',
    previewExt: ['psd','eps','ai'],
    imgExt:['jpg','png','gif','bmp','ttf'],
    sizeLimit: 2048
}
function getFileExtension(fileName){
    var splitter = fileName.split('.');
    return splitter[splitter.length-1];
}
/**
 * Make preview for file
 * @param data - file Buffer data
 * @param name - file name
 * @returns {Promise}
 */
module.exports.makePreview = function(data,name,ext){
    return new Promise((resolve,reject)=>{
        var previewPath = CONFIG.tmpPath+'preview_'+name.replace(ext,'png');
        log.debug(`[imgConverter:makePreview]>Trying to make a preview... ${previewPath}`);
        gm(data).in('-flatten').write(previewPath, function (err) {
            if (err) {
                log.debug(`[imgConverter:makePreview]>Cannot finish preview creating! ${JSON.stringify(err)}`);
                return resolve('#SERVER#/preview-not-found.jpg');
            }
            resolve(previewPath);
        });
    });
}
/**
 * Resize image
 * @param data - file Buffer
 * @param name - file name
 * @returns {Promise}
 */
module.exports.resizeImage = function(data,name){
    return new Promise((resolve,reject)=>{
        var previewPath = CONFIG.tmpPath+'preview_'+name;
        gm(data).size(function(err, value){
            if (err) return reject(err);
            if(!value) reject({message:'Cannot find width and height'});
            var k = (value.width>value.height ? Math.round(value.width/1024) : Math.round(value.height/1024))/2;
            gm(data).resize(value.width/k,value.height/k).write(previewPath, function (err) {
                if (err) return reject(err);
                resolve(previewPath);
            });
        });
    });
}
/**
 * Define whether file is required for preview or
 * it's to big and there is necessity to resize it.
 * @param file - file data
 */
module.exports.processFile = function(file,data) {
    return new Promise((resolve,reject)=>{
        var ext = getFileExtension(file.name);
        log.debug(`[imgConverter:processFile]>Extension = ${ext}, ${CONFIG.previewExt.indexOf(ext)}`);
        if(CONFIG.previewExt.indexOf(ext)!=-1) return this.makePreview(data,file.name,ext).then((previewPath)=>{
            log.debug(`[imgConverter:processFile]>Preview is here ${previewPath}`);
            file.preview = previewPath;
            resolve(file);
        }).catch((err)=>{resolve(file);});
        log.debug(`[imgConverter:processFile]>Limits ${CONFIG.sizeLimit+'<'+file.size} , ${CONFIG.imgExt.indexOf(ext)}`);
        if(CONFIG.sizeLimit<file.size && CONFIG.imgExt.indexOf(ext)!=-1) return this.resizeImage(data,file.name).then((previewPath)=>{
            file.preview = previewPath;
            resolve(file);
        }).catch(reject);
        log.debug(`[imgConverter:processFile]>Everything is all right!`);
        resolve(file);
    });
}
/**
 * Get file size in promisse style!
 * @param file
 * @returns {Promise}
 */
module.exports.getSize = function(file){
    return new Promise((resolve,reject)=>{
        gm(file.path).size((err,size)=>{
            if(err) return reject(err);
            resolve(size);
        });
    });
}

