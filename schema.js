var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL,
                     client,
                     query;


client = new pg.Client(connectionString);
client.connect();

	query = client.query('CREATE TABLE users ( user_id SERIAL PRIMARY KEY, username varchar(30) NOT NULL, password bytea NOT NULL,first_name varchar(20), last_name varchar(30), age smallint NOT NULL, difficulty smallint NOT NULL)'  );
query.on('end',function(result){ client.end();}  );	
