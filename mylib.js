/**
 * Created by a on 11/10/2015.
 */

var reorganizeEntitiesFrom= function(original){
    var organized = {
        GPE:[],
        GEOLOGICALOBJ: [], // the geo locial object, e.g., river, mountain,
        EVENT_DISASTER:[]  //event diasters
    }
    var location = [];
    var country = [];

    original.forEach(function(item){
        if (typeof organized[item.type] !='undefined' ){
            //check if the key is GPE
            var entity ={};
            entity.name = item.mentref[0].text;
            entity.score =item.score;

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

module.exports.reorganizeEntities = reorganizeEntitiesFrom;