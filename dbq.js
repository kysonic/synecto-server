function drop(){
    db.files.drop();
    db.folders.drop();
    db.notifications.drop();
    db.projects.drop();
    db.tasks.drop();
    db.users.drop();
    db.comments.drop();
    db.stickers.drop();
    print('DB is clear now!');
}

function createAdmin(){
    db.createUser({user:"kysonic", pwd:"ioioio", roles:[{role:"dbOwner",db:"synecto"}]});
}

function createRoot(){
    db.createUser({user: "admin", pwd: "admin", roles: [ { role: "root", db: "admin" } ]});
}

function getPassedGuys() {
    var cursor = db.users.find({tutorialWasPassed:true},{'local.email':1});
    while ( cursor.hasNext() ) {
        printjson( cursor.next() );
    }
}

function getAllUsers() {
    var cursor = db.users.find({},{'local.email':1,'approved':1});
    while ( cursor.hasNext() ) {
        printjson( cursor.next() );
    }
}

