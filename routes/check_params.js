module.exports = function(params){
  return function(req,res,next){
    for(i in params){
      if(!req.body.hasOwnProperty(params[i])){
        res.statusCode=400;
        res.send("Missing parameter: " + params[i]);
        return;
      }
    }
    next();
  }
}
