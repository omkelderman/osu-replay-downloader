#!/usr/bin/env node

const commander = require('commander');


commander
    .version('0.1.0')
    .option('-k, --api-key <k>', 'osu api key')
    .option('-m, --mode <m>', 'the mode the score was played in (default: 0)')
    .option('-b, --beatmap-id <b>', 'the beatmap ID (not beatmap set ID!) in which the replay was played')
    .option('-u, --user-id <u>', 'the user that has played the beatmap')
    .option('--mods <mods-bitmask>', 'bitmask of the used mods. If not specified, a random score will be picked (I think the one with highest pp), so it does NOT default to nomod!')
    .option('-o, --output-file <file>', 'the osr-file to save (if not specified it uses stdout)')
    .parse(process.argv);

const request = require('request');
const uleb128 = require('uleb128');
const fs = require('fs');
const crypto = require('crypto');

const gameMode = commander.mode ? parseInt(commander.mode) : 0;

if(!commander.beatmapId || !commander.userId || isNaN(gameMode)) {
    console.error('Missing or invalid parameters');
    process.exitCode = 1;
    return;
}

// lets build some urls we can query
function urlFormat1(endpoint) {
    let url = `https://osu.ppy.sh/api/${endpoint}?k=${commander.apiKey}&u=${commander.userId}&m=${gameMode}&b=${commander.beatmapId}`;
    if(commander.mods !== undefined) {
        url += '&mods=' + commander.mods;
    }
    return url;
} 
function urlFormat2(endpoint) {
    return `https://osu.ppy.sh/api/${endpoint}?k=${commander.apiKey}&m=${gameMode}&b=${commander.beatmapId}`;
}

function doApiCall(url) {
    return new Promise((resolve, reject) => {
        request.get({url: url, json: true}, (err, r, json) => {
            if(err) return reject(err);
            if(r.statusCode != 200) return reject(new Error('no 200 statuscode'));

            resolve(json);
        });
    });
}

function getBeatmaps() {
    return doApiCall(urlFormat2('get_beatmaps'));
}

function getScores() {
    return doApiCall(urlFormat1('get_scores'));
}

function getReplay() {
    return doApiCall(urlFormat1('get_replay'));
}

class WritestreamWrapper {
    constructor(stream) {
        this.stream = stream;
    }

    write(data) {
        this.stream.write(data);
    }

    writeString(string) {
        let strBytes = Buffer.from(string, 'utf8');
        let strHeader = uleb128.encode(strBytes.length);
        strHeader.unshift(0x0B);

        this.stream.write(Buffer.from(strHeader));
        this.stream.write(strBytes);
    }

    writeByte(byte) {
        let buf = Buffer.allocUnsafe(1);
        buf.writeUInt8(byte);

        this.stream.write(buf);
    }

    writeShort(short) {
        let buf = Buffer.allocUnsafe(2);
        buf.writeUInt16LE(short);

        this.stream.write(buf);
    }

    writeInteger(int) {
        let buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(int);

        this.stream.write(buf);
    }

    writeLong(low, high) {
        let buf = Buffer.allocUnsafe(8);
        buf.writeUInt32LE(low, 0);
        buf.writeUInt32LE(high, 4);

        this.stream.write(buf);
    }

    // WARNING: LOTS OF WERID SHIT THAT LOOKS SUPER DERPY, BUT TRUST ME: IT WORKS!
    // no really, im not kidding, this works! not sure if wanna explain tho xd
    // the tldr is that im writing a js date to a dotnet framework DateTime.Ticks value
    // which is a large number and js doesnt handle large numbers
    // so weird calculations to keep numbers below js max number and calculating a low and high part
    writeDotNetDateTicks(date) {
        const WEIRD_CONSTANT = 429.4967296 // (2^32)/(10^7)
        // get the amount of *seconds* since the start of windows ticks
        let something = ((date.getTime()/1000)+62135596800);

        // magic
        let tmp = something / WEIRD_CONSTANT;
        let high = Math.floor(tmp);
        let low = (tmp-high) * WEIRD_CONSTANT * 10000000;

        this.writeLong(low, high);
    }

    end() {
        this.stream.end();
    }
}

async function run() {
    const pScores = getScores();
    const pBeatmaps = getBeatmaps();

    const [scores, beatmaps] = await Promise.all([pScores, pBeatmaps]);

    if(scores.length < 1) {
        throw new Error('score not found');
    }

    if(beatmaps.length < 1) {
        throw new Error('beatmap not found');
    }

    const score = scores[0];
    const beatmap = beatmaps[0];

    if(parseInt(score.replay_available) != 1) {
        throw new Error('replay data not available.');
    }

    const replay = await getReplay();

    if(replay.error) {
        throw new Error('error in replay data: ' + replay.error);
    }

    if(replay.encoding != 'base64') {
        throw new Error('unknown replay-encoding: ' + replay.encoding);
    }

    // yay we have data
    const replayData = Buffer.from(replay.content, 'base64');

    // create output stream
    const stream = commander.outputFile ? fs.createWriteStream(commander.outputFile) : process.stdout;
    const out = new WritestreamWrapper(stream);

    // write all the things: https://osu.ppy.sh/help/wiki/osu%21_File_Formats%2FOsr_%28file_format%29
    out.writeByte(gameMode);
    out.writeInteger(20151228); // game-version. Just a static number like this is fine.
    out.writeString(beatmap.file_md5);
    out.writeString(score.username);
    let replayHashData = `${score.maxcombo}osu${score.username}${beatmap.file_md5}${score.score}${score.rank}`;
    out.writeString(crypto.createHash('md5').update(replayHashData).digest('hex'));
    out.writeShort(+score.count300);
    out.writeShort(+score.count100);
    out.writeShort(+score.count50);
    out.writeShort(+score.countgeki);
    out.writeShort(+score.countkatu);
    out.writeShort(+score.countmiss);
    out.writeInteger(+score.score);
    out.writeShort(+score.maxcombo);
    out.writeByte(+score.perfect);
    out.writeInteger(+score.enabled_mods);
    out.writeString(''); // graph data, does not have to be available, its not stored on osu servers anyway
    let replayDate = new Date(score.date.replace(' ', 'T') + 'Z');
    out.writeDotNetDateTicks(replayDate);
    out.writeInteger(replayData.length);
    out.write(replayData);

    // finally need to write the replay-id as a 64bit number
    // yes, this wasnt in that wiki page, but it is needed (thanks osu!lazer :P)
    // lets cheat and asume it doesnt go above uint32max
    // if it ever does, no idea what will happen, probably World War III or something
    out.writeLong(+score.score_id, 0);

    // close the stream
    out.end();
}

run().catch(err => {
    console.error(err);
    process.exitCode = 1;
});