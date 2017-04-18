(function(){

//global variables
var attrArray = ["2000", "2001", "2002", "2003", "2004", "2005", "2006", "2007", "2008", "2009", "2010", "2011", "2012", "2013"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 35,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([chartHeight, 0])
    .domain([0, 25000]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("mapDiv")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoCylindricalEqualArea()
        .precision(0.1)
        .scale(120)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //set zoom parameters
    var zoom = d3.behavior.zoom()
        .translate(projection.translate())
        .scale(projection.scale())
        .scaleExtent([height, 8 * height])
        .on("zoom", zoomed);

    //call zoom
    var g = map.append("g")
        .call(zoom);

    //use d3.queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/EnergyUse.csv") //load attributes from csv
        .defer(d3.json, "data/Countries.topojson") //load background spatial data
        .await(callback);

    function callback(error, csvData, countries){

        //translate countries TopoJSON
        var worldCountries = topojson.feature(countries, countries.objects.ne_10m_admin_0_countries).features;

        //add world countries to map
        var countries = map.append("path")
            .datum(worldCountries)
            .attr("class", "countries")
            .attr("d", path);

        //join csv data to GeoJSON enumeration units
        worldCountries = joinData(worldCountries, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(worldCountries, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        createDropdown(csvData);

        g.append("g")
            .attr("id", "targetCountries")
            .selectAll("path")
            .data(worldCountries)
            .enter().append("path")
            .attr("d", path)
            .on("click", clicked);
    };

    //click a specific country to zoom
    function clicked(d) {
        var centroid = path.centroid(d),
        translate = projection.translate();

        projection.translate([
            translate[0] - centroid[0] + width / 2,
            translate[1] - centroid[1] + height / 2
        ]);

        zoom.translate(projection.translate());

        g.selectAll("path").transition()
            .duration(700)
            .attr("d", path);
    }

    //mousewheel zoom
    function zoomed() {
        projection.translate(d3.event.translate).scale(d3.event.scale);
        g.selectAll("path").attr("d", path);
    }
}; //end of setMap

function joinData(worldCountries, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.name; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<worldCountries.length; a++){

            var geojsonProps = worldCountries[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.NAME; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return worldCountries;
};

function setEnumerationUnits(worldCountries, map, path, colorScale){

    //add world regions to map
    var regions = map.selectAll(".regions")
        .data(worldCountries)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.NAME;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
        //below Example 2.2 line 16...add style descriptor to each path
        var desc = regions.append("desc")
            .text('{"stroke": "#818080", "stroke-width": "0.5px"}');
};

//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#e5e5e5";
    };
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffffb2",
        "#fecc5c",
        "#fd8d3c",
        "#f03b20",
        "#bd0026"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    // //create a second svg element to hold the bar chart
    // var chart = d3.select("body")
    //     .append("svg")
    //     .attr("width", chartWidth)
    //     .attr("height", chartHeight)
    //     .attr("class", "chart");
    //
    // //create a rectangle for chart background fill
    // var chartBackground = chart.append("rect")
    //     .attr("class", "chartBackground")
    //     .attr("width", chartInnerWidth)
    //     .attr("height", chartInnerHeight)
    //     .attr("transform", translate);
    //
    // //set bars for each province
    // var bars = chart.selectAll(".bars")
    //     .data(csvData)
    //     .enter()
    //     .append("rect")
    //     .sort(function(a, b){
    //         return b[expressed]-a[expressed]
    //     })
    //     .attr("class", function(d){
    //         return "bars " + d.name;
    //     })
    //     .attr("width", chartWidth / csvData.length - 1)
    //     .on("mouseover", highlight)
    //     .on("mouseout", dehighlight)
    //     .on("mousemove", moveLabel);
    //
    // var desc = bars.append("desc")
    //     .text('{"stroke": "none", "stroke-width": "0px"}');
    //
    // //create a text element for the chart title
    // var chartTitle = chart.append("text")
    //    .attr("x", 60)
    //    .attr("y", 43)
    //    .attr("class", "chartTitle")
    //    .text("Energy use of year " + expressed + " in each region");
    //
    // //create vertical axis generator
    // var yAxis = d3.axisLeft()
    //     .scale(yScale);
    //
    // //place axis
    // var axis = chart.append("g")
    //     .attr("class", "axis")
    //     .attr("transform", translate)
    //     .call(yAxis);
    //
    // //create frame for chart border
    // var chartFrame = chart.append("rect")
    //     .attr("class", "chartFrame")
    //     .attr("width", chartInnerWidth)
    //     .attr("height", chartInnerHeight)
    //     .attr("transform", translate);
    //
    // //set bar positions, heights, and colors
    // updateChart(bars, csvData.length, colorScale);
};

function createDropdown(csvData){
    // //add select element
    // var dropdown = d3.select("body")
    //     .append("select")
    //     .attr("class", "dropdown")
    //     .on("change", function(){
    //         changeAttribute(this.value, csvData)
    //     });
    //
    // //add initial option
    // var titleOption = dropdown.append("option")
    //     .attr("class", "titleOption")
    //     .attr("disabled", "true")
    //     .text("Select Attribute");
    //
    // //add attribute name options
    // var attrOptions = dropdown.selectAll("attrOptions")
    //     .data(attrArray)
    //     .enter()
    //     .append("option")
    //     .attr("value", function(d){ return d })
    //     .text(function(d){ return d });
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    // //change the expressed attribute
    // expressed = attribute;
    //
    // //recreate the color scale
    // var colorScale = makeColorScale(csvData);
    //
    // //recolor enumeration units
    // var regions = d3.selectAll(".regions")
    //     .transition()
    //     .duration(1000)
    //     .style("fill", function(d){
    //         return choropleth(d.properties, colorScale)
    //     });
    //
    // //re-sort, resize, and recolor bars
    // var bars = d3.selectAll(".bars")
    //     //re-sort bars
    //     .sort(function(a, b){
    //         return b[expressed] - a[expressed];
    //     })
    //     .transition() //add animation
    //     .delay(function(d, i){
    //         return i * 20
    //     })
    //     .duration(500)
    //     .attr("x", function(d, i){
    //             return i * (chartInnerWidth / csvData.length) + leftPadding;
    //         })
    //         //size/resize bars
    //         .attr("height", function(d, i){
    //             console.log(463 - yScale(parseFloat(d[expressed])));
    //             return 463 - yScale(parseFloat(d[expressed]));
    //         })
    //         .attr("y", function(d, i){
    //             console.log(yScale(parseFloat(d[expressed])) + topBottomPadding);
    //             return yScale(parseFloat(d[expressed])) + topBottomPadding;
    //         })
    //         //color/recolor bars
    //         .style("fill", function(d){
    //             console.log(choropleth(d, colorScale));
    //             return choropleth(d, colorScale);
    //         });
    //
    // updateChart(bars, csvData.length, colorScale);
};

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    // console.log("                 ");
    // //position bars
    // bars.attr("x", function(d, i){
    //         return i * (chartInnerWidth / n) + leftPadding;
    //     })
    //     //size/resize bars
    //     .attr("height", function(d, i){
    //         console.log(463 - yScale(parseFloat(d[expressed])));
    //         return 463 - yScale(parseFloat(d[expressed]));
    //     })
    //     .attr("y", function(d, i){
    //         console.log(yScale(parseFloat(d[expressed])) + topBottomPadding);
    //         return yScale(parseFloat(d[expressed])) + topBottomPadding;
    //     })
    //     //color/recolor bars
    //     .style("fill", function(d){
    //         console.log(choropleth(d, colorScale));
    //         return choropleth(d, colorScale);
    //     });
    //
    // //add text to chart title
    // var chartTitle = d3.select(".chartTitle")
    //     .text("Energy use of year " + expressed + " in each region");
};

//function to highlight enumeration units and bars
function highlight(props){
    // //if no data, return
    // if (props[expressed] == undefined) {
    //     return;
    // }
    // //change stroke
    // var name = props.NAME;
    // if (props.NAME == undefined) {
    //     name = props.name;
    // }
    // var selected = d3.selectAll("." + name)
    //     .style("stroke", "blue")
    //     .style("stroke-width", "2");
    // setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    // //if no data, return
    // if (props[expressed] == undefined) {
    //     return;
    // }
    // var name = props.NAME;
    // if (props.NAME == undefined) {
    //     name = props.name;
    // }
    // var selected = d3.selectAll("." + name)
    //     .style("stroke", function(){
    //         return getStyle(this, "stroke")
    //     })
    //     .style("stroke-width", function(){
    //         return getStyle(this, "stroke-width")
    //     });
    //
    // function getStyle(element, styleName){
    //     var styleText = d3.select(element)
    //         .select("desc")
    //         .text();
    //
    //     var styleObject = JSON.parse(styleText);
    //
    //     return styleObject[styleName];
    // };
    //
    // d3.select(".infolabel")
    //     .remove();
};

//function to create dynamic label
function setLabel(props){
    // //label content
    // var labelAttribute = "<h1>" + Math.round(props[expressed]).toFixed(2) +
    //     "</h1><b>" + expressed + "</b>";
    //
    // //get props name
    // var name = props.NAME;
    // if (props.NAME == undefined) {
    //     name = props.name;
    // }
    // //create info label div
    // var infolabel = d3.select("body")
    //     .append("div")
    //     .attr("class", "infolabel")
    //     .attr("id", name + "_label")
    //     .html(labelAttribute);
    //
    // var regionName = infolabel.append("div")
    //     .attr("class", "labelname")
    //     .html(name);
};

//function to move info label with mouse
function moveLabel(){
    // //if there's no content with infolabel, return
    // if (d3.select(".infolabel")._groups[0][0] == null) {
    //     return;
    // }
    // //get width of label
    // var labelWidth = d3.select(".infolabel")
    //     .node()
    //     .getBoundingClientRect()
    //     .width;
    //
    // //use coordinates of mousemove event to set label coordinates
    // var x1 = d3.event.clientX + 10,
    //     y1 = d3.event.clientY - 75,
    //     x2 = d3.event.clientX - labelWidth - 10,
    //     y2 = d3.event.clientY + 25;
    //
    // //horizontal label coordinate, testing for overflow
    // var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    // //vertical label coordinate, testing for overflow
    // var y = d3.event.clientY < 75 ? y2 : y1;
    //
    // d3.select(".infolabel")
    //     .style("left", x + "px")
    //     .style("top", y + "px");
};

})();
