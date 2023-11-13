import express from "express";
import { execPythonScript } from './server/dockerManager.mjs';
import { createServer } from "http";

const PORT = 3000;
const app = express();

app.use(express.json());

app.post('/execPython', function(req, res, next) {
  execPythonScript(req.body.code, function(err, stdout, stderr){
      if (err || stderr) {
          res.status(500).send({ error: stderr || err.message });
      } else {
          res.send({ output: stdout });
      }
  });
});

app.use(express.static("static"));

export const server = createServer(app).listen(PORT, function (err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});
