/*
Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

(function () {
    'use strict';

    // Grab a reference to our auto-binding template
    // and give it some initial binding values
    // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
    var app = document.querySelector('#app');

    // Listen for template bound event to know when bindings
    // have resolved and content has been stamped to the page
    app.addEventListener('dom-change', function () {
        console.log('Our app is ready to rock!');
    });

    // Close drawer after menu item is selected if drawerPanel is narrow

    // See https://github.com/Polymer/polymer/issues/1381

    window.addEventListener('WebComponentsReady', function () {

        app.onMenuSelect = function () {
            var drawerPanel = document.querySelector('#paperDrawerPanel');
            if (drawerPanel.narrow) {
                drawerPanel.closeDrawer();
            }
        };

        var pages = document.querySelector('iron-pages');

        var searchingpage = "home";

        var analysispage = "similarityanalysis";

        app.switch = function () {
            pages.selectNext();
        };

        /*
        app.addEventListener('switcher', function (e) {
            app.switch();
        });
        */

        var nextButtons = document.querySelectorAll('paper-fab.nextButton');

        var scrollHeadPanel = document.querySelector('paper-scroll-header-panel');

        Array.prototype.forEach.call(nextButtons, function (button) {
            button.addEventListener('click', function () {
                    app.switch();

                    //scrollup
                    scrollHeadPanel.scroller.scrollTop = 0;

            });
        });

        var categorySelect = document.querySelector('#categoryTab');

        categorySelect.addEventListener('click', function (event) {

            if (categorySelect.selected == 0) {
                    pages.selected = searchingpage;
            } else
                if (categorySelect.selected == 1)
                {
                    pages.selected = analysispage;
                    openAnalysis();
                }

            scrollHeadPanel.scroller.scrollTop = 0;
        });

        var queryCall = document.querySelector('#queryCall');

        queryCall.addEventListener('response', function (e) {
            console.log("response from server" + JSON.stringify(e.detail.response));
            //prepare the data for the recommendationItems

            var results = e.detail.response.found;

            var list = [];

            results.forEach(function(item){
                var element = {};
                element.url = '/request?id=' + item.id;
                element.label = item.label;
                list.push(element);
            })

            app.list = list;

        });

        var querySubmission = function () {

            //fill in the enteredItem
            var text = [{
                index: "",
                name: app.title,
                shortText: "",
                longText:app.description
            }];

            app.enteredItem = text;
            //query the data
            var query_data = {};
            query_data.title = app.title;
            query_data.description = app.description;

            console.log(query_data);

            queryCall.body = JSON.stringify(query_data);

            console.log(queryCall.body);

            queryCall.generateRequest();
        };

        var recommendationButton = document.querySelector('#recommendationButton');

        recommendationButton.addEventListener('click', function(event){
            querySubmission();
        });

        var searchedItems=["Flood - Nov. 3rd", "Flood - Apr.5"];
        app.searchedItems = searchedItems;

        var textSelector = document.querySelector('#searchtextselector');

        textSelector.addEventListener('iron-select', function(event){

            console.log(textSelector.selected);
        })
    });

})();
