var multiparty = require('multiparty');
var fs = require('fs');
var path = require('path');
var gm = require('gm');
// Config example
var config = {
    name: 'full',
    croppedName: 'cropped',
    maxSize: 2 * 1024 * 1024,
    supportMimeTypes: ['image/jpg', 'image/jpeg', 'image/png'],
    path: './public/uploads/users/'
}
/**
 * Upload image on the server
 * @param req - Express request
 * @param data - options object. {path,maxSize,supportedMemTypes} - see config example
 * @returns {Promise} - A+ Promise.
 */
exports.upload = function (req,data) {
    return new Promise(function(resolve,reject){
        var form = new multiparty.Form();
        var uploadFile = {path: '', type: '', size: 0,fileName:''};
        var errors = [];
        // On entry
        form.on('part', function(part) {
            // Basic data
            var name = data.name ? data.name + path.extname(part.filename) : part.filename;
            if(data.setTime) name = name.split('.')[0] + this.getCurrDate()+'.'+ name.split('.')[1];
            uploadFile.size = part.byteCount;
            uploadFile.type = part.headers['content-type'];
            //console.log(name)
            uploadFile.path = data.path + name ;
            // Check restrictions
            if(data.maxSize && uploadFile.size > data.maxSize) {
                errors.push('File size is ' + uploadFile.size + '. Limit is ' + (data.maxSize / 1024 / 1024) + 'MB.');
            }
            if(data.supportMimeTypes && -1 === data.supportMimeTypes.indexOf(uploadFile.type)) {
                errors.push('Unsupported mimetype ' + uploadFile.type);
            }
            // If errors is empty write file
            if(errors.length === 0) {
                var regName = data.setTime ? name.replace(new RegExp(this.getCurrDate().substr(0,10)+'.*'),'') : name.replace(/\..*/,'');
                if(data.delete) deleteFileByRegexp(path.dirname(uploadFile.path),new RegExp(regName));
                part.pipe(fs.createWriteStream(uploadFile.path));
            }
            else {
                part.resume();
            }
        }.bind(this));
        // If file already exists we must unlink it.
        form.on('error', function(err){
            if(fs.existsSync(uploadFile.path)) {
                fs.unlinkSync(uploadFile.path);
            }
            reject(err);
        });
        // On close stream.
        form.on('close',function(){
            if(errors.length) reject(errors);
            uploadFile.path = uploadFile.path.replace('./public','');
            resolve({file:uploadFile});
        }.bind(this));
        // Check destination folder exist
        fs.exists(data.path,function(exist) {
            if(!exist) {
                fs.mkdir(data.path,function(err,create){
                    form.parse(req);
                });
            }else {
                form.parse(req);
            }
        })

    }.bind(this));
}
/**
 * Crop images
 * @param pth - path to image
 * @param crop - crop object (width,height,x,y,rotate)
 * @param resize - crop object (width,height)
 * @returns {Promise} - A+
 */
exports.crop = function (data){
    var pth = './public'+data.pth;
    var name = data.name ? data.name + path.extname(pth) : 'cropped'+path.basename(pth);
    if(data.setTime) name = name.split('.')[0] + this.getCurrDate()+'.'+ name.split('.')[1];
    var resizeFile = path.dirname(pth) + '/'+name;
    // Delete previous cropped avatars
    var regName = data.setTime ? name.replace(new RegExp(this.getCurrDate().substr(0,10)+'.*'),'') : name.replace(/\..*/,'');
    //deleteFileByRegexp(path.dirname(pth),new RegExp(regName));
    return new Promise(function(resolve,reject){
        gm(pth)
            .crop(data.crop.width, data.crop.height, data.crop.x, data.crop.y)
            .options({imageMagick: true})
            .resize(data.resize.width,data.resize.height)
            .write(resizeFile, function (err) {
                if(err) reject(err);
                resolve(resizeFile.replace('./public',''));
            });
    });
};
/**
 * Get Current Date String
 * @returns {string}
 */
exports.getCurrDate= function (){
    var date = new Date();
    return date.toJSON().slice(0,10).replace(/\-/g,'') + date.toJSON().slice(11,19).replace(/\:/g,'') + date.getMilliseconds();
}
/**
 * If in folder exist unused files then remove them.
 * @param worksFolder
 * @param works
 */
exports.removeUnusedWorkImage = function(worksFolder,works) {
    fs.readdir(worksFolder,function(err,files){
        if(err) throw err;
        files.forEach(function(file){
            if(works.indexOf(file)==-1) fs.unlink(path.normalize(worksFolder+file));
        });
    });
}
/**
 * Delete file by Regular Expression
 * @param folder
 * @param regexp
 */
function deleteFileByRegexp(folder,regexp) {
    fs.readdir(folder,function(err,files){
        if(err) throw err;
        files.forEach(function(file){
            if(regexp.test(file)) fs.unlink(folder+'/'+file);
        });
    })
}