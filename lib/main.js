var EventEmitter = require("events").EventEmitter,
    nohm = require("nohm").Nohm,
    util = require("./util");

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

    this.client = client;
    this.once("ready", function() {
        ref.tick();
    });
    this.getCurrentRound(function(err, round) {
        if(err) ref.emit("error", err);
        else ref.emit("ready");
    });
};


Manager.prototype = new EventEmitter;
Manager.prototype.tick = function() {
    if(!this.currentRound) throw "Trying to tick without a current round";
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

    util.generateVideos(12, function(err, entries) {
        if(err) {
            ref.emit("error", err);
            cb(err, null);
        } else {
            var round = new Round();

            round.prop({
                entries: entries,
                started: Date.now(),
                state: "betting"
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

    nohm.setClient(client);
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
