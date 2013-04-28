var mongoose = require("mongoose"),
    async = require("async"),
    request = require("request"),
    logger = require("../logger"),
    EntrySchema = require("./entry").EntrySchema;

// ### RoundSchema
// A schema representing a round, which consists of a number of video entries.
exports.RoundSchema = new mongoose.Schema({
    entries: [EntrySchema],
    state: {
        type: String,
        default: "betting"
    },
    started: {
        type: Date,
        default: Date.now
    }
});

// ### Round
// A model representing a round, which consists of a number of video entries.

// #### listen(cb)
// Sets up a timeout that will change the round's state when ready and call
// `cb` with `(err, state)` each state change. Does nothing for finished rounds.
exports.RoundSchema.methods.listen = function(cb) {
    var ref = this,
        next = function(state) {
            var views = function(video, cb) {
                request({
                    url: "http://gdata.youtube.com/feeds/api/videos/" + video + "?alt=json",
                    json: true
                }, function(err, code, data) {
                    if(err) cb(err, null);
                    else cb(null, data.entry.yt$statistics.viewCount);
                });
            };

            ref.state = state;

            async.map(ref.entries, function(entry, cb) {
                views(entry.video, function(err, views) {
                    if(err) return cb(err);
                    if("pending" === state) entry.views.initial = views;
                    else entry.views.final = views;

                    cb(null);
                });
            }, function(err) {
                if(err) return cb(err, null);

                ref.save(function(err) {
                    if(err) return cb(err, null);

                    logger.info("Round %s is now %s", ref.id, state);
                    cb(null, state);
                    check(state);
                });
            });
        };

    var check = function(state) {
        if("finished" === state) return;
        if("betting" === state) {
            var at = +ref.started + 86400000,
                ms = at - Date.now();

            if(ms > 0) {
                logger.debug("Round %s changes state to pending in %d days (at %d)", ref.id, ms / 86400000, at);
                setTimeout(function() { next("pending"); }, ms);
            }
            else next("pending");
        }
        if("pending" === state) {
            var at = +ref.started + 4 * 86400000,
                ms = at - Date.now();

            if(ms > 0) {
                logger.debug("Round %s changes state to finished in %d days (at %d)", ref.id, ms / 86400000, at);
                setTimeout(function() { next("finished"); }, ms);
            }
            else next("finished");
        }
    };

    check(this.state);
};

exports.Round = mongoose.model("Round", exports.RoundSchema);
