

# Visualizador de câmeras html


Este projeto foi desenvolvido para simplificar a visualização de câmeras de CFTV, facilitando o teste e a validação de uso.

Ele não realiza a conversão de formato de vídeo em H264, já se o video for em qualquer outro formato ele converte para H264. Isso resulta em baixa demanda de recursos da máquina. O sistema foi testado com câmeras e DVRs da Intelbras e Hikvision, utilizando os codecs H264 e H265.

O projeto oferece três mosaicos para visualização de 4, 9 e 16 câmeras.

Para cadastrar as cameras deve-se criar um arquivo JSON com o nome de cameras.json na raiz do projeto com o seguinte formato:
```
[
  {
    "id": 1,
    "name": "DVR INTELBRAS CANAL 1",
    "principal": "rtsp://USUARIO:SENHA@IPouDDNSdoDVR:PORTARTSP/cam/realmonitor?channel=1&subtype=0"
  },
  {
    "id": 2,
    "name": "DVR INTELBRAS CANAL 2",
    "principal": "rtsp://USUARIO:SENHA@IPouDDNSdoDVR:PORTARTSP/cam/realmonitor?channel=2&subtype=0"
  },
  {
    "id": 3,
    "name": "DVR HIKIVISION CANAL 1",
    "principal": "rtsp://USUARIO:SENHA@IPouDDNSdoDVR:PORTARTSP/Streaming/Channels/101"
  }
]
```

# Instalação
Clone esse repositorio.
Dentro da pasta digite:
```
npm install
```
Para iniciar o servidor digite:
```
node index.js
```
Se tudo correr bem sera exibida a mensagem:
```
Servidor na url http://localhost:2000
```

# Importante
Para que o projeto funcione, precisa ter FFMPEG e FFPROBE instalados na maquina.

A url informada deve possuir o usuário e senha.

# Exemplos testados
Exemplo intelbras
Stream Principal do canal 3:
```
rtsp://USUARIO:SENHA@IPDVROUCAMERA:PORTARTSP/cam/realmonitor?channel=3&subtype=0
```
Stream Secundário do canal 3:
```
rtsp://USUARIO:SENHA@IPDVROUCAMERA:PORTARTSP/cam/realmonitor?channel=3&subtype=1
```

Exemplo hikivision:
Stream Principal do canal 1:
```
rtsp://USUARIO:SENHA@IPDVROUCAMERA:PORTARTSP/Streaming/Channels/101
```
Stream Secundário do canal 1:
```
rtsp://USUARIO:SENHA@IPDVROUCAMERA:PORTARTSP/Streaming/Channels/102
```
### Equipamentos testados
Intelbras:
+ iMHDX 3008
+ VIP-3250-AL-IA
+ VIP-5460-Z-IA
+ VIP-3230-D-SL-G3
+ VIP-5280-B-IA

Hikivision:
+ DS-2CD2043G2-I
+ DS-7604NI-K1 / W


# Screenshot
![Screenshot](images/rodando.png "Screenshot")
