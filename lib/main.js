var mongoose = require("mongoose"),
    async = require("async"),
    request = require("request"),
    url = require("url"),
    path = require("path"),
    events = require("events"),
    util = require("util"),
    cfg = require("./cfg"),
    logger = require("./logger");

var Round = require("./models/round").Round,
    Entry = require("./models/entry").Entry,
    Bet = require("./models/bet").Bet,
    users = require("./models/user"),
    User = users.User,
    UserError = users.UserError;

// ### Manager
// The manager controls the backend of Coinbase. There should only be
// one manager instance in the entire application.
var Manager = function() {
    var ref = this;

    mongoose.connect(cfg.mongo.url, function(err) {
        if(err) ref.emit("error", err);
        else {
            logger.info("Successfully connected to MongoDB");
            Round.find().where("state").ne("finished").exec(function(err, rounds) {
                ref.betting = rounds.filter(function(round) {
                    return "betting" === round.state;
                });

                var listen = function(round) {
                    round.listen(function(err, state) {
                        if(err) throw err;
                        if(ref.betting.indexOf(round) != -1) {
                            ref.betting.splice(ref.betting.indexOf(round), 1);

                            if(!ref.betting.length) {
                                logger.info("Creating a new round due to no existing betting rounds");

                                ref.generateRound(12, function(err, round) {
                                    if(err) throw err;

                                    logger.info("Created round %s successfully", round.id);
                                    ref.betting.push(round);
                                    listen(round);
                                });
                            }
                        }
                        if("finished" !== state) return;

                        // Figure out the winning entry.
                        logger.info("Figuring out the winning entry");
                    });
                };

                logger.debug("%d active rounds", rounds.length);
                rounds.forEach(function(round) {
                    listen(round);
                });

                if(!ref.betting.length) {
                    logger.info("Creating a new round due to no existing betting rounds");

                    ref.generateRound(12, function(err, round) {
                        if(err) throw err;

                        logger.info("Created round %s successfully", round.id);
                        ref.betting.push(round);
                        listen(round);
                    });
                }

                ref.emit("ready");
            });
        }
    });
};

util.inherits(Manager, events.EventEmitter);

// #### generateRound(n, cb)
// Generates a round with `n` random trending entries, saves it into the
// database and calls `cb` with `(err, round)`.
Manager.prototype.generateRound = function(n, cb) {
    var ref = this;

    request({
        url: "https://gdata.youtube.com/feeds/api/standardfeeds/on_the_web?alt=json",
        json: true
    }, function(err, code, data) {
        if(err) return cb(err, null);

        var videos = [],
            entries = [];

        async.filter(data.feed.entry, function(data, cb) {
            var uri = url.parse(data.id.$t, true);

            uri.query.alt = "json";

            request({
                url: url.format(uri),
                json: true
            }, function(err, code, data) {
                if(err) cb(false);
                else cb("Private video" !== data);
            });
        }, function(feed) {
            if(feed.length < n) return cb(new Error("Feed is too small"), null);

            var store = {};

            for(var i = 0; i < n; i++) {
                while(true) {
                    var data = feed[Math.floor(Math.random() * feed.length)],
                        video = path.basename(url.parse(data.id.$t).pathname);

                    store[video] = { title: data.title.$t };

                    if(videos.indexOf(video) == -1) {
                        logger.debug("Picked %s as an entry for the new round", video);
                        videos.push(video);

                        break;
                    }
                }
            }

            videos.forEach(function(video) {
                var data = store[video];

                entries.push(new Entry({
                    video: video,
                    title: data.title
                }));
            });

            var round = new Round({
                entries: entries
            });

            round.save(function(err) {
                if(err) cb(err, null);
                else cb(null, round);
            });
        });
    });
};

// #### listen()
// Setup `app` to listen on the configured port.
Manager.prototype.listen = function(app) {
    logger.info("Coinswing is now listening on port %d", cfg.port);
    app.listen(cfg.port);
};

module.exports = function(cb) {
    var manager = new Manager();

    manager.once("ready", function(err) {
        manager.removeAllListeners("error");
        cb(null, manager);
    });
    manager.once("error", function(err) {
        manager.removeAllListeners("ready");
        cb(err, null);
    });
};

module.exports.Round = Round;
module.exports.Entry = Entry;
module.exports.Bet = Bet;
module.exports.User = User;
module.exports.UserError = UserError;

module.exports.cfg = cfg;
