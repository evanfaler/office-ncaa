var express = require('express');
var app = express();
var request = require('request');
var schedule = require('node-schedule');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

//set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));

//Connect to database
mongoose.connect("mongodb://evanfaler:Wildlife1@ds131854.mlab.com:31854/ncaa_rank", {useMongoClient: true});

//DB Schema and Setup
var rankSchema = new mongoose.Schema({
	rank: Number,
	team: String,
	year: Number,
	week: Number,
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
		updateDB(JSON.parse(body));
		//initializeDB(JSON.parse(body));
	});
}

//TODO: update database correctly. 
function updateDB(body){

	//TODO: UPDATE DATABASE WITH NEW DATA.

	//Copy week 1 database
	//Change all ranks to 25
	//Run through and change rank on teams that show up in curRanks

	//DELETE ANY PREVIOUS DB ENTRIES FOR THE WEEK BEING EDITED
	Rank.find({'week': week}).remove(function(err){
		console.log(err);
	});

	//FIND AND COPY THE FIRST WEEK OF RANKS	
	Rank.find({'week':1}, function(err, pastRanks){
		var addCount = 0;
		pastRanks.forEach(function(item, index){

			newRank = {
				rank: 25,
				team: item.team,
				year: item.year.slice(-4),
				week: parseInt(item.week.slice(-2)),
				movement: item.movement,
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
	});

	var week = parseInt(curRanks[0].week.slice(-2));

	

	


	// var curRanks = body.coaches_poll;
	// var updated = false;
	// Rank.find({'week':1}, function(err, pastRanks){
	// 	pastRanks.forEach(function(oldRank){
	// 		curRanks.forEach(function(curRank){
	// 			if(oldRank.team === curRank.team){
	// 				console.log('Need to update ' + oldRank.team);
	// 				updated = true;
	// 			} else {

	// 			}
	// 		});
	// 	});
	// });

	
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
			year: item.year.slice(-4),
			week: parseInt(item.week.slice(-2)),
			movement: item.movement,
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
	res.send('Root Directory');
});

app.get('/ranks', function(req, res){
	Rank.find({'week':1}).sort({rank:1}).exec(function(err, allRanks){
        if(err){
            console.log(err);
        } else{
            res.render('ranks', {ranks: allRanks}); 
        }
    });
});

app.get('/ranks/edit', function(req, res){
	Rank.find({'week':1}).sort({rank:1}).exec(function(err, allRanks){
        if(err){
            console.log(err);
        } else{
            res.render('ranks-edit', {ranks: allRanks}); 
        }
    });
});

app.post('/ranks', function(req, res){
	//Loop through and update DB
	if(req.body.hasOwnProperty('save')) {
		for (team in req.body){
			if(req.body[team] != ""){
				Rank.update({'team': team}, {
					owner: req.body[team]
				}, function(err){
					if(err) {
						console.log(err);
					}
				});
			}
		}
	}
	res.redirect('/ranks')
});

//process.env.PORT, process.env.IP
app.listen(8080, function(){
	console.log('Server started on port 8080');
	//RUN_TOKEN = 'tj_JvS49QrML';		//Week 1
	RUN_TOKEN = 'tJrpgN_AbWCW';			//Week 2
	//RUN_TOKEN = 't7WyMnBm6Yig';		//Week 3
	getRun();
})