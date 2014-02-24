var WebSocketServer = require('ws').Server;
var http = require('http');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var nconf = require('nconf');
var fs = require('fs')
var ejs = require('ejs');
var path = __dirname + '/templates/table.ejs';
var str = fs.readFileSync(path, 'utf8');

nconf.argv()
    .env()
    .file({ file: __dirname + '/config/config.json' });

var app = express();

var server = http.createServer(app);

server.listen(nconf.get('port'));

var webSocketServer = new WebSocketServer({server: server});
webSocketServer.on('connection', function(ws) {

    var startDate = new Date();

    var timer = setInterval(function() {
        MongoClient.connect('mongodb://'+ nconf.get('dbuser') +':'+ nconf.get('dbpass') +'@'+ nconf.get('dbhost') +':'+ nconf.get('dbport') +'/'+ nconf.get('dbbase'), function(err, db) {
            if(err)  {
                console.error(err);
                return;
            }

            var dateOffset = 8000;
            var checkDate = new Date();
            checkDate.setTime(checkDate.getTime() - dateOffset);
            var checktime = parseInt(checkDate.getTime() / 1000 );
            var urlParts = ws.upgradeReq.url.split('/');
            var gameID = +urlParts[2];
            var gamerID = +urlParts[3];

            var collection = db.collection('board');
            collection.findOne({board: gameID, state: {'$ne': 6},  'updated': {'$gt': checktime}}, function(err, document) {
//                console.log(checktime, document);
                if (document) {
                    var gamer = db.collection('gamer');

                    console.log(checktime, document.state);

                    gamer.find({'board': gameID}).toArray(function(err, results) {
                        var data = {};
                        var gamerdoc = null;

//                        console.log(checktime, results);

                        for (i in results) {
                            if (results[i].user == gamerID) {
                                gamerdoc = results[i];
                            } else {
                                if (document.state < 4){
                                    results[i].cards = results[i].cards.length > 0 ? [1,1,1,1] : [];
                                }
                            }
                        }

                        if (document.state < 3) {
                            document.flop = [1,1,1];
                        }

                        data['board'] = document;
                        data['gamers'] = results;
                        data['gamer'] = gamerdoc;
                        data['table'] = ejs.render(str, {
                            gamer: gamerdoc,
                            game: document
                        });
                        ws.send(JSON.stringify(data), function(error) {

                        });
                        db.close();
                    });
                } else {
                    db.close();
                }
            });
        });
    }, 2000);

    console.log('Client connected');

    ws.on('close', function() {
        console.log('Client disconnected');
        clearInterval(timer);
    });
})

