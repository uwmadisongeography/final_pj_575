//import necessary modules
var app = require("express")();
var bodyParser = require('body-parser');
var pg = require("pg");
var pgp = require('pg-promise')();

function createDBConnection(){
	//returns a database connection
	var cn = {
		host: 'localhost',
		port: 5432, //default
		database: 'delay',
		user: 'postgres',
		password: 'postgres'
	};
	var db = pgp(cn); //do the connection using pg-promise library
	return db
}

//create a connection instance to use in any query
db = createDBConnection()

app.get('/delay1', function (req, res) { 
	//get query parameters
	var year = req.query.year
	var month = req.query.month
	var dayofweek = req.query.dayofweek
	var origin = req.query.origin
	var dest = req.query.dest

	//Query
	sql = "SELECT * FROM delays2 WHERE year = ${year} AND month = ${month} AND dayofweek = ${dayofweek} AND origincode = ${origin} AND destcode = ${dest}"
    
    //Define variables
    vars = {
    	year: year,
    	month: month,
    	dayofweek: dayofweek,
    	origin: origin,
    	dest: dest
    }

	//execute the query
	//expect any number of rows to be returned [0, Infinity)
	db.any(sql, vars)
	.then(function(data){
		//on success
		var ts = new Date().toJSON()
		var resOut = {
			"success" : true,
			"timestamp" : ts,
			data: data
		}
	res.json(resOut) //finish request by sending data back to the user
	})
	.catch(function(err){
		//on error
		var ts = new Date().toJSON()
		var resOut = {
			"success" : false,
			"timestamp" : ts,
			data: []
		}
		res.json(resOut) //send error notifcation back to the user
	})
})

function createAirportList(data,type){
	var out = []
	if (type == 1){//Percent delayed
		for (var i=0; i < data.length; i++) {//Loop through query results
			airport = {"name":data[i].origincode,
				"stats":{
					"ontime": data[i].perontime,
					"cancelled": data[i].percancelled,
					"diverted": data[i].perdiverted,
					"delayed": data[i].perdelayed,
					"carrierd": data[i].percarrierd,
					"weatherd": data[i].perweatherd,
					"nasd": data[i].pernasd,
					"securityd": data[i].persecurityd,
					"lateaircraftd": data[i].perlateaircraftd
				},
				"airline":[]
			}
			out.push(airport)
		}
	}else{
		for (var i=0; i < data.length; i++) {//Loop through query results
			airport = {"name":data[i].origincode,
				"stats":{
					"delayed": data[i].avgdelayed,
					"carrierd": data[i].avgcarrierd,
					"weatherd": data[i].avgweatherd,
					"nasd": data[i].avgnasd,
					"securityd": data[i].avgsecurityd,
					"lateaircraftd": data[i].avglateaircraftd
				},
				"airline":[]
			}
			out.push(airport)
		}
	}
	return out
}

function createAirlineList(data,out,type){
	if (type == 1){//Percent delayed
		for (var i=0; i < out.length; i++) {//Loop through airports
			//Filter airlines by the airport
			airlines = []
			airlines = data.filter(function(d){
				return d.origincode == out[i].name
			})
			//Append airlines to this airport
			for (var x=0; x < airlines.length; x++) {
				air = {"name": airlines[x].airlinename,
					"ontime": airlines[x].perontime,
					"cancelled": airlines[x].percancelled,
					"diverted": airlines[x].perdiverted,
					"delayed": airlines[x].perdelayed,
					"carrierd": airlines[x].percarrierd,
					"weatherd": airlines[x].perweatherd,
					"nasd": airlines[x].pernasd,
					"securityd": airlines[x].persecurityd,
					"lateaircraftd": airlines[x].perlateaircraftd
				}
				out[i].airline.push(air)
			}
		}
	}else{
		for (var i=0; i < out.length; i++) {//Loop through airports
			//Filter airlines by the airport
			var airlines = data.filter(function(d){
				return d.origincode == out[i].name
			})
			//Append airlines to this airport
			for (var x=0; x < airlines.length; x++) {
				air = {"name": airlines[x].airlinename,
					"delayed": airlines[x].avgdelayed,
					"carrierd": airlines[x].avgcarrierd,
					"weatherd": airlines[x].avgweatherd,
					"nasd": airlines[x].avgnasd,
					"securityd": airlines[x].avgsecurityd,
					"lateaircraftd": airlines[x].avglateaircraftd
				}
				out[i].airline.push(air)
			}	
		}
	}
	return out
}

app.get('/airports', function (req, res) { 
	//get query parameters
	var type = req.query.type //1=percent delayed, 0=avg delay
	var fyr = req.query.fyr
	var lyr = req.query.lyr
	var fmth = req.query.fmth
	var lmth = req.query.lmth
	var fdow = req.query.fdow
	var ldow = req.query.ldow
	var airline = req.query.airlines.split(',')

	//Write query based on stats type
	if (type == 1){
		sql1 = "SELECT COALESCE(round((SUM(numontime)::float/NULLIF(SUM(numflights),0))*100),0) AS perontime,COALESCE(round((SUM(numcancelled)::float/NULLIF(SUM(numflights),0))*100),0) AS percancelled,COALESCE(round((SUM(numdiverted)::float/NULLIF(SUM(numflights),0))*100),0) AS perdiverted,COALESCE(round((SUM(numdelayed)::float/NULLIF(SUM(numflights),0))*100),0) AS perdelayed,COALESCE(round((SUM(numcarrierd)::float/NULLIF(SUM(numflights),0))*100),0) AS percarrierd,COALESCE(round((SUM(numweatherd)::float/NULLIF(SUM(numflights),0))*100),0) AS numweatherd,COALESCE(round((SUM(numnasd)::float/NULLIF(SUM(numflights),0))*100),0) AS pernasd,COALESCE(round((SUM(numsecurityd)::float/NULLIF(SUM(numflights),0))*100),0) AS persecurityd,COALESCE(round((SUM(numlateaircraftd)::float/NULLIF(SUM(numflights),0))*100),0) AS perlateaircraftd,origincode FROM delays2 WHERE (year BETWEEN $1 AND $2) AND (month BETWEEN $3 AND $4) AND (dayofweek BETWEEN $5 AND $6) AND airlineid IN ($7:csv) GROUP BY origincode ORDER BY origincode"
		sql2 = "SELECT COALESCE(round((SUM(numontime)::float/NULLIF(SUM(numflights),0))*100),0) AS perontime,COALESCE(round((SUM(numcancelled)::float/NULLIF(SUM(numflights),0))*100),0) AS percancelled,COALESCE(round((SUM(numdiverted)::float/NULLIF(SUM(numflights),0))*100),0) AS perdiverted,COALESCE(round((SUM(numdelayed)::float/NULLIF(SUM(numflights),0))*100),0) AS perdelayed,COALESCE(round((SUM(numcarrierd)::float/NULLIF(SUM(numflights),0))*100),0) AS percarrierd,COALESCE(round((SUM(numweatherd)::float/NULLIF(SUM(numflights),0))*100),0) AS perweatherd,COALESCE(round((SUM(numnasd)::float/NULLIF(SUM(numflights),0))*100),0) AS pernasd,COALESCE(round((SUM(numsecurityd)::float/NULLIF(SUM(numflights),0))*100),0) AS persecurityd,COALESCE(round((SUM(numlateaircraftd)::float/NULLIF(SUM(numflights),0))*100),0) AS perlateaircraftd,origincode,airlinename FROM delays2 WHERE (year BETWEEN $1 AND $2) AND (month BETWEEN $3 AND $4) AND (dayofweek BETWEEN $5 AND $6) AND airlineid IN ($7:csv) GROUP BY airlinename,origincode ORDER BY origincode,airlinename"
	}else {
		sql1 = "SELECT COALESCE(round(SUM(numdelayed*avgdelay)::float/NULLIF(SUM(numdelayed),0)),0) AS avgDelayed,COALESCE(round(SUM(numcarrierd*carrierd)::float/NULLIF(SUM(numcarrierd),0)),0) AS avgcarrierd,COALESCE(round(SUM(numweatherd*weatherd)::float/NULLIF(SUM(numweatherd),0)),0) AS avgweatherd,COALESCE(round(SUM(numnasd*nasd)::float/NULLIF(SUM(numnasd),0)),0) AS avgnasd,COALESCE(round(SUM(numsecurityd*securityd)::float/NULLIF(SUM(numsecurityd),0)),0) AS avgsecurityd,COALESCE(round(SUM(numlateaircraftd*lateaircraftd)::float/NULLIF(SUM(numlateaircraftd),0)),0) AS avglateaircraftd,origincode FROM delays2 WHERE (year BETWEEN $1 AND $2) AND (month BETWEEN $3 AND $4) AND (dayofweek BETWEEN $5 AND $6) AND airlineid IN ($7:csv) GROUP BY origincode ORDER BY origincode"
		sql2 = "SELECT COALESCE(round(SUM(numdelayed*avgdelay)::float/NULLIF(SUM(numdelayed),0)),0) AS avgDelayed,COALESCE(round(SUM(numcarrierd*carrierd)::float/NULLIF(SUM(numcarrierd),0)),0) AS avgcarrierd,COALESCE(round(SUM(numweatherd*weatherd)::float/NULLIF(SUM(numweatherd),0)),0) AS avgweatherd,COALESCE(round(SUM(numnasd*nasd)::float/NULLIF(SUM(numnasd),0)),0) AS avgnasd,COALESCE(round(SUM(numsecurityd*securityd)::float/NULLIF(SUM(numsecurityd),0)),0) AS avgsecurityd,COALESCE(round(SUM(numlateaircraftd*lateaircraftd)::float/NULLIF(SUM(numlateaircraftd),0)),0) AS avglateaircraftd,origincode,airlinename FROM delays2 WHERE (year BETWEEN $1 AND $2) AND (month BETWEEN $3 AND $4) AND (dayofweek BETWEEN $5 AND $6) AND airlineid IN ($7:csv) GROUP BY airlinename,origincode ORDER BY origincode,airlinename"
	}

    //Define variables
    vars = [fyr,lyr,fmth,lmth,fdow,ldow,airline]
	//execute the query
	db.task(t => {
		return t.batch([
			t.any(sql1, vars),
			t.any(sql2, vars)
		]);
	})
	.then(function(data){
		//on success
		//Build airport list
		var out = createAirportList(data[0],type)
		//Build airline list for airport list
		out = createAirlineList(data[1],out,type)
		var resOut = {
			"type":type,
			"success" : true,
			data: out
		}
	res.json(resOut) //finish request by sending data back to the user
	})
    .catch(function(err){
		//on error
		console.log(err)
		var resOut = {
			"type":type,
			"success" : false,
			data: []
		}
		res.json(resOut) //send error notifcation back to the user
    });
})

// start the service
app.listen(8081, function () {
  console.log('Server running...')
})