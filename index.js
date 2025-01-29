const express = require('express');
const path = require('path');
const app = express();
const HTTP_PORT = 2000;
const FFMPEG = require('./FFMPEG');
const outputDir = path.join(__dirname, 'output');
const timers = require('timers/promises');
let cameras;
// Cria o diretório de saída se não existir
const fs = require('fs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
} else {
  clearDir();
}

if(fs.existsSync('cameras.json')){
  cameras = JSON.parse(fs.readFileSync('cameras.json'));
}else{
  cameras = [];
}

async function clearDir() {
  let files = await fs.promises.readdir(outputDir)
  files.forEach(async (f) => {
    await fs.promises.unlink(path.join(outputDir, f));
  });
}
// mostra no console as requisições
app.use((req, res, next) => {
  console.log(req.ip, req.url, req.method, '\n');
  next();
});
// ROTA HLS
let CAMERASON = [];
app.get('/hls/:fileId', async (req, res) => {
  let camera;
  // se não houver ID da câmera, retorna 404
  if (!req.params.fileId) {
    return res.status(404).send('Câmera não encontrada');
  }
  // extração do ID da câmera
  let fileId;
  try {
    fileId = parseInt(req.params.fileId.split('_')[1]);
    if (!isNaN(fileId)) {
      camera = cameras.find(cam => cam.id === fileId);
      if (!camera) {
        return res.status(404).send('Câmera não encontrada');
      }
    }
  } catch (error) {
    console.log('Erro ao extrair o ID da câmera:', error);
    return res.status(404).send('Câmera não encontrada @');
  }
  // se o arquivo não existir e for o m3u8, inicia o processo ffmpeg  
  if (req.params.fileId.split('.').at(-1) == 'm3u8' && !fs.existsSync(path.join(outputDir, req.params.fileId))) {
    // prepara o ffmpeg
    let c = new FFMPEG({
      url: camera.principal,
      id: camera.id,
    });
    // inicia o ffmpeg
    c.startHls();
    // quando sair do ffmpeg, remove do array
    c.on('stop', () => {
      CAMERASON = CAMERASON.filter(cam => cam.id != fileId);
    });
    // quando sair do ffmpeg, remove do array
    c.on('exit', () => {
      CAMERASON = CAMERASON.filter(cam => cam.id != fileId);
    });
    // quando der erro, remove do array
    c.on('error', (e) => {
      console.log('Erro no ffmpeg:', e);
      CAMERASON = CAMERASON.filter(cam => cam.id != fileId);
    });
    // adiciona ao array
    CAMERASON.push(c);
  } else {
    // informa ao ffmpeg que o arquivo foi acessado, para não parar
    let c = CAMERASON.find(cam => cam.id == fileId);
    if (c && typeof c.tick == 'function') {
      c.tick();
    }
  }
  // pausa para esperar o arquivo ser criado, até 10 segundos
  let status = false;
  for (let i = 0; i < 10; i++) {
    await timers.setTimeout(1000);
    if (fs.existsSync(path.join(outputDir, req.params.fileId))) {
      status = true;
      break;
    }
  }
  if (!status) {
    return res.status(404).send('Arquivo não encontrado');
  }
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(path.join(outputDir, req.params.fileId));
});
// ROTA VIDEO
app.get('/video/:cameraId', async (req, res) => {
  let camera;
  // se não houver ID da câmera, retorna 404
  if (!req.params.cameraId) {
    return res.status(404).send('Câmera não informada');
  }
  // extração do ID da câmera
  try {
    camera = cameras.find(cam => cam.id == req.params.cameraId);
    if (!camera) {
      return res.status(404).send('Câmera não encontrada');
    }
  } catch (error) {
    console.log('Erro ao extrair o ID da câmera:', error);
    return res.status(404).send('Câmera não encontrada @');
  }
  // se é o primeiro frame
  let first = true;
  // instancia o ffmpeg
  let ffmpeg = new FFMPEG({
    url: camera.principal,
    id: camera.id,
  });
  // inicia o ffmpeg
  ffmpeg.start();
  // escuta os eventos
  ffmpeg.on('data', (data) => {
    if (first) {
      first = false;
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'video/x-matroska',
        // 'Content-Type': 'video/*',
      });
    }
    res.write(data);
  });
  ffmpeg.on('error', (e) => {
    console.log('error', e);
    res.end();
  });
  ffmpeg.on('exit', (e) => {
    console.log('exit', e);
    res.end();
  });
  req.on('close', () => {
    if (ffmpeg) {
      ffmpeg.stop();
      ffmpeg.removeAllListeners('data');
      ffmpeg.removeAllListeners('error');
      ffmpeg.removeAllListeners('exit');
      ffmpeg = null;
    }
    res.end();
  });
  req.on('end', () => {
    if (ffmpeg) {
      ffmpeg.stop();
      ffmpeg.removeAllListeners('data');
      ffmpeg.removeAllListeners('error');
      ffmpeg.removeAllListeners('exit');
      ffmpeg = null;
    }
    res.end();
  });
});


app.use('/', express.static('html'));

app.get('/cameras', (req, res) => {
  if (fs.existsSync('cameras.json')) {
    let cameras = JSON.parse(fs.readFileSync('cameras.json'));
    res.json(cameras);
  } else {
    res.json([]);
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Servidor rodando em http://localhost:${HTTP_PORT}`);
});
