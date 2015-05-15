var express = require('express');
var cors = require('cors');
var app = express();
var ConnectSdk = require('connectsdk');

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

/* ---------- routes ----------------------------*/

app.get('/', function(request, response) {
  apiCall(function(err,res){
    if(err) response.send(err);
    else{ 
      response.header('Content-Length',res.length);
      response.send(res);
    }
  });
});

app.get('/display', function(request, response) {
  apiCall(function(err,res){
    if(err) response.send(err);

    images = res.images;
    image_mapper = function(img){
      return {'img':img.display_sizes[0].uri, 'word':img.title.split(" ")[0]};
    }
      var numImgs = 3;
    data_to_send = {'data': randomChoices(images, numImgs).map(image_mapper)};
    
    //--test saving images and words to database
    
    var query;
    console.log('num images = %d',data_to_send.length);
    for(var i=0;i< numImgs;i++){
	query = client.query({
	    text: 'INSERT INTO images(url) VALUES($1)',
	    values :[data_to_send.data[i].img]
	});
        query.on('row',function(result){console.log(result);})
	
        query = client.query({
	    text: 'INSERT INTO words(word) VALUES($1)',
	    values :[data_to_send.data[i].word]
	});

        query.on('row',function(result){console.log('oid of the result =%d',result.oid);})

      }//end for loop
      console.log('Database inserts completed');
     //--end test saving images to database
   
     response.header('Content-Length',data_to_send.length);
    response.send(data_to_send);
  });
});

/* ----------------end routes -------------------*/

var server = app.listen(app.get('port'), function() {
var host = server.address().address;
var port = server.address().port;

 console.log('Node app is running at :http://%s:%s',host,port);
});
