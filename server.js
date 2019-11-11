const http = require('http');
const urlParse = require('url').parse;
const downloader = require('./downloader');
const PassThrough = require('stream').PassThrough;
const WritestreamWrapper = require('./WritestreamWrapper');
const fs = require('fs');

let LISTEN;
if(process.env.LISTEN === undefined) {
    LISTEN = 3000;
} else {
    let port = parseInt(process.env.LISTEN);
    if(isNaN(port)) {
        LISTEN = process.env.LISTEN;
    } else {
        LISTEN = port;
    }
}
const LISTEN_HOST = process.env.LISTEN_HOST || 'localhost';
const API_KEY = process.env.API_KEY;
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || '/download';
const LISTEN_CHMOD = process.env.LISTEN_CHMOD;

if(!API_KEY) {
    console.error('No API key provided!');
    process.exitCode = 1;
    return;
}

const server = http.createServer(async (req, res) => {
    let things = urlParse(req.url, true);

    if(things.pathname != DOWNLOAD_PATH) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not found');
        return;
    }

    const gameMode = things.query.mode ? parseInt(things.query.mode) : 0;
    if(!things.query.beatmapId || !things.query.userId || isNaN(gameMode) || gameMode < 0 || gameMode > 3) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Missing or invalid parameters');
        return;
    }

    try {
        const data = await downloader.download(API_KEY, things.query.userId, things.query.beatmapId, things.query.beatmapHash, gameMode, things.query.mods);
        let fileName = data.score.score_id + '.osr';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('content-disposition', `attachment; filename="${fileName}"`);
        let throughStream = new PassThrough();
        throughStream.pipe(res);
        let out = new WritestreamWrapper(throughStream, true);
        out.writeOsrData(data);
        out.end();
    } catch(err) {
        console.error(err);
        res.statusCode = err.status || 500;
        res.setHeader('Content-Type', 'text/plain');
        if(err.message) {
            res.end('ERROR: ' + err.message);
        } else {
            res.end('Something went wrong...');
        }
        return;
    }
});

if(typeof LISTEN === 'number') {
    server.listen(LISTEN, LISTEN_HOST, () => {
        console.log(`Server running at http://${LISTEN_HOST}:${LISTEN}/`);
    });
} else {
    server.listen(LISTEN, () => {
        fs.chmodSync(LISTEN, LISTEN_CHMOD);
        console.log(`Server running at ${LISTEN}`);
    });
}