const request = require('request');

// api stuff

/**
 * @param {string} url The full url of the api call
 */
function doApiCall(url) {
    return new Promise((resolve, reject) => {
        request.get({url: url, json: true}, (err, r, json) => {
            if(err) return reject(err);
            if(r.statusCode != 200) return reject(new Error('no 200 statuscode'));
            if(json.error) return reject(new Error('api error response: ' + json.error));
            resolve(json);
        });
    });
}

/**
 * @param {string} apiKey
 * @param {number} beatmapId
 */
function getBeatmaps(apiKey, beatmapId) {
    return doApiCall(`https://osu.ppy.sh/api/get_beatmaps?k=${apiKey}&b=${beatmapId}`);
}

/**
 * @param {string} endpoint
 * @param {string} apiKey
 * @param {number} userId
 * @param {number} gameMode
 * @param {number} beatmapId
 * @param {number?} mods
 */
function buildScoreOrReplayApiUrl(endpoint, apiKey, userId, gameMode, beatmapId, mods = undefined) {
    let url = `https://osu.ppy.sh/api/${endpoint}?k=${apiKey}&u=${userId}&m=${gameMode}&b=${beatmapId}`;
    if(mods !== undefined) {
        url += '&mods=' + mods;
    }
    return url;
}

/**
 * @param {string} apiKey
 * @param {number} userId
 * @param {number} gameMode
 * @param {number} beatmapId
 * @param {number?} mods
 */
function getScores(apiKey, userId, gameMode, beatmapId, mods) {
    return doApiCall(buildScoreOrReplayApiUrl('get_scores', apiKey, userId, gameMode, beatmapId, mods));
}

/**
 * @param {string} apiKey
 * @param {number} userId
 * @param {number} gameMode
 * @param {number} beatmapId
 * @param {number?} mods
 */
function getReplay(apiKey, userId, gameMode, beatmapId, mods) {
    return doApiCall(buildScoreOrReplayApiUrl('get_replay', apiKey, userId, gameMode, beatmapId, mods));
}

/**
 * @param {string} apiKey
 * @param {number} userId 
 * @param {number} beatmapId
 * @param {string?} beatmapHash
 *                  The MD5 beatmap hash of the beatmap.
 *                  Optional, if not provided it will be fetched from the API (so providing it saves one api call lol)
 * @param {(0|1|2|3)?} mode The gamemode, defaults to 0 (std)
 * @param {number?} mods Mods used in the play, default is NOT nomod, but something random, I *think* whatever gave the most PP or something, but I'm not sure
 */
async function download(apiKey, userId, beatmapId, beatmapHash = undefined, gameMode = 0, mods = undefined) {
    const scores = await getScores(apiKey, userId, gameMode, beatmapId, mods);
    if(scores.length < 1) {
        throw new Error('score not found');
    }
    const score = scores[0];

    if(parseInt(score.replay_available) != 1) {
        throw new Error('replay data not available.');
    }

    if(!beatmapHash) {
        const beatmaps = await getBeatmaps(apiKey, beatmapId);
        if(beatmaps.length < 1) {
            throw new Error('beatmap not found (which makes no sense, since the score was found, but whatever)');
        }
        beatmapHash = beatmaps[0].file_md5;
    }

    const replay = await getReplay(apiKey, userId, gameMode, beatmapId, mods);

    if(!Buffer.isEncoding(replay.encoding)) {
        throw new Error('unknown replay-encoding: ' + replay.encoding);
    }

    // yay we have data
    const replayData = Buffer.from(replay.content, replay.encoding);

    return {
        gameMode: gameMode,
        beatmapHash: beatmapHash,
        score: score,
        replayData: replayData
    };
}


module.exports.download = download;