const segmentDuration = 6;
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const stopBtn = document.getElementById("stop");
const status = document.getElementById("status");
const covers = document.getElementById("covers");
const songList = document.getElementById("songlist");
const langFilter = document.getElementById("lang");
const instrumentFilter = document.getElementById("instrument");
const nameFilter = document.getElementById("name");

startBtn.addEventListener("click", play);
pauseBtn.addEventListener("click", pause);
stopBtn.addEventListener("click", stop);

let langs;

let startTime = 0;
const audioContext = new window.AudioContext();
audioContext.suspend().then(() => startTime = audioContext.currentTime);

const pendingSources = {};
const fetchedSources = {};
const selectedSources = {};
const audioSources = {};

let readyResolve = null;
const ready = new Promise(resolve => readyResolve = resolve);

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
    checkbox.addEventListener("change", toggleSource);
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


/**
 * Fetch music data for the given source, and refresh the audio scheduling
 * once data has been fetched
 */
async function fetchSource(id) {
  if (pendingSources[id]) {
    return;
  }
  pendingSources[id] = true;

  try {
    const buffer = await fetch(`audios/${id}.mp3`).then(r => r.arrayBuffer());
    fetchedSources[id] = await audioContext.decodeAudioData(buffer);

    // Ready to play as soon as we have one media segment
    if (readyResolve) {
      readyResolve();
      readyResolve = null;
    }
  }
  catch (err) {
    console.warn('could not fetch or decode source', id, err);
  }
  finally {
    pendingSources[id] = false;
    refreshAudioSources();
  }
}


/**
 * Event handler to toggle source between selected/unselected
 */
function toggleSource(event) {
  const id = event.target.id;
  const selected = event.target.checked;
  if (selected) {
    selectSource(id);
  }
  else {
    unselectSource(id);
  }
}


/**
 * Add the given source to the list of selected voices, and start playing it
 * as soon as possible. Return true if source was added to the list, false if
 * it was already in the list.
 */
function selectSource(id) {
  if (selectedSources[id]) {
    return false;
  }
  selectedSources[id] = true;
  if (fetchedSources[id]) {
    refreshAudioSources();
  }
  else {
    fetchSource(id);
  }

  const img = document.createElement("img");
  img.id = "singer-" + id;
  img.alt = "";
  img.src = "covers/" + id + ".png";
  img.width = 128;
  covers.appendChild(img);

  return true;
}


/**
 * Remove the given source from the list of selected voices, and stop playing
 * it immediately
 */
function unselectSource(id) {
  if (!selectedSources[id]) {
    return;
  }
  selectedSources[id] = false;
  refreshAudioSources();

  const img = document.getElementById("singer-" + id);
  img.parentNode.removeChild(img);
}


/**
 * Choose the segment at which a new voice should start
 *
 * TODO: take the id as parameter and group voices per language / instrument
 */
function chooseSegment() {
  const distribution = [0, 0, 0, 0];
  Object.keys(audioSources).filter(id => audioSources[id]).forEach(id => {
    distribution[audioSources[id].segment] += 1;
  });

  // Fill in the order 0, 2, 1, 3 coz' that sounds better
  const min = Math.min(...distribution);
  if (distribution[0] === min) {
    return 0;
  }
  else if (distribution[2] === min) {
    return 2;
  }
  else if (distribution[1] === min) {
    return 1;
  }
  else {
    return 3;
  }
}


/**
 * Refresh the list of voices that are currently being scheduled for audio
 * playback based on the list of selected voices and available data
 */
function refreshAudioSources({ reset } = { reset: false }) {
  // Compute current segment (from 0 to 3)
  const currentSegment = audioContext.suspended ?
    0 :
    Math.floor((audioContext.currentTime - startTime) / segmentDuration);

  if (getNbSelectedAndFetchedSources() === 0) {
    audioContext.suspend().then(() => startTime = audioContext.currentTime);
  }
  else {
    // Remove sources that should no longer be there
    Object.keys(audioSources).filter(id => audioSources[id]).forEach(id => {
      if (reset || !selectedSources[id]) {
        audioSources[id].node.stop();
        audioSources[id].node.disconnect();
        audioSources[id] = null;
      }
    });

    // Schedule sources that should be added
    Object.keys(selectedSources).filter(id => selectedSources[id] && fetchedSources[id]).forEach(id => {
      if (!audioSources[id]) {
        audioSources[id] = {
          segment: chooseSegment(),
          node: audioContext.createBufferSource()
        };
        const playSegment = currentSegment + Math.abs(audioSources[id].segment - (currentSegment % 4));
        audioSources[id].node.buffer = fetchedSources[id];
        audioSources[id].node.loop = true;
        audioSources[id].node.start(startTime + playSegment * segmentDuration);
        audioSources[id].node.connect(audioContext.destination);
      }
    });
    if (audioContext.suspended) {
      audioContext.resume();
    }
  }
}


/**
 * Return the current number of selected sources
 */
function getNbSelectedSources() {
  return Object.keys(selectedSources).filter(id => selectedSources[id]).length;
}


/**
 * Return the current number of selected sources that can be played
 */
function getNbSelectedAndFetchedSources() {
  return Object.keys(selectedSources).filter(id => selectedSources[id] && fetchedSources[id]);
}


fetch("lang.json")
  .then(r => r.json())
  .then(d => { langs = d;
               return fetch("recording.json"); })
  .then(r => r.json())
  .then(recordings => {
    buildFilter(recordings);

    // Pick sources randomly
    const sources = Object.keys(recordings);
    if (sources.length === 0) {
      status.textContent = "No matching recording found";
      return;
    }

    // Note while loop will eventually stop even if there aren't many different
    // sources to choose from because random pick should eventually cover all
    // of them
    const nbSources = Math.min(4, sources.length);
    while (getNbSelectedSources() < nbSources) {
      const pick = Math.floor(Math.random() * sources.length);
      if (selectSource(sources[pick])) {
        document.getElementById(sources[pick]).checked = true;
      }
    }

    ready.then(() => {
      status.textContent = "Ready!";
      startBtn.disabled = false;
    });
  });


function play() {
  audioContext.resume();
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
}


function pause() {
  audioContext.suspend();
  pauseBtn.disabled = true;
}


function stop() {
  audioContext.suspend()
    .then(() => startTime = audioContext.currentTime)
    .then(() => refreshAudioSources({ reset: true }));
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
}