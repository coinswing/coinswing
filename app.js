var coinswing = require("./"),
    redis = require("redis-url").createClient(),
    express = require("express"),
    app = express();

coinswing(redis, function(err, coinswing) {
    app.configure(function() {
        app.set("views", __dirname + "/views");
        app.set("view engine", "jade");
        app.enable("view cache");
        app.enable("trust proxy");

        app.use(express.methodOverride());
        app.use(express.bodyParser());
        app.use(express.static(__dirname + "/public"));
        app.use(app.router);
        app.use(function(req, res, next) {
            //404
        });
        app.use(express.errorHandler({
            dumpExceptions: true,
            showStack: true
        }));
    });

    app.get("/", function(req, res) {
        res.render("round", {
            entries: coinswing.currentRound.p("entries")
        });
    });

    app.listen(8080);
});
