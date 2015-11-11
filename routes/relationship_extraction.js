/**
 * Created by a on 10/15/2015.
 */

module.exports=function(app){

    app.post('/relationshipextraction', function(req, res){

        var infoOriginal = req.body.text;

        var relationshipExtractionService = app.locals.relationshipExtraction;

        console.log(infoOriginal);

        relationshipExtractionService.extract({
            text: infoOriginal,
            dataset:'ie-en-news'},
            function(err, response) {
                if (err) {
                    console.log('error:', err);
                    res.status(400).send({error: "bad request"});
                }
                else {
                    console.log(JSON.stringify(response, null, 2));
                    res.status(200).send(response);
                }
        });

    })



}
