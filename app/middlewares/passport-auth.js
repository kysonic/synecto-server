module.exports = function(req,res,next) {
    if(!req.user) return res.json({
        success:false,
        errors:{type:'authError',message:'You are not authorized.'}
    });
    next();
}