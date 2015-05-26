var express = require('express');
var cors = require('cors');
var app = express();
var ConnectSdk = require('connectsdk');

var passport = require('passport');
var googleStrat = require('passport-google-oauth').OAuth2Strategy;

passport.use(new googleStrat({
  clientID: "431848180596-4n65gocm2d8k71elvq3a6vchtka9cqgv.apps.googleusercontent.com",
  clientSecret: "H6IsbWVBcOWWnHmQEDtjynnZ",
  callbackURL: "http://still-waters-3351.herokuapp.com/authredir"
  }
  , function(accessToken, refreshToken, profile, done){
    done(null, profile);
  })
);

//--postgresql daqtabase connection client 
var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL,
                     client,
                     query;
    
var client = new pg.Client(connectionString);
client.connect(); 
  
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());

//add header information for all routes
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.contentType('application/json');

  next();
});

function absent(el, array){
  return array.indexOf(el)==-1;
}

function randomChoices(list, num){
  var random_indices = [];
  while (random_indices.length < num){
    var ran = Math.floor(Math.random()*list.length);
    if (absent(ran, random_indices))
      random_indices.push(ran);
  }
  return random_indices.map(function(i){return list[i];});
}

function apiCall(cb){
  //On the vuw lab machines, node can't make external calls for some reason...
  //I emailed Aaron Chen about it.  Until it's fixed...
  //Set to true to use hardcoded image list instead of calling the API
  onLabsSoStubOutAPI = false; 
  if(onLabsSoStubOutAPI){
    cb(null,{"images":[
            {"display_sizes":[{"uri":"http://cache4.asset-cache.net/xt/83454805.jpg?v=1&g=fs1|0|DV|54|805&s=1&b=MkUw"}],"title":"Puppy with oversized bone"},
            {"display_sizes":[{"uri":"http://cache2.asset-cache.net/xt/83454805.jpg?v=1&g=fs1|0|DV|54|805&s=1&b=MkUw"}],"title":"Puppy with oversized bone"},
            {"display_sizes":[{"uri":"http://cache2.asset-cache.net/xt/83454805.jpg?v=1&g=fs1|0|DV|54|805&s=1&b=MkUw"}],"title":"Puppy with oversized bone"},
            {"display_sizes":[{"uri":"http://cache2.asset-cache.net/xt/83454805.jpg?v=1&g=fs1|0|DV|54|805&s=1&b=MkUw"}],"title":"Puppy with oversized bone"}]});

  } else{
    sdk = new ConnectSdk("56bdt8yjqf64774m5a2yfuz4","a34kr22MJEDem4edRSqwfzpJfq8UXUx296yBWgcr5u9RA")
            .search()
            .images()
            .creative()
            .withExcludeNudity()
            .withPage(1)
            .withPageSize(100)
            .withPhrase('single object')
            .execute(cb);
  }
}

/* ---------- routes ----------------------------*/

/*OAuth toy code begins.  Most of this needs changing.*/

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.get('/', function(request, response) {
  apiCall(function(err,res){
    if(err) response.send(err);
    else{ 
      response.header('Content-Length',res.length);
      response.send(request.user ? request.user.displayName + " logged in" : "Log in.");
    }
  });
});

app.get('/account', function(request,response){
  if(!request.isAuthenticated()){
    response.redirect('/login');
    return;
  } 
  
  response.send("ID: " + request.user.id + "\nName: " + request.user.displayName);
}); 

app.get('/login', function(req, res){
  res.header('content-type', 'text/html');
  res.send("<a href=\"/auth/google\">Login with Google</a>");
});

app.get('/auth/google',passport.authenticate('google', {scope: ['email']}));

app.get('/authredir',
  passport.authenticate('google', {failureRedirect: '/login'}),
  function(req,res){
    res.send('authenticated :)');
  }
);

/*OAuth toy code ends*/

//Takes parameters 'difficulty' and 'num_images'.
//Returns {'data': [{'img':url,'word':word}]}
app.get('/play', function(request, response) {
  apiCall(function(err,res){
    if(err) response.send(err);

    images = res.images;
    image_mapper = function(img){
      return {'img':img.display_sizes[0].uri, 'word':img.title.split(" ")[0]};
    }
    var numImgs = 3;
    data_to_send = {'data': randomChoices(images, numImgs).map(image_mapper)};

    /*--test saving images and words to database
    
    var query;
    //save a random image to the database. No error handling
	query = client.query({
	    text: 'INSERT INTO images(url) VALUES($1)',
	    values :[data_to_send.data[0].img]
	});

    query.on('row',function(result){});

	query = client.query('SELECT currval(pg_get_serial_sequence(\'images\',\'image_id\'))');
	console.log('looking for id =%s',JSON.stringify(query,null,' '));

    console.log('Database inserts completed');
    //--end test saving images to database */
   
    response.header('Content-Length',data_to_send.data.length);
    response.send(data_to_send);
  });
});

//Takes parameters 'user_id', 'difficulty', 'time', {'data': [{'img':img, 'word':word}]}
//Possible expansion: images completed, time taken for each, etc etc.
//Returns 'true' or 'false'
app.post('/challenge', function(request, response) {
});

//Returns all challenges made by other users TO this user
app.get('/challengesreceived', function(request, response) {
	//First task is just returning all challenges.
});

//Returns all challenges made to other users BY this user.
app.get('/challengessent', function(request, response) {
	//First task is just returning all challenges.
});

//Takes parameters 'user_id', 'score' where score is some number
//calculated based on difficulty, time taken etc.
app.get('/updatescore', function(request, response){
	
});







/* ----------------end routes -------------------*/

var server = app.listen(app.get('port'), function() {
var host = server.address().address;
var port = server.address().port;

 console.log('Node app is running at :http://%s:%s',host,port);
});
