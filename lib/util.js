var request = require("request");

exports.generateVideos = function(n, cb) {
    request({
        url: "https://gdata.youtube.com/feeds/api/standardfeeds/on_the_web?alt=json",
        json: true
    }, function(err, code, data) {
        if(err) cb(err, null);
        else {
            var trending = data.feed.entry;

            if(trending.length < n) {
                cb(new Error("No. trending videos < requested no. videos"), null);
            } else {
                var entries = [];

                for(var i = 0; i < n; i++) {
                    while(true) {
                        var video = trending[Math.floor(Math.random() * trending.length)],
                            idParts = video.id.$t.split("/"),
                            id = idParts[idParts.length - 1];

                        if(entries.indexOf(id) == -1) {
                            entries.push(id);

                            break;
                        }
                    }
                }

                cb(null, entries);
            }
        }
    });
};
