const status = document.getElementById('status');
const ref = document.getElementById('ref');
const langSelector = document.getElementById('lang');
const uploadLangSelector = document.getElementById('lang2');
const recordBtn = document.getElementById('record');
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
let onAir = false;
let customImage = false;
let recorder;
let recordedChunks;
let recording;
let recordingCanceled = false;
let stream;
let recordedAudio;

const tone = new Audio("audios/tone.webm");

const pickRandomlyFrom = a => a[Math.floor(a.length * Math.random())];
const randomEmoji = pickRandomlyFrom(["🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🥝", "🍅", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶", "🥒", "🥬", "🥦", "🧄", "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🧃", "🧉", "🧊", "🥢", "🍽", "🍴", "🥄"]);
var avatar = randomAvatar({size:128, text: randomEmoji});
avatar.alt = "Randomly generated image with emoji " + randomEmoji;
coverImg.innerHTML = "";
coverImg.appendChild(avatar);
coverTextInp.value = randomEmoji;


(async function() {
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
})();

langSelector.addEventListener("change", () => {
  selectedLang = langSelector.value;
  if (Object.keys(langs).includes(selectedLang)) {
    uploadLangSelector.value = selectedLang;
  }
});

ref.addEventListener("timeupdate", function() {
  const segment = Math.floor(ref.currentTime / segmentDuration);
  const lang = lyrics[selectedLang] ? selectedLang : "en";
  const line = lyrics[lang][segment];
  const nextLine = lyrics[lang][segment + 1] || false;
  if (!line) {
    karaoke.textContent = "";
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
});

async function wait(s) {
  return new Promise(res => setTimeout(res, 1000*s));
}

function resetReplayBtn() {
  replayBtn.textContent = "Play your last recording";
  if (recordedAudio) {
    recordedAudio.pause();
    recordedAudio = null;
  }
}

function stopRecording({ cancel } = { cancel: false }) {
  recordingCanceled = cancel;
  ref.pause();
  stream.getAudioTracks()[0].stop();
  recorder.stop();
}

recordBtn.addEventListener("click", async () => {
  if (onAir) {
    onAir = false;
    stopRecording({ cancel: true });
  }
  else {
    onAir = true;
    replayBtn.hidden = true;
    if (recordedAudio) {
      recordedAudio.pause();
      recordedAudio = null;
    }
    [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = true);

    // Stop ref playback in case it's running and set the source again to force
    // currentTime to 0 again (file is not seekable so setting currentTime does
    // not work).
    ref.pause();
    ref.src = "audios/reference.webm";

    // Prepare recorder
    stream = await navigator.mediaDevices.getUserMedia({audio: true});
    recorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
    recordedChunks = [];
    recorder.ondataavailable = event => recordedChunks.push(event.data);
    recorder.onstop = () => {
      if (!recordingCanceled) {
        // Allow user to listen to and upload resulting recording
        recording = new Blob(recordedChunks);
        [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = false);
        document.getElementById("uploader").classList.remove("disabled");
        replayBtn.disabled = false;
        replayBtn.hidden = false;
      }
      ref.controls = true;
      recordBtn.textContent = "Re-record";
    };

    // Do a 3.. 2.. 1.. dance
    recordBtn.textContent = "3.. 2.. 1..";
    recordBtn.disabled = true;
    tone.src = "audios/tone.webm";
    tone.play();
    for (i = 3; i > 0; i--) {
      if (i == 1) {
        tone.pause();
      }
      karaoke.classList.add("countdown");
      karaoke.textContent = i;
      await wait(1);
    }
    karaoke.textContent = "";
    karaoke.classList.remove("countdown");
    recordBtn.textContent = "Cancel recording";
    recordBtn.disabled = false;

    // Start recording and playback of reference file
    recorder.start(100);
    ref.controls = false;
    ref.play();
  }
});

replayBtn.addEventListener("click", () => {
  if (recordedAudio) {
    resetReplayBtn();
  }
  else {
    replayBtn.textContent = "Stop playback";
    recordedAudio = new Audio();
    recordedAudio.src = URL.createObjectURL(recording);
    recordedAudio.play();
    recordedAudio.addEventListener("ended", () => resetReplayBtn());
  }
});

ref.addEventListener("playing", () => resetReplayBtn());

ref.addEventListener("ended", () => {
  if (onAir) {
    onAir = false;
    stopRecording();
  }
});

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
