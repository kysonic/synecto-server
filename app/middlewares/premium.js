module.exports = function(req,res,next) {
    if(req.user && !res.user.isPremium) return res.json({
        success:false,
        errors:{type:'authError',message:'You cannot do that. You do not have premium account.'}
    });
    next();
}