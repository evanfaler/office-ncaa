var express = require('express');
var app = express();
var request = require('request');
var schedule = require('node-schedule');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var port = process.env.PORT || 8080;

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
	owner: String,
	imgNumber: Number
});

var Rank = mongoose.model('Rank', rankSchema);

//ParseHUB Information
var API_KEY = 'tciMTc7Tu3U0';
var PROJECT_TOKEN = 't1Ybx2XojMQT';
var RUN_TOKEN = '';

//===PARSEHUB REQUESTS===//
//Request new data run from parseHub Every Monday at 5:55AM and 7:15AM
//scheduler for Monday 5:55AM
var j = schedule.scheduleJob('0 55 5 * * 1', function(){
	newRun();	//requests new parseHub run

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
	var current_second = date.getSeconds();
  	console.log('new parsHub run requested at ' + current_hour + ':' + current_minute + ':' + current_second);
});
//scheduler for Monday 7:15PM
var j = schedule.scheduleJob('0 25 7 * * 1', function(){
	newRun();	//requests new parseHub run

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
  	console.log('new parsHub run requested at ' + current_hour + ':' + current_minute);
});

//Retrieve most recent data run from parseHub Every day at 6:00AM and 12:00PM
//scheduler for 6:00AM
var j = schedule.scheduleJob('0 0 6 * * 1', function(){
	//PULL DATA FROM PARSEHUB
	getRun();

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
  	console.log('parseHub data requested at ' + current_hour + ':' + current_minute);
});
//scheduler for 12:00PM
var j = schedule.scheduleJob('0 30 7 * * 1', function(){
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
		addPollToDatabase(JSON.parse(body));
		//initializeDB(JSON.parse(body));
	});
}

function getStandings(curWeek, res){
	var players = ['Evan', 'Gary', 'Joe', 'Ken'];
	var playerObjects = [];

	var evanPoints = 0;
	var garyPoints = 0;
	var joePoints = 0;
	var kenPoints = 0;

	Rank.find({}, function(err, allRanks){
		if(err){
			console.log('Something went wrong finding standings');
			console.log(err);
		} else {
			var totWeeks = allRanks.length / 24;

			var ranks = [];
			for(var i = 0; i < allRanks.length; i++){
				if(allRanks[i].week == curWeek){
					ranks.push(allRanks[i]);
				};
			};

			for(var i = 0; i < ranks.length; i++){
				if(ranks[i].owner === 'Evan'){
					evanPoints += ranks[i].rank;
				} else if(ranks[i].owner === 'Gary'){
					garyPoints += ranks[i].rank;
				} else if (ranks[i].owner === 'Joe'){
					joePoints += ranks[i].rank;
				} else if (ranks[i].owner === 'Ken'){
					kenPoints += ranks[i].rank;
				}
			}

			playerObjects.push({
				name: 'Evan',
				score: evanPoints
			});
			playerObjects.push({
				name: 'Gary',
				score: garyPoints
			});
			playerObjects.push({
				name: 'Joe',
				score: joePoints
			});
			playerObjects.push({
				name: 'Ken',
				score: kenPoints
			});

			var sortedArray = playerObjects.sort(compareScore);
			var sortedRanks = ranks.sort(compareRank);
			res.render('ranks', {ranks: ranks, standings: sortedArray, week: curWeek, totWeeks: totWeeks}); 
		}
	});	
}

function compareScore(a, b){
	var scoreA = a.score;
	var scoreB = b.score;

	var comparison = 0;
	if(scoreA > scoreB){
		comparison = 1;
	} else if (scoreA < scoreB){
		comparison = -1;
	}
	return comparison
}

function compareRank(a, b){
	var rankA = a.rank;
	var rankB = b.rank;

	var comparison = 0;
	if(rankA > rankB){
		comparison = 1;
	} else if (rankA < rankB){
		comparison = -1;
	}
	return comparison
}



//add new weekly poll to database. 
function addPollToDatabase(body){
	Rank.find({'week': parseInt(body.coaches_poll[0].week.slice(-2))}).remove(function(err){
		console.log(err);
	});
	
	//Make Array of current rankings
	var curRanks = body.coaches_poll;
	//Loop through week 1 db entries
	Rank.find({'week':1}, function(err, initRanks){
			var rank = 25;
		
		//If team curRank team is in initRanks, update rank to current rank
		//Otherwise rank remains unchanged at 25
		for(var i = 0; i < initRanks.length; i++){
			var initTeam = initRanks[i].team;

			var curIndex = curRanks.findIndex(function(rank) {
				return rank.team == initTeam;
			});
			
			if(curIndex != -1){
				rank = curRanks[curIndex].rank;
			} else{
				rank = 25;
			}

			//Create new Rank object with updated values
			var newRank = {
				rank: rank,
				team: initRanks[i].team,				//THIS IS WRONG
				year: initRanks[i].year,
				week: parseInt(curRanks[0].week.slice(-2)),
				movement: initRanks[i].movement,
				owner: initRanks[i].owner,
				imgNumber: initRanks[i].imgNumber
			}

			//Save to DB
			Rank.create(newRank, function(err, newlyCreated){
			if(err){
				console.log('Database NOT Updated. Error Below:');
				console.log(err);
			} else{
				console.log('Database Updated Succesfully!');
			}		
		});	
		}
		
		
	});
}

function updateDatabase(body){
	if(body.hasOwnProperty('save')) {
		for (var item in body){
			if(body[item] != "" && item.slice(0,3) != "img"){
				Rank.update({'team': item}, {
					owner: body[item]
				}, function(err){
					if(err) {
						console.log(err);
					}
				});
			}
			if(body[item] != "" && item.slice(0,3) === "img"){
				Rank.update({'team': item.substr(3)}, {
					imgNumber: body[item]
				}, function(err){
					if(err) {
						console.log(err);
					}
				});
			}
		}
	}
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
		var newRank = {
			rank: item.rank,
			team: item.team,
			year: item.year.slice(-4),
			week: parseInt(item.week.slice(-2)),
			movement: item.movement,
			owner: 'None',
			imgNumber: -1
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
	getStandings(1, res);
});

app.get('/ranks/:week', function(req, res){
	getStandings(req.params.week, res);
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
	updateDatabase(req.body);
	res.redirect('/ranks');
});

//process.env.PORT, process.env.IP
app.listen(port, function(){
	console.log('Server started on port 8080');
})