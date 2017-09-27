var express 	= require('express');
var app 		= express();
var request 	= require('request');
var cheerio 	= require('cheerio')
var schedule	= require('node-schedule');
var mongoose	= require('mongoose');
var bodyParser	= require('body-parser');
var basicAuth	= require('basic-auth-connect');

var port = process.env.PORT || 8080;

//set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
mongoose.Promise = global.Promise;

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

var userSchema = new mongoose.Schema({
	//user schema here
	name: String,
	username: String,
	password: String,
	bracketWins: Number,
	prevBracketWin: Boolean

});

var scheduleSchema = new mongoose.Schema({
	week: Number,
	schedule: Array
});

var Rank = mongoose.model('Rank', rankSchema);
var User = mongoose.model('User', userSchema);
var Schedule = mongoose.model('Schedule', scheduleSchema);


//ParseHUB Information
var API_KEY = 'tciMTc7Tu3U0';
var PROJECT_TOKEN = 't1Ybx2XojMQT';
var RUN_TOKEN = '';

//===WEB SCRAPER SCHEDULING===//
//Request new data run from parseHub and new web scrape Every Monday at 5:26AM Odd time to prevent traffic related issues with server.
//scheduler for Monday 5:26AM (9:26 UTC time)
//TODO: Ditch Parsehub and write your own web scraper function for the same thing.
var j = schedule.scheduleJob('0 26 9 * * 1', function(){
	newRun();	//requests new parseHub run

	var date = new Date();
	var current_hour = date.getHours();
	var current_minute = date.getMinutes();
	var current_second = date.getSeconds();
  	console.log('New parsHub run requested at ' + current_hour + ':' + current_minute + ':' + current_second);

  	//Scrape current week schedule and add to DB.
  	var url = 'http://www.foxsports.com/college-football/schedule';
	scrapeWeeklySchedule(url);
});

//Retrieve most recent data run from parseHub Every day at 6:00AM
//scheduler for 6:00AM (10AM UTC time)
var j = schedule.scheduleJob('0 0 10 * * 1', function(){
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
				team: initRanks[i].team,
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

function scrapeWeeklySchedule(url){
	var schedule = [];
	request(url, function (error, response, html) {
		if (!error && response.statusCode == 200) {

			var $ = cheerio.load(html);

			//grab odds html
			var oddsLink = 'http://www.foxsports.com' + $('.wisbb_firstTeam').parent().find('.wisbb_details').children().children().eq(-2).attr('href');
			var oddsHTML;
			request(oddsLink, function(error, response, oHTML){
				if(error){
					console.log(error);
				} else {
					oddsHTML = oHTML;

					//Get current Week.
					var week = $('.wisbb_pageInfoSecondaryText').text().split('Week ')[1].trim();

					//Get each matchup info
					$('.wisbb_firstTeam').each(function(i, element){
				    	//Get game information
				    	var gameDate = $(this).parent().parent().prev().text().trim();
				    	var gameTime = $(this).parent().find('.wisbb_gameInfo').children().children().eq(1).text();
				    	
				    	//get hometeam information
				     	var homeStacked = $(this).parent().find('.wisbb_secondTeam').children().children().children();
				    	var homeCity = $(homeStacked).eq(1).children().eq(-1).text().trim();
				    	var homeTeam = $(homeStacked).eq(2).text();
				    	var homeRecord = $(homeStacked).eq(3).text();
				    	var homeImage = $(homeStacked).eq(0).attr('src');
				    	var homeRank = parseInt($(homeStacked).eq(1).children().eq(0).text(), 10)
				    	if(isNaN(homeRank)){
				    		var homeRank = '';
				    	}else {
				    		homeRank = '#' + homeRank;
				    	}
				    	var homeSpread = scrapeBettingOdds(oddsHTML, homeCity, 'home');
				    	
				    	//Get awayteam information
				    	var awayStacked = $(this).children().children().children();
				    	var awayCity = $(awayStacked).eq(1).children().eq(-1).text().trim();
				    	var awayTeam = $(awayStacked).eq(2).text();
				    	var awayRecord = $(awayStacked).eq(3).text();
				    	var awayImage = $(awayStacked).eq(0).attr('src');
				    	var awayRank = parseInt($(awayStacked).eq(1).children().eq(0).text(), 10)
				    	if(isNaN(awayRank)){
				    		var awayRank = '';
				    	}else {
				    		awayRank = '#' + awayRank;
				    	}
				    	var awaySpread = scrapeBettingOdds(oddsHTML, awayCity, 'away');
				    	
			    		var obj = {
				    		game: i,
				    		date: gameDate,
				    		time: gameTime,
				    		home: {
				    			city: homeCity, 
					    		team: homeTeam,
					    		image: homeImage,
					    		record: homeRecord,
					    		rank: homeRank,
					    		spread: homeSpread
				    		}, 
				    		away: {
				    			city: awayCity, 
					    		team: awayTeam,
					    		image: awayImage,
					    		record: awayRecord,
					    		rank: awayRank,
					    		spread: awaySpread
				    		}
				    	}
				    	schedule.push(obj);
				    });
				    addScheduleToDB(schedule, week)
				}
			});   
		}
	});
}

function scrapeBettingOdds(html, city, location){
	var $ = cheerio.load(html);

	var spread = $('.wisbb_teamCity').filter(function() {
	 	return $(this).text().trim() === city;
	}).parent().parent().parent().parent().parent().children().eq(1).children().eq(0).children().eq(1).children().eq(-1).children().eq(2).html();

	if(spread === null){
		spread = 0;
	} else{
		if(location === 'away'){
			spread = spread.split('<br>')[0];
		}else if (location === 'home'){
			spread = spread.split('<br>')[1];
		}
		
	}
	return(spread);
}

function addScheduleToDB(curSchedule, curWeek){
	//Remove schedules with same week
		//If schedule for week exists, delete all entries.
	Schedule.find({week: curWeek}).remove(function(err){
		console.log('Removed any schedules for given week');

		var newSchedule = {
			week: curWeek,
			schedule: curSchedule
		};

		Schedule.create(newSchedule, function(err, newlyCreated){
			if(err){
				console.log('Schedule database NOT Updated. Error Below:');
				console.log(err);
			} else {
				console.log('Schedule succesfully saved to database');
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

app.get('/ranks/edit', basicAuth('evanfaler', 'Wildlife1'), function(req, res){
	Rank.find({'week':1}).sort({rank:1}).exec(function(err, allRanks){
        if(err){
            console.log(err);
        } else{
            res.render('ranks-edit', {ranks: allRanks}); 
        }
    });
});

app.get('/ranks/bracket', function(req, res){
	res.render('ranks-bracket');
});

app.get('/ranks/:week', function(req, res){
	getStandings(req.params.week, res);
});

app.post('/ranks', function(req, res){
	updateDatabase(req.body);
	res.redirect('/ranks');
});

//process.env.PORT, process.env.IP
app.listen(port, function(){
	console.log('Server started on port 8080');
})