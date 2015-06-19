module.exports = function(app, client){
 
  app.postauth = function(req,res,next){
    return auth(req.body,req,res,next);
  }
  
  app.getauth = function(req,res,next){
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

  var passport = require('passport');
  var googleStrat = require('passport-google-oauth').OAuth2Strategy;
  
  app.use(passport.initialize());
  
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
  
  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });
  
  app.get('/account', app.getauth, function(request,response){
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
                                                          '($1,     $2,          $3,        $4) RETURNING token',
                                              [req.user.id, req.user.displayName, 1, req.user.access_token]);
        }
        else{
          insertOrUpdate = client.query('UPDATE users SET token=$1 WHERE user_id=$2 RETURNING token',
                                         [req.user.access_token,req.user.id]);
        }
  
        insertOrUpdate.on('end', function(){
          res.send({'access_token': req.user.access_token, 'name': req.user.displayName});
        });
      });
    }
  );
 };
