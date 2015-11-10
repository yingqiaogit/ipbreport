/**
 * Created by a on 10/22/2015.
 */

module.exports = function(app){

    //get an account id from concept insight
    var concept_insights = app.locals.conceptInsights;
    var relationship_extraction = app.locals.relationshipExtraction;

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
           setCorpusId('mytest');
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
    // /corpus?name=mytest&type=Flood&start=30&limit=15
    app.put('/corpus', function(req,res){

        var disasterUrl = "http://api.rwlabs.org/v1/disasters";

        if (req.query.name)
            setCorpusId(req.query.name);

        var type = req.query.type;

        //retrieve the 200 documents start from 30,
        //the first 30 documents will be used as test data
        var start = req.query.start;
        var limit = req.query.limit;

        if (getCorpusId()&&type&&start&&limit)
        {
            get_document_ids(disasterUrl, type, start, limit, store_document);
            res.status(200).send({status:'OK'});
        }
        else
        {
            res.status(500).send({status:'invalid parameters'});
        }
    });

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

    var get_document_ids= function(disasterUrl, type, start, limit, next){

        var offset = start - 1;
        var request_url = disasterUrl + "?" + "limit=" + limit
                           + "&offset=" + offset + "&query[value]="+
                            type + "&query[fields][]=primary_type" ;

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
                return console.log(error);

            document_list = JSON.parse(body).data;

            console.log(document_list);

            next(document_list);
        });

    };

    var store_document= function(document_list){

        document_list.forEach(function(document_info) {

            requester.get({
                url: document_info.href,
                qs: {
                    from: "Disaster Information System",
                    time: new Date(),
                    method: 'GET'
                }
            }, function (error, response, body) {
                if (error)
                    return console.log(error);

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
                        store_doc_db(retrieved_data, "headline", "reliefWeb", document_id);
                });
            });
        });
    };

    var store_doc_db = function (data,doc_type,source,id) {
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
        var disaster_db= app.locals.dbs.disasters.handler;

        disaster_db.insert(doc, id, function (err, body) {
            if (!err)
                console.log('stored correctly with information as ' + body);
            else
                console.log(err);
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