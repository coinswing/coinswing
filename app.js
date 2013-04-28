var coinswing = require("./"),
    express = require("express"),
    app = express(),
    util = require("util");

coinswing(function(err, manager) {
    if(err) throw err;

    app.configure(function() {
        app.set("views", __dirname + "/views");
        app.set("view engine", "jade");
        app.enable("view cache");
        app.enable("trust proxy");

        app.use(express.methodOverride());
        app.use(express.bodyParser());
        app.use(express.static(__dirname + "/public"));
        app.use(app.router);
        app.use(express.errorHandler({
            dumpExceptions: true,
            showStack: true
        }));
        app.use(function(req, res, next) {
            res.end("404");
        });
    });

    app.get("/rounds", function(req, res, next) {
        coinswing.Round.find({}, function(err, rounds) {
            if(err) next(err);
            else res.end(util.inspect(rounds));
        });
    })

    app.get("/round/:id", function(req, res, next) {
        var id = req.params.id;

        if(id.length < 24 || !/[0-9a-f]+/i.test(id)) return next();

        coinswing.Round.findById(id, function(err, round) {
            if(err) next(err);
            else res.end(util.inspect(round));
        });
    });

    manager.listen(app);
});
