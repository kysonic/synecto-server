const config = require('../config');
module.exports = function(req,res,next) {
    if(req.query.token!==config.get('paymentToken')) return res.json({
        success:false,
        errors:{type:'tokenError',message:'Rejected'}
    });
    next();
}