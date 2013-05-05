var cfg = require("./cfg");

module.exports = require("emailjs").server.connect(cfg.email);
