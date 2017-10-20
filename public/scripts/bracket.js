var allGames = document.getElementsByClassName('schedule-card');

for(var i = 0; i < allGames.length; i++){
	allGames[i].addEventListener('click', function(){
		var thisId = this.id;
		if(thisId.substr(-1) === 'a'){
			var thatId = thisId.substring(0, thisId.length-1) + 'b';
		} else {
			var thatId = thisId.substring(0, thisId.length-1) + 'a';
		}
		
		if(document.getElementById(thatId).classList.contains('active')){
			document.getElementById(thatId).classList.toggle('active');
		}
		
		this.classList.toggle('active');
	});
}

function savePredictions(week) {
	var gameArray = document.getElementsByClassName("schedule-row");
	
	var predictionArray = [];
	
	var completeForm = true;
	
	for(var i = 0; i < gameArray.length; i++){
		if(gameArray[i].childNodes[1].classList.contains('active')){
			predictionArray.push(0);
		} else if (gameArray[i].childNodes[5].classList.contains('active')){
			predictionArray.push(1);
		} else{
			predictionArray.push(2);
			console.log('Missing Prediction');
			completeForm = false;
		}
	}
	
	//Get name of person who is submitting.
	var name = '';
	var radios = document.getElementsByName('player');

	for (var i = 0, length = radios.length; i < length; i++) {
	    if (radios[i].checked) {
	        name = radios[i].value;
	        break;
	    }
	}
	
	if(name === ''){
		completeForm = false;
	}
	
	if(completeForm){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", '/ranks/bracket', true);
		xhr.setRequestHeader("Content-type","application/json");
		xhr.send(JSON.stringify({
			name: name, 
			week: week, 
			predictions: predictionArray
		}));
		
		window.location = "/ranks/bracket";
	}else {
		alert('Missing Information')
	}
}
