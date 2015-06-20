module.exports = function(app, client){
 
  //We need two authentication functions, one for POST and one for GET
  //The authentication functions will check that the token exists
  //and if it does, save the user associated with the token to the
  //request object.

  //POST - Expects the token to be in the body of the request.
  app.postauth = function(req,res,next){
    return auth(req.body,req,res,next);
  }
  
  //GET - Expects the token to be in the query of the request.
  app.getauth = function(req,res,next){
    return auth(req.query,req,res,next);
  }
  
  //The auth helper function called by the other two.  Checks the token exists and saves the user if so.
  function auth(params,req,res,next){
    var token = req.body.token;
    if(token == undefined){token = req.query.token;}
    if(token == undefined){
      res.statusCode = 400;
      res.send('Error 400: Token not provided');
      return false;
    }
  
    user = null;
    query = client.query('SELECT user_id,display_name,token,difficulty FROM users WHERE token=$1', [token]);
    query.on('row', function(d){user=d;});
    query.on('end', function(){
      if(user==null){
        res.statusCode = 401;
        res.send("Token " + token + " does not exist");
      }else{
        req.user = user;
        next()
      }
    });
  }

  //Use passport with google oauth strategy for initial authentication.
  //We don't use sessions to persist auth, we just save the token at the end
  //of the session and users must include the token with each request.
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
  
  //Endpoint for checking that a token is valid.  Simply return the user's
  //id and display name.
  app.get('/account', app.getauth, function(request,response){
    if(!request.isAuthenticated()){
      response.redirect('/login');
      return;
    } 
    
    response.send("ID: " + request.user.user_id + "\nName: " + request.user.display_name);
  }); 
  
  //Login link to auth/google
  app.get('/login', function(req, res){
    res.header('content-type', 'text/html');
    res.send("<a href=\"/auth/google\">Login with Google</a>");
  });
  
  //Auth endpoint to redirect the user to google with our client id and callback url.
  app.get('/auth/google',passport.authenticate('google', {scope: ['email']}));
  
  //Google does a GET request to this endpoint with the code.  The passport.authenticate function
  //takes the google and sends it back to google, getting an access token and a user profile in return.
  //We save the user's ID, display name, and new access token to the database.
  //The user must use that token when attempting to access any endpoint.
  app.get('/authredir',
    passport.authenticate('google', {failureRedirect: '/login', session:false}),
    function(req,res){
      //There are three possibilities we need to account for here.
      //1. The user does not exist yet.
      //2. The user exists but doesn't have a current token.
      //3. The user exists and already has a token.

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
