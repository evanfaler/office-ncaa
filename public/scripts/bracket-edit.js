function getNewSchedule() {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", '/ranks/bracket/update', true);
	xhr.send();
	
	window.location = "/ranks/bracket";
}
