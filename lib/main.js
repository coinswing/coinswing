var EventEmitter = require("events").EventEmitter,
    nohm = require("nohm").Nohm,
    generateVideos = require("./util").generateVideos,
    util = require("util"),
    logger = require("./logger");

// (pool / no. winners) * odds * (bettor's bet / total of all winning bettor's bets)

nohm.setPrefix("coinswing");

var Round = nohm.model("round", {
    properties: {
        entries: {
            type: "json",
            validatons: [function(value, options, callback) {
                callback(value.length == 12);
            }]
        },
        bets: {
            type: "json",
            validatons: [function(value, options, callback) {
                var key, i = 0, sane = true;

                for(key in value) {
                    var inner;

                    for(inner in value[key]) {
                        sane &= "number" === typeof value[key][inner];
                    }

                    i++;
                }

                callback(i == 12 && sane);
            }]
        },
        odds: {
            type: "json",
            validatons: [function(value, options, callback) {
                var key, i = 0, sane = true;

                for(key in value) {
                    sane &= "number" === typeof value[key];
                    i++;
                }

                callback(i == 12 && sane);
            }]
        },
        started: {
            type: "timestamp"
        },
        state: {
            type: "string",
            defaultValue: "betting"
        }
    },
    idGenerator: "increment"
});

// # Manager
// The manager manages the database and the current round.
var Manager = function(client) {
    var ref = this;

    client.once("ready", function() {
        nohm.setClient(client);
    });

    this.client = client;
    this.once("ready", function() {
        ref.tick();
    });
    this.getCurrentRound(function(err, round) {
        if(err) ref.emit("error", err);
        else ref.emit("ready");
    });
};

util.inherits(Manager, EventEmitter);

Manager.prototype.tick = function() {
    var round = this.currentRound,
        ref = this;

    if(!round) throw "Trying to tick without a current round";

    var days = (Date.now() - round.prop("started")) / 86400000,
        state = round.prop("state");

    logger.info("The current round's state is: %s", state);

    var pool = 0, numBets = 0,
        key, odds = round.prop("odds"), bets = round.prop("bets");

    for(key in odds) {
        pool += odds[key];
        numBets += bets[key].length;
    }

    logger.info("Prize pool of %dbtc with a total of %d bets", pool, numBets);

    var retick = function(round) {
        var state = round.prop("state"),
            time = (round.prop("started") + (state == "betting" ? 1 : 4) * 86400000) - Date.now();

        if(time < 0 || "finished" === state) {
            // FIXME: Just in case.. should be handled better.
            throw "Unreachable code";
        }

        var next = "betting" === state ? "idle" : ("idle" === state ? "finished" : "?"); 

        logger.info("The current round will enter its next phase (%s -> %s) in %d days", state, next, time / 86400000);
        setTimeout(function() { ref.tick(); }, time);
    };

    logger.info("%d days since the current round started", days);

    if("betting" === state && days >= 1) {
        round.prop("state", (state = "idle"));
        round.save(function(err) {
            // FIXME: Handle this
            if(err) throw err;
        });
        logger.info("The betting phase for the current round is now over, <insert betting stats>");
    }
    if("idle" === state && days >= 4) {
        logger.info("The current round is now over, sending prizes..");
        // Send prizes and print stats
        logger.info("A new round is now being generated");

        this.createRound(function(err, round) {
            // FIXME: Think about how to handle this error case properly (re-try to create later?)
            if(err) throw err;
            else {
                logger.info("A new round has been generated, setting it as the current round..");
                ref.setCurrentRound(round, function(err) {
                    if(err) throw err;

                    logger.info("Successfully generated a new round and set it as the current round");
                    ref.tick();
                });
            }
        });

        return;
    }

    retick(ref.currentRound);
};
Manager.prototype.bet = function(user, amount, entry, cb) {
    if(!ref.currentRound) return cb(new Error("Trying to bet without a current round"));
    if(amount < 0) return cb(new Error("Invalid bet amount"));

    var round = this.currentRound,
        entries = round.prop("entries"),
        odds = round.prop("odds"),
        bets = round.prop("bets");

    if(entries.indexOf(entry) == -1) return cb(new Error("That entry is not in this round"));

    var key;

    for(key in bets) {
        if("number" === typeof bets[key][user]) return cb(new Error("That user has already bet"));
    }

    bets[entry][user] = amount;
    odds[entry] += amount;

    round.prop({
        bets: bets,
        odds: odds
    });
    round.save(cb);

};
Manager.prototype.getRound = function(id, cb) {
    Round.load(id, function(err) {
        if(err) {
            ref.emit("error", err);
            cb(err, null);
        } else cb(null, this);
    });
};
Manager.prototype.getCurrentRound = function(cb) {
    var ref = this;

    this.client.get("coinswing:round", function(err, id) {
        if(err) {
            ref.emit("error", err);
            cb(err, null);
        }
        else {
            if(!id) {
                ref.createRound(function(err, round) {
                    if(err) {
                        ref.emit("error", err);
                        cb(err, null);
                    } else {
                        ref.setCurrentRound(round, function(err) {
                            if(err) {
                                ref.emit("error", err);
                                cb(err, null);
                            } else {
                                cb(null, round);
                            }
                        });
                    }
                });
            } else {
                ref.getRound(id, function(err, round) {
                    if(err) {
                        ref.emit("error", err);
                        cb(err, null);
                    } else {
                        ref.currentRound = round;

                        cb(null, round);
                    }
                });
            }
        }
    });
};
Manager.prototype.setCurrentRound = function(round, cb) {
    var ref = this;

    ref.client.set("coinswing:round", round.id, function(err) {
        if(err) {
            ref.emit("error", err);

            if(cb) cb(err);
        } else {
            ref.currentRound = round;

            if(cb) cb(null);
        }
    });
};
Manager.prototype.createRound = function(cb) {
    var ref = this;

    generateVideos(12, function(err, entries) {
        if(err) {
            ref.emit("error", err);
            cb(err, null);
        } else {
            var round = new Round(),
                bets = {}, odds = {}, i;

            for(i = 0; i < entries.length; i++) {
                bets[entries[i]] = [];
                odds[entries[i]] = 0;
            }

            round.prop({
                bets: bets,
                odds: odds,
                entries: entries,
                started: Date.now()
            });
            round.save(function(err) {
                if(err) {
                    ref.emit("error", err);
                    cb(err, null);
                } else cb(null, round);
            });
        }
    });
};

// # coinswing()
// Setup the backend manager and call `cb` with it when ready.
module.exports = function(client, cb) {
    var manager = new Manager(client),
        called = false;

    logger.info("Setting up Coinswing");
    manager.once("ready", function() {
        manager.removeAllListeners("error");
        cb(null, manager);
    });
    manager.on("error", function(err) {
        // If we don't bind to this event, it will throw errors.
        // So we bind, but only call the callback on the first error
        // (i.e. if there was an error setting up).
        if(!called) {
            cb(err, null);

            called = true;
        }
    });
};

exports.Manager = Manager;
