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

    var corpus_id;

    concept_insights.accounts.getAccountsInfo(null, function(err, response){
       if (err)
            console.log(err);
       else{
           console.log(JSON.stringify(response));
           account_id = response.accounts[0].account_id;
           console.log(account_id);
           //create a corpus
           create_corpus();
       }

    });

    var create_corpus = function(){
        if (account_id){

            corpus_id = "/corpora/"+ account_id+ "/mytest";

            app.locals.corpus_id = corpus_id;

            var params = {
                access: "public",
                corpus: corpus_id,
                limit:0,
                body: {
                    "access": "public",
                    "users": [{
                        "uid": app.locals.conceptInsightsUsername,
                        "permission": "ReadWriteAdmin"
                    }]
                }
            };

            console.log(JSON.stringify(params));
            concept_insights.corpora.createCorpus(params,function(err, response){
                if (err)
                {
                    // will load it later
                    load_corpus();
                    console.log("error" + JSON.stringify(err));
                    return;
                }

                console.log("correct" + response);

            });
        }
    };

    var load_corpus=function() {
        //get the data from relief web

        var disasterUrl = "http://api.rwlabs.org/v1/disasters";

        var type = "Flood";

        var start = 30;

        var limit = 2;

        //retrieve the 200 documents start from 30,
        //the first 30 documents will be used as test data
        var document_list;

        get_document_ids(disasterUrl, type, start, limit, store_document);

    };

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

                var retrieved_fields = JSON.parse(body).data[0].fields;
                var document = retrieved_fields.description;

                console.log(document);

                var document_id = retrieved_fields.id;
                var document_label = retrieved_fields.name;

                async.parallel(
                [
                    function(callback){
                        callback();
                    },
                    /*
                    function(callback) {

                        var params = {
                            id: corpus_id + '/documents/' + document_id,

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
                        });

                        callback();
                    },
                    */
                    //retrieve the mentions and their relationship by using relationship_extraction
                    // and stored in the document in the db
                    function(callback) {

                        relationship_extraction.extract({
                                text: document,
                                dataset:'ie-en-news'},
                            function(err, response) {
                                if (err) {
                                    console.log('error:', err);
                                    res.status(400).send({error: "bad request"});
                                }
                                else {
                                    console.log(JSON.stringify(response));
                                    callback();
                                }
                            });
                    }


                ], function(err) {
                        //store the meta data in the db
                        //one disaster may have multiple documents
                        //so, the disaster ID should be an index
                        //the id of documents in the db is auto-generated
                        //one document in the db is the whole "data" field retrieved from the reliefWeb

                        //store_doc_db(retrieved_data, "headline", "reliefWeb", document_id);
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
        /*the data is stored as
         {
         token:     //token as index, for the sigined user, the token is the user_token
         status:    //submit or inprogress
         formdata: {    //the data received from client

         }
         }
         */
        //store the doc in db
        console.log('store the doc' + JSON.stringify(doc));
        console.log('at consept insights, id is ' + id);

        //the primary key is auto generated to store multiple sets of answers of a user
        var disaster_db= app.locals.dbs.disasters.handler;

        disaster_db.insert(doc, doc.id, function (err, body) {
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