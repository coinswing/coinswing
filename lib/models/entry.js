var mongoose = require("mongoose"),
    BetSchema = require("./bet").BetSchema;

// ### EntrySchema
// A schema representing an entry in a round.
exports.EntrySchema = new mongoose.Schema({
    bets: [BetSchema],
    title: String,
    video: String,
    views: {
        initial: {
            type: Number,
            default: 0
        },
        final: {
            type: Number,
            default: 0
        }
    }
});

// ### Entry
// A model representing an entry in a round.
exports.Entry = mongoose.model("Entry", exports.EntrySchema);
