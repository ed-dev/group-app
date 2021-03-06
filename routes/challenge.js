var check_params = require('./check_params');

module.exports = function(app, client){

  //Takes parameters 'user_id', 'difficulty', 'time', {'data': [{'img':img, 'word':word}]}
  //Possible expansion: images completed, time taken for each, etc etc.
  //Returns 'true' or 'false'
  app.post('/challenge', check_params(['user_id','difficulty','time','game']), app.auth, function(request, res) {
    if(request.query.difficulty < 0 || request.query.difficulty > 2){
      res.statusCode = 400;
      res.send("Difficulty must be between 0 and 2");
      return;
    }
    if(request.query.time < 1){
      res.statusCode = 400;
      res.send("Cannot complete a puzzle in less than a second");
      return;
    }
    var game = [];
    console.log("Game is: ");
    console.log(request.query.game);

    //A user can't challenge themselves.
    if(request.user.user_id == request.query.user_id){
      res.statusCode = 400;
      res.send("You can't challenge yourself.");
    }

    //First, try to parse the game.  Run the game through the JSON parser then check
    //that each element is a string so we don't accidentally execute something.
    try{
      game = JSON.parse(request.query.game);
      console.log("Game after parsing: ");
      console.log(game);
      for(puz in game){
        for(key in game[puz]){
          if(typeof game[puz][key] != 'string') throw "err";
        }
      }
    }catch(err){
      //If something went wrong, return error.
      res.statusCode = 400;
      res.send("Could not parse game");
      return;
    }

    //First, we want to look up the words in the puzzle to check we know
    //about them.  For each word we know, we'll give it a word_id so we know
    //the word's id in the words table.
    //To do that, we need a map of word:{word,img} so we can look up an individual
    //(image,word) combination and set a property on it.
    gameDict = {};
    for(puz in game){gameDict[game[puz].word] = game[puz];}
   
    //Construct the $ parameters for the query by making a list of $1,$2,$3 etc as
    //long as the game list.
    var wordParams = game.map(function(d,i){return '$'+(i+1);});
    wordQuery = client.query('SELECT word,word_id FROM words WHERE word IN (' + wordParams.join(',') + ')',
                             game.map(function(d){return d.word;}));
    wordQuery.on('row', function(d){
      //For each row returned, look up the word in the game dictionary we created
      //above and set the word_id.  The objects in this dict are the same as in the
      //game array.
      gameDict[d.word].word_id = d.word_id;
    });
  
    wordQuery.on('end', function(){
      //Now check that a word_id was set for each word. If not, then some of the words were
      //not found.  In that case, the game was not generated by us - return error.
      for(puz in game){
        if(game[puz].word_id == undefined){
          res.statusCode = 400;
          res.send("I don't know those words - can only challenge with generated game");
          return;
        }
      }
  
      //Now we'll insert the game into the appropriate tables.
      //Rows in the 'images' and 'words' table stores a single value of its type.
      //A row in the 'challenge_image_word' table describes a single (word,image) combination.
      //A row in the 'challenge' table links some number of 'challenge_image_word' rows to create a whole challenge.
      //So first we make a new challenge.
      challenge_id = null;
      query = client.query('INSERT INTO challenges (owner_id, challenged_id, owner_seconds, cur_status, difficulty) VALUES ' +
                                                    '($1,$2,$3,\'issued\',$4) RETURNING challenge_id',
                                 [request.user.user_id, request.query.user_id, request.query.time, request.query.difficulty]);
      query.on('error', function(d){
        res.statusCode = 400;
        res.send("You can't challenge a user that doesn't exist");
      });
      query.on('row', function(d){challenge_id = d.challenge_id;});
      query.on('end', function(){
  
        //Then we insert the images from the game.
        rowIndex = 0;
        var imgParams = game.map(function(d,i){return "($" + (i+1) + ")";}),
        imageQuery = client.query('INSERT INTO images (url) VALUES ' + imgParams.join(',') + ' RETURNING image_id',
                                  game.map(function(d){return d.img;}));
        imageQuery.on('row', function(d){
          //On each returned row, we increment our row index and save the image_id to that puzzle.
          //This makes the assumption that the 'row' event happens sequentially for each insert.
          //IS THIS TRUE?? Must test.
          game[rowIndex++].image_id = d.image_id;
        });
  
        imageQuery.on('end', function(){
  
          //Now we build the combinations for the challenge_image_word table.
          //In this first part we build up the $ parameters and values lists for the insert query.
          //eg if the game is [{img:'img1.jpg',word:'word1'},{img:'img2.jpg',word:'word2'}] and challenge_id is 1 then
          //cimParams = ['(1,$1,$2)','(1,$3,$4)'] and 
          //cimValues = ['img1.jpg','word1','img2.jpg','word2']
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
            res.send({'challenge_id': challenge_id});
          });
        });
      });
    });
  });
  
//Returns all challenges made by other users TO this user
//{'challenge_id': 92837
// 'display_name': Display Name,
// 'completed': true/false,
// 'timeTaken': 512 (seconds),
// 'difficulty': 1
//}
app.get('/challengesreceived', app.auth, function(request, response) {
  //First task is just returning all challenges.
  var data_to_send = [];
  var query = client.query('SELECT challenges.challenge_id,' +
                        'users.display_name,' +
                        'challenges.cur_status AS completed,' +
                        'challenges.owner_seconds AS timeTaken,' +
                        'challenges.difficulty ' +
                    'FROM challenges INNER JOIN users ON (users.user_id = challenges.owner_id)' +
                    'WHERE challenged_id = $1', [request.user.user_id]);
  query.on('row', function(row){
    data_to_send.push(row);
  });
  query.on('end', function(){
    response.header('Content-Length', data_to_send.length);
    response.send(data_to_send);
  });
});

app.get('/challengesreceivedandsent', app.auth, function(request, response) {
  var data_to_send = [];
  var sql = 
  "SELECT c.challenge_id,"+
  "u1.display_name AS challenger,"+
  "u2.display_name AS challengee,"+
  "CASE WHEN u2.user_id = $1 "+
    "THEN FALSE "+
    "ELSE TRUE "+
  "END AS sent, "+
  "CASE WHEN c.challenged_seconds IS NULL "+
    "THEN 'incomplete' "+
    "ELSE CASE WHEN (u2.user_id = $1 AND (c.owner_seconds > c.challenged_seconds AND c.challenged_seconds != -1)) OR " +
                   "(u1.user_id = $1 AND (c.owner_seconds < c.challenged_seconds OR c.challenged_seconds = -1)) "+
      "THEN 'won' "+
      "ELSE CASE WHEN c.owner_seconds = c.challenged_seconds " +
        "THEN 'drew' "+
        "ELSE 'lost' "+
      "END "+
    "END "+
  "END AS result, "+
  "c.owner_seconds AS challenger_time_taken, "+
  "c.challenged_seconds AS challengee_time_taken, "+
  "c.difficulty "+
  "FROM challenges c "+
  "INNER JOIN users u1 ON (u1.user_id = c.owner_id) "+
  "INNER JOIN users u2 ON (u2.user_id = c.challenged_id) "+
  "WHERE c.owner_id = $1 OR c.challenged_id = $1 ";
  
  var query = client.query(sql, [request.user.user_id]);
  query.on('row', function(row){
    data_to_send.push(row);
  });
  query.on('end', function(){
    response.header('Content-Length', data_to_send.length);
    response.send(data_to_send);
  });
});

//Take parameter 'challenge_id'
//returns {'data': [{img:img, word:word}]}
app.get('/acceptchallenge', check_params(['challenge_id', 'response']), app.auth, function(request, response){
  if(request.query.response == 'true'){
    var data_to_send = [];
    var query = client.query('SELECT images.url AS img,' +
                         'words.word AS word ' +
                         'FROM challenges '+
                         'INNER JOIN challenge_image_word ON (challenges.challenge_id = challenge_image_word.challenge_id) '+
                         'INNER JOIN words ON (words.word_id = challenge_image_word.word_id) '+
                         'INNER JOIN images ON (challenge_image_word.image_id = images.image_id) '+
                         'WHERE challenges.challenge_id = $1 AND challenges.challenged_id = $2',
                         [request.query.challenge_id, request.user.user_id]);
    query.on('row', function(row) {
      data_to_send.push(row);
    });
    query.on('end', function(result) {
      if(result.rowCount==0){
        response.statusCode = 400;
        response.send("Challenge not found or access denied");
      }else{
        response.send(data_to_send);
      }
    });
  }

  else{
    var exists = false;
    var query = client.query('UPDATE challenges SET ' +
                                 'challenged_seconds = -1, cur_status = \'completed\' WHERE ' +
                               'challenge_id = $1 AND ' +
                               'challenged_id = $2 RETURNING challenge_id',
                               [request.query.challenge_id, request.user.user_id]);
    query.on('row', function(row){exists=true;});
    query.on('end', function(){
      if(exists){
        response.send(true);
      }else{
        response.statusCode = 400;
        response.send("Challenge not found or access denied");
      }
    });
  }
});

//Takes parameter 'challenge_id' and 'time_taken'
app.post('/completechallenge', check_params(['challenge_id', 'time_taken']), app.auth, function(request, response){
  if(request.query.time_taken < 1){
    response.statusCode = 400;
    response.send("Cannot complete a puzzle in less than a second");
    return;
  }
  var query = client.query('UPDATE challenges ' +
                        'SET cur_status = \'completed\',challenged_seconds = $1 ' +
                        'WHERE challenge_id = $2 AND cur_status=\'issued\' AND challenged_id=$3',
                        [request.query.time_taken, request.query.challenge_id, request.user.user_id]);
  query.on('end', function(result){
    if(result.rowCount===1){response.send(true);}
    else{response.send(false);}
  }); 
});

//Returns all challenges made to other users BY this user.
//{'display_name': Display Name,
// 'completed': true/false,
// 'timeTaken': 512 (seconds),
// 'difficulty': 1
//}
app.get('/challengessent', app.auth, function(request, response) {
  //First task is just returning all challenges.
  var data_to_send = [];
  var query = client.query('SELECT users.display_name,'+
                        'challenges.cur_status AS completed,'+
                        'challenges.challenged_seconds AS timetaken,'+
                        'challenges.difficulty '+
                        'FROM challenges INNER JOIN users ON (users.user_id = challenges.challenged_id) '+
                        'WHERE owner_id = $1', [request.user.user_id]);
  query.on('row', function(row){
    data_to_send.push(row);
  });
  query.on('end', function(){
    response.header('Content-Length', data_to_send.length);
    response.send(data_to_send);
  });
});

app.get('/testfortests', app.auth, function(request, response){
  response.send("hi");
});
  
} 
