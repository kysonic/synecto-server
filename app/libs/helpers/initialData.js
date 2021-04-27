// Models
const Project = require('../../models/project').Project;
const Folder = require('../../models/folder').Folder;
const File = require('../../models/file').File;
const Task = require('../../models/task').Task;
const Message = require('../../models/message').Message;
//
const locales = require('../../locales');

module.exports.createProject = function(user){
    return new Promise((resolve,reject)=>{
        // Create new project
        const project = new Project({
            owner: user._id,
            name: locales[user.system.language||'en'].myproject,
            settings: {
                taskManager: {
                    labels: [
                        {
                            label:'must have',
                            color: {
                                red: 200,
                                green: 126,
                                blue: 233,
                                alpha: 1
                            }
                        }
                    ]
                }
            }
        });
        // Save project
        project.save((err,project)=>{
            if(err) return reject(err);
            this.initialData(project,user).then(resolve).catch(reject);
        });
    })
};

module.exports.initialData = function(project,user){
    return new Promise((resolve,reject)=>{
        Project.find({owner:user._id},(err,projects)=>{
            if(projects.length>1) return resolve();
            Promise.all([
                this.fsInitialData(project,user),
                this.taskInitialData(project,user),
                this.chatInitialData(project,user)
            ]).then(resolve).catch(reject);
        });
    });
};

module.exports.fsInitialData = function(project,user){
    return new Promise((resolve,reject)=>{
        Folder.$insert({name:locales[user.system.language||'en'].Folder,owner:user._id,path:null,parent:null,color:'#ccc',files:[]},null,project._id).then((folder)=>{
            const file = new File({data:{storage:'gcs',size:312,fake:true,name:'Kitty.jpg',url:'#SERVER#/kitty.jpg'}});
            // Save relatives
            file.project = project._id;
            file.owner = user._id;
            // Parent entity
            file.folder = null;
            // Save
            file.save((err,file)=>{
                if(err) return reject(err);
                resolve({folder:folder,file:file});
            });
        },reject);
    })
};


module.exports.taskInitialData = function(project,user){
    const locale = locales[user.system.language||'en'];
    return Promise.all([
        Task.$insert({
            name: locale['meetSynecto'],
            owner:user._id,
            assignee: user._id,
            expired:null,
            path:null,
            parent:null,
            description: locale['meetSynectoDesc'],
            files:[]
        },null,project._id),
        Task.$insert({
            name: locale['inviteColleagues'],
            owner:user._id,
            assignee: user._id,
            expired:null,
            path:null,
            label: 'must have',
            parent:null,
            description: locale['inviteColleaguesDesc'],
            files:[]
        },null,project._id)
    ])
};

module.exports.chatInitialData = function(project,user){
    const locale = locales[user.system.language||'en'];
    const name = user.profile.name ? user.profile.name : user.local.email;
    return new Promise((resolve,reject)=>{
        const message = new Message({
            owner: user._id,
            text: locale['chatInitialMessage'].replace('#NAME#',name),
            project: project._id
        });
        message.save((err,message)=>{
            if(err) return reject(err);
            resolve({message:message});
        });
    });
};