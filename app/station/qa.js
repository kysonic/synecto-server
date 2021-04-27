var path = require('path');
var fs = require('fs');
/**
 * Show tests if dev mode and set ?test=1
 * @param app
 */
module.exports = function(app) {
    /**
     * Setup testing
     */
    app.use(function(req, res, next){
        res.locals.showTests = app.get('env') !== 'production' && req.query.test === '1';
        next();
    });
    /**
     * If test file exist in folder equals public/qa + req.path then set locals.
     */
    app.use(function(req,res,next){
        var pth = req.path.toLowerCase()=='/' ? 'index' : req.path.toLowerCase();
        if(fs.existsSync(path.join(__dirname,'../../public/qa/',pth,'.js').replace(/(\\|\/)\./,'.'))){
            res.locals.pageTests = 'qa/'+pth;
        }
        next();
    });
}