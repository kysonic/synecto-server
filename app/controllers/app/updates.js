const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const yaml = require('js-yaml');

const appNames = {
    mac: 'Synectoapp-#VERSION#.dmg',
    win: 'Synectoapp Setup #VERSION#.exe'
};

const metaFiles = {
    mac: 'latest-mac.yml',
    win: 'latest.yml'
};
const releasePath = '/updates/releases/';

module.exports = {
    routes: function(){
        router.get('/latest', this.latestUpdate.bind(this));
        return router;
    },
    latestUpdate: function(req,res,next){
        const os = req.query.os;
        const release = yaml.safeLoad(fs.readFileSync(path.join(__dirname,'../../../',releasePath,metaFiles[os]), 'utf8'));
        const downloadUrl = `${req.protocol}://${req.get('Host')}${releasePath}${appNames[os].replace('#VERSION#',release.version)}`;
        res.redirect(downloadUrl);
    }
};

