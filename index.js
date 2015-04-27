var express = require('express');
var cors = require('cors');
var app = express();



var opts = {
server: {
socketOptions: { keepAlive: 1 }
}
};





/*------------------------------------------------- hardcoded data-------------------------------------------------------*/

 var hardcodedImages= {"data" : [ 
	{"img" : "http://graphics8.nytimes.com/images/2012/12/17/sports/AVIE_NightSki-slide-U5NK/AVIE_NightSki-slide-U5NK-jumbo.jpg", "word" : "night"}, 	 {"img" : "http://graphics8.nytimes.com/packages/images/multimedia/bundles/projects/2012/AvalancheDeploy/avalanche_crack.jpg", "word":"avalanche"},
	{"img":"http://cdn.covers.complex.com/assets/pharrell/desktop/img/scene5/handout.jpg","word":"hand"}
	]};

//-------------------------------end data--------------------------------------------------------------------------------//

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(cors());


//add header information for all routes
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.contentType('application/json');

  next();
});

/* ---------- routes ----------------------------*/

/* /wildcard all get routes  */

app.get('/data.json', function(req, res,next) {

	res.header('Content-Length',hardcodedImages.length);
	res.send(hardcodedImages); 
	next();	

});


/* ----------------end routes -------------------*/


var server = app.listen(app.get('port'), function() {
var host = server.address().address;
var port = server.address().port;

 console.log('Node app is running at :http://%s:%s',host,port);
});
