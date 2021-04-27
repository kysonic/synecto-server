var nconf = require('nconf');
var path = require('path');

var cnfg = process.env.LOCAL?'config_local.json':'config.json';


module.exports = nconf.argv()
    .env()
    .file({ file: path.join(__dirname,'../config/'+cnfg)});

