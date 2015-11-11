/**
 * Created by a on 9/30/2015.
 */

module.exports= function(app){

    var disasters_db = app.locals.dbs.disasters.handler;

    //retrieve the doc url by id in the request
    app.get('/request', function(req,res){

        //retrieve the JSON body of req
        var doc_id = req.query.id;

        console.log("doc id" + doc_id);

        /*
        var indexspec = app.locals.dbs.disasters.indexes;

        //retrieve the document from the disasters db by the id
        var query = {
            "selector": {
                "id": {
                    "$exists":true,
                    "$eq": doc_id
                }
            },
            "sort": [{"id":"desc"},
                {"recorded_at": "desc"}],
            "limit": 1,
            "skip":0
        };

        disasters_db.find(indexspec.disaster, query, function (err, results) {
            if (err) {
                console.log("retrieve error" + JSON.stringify(err));
                res.json(null);
            } else {
                console.log("number of document is %d, first result is %s ", results.docs.length, JSON.stringify(results.docs[0]));
                console.log("time of the submissions")

                if (results.docs.length) {
                    var url = results.docs[0].fields.url;
                    res.redirect(url);
                }
                else
                    res.json(null);
             }
        });
        */

        disasters_db.get(doc_id.toString(), {revs_info:true}, function(err,body){
            if (!err){
                res.redirect(body.fields.url);
            }
                res.status(404).send(err);
        });

    });

}
