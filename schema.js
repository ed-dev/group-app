var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL,
                     client,
                     query;


client = new pg.Client(connectionString);
client.connect();
query = client.query( 'CREATE TABLE words (word_id serial PRIMARY KEY, word varchar(30) NOT NULL, word_part part, difficulty smallint NOT NULL)'   );
query.on('end',function(result){ client.end();}  );	
