/**
 * Created by a on 10/15/2015.
 */

module.exports=function(app){

    app.post('/disasterinfo', function(req, res){

        var infoOriginal = req.body.text;

        var relationshipExtractionService = app.locals.relationshipExtraction;

        relationshipExtractionService.extract({
            text: infoOriginal,
            dataset:'ie-en-news'},
            function(err, response) {
                if (err)
                    console.log('error:', err);
                else
                    console.log(JSON.stringify(response, null, 2));

        });


    })



}
