const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const {nanoid} = require('nanoid');
const path = require('path');

const port = 8080;

const app = express();
app.use(express.static('public'));
app.use('/audios', express.static('_submissions/audio'));
app.use('/lib/file-saver', express.static('node_modules/file-saver/dist/FileSaver.min.js'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

const audioData = {};

app.post('/upload', function(req, res) {
  console.log(req);
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }
  if (!req.body || !req.body.singer || !req.body.lang) {
    return res.status(400).send('Missing metadata about upload.');
  }

  let audioFile = req.files.recording;
  // generate random name
  let shortname = nanoid();
  let name =  shortname + ".mp3";

  // Use the mv() method to place the file somewhere on your server
  audioFile.mv(path.join(__dirname, '_submissions/audio/' + name), function(err) {
    if (err)
      return res.status(500).send(err);
    let data = {author: req.body.singer, lang: req.body.lang};
    audioData[shortname] = data;
    fs.writeFile(path.join(__dirname, '_submissions/data/' + shortname + '.json'), JSON.stringify(data, null, 2)).then(() => res.send('File uploaded!'));
  });
});

app.get('/recording.json', async function(req, res) {
  res.send(JSON.stringify(audioData, null, 2));
});


(async function() {
  let dir = path.join(__dirname, '_submissions/data');
  let files = (await fs.readdir(dir)).filter(p => p.endsWith('.json'));
  for (let p of files) {
    let jsonFile = await fs.readFile(path.join(dir, p), 'utf-8');
    audioData[p.replace(/\.json$/, '')] = JSON.parse(jsonFile);
  }
  app.listen(port, () => {
    console.log(`Canon singer app listening at http://localhost:${port}`)
  })
})();
