var mongoose = require("mongoose"),
    bcrypt = require("bcrypt"),
    crypto = require("crypto"),
    querystring = require("querystring"),
    email = require("../email"),
    cfg = require("../cfg");

// ### UserSchema
// A schema representing a user.
exports.UserSchema = new mongoose.Schema({
    email: String,
    token: {
        type: String,
        default: ""
    },
    password: String,
    salt: String,
    alerts: [{
        at: Date,
        message: String
    }],
    verification: {
        sent: Date,
        code: String,
        verified: {
            type: Boolean,
            default: false
        }
    }
});

// ### User
// A model representing a user.

// ### verify([code])
// Verify a user. If `code` is not provided, an email with the code and link
// will be sent to the user.

exports.UserSchema.methods.verify = function(a, b) {
    var code, cb, ref = this;

    if("function" === typeof a) cb = a;
    else if("function" === typeof b) {
        code = a;
        cb = b;
    }

    if(this.verification.verified) return cb(null, code ? true : null);
    if(this.verification.sent && Date.now() - this.verification.sent < 300000) return cb(new Error("Maximum of one verification email every five minutes"), null);
    if(!code) {
        var verifyUrl = "http://coinswing.com/verify?" + querystring.stringify({
            email: this.email,
            code: this.verification.code
        });

        email.send({
            text: "Welcome to Coinswing!\n\nYou need to verify your email before you can place any bets.\n\n" + this.verification.code + "\n\n" + verifyUrl,
            from: "Coinswing <" + cfg.email.user + ">",
            to: this.email,
            subject: "Verify your email address"
        }, function(err) {
            ref.verification.sent = Date.now();

            cb(err, null);
        });
    } else {
        if(this.verification.code == code) {
            this.verification.verified = true;
            this.save(function(err) {
                if(err) cb(err, null);
                else cb(null, true);
            });
        } else cb(null, false);
    }
};

// ### User.login(email, password, cb)
// Login and then call `cb` with `(err, user, token)`.
exports.UserSchema.statics.login = function(email, password, cb) {
    // Truncate passwords to 128 characters
    password = password.substr(0, 128);

    exports.User.findOne({ email: email }, function(err, user) {
        if(err || !user) return cb(err, null, null);

        bcrypt.hash(password, user.salt, function(err, hash) {
            if(err) cb(err, null, null);
            else if(hash !== user.password) cb(null, null, null);
            else {
                // Generate a new session token
                crypto.randomBytes(16, function(err, bytes) {
                    if(err) cb(err, null, null);
                    else {
                        user.token = bytes.toString("hex");
                        user.save(function(err) {
                            if(err) cb(err, null, null);
                            else cb(null, user, user.token);
                        });
                    }
                });
            }
        });
    });
};

// ### User.logout(id, cb)
// Logout user `id` and call `cb` with `(err, user)`.
exports.UserSchema.statics.logout = function(id, cb) {
    exports.User.findById(id, function(err, user) {
        if(err || !user) return cb(err);

        user.token = "";
        user.save(cb);
    });
};

// ### User.verify(id, token, cb)
// Verify a session with user `id` and session `token` and
// call `cb` with `(err, user)`.
exports.UserSchema.statics.verify = function(id, token, cb) {
    exports.User.findById(id, function(err, user) {
        if(err || !user) return cb(err, null);
        if(token === user.token) cb(null, user);
        else cb(null, null);
    });
};

// ### User.register(props, cb)
// Register a user and then call `cb` with `(err, user)`.
exports.UserSchema.statics.register = function(email, password, cb) {
    password = password.substr(0, 128); // Truncate to 128 characters

    exports.User.findOne({ email: email }, function(err, user) {
        if(err) return cb(err, null);
        if(user) return cb(null, null);

        bcrypt.genSalt(function(err, salt) {
            if(err) return cb(err, null);

            bcrypt.hash(password, salt, function(err, hash) {
                if(err) return cb(err, null);

                crypto.randomBytes(16, function(err, bytes) {
                    if(err) return cb(err, null);

                    // Validation will actually be performed by Mongoose and passed to
                    // the callback (which should handle errors and display them).
                    exports.User.create({
                        email: email,
                        password: hash,
                        salt: salt,
                        verification: {
                            code: bytes.toString("hex")
                        }
                    }, function(err, user) {
                        if(err) return cb(err, null);

                        // Generate a new session token
                        crypto.randomBytes(16, function(err, bytes) {
                            if(err) cb(err, null);
                            else {
                                user.token = bytes.toString("hex");
                                user.save(function(err) {
                                    if(err) cb(err, null);
                                    else user.verify(function(err) {
                                        // TODO: Handle emailing errors.
                                        cb(null, user);
                                    });
                                });
                            }
                        });
                    });
                });
            });
        });
    });
};

exports.User = mongoose.model("User", exports.UserSchema);
