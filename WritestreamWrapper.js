const uleb128 = require('uleb128');
const crypto = require('crypto');

class WritestreamWrapper {
    /**
     * @param {NodeJS.WriteStream} stream the stream to work on
     * @param {boolean} streamIsClosable if the stream should be closed when done
     */
    constructor(stream, streamIsClosable) {
        this.stream = stream;
        this.streamIsClosable = streamIsClosable;
    }

    /**
     * Write arbitrary data to the stream
     * @param {Uint8Array} data the data to write
     */
    write(data) {
        this.stream.write(data);
    }

    /**
     * Write a string to the stream
     * @param {string} string the string to write
     */
    writeString(string) {
        const strBytes = Buffer.from(string, 'utf8');
        const strHeader = uleb128.encode(strBytes.length);
        strHeader.unshift(0x0B);

        this.stream.write(Buffer.from(strHeader));
        this.stream.write(strBytes);
    }

    /**
     * Write a single byte to the stream
     * @param {number} byte the single byte to write. It must be >= 0 and <= 255.
     */
    writeByte(byte) {
        const buf = Buffer.allocUnsafe(1);
        buf.writeUInt8(byte);

        this.stream.write(buf);
    }

    /**
     * Write a 16 unsigned number to the stream
     * @param {number} short a 16 bit unsigned number to write. It must be >= 0 and <= 65535.
     */
    writeShort(short) {
        const buf = Buffer.allocUnsafe(2);
        buf.writeUInt16LE(short);

        this.stream.write(buf);
    }

    /**
     * Write a 32 unsigned number to the stream
     * @param {number} short a 32 bit unsigned number to write. It must be >= 0 and <= 4294967295.
     */
    writeInteger(int) {
        const buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(int);

        this.stream.write(buf);
    }

    /**
     * Write a 64 unsigned number to the stream
     * @param {number} low a 32 bit unsigned number representing the lower order bits. It must be >= 0 and <= 4294967295.
     * @param {number} high a 32 bit unsigned number representing the higher order bits. It must be >= 0 and <= 4294967295.
     */
    writeLong(low, high) {
        const buf = Buffer.allocUnsafe(8);
        buf.writeUInt32LE(low, 0);
        buf.writeUInt32LE(high, 4);

        this.stream.write(buf);
    }

    /**
     * Write a 64 unsigned number to the stream
     * @param {bigint} bigint a 64 bit unsigned number to write 
     */
    writeLongWithBigInt(bigint) {
        const low = Number(BigInt.asUintN(32, bigint));
        const high = Number(bigint >> 32n);
        this.writeLong(low, high);
    }

    // WARNING: LOTS OF WERID SHIT THAT LOOKS SUPER DERPY, BUT TRUST ME: IT WORKS!
    // no really, im not kidding, this works! not sure if wanna explain tho xd
    // the tldr is that im writing a js date to a dotnet framework DateTime.Ticks value
    // which is a large number and js doesnt handle large numbers
    // so weird calculations to keep numbers below js max number and calculating a low and high part
    /**
     * Write a Date value as the number of "Ticks" in the .net DateTime type
     * @param {Date} date the Date to write
     */
    writeDotNetDateTicks(date) {
        const WEIRD_CONSTANT = 429.4967296; // (2^32)/(10^7)
        // get the amount of *seconds* since the start of windows ticks
        const something = ((date.getTime() / 1000) + 62135596800);

        // magic
        const tmp = something / WEIRD_CONSTANT;
        const high = Math.floor(tmp);
        const low = (tmp - high) * WEIRD_CONSTANT * 10000000;

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
        const replayHashData = `${data.score.maxcombo}osu${data.score.username}${data.beatmapHash}${data.score.score}${data.score.rank}`;
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
        const replayDate = new Date(data.score.date.replace(' ', 'T') + 'Z');
        this.writeDotNetDateTicks(replayDate);
        this.writeInteger(data.replayData.length);
        this.write(data.replayData);
        this.writeLongWithBigInt(BigInt(data.score.score_id));
    }

    end() {
        if (this.streamIsClosable) this.stream.end();
    }
}

module.exports = WritestreamWrapper;