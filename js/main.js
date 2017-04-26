//wrap everything in a self-executing anonymous function to move to local scope
(function(){
var airports,map;

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = $("#mapWindow").innerWidth(),
        height = 460;

    //create new svg container for the map
    map = d3.select("#mapWindow")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    

    //create Albers equal area conic projection
    var projection = d3.geoAlbers()
        .center([-0.8, 39.96])
        .rotate([93.73, 0.91, 0])
        .parallels([35.68, 45.50])
        .scale(880)
        .translate([width / 2, height / 2]);

    //Azimuthal
    // var projection = d3.geo.azimuthal()
    // .mode("equidistant")
    // .origin([-98, 38])
    // .scale(1400)
    // .translate([640, 360]);

    path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.json, "data/airports.json") //load airpots
        .defer(d3.json, "data/states.topojson") //load background states
        .await(callback);

    function callback(error,airports,states){
        //Translate the topojson
        var states_topo = topojson.feature(states, states.objects.collection);

        for (i = 0; i < airports.features.length; i++) {
            var location = [+airports.features[i].properties.lng, +airports.features[i].properties.lat]
            var position = projection(location)
            airports.features[i].properties["position"] = position
        }
        //Generate map
        setStateOverlay(states_topo, map, path);
        //setAirports(airports,map);

        
            
     
    };
};

//add states to map
function setStateOverlay(states_topo, map, path){
    var states = map.append("path")
        .datum(states_topo)
        .attr("class", "states")
        .attr("d", path);
};

//add airports to map
function setAirports(airports, map){
    var circles = map.append("svg")
        .attr("id", "circles");
    circles.selectAll("circles")
        .data(airports.features)
        .enter()
        .append("circle")
            .attr('cx', function(d) {return d.properties.position[0]})
            .attr('cy', function(d) { return d.properties.position[1]})
            .attr("r", function(d) { return d.properties.rank/8; })
            .attr("id",function(d) { return d.properties.iata});
    //         .on("mouseover", function(d){
    //             highlightAirport(d.properties);
    //         })
    //         .on("mouseout", function(d){
    //             dehighlightAirport(d.properties)
    //         });
    // var desc = circles.append("desc")
    //         .text('{"stroke": "white", "stroke-width": "0","stroke-opacity": "0"}'); 
    getAirportDelays()   
};

function getAirportDelays(){
    $.ajax({
        url: 'http://localhost:8081/airports',
        data: {
            type: 1,
            fyr: 2014,
            lyr: 2014,
            fmth: 1,
            lmth: 12,
            fdow: 1,
            ldow: 1,
            airlines: eval([19393,19930]).join(",")
        },
        error: function() {
            console.log("error");
        },
        dataType: 'json',
        success: function(data) {
            updateAirportDelays(data);
        },
        type: 'GET'
    });
}

function updateAirportDelays(response){
    var circles = d3.selectAll("#circles")
        .data(response)
        .enter()
        .append("circle")
            .attr('cx', function(d) {return d.properties.position[0]})
            .attr('cy', function(d) { return d.properties.position[1]})
            .attr("r", function(d) { return d.properties.rank/8; })
            .attr("id",function(d) { return d.properties.iata});

    for (i = 0; i < response.data.length; i++) {
        var circle = circles.select("#"+ response.data[i].name)
            .data(response)
            .attr("r", function(d) { return d.data[i].stats.delayed/8;});
    }
}

    //     var data = [airports,response]
    //     var circles d3.selectAll("circles")
    //         .data(data)
    //         .enter()
    //         .append("circle")
    //             .attr('cx', function(d) {return d.properties.position[0]})
    //             .attr('cy', function(d) { return d.properties.position[1]})
    //             .attr("r", function(d) { return d.properties.rank/8; })
    //             .sort(function(a, b) { return b.properties.rank - a.properties.rank; })
    //             .attr("id",function(d) { return d.properties.iata});


    // var circles = d3.selectAll("#circles").each(
    //     function(i){
    //         var circle
    //     }



    //     )
    //     .attr("r", function(response){


    //     })

function highlightAirport(props){
    //change stroke
    var selected = d3.selectAll("#" + props.iata)
        .style("stroke", "yellow")
        .style("stroke-width", "5")
        .style("stroke-opacity", "1");

    //call set label
    //setLabel(props);

};

function dehighlightAirport(props){
    var selected = d3.selectAll("#" + props.iata)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    // d3.select(".infolabel")
    //     .remove();

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
};



})();