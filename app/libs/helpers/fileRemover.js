var gcs = require('../storages/gcs');
var googleDrive = require('../storages/googleDrive');

module.exports = function(files,owner) {
    return new Promise(function(resolve,reject){
        const separated = {};
        files.forEach((file)=>{
            separated[file.data.storage] = separated[file.data.storage] || [];
            separated[file.data.storage].push(file);
        });
        const prmses = [];
        if(separated.gcs) prmses.push(gcs.delete(owner,separated.gcs));
        if(separated.google) prmses.push(googleDrive.delete(owner,separated.google));

        Promise.all(prmses).then((planUpload)=>{
            resolve(planUpload);
        }).catch((err)=>reject(err));
    })
}