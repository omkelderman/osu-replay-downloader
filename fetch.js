#!/usr/bin/env node

const commander = require('commander');
const downloader = require('./downloader');
const WritestreamWrapper = require('./WritestreamWrapper');

commander
    .version('0.1.0')
    .option('-k, --api-key <k>', 'osu api key')
    .option('-m, --mode <m>', 'the mode the score was played in (default: 0)')
    .option('-b, --beatmap-id <b>', 'the beatmap ID (not beatmap set ID!) in which the replay was played')
    .option('-h, --beatmap-hash <md5-hash>', 'the beatmap MD5-hash of the beatmap. When provided it saves an api call. If not provided it fetches it from the api.')
    .option('-u, --user-id <u>', 'the user that has played the beatmap')
    .option('--mods <mods-bitmask>', 'bitmask of the used mods. If not specified, a random score will be picked (I think the one with highest pp), so it does NOT default to nomod!')
    .option('-o, --output-file <file>', 'the osr-file to save (if not specified it uses stdout)')
    .parse(process.argv);

const fs = require('fs');

const gameMode = commander.mode ? parseInt(commander.mode) : 0;

if(!commander.beatmapId || !commander.userId || isNaN(gameMode)) {
    console.error('Missing or invalid parameters');
    process.exitCode = 1;
    return;
}

async function run() {
    const data = await downloader.download(commander.apiKey, commander.userId, commander.beatmapId, commander.beatmapHash, gameMode, commander.mods);

    // create output stream
    let out;
    if(commander.outputFile) {
        out = new WritestreamWrapper(fs.createWriteStream(commander.outputFile), true);
    } else {
        out = new WritestreamWrapper(process.stdout, false);
    }

    // write the data
    out.writeOsrData(data);

    // close the stream
    out.end();
}

run().catch(err => {
    console.error(err);
    process.exitCode = 1;
});