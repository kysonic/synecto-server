module.exports = {
    /**
     * Omit all unnecessary object property
     * @param o - object
     * @param a - array of fields to being omitted
     * @returns {{}}
     */
    omit: function(o,a){
        var no = {};
        for(var p in o) {
            if(a.indexOf(p)==-1) no[p] = o[p];
        }
        return no;
    },
    /**
     * Keep fields represented in array
     * @param o - object
     * @param a - array of fields to being kept
     * @returns {{}}
     */
    keep: function(o,a){
        var no = {};
        for(var p in o) {
            if(a.indexOf(p)!=-1) no[p] = o[p];
        }
        return no;
    },
    /**
     * Generate uid
     * @param len
     * @returns {string}
     */
    generateUid: function(len){
        len = len || 7;
        return Math.random().toString(35).substr(2, len).replace(/\d+/, '');
    }
}