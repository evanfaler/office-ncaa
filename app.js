var express = require('express');
var app = express();
var request = require('request');
var schedule = require('node-schedule');
var mongoose = require('mongoose');

//set the view engine to ejs
app.set('view engine', 'ejs');

//Connect to database
mongoose.connect("mongodb://evanfaler:Wildlife1@ds131854.mlab.com:31854/ncaa_rank", {useMongoClient: true});

//DB Schema and Setup
var rankSchema = new mongoose.Schema({
	rank: Number,
	team: String,
	movement: Number,
	owner: String
});

var Rank = mongoose.model('Rank', rankSchema);

//ParseHUB Information
var API_KEY = 'tciMTc7Tu3U0';
var PROJECT_TOKEN = 't1Ybx2XojMQT';
var RUN_TOKEN = '';

//===PARSEHUB REQUESTS===//
//Request new data run from parseHub Every day at 5:55AM and 11:55AM
//scheduler for 5:55AM
var j = schedule.scheduleJob('0 55 5 * * *', function(){
	newRun();	//requests new parseHub run

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
	var current_second = date.getSeconds();
  	console.log('new parsHub run requested at ' + current_hour + ':' + current_minute + ':' + current_second);
});
//scheduler for 11:55PM
var j = schedule.scheduleJob('0 55 11 * * *', function(){
	newRun();	//requests new parseHub run

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
  	console.log('new parsHub run requested at ' + current_hour + ':' + current_minute);
});

//Retrieve most recent data run from parseHub Every day at 6:00AM and 12:00PM
//scheduler for 6:00AM
var j = schedule.scheduleJob('0 0 6 * * *', function(){
	//PULL DATA FROM PARSEHUB
	getRun();

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
  	console.log('parseHub data requested at ' + current_hour + ':' + current_minute);
});
//scheduler for 12:00PM
var j = schedule.scheduleJob('0 0 12 * * *', function(){
	//PULL DATA FROM PARSEHUB
	getRun();

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
  	console.log('parseHub data requested at ' + current_hour + ':' + current_minute);
});


//===HELPER FUNCTIONS===//
function newRun() {
	request({
	  	uri: 'https://www.parsehub.com/api/v2/projects/' + PROJECT_TOKEN + '/run',
	  	method: 'POST',
	  	form: {
	    	api_key: API_KEY
	  	}
	}, function(err, resp, body) {
		//UPDATE RUN TOKEN. STORE NECESSARY DATA
		var body = JSON.parse(body);
		RUN_TOKEN = body.run_token;
	});
}

function getRun() {
	request({
	  	uri: 'https://www.parsehub.com/api/v2/runs/' + RUN_TOKEN + '/data',
	  	method: 'GET',
	  	gzip: true,
	  	qs: {
	    	api_key: API_KEY,
	    	format: "json"
	  	}
	}, function(err, resp, body) {
		//updateDB(JSON.parse(body));
		initializeDB(JSON.parse(body));
	});
}

//TODO: update database correctly. 
function updateDB(body){
	//console.log(body.coaches_poll[0].team);
	//Clear all previous rankings from database
	Rank.remove({}, function(err,removed) {
		if(err){
			console.log(err);
		} else{
			console.log('Database cleared succesfully');
		}
	});

	//Add new rankings to database
	var addCount = 0;
	body.coaches_poll.forEach(function(item, index){
		var rank = item.rank;
		newRank = {
			rank: item.rank,
			team: item.team
		}

		Rank.create(newRank, function(err, newlyCreated){
			if(err){
				console.log(err);
			} else{
				addCount++;
				if(addCount === 25){
					console.log('All ranks succesfully updated')
				} else if(index === 26 && addCount < 25){
					console.log('Database update unsucessful!');
					console.log('Only ' + addCount + ' entries were added.');
				}
			}		
		});		
	});
}

function initializeDB(body){
	Rank.remove({}, function(err,removed) {
		if(err){
			console.log(err);
		} else{
			console.log('Database cleared succesfully');
		}
	});

	//Add new rankings to database
	var addCount = 0;
	body.coaches_poll.forEach(function(item, index){
		var rank = item.rank;
		newRank = {
			rank: item.rank,
			team: item.team,
			movement: 0,
			owner: 'None'
		}

		Rank.create(newRank, function(err, newlyCreated){
			if(err){
				console.log(err);
			} else{
				addCount++;
				if(addCount === 25){
					console.log('All ranks succesfully updated')
				} else if(index === 26 && addCount < 25){
					console.log('Database update unsucessful!');
					console.log('Only ' + addCount + ' entries were added.');
				}
			}		
		});		
	});
}

//===ROUTES===//
app.get('/', function(req, res){
	console.log('Made it to the root directory');
});

app.get('/ranks', function(req, res){
	console.log('Made it to the /ranks index route.');
	res.render('ranks');
});

app.get('/ranks/edit', function(req, res){
	console.log('Made it to the /ranks edit route.');
	res.render('ranks-edit');
});

app.put('/ranks/update', function(req, res){
	console.log('Put command at /index issued.');
});

app.listen(8080, function(){
	console.log('Server started on port 8080');
	//RUN_TOKEN = 'tnw1UmdGbSVF';	//Current week run.
	RUN_TOKEN = 'tR5S7CjThvx3';		//Preseason run data.
	getRun();
})