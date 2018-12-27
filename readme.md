# osu! Replay downloader
***Download osu!replay files!***

Make sure to have at least nodejs *v7.6.0* installed! (or whatever the version is where async/await works properly)

Before first use make sure to `npm install`.

Usage: `node fetch.js -k <api-key> -m <mode> -u <user-id> -b <beatmap-id> [--mods <bitmask>] [-o <output-file>]`

When no output-file is given, stdout will be used.

Get an api-key here: https://osu.ppy.sh/p/api

*please note that due to how 'commander' works there has to be a space between the option and the option-argument, eg. `-m 0` and NOT `-m0`, dont ask me why*
