var pg = require('pg').native,connectionString = process.env.DATABASE_URL,client,query;


client = new pg.Client(connectionString);
client.connect();

	query = client.query('CREATE TYPE status AS ENUM(\'issued\',\'completed\')');
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query( 'CREATE TYPE part AS ENUM(\'n\',\'v\',\'pn\',\'adj\',\'adv\',\'c\',\'pr\',\'i\')'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query( 'CREATE TABLE users ( user_id serial PRIMARY KEY, username varchar (30) NOT NULL, password bytea NOT NULL,first_name varchar(20), last_name(30), age smallint NOT NULL, difficulty smallint NOT NULL)'  );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query(  'CREATE TABLE friends (user_id integer references users(user_id), friend_id integer references users(user_id),PRIMARY KEY(user_id,friend_id)'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query(	'CREATE TABLE parents(user_id integer references users(user_id) NOT NULL, parent_gmail varchar(30) NOT NULL)'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query( 'CREATE TABLE words (word_id serial PRIMARY KEY, word varchar(30) NOT NULL, word_part part, difficulty smallint NOT NULL)'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query('CREATE TABLE images (image_id serial PRIMARY KEY, url varchar NOT NULL)'    );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query( 'CREATE TABLE challenges (challenge_id serial PRIMARY KEY, owner_id integer references users(user_id), challenged_id integer references users(user_id),owner_seconds real NOT NULL,challenged_seconds real,cur_status status NOT NULL)'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query('CREATE TABLE challenge_image_word (challenge_id integer references challenges, image_id integer references images, word_id integer references words, PRIMARY KEY(challenge_id,image_id,word_id) )'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();

client = new pg.Client(connectionString);
client.connect();

	query = client.query('CREATE TABLE image_word (word_id integer references words,image_id integer references images,PRIMARY KEY(word_id,image_id))'   );
	query.on('end',function(err,result){ if (err){ console.error('Error executing Database Query: %s',queryString[i]); } else{ ('Completed Database Query: %s',queryString[i]);}  });	
client.end();
