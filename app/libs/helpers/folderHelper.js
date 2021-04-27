var async = require('async');
var File = require('../../models/file').File;
/**
 * Remove folders with their files
 * @param docs - folder instances (don't use lean())
 * @returns {Promise}
 */
module.exports.removeFoldersWithFiles = function(docs){
    return new Promise(function(resolve,reject){
        // Go through every doc
        async.each(docs,(doc,cb)=>{
            // Remove files and folders parallel
            async.parallel([
                (cb)=>{
                    doc.remove((err)=>{
                        if(err) return cb(err);
                        cb(null);
                    });
                },
                (cb)=>{
                    // Remove all found by folder id files
                    async.each(doc.files,(fileID,cb)=>{
                        File.findOne({_id:fileID},(err,file)=>{
                            if(err) return cb(err);
                            if(!file) return cb(null,{message:'File not found'});
                            file.remove((err)=>{
                                if(err) return cb(err);
                                cb(null);
                            });
                        });
                    },(err)=>{
                        if(err) return cb(err);
                        cb(null);
                    });
                }
            ],(err,results)=>{
                if(err) return cb(err);
                cb(null,results);
            });
        },(err)=>{
            if(err) return reject(err);
            resolve({message:'Folder was removed successfully.'});
        });
    });
}