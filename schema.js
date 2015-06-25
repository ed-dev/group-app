var pg = require('pg').native,
                     connectionString = process.env.DATABASE_URL,
                     client,
                     query;

client = new pg.Client(connectionString);
client.connect();

client.query(
    'DROP TABLE IF EXISTS words cascade;' +
    'DROP TABLE IF EXISTS users cascade;' +
    'DROP TABLE IF EXISTS friends cascade;' +
    'DROP TABLE IF EXISTS parents cascade;' +
    'DROP TABLE IF EXISTS words cascade;' +
    'DROP TABLE IF EXISTS images cascade;' +
    'DROP TABLE IF EXISTS challenges cascade;' +
    'DROP TABLE IF EXISTS challenge_image_word cascade;' +
    'DROP TABLE IF EXISTS image_word cascade;' +
    'CREATE TABLE users ( user_id NUMERIC PRIMARY KEY, display_name varchar(30), difficulty smallint NOT NULL, token varchar(100), score BIGINT DEFAULT 0);' +
//    'CREATE TYPE status AS ENUM(\'issued\',\'completed\');' +
//    'CREATE TYPE part AS ENUM(\'n\',\'v\',\'pn\',\'adj\',\'adv\',\'c\',\'pr\',\'i\');' +
    'CREATE TABLE friends (user_id integer references users(user_id), friend_id integer references users(user_id),PRIMARY KEY(user_id,friend_id));' +
    'CREATE TABLE words (word_id serial PRIMARY KEY, word varchar(40) NOT NULL, frequency integer, difficulty smallint DEFAULT 1);'  +
    'CREATE TABLE images (image_id serial PRIMARY KEY, url varchar NOT NULL);' +
    'CREATE TABLE challenges (challenge_id serial PRIMARY KEY, owner_id numeric references users(user_id), challenged_id numeric references users(user_id),owner_seconds real NOT NULL,challenged_seconds real,cur_status status NOT NULL,difficulty smallint NOT NULL);' +
    'CREATE TABLE challenge_image_word (challenge_id integer references challenges, image_id integer references images, word_id integer references words, PRIMARY KEY(challenge_id,image_id,word_id) );'
);

client.on('end',function(){client.end();console.log("Entered")});
