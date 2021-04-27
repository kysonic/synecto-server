var morgan = require('morgan');
module.exports = function(app) {
    //Select logger depending on envelopment mode
    app.get('env') ? app.use(morgan('dev')) : app.use(require('express-logger')({ path: __dirname + '/log/requests.log'}));
}