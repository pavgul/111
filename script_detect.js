var express = require('express');
var app = express();
var request_promise = require('request-promise');
var request = require('request');

var func = {
    apiKeys: ['STEAM_API_KEY'],
    found: [],
    time: function() {
        var date = new Date();
        return `[${date.toISOString().substr(0,10)} | ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}]`;
    },
    miliSeconds: function() {
        return Math.floor(Date.now());
    },
    msg: function(msg) {
        console.log(`${this.time()} Message: "${msg}"`);
    },
    init: function() {
        var self = this;
        self.loadBots();
        setInterval(function() {
            self.loadBots();
        }, 1000 * 30);
    },
    loadBots: function() {
        var self = this;
        let steamIDs = [];
        request.get({
            url: 'https://old.cs.money/load_bots',
            json: true
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                for (var i = 0; i < body.length; i++) {
                    if (!steamIDs.includes(body[i].steamid)) {
                        steamIDs.push(body[i].steamid);
                    }
                }
                request.get({
                    url: 'https://cs.money/2.0/load_bots',
                    json: true
                }, function(err, response, body) {
                    if (!err && response.statusCode == 200) {
                        for (var i = 0; i < body.length; i++) {
                            if (!steamIDs.includes(body[i].steamid)) {
                                steamIDs.push(body[i].steamid);
                            }
                        }
                        self.checkBots(steamIDs);
                    } else {
                        self.msg(`[NEW] - ${err || response.statusCode}`);
                    }
                });
            } else {
                self.msg(`[OLD] - ${err || response.statusCode}`);
            }
        });
    },
    checkBots: function(steamIDs) {
        var self = this;
        self.msg(`Checking: ${steamIDs.length}`)
        self.getBanned(steamIDs, function(result) {
            self.msg(`Checked: ${Object.keys(result).length}`);
            for (var i in result) {
                if (result[i].CommunityBanned) {
                    if (!self.found.includes(i)) {
                        self.found.push(i);
                        self.msg(`Found: ${i}`);
                    }
                }
            }
        });
    },
	getProfiles: function(steamIDs, callback) {
        var self = this;
        if (typeof(steamIDs) == 'string') {
            steamIDs = JSON.parse(steamIDs);
        }
        var requestIDs = [];
        for (var i = 0; i < steamIDs.length; i++) {
            if (!requestIDs[0]) {
                requestIDs[0] = [];
            }
            if (requestIDs[requestIDs.length - 1].length == 100) {
                requestIDs.push([]);
            }
            requestIDs[requestIDs.length - 1].push(steamIDs[i]);
        }
        var requestPromises = [];
        for (var i = 0; i < requestIDs.length; i++) {
            requestPromises.push(request_promise({
                uri: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/' + '?key=' + self.getApiKey() + '&steamids=' + requestIDs[i].join(',') + ')}',
                json: true
            }).catch(() => {
                func.msg('Failed to retrieve steam profile list');
                return callback({});
            }));
        }

        Promise.all(requestPromises).then(responses => {
            var profilesList = {};
            for (var response of responses) {
                if (!response.response || !response.response.players) {
                    continue;
                }

                for (var player of response.response.players) {
                    profilesList[player.steamid] = player;
                }
            }
            return callback(profilesList);
        });
    },
    getBanned: function(steamIDs, callback) {
        var self = this;
        if (typeof(steamIDs) == 'string') {
            steamIDs = JSON.parse(steamIDs);
        }
        var requestIDs = [];
        for (var i = 0; i < steamIDs.length; i++) {
            if (!requestIDs[0]) {
                requestIDs[0] = [];
            }
            if (requestIDs[requestIDs.length - 1].length == 100) {
                requestIDs.push([]);
            }
            requestIDs[requestIDs.length - 1].push(steamIDs[i]);
        }
        var requestPromises = [];
        for (var i = 0; i < requestIDs.length; i++) {
            requestPromises.push(request_promise({
                uri: 'http://api.steampowered.com/ISteamUser/GetPlayerBans/v1/' + '?key=' + self.getApiKey() + '&steamids=' + requestIDs[i].join(',') + ')}',
                json: true
            }).catch(() => {
                func.msg('Failed to retrieve steam profile list');
                return callback({});
            }));
        }

        Promise.all(requestPromises).then(responses => {
            var profilesList = {};
            for (var response of responses) {
                if (!response.players) {
                    continue;
                }

                for (var player of response.players) {
                    profilesList[player.SteamId] = player;
                }
            }
            return callback(profilesList);
        });
    },
    getApiKey: function() {
        return this.apiKeys[Math.floor(Math.random() * this.apiKeys.length)];
    }
}

app.set('view engine', 'pug');
app.listen(1230, function() {
    func.msg(`Server port: 1230`);
});

app.get('/found', function(req, res) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.status(200).json({
        "success": true,
        "result": func.found
    });
});
app.get('/profile', function(req, res) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET');
    func.getProfiles(req.query.steamIDs, function(result) {
        res.status(200).json({
            "success": true,
            "result": result
        });
    });
});
app.use(function(req, res) {
    res.status(200).json({
        "success": false
    });
});
app.use(function(error, req, res, next) {
    if (!error) {
        return next();
    }
    res.sendStatus(400);
});

func.init();
