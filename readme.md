# osu! Replay downloader
***Download osu!replay files!***

Make sure to have at least nodejs *v7.6.0* installed! (or whatever the version is where async/await works properly)

Before first use make sure to `npm install`.

Usage: `node fetch.js -k <api-key> -u <user-id> -b <beatmap-id> [-h <beatmap-hash>] [-m <mode>] [--mods <bitmask>] [-o <output-file>]`

Notes:
* Optionally provide the beatmap-hash, so the script doesnt have to fetch it from the API. Saves an API-call if you already have the data.
* When no mode is given, it defaults to std.
* When no mods is given, it defaults to the first score it finds on the server, which I think is the score with the highest PP.
* When no output-file is given, stdout will be used.

Get an api-key here: https://osu.ppy.sh/p/api

*please note that due to how 'commander' works there has to be a space between the option and the option-argument, eg. `-m 0` and NOT `-m0`, dont ask me why*

## Run as HTTP Server

Run `node server.js`. Following environment variables are used for configuration:
* `API_KEY` your osu! api key. Mandatory, program will exit if not provided.
* `LISTEN` port to listen on, or a path to a unix socket. Defaults to 3000.
* `LISTEN_HOST` what interface to listen on, defaults to localhost
* `DOWNLOAD_PATH` what the url must be to the download action, defaults to `/download`

This means that with default config the path to the download action is `http://localhost:3000/download`. Anything else will trigger a 404.

Arguments are given via the querystring. Same arugments apply as with the commandline option.
* `userId`
* `beatmapId`
* `beatmapHash`, optional, if provided saves one api call.
* `mode`, optional, defaults to std
* `mods`, optional, with the same caveat as above 

Example: `http://localhost:3000/download?userId=718454&beatmapId=1201636&mode=0&mods=0`