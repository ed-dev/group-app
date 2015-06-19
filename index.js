var express = require('express');
var cors = require('cors');
var app = express();

var bodyParser = require('body-parser');

//--postgresql daqtabase connection client 
var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL
    
var client = new pg.Client(connectionString);
client.connect(); 
  
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

//add header information for all routes
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.contentType('application/json');

  next();
});

require('./routes/auth')(app, client);
require('./routes/play')(app, client);
require('./routes/friends')(app, client);
require('./routes/challenge')(app, client);

//Takes parameters 'user_id', 'score' where score is some number
//calculated based on difficulty, time taken etc.
app.post('/updatescore', function(request, response){
	
});

//Takes no parameters
app.get('/friends', function(request,response){
	
});

var server = app.listen(app.get('port'), function() {
var host = server.address().address;
var port = server.address().port;

 console.log('Node app is running at :http://%s:%s',host,port);
});
