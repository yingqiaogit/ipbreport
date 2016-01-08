/**
 * Created by a on 10/22/2015.
 */

module.exports = function(app){

    //get an account id from concept insight
    var concept_insights = app.locals.conceptInsights;
    var relationship_extraction = app.locals.relationshipExtraction;
    var disaster_db= app.locals.dbs.disasters.handler;

    var requester = require('request');

    var async = require('async');

    var account_id;

    var mylib = require('../mylib.js');

    var extend = require('extend');

    console.log("mylib " + JSON.stringify(mylib));

    concept_insights.accounts.getAccountsInfo(null, function(err, response){
       if (err)
            console.log(err);
       else{
           console.log(JSON.stringify(response));
           account_id = response.accounts[0].account_id;
           console.log(account_id);
           setCorpusId('disasterinformation');
       }
    });

    var getCorpusParam = function(){

        var corpus_id = getCorpusId();

        var params = {
            access: "public",
            corpus: corpus_id,
            user: app.locals.conceptInsightsUsername,
            limit:0,
            body: {
                "access": "public",
                "users": [{
                    "uid": app.locals.conceptInsightsUsername,
                    "permission": "ReadWriteAdmin"
                }]
            }
        };
        return params;
    }

    var getCorpusId = function(){
        return app.locals.corpus_id;
    }

    var setCorpusId = function(name){
        var corpus_id = '/corpora/' + account_id + '/' + name;
        app.locals.corpus_id = corpus_id;
    }

    //create a corpus with a name /corpus?name=mytest
    app.post('/corpus',function(req,res){

        if (account_id&&req.query.name){

            setCorpusId(req.query.name);

            var params = getCorpusParam();

            console.log(JSON.stringify(params));

            concept_insights.corpora.createCorpus(params, function (err, response) {
                if (err) {
                    // will load it later
                    console.log("error" + JSON.stringify(err));
                    res.status(500).send(err);
                } else {
                    console.log("correct" + JSON.stringify(response));
                    res.status(200).send(response);
                }
            });
        }else{
            res.status(400).send({status:'invalid corpus name'});
        }
        console.log("in creating a corus");
    });

    //get the state of processing of a corpus with name
    //  /corpus?name=mytest
    app.get('/corpus',function(req,res){

        if (account_id&&req.query.name){

            setCorpusId(req.query.name);

            var params = getCorpusParam();

            console.log(JSON.stringify(params));

            params.corpus +="/processing_state";

            concept_insights.corpora.getCorpus(params, function (err, response) {
                if (err) {
                    // will load it later
                    console.log("error" + JSON.stringify(err));
                    res.status(500).send(err);
                } else {
                    console.log("correct" + JSON.stringify(response));
                    res.json(response);
                }
            });
        }else{
            res.status(400).send({status:'invalid corpus name'});
        }
    });

    //load document to the corpus
    // /corpus?name=mytest&start=30&limit=15&iteration=1
    //iteration = 0, then, all of the docs will be stored
    //iteration = # other than 0, then, # of the doc set will be stored
    app.put('/corpus', function(req,res){

        var disasterUrl = "http://api.rwlabs.org/v1/disasters";

        if (req.query.name)
            setCorpusId(req.query.name);

        var limit = Number(req.query.limit);
        var start = Number(req.query.start);
        var iteration = Number(req.query.iteration);

        if (typeof limit === 'undefined' || isNaN(limit)
            || typeof start === 'undefined' || isNaN(start)
            || typeof iteration === 'undefined' || isNaN(iteration)) {
            res.status(300).send({status: 'invalid parameters of start, limit, iteration'});
            return;
        }

        console.log("limit = " + limit + " start = " + start + " iteration = " + iteration);
        if(!getCorpusId())
        {
            res.status(500).send({status:'internal error'});
            return;
        }

        retrieving_disasterinfo(disasterUrl,start, limit, iteration);
        res.status(200).send({status:'OK'});

    });

    var retrieving_disasterinfo = function(disasterUrl, start, limit,iteration) {

        var request_url = disasterUrl;

        requester.get({
            url: request_url,
            qs: {
                from: "Disaster Information System",
                time: new Date(),
                method: 'GET'
            }
        }, function (error, response, body) {
            if (error)
                return console.log(error);

            var total = JSON.parse(body).totalCount;

            var iterationarray = [];
            var offset = start;

            if (!iteration)
                iteration = Math.ceil(total / limit);

            for (var i = 0; i < iteration; i++) {
                iterationarray.push({
                    offset: offset,
                    limit: limit
                })
                offset += limit;
            }

            console.log("iterationarray" + iterationarray);

            async.forEachSeries(iterationarray, function (item, callback) {
                var request_url = disasterUrl + "?" + "limit=" + item.limit
                    + "&offset=" + item.offset;

                var document_list = [];
                console.log(request_url);

                requester.get({
                    url: request_url,
                    qs: {
                        from: "Disaster Information System",
                        time: new Date(),
                        method: 'GET'
                    }
                }, function(error, response, body){
                    if (error)
                    {
                        console.log(error);
                        callback();
                    }

                    document_list = JSON.parse(body).data;

                    console.log(document_list);

                    store_documents(document_list, callback);
                });

            }, function (err) {
                console.log("done all of the iterations!")
            });
        });
    }

    //delete the corpus with a name /corpus?name=mytest
    app.delete('/corpus',function(req,res){
        if (account_id&&req.query.name){

            setCorpusId(req.query.name);

            var params = getCorpusParam();

            console.log(JSON.stringify(params));

            concept_insights.corpora.deleteCorpus(params, function (err, response) {
                if (err) {
                    // will load it later
                    console.log("error" + JSON.stringify(err));
                    res.status(500).send(err);
                } else {
                    console.log("correct" + JSON.stringify(response));
                    res.status(200).send(response);
                }
            });
        }else{
            res.status(400).send({status:'invalid corpus name'});
        }
    });

    var store_documents= function(document_list, callback_iteration){

        async.forEachSeries(document_list, function(document_info, callback){
            requester.get({
                url: document_info.href,
                qs: {
                    from: "Disaster Information System",
                    time: new Date(),
                    method: 'GET'
                }
            }, function (error, response, databody) {
                if (error)
                    return console.log(error);

                //verify is the disaster record has been retrieved already
                var id = JSON.parse(databody).data[0].fields.id;

                disaster_db.get(id, {revs_info:true}, function(err,body){
                    if (err){
                        processing_document(databody, callback);
                        console.log('new disaster');
                    }else{
                        console.log('existing already');
                        callback();
                    }
                });
            });

        }, function(err){
            console.log("done the documents! " + document_list.length);
            callback_iteration();
        });
    };

    var processing_document = function(body, callback_document){
        var retrieved_data = JSON.parse(body).data[0];
        var retrieved_fields = retrieved_data.fields;
        var document = retrieved_fields.description;

        console.log(document);

        var document_id = retrieved_fields.id;
        var document_label = retrieved_fields.name;

        var corpus_id = getCorpusId();

        async.parallel(
            [
                function(callback) {

                    var params = {
                        id: corpus_id+'/documents/' + document_id,

                        // document data
                        document: {
                            label: document_label,
                            parts: [{
                                name: document_label,
                                data: document
                            }]
                        }
                    };

                    concept_insights.corpora.createDocument(params, function (err, response) {
                        if (err) {
                            console.log("create " + document_label + " error" + JSON.stringify(err));
                        } else {
                            console.log("document " + document_label + " created");
                        }
                        callback();
                    });

                },

                //retrieve the mentions and their relationship by using relationship_extraction
                // and stored in the document in the db
                function(callback) {

                    relationship_extraction.extract({
                            text: document,
                            dataset:'ie-en-news'},
                        function(err, response) {
                            if (err) {
                                console.log('error:', err);
                            }
                            else {
                                console.log(JSON.stringify(response));
                            }

                            var concepts = mylib.reorganizeEntities(response.doc.entities.entity);
                            extend(retrieved_data, {entities: concepts});
                            callback();
                        });
                }
            ], function(err) {
                //store the meta data in the db
                //one disaster may have multiple documents
                //so, the disaster ID should be an index
                //the id of documents in the db is auto-generated
                //one document in the db is the whole "data" field retrieved from the reliefWeb
                store_doc_db(retrieved_data, "headline", "reliefWeb", document_id, callback_document);

            });
    }

    var store_doc_db = function (data,doc_type,source,id,callback) {
        var doc = data;
        doc.type = doc_type;
        doc.source = source;
        doc.id = id;

        doc.recorded_at=new Date().getTime();

        doc.formated_time = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        //store the doc in db
        console.log('store the doc' + JSON.stringify(doc));
        console.log('at consept insights, id is ' + id);

        //the primary key is auto generated to store multiple sets of answers of a user

        extend(doc, {_id:id.toString()});

        disaster_db.insert(doc, function (err, body) {
            if (!err)
            {
                console.log('stored correctly with information as ' + body);
                callback();
            }
            else {
                console.log(err);
                callback()
            }
        });
    };

    var documentId = 0 ;

    app.post('/conceptinsights/document/add', function(req,res){

            var document = req.body.text;

            console.log(document);

            documentId++;

            //add the document to the corpus
            console.log("corpus:" + corpus_id);

            var params = {
                id: corpus_id + '/documents/firstDocument',

                // document data
                document: {
                    label: "test for loading the data",
                    parts: [{
                        name: "test for loading the data",
                        data: document
                    }]
                }
            };

            concept_insights.corpora.createDocument(params, function(err,response){
                if (err)
                    return console.log("create document error" + JSON.stringify(err));

                console.log("document created" + response);

            });

            params = {
                graph: '/graphs/wikipedia/en-20120601',
                text:document
            };

            concept_insights.graphs.annotateText(params, function(err,response){
                if (err)
                    console.log(err);
                else{
                    console.log(JSON.stringify(response,null,2));
                    res.status(200).send(response);
                }
            });
        }
    )
}