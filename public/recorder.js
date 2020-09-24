const status = document.getElementById('status');
const ref = document.getElementById('ref');
const langSelector = document.getElementById('lang');
const uploadLangSelector = document.getElementById('lang2');
const recordBtn = document.getElementById('record');
const playBtn = document.getElementById('play');
const playLabel = document.getElementById('play-label');
const pauseBtn = document.getElementById('pause');
const stopBtn = document.getElementById('stop');
const stopLabel = document.getElementById('stop-label');
const replayBtn = document.getElementById('playrecord');
const uploadBtn = document.getElementById('upload');
const coverTextInp = document.getElementById("covertxt");
const coverInp = document.getElementById("coverinp");
const coverImg = document.getElementById("cover");
const form = document.getElementById("formupload");
const segmentDuration = 6;

const preferedLanguage = (navigator.language || "en").split("-")[0];

let selectedLang = preferedLanguage;
let langs = {}, lyrics = {};
let toneDecodedAudio = null;
let refBlob = null;
let refDecodedAudio = null;
let onAir = false;
let customImage = false;
let recorder;
let recordedChunks;
let recording;
let recordingDecodedAudio = null;
let recordingCanceled = false;
let stream = null;
let playbackNode = null;
let refNode = null;
let karaokeTimeout = null;

// Initialize audio context
let startTime = 0;
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

// Audio format for playback
const audioFormatDetector = new Audio();
let audioFormat = "webm";
if (audioFormatDetector.canPlayType('audio/webm') === '') {
  audioFormat = "mp3";
}

const pickRandomlyFrom = a => a[Math.floor(a.length * Math.random())];
const randomEmoji = pickRandomlyFrom(["🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🥝", "🍅", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶", "🥒", "🥬", "🥦", "🧄", "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🧃", "🧉", "🧊", "🥢", "🍽", "🍴", "🥄"]);
var avatar = randomAvatar({size:128, text: randomEmoji});
avatar.alt = "Randomly generated image with emoji " + randomEmoji;
coverImg.innerHTML = "";
coverImg.appendChild(avatar);
coverTextInp.value = randomEmoji;


function resetAudioGraph() {
  if (playbackNode) {
    playbackNode.disconnect();
    playbackNode.removeEventListener("ended", onEndedHandler);
    playbackNode = null;
  }
  if (refNode) {
    refNode.disconnect();
    refNode.removeEventListener("ended", onEndedHandler);
    refNode = null;
  }
}

function onEndedHandler() {
  audioContext.suspend();
  resetAudioGraph();
  stopKaraoke();

  if (recorder) {
    recorder.stop();
    stopLabel.textContent = "Stop";
  }

  recordBtn.disabled = false;
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
}


async function prepareReferencePlayback() {
  startTime = audioContext.currentTime;
  playbackNode = audioContext.createBufferSource();
  playbackNode.buffer = refDecodedAudio;
  playbackNode.start(startTime);
  playbackNode.connect(audioContext.destination);
  playbackNode.addEventListener("ended", onEndedHandler);
}

async function prepareCountdownAndReferencePlayback() {
  startTime = audioContext.currentTime;
  playbackNode = audioContext.createGain();

  const toneNode1 = audioContext.createBufferSource();
  toneNode1.buffer = toneDecodedAudio;
  toneNode1.start(startTime);
  toneNode1.stop(startTime + 1);
  toneNode1.connect(playbackNode);

  const toneNode2 = audioContext.createBufferSource();
  toneNode2.buffer = toneDecodedAudio;
  toneNode2.start(startTime + 1);
  toneNode2.stop(startTime + 2);
  toneNode2.connect(playbackNode);

  const toneNode3 = audioContext.createBufferSource();
  toneNode3.buffer = toneDecodedAudio;
  toneNode3.start(startTime + 2);
  toneNode3.stop(startTime + 3);
  toneNode3.connect(playbackNode);

  refNode = audioContext.createBufferSource();
  refNode.buffer = refDecodedAudio;
  refNode.start(startTime + 3);

  refNode.connect(playbackNode);
  playbackNode.connect(audioContext.destination);

  refNode.addEventListener("ended", onEndedHandler);
}

async function prepareRecordingPlayback() {
  // Safari compat notes:
  // - No support for blob.arrayBuffer() yet, so need to use FileReader
  // - No support for Promise version of decodeAudioData yet
  const buffer = await new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(recording);
    reader.onloadend = () => {
      resolve(reader.result);
    }
  });
  const decodedAudio = await new Promise((res, rej) => audioContext.decodeAudioData(buffer, res, rej));
  startTime = audioContext.currentTime;
  playbackNode = audioContext.createBufferSource();
  playbackNode.buffer = decodedAudio;
  playbackNode.start(startTime);
  playbackNode.connect(audioContext.destination);
  playbackNode.addEventListener("ended", onEndedHandler);
}

function startKaraoke({ wait } = { wait: 0 }) {
  let lastSegment = -1;
  let lastLang = null;

  function scheduleNextCheck() {
    karaokeTimeout = setTimeout(karaokeCheck, 100);
  }

  function karaokeCheck() {
    const currentTime = audioContext.currentTime - startTime - wait;
    const segment = Math.floor(currentTime / segmentDuration);
    const lang = lyrics[selectedLang] ? selectedLang : "en";

    if ((segment < 0) || ((segment === lastSegment) && (lang === lastLang))) {
      scheduleNextCheck();
      return;
    }
    lastSegment = segment;
    lastLang = lang;

    const line = lyrics[lang][segment];
    const nextLine = lyrics[lang][segment + 1] || false;
    if (!line) {
      karaoke.textContent = "";
      scheduleNextCheck();
      return;
    }
    const current = document.createElement("span");
    let next;
    if (nextLine) {
      next = document.createElement("p");
      next.className = "next";
    }
    if (line.lang) {
      current.lang = line.lang;
      current.textContent = line.string
    } else {
      current.textContent = line;
    }
    if (nextLine) {
      if (line.lang) {
        next.lang = nextLine.lang;
        next.textContent = nextLine.string
      } else {
        next.textContent = nextLine;
      }
    }
    karaoke.innerHTML = "";
    karaoke.appendChild(current);
    if (nextLine) {
      karaoke.appendChild(next);
    }

    scheduleNextCheck();
  }

  stopKaraoke();
  scheduleNextCheck();
}

function stopKaraoke() {
  if (karaokeTimeout) {
    clearTimeout(karaokeTimeout);
    karaokeTimeout = null;
  }
}


(async function() {
  // Safari compat notes:
  // - No support for Promise version of decodeAudioData yet
  // - Call to suspend does not seem to set the internal "suspended by user"
  // flag, see workaround in recordBtn click event handler.
  await audioContext.suspend();
  startTime = audioContext.currentTime;
  toneDecodedAudio = await fetch(`audios/tone.${audioFormat}`)
    .then(r => r.arrayBuffer())
    .then(buffer => new Promise((res, rej) => audioContext.decodeAudioData(buffer, res, rej)));
  refDecodedAudio = await fetch(`audios/reference.${audioFormat}`)
    .then(r => r.arrayBuffer())
    .then(buffer => {
      refBlob = new Blob([buffer]);
      return buffer;
    })
    .then(buffer => new Promise((res, rej) => audioContext.decodeAudioData(buffer, res, rej)));

  langs = await fetch("lang.json").then(r => r.json());
  lyrics = await fetch("lyrics.json").then(r => r.json());

  Object.keys(langs).sort((l1, l2) => (langs[l1].sortName || langs[l1].name).localeCompare(langs[l2].sortName || langs[l2].name))
    .forEach(lang => {
    const opt = document.createElement("option");
    opt.value = lang;
    const nativeSpan = document.createElement("span");
    nativeSpan.lang = lang;
    nativeSpan.textContent = langs[lang].nativeName;
    const enSpan = document.createElement("span");
    enSpan.lang = "en";
    enSpan.textContent = " (" + langs[lang].name + ")";
    opt.appendChild(nativeSpan);
    opt.appendChild(enSpan);
    if (lyrics[lang]) {
      const opt2 = opt.cloneNode(true);
      langSelector.querySelector("optgroup").appendChild(opt2);
      if (lang === preferedLanguage) {
        opt2.selected = true;
      }
    }
    uploadLangSelector.querySelector("optgroup").appendChild(opt);
    if (lang === preferedLanguage) {
      opt.selected = true;
    }
  });

  recordBtn.disabled = false;
  playBtn.disabled = false;
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
})();

langSelector.addEventListener("change", () => {
  selectedLang = langSelector.value;
  if (Object.keys(langs).includes(selectedLang)) {
    uploadLangSelector.value = selectedLang;
  }
});

recordBtn.addEventListener("click", async () => {
  recordBtn.disabled = true;
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  stopLabel.textContent = "Cancel recording";

  if (playbackNode) {
    await audioContext.suspend();
    resetAudioGraph();
  }

  // Disable upload form
  [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = true);
  document.getElementById("uploader").classList.add("disabled");

  // Safari compat notes:
  // - The following two lines look pretty useless. They are not when recording
  // for the first time! Safari apparently refuses to set the internal
  // [[suspended by user]] flag  unless "resume" has been called first... and
  // "resume" can only be called in response to user activation (so not when
  // the page loads). Without these lines, the audio context woult start playing
  // on Safari as soon as a node gets created in the audio graph, not when
  // "resume" is called.
  await audioContext.resume();
  await audioContext.suspend();
  await prepareCountdownAndReferencePlayback();

  // Prepare recorder
  stream = await navigator.mediaDevices.getUserMedia({audio: true});
  let mimeType = "audio/webm";
  if (!MediaRecorder.isTypeSupported("audio/webm")) {
    mimeType = "audio/mpeg";
  }
  document.getElementById("format").value = mimeType;
  recordingCanceled = false;
  recorder = new MediaRecorder(stream, { mimeType });
  recordedChunks = [];
  recorder.addEventListener("dataavailable", event => recordedChunks.push(event.data));
  recorder.addEventListener("stop", () => {
    recording = new Blob(recordedChunks);

    if (!recordingCanceled) {
      // Allow user to listen to and upload resulting recording
      [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = false);
      document.getElementById("uploader").classList.remove("disabled");
    }
    recorder = null;

    recordBtn.disabled = false;
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    playLabel.textContent = "Play recording";
    stopLabel.textContent = "Stop";
  });

  // Start playback
  await audioContext.resume();
  startKaraoke({ wait: 3 });

  // Show countdown
  karaoke.classList.add("countdown");
  for (let i = 3; i > 0; i--) {
    karaoke.textContent = i;
    await wait(1);
  }
  karaoke.textContent = "";
  karaoke.classList.remove("countdown");

  // Start recording
  // (note there is no guarantee that precisely 3 seconds will have
  // passed, but we should hopefully be close enough)
  recorder.start();

  stopBtn.disabled = false;
});

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  if (!playbackNode) {
    if (recording) {
      await prepareRecordingPlayback();
    }
    else {
      await prepareReferencePlayback();
    }
  }
  await audioContext.resume();
  startKaraoke();
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
});

pauseBtn.addEventListener("click", async () => {
  pauseBtn.disabled = true;
  await audioContext.suspend();
  stopKaraoke();
  playBtn.disabled = false;
});

stopBtn.addEventListener("click", async () => {
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  await audioContext.suspend();
  if (recorder) {
    recordingCanceled = true;
    recorder.stop();
  }
  resetAudioGraph();
  stopKaraoke();
  playBtn.disabled = false;
});


async function wait(s) {
  return new Promise(res => setTimeout(res, 1000*s));
}


uploadBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  formData.append("recording", recording);
  // TODO if !customImage, load avatar into formData.cover
  if (!customImage) {
    const img = coverImg.querySelector("img");
    if (img) {
      const cv = document.createElement("canvas");
      cv.width = img.clientWidth;
      cv.height = img.clientHeight;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await new Promise(res => cv.toBlob(blob => res(formData.append('cover', blob))));
    }
  }
  fetch("upload", {method: "POST", body: formData})
    .then(r => r.json())
    .then(res => {
      if (res.err) {
        document.getElementById("uploadstatus").textContent = "Upload failed: " + res.err;
      } else if (res.msg) {
        document.getElementById("uploadstatus").textContent = "Upload Succeeded: " + res.msg;
        uploadBtn.disabled = true;
        const json = localStorage.getItem("canon-singing-ids") || "[]";
        try {
          const ids = JSON.parse(json);
          if (Array.isArray(ids) && res.id) {
            ids.push(res.id);
            localStorage.setItem("canon-singing-ids", JSON.stringify(ids));
          }
        } catch (e) {
          console.error("Could not save new record with id " + id + ":" + e);
        }
      }
    });
});

coverTextInp.addEventListener("input", e => {
  if (customImage) return;
  var avatar = randomAvatar({size:128, text: coverTextInp.value});
  avatar.alt = "Randomly generated image with character " + coverTextInp.value;
  coverImg.innerHTML = "";
  coverImg.appendChild(avatar);
});

coverInp.addEventListener("change", () => {
  coverImg.innerHTML = "";
  const img = document.createElement('img');
  img.width = 200;
  img.src = URL.createObjectURL(coverInp.files[0]);
  coverImg.appendChild(img);
  customImage = true;
  coverTextInp.remove();
});
