const segmentDuration = 5.5;
const startBtn = document.getElementById("start");
const status = document.getElementById("status");

startBtn.addEventListener("click", play);

const voices = [];
const uifilter = x => true;

fetch("recording.json").then(r => r.json())
  .then(recordings => {
    const sources = Object.keys(recordings).filter(k => uifilter(recordings[k]));
    if (sources.length === 0) {
      status.textContent = "No matching recording found";
      return;
    }
    if (sources.length < 4) {
      for (let i = sources.length ; i < 4; i++) {
        sources.push(sources[sources.length - i]);
      }
    }
    const readyPromises = [];
    for (let i = 0 ; i <4; i++) {
      if (sources[i]) {
        const a = new Audio();
        readyPromises.push(new Promise(res =>
                                       a.addEventListener("canplaythrough", () => res())
                                      ));
        a.src = "audios/" + sources[i] + ".mp3";
        a.loop = true;
        a.dataset["author"] = recordings[sources[i]].author;
        a.dataset["lang"] = recordings[sources[i]].lang;
        voices.push(a);
      } else {
        const clone = audioElements[i - sources.length].cloneNode(true);
        voices.push(clone);
      }
    }
    Promise.all(readyPromises).then(() => {
      status.textContent = "Ready!";
      startBtn.disabled = false;
    });
  });


function play() {
  if (startBtn.textContent === "Start") {
    for (let i = 0 ; i < 4 ; i++) {
      setTimeout((n => () => voices[n].play())(i), i* segmentDuration* 1000);
      startBtn.textContent = "Pause";
    }
  } else if (startBtn.textContent === "Pause") {
    for (let i = 0 ; i < 4 ; i++) {
      voices[i].pause();
    }
    startBtn.textContent = "Restart";
  } else if (startBtn.textContent === "Restart") {
    for (let i = 0 ; i < 4 ; i++) {
      voices[i].play();
    }
    startBtn.textContent = "Pause";
  }
}
