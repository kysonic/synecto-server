var ACL = require('../models/ACL').ACL;
/**
 * Add ACL data to req object.
 * @param app
 */
module.exports = function(app) {
    app.use(function(req, res, next){
        ACL.findOne({name:'default'},function(err,ACL){
            req.ACL = ACL;
            next();
        });
    });
}
