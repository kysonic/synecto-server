var User = require('../../models/user').User;
var Project = require('../../models/project').Project;

module.exports = function(server,app){

    var io = require('socket.io')(server);

    function findClientsSocket(roomId, namespace) {
        var res = []
            // the default namespace is "/"
            , ns = io.of(namespace ||"/");

        if (ns) {
            for (var id in ns.connected) {
                if(roomId) {
                    var roomIds = Object.keys(ns.connected[id].rooms);
                    var index = roomIds.indexOf(roomId);
                    if(index !== -1) {
                        res.push(ns.connected[id]);
                    }
                } else {
                    res.push(ns.connected[id]);
                }
            }
        }
        return res;
    }

    function _setupUserOnlineState(userId,state) {
        // Find all of user's projects
        Project.find({users:{$in:[userId.toString(),userId]}}).exec(function(err, projects){
            if(err || !projects || !projects.length) return;
            // Setup state
            projects.forEach(function(project) {
                io.to(project._id).emit('userOnline',{userId:userId,state:state});
            });
        });
    }

    function _setupRegisteredUser(user) {
        // Find all of user's projects
        Project.find({invited:{$in:[user.local.email,user._id]}}).exec(function(err, projects){
            if(err || !projects || !projects.length) return;
            // Setup state
            projects.forEach(function(project) {
                io.to(project._id).emit('userRegistered',user);
            });
        });
    }

    /**
     * Setup session middleware to use session into socket
     */
    io.use(function(socket, next){
        app.sessionMiddleware(socket.request,socket.request.res,next);
    });
    io.use(function(socket, next){
       if(!socket.handshake.query.userId) return next();
       User.findOne({_id:socket.handshake.query.userId,'system.appToken':socket.handshake.query.appToken},(err,user)=>{
           if(err) throw new Error('Cannot find user');
           if(!user) throw new Error('Cannot find user');
           socket.request.session.passport = socket.request.session.passport || {};
           socket.request.session.passport.user = user;
           next();
       })
    });
    /**
     * Base connection listener
     */
    io.on('connection', function(socket){
        // Prevent subscribers without authorization
        if(!(socket.request.session.passport && socket.request.session.passport.user)) throw new Error('User is not authorized');
        // Define certain room
        var room = socket.handshake.query.room || 'synecto';
        socket.join(room);
        //console.log(socket.request.session.passport.user);
        /**
         * Create folder
         */
        socket.on('action',function(o){
            io.to(room).emit('action', o);
        });
        /**
         * Send notification
         */
        socket.on('notify',function(o){
            o.recipients.forEach((rec)=>io.to(rec).emit('notify', o));
        });
        /**
         * Change room
         */
        socket.on('change-room',function(o){
            socket.leave(room);
            room = o.room;
            socket.join(room);
            if(room==socket.request.session.passport.user) {
                _setupUserOnlineState(room,true);
                User.update({_id:room},{$set:{online:true}},function (err,upd) {});
                console.log('Online true<<<<',room);
            }
        });
        /**
         * Leave room while disconnecting
         */
        socket.on('disconnect', function() {
            if(room==socket.request.session.passport.user) {
                const socketsLength = findClientsSocket(socket.request.session.passport.user).length;
                if(!socketsLength) {
                    _setupUserOnlineState(room,false);
                    console.log('Online false<<<<',room);
                    User.update({_id:room},{$set:{online:false}},function (err,upd) {});
                }
            }
            socket.leave(room);
        });

        if(room==socket.request.session.passport.user) {
            _setupUserOnlineState(room,true);
            User.update({_id:room},{$set:{online:true}},function (err,upd) {});
            console.log('Online true<<<<',room);
        }
    });
    global.io = io;
    io.setupRegisteredUser = _setupRegisteredUser;
    return io;
};


