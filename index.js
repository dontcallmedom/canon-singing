const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const {nanoid} = require('nanoid');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const port = process.env.PORT || 8080;

const app = express();
app.use(express.static('public'));

app.use('/audios', express.static('_submissions/audio'));
app.use('/covers', express.static('_submissions/cover'));
app.use('/lib/file-saver', express.static('node_modules/file-saver/dist/FileSaver.min.js'));
app.use('/lib/audio-recorder-polyfill', express.static('node_modules/audio-recorder-polyfill'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

const audioData = {};

app.post('/upload', function(req, res) {
  console.log(req);
  if (!req.files || Object.keys(req.files).length === 0 || !req.files.recording) {
    return res.status(400).send('No files were uploaded.');
  }
  if (!req.body || !req.body.singer || !req.body.lang) {
    return res.status(400).send('Missing metadata about upload.');
  }

  let audioFile = req.files.recording;
  let coverFile = req.files.cover;
  let format = req.body.format || "audio/webm";
  let extension = format === "audio/webm" ? ".webm" : ".mp3";
  let transcodedExtension = extension === ".webm" ? ".mp3" : ".webm";
  // generate random name
  let shortname = nanoid();

  let audioPath = path.join(__dirname, '_submissions/audio/' + shortname + extension);
  let transcodedAudioPath = path.join(__dirname, '_submissions/audio/' + shortname + transcodedExtension);
  // Use the mv() method to place the file somewhere on your server
  audioFile.mv(audioPath, async function(err) {
    if (err)
      return res.status(500).send(JSON.stringify({err}, null, 2));
    let data = {author: req.body.singer, lang: req.body.lang};
    audioData[shortname] = data;
    await fs.writeFile(path.join(__dirname, '_submissions/data/' + shortname + '.json'), JSON.stringify(data, null, 2));
    res.send(JSON.stringify({msg: 'Song  uploaded with id ' + shortname, id: shortname}, null, 2));
    if (coverFile) {
      if (Array.isArray(coverFile)) {
        coverFile = coverFile[coverFile.length - 1];
      }
      console.log(coverFile);
      coverFile.mv(path.join(__dirname, '_submissions/cover/' + shortname + '.png'), err => console.error(err));
      // Transcoding audio file
      try {
        ffmpeg(audioPath).save(transcodedAudioPath);
      } catch (e) {
        console.error(e);
      }
    }
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
