const express = require('express');
const app = express();
const FFMPEG = require('./FFMPEG');
const expressWs = require('express-ws')(app);
const HTTP_PORT = 2000;

// middleware para logar as requisições
// app.use((req, res, next) => {
//   console.log(req.ip, req.url, req.method, '\n');
//   next();
// });


app.ws('/camera', function (ws, req) {
  console.log('new client');
  ws.on('close', () => {
    console.log('client left');
  });
});

const sendToAll = (data) => {
  expressWs.getWss().clients.forEach(client => {
    client.send(JSON.stringify(data));
  });
}

app.get('/camera', async (req, res) => {
  // validções
  if (!req.query.b64) return res.status(400).send('b64 is required');
  let url = Buffer.from(req.query.b64, 'base64').toString('utf8');
  if (!url) return res.status(400).send('url is required');

  // se é o primeiro frame
  let first = true;
  // instancia o ffmpeg
  let ffmpeg = new FFMPEG(url);
  // verifica o tipo do video
  await ffmpeg.checkVideoContent();
  // inicia o ffmpeg
  ffmpeg.start();
  // escuta os eventos
  ffmpeg.on('data', (data) => {
    if (first) {
      first = false;
      sendToAll({ event: 'codec', data: ffmpeg.codecData, url: ffmpeg.url });
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
      });
    }
    res.write(data);
  });
  ffmpeg.on('bitrate', (e) => {
    sendToAll({ event: 'bitrate', data: e, url: ffmpeg.url });
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
    ffmpeg.stop();
    ffmpeg.removeAllListeners('data');
    ffmpeg.removeAllListeners('error');
    ffmpeg.removeAllListeners('exit');
    res.end();
    ffmpeg = null;
  });
  req.on('end', () => {
    ffmpeg.stop();
    ffmpeg.removeAllListeners('data');
    ffmpeg.removeAllListeners('error');
    ffmpeg.removeAllListeners('exit');
    res.end();
    ffmpeg = null;
  });
});

app.get('/*', express.static('html'));
app.listen(HTTP_PORT, () => {
  console.log('Servidor na url http://localhost:' + HTTP_PORT);
});