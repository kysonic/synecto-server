var config = require('./config');
var path = require('path');
var bcrypt = require('bcrypt-nodejs');
module.exports = function(app){
    app.disable('view cache');
    app.disable('etag');
    app.set('port', process.env.PORT || config.get('port'));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');
    app.set('current',{});
    //console.log(bcrypt.hashSync('doctor89', bcrypt.genSaltSync(8), null));
}
