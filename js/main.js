//wrap everything in a self-executing anonymous function to move to local scope
(function(){

var map,projection;

var airportsURL = 'http://144.92.235.47:4040/airports'
var routesURL = 'http://144.92.235.47:4040/routes'


//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = $("#mapDiv").innerWidth(),
        height =$("#mapDiv").innerHeight();

    //create new svg container for the map
    map = d3.select("#mapDiv")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    
    //create Albers equal area conic projection
    projection = d3.geoAlbers()
        .center([-0.8, 39.96])
        .rotate([93.73, 0.91, 0])
        .parallels([35.68, 45.50])
        .scale(1750)
        .translate([width/2, height/2]);

    path = d3.geoPath()
        .projection(projection);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.json, "data/states.topojson") //load background states
        .await(callback);
	
    function callback(error,states){
        //Translate the topojson
        var states_topo = topojson.feature(states, states.objects.collection);

        //Generate map
        setStateOverlay(states_topo, map, path);
        //getFirstAirportDelays(map);
    };
};

//add states to map
function setStateOverlay(states_topo, map, path){
    var states = map.append("path")
        .datum(states_topo)
        .attr("class", "states")
        .attr("d", path);
};

// function getFirstAirportDelays(map){
//     $.ajax({
//         url: airportsURL,
//         data: {
//             type: 1,
//             fyr: 2014,
//             lyr: 2014,
//             fmth: 1,
//             lmth: 12,
//             fdow: 1,
//             ldow: 1,
//             airlines: eval([19393,19930]).join(",")
//         },
//         error: function() {
//             console.log("error");
//         },
//         dataType: 'json',
//         success: function(data) {
//         	console.log(data)
//             setAirportDelays(data.data,map);
//         },
//         type: 'GET'
//     });
// }

// function setAirportDelays(airports,map){
// 	for (i = 0; i < airports.length; i++) {
//             var location = [+airports[i].lng, +airports[i].lat]
//             var position = projection(location)
//             airports[i]["position"] = position
//         }

//     var circles = map.append("svg")
//         .attr("id", "circles");
//     circles.selectAll("circles")
//         .data(airports)
//         .enter()
//         .append("circle")
//             .attr('cx', function(d) {return d.position[0]})
//             .attr('cy', function(d) { return d.position[1]})
//             .attr("r", function(d) { return d.stats.delayed/3;})
//             .attr("id",function(d) { return d.code});
// }

var changeTimer = false;
$("input[name=proportional_symbol],#yearInput,#monthInput,#dayInput,input[name=delay],input[name=airline],input[name=checkBtn]" ).on("change",function(){
    if(changeTimer !== false) clearTimeout(changeTimer);
    changeTimer = setTimeout(function(){
    	var params = {}
        params['type'] = $('input[name=proportional_symbol]:checked').val()
        params['fyr'] = $('#yearInput').val().split(",")[0]
        params['lyr'] = $('#yearInput').val().split(",")[1]
        params['fmth'] = $('#monthInput').val().split(",")[0]
        params['lmth'] = $('#monthInput').val().split(",")[1]
        params['fdow'] = $('#dayInput').val().split(",")[0]
        params['ldow'] = $('#dayInput').val().split(",")[1]
        params['delay'] = $('input[name=delay]:checked').val()
        params['airline'] = $("input[name=airline]:checked").map(function() {
			return parseInt(this.value);
		}).get();

	//Do ajax call	
	$.ajax({
        url: airportsURL,
        data: {
            type: params.type,
            fyr: params.fyr,
            lyr: params.lyr,
            fmth: params.fmth,
            lmth: params.lmth,
            fdow: params.fdow,
            ldow: params.ldow,
            airlines: eval(params.airline).join(",")
        },
        error: function() {
            console.log("error");
        },
        dataType: 'json',
        success: function(data) {
            updateAirportDelays(data.data,params.delay,params);
        },
        type: 'GET'
    });

            changeTimer = false;
        },150);
});

function updateAirportDelays(airports,delayType,params){
	for (i = 0; i < airports.length; i++) {
            var location = [+airports[i].lng, +airports[i].lat]
            var position = projection(location)
            airports[i]["position"] = position
        }

    map.selectAll("svg#circles").remove();
    var circles = map.append("svg")
    	.attr("id", "circles");

	circles.selectAll("circles")
        .data(airports)
        .enter()
        .append("circle")
	        .attr('cx', function(d) {return d.position[0]})
	        .attr('cy', function(d) { return d.position[1]})
	        .attr("r", function(d) { return d.stats.delayed/3;})
	        .style("fill",'blue')
	        .style("fill-opacity",'0.5')

	        // generate arcs
            .on("click", function (d) {
            	console.log(d)
                $.ajax({
                    url: routesURL,
                    data: {
			            type: params.type,
			            fyr: params.fyr,
			            lyr: params.lyr,
			            fmth: params.fmth,
			            lmth: params.lmth,
			            fdow: params.fdow,
			            ldow: params.ldow,
			            airlines: eval(params.airline).join(","),
                        dest: d.origincode
                    },
                    error: function() {
                        console.log("error");
                    },
                    dataType: 'json',
                    success: function(data) {
                        console.log(data);
                        drawLinesOut();
                        lines(data)
                    },
                    type: 'GET'
                });
            });
}

function drawLinesOut(){
	//clear flow lines
	d3.selectAll(".arc").remove();
};

function lines(data){
	//draw flow lines
	var array = d3.values(data);
	//Create list containing only field_goal_attempts
	var origins = array[2];
	var min = d3.min(origins, function(d) {return d.stats.delayed});
	var max = d3.max(origins, function(d) {return d.stats.delayed});
	var domain = [min, max];
	var direction = "to"

	lineStroke = d3.scale.sqrt()
		.domain(domain)
    	.range([2, 12])

	//what follows is based on: http://bl.ocks.org/enoex/6201948
	var path = d3.geo.path()
		.projection(projection);

	// --- Helper functions (for tweening the path)
	var lineTransition = function lineTransition(path) {
 		path.transition()
 		//NOTE: Change this number (in ms) to make lines draw faster or slower
		.duration(1500)
		.attrTween("stroke-dasharray", tweenDash)
	};
	var tweenDash = function tweenDash() {
		//This function is used to animate the dash-array property, which is a
		//  nice hack that gives us animation along some arbitrary path (in this
		//  case, makes it look like a line is being drawn from point A to B)
		var len = this.getTotalLength();
		var interpolate = d3.interpolateString("0," + len, len + "," + len);
			return function(t) { return interpolate(t); };
	};

	var links = [];
	//var units = (viewToggle != "# of Shipments") ? data.units : "shipments"

	for(var i=0, len=origins.length; i<len; i++){
		// (note: loop until length - 1 since we're getting the next
		//  item with i+1)
		var coords = [[ origins[i].originlng, origins[i].originlat ],[ origins[i].desetlng, origins[i].destlat ]]
		var dl = origins[i].stats.delayed
		links.push({
			type: "LineString",
			coordinates: coords,
			total_delayed: dl,
 			name: origins[i].name,
			//units: units
		});
	}

	links.sort(function(a,b){return a.coordinates[0][0]-b.coordinates[0][0]});
	var xPosition //for managing directionality of flow lines

	var arcs = map.append("svg:g")
    	.attr("id", "arcs")
    	.attr("class", "arcs");

	arcs.selectAll("arc")
		.data(links)
		.enter()
		.append("path")
		.attr('class', 'arc')
		// .append("svg:arc")
		.style('fill', 'none')
		.attr("d", function(d){
			//http://bl.ocks.org/d3noob/
			var dx = projection(d.coordinates[0])[0] - projection(d.coordinates[1])[0],
				dy = projection(d.coordinates[0])[1] - projection(d.coordinates[1])[1],
				dr = Math.sqrt(dx * dx + dy * dy);

			var left = projection(d.coordinates[0])[0] < projection(d.coordinates[1])[0] ? true : false
			var sweep = left == true ? 1 : 0

			xPosition = projection(d.coordinates[0])[0]
			//sweep = 0
			return "M" +
			projection(d.coordinates[0])[0] + "," +
			projection(d.coordinates[0])[1] + "A" +
			dr + "," + dr + " 0 0," + sweep + " " +
			projection(d.coordinates[1])[0] + "," +
			projection(d.coordinates[1])[1]
		})
		// .style({'stroke': "#252525", "stroke-linejoin":"round", "cursor": "pointer"})
		.style('stroke-width', function(d) {return lineStroke(d.total_delayed)})
		.call(lineTransition);
};

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
	/*
	//navigation bar controls
	$(".nav-item").hover(function(){
	$(this).toggleClass('navbar-hovered')
	}, function(){
	$(this).toggleClass('navbar-hovered')
	})

	$(".nav-item").click(function(){
		$(".nav-item").removeClass("active")
		$(this).addClass("active")
		
		//figure out what to display
		$(".navbar-panel").css({'display': "none"})
		_thisData = $(this).data('panel')
		if (_thisData == "search"){
			$("#search-panel").slideToggle()
		}else if (_thisData == "proportion"){
			$("#proportion-panel").slideToggle()
		}else if (_thisData == "time"){
			$("#time-panel").slideToggle()
		}else if (_thisData == "delay"){
			$("#delay-panel").slideToggle()
		}else if (_thisData == "airline"){
			$("#airline-panel").slideToggle()
		}else{
			return
		}

	})
	*/
	/*
	//close filter panel when user clicks outside the panel
	$("#mapDiv").click(function(){
		$(".control-panel").css({'display': "none"})
		$(".nav-item").removeClass("active")
	})
	
	//dehighlight the return icon once mouse is moved out
	$("#navbar-return").mouseout(function(){
		$(".nav-item").removeClass("active")
	})
	*/
	
	//range sliders
	$(".range-slider1").jRange({
		from:2014,
		to:2016,
		step:1,
		scale:[2014,2015,2016],
		width:230,
		showLabels:false,
		isRange:true,
		snap:true
	})
	
	$(".range-slider2").jRange({
		from:1,
		to:12,
		step:1,
		scale:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
		width:230,
		showLabels:false,
		isRange:true,
		snap:true
	})
	
	$(".range-slider3").jRange({
		from:1,
		to:7,
		step:1,
		scale:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
		width:230,
		showLabels:false,
		isRange:true,
		snap:true
	})
	
	//airline checkboxes
	$(document).ready(function() {
		var checkBoxes = $("input[name=airline]");
		checkBoxes.prop("checked", true);
	$(".check").click(function() {
		var checkBoxes = $("input[name=airline]");
		checkBoxes.prop("checked", !checkBoxes.prop("checked"));
		if (checkBoxes.prop("checked")){
			$(this).val("Uncheck All")}
		else{
			$(this).val("Check All")}
		});   
	});
	
	//intro window
	d3.select(".container2")
	.append("div")
	.attr("class","grayOut")
			
	d3.select("body")
		.append("div").attr("class","OverviewBox")
		.html("<span class='OverviewBoxTitle'><p>Welcome to U.S. Delay Flight Tracker</p></span><span class='OverviewBoxContent'><p>This interactive map is for exploring the temporal and spatial trends of delay domestic flights within the U.S. from 2014 to 2016. We believe that users will make better and smarter itinerary decisions by comparing the historic differences in delay frequencies between airlines.<br> To detect more insights, you can use the filters on the left-hand side to investigate information such as the percentage of delay flights per airport, average delay time per airport, delay patterns across time and airlines, types of flight delay, etc.<br> If you want to get a more intuitive guide on how to use this map, please watch this <a href='tutorial.html' target='_blank'>tutorial</a>.</p></span>")
		.append("button").attr("class","OverviewButton")
		.text("Click Here to Enter the Map")
		.on("click",function(){
			$(".OverviewBox").fadeOut(350)
			$(".grayOut").fadeOut(350)
	})
	
	//set up hover effect for resetter buttons
	$(".resetter").hover(function(){
		$(this).toggleClass('hovered')
		}, function(){
		$(this).toggleClass('hovered')
	})
	
	//reset for proportional symbol filter
	var divClone1=$("#proportion-panel").clone();
	$(".return_default1").on("click",function(){
		$("#proportion-panel").replaceWith(divClone1)
	})
		
	//reset for time filter
	var divClone2=$("#time-panel").clone();
	$(".return_default2").on("click",function(){
		$("#time-panel").replaceWith(divClone2)
	})
	
	//reset for delay filter
	var divClone3=$("#delay-panel").clone();
	$(".return_default3").on("click",function(){
		$("#delay-panel").replaceWith(divClone3)
	})
	
	//reset for airline filter
	var divClone4=$("#airline-panel").clone();
	$(".return_default4").on("click",function(){
		$("#airline-panel").replaceWith(divClone4)
	})
	
	//fuzzy search
	// var options = {
	// 	shouldSort: true,
	// 	includeMatches: true,
	// 	threshold: 0.5,
	// 	location: 0,
	// 	distance: 100,
	// 	maxPatternLength: 24,
	// 	minMatchCharLength: 3,
	// 	keys:[
	// 	"name",
	// 	"city",
	// 	"iata"
	// 	]
	// };
	// var fuse = new Fuse(airports, options); // "list" is the item array
	// var result = fuse.search("");
	
})();