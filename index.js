var express = require('express');
var cors = require('cors');
var app = express();
var ConnectSdk = require('connectsdk');

var passport = require('passport');
var googleStrat = require('passport-google-oauth').OAuth2Strategy;

passport.use(new googleStrat({
  clientID: "431848180596-4n65gocm2d8k71elvq3a6vchtka9cqgv.apps.googleusercontent.com",
  clientSecret: "H6IsbWVBcOWWnHmQEDtjynnZ",
  callbackURL: "https://still-waters-3351.herokuapp.com/authredir"
  }
  , function(accessToken, refreshToken, profile, done){
    profile.access_token = accessToken;
    done(null, profile);
  })
);

//--postgresql daqtabase connection client 
var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL
    
var client = new pg.Client(connectionString);
client.connect(); 
  
app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(cors());
app.use(passport.initialize());

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
    imgs = [];
    for(var i=0; i<30; i++) {
      imgs.push({"display_sizes":[{"uri":"http://cache4.asset-cache.net/xt/83454805.jpg?v=1&g=fs1|0|DV|54|805&s=1&b=MkUw"}],"title":"Puppy with oversized bone dog"});
    }
    cb(null,{"images":imgs});

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

app.get('/account', getauth, function(request,response){
  if(!request.isAuthenticated()){
    response.redirect('/login');
    return;
  } 
  
  response.send("ID: " + request.user.user_id + "\nName: " + request.user.display_name);
}); 

app.get('/login', function(req, res){
  res.header('content-type', 'text/html');
  res.send("<a href=\"/auth/google\">Login with Google</a>");
});

app.get('/auth/google',passport.authenticate('google', {scope: ['email']}));

app.get('/authredir',
  passport.authenticate('google', {failureRedirect: '/login', session:false}),
  function(req,res){
    query = client.query('SELECT token FROM users WHERE user_id=$1',[req.user.id]);
    token = null;
    query.on('row', function(d){token = d.token;});
    query.on('end', function(){
      //If token is null, then no user was found.  Make a new entry.
      //Otherwise, the token is either still extant or empty.  Either way, we make a new one and return it.
      insertOrUpdate = null;
      if (token==null){
        insertOrUpdate = client.query('INSERT INTO users (user_id,display_name,difficulty,token) VALUES ' +
                                                        '($1,     $2,          $3,        $4)',
                                                     [req.user.id, req.user.displayName, 1, req.user.access_token]);
      }
      else{
        insertOrUpdate = client.query('UPDATE users SET token=$1 WHERE user_id=$2',[req.user.access_token,req.user.user_id]);
      }

      insertOrUpdate.on('end', function(){
        res.send({'access_token': req.user.access_token, 'name': req.user.displayName});
      });
    });
  }
);

function postauth(req,res,next){
  return auth(req.body,req,res,next);
}

function getauth(req,res,next){
  return auth(req.query,req,res,next);
}

function auth(params,req,res,next){
  if(!params.hasOwnProperty('token')){
    res.statusCode = 400;
    res.send('Error 400: Token not provided');
    return false;
  }

  user = null;
  query = client.query('SELECT user_id,display_name,token,difficulty FROM users WHERE token=$1', [params.token]);
  query.on('row', function(d){user=d;});
  query.on('end', function(){
    if(user==null){
      res.statusCode = 401;
      res.send("Token " + params.token + " does not exist");
    }else{
      req.user = user;
      next()
    }
  });
}

/*OAuth toy code ends*/

//Takes parameters 'difficulty' and 'num_images'.
//Returns {'data': [{'img':url,'word':word}]}
app.get('/play', function(request, response) {
  apiCall(function(err,res){
    if(err) response.send(err);

    images = randomChoices(res.images, 10);

    var titleWords = [];
    images.forEach(function(img){
      img.title = img.title.toLowerCase().split(" ");
      titleWords = titleWords.concat(img.title);
    })

    //Make a list of unique words over all titles
    titleWords = titleWords.filter(function(w,i,l){return w != '' && l.indexOf(w) === i;})

    var params = titleWords.map(function(w,i){return '$'+(i+1);});
    var words = {};

    var query = client.query('SELECT word,nounorverb FROM words2 WHERE word IN (' + params.join(',') + ')',titleWords);
    query.on('row',function(w){words[w.word] = w.nounorverb;});
    query.on('end',function(){

      images.forEach(function(img){
        img.nouns = img.title.filter(function(w){return words[w] == 'n';});
      });

      images = images.filter(function(img){return img.nouns.length > 0;});

      image_mapper = function(img){
        return {'img':img.display_sizes[0].uri, 'word':img.nouns[0]};
      }
      data_to_send = {'data': randomChoices(images,3).map(image_mapper)};

      response.header('Content-Length',data_to_send.data.length);
      response.send(data_to_send);

    });
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
