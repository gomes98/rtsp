const { spawn } = require('child_process');
const EventEmitter = require('events');

class FFMPEG extends EventEmitter {
  constructor(url, codecData) {
    super();
    this.stream = null;
    this.url = url;
    this.bitrate = 0;
    this.bitrateTimer = null;
    this.codecData = codecData;
    this.codecsAvailable = [
      { codec_name: 'h264', bsf: 'h264_mp4toannexb' },
      { codec_name: 'hevc', bsf: 'hevc_mp4toannexb' },
      // { codec_name: 'mpeg4', bsf: 'mpeg4_unpack_bframes' },
      // { codec_name: 'vp8', bsf: 'vp8_superframe' },
      // { codec_name: 'vp9', bsf: 'vp9_superframe' },
      // { codec_name: 'av1', bsf: 'av1_superframe' },
    ];
  }

  start(codec_name) {
    let bitrate = 0;
    // vericando se o codec é suportado
    let bsf;
    if(!this.codecData && codec_name){
      bsf = this.codecsAvailable.find(c => c.codec_name === codec_name).bsf;
    }else{
      bsf = this.codecsAvailable.find(c => c.codec_name === this.codecData.streams[0].codec_name).bsf;
    }
    if (!bsf) throw new Error('Codec not available');
    // montando os argumentos
    let args = `-i ${this.url} -c:v copy -c:a copy -bsf:v ${bsf} -maxrate 4096k -f matroska -`.split(' ');
    this.stream = spawn(
      'ffmpeg',
      args,
      { detached: false, windowsHide: true },
    );
    // tratamento de dados
    this.stream.stdout.on('data', (data) => {
      bitrate += data.length;
      this.emit('data', data);
    });
    // tratamento de erros
    this.stream.stderr.on('error', (e) => this.emit('error', { error: e, msg: 'err:error' }));
    this.stream.stdout.on('error', (e) => this.emit('error', { error: e, msg: 'out:error' }));
    this.stream.on('error', (error) => {
      this.emit('error', { error, msg: 'ffmpeg error' });
    });
    // tratamento de saida
    this.stream.on('exit', (_code, signal) => {
      this.stream = null;
      this.emit('exit', { code: _code, signal, msg: 'ffmpeg exit' });
      clearInterval(this.bitrateTimer);
    });
    this.emit('start', { url: this.url, codec: this.codecData });
    this.bitrateTimer = setInterval(() => {
      this.bitrate = bitrate;
      bitrate = 0;
      this.emit('bitrate', this.bitrate);
    }, 1000);
  }

  stop() {
    if (this.stream) {
      this.stream.kill();
      this.stream = null;
      clearInterval(this.bitrateTimer);
    }
  }

  isRunning() {
    return !!this.stream;
  }

  getCodecName(){
    return this.codecData.streams[0].codec_name;
  }

  async checkVideoContent() {
    try {
      // if (onlyCodec) return await checkVideoContent(url).then(data => data.streams[0].codec_name);
      // return await checkVideoContent(url);
      let codecData = await checkVideoContent(this.url);
      this.codecData = codecData;     
      return codecData;
    } catch (error) {
      throw error;
    }
  }
}
// verifica o tipo do conteudo do video
const checkVideoContent = (url) => {
  return new Promise((resolve, reject) => {
    let args = `-v quiet -print_format json -show_format -show_streams ${url}`.split(' ');
    this.stream = spawn(
      'ffprobe',
      args,
      { detached: false, windowsHide: true, timeout: 10000 },
    );
    let buf = Buffer.alloc(0);
    let error;
    this.stream.stdout.on('data', (data) => {
      buf = Buffer.concat([buf, data]);
    });
    this.stream.stderr.on('error', (e) => error = { error: e, msg: 'err:error' });
    this.stream.stdout.on('error', (e) => error = { error: e, msg: 'out:error' });
    this.stream.on('error', (error) => error = { error: e, msg: 'ffmpeg:error' });
    this.stream.on('exit', (_code, signal) => {
      if (_code === 0) {
        let data = JSON.parse(buf.toString());
        resolve(data);
      } else {
        reject({ code: _code, signal, error });
      }
    });
  });
}

module.exports = FFMPEG;