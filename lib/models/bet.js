var mongoose = require("mongoose"),
    ObjectId = mongoose.Schema.Types.ObjectId;

// ### BetSchema
// A schema representing a bet on an entry.
exports.BetSchema = new mongoose.Schema({
    btc: Number,
    user: [{ type: ObjectId, ref: "User" }]
});

// ### Bet
// A model representing a bet on an entry.
exports.Bet = mongoose.model("Bet", exports.BetSchema);
