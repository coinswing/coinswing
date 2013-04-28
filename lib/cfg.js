module.exports = {
    mongo: {
        url: process.env.MONGODB_URL || "mongodb://localhost"
    },
    coinbase: {
        key: process.env.COINBASE_API_KEY,
        url: process.env.COINBASE_CALLBACK_URL
    },
    port: 8080
};
