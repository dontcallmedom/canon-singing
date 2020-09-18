const segmentDuration = 6;
const startBtn = document.getElementById("start");
const status = document.getElementById("status");
const covers = document.getElementById("covers");

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
      let pick = Math.floor(Math.random()*sources.length);
      const source = sources[pick];
      if (source) {
        const a = new Audio();
        readyPromises.push(new Promise(res =>
                                       a.addEventListener("canplaythrough", () => res())
                                      ));
        a.src = "audios/" + source + ".mp3";
        a.loop = true;
        a.dataset["author"] = recordings[source].author;
        a.dataset["lang"] = recordings[source].lang;
        voices.push(a);
        const img = document.createElement("img");
        img.alt = "Avatar for record " + source;
        img.src = "covers/" + source + ".png";
        img.width = 128;
        covers.appendChild(img);
      } else {
        const clone = voices[i - sources.length].cloneNode(true);
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
