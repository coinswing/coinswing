var EventEmitter = require("events").EventEmitter,
    nohm = require("nohm").Nohm;

nohm.setPrefix("coinswing");
nohm.model("round", {
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
    }
});

// # Manager
// The manager manages the database and the current round.
var Manager = function(client) {
    var ref = this;
    var createRound = function() {
        ref.createRound(function(err, round) {
            if(err) ref.emit("error", err);
            else {
                ref.currentRound = round;
                ref.emit("ready");
            }
        });
    };

    this.client = client;
    this.once("ready", function() {
        ref.tick();
    });
};


Manager.prototype = new EventEmitter;
Manager.prototype.tick = function() {
    if(!this.currentRound) throw "Trying to tick without a current round";
};
Manager.prototype.getRound = function(id, cb) {
    nohm.factory("round", id, cb);
};
Manager.prototype.getCurrentRound = function(cb) {
    var ref = this;

    ref.client.get("coinswing:round", function(err, id) {
        if(!err) {
            if(null !== id) ref.getRound(id, function(err, round) {
                if(!err) {
                    if(!round) createRound();
                    else {
                        ref.currentRound = round;
                        ref.emit("ready");
                    }
                }
                else ref.emit("error", err);
            });
            else createRound();
        }
        else ref.emit("error", err);
    });
};
Manager.prototype.setCurrentRound = function(round, cb) {
    var ref = this;

    ref.client.set("coinswing:round", round.id, function(err) {
        if(err) {
            ref.emit("error", err);
            if(cb) cb(err, null);
        } else {
            this.currentRound = round;

            if(cb) cb(null, round);
        }
    });
};
Manager.prototype.createRound = function(cb) {
    var round = nohm.factory("round"),
        ref = this;

    round.prop({

    });
    round.save(function(err) {
        if(err) {
            ref.emit("error", err);
            cb(err, null);
        } else cb(null, round);
    })
};

// # coinswing()
// Setup the backend manager and call `cb` with it when ready.
module.exports = function(client, cb) {
    var manager = new Manager(client);

    manager.once("ready", function() {
        manager.removeAllListeners("error");
        cb(null, manager);
    });
    manager.once("error", function(err) {
        cb(err);
    });
};

exports.Manager = Manager;
