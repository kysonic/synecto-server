var mongoose = require('mongoose');
var async = require('async');

/**
 * Patch for Array.
 * @returns {Array}
 */
Array.prototype.clean = function() {
    for (var i = 0; i < this.length; i++) {
        if (!this[i]) {
            this.splice(i, 1);
            i--;
        }
    }
    return this;
};
// Regular expression for default scope
var ANY = /.*/;

/**
 * Helper mixin.
 * @type {{}}
 */
var Materialized = {
    /**
     * Configure query
     * @param search - it can be _id or path
     * @scope - scope.
     */
    giveMeAQuery(search,scope) {
        var isObjectID = search.length!=12 ? mongoose.Types.ObjectId.isValid(search) : mongoose.Types.ObjectId(search) == search;
        return isObjectID?{_id:search,scope:scope}:this.certainElementQuery(search,scope);
    },
    /**
     * Query for certain element
     * @param path - doc path
     * @scope - scope.
     */
    certainElementQuery(path,scope){
        var pth = this.parseFullPath(path);
        return {
            scope:scope||ANY,
            [this.options.field]: pth.name,
            path: pth.path
        }
    },
    /**
     * Build path from array
     */
    pathFromArray: function(array){
        return this.options.separator+array.join(this.options.separator)+this.options.separator;
    },
    /**
     * Find parent path
     */
    findParentPath(path){
        var splitter = path.split(this.options.separator).clean();
        splitter.pop();
        return splitter.length?this.pathFromArray(splitter):null;
    },
    /**
     * We have to know about field using
     * like path field
     */
    resolveField(model,data,doc) {
        return new Promise((resolve,reject)=>{
            // Miss changes if materialized field wasn't represented
            if((data[this.options.field]==doc[this.options.field])||!data[this.options.field]) return resolve();
            var path = (doc.path||this.options.separator)+doc[this.options.field]+this.options.separator;
            // If path constructor field was changed we have to change path on children of this item
            model.find({path:new RegExp(`^${path}`)},(err,docs)=>{
                async.each(docs,(d,cb)=>{
                    // Replace path parts
                    var newPath = (doc.path || this.options.separator) + data[this.options.field] + this.options.separator;
                    d.path = d.path.replace(path,newPath);
                    d.save((err,doc)=>{
                        if(err) return cb(err);
                        cb(null,doc);
                    });
                },(err,results)=>{
                    if(err) return reject(err);
                    resolve(results);
                })
            });
        });
    },
    /**
     * Split full path on parts
     * @param path - full path
     */
    parseFullPath(path) {
        var splitter = path.split(this.options.separator).clean();
        var name = splitter[splitter.length-1];
        splitter.pop();
        return {name:name,path:splitter.length?this.options.separator+splitter.join(this.options.separator)+this.options.separator:null}
    },
    /**
     * Build full path using doc
     * @param doc - document
     */
     buildFullPath(doc) {
        return (doc.path?doc.path:this.options.separator)+doc.name+this.options.separator;
     },
    /**
     * Extend object
     */
    extend(doc,data) {
        for(var p in data) {
            doc[p] = data[p];
        }
        return doc;
    }
}
/**
 * Mongoose schema materialized plugin. Leran more about this pattern here
 * https://docs.mongodb.org/manual/tutorial/model-tree-structures-with-materialized-paths/
 * Supports different filed using for path construction. For example you can
 * use name field to provide convenient search query for "file system like" collections.
 * For instance - /Project/Folder/SubFolder1/.
 * @param schema - mongoose schema for extending.
 * @param options - custom options
 *        options.field - field in schema which will be used for path construction
 *        options.separator - path separator. Could be ',' '/' '#' '-' etc.
 */
module.exports = function(schema,options) {
    // Options
    options = Materialized.options = Object.assign({field:'_id',separator:','},options||{});
    // Materialized fields
    schema.add({
        path: {
            type: String,
            default: null,
            trim: true
        },
        scope: {
            type: String
        },
        parent: {
            type: String
        }
    });
    // Indexes
    schema.index({
        path: 1
    });
    /**
     * Create\append function.
     * Create new item if search query will be empty.
     * @param data - data for item.
     * @params search - search term. path or id.
     * @param scope - special string defining certain hierarchy to prevent
     *                doubling of paths when path constructor field will be different than id
     *                or some unique string
     */
    schema.static('$insert',function(data,search,scope){
        var instance = new this(data);
        return search?this.$append(instance,search,scope):this.$create(instance,scope);
    });
    /**
     * Create new.
     * @param instance - mongoose model instance
     * @scope - ...
     */
    schema.static('$create',function(instance,scope){
        return new Promise((resolve,reject)=>{
            Object.assign(instance,{scope: scope || mongoose.Types.ObjectId()});
            instance.save(function(err,doc){
                if(err) return reject(err);
                resolve(doc);
            });
        });
    });
    /**
     * Append child to existed element.
     * @param instance - mongoose model instance
     * @param search - full path or id
     * @scope - ...
     */
    schema.static('$append',function(instance,search,scope){
        return new Promise((resolve,reject)=>{
            // Find ancestor
            this.findOne(Materialized.giveMeAQuery(search,scope),(err,doc)=>{
                if(err) return reject(err);
                if(!doc) return reject({message:'There is no item.'});
                var path = doc.path?doc.path+doc[options.field]+options.separator:options.separator+doc[options.field]+options.separator;
                // Check items with same name on this level
                this.findOne({[options.field]: instance[options.field], path: path,scope:scope},function(err,same){
                    if(err) return reject(err);
                    if(same) return reject({message:'There already is item with same '+options.field+'.'});
                    instance.path = path;
                    instance.scope = doc.scope;
                    instance.parent = doc._id;
                    instance.save(function(err,doc){
                        if(err) return reject(err);
                        resolve(doc);
                    });
                });
            });
        });
    });
    /**
     * Remove item by path or id.
     * @param search - search term - path or id
     * @param scope - special string defining certain hierarchy
     */
    schema.static('$remove',function(search,scope,removeChildren){
        return new Promise((resolve,reject)=>{
            this.findOne(Materialized.giveMeAQuery(search,scope),(err,doc)=>{
                if(err) return reject(err);
                if(!doc) return reject({message:'There is no item.'});
                // remove child
                var path = (doc.path||options.separator)+doc[options.field]+options.separator;
                var query = removeChildren ? {$or: [{path:new RegExp(`^${path}`)},{[options.field]:doc.name}]} : {[options.field]:doc.name};
                this.remove(query,(err)=>{
                    if(err) return reject(err);
                    resolve({message:'Removing was done successfully.'});
                });
            });
        });
    });
    /**
     * Find query
     * @param search - search term - path or id
     * @param scope - special string defining certain hierarchy
     */
    schema.static('$returnQuery',function(search,scope,removeChildren){
        return new Promise((resolve,reject)=>{
            this.findOne(Materialized.giveMeAQuery(search,scope),(err,doc)=>{
                if(err) return reject(err);
                if(!doc) return reject({message:'There is no item.'});
                // Generate query
                var path = (doc.path||options.separator)+doc[options.field]+options.separator;
                var query = removeChildren ? {$or: [{path:new RegExp(`^${path}`)},{[options.field]:doc.name}]} : {[options.field]:doc.name};
                resolve(query);
            });
        });
    });
    /**
     * Find doc
     * @param search - search term - path or id
     * @param scope - special string defining certain hierarchy
     */
    schema.static('$findOne',function(search,scope,removeChildren){
        return new Promise((resolve,reject)=>{
            this.findOne(Materialized.giveMeAQuery(search,scope),(err,doc)=>{
                if(err) return reject(err);
                if(!doc) return reject({message:'There is no item.'});
                resolve(doc);
            });
        });
    });
    /**
     * Update.
     * @param data - data for updating
     * @param search - search term - path or id
     * @param scope - special string defining certain hierarchy
     */
    schema.static('$update',function(data,search,scope){
        return new Promise((resolve,reject)=>{
            this.findOne(Materialized.giveMeAQuery(search,scope),(err,doc)=>{
                if(err) return reject(err);
                if(!doc) return reject({message:'There is no item.'});
                Materialized.resolveField(this,data,doc).then((status)=>{
                    var updated = Object.assign(doc.toObject(),data);
                    this.update({_id:doc.id,scope:scope},updated,(err,status)=>{
                        if(err) return reject(err);
                        resolve(updated);
                    });
                },function(err){
                    reject(err);
                });
            });
        });
    });
    /**
     * Find all descendants of current node
     * @param path - full path. ,root,name,
     * @scope - ...
     */
    schema.static('$getDescendants',function(path,scope,withItSelf,q){
        return new Promise((resolve,reject)=>{
            var pth = Materialized.parseFullPath(path);
            var qry = q || {};
            var query = withItSelf  ? {$or:[Object.assign({name:pth.name,scope:scope||ANY},qry),Object.assign({path:new RegExp(path),scope:scope||ANY},qry)]}
                                    : Object.assign({path:new RegExp(path),scope:scope||ANY},qry);
            this.find(query).lean().sort({path:1}).deepPopulate('files.stickers.owner').exec((err,docs)=>{
                if(err) return reject(err);
                if(!docs) return reject({message:'There is no item.'});
                resolve(docs);
            });
        });
    });
    /**
     * Get full path fo folder (meaning with name)
     * @scope - ...
     */
    schema.static('$getFullPath',function(folder){
        return (folder.path||options.separator)+folder.name+options.separator
    });
    /**
     * Build tree from materialized flat tree.
     * @path - full path.
     * @scope - ...
     */
    schema.static('$buildTree',function(path,scope,query){
        return new Promise((resolve,reject)=>{
            var pth = Materialized.parseFullPath(path);
            if(pth.path) return reject({message:'You can build only from root node.'});
            this.$getDescendants(path,scope,true,query).then(function(docs){
                var docs = docs.slice();
                var map = {}, doc = [], roots = [];
                // Go through docs and find relations
                for (var i = 0; i < docs.length; i++) {
                    doc = docs[i];
                    doc.children = [];
                    map[doc.name] = i;
                    // It is not a root
                    if (doc.path !== null) {
                        var a = doc.path.split(options.separator).clean();
                        // Didn't find ancestor - skip
                        if(!docs[map[a[a.length-1]]]) continue;
                        docs[map[a[a.length-1]]].children.push(doc);
                    } else {
                        roots.push(doc);
                    }
                }
                resolve(roots);
            },function(err){
                reject(err);
            });
        });
    });
    /**
     * Projector for buildFullPath
     */
    schema.static('buildFullPath',Materialized.buildFullPath.bind(Materialized));
    /**
     * Instance build tree method
     */
    schema.method('$buildTree',function (){
        return new Promise((resolve,reject)=> {
            this.constructor.$getDescendants(this.path+this.name+options.separator,this.scope,true).then((docs)=>{
                //console.log(docs);
                var docs = docs.slice();
                var map = {}, doc = [], roots = [];
                // Go through docs and find relations
                for (var i = 0; i < docs.length; i++) {
                    doc = docs[i];
                    doc.children = [];
                    map[doc.name] = i;
                    // It is not a root
                    if (doc.path !== this.path) {
                        var a = doc.path.split(options.separator).clean();
                        // Didn't find ancestor - skip
                        if(!docs[map[a[a.length-1]]]) continue;
                        docs[map[a[a.length-1]]].children.push(doc);
                    } else {
                        roots.push(doc);
                    }
                }
                resolve(roots);
            }, function (err) {
                reject(err);
            });
        });
    })
}

