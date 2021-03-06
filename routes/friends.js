var check_params = require('./check_params');

module.exports = function(app, client){ 

//Takes no parameters
//Returns a list of the users friends' display names, scores and user_ids
//{'data': [display_Name:display_name, score:score, user_id:user_id]}
app.get('/friends', app.auth, function(req,res){
	var data_to_send = [];
	//var query = client.query('SELECT users.display_name,'+
    //                    'users.score,'+
    //                    'friends.friend_id AS user_id '+
    //                    'FROM friends INNER JOIN users ON (users.user_id = friends.friend_id) '+
    var query = client.query('SELECT users.display_name,'+
                        'users.score,'+
                        'users.user_id '+
                        'FROM users ' +
	                    'WHERE users.user_id != $1', [req.user.user_id]);
	query.on('row', function(row) {
		data_to_send.push(row);
	});
	query.on('end', function() {
		res.header('Content-Length', data_to_send.length);
		res.send(data_to_send);
	});
});

//Takes parameter 'user_id' of the friend being added
//Returns true if successful, false otherwise
app.post('/addFriend', check_params(['user_id']), app.auth, function(req, res){
	var query = client.query('INSERT INTO friends (user_id, friend_id) '+
                        'VALUES ($1, $2)', [req.user.user_id, req.user_id]);
	query.on('end', function(result){
		if(result.rowCount===1){res.send(true);}
		else{res.send(false);}
	});
});

//Takes parameter 'user_id' of the friend being removed
//Returns true if successful, false otherwise
app.delete('/removeFriend', check_params(['user_id']), app.auth, function(req, res){
	var query = client.query('DELETE FROM friends WHERE user_id = $1 and friend_id = $2', [req.user.user_id, req.user_id]);
	query.on('end', function(result){
		if(result.rowCount===1){res.send(true);}
		else{res.send(false);}
	});
});

}
