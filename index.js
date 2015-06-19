var express = require('express');
var cors = require('cors');
var app = express();
var ConnectSdk = require('connectsdk');

var passport = require('passport');
var googleStrat = require('passport-google-oauth').OAuth2Strategy;
var bodyParser = require('body-parser');

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
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

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

app.post('/stupidity', function(req,res){
  res.send(req.query);
});

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
app.post('/challenge', postauth, function(request, res) {
  var game = [];

  try{
    console.log(request.body.game);
    game = JSON.parse(request.body.game);
    console.log(game);
    for(puz in game){
      for(key in puz){
        console.log(typeof puz[key]);
        if(typeof puz[key] != 'string') throw "err";
      }
    }
  }catch(err){
    res.statusCode = 400;
    res.send("Could not parse game");
    return;
  }
 
  var rowIndex = 0;
  var wordParams = game.map(function(d,i){return '$'+(i+1);});
  wordQuery = client.query('SELECT word_id FROM words WHERE word IN (' + wordParams.join(',') + ')',
                           game.map(function(d){return d.word;}));
  wordQuery.on('row', function(d){
    game[rowIndex++].word_id = d.word_id;
  });

  wordQuery.on('end', function(){
    if(rowIndex != game.length){
      res.statusCode = 400;
      res.send("I don't know those words - can only challenge with generated game");
      return;
    }

    challenge_id = null;
    query = client.query('INSERT INTO challenges (owner_id, challenged_id, owner_seconds, cur_status) VALUES ' +
                                                  '($1,$2,$3,\'issued\') RETURNING challenge_id',
                                   [request.user.user_id, request.body.user_id, request.body.time]);
    query.on('row', function(d){challenge_id = d.challenge_id;});
    query.on('end', function(){

      rowIndex = 0;
      var imgParams = game.map(function(d,i){return "($" + (i+1) + ")";}),
      imageQuery = client.query('INSERT INTO images (url) VALUES ' + imgParams.join(',') + ' RETURNING image_id',
                                game.map(function(d){return d.img;}));
      imageQuery.on('row', function(d){
        game[rowIndex++].image_id = d.image_id;
      });

      imageQuery.on('end', function(){

        var cimVals = [];
        var cimParams = game.map(function(d,i){
          cimVals.push(d.image_id);
          cimVals.push(d.word_id);
          return '(' + challenge_id + ', $' + ((i*2)+1) + ', $' + ((i*2)+2) + ')';
        });

        cimQuery = client.query('INSERT INTO challenge_image_word (challenge_id, image_id, word_id) ' + 
                                             'VALUES ' + cimParams.join(', '), cimVals);
        cimQuery.on('end', function(){
          res.statusCode = 200;
          res.send("Entered");
        });
      });
    });
  });
});

//Returns all challenges made by other users TO this user
//{'challenged': Display Name,
// 'completed': true/false,
// 'timeTaken': 512 (seconds),
// 'difficulty': 1,
// 'challenge_id': 92837
//}
app.get('/challengesreceived', function(request, response) {
	//First task is just returning all challenges.
});

//Take parameter 'challenge_id'
//returns {'data': [{img:img, word:word}]}
app.post('/acceptchallenge', function(request, response){

});

//Takes parameter 'challenge_id' and 'timeTaken'
app.post('/completechallenge', function(request, repsonse){

});

//Returns all challenges made to other users BY this user.
//{'challenged': Display Name,
// 'completed': true/false,
// 'timeTaken': 512 (seconds),
// 'difficulty': 1
//}
app.get('/challengessent', function(request, response) {
	//First task is just returning all challenges.
});

//Takes parameters 'user_id', 'score' where score is some number
//calculated based on difficulty, time taken etc.
app.post('/updatescore', function(request, response){
	
});

//Takes no parameters
app.get('/friends', function(request,response){
	
});

/* ----------------end routes -------------------*/

var server = app.listen(app.get('port'), function() {
var host = server.address().address;
var port = server.address().port;

 console.log('Node app is running at :http://%s:%s',host,port);
});
