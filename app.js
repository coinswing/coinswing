var coinswing = require("./"),
    express = require("express"),
    MongoStore = require("connect-mongo")(express),
    validator = require("validator");
    app = express();

coinswing(function(err, manager) {
    if(err) throw err;

    app.configure(function() {
        app.set("views", __dirname + "/views");
        app.set("view engine", "jade");
        app.enable("view cache");
        app.enable("trust proxy");

        app.use(express.static(__dirname + "/public"));
        app.use(express.cookieParser(coinswing.cfg.secret));
        app.use(express.session({
            secret: coinswing.cfg.secret,
            store: new MongoStore({
                url: coinswing.cfg.mongo.url
            })
        }));
        app.use(express.bodyParser());
        app.use(function(req, res, next) {
            var id = req.session.user || req.signedCookies.user,
                token = req.session.token || req.signedCookies.token;

            if(!req.session.alerts) req.session.alerts = [];

            res.locals.csrf = req.session._csrf;
            res.locals.user = req.user = null;
            res.locals.alerts = req.session.alerts;
            res.locals.unalert = function() {
                res.locals.alerts = req.session.alerts = [];
            };

            if(id && token) {
                coinswing.User.verify(id, token, function(err, user) {
                    res.locals.user = req.user = user;

                    next(err);
                });
            } else next();
        });
        app.use(app.router);
        app.use(express.csrf());
        app.use(express.errorHandler({
            dumpExceptions: true,
            showStack: true
        }));
    });

    app.get("/", function(res, res, next) {
        res.render("index", {
            active: "home",
            round: manager.betting[0]
        });
    });

    app.get("/getting-started", function(req, res, next) {
        res.render("getting-started", {
            active: "getting-started",
            resent: !!req.query.resent
        });
    });

    app.post("/getting-started", function(req, res, next) {
        var invalids = [];

        if(!req.body.email) invalids.push("Email must not be blank.");
        if(req.body.email) {
            try {
                validator.check(req.body.email).isEmail();
            } catch(err) {
                invalids.push("Email must be valid.");
            }
        }
        if(!req.body.password || req.body.password.length < 6) invalids.push("Password must be at least 6 characters.");

        if(invalids.length) return res.render("getting-started", {
            active: "getting-started",
            invalids: invalids
        });

        coinswing.User.register(req.body.email, req.body.password, function(err, user) {
            if(err) next(err);
            else if(user) {
                req.session.user = user.id;
                req.session.token = user.token;

                res.redirect("/getting-started");
            }
            else res.render("getting-started", {
                active: "getting-started",
                invalids: ["That email is already in use."]
            });
        });
    });

    app.get("/verify", function(req, res, next) {
        if(req.user && "undefined" !== typeof req.query.resend) return req.user.verify(function(err) {
            if(err) next(err);
            else res.redirect("/getting-started?resent=1");
        });
        if(!req.query.email || !req.query.code) return res.redirect("/getting-started");

        coiswing.User.find({ email: req.query.email }, function(err, user) {
            if(err) return next(err);
            if(user) {
                user.verify(req.query.code, function(err, success) {
                    if(err) return next(err);
                    if(success) {
                        req.session.alerts.push({
                            type: "success",
                            tag: "Yay!",
                            message: "You have successfully validated your email. Enjoy betting!"
                        });
                        res.redirect("/");
                    }
                    else res.redirect("/getting-started");
                });
            }
            else res.redirect("/getting-started");
        });
    });

    app.post("/verify", function(req, res, next) {
        if(!req.user || !req.body.code) return res.redirect("/getting-started");

        req.user.verify(req.body.code, function(err, success) {
            if(err) return next(err);
            if(success) {
                req.session.alerts.push({
                    type: "success",
                    tag: "Yay!",
                    message: "You have successfully validated your email. Enjoy betting!"
                });
                res.redirect("/");
            }
            else res.render("getting-started", {
                active: "getting-started",
                verified: false
            });
        });
    });

    app.get("/login", function(req, res, next) {
        res.render("login", {
            active: "login"
        });
    });

    app.post("/login", function(req, res, next) {
        coinswing.User.login(req.body.email, req.body.password, function(err, user, token) {
            if(err) return next(err);
            if(!user) return res.render("login", {
                active: "login",
                invalids: ["Invalid email or password."]
            });

            req.session.user = user.id;
            req.session.token = token;

            if(req.body.remember) {
                res.cookie("user", user.id, { signed: true, maxAge: 2592000000 });
                res.cookie("token", token, { signed: true, maxAge: 2592000000 });
            }

            res.redirect("/");
        });
    });

    app.get("/logout", function(req, res, next) {
        req.session.user = null;
        req.session.token = null;

        res.clearCookie("user");
        res.clearCookie("token");
        res.redirect("/");
    });

    manager.listen(app);
});
