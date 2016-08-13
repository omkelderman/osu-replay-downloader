#!/usr/bin/env iced

commander = require 'commander'

commander
    .version('0.0.1')
    .option('-k, --api-key <k>', 'osu api key')
    .option('-m, --mode <m>', 'the mode the score was played in')
    .option('-b, --beatmap-id <b>', 'the beatmap ID (not beatmap set ID!) in which the replay was played')
    .option('-u, --user-id <u>', 'the user that has played the beatmap')
    .option('-o, --output-file <file>', 'the osr-file to save (if not specified it uses stdout)')
    .parse(process.argv)

util = require 'util'
request = require 'request'
uleb128 = require 'uleb128'
fs = require 'fs'
crypto = require 'crypto'

if not commander.mode or not commander.beatmapId or not commander.userId
    console.error 'missing params :('
    process.exit 1
    return

# lets build some urls we can query
urlFormat1 = "https://osu.ppy.sh/api/%s?k=#{commander.apiKey}&u=#{commander.userId}&m=#{commander.mode}&b=#{commander.beatmapId}"
urlFormat2 = "https://osu.ppy.sh/api/%s?k=#{commander.apiKey}&m=#{commander.mode}&b=#{commander.beatmapId}"

getReplayUrl = util.format urlFormat1, 'get_replay'
getScoresUrl = util.format urlFormat1, 'get_scores'
getBeatmapUrl = util.format urlFormat2, 'get_beatmaps'

doApiCall = (url, cb) ->
    request.get {url: url, json: true}, (err, r, json) ->
        return cb err if err
        return new Error 'no 200 statuscode' if r.statusCode isnt 200
        cb null, json

# fetch the data
await
    doApiCall getReplayUrl, defer errReplay, replay
    doApiCall getScoresUrl, defer errScore, score
    doApiCall getBeatmapUrl, defer errBeatmap, beatmap

if errReplay or errScore or errBeatmap
    console.error 'could not fetch replay:', errReplay if errReplay
    console.error 'could not fetch score-data:', errScore if errScore
    console.error 'could not fetch beatmap-data', errBeatmap if errBeatmap
    return process.exit 1

# and spit out some errors if shit went wrong
if replay.error
    console.error 'error in replay data:', replay.error
    return process.exit

if replay.encoding isnt 'base64'
    console.error 'unknown replay-encoding'
    return process.exit 1
if score.length < 1
    console.error 'no score found :('
    return process.exit 1

if beatmap.length < 1
    console.error 'beatmap not found :('
    return process.exit 1

# yay we have our data
score = score[0]
beatmap = beatmap[0]
replay = Buffer.from replay.content, 'base64'

# lets define some functions which we will use to write our file
writeString = (out, string) ->
    strBytes = Buffer.from string, 'utf8'
    strHeader = uleb128.encode strBytes.length
    strHeader.unshift 0x0B
    out.write Buffer.from strHeader
    out.write strBytes

writeByte = (out, byte) ->
    buf = Buffer.alloc 1
    buf.writeUInt8 byte
    out.write buf

writeShort = (out, s) ->
    buf = Buffer.alloc 2
    buf.writeUInt16LE s
    out.write buf

writeInteger = (out, i) ->
    buf = Buffer.alloc 4
    buf.writeUInt32LE i
    out.write buf

# WARNING: LOTS OF WERID SHIT THAT LOOKS SUPER DERPY, BUT TRUST ME: IT WORKS!
# no really, im not kidding, this works! not sure if wanna explain tho xd
WEIRD_CONSTANT = 429.4967296 # (2^32)/(10^7)
writeDate = (out, dateStr) ->
    # superugly string manipulation to get the date in the correct timezone
    date = new Date(dateStr.replace(' ', 'T')+'+08:00')
    # get the amount of *seconds* since the start of windows ticks
    something = ((date.getTime()/1000)+62135596800)

    # magic:
    tmp = something / WEIRD_CONSTANT
    high = Math.floor tmp
    low = (tmp-high)*WEIRD_CONSTANT*10000000

    buf = Buffer.alloc 8
    # TODO write high and low to the buf in the right order
    # i always fuckup that order :(
    buf.writeUInt32LE low, 0
    buf.writeUInt32LE high, 4

    out.write buf

# lets actually write that file
if commander.outputFile
    outStream = fs.createWriteStream commander.outputFile
else
    outStream = process.stdout

# write all the things: https://osu.ppy.sh/wiki/Osr_(file_format)
writeByte outStream, parseInt commander.mode
writeInteger outStream, 20151228
writeString outStream, beatmap.file_md5
writeString outStream, score.username
replayHashData = score.maxcombo + "osu" + score.username + beatmap.file_md5 + score.score + score.rank
writeString outStream, crypto.createHash('md5').update(replayHashData).digest("hex")
writeShort outStream, score.count300
writeShort outStream, score.count100
writeShort outStream, score.count50
writeShort outStream, score.countgeki
writeShort outStream, score.countkatu
writeShort outStream, score.countmiss
writeInteger outStream, score.score
writeShort outStream, score.maxcombo
writeByte outStream, score.perfect
writeInteger outStream, score.enabled_mods
writeString outStream, ""
writeDate outStream, score.date
writeInteger outStream, replay.length
outStream.write replay

# finally need to write the replay-id as a 64bit number
# yes, this wasnt in that wiki page, but it is needed (thanks osu!lazer :P)
# lets cheat and asume it doesnt go above uint32max
# if it ever does, no idea what will happen, probably World War III or something
replayIdBuf = Buffer.alloc 8
replayIdBuf.writeUInt32LE score.score_id, 0
replayIdBuf.writeUInt32LE 0, 4 # this is the cheating part ^^
outStream.write replayIdBuf
