const segmentDuration = 6;
const startBtn = document.getElementById("start");
const status = document.getElementById("status");
const covers = document.getElementById("covers");
const songList = document.getElementById("songlist");
const langFilter = document.getElementById("lang");
const instrumentFilter = document.getElementById("instrument");
const nameFilter = document.getElementById("name");

startBtn.addEventListener("click", play);
let langs;

const voices = [];
const uifilter = x => true;

function highlightMatching(filter) {
  [...document.querySelectorAll("label.songselector")]
    .forEach(n => {
      if (!((filter.lang && filter.lang.length ? filter.lang.includes(n.dataset.lang)  : true) && (filter.name ? n.dataset.author.match(filter.name) : true))) {
        n.classList.add('lowlight')
      } else {
        n.classList.remove('lowlight')
      }
    });
}

function updateFilter() {
  const langFilter = [...document.querySelectorAll("#filter input[type='checkbox']")]
        .filter(n => n.checked).map(n => n.value);
  highlightMatching({lang: langFilter, name: nameFilter.value});
}

function buildFilter(recordings) {
  for (let id of Object.keys(recordings)) {
    const label = document.createElement("label");
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    const caption = document.createElement("figcaption");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.className = "songselector";
    img.src = "covers/" + id + ".png";
    img.alt = "";
    img.width = 48;
    label.appendChild(checkbox);
    caption.appendChild(document.createTextNode("by " + recordings[id].author + " in " + (langs[recordings[id].lang] ? langs[recordings[id].lang].name : recordings[id].lang)));
    fig.appendChild(img);
    fig.appendChild(caption);
    label.appendChild(fig);
    label.className = "songselector";
    songList.querySelector("div").appendChild(label);
    label.dataset.lang = recordings[id].lang;
    label.dataset.author = recordings[id].author;
  }

  const langsInUse = [...new Set(Object.values(recordings)
                             .map(r => r.lang)
                                 .filter(l => Object.keys(langs).includes(l)))];
  let hasInstruments = false;
  for (let l of [...new Set(Object.values(recordings).map(r => r.lang))]) {
    const inUse = Object.values(recordings).filter(r => r.lang === l).length;
    const label = document.createElement("label");
    if (l in langs) {
      label.textContent = langs[l].name + ` (${inUse})`;
      langFilter.appendChild(label);
    } else {
      hasInstruments = true;
      label.textContent = l  + ` (${inUse})`;
      instrumentFilter.appendChild(label);
    }
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = l;
    checkbox.addEventListener("change", updateFilter);
    label.prepend(checkbox);

  }
  if (!hasInstruments) {
    instrumentFilter.style = "display: none";
  }
  nameFilter.addEventListener("input", updateFilter);
}

fetch("lang.json")
  .then(r => r.json())
  .then(d => { langs = d;
               return fetch("recording.json"); })
  .then(r => r.json())
  .then(recordings => {
    buildFilter(recordings);
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
        document.getElementById(source).checked = true;
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
        img.alt = "";
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
