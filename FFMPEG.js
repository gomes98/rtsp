const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

class FFMPEG extends EventEmitter {
  constructor(config = {
    url: '',
    codecData: null,
    accept: '',
    codec_name: '',
    outputDir: '',
    id: 0,
  }) {
    super();
    this.stream = null;
    this.id = config.id || new Date().getTime();
    this.url = config.url;
    this.codecData = config.codecData;
    this.outputDir = config.outputDir || path.join(__dirname, 'output');
    this.tickerTimer = null;
    this.lastTick;
  }

  async startHls() {
    if (!fs.existsSync(this.outputDir)) {
      await fs.promises.mkdir(this.outputDir);
    } else {
      this.clearDir();
    }
    try {
      await this.checkVideoContent();
    } catch (error) {
      this.emit('error', { error, msg: 'Codec not available' });
    }
    // montando os argumentos para h264
    let args = `-re -rtsp_transport tcp -i ${this.url} -c copy -vsync -1 -flags +global_header -hls_list_size 8 -hls_time 2 -hls_flags delete_segments -segment_list_flags +live -f hls ${this.outputDir}/cam_${this.id}_.m3u8`.split(' ');
    // montando os argumentos para outros codecs
    if (this.codecData.streams[0].codec_name != 'h264') {
      args = `-re -rtsp_transport tcp -i ${this.url} -c:v libx264 -preset ultrafast -crf 40 -c:a copy -s 1280x720 -b:v 500k -hls_list_size 8 -hls_time 2 -hls_flags delete_segments -f hls ${this.outputDir}/cam_${this.id}_.m3u8`.split(' ');
    }
    // iniciando o processo ffmpeg
    this.stream = spawn(
      'ffmpeg',
      args,
      { detached: false, windowsHide: true },
    );
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
    });
    this.emit('start', { url: this.url, codec: this.codecData });
    // monitorando o tempo de execução
    this.tickerTimer = setInterval(() => {
      let now = new Date().getTime();
      if (now - this.lastTick > 10000) {
        this.stop();
      }
    }, 1000);
  }

  async start() {
    let bitrate = 0;
    // vericando se o codec é suportado
    try {
      await this.checkVideoContent();
    } catch (error) {
      this.emit('error', { error, msg: 'Codec not available' });
    }
    // montando os argumentos para h264
    let args = `-re -rtsp_transport tcp -i ${this.url} -c:v copy -c:a copy -f matroska -`.split(' ');
    // montando os argumentos para outros codecs
    if (this.codecData.streams[0].codec_name != 'h264') {
      args = `-re -rtsp_transport tcp -i ${this.url} -c:v libx264 -preset ultrafast -crf 40 -c:a copy -s 1280x720 -f matroska -`.split(' ');
    }
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

  async stop() {
    if (this.stream) {
      this.stream.kill();
      this.stream = null;
      // parando o ticker
      clearInterval(this.tickerTimer);
      // limpando diretório de saída
      this.clearDir();
      this.emit('stop', { msg: 'ffmpeg stop' });
    }
  }

  async clearDir() {
    let files = await fs.promises.readdir(this.outputDir)
    files.filter(f => f.includes(`cam_${this.id}`)).forEach(async (f) => {
      await fs.promises.unlink(path.join(this.outputDir, f));
    });
  }

  tick() {
    // console.log('tick', this.id);
    this.lastTick = new Date().getTime();
  }

  isRunning() {
    return !!this.stream;
  }

  getCodecName() {
    return this.codecData.streams[0].codec_name;
  }

  async checkVideoContent() {
    try {
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
    this.stream.stderr.on('error', (error) => error = { error, msg: 'err:error' });
    this.stream.stdout.on('error', (error) => error = { error, msg: 'out:error' });
    this.stream.on('error', (error) => error = { error, msg: 'ffmpeg:error' });
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