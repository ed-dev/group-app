var check_params = require('./check_params');
var ConnectSdk = require('connectsdk');

module.exports = function(app, client){

  function apiCall(page,cb){
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
      sdk = new ConnectSdk("eynztbtbygspbr2wyyr9zh2b","DhF6QAJuPFbBDn6TgDD2aSxAh6eEswwGajU6tGT6mFxVm")
              .search()
              .images()
              .creative()
              .withExcludeNudity()
              .withPage(page)
              .withPageSize(100)
              .withPhrase('single object')
              .execute(cb);
    }
  }
  
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
  //Takes parameters 'difficulty'.
  //Returns {'data': [{'img':url,'word':word}]}
  app.get('/play', check_params(['difficulty']), function(req, res) {
    if(req.query.difficulty < 0 || req.query.difficulty > 2){
      res.statusCode = 400;
      res.send("Difficulty must be between 0 and 2");
      return;
    }
    
    var num_puzzles = 2 + parseInt(req.query.difficulty);
    var images_so_far = [];

    cb = function(err,apires){
      if(err) res.send(err);
  
      var images = randomChoices(apires.images, 10);
  
      var title_words = [];
      images.forEach(function(img){
        img.title = img.title.toLowerCase().split(" ");
        title_words = title_words.concat(img.title);
      })
  
      //Make a list of unique words over all titles
      title_words = title_words.filter(function(w,i,l){return w != '' && l.indexOf(w) === i;})
  
      var params = title_words.map(function(w,i){return '$'+(i+1);});
      var words = {};
  
      var query = client.query('SELECT word,difficulty FROM words WHERE word IN (' + params.join(',') + ')',title_words);
      query.on('row',function(w){words[w.word] = w;});
      query.on('end',function(){
  
        images.forEach(function(img){
          img.nouns = img.title.filter(function(w){
            return (w in words) && words[w].difficulty == req.query.difficulty;
          });
        });
  
        images = images_so_far.concat(
                    images.filter(function(img){return img.nouns.length > 0;})
                 );

        if(images.length < num_puzzles){
          if(i > 10){
            res.statusCode = 500;
            res.send("Failed to find images with tags of that difficulty.");
            return;
          }
          images_so_far = images;
          apiCall(++i,cb);
          console.log(i);
          return;
        }
  
        image_mapper = function(img){
          return {'img':img.display_sizes[0].uri, 'word':img.nouns[0]};
        }
        data_to_send = {'data': randomChoices(images,num_puzzles).map(image_mapper)};
  
        res.header('Content-Length',data_to_send.data.length);
        res.send(data_to_send);
  
      });
    };
    
    apiCall(i, cb);
  });
  
//Takes parameter 'score' where score equals the number to increase the users score by
//calculated based on difficulty, time taken etc.
//Returns the updated score
app.post('/updatescore', check_params(['score']), app.auth, function(req, res){
	var query = client.query('UPDATE users '+
                      'SET score = $1 '+
                      'WHERE user_id = $2', [req.query.score, req.user.user_id]);
    query.on('error', function(){
      res.statusCode = 500;
      res.send(false);
    });
	query.on('end', function() {
      res.send(true);
	});
});

app.get('/getscore', app.auth, function(req,res){
  var query = client.query('SELECT score FROM users WHERE user_id=$1', [req.user.user_id]);
  var score = 0;
  query.on('row',function(r){score = r.score;});
  query.on('end',function(){
    res.send({'score': score});
  });
});

}
