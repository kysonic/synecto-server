/**
 * Use domains for better error handling
 * @param app
 */
module.exports = function(app) {
    app.use(function(req, res, next){
        var domain = require('domain').create();
        domain.on('error', function(err){
            console.error('DOMAIN ERROR CAUGHT\n', err.stack);
            try {
                // Fail safe shutdown in 5 seconds
                setTimeout(function(){
                    console.error('Fail safe shutdown.');
                    process.exit(1);
                }, 5000);

                try {
                    next(err);
                } catch(error){
                    // If Plex error route failed, try plain Node response
                    console.error('Express error mechanism failed.\n', error.stack);
                    res.statusCode = 500;
                    res.setHeader('content-type', 'text/plain');
                    res.end('Server error.');
                }
            } catch(error){
                console.error('Unable to send 500 response.\n', error.stack);
            }
        });

        // add the request and response objects to the domain
        domain.add(req);
        domain.add(res);

        // execute the rest of the request chain in the domain
        domain.run(next);
    });
}
