module.exports = {
    email: {
        user: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASSWORD,
        host: process.env.EMAIL_HOST,
        ssl: !!process.env.EMAIL_SSL
    },
    mongo: {
        url: process.env.MONGODB_URL || "mongodb://localhost/coinswing"
    },
    coinbase: {
        key: process.env.COINBASE_API_KEY,
        url: process.env.COINBASE_CALLBACK_URL
    },
    secret: process.env.SECRET,
    port: 8080
};

// Local configuration (hidden from git)
try {
    var local = require("../cfg.json");

    for(var key in local) {
        module.exports[key] = local[key];
    }
} catch(err) { }
