const status = document.getElementById('status');
const ref = document.getElementById('ref');
const langSelector = document.getElementById('lang');
const uploadLangSelector = document.getElementById('lang2');
const recordBtn = document.getElementById('record');
const replayBtn = document.getElementById('playrecord');
const uploadBtn = document.getElementById('upload');
const form = document.getElementById("formupload");
const segmentDuration = 5.5;

let selectedLang = "en";
let langs = {}, lyrics = {};
let onAir = false;
let recorder;
let recordedChunks = [];
let recording;
let stream;

const tone = new Audio("audios/tone.mp3");
tone.loop = true;

(async function() {
  langs = await fetch("lang.json").then(r => r.json());
  lyrics = await fetch("lyrics.json").then(r => r.json());
  Object.keys(langs).forEach(lang => {
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
    if (lang === "en") {
      opt.selected = true;
    }
    if (lyrics[lang]) {
      const opt2 = opt.cloneNode(true);
      if (lang === "en") {
        opt2.selected = true;
      }
      langSelector.appendChild(opt2);
    }
    uploadLangSelector.appendChild(opt);
  });
})();

langSelector.addEventListener("change", () => {
  selectedLang = langSelector.value;
  uploadLangSelector.value = selectedLang;
});

ref.addEventListener("timeupdate", function() {
  const segment = Math.floor(ref.currentTime / segmentDuration);
  const lang = lyrics[selectedLang] ? selectedLang : "en";
  const line = lyrics[lang][segment];
  if (!line) {
    karaoke.textContent = "";
    return;
  }
  if (line.lang) {
    karaoke.lang = line.lang;
    karaoke.textContent = line.string
  } else {
    karaoke.textContent = line;
  }
});

async function wait(s) {
  return new Promise(res => setTimeout(res, 1000*s));
}

recordBtn.addEventListener("click", async () => {
  recordBtn.disabled = true;
  replayBtn.disabled = true;
  [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = true);
  ref.pause();
  ref.currentTime = 0;
  stream = await navigator.mediaDevices.getUserMedia({audio: true});
  recorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
  recorder.ondataavailable = event => recordedChunks.push(event.data);
  tone.play();
  for (i = 3; i > 0; i--) {
    if (i == 1) {
      tone.pause();
    }
    karaoke.textContent = i;
    await wait(1);
  }
  ref.controls = false;
  recorder.start(100);
  ref.play();
  onAir = true;
});

replayBtn.addEventListener("click", () => {
  const audio = new Audio();
  recordBtn.disabled = true;
  audio.src = URL.createObjectURL(recording);
  audio.play();
  audio.addEventListener("ended", () =>   recordBtn.disabled = false);
});

ref.addEventListener("ended", () => {
  if (onAir) {
    stream.getAudioTracks()[0].stop();
    recorder.stop();
    ref.controls = true;
    recordBtn.disabled = false;
    recordBtn.textContent = "Re-record";
    replayBtn.disabled = false;
    // Upload resulting recording
    recording = new Blob(recordedChunks);
    [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = false);
  }
});

uploadBtn.addEventListener("click", e => {
  e.preventDefault();
  const formData = new FormData(form);
  formData.append("recording", recording);
  fetch("upload", {method: "POST", body: formData})
    .then(r => r.json())
    .then(res => {
      // TODO: show error or success
    });
});
