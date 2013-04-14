# Coinswing

## Synopsis

Coinswing is a website for betting with bitcoins on trending YouTube videos. The betting process works as follows:

1. A new round starts and 12 trending youtube videos are chosen at random using YouTube's trending feeds.
2. Over the course of a day Coinswing users can bet a sum of bitcoins on exactly one of the entries (based on
   whether they think it will trend the most).
3. The single day of betting (the betting phase) then ends and the view count is recorded.
4. 3 days after the betting phase has ended (i.e each round lasts 4 days) the video that has
   the largest difference in views from the previously recorded initial view count (i.e. the video
   that has gained the most views since the end of the betting phase) is the winner.
5. All users who bet on the winning video are rewarded their fair share (based on the size of their wager)
   of the prize pool (the total amount of bitcoins that were bet on all 12 video entries). A 1% tax
   is taken from the prize pool for maitenance and development of the Coinswing website. This tax may
   cause bettors to actually lose money if the betting field is not fair enough. This profit opportunity
   may change to a premium or a donation based income in the future to prevent this.
6. Runner-ups are not rewarded any bitcoins regardless of their odds.

## Stack

Coinswing is a pretty straight-forward Node.js application, so it can be hosted
on pretty much any PaaS supporting Node.js, such as Heroku or Nodejitsu. It can
of course also been hosted on your own virtualized system. Coinswing uses a [Redis](http://redis.io)
database for storing all data. All bitcoin transactions and storage are securely handled
by the [Coinbase](http://coinbase.com) service. All sensitive data and configurable settings
are handled through environment variables (PaaS providers should provide you the option to set
environment variables through their interfaces).

### Environment Variables

* `REDIS_URL`: The URL where the Redis database is located
* `COINBASE_API_KEY`: The API key of the Coinbase account used to send bitcoins to bettors
* `COINBASE_CALLBACK_URL`: The URL to listen for Coinbase callbacks on (receiving bets from bettors) -
  must be a unique URL because for some reason Coinbase doesn't sign their HTTP requests (why?)

## Documentation

The source code is roughly documented. You can generate the resulting documentation pages using
`npm install & npm run-script docs`.
