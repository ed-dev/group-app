module.exports = function(app, client){

  //Takes parameters 'user_id', 'difficulty', 'time', {'data': [{'img':img, 'word':word}]}
  //Possible expansion: images completed, time taken for each, etc etc.
  //Returns 'true' or 'false'
  app.post('/challenge', app.postauth, function(request, res) {
    var game = [];
  
    try{
      console.log(request.body.game);
      game = JSON.parse(request.body.game);
      console.log(game);
      for(puz in game){
        for(key in game[puz]){
          if(typeof game[puz][key] != 'string') throw "err";
        }
      }
    }catch(err){
      res.statusCode = 400;
      res.send("Could not parse game");
      return;
    }

    gameDict = {};
    for(puz in game){gameDict[game[puz].word] = game[puz];}
    console.log(gameDict);
   
    var wordParams = game.map(function(d,i){return '$'+(i+1);});
    wordQuery = client.query('SELECT word,word_id FROM words WHERE word IN (' + wordParams.join(',') + ')',
                             game.map(function(d){return d.word;}));
    wordQuery.on('row', function(d){
      gameDict[d.word].word_id = d.word_id;
      console.log("setting " + d.word + " to " + d.word_id);
      console.log(gameDict);
    });
  
    wordQuery.on('end', function(){
      console.log(game);
      for(puz in game){
        if(game[puz].word_id == undefined){
          res.statusCode = 400;
          res.send("I don't know those words - can only challenge with generated game");
          return;
        }
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
//{'display_ame': Display Name,
// 'completed': true/false,
// 'timeTaken': 512 (seconds),
// 'difficulty': 1,
// 'challenge_id': 92837
//}
app.get('/challengesreceived', function(request, response) {
  //First task is just returning all challenges.
  var data_to_send = [];
  var query = client.query('SELECT challenges.challenge_id,' +
                        'challenges.owner_seconds AS timeTaken,' +
                        'challenges.cur_status AS completed,' +
                        'users.display_name,' +
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

//Take parameter 'challenge_id'
//returns {'data': [{img:img, word:word}]}
app.post('/acceptchallenge', function(request, response){
  var data_to_send = [];
  var query = client.query('SELECT images.url AS img,' +
                       'words.word AS word ' +
                       'FROM challenges '+
                       'INNER JOIN challenge_image_word ON (challenges.challenge_id = challenge_image_word.challenge_id) '+
                       'INNER JOIN words ON (words.word_id = challenge_image_word.word_id) '+
                       'INNER JOIN images ON (challenge_image_word.image_id = images.image_id) '+
                       'WHERE challenges.challenge_id = $1', [request.challenge_id]);
  query.on('row', function(row) {
    data_to_send.push(row);
  });
  query.on('end', function() {
    response.header('Content-Length', data_to_send.length);
    response.send(data_to_send);
  });
});

//Takes parameter 'challenge_id' and 'timeTaken'
app.post('/completechallenge', function(request, repsonse){
  var query = client.query('UPDATE challenges ' +
                        'SET cur_status = $1 ' +
                        'WHERE challenge_id = $2', ['completed', request.challnge_id]);
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
app.get('/challengessent', function(request, response) {
  //First task is just returning all challenges.
  var data_to_send = [];
  var query = client.query('SELECT users.display_name,'+
                        'challenges.cur_status AS completed,'+
                        'challenges.challenged_seconds AS timeTaken,'+
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
  
} 
