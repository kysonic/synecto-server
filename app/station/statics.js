var express = require('express');
var favicon = require('serve-favicon');
var path  = require('path');
var compression = require('compression');
var corsOpts = require('../libs/corsOpts');
/**
 * Handle the static files.
 * @param app
 */
module.exports = function(app) {
    app.use(compression());
    app.use(express.static(path.join(__dirname,'../../', 'public'),{
        setHeaders: function(res, path) {
            res.setHeader("Access-Control-Allow-Origin", '*');
        }
    }));
    app.use('/updates',express.static(path.join(__dirname,'../../', 'updates')));
    //app.use(vulcanize({dest: path.join(__dirname,'../../', 'public')}));
    app.use(favicon(path.join('public', 'favicon.ico')));
    // TODO: Create a static mapping
}