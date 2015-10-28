/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

require('dotenv').load();

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var https = require('https');
var JSON = require('JSON');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/public');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var bodyParser = require('body-parser');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
// start server on the specified port and binding host
app.listen(appEnv.port, appEnv.bind, function () {

  // print a message when the server starts listening
  console.log('server starting on ' + appEnv.url);
});

// development error handler
// will print stacktrace


var watson = require('watson-developer-cloud');

var extractionCredential = {};

//init relationship_extraction service
var initExtractionCredential = function(){

  if (process.env.VCAP_SERVICES) {
    var service = process.env.VCAP_SERVICES;

    if (services.relationship_extraction) {
      var credentials = services.relationship_extraction.credentials;
      extractionCredential.username = credentials.username;
      extractionCredential.password = credentials.password;
      extractionCredential.url = credentials.url;
      extractionCredential.version = 'v1';
    }
    else {
      console.log("no service")

    }
  }else{
      console.log("using local variables of relationship extraction");
      extractionCredential.username = process.env.relationship_extraction_username;
      extractionCredential.password = process.env.relationship_extraction_password;
      extractionCredential.url = process.env.relationship_extraction_url;
      extractionCredential.version = 'v1';
  }
  console.log(extractionCredential);
}

initExtractionCredential();
var relationshipExtr = watson.relationship_extraction(extractionCredential)
app.locals.relationshipExtraction = relationshipExtr;

//init the concept insights service
var conceptInsightsCredentials = {};

var initConceptInsightsCredentials=function(){

  if (process.env.VCAP_SERVICES) {
    var service = process.env.VCAP_SERVICES;

    if (service.concept_insights) {
      var credentials = service.concept_insights.credentials;
      conceptInsightsCredentials.username = credentials.username;
      conceptInsightsCredentials.password = credentials.password;
      conceptInsightsCredentials.version = 'v2';
    }
    else {
      console.log("no service is binded");
    }
  } else {

    console.log("using local varialables of concept insights");
    conceptInsightsCredentials.username = process.env.concept_insights_username;
    conceptInsightsCredentials.password = process.env.concept_insights_password;
    conceptInsightsCredentials.version = 'v2';
  }
  console.log(conceptInsightsCredentials);
}

initConceptInsightsCredentials();
var conceptInsights = watson.concept_insights(conceptInsightsCredentials);
app.locals.conceptInsights = conceptInsights;
app.locals.conceptInsightsUsername = conceptInsightsCredentials.username;

//use a cloudant db to install the other data of disaster information
//add a cloudant service to the instance
//init the db
//store the meta data of the document in the db
var dbs= {
   disasters: {
      name: "disasters",
      handler: null,
      indexes: {}
    }
};

var cloudant;

var async = require('async');

function useDatabase(next) {
  async.forEach(Object.keys(dbs), function (db, callback) {
    cloudant.db.create(dbs[db].name, function (err, res) {
      if (err) {
        console.log('database ' + dbs[db].name + ' already created');
      } else {
        console.log('database ' + dbs[db].name + ' is created');
      }
      dbs[db].handler = cloudant.use(dbs[db].name);

      callback();
    });
  }, function (err) {

    //create the index on answers db here,
    //the index is upon the field of user_token;

    var disaster_db = dbs.disasters.handler;
    var disaster_index = {
      name: 'disaster',
      type: 'json',
      index: {
        fields: [
          {
            "id": "desc"
          },
          {
            "recordedat": "desc"
          }
        ]
      }
    };

    disaster_db.index(disaster_index, function (err, response) {
      if (err)
        console.log("create index error" + JSON.stringify(err));
      else
        dbs.disasters.indexes.disaster = response;

      console.log('Index creation result: ', JSON.stringify(response));

    });

    next();

  });
}

var set_app_db = function(){
  app.locals.dbs = dbs;
}

function initializeDatabase(callback) {

  if (process.env.VCAP_SERVICES) {
    var vcapServices = JSON.parse(process.env.VCAP_SERVICES);

    if (vcapServices.cloudantNoSQLDB) {

      var credentials = vcapServices.cloudantNoSQLDB[0].credentials;

      dbs.host = credentials.host;
      dbs.port = credentials.port;
      dbs.user = credentials.username;
      dbs.password = credentials.password;
      dbs.url = credentials.url;

      cloudant = require('cloudant')(dbs.url);

      useDatabase(callback);
    } else {
      console.log("no cloudant service is binded");
    }
  } else {

    if (process.env.cloudant_hostname && process.env.cloudant_username && process.env.cloudant_password) {
      dbs.host = process.env.cloudant_hostname;
      dbs.user = process.env.cloudant_username;
      dbs.password = process.env.cloudant_password;

      cloudant = require('cloudant')({
        hostname: dbs.host,
        account: dbs.user,
        password: dbs.password
      });

      useDatabase(callback);
    }
  }
}

initializeDatabase(set_app_db);

require('./routes/index')(app);
require('./routes/requests')(app);
require('./routes/relationship_extraction')(app);
require('./routes/concept_insights')(app);

// catch 404 and forward to error handler
/*
app.use(function(req, res, next) {
 var err = new Error('Not Found');
 err.status = 404;
 next(err);
 });

if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});
*/
