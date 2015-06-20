module.exports = function(params){
  return function(req,res,next){
    copyAcross = false;

    if(req.method=='GET'){
      paramHolder = req.query;
    }else{
      if(req.body.hasOwnProperty(params[0])){
        paramHolder = req.body;
        copyAcross = true;
      }else{
        paramHolder = req.query;
      }
    }
    for(i in params){
      if(!(paramHolder.hasOwnProperty(params[i]))){
        res.statusCode=400;
        res.send("Missing parameter: " + params[i]);
        return;
      }
      else if(copyAcross){
        req.query[params[i]] = req.body[params[i]];
      }
    }
    next();
  }
}
