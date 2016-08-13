# osu! Replay downloader
***Download osu!replay files!***

Make sure to have at least nodejs *v5.10.0* installed!

Before first use make sure to `npm install` and `npm install -g iced-coffee-script`

Usage: `iced fetch.iced -k <api-key> -m <mode> -u <user-id> -b <beatmap-id> [-o <output-file>]`

When no output-file is given, stdout will be used.

Get an api-key here: https://osu.ppy.sh/p/api

*please note that due to how 'commander' works there has to be a space between the option and the option-argument, eg. `-m 0` and NOT `-m0`, dont ask me why*
