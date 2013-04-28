var mongoose = require("mongoose"),
    bcrypt = require("bcrypt"),
    util = require("util"),
    validator = require("validator"),
    crypto = require("crypto");

// ### UserSchema
// A schema representing a user.
exports.UserSchema = new mongoose.Schema({
    email: String,
    name: {
        first: {
            type: String,
            default: ""
        },
        last: {
            type: String,
            default: ""
        }
    },
    token: {
        type: String,
        default: ""
    },
    password: String,
    salt: String
});

exports.UserSchema.virtual("name.full").get(function() {
    return this.name.first + " " + this.name.last;
});

exports.UserSchema.path("email").validate(function(email) {
    return validator.check(email).isEmail();
}, "Invalid email");

exports.UserSchema.path("name.first").validate(function(first) {
    return first.length > 0 && first < 15;
}, "First name must be longer than 1 character and smaller than 15");

exports.UserSchema.path("name.last").validate(function(first) {
    return last.length > 0 && last < 15;
}, "Last name must be longer than 1 character and smaller than 15");

// ### User
// A model representing a user.

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
                            else cb(null, user, token);
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
exports.UserSchema.statics.register = function(props, cb) {
    var email = props.email,
        name = props.name,
        password = props.password.substr(0, 128); // Truncate to 128 characters

    bcrypt.genSalt(16, function(err, salt) {
        if(err) return cb(err, null);

        bcrypt.hash(password, salt, function(err, hash) {
            if(err) return cb(err, null);

            // Validation will actually be performed by Mongoose and passed to
            // the callback (which should handle errors and display them).
            exports.User.create({
                email: email,
                name: name,
                password: hash,
                salt: salt
            }, cb);
        });
    });
};

exports.User = mongoose.model("User", exports.UserSchema);
