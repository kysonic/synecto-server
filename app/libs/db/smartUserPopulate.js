var User = require('../../models/user').User;
var _ = require('lodash');

module.exports = function(docs,field,omit) {
    return Promise.all(docs.map((doc)=>{
        return new Promise((resolve,reject)=>{
            if(doc[field]&&doc[field].fake) return resolve();
            User.findOne({_id:doc[field]},function(err,user){
                if(err) return reject(err);
                if(!user) {
                    user = {
                        toObject: function(){
                            return {}
                        }
                    }
                }
                doc[field] = _.omit(user.toObject(),omit||[]);
                if(doc[field]&&doc[field].local&&doc[field].local.password) delete doc[field].local.password;
                resolve();
            });
        });
    }));
}