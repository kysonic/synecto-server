var mongoose = require('../libs/db/mongoose');

var schema = new mongoose.Schema({
    name: String,
    data: Object
});
/**
 * Find all used roles in certain ACL schema
 * @param schemaName
 * @returns {Promise}
 */
schema.statics.fetchRoles = function(schemaName){
    return new Promise((resolve,reject)=>{
        var roles = {};
        this.findOne({name:schemaName||'default'},(err,schema)=>{
            if(err) return reject(err);
            var data = schema.data;
            Object.keys(data).forEach((key)=>{
                var value = data[key];
                if(!Array.isArray(value)) return;
                value.forEach((role)=>{
                    roles[role] = 1;
                });
            });
            resolve(Object.keys(roles));
        });
    });
}
/**
 * Instance role fetching
 * @returns {Array}
 */
schema.methods.fetchRoles = function() {
    var roles = {};
    var data = this.data;
    Object.keys(data).forEach((key)=>{
        var value = data[key];
        if(!Array.isArray(value)) return;
        value.forEach((role)=>{
            roles[role] = 1;
        });
    });
    return Object.keys(roles);
}

var ACL = mongoose.model('ACL', schema);

exports.ACL = ACL;

