/**
 * Created by a on 10/29/2015.
 */

module.exports=function(app){

    var graph_id = '/graphs/wikipedia/en-20120601';
    app.locals.graph_id = graph_id;

    var async = require('async');
    var extend = require('extend');

    var concept_insights = app.locals.conceptInsights;
    var relationship_extraction = app.locals.relationshipExtraction;

    var disaster_db = app.locals.dbs.disasters.handler;

    var query_db = app.locals.dbs.queries.handler;

    var reorganizeEntitiesFrom= function(original){
        var organized = {
            GPE:[],
            GEOLOGICALOBJ: [], // the geo locial object, e.g., river, mountain,
            EVENT_DISASTER:[]  //event diasters
        }
        var location = [];
        var country = [];
        var general = ['Government'];

        original.forEach(function(item){
            if (typeof organized[item.type] !='undefined' ){
                //check if the key is GPE
                var entity ={};
                entity.name = item.mentref[0].text;
                entity.score =item.score;

                if (general.indexOf(entity.name)== -1)
                    if (item.type === 'GPE'){
                        if (item.subtype==='COUNTRY')
                            country.push(entity);
                        else
                            location.push(entity);
                    }else
                        organized[item.type].push(entity);
            }
        });

        organized.LOCATION = location;
        organized.COUNTRY = country;

        delete organized.GPE;

        return organized;
    };

    var compare = function(e1, e2){

        if (e1.total > e2.total)
            return -1;

        if (e1.total < e2.total)
            return 1;

        return 0;
    }

    var store_query_db = function(doc){

        //store the doc in the queries db
        //the primary key is the id autogenerated

        query_db.insert(doc,null,function(err,body){
            if (!err)
                console.log('stored correctly with information as ' + body);
            else
                console.log(err);
        });
    };

    //retrieve all of the titles from the doc
    app.get('/query/titles',function(req,res){

        query_db.list({include_docs:true},function(err,body){
            if (!err){

                //should contain _id with the title
                var titles=[];

                body.rows.forEach(function(doc){
                    var element = {};
                    element.title = doc.doc.title;
                    element.key = doc.key;
                    titles.push(element);
                });

                res.json({titles:titles});

            }else
                res.status(500).send({status:'error'});

        });

        //returns the _id and titles

    });

    //retrieve the doc with the _id
    //body
    //{ _id: doc_id}
    app.get('/query/found', function(req,res){

        var doc_id = req.query.id;

        console.log("received id " + doc_id);

        query_db.get(doc_id, {revs_info:true}, function(err,body){
            if (!err){
                //return the found list of the doc
                console.log("retieved body " + JSON.stringify(body));

                res.json({title: body.title,
                    description:body.description,
                    found:body.found});
            }else {
                res.status(404).send({status: err});
            }

        } );

    });

    app.post('/query/submit', function(req, res){

        query_doc = JSON.parse(Object.keys(req.body)[0]);

        console.log(JSON.stringify(query_doc));

        //store the query in the queries db
        // for one query, currently, there is one document including
        // original query,
        // the recommendations retrieved by concept insights from concept insights
        // the concepts of the query,
        // and the relationship extracted from the query

        async.parallel(
            [
                function(callback){

                    //retrieve the concept mentions of the query text from the graph
                    /*
                    var params = extend({ graph: graph_id }, {text: query_doc.description});
                    console.log(params);


                    concept_insights.graphs.annotateText(params, function(err, results) {
                        if (err)
                            return console.log(err);

                        //retrieve the concept from the results;
                        extend(query_doc, {annotations: results.annotations});

                        console.log("in parallel " + JSON.stringify(query_doc));

                        callback();
                    });
                    */
                    callback();
                },

                function(callback){

                    //retrieve the relationships by the reslationship extraction
                    relationship_extraction.extract({
                            text: query_doc.description,
                            dataset:'ie-en-news'},
                        function(err, response) {
                            if (err) {
                                console.log('error:', err);
                                res.status(400).send({error: "bad request"});
                            }
                            else {
                                console.log("extracted results" + JSON.stringify(response));

                                if(response.doc.entities.entity)
                                {
                                    var entities = reorganizeEntitiesFrom(response.doc.entities.entity);

                                    //the entity has the form of
                                    /*
                                     entity = {
                                     COUNTRY: [{"Somalia":1}]
                                     LOCATION:[{"Jowhar district":0.75},{"Middle Shabelle region":0.49}],
                                     GEOLOGICALOBJ: [{"Shabelle River":1}],
                                     DATE: [{"September 2013": 1}]
                                     }
                                     */
                                    console.log(JSON.stringify(entities));

                                    extend(query_doc, {entities: entities});
                                    callback();
                                }
                                else
                                    callback(new Error("invalid"));
                            }
                        });
                }


            ], function(err){
                //retrieve the recommended documents from the corpus

                if (err)
                    return res.status(200).send({status:"The description is not relevant to a disaster event"});

                console.log("should not reach here");

                var ids = [];

                //find the concept id of the entities
                //find the document by the label
                var entities = query_doc.entities;


                //using two layers asyn to retrieve the labels of the entities
                //the first layer:
                async.forEach(Object.keys(entities), function(key, callback){
                    //for each item of an entity, we retrieve the labels, and store the first one
                    async.forEach(entities[key], function(item, callback){

                        var keyword = item.name;

                        console.log(keyword);

                        //retrieve the labels of the keyword
                        var params = extend({
                            corpus: app.locals.corpus_id,
                            prefix: true,
                            limit: 10,
                            concepts: true
                        }, {query:keyword});

                        console.log(params);

                        concept_insights.corpora.searchByLabel(params, function(err, results) {
                            if (err) {
                                console.log(err);
                                callback();
                            }
                            else {
                                console.log(JSON.stringify(results));
                                //store the first concept in the item
                                item.concept=results.matches[0];
                                callback();
                            }
                        });

                    }, function(err){
                        callback();
                    });

                }, function(err){

                    //may use another parallel function
                    //prepare two search querys

                    console.log(JSON.stringify(query_doc));

                    var entities = query_doc.entities;

                    var disaster_events = [];

                    entities.EVENT_DISASTER.forEach(function(disaster){

                        disaster_events.push(disaster.concept.id);
                    })

                    var tasks = {};

                    if (!entities.COUNTRY.length && !entities.GEOLOGICALOBJ)
                    {
                        tasks.country=disaster_events.push(entities.LOCATION[0].concept.id);
                    }
                    else {
                        //query #1 contains the concept_ids of country and event_disaster
                        //in the case that there is no country, then, uses the first location
                        if (entities.COUNTRY.length)
                            tasks.country=disaster_events.concat([entities.COUNTRY[0].concept.id]);
                        else
                           if (entities.LOCATION.length)
                                tasks.country=disaster_events.concat([entities.LOCATION[0].concept.id]);

                        //query #2 contains the concept_ids of geologicalobj and event_disaster
                        //in the case that there is no geologicalobj, then, uses the first location
                        if (entities.GEOLOGICALOBJ.length) {
                            var geological_objs = [];

                            entities.GEOLOGICALOBJ.forEach(function (geoObj) {

                                geological_objs.push(geoObj.concept.id);
                            })

                            tasks.geoobj = disaster_events.concat(geological_objs);
                        }
                        else
                            if (entities.LOCATION.length )
                                tasks.geoobj=disaster_events.concat([entities.LOCATION[0].concept.id]);
                    }

                    var results={};

                    async.forEach(Object.keys(tasks), function(key, callback){
                            var params = extend({ corpus: app.locals.corpus_id, limit: 10 },
                                { document_fields: '{"user_fields":1}', ids: tasks[key]});

                            console.log(JSON.stringify(params));

                            concept_insights.corpora.getRelatedDocuments(params, function(err, data) {
                                if (err)
                                {
                                    console.log(err);
                                    callback();
                                }
                                else {
                                    console.log("the data of results" + JSON.stringify(data));
                                    console.log("the results"+ JSON.stringify(data.results));
                                    results[key]=data.results;
                                    callback();
                                }
                            });

                    }, function(err){
                        //rank the results
                        console.log(JSON.stringify(results));
                        //retrieve the average of the scores returned by the corpus
                        var list = [];
                        var ids = [];

                        if(!results)
                        {
                            return res.status(200).send({status:"The input is not relevant to a disaster event"});
                        }

                        Object.keys(results).forEach(function(key){

                            console.log("key" + key);
                            console.log("task " + JSON.stringify(results[key]));

                            results[key].forEach(function(item){

                                var element={};

                                console.log("item is " + JSON.stringify(item) );

                                element.id = item.id.split('/').slice(-1)[0];
                                element.label = item.label;
                                element[key] = item.score;
                                element.total = 0;

                                //push to the list in the case that the element is not in the list
                                var pos = ids.indexOf(element.id);

                                if (pos > -1)
                                {
                                    //exists
                                    list[pos][key] = item.score;
                                }else
                                {
                                    list.push(element);
                                    ids.push(element.id);
                                }
                            });
                        });

                        console.log("before sum" + JSON.stringify(list));

                        //calculate the total
                        Object.keys(results).forEach(function(key){
                           console.log("key is " + key);
                           list.forEach(function(item){

                               if (item[key])
                               {
                                   console.log(item[key]);
                                   item.total += item[key];
                               }

                               console.log(JSON.stringify(item));
                           });
                        });

                        //sort the list by the total;
                        list.sort(compare);

                        //store the results in query_doc
                        query_doc.found = list.slice();

                        //retrieve the <lat,lng> from the disaster_db

                        async.forEach(query_doc.found, function(doc, callback){

                            disaster_db.get(doc.id.toString(), function(err,body){
                               if (!err){

                                   doc.lat = body.fields.primary_country.location[1];
                                   doc.lng = body.fields.primary_country.location[0];
                               }
                               callback();
                            });

                        }, function(err){

                            console.log(JSON.stringify(query_doc));

                            // store the query_doc in the queries db
                            //including the original doc, concepts mentions, entities extracted, and the recommended documents

                            store_query_db(query_doc);
                        });

                        //return the results
                        res.json({found:list});

                    });

                });

            });
    });
}
