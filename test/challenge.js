//First, we need to go through all the files with all the endpoints
//we want to test and add the last route of each app.get/post/delete call
//to a map, for easy access.

//We'll store the routes in here
all_routes = {};

//Create a mock app object with 'get', 'post' and 'delete' replaced with
//a function that adds the final route of the endpoint to our all_routes map.
function add_endpoint(url, route1, route2, route3, route4){
  routes = [route1,route2,route3,route4].filter(function(d){return d != undefined;});
  all_routes[url] = routes[routes.length-1];
}

var app = {
    'get': add_endpoint,
    'post': add_endpoint,
    'delete': add_endpoint,
    'use': function(){} //Ignore 'use' calls
}

var pg = require('pg').native,
         client = new pg.Client("postgres://hasletaaro@localhost/testdb");
client.connect(); 

//Run our mock app through each file.
require('../routes/challenge')(app, client);
require('../routes/auth')(app, client);
require('../routes/friends')(app, client);
require('../routes/play')(app, client);

//Now all_routes has every route we want to test in it.  Let's write some tests.
var expect = require('expect');

//We'll define each test with the following values:
// endpoint name : description : Description what we expect the test to do.
//                 predata : Adds each {table_name: {row}} set to the test db before the test.
//                 req : The request object to be passed into the route.
//                 expectVal : The response expected to be passed into response.send when the
//                             route is run on the given req and predata.
//                 postdata : Check that each {table_name: {row}} set is in the database post-test.
//
//Each test must at least define a description and an expectVal.
tests = {'/testfortests': {'description': 'returns hi', 'expectVal': 'hi'},
         '/challengessent': {'description': 'returns challenges sent',
                             'predata': {'challenges': {'owner_id': 123,
                                                        'challenged_id': 124,
                                                        'owner_seconds': 1,
                                                        'challenged_seconds': 2,
                                                        'cur_status': 'completed',
                                                        'difficulty': 1}},
                             'expectVal': [{'display_name': 'test2',
                                            'completed': 'completed',
                                            'timetaken': 2,
                                            'difficulty': 1}]
                            },
        '/completechallenge': {'description': 'updates challenge table',
                               'req': {'query': {'challenge_id': 5}},
                               'predata': {'challenges': {'challenge_id': 5,
                                                          'owner_id': 123,
                                                          'challenged_id': 124,
                                                          'owner_seconds': 1,
                                                          'difficulty': 1,
                                                          'cur_status': 'issued'}},
                               'expectVal': true,
                               'postdata': {'challenges': {'challenge_id': 5,
                                                           'cur_status': 'completed'}}
                            },
        '/challengesreceived': {'description': 'returns all challenges received',
                             'predata': {'challenges': {'challenge_id': 9,
                                                        'owner_id': 124,
                                                        'challenged_id': 123,
                                                        'owner_seconds': 10,
                                                        'cur_status': 'issued',
                                                        'difficulty': 1}},
                             'expectVal': [{'challenge_id': 9,
                                            'display_name': 'test2',
                                            'completed': 'issued',
                                            'timetaken': 10,
                                            'difficulty': 1}]
                            }
        };


//Now we'll set up the testdb and run our tests.
tablesExceptUsers = ['challenge_image_word',
                     'challenges',
                     'friends',
                     'image_word',
                     'images',
                     'parents',
                     'words']

//Two test users.
var query_count = 0;
describe('endpoints', function(){
  //Before running the tests, wipe users and add two test users.
  before(function(done){
    var q = client.query("DELETE FROM users WHERE 1=1;" +
                     "INSERT INTO users (user_id,display_name,difficulty,token) VALUES (123,'test1',1,50)," +
                                                                                      "(124,'test2',1,51)");
    q.on('end',function(){done()});
  });

  //For each endpoint we need to test:
  Object.keys(tests).forEach(function(ep){

    //We'll describe two tests for the endpoint
    describe(ep, function(){
      var t = tests[ep];

      //First, enter the 'predata', run the endpoint route, and
      //check that the right repsonse (the one in 'expectVal') was returned.
      it(t.description, function(done){

        //Wipe all tables except for users.
        after(function(done){
          tablesExceptUsers.forEach(function(d){
            query_count = 1;
            var q = client.query('DELETE FROM ' + d + ' WHERE 1=1');
            q.on('end', function(){
              if((query_count++) == tablesExceptUsers.length){
                done();
              }
            });
          }); 
        });

        //Add each row defined in predata to the testdb, then run the route and test the repsonse.
        if(t.predata != undefined){
          run_on_tables(t.predata,insert_query,function(){
            run_test(ep);
            done();
          });
        }
        else{
          //If there is no predata, just run the route and check the response.
          run_test(ep);
          done();
        }
      });

      //If postdata is defined, we run a select query for each row and check that
      //one row was returned.
      if(t.postdata != undefined){
        it(t.description + ' post db check', function(done){
          run_on_tables(t.postdata,select_query,done,true);
        });
      }
    });
  });
});

//run_on_tables takes one of two queries.  Either insert_query or select_query.
function insert_query(table_name,columns,val_params,vals){
  return client.query('INSERT INTO ' + table_name + '(' + columns.join(',') + ')' +
                                            ' VALUES (' + val_params + ')',
                                                          vals);
}

function select_query(table_name,columns,val_params,vals){
  var where_clause = columns.map(function(c,i){return c + '=$' + (i+1);});
  return client.query('SELECT ' + columns.join(',') + ' FROM ' + table_name + 
                                            ' WHERE ' + where_clause.join(' AND '), vals);
}

//This function runs the given endpoint route with mocked request and response objects,
//then tests the results against the 'expectVal' property defined in the test.
function run_test(ep){
  var t = tests[ep];

  //If the test doesn't define a req object, give it an empty one.
  if (t.req == undefined){
    t.req = {};
  }
  //So we can add a user to it.
  t.req.user = {'user_id':123, 'display_name':'test1', 'token': 50};

  all_routes[ep](t.req, {header: function(){}, send: function(data){
    expect(data).toEqual(t.expectVal);
  }});
}

//This function takes a set of rows to be added in the form of
//{'table_name': {'col1':val1,'col2':val2},
// 'table2_name': {'col1':val1,'col2':val2}}
//It calculates the parameter and value arrays that will be needed
//for a pg query, then passes everything through query_maker,
//then calls done() when all the queries are finished.
//If check_one is true, it checks that each query returns a single row.
function run_on_tables(table_data, query_maker, done, check_one){
  var query_count = 0;
  var all_tables = Object.keys(table_data);

  //For each table name
  all_tables.forEach(function(table_name){

    //Make a list of columns, one of value parameters eg ['$1','$2', etc] and one of actual values.
    var columns = Object.keys(table_data[table_name]);
    var vals = columns.map(function(c){return table_data[table_name][c];});

    var val_params = vals.map(function(d,i){return '$' + (i+1);}).join(',');

    //Pass through query maker to get the query.
    var q = query_maker(table_name,columns,val_params,vals);

    //On the end of the query, check if this is the last row to be processed.
    //If so, we're done.  Also, if check_one is true, check that a single row
    //was returned.
    q.on('end', function(result){
      if(check_one){
        expect(result.rowCount).toEqual(1);
      }
      if((++query_count) == all_tables.length){
        done();
      }
    });
  });
}
