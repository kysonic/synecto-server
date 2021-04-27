module.exports = function(app){
    app.use('/',require('../controllers/index').routes(app));
    app.use('/token',require('../controllers/token').routes(app));
    app.use('/user',require('../controllers/user').routes(app));
    app.use('/project',require('../controllers/project').routes(app));
    app.use('/folder',require('../controllers/folder').routes(app));
    app.use('/file',require('../controllers/file').routes(app));
    app.use('/sticker',require('../controllers/sticker').routes(app));
    app.use('/comment',require('../controllers/comment').routes(app));
    app.use('/message',require('../controllers/message').routes(app));
    app.use('/notification',require('../controllers/notification').routes(app));
    app.use('/acl',require('../controllers/acl').routes(app));
    app.use('/task',require('../controllers/task').routes(app));
    app.use('/mailing',require('../controllers/mailing').routes(app));
    app.use('/pay',require('../controllers/pay').routes(app));
    // API for app
    app.use('/app/user',require('../controllers/app/user').routes(app));
    app.use('/app/file',require('../controllers/app/file').routes(app));
    app.use('/app/updates',require('../controllers/app/updates').routes(app));
}
