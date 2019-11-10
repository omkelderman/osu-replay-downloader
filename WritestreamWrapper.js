const uleb128 = require('uleb128');
const crypto = require('crypto');

class WritestreamWrapper {
    constructor(stream, streamIsClosable) {
        this.stream = stream;
        this.streamIsClosable = streamIsClosable;
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
        const WEIRD_CONSTANT = 429.4967296; // (2^32)/(10^7)
        // get the amount of *seconds* since the start of windows ticks
        let something = ((date.getTime()/1000)+62135596800);

        // magic
        let tmp = something / WEIRD_CONSTANT;
        let high = Math.floor(tmp);
        let low = (tmp-high) * WEIRD_CONSTANT * 10000000;

        this.writeLong(low, high);
    }

    /**
     * @param {{gameMode: number, beatmapHash: string, score: any, replayData: Buffer}} data
     */
    writeOsrData(data) {
        // write all the things: https://osu.ppy.sh/help/wiki/osu%21_File_Formats%2FOsr_%28file_format%29
        this.writeByte(data.gameMode);
        this.writeInteger(20151228); // game-version. Just a static number like this is fine.
        this.writeString(data.beatmapHash);
        this.writeString(data.score.username);
        let replayHashData = `${data.score.maxcombo}osu${data.score.username}${data.beatmapHash}${data.score.score}${data.score.rank}`;
        this.writeString(crypto.createHash('md5').update(replayHashData).digest('hex'));
        this.writeShort(+data.score.count300);
        this.writeShort(+data.score.count100);
        this.writeShort(+data.score.count50);
        this.writeShort(+data.score.countgeki);
        this.writeShort(+data.score.countkatu);
        this.writeShort(+data.score.countmiss);
        this.writeInteger(+data.score.score);
        this.writeShort(+data.score.maxcombo);
        this.writeByte(+data.score.perfect);
        this.writeInteger(+data.score.enabled_mods);
        this.writeString(''); // graph data, does not have to be available, its not stored on osu servers anyway
        let replayDate = new Date(data.score.date.replace(' ', 'T') + 'Z');
        this.writeDotNetDateTicks(replayDate);
        this.writeInteger(data.replayData.length);
        this.write(data.replayData);

        // finally need to write the replay-id as a 64bit number
        // yes, this wasnt in that wiki page, but it is needed (thanks osu!lazer :P)
        // lets cheat and asume it doesnt go above uint32max
        // if it ever does, no idea what will happen, probably World War III or something
        this.writeLong(+data.score.score_id, 0);
    }

    end() {
        if(this.streamIsClosable) this.stream.end();
    }
}

module.exports = WritestreamWrapper;