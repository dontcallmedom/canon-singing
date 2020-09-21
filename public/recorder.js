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
let stream;

const tone = new Audio("audios/tone.webm");
tone.loop = true;

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
    if (lang === preferedLanguage) {
      opt.selected = true;
    }
    if (lyrics[lang]) {
      const opt2 = opt.cloneNode(true);
      if (lang === preferedLanguage) {
        opt2.selected = true;
      }
      langSelector.querySelector("optgroup").appendChild(opt2);
    }
    uploadLangSelector.querySelector("optgroup").appendChild(opt);
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

recordBtn.addEventListener("click", async () => {
  recordBtn.disabled = true;
  replayBtn.disabled = true;
  [...form.querySelectorAll("input,button,select")].forEach(n => n.disabled = true);
  ref.pause();
  ref.currentTime = 0;
  stream = await navigator.mediaDevices.getUserMedia({audio: true});
  recorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
  recordedChunks = [];
  recorder.ondataavailable = event => recordedChunks.push(event.data);
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
  ref.controls = false;
  recorder.start(100);
  ref.currentTime = 0;
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
    document.getElementById("uploader").classList.remove("disabled");
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
