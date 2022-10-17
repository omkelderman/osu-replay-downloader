#!/usr/bin/env node

const { program, InvalidArgumentError } = require('commander');

/**
 * 
 * @param {string} value value entered
 * @returns {number}
 */
function optionIsIntGreaterThanZero(value) {
    const num = parseInt(value);
    if (isNaN(num)) {
        throw new InvalidArgumentError('Not a number');
    }
    if (num <= 0) {
        throw new InvalidArgumentError('Must be higher than 0');
    }
    return num;
}

/**
 * 
 * @param {string} value value entered
 * @returns {0|1|2|3}
 */
function optionIsGameMode(value) {
    const num = parseInt(value);
    if (isNaN(num)) {
        throw new InvalidArgumentError('Not a number');
    }
    if (num < 0 || num > 3) {
        throw new InvalidArgumentError('Must be either 0, 1, 2, or 3');
    }
    return num;
}

program
    .requiredOption('-k, --api-key <k>', 'osu api key')
    .option('-m, --mode <m>', 'the mode the score was played in', optionIsGameMode, 0)
    .requiredOption('-b, --beatmap-id <b>', 'the beatmap ID (not beatmap set ID!) in which the replay was played', optionIsIntGreaterThanZero)
    .option('-h, --beatmap-hash <md5-hash>', 'the beatmap MD5-hash of the beatmap. When provided it saves an api call. If not provided it fetches it from the api.')
    .requiredOption('-u, --user-id <u>', 'the user that has played the beatmap', optionIsIntGreaterThanZero)
    .option('--mods <mods-bitmask>', 'bitmask of the used mods. If not specified, a random score will be picked (I think the one with highest pp), so it does NOT default to nomod!', optionIsIntGreaterThanZero)
    .option('-o, --output-file <file>', 'the osr-file to save (if not specified it uses stdout)')
    .parse();

const fs = require('fs');
const downloader = require('./downloader');
const WritestreamWrapper = require('./WritestreamWrapper');

const opts = program.opts();

async function run() {
    const data = await downloader.download(opts.apiKey, opts.userId, opts.beatmapId, opts.beatmapHash, opts.mode, opts.mods);

    // create output stream
    let out;
    if (opts.outputFile) {
        out = new WritestreamWrapper(fs.createWriteStream(opts.outputFile), true);
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