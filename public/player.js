const segmentDuration = 6;
const songDuration = 4 * segmentDuration;
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const stopBtn = document.getElementById("stop");
const covers = document.getElementById("covers");
const songList = document.getElementById("songlist");
const langFilter = document.getElementById("lang");
const instrumentFilter = document.getElementById("instrument");
const segmentClasses = ["segment1", "segment2", "segment3", "segment4"];
const segmentPositions = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

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
let autoSuspended = false;

let readyResolve = null;
const ready = new Promise(resolve => readyResolve = resolve);

const toggleInput = (el, set) => {
  if (el.checked && set) return;
  if (!set && !el.checked) return;
  el.checked = set;
  el.dispatchEvent(new Event("change"));
};

const shuffle = array => {
  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * i)
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array;
};


function buildSongList(recordings, group) {
  const EXPANDER_THRESHOLD = 10;
  const expandGroup = document.createElement("div");
  const expandToggle = document.createElement("input");
  expandToggle.type = "checkbox";
  expandToggle.id = "songlist-expand-" + group.id;
  expandToggle.className = "songlist-expand";
  expandToggle.checked = Object.keys(recordings).length < EXPANDER_THRESHOLD;
  const div = document.createElement("fieldset");
  div.className = "songlist-thumbs";
  const p = document.createElement("legend");
  const groupName = document.createElement("span");
  groupName.className = "group-label";
  const btnGroup = document.createElement("span");
  const allBtn = document.createElement("button");
  allBtn.textContent = "Add all to playlist";
  allBtn.setAttribute("aria-label", "Add all recordings in " + group.name + " to playlist")
  allBtn.addEventListener("click", () => {
    [...expandGroup.querySelectorAll("input.songselector")]
      .forEach(n => toggleInput(n, true))
  });
  const noneBtn = document.createElement("button");
  noneBtn.textContent = "Remove all from playlist";
  noneBtn.addEventListener("click", () => {
    [...expandGroup.querySelectorAll("input.songselector")]
      .forEach(n => toggleInput(n, false))
  });
  allBtn.setAttribute("aria-label", "Remove all recordings in " + group.name + " from playlist")
  groupName.textContent = group.name;
  p.appendChild(groupName);
  btnGroup.appendChild(allBtn);
  btnGroup.appendChild(noneBtn);
  p.appendChild(btnGroup);
  div.appendChild(p);
  if (Object.keys(recordings).length > EXPANDER_THRESHOLD) {
    const expander = document.createElement("label");
    expander.setAttribute("for", "songlist-expand-" + group.id);
    expander.className = "songlist-expander";
    div.appendChild(expander);
  }
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
    label.dataset.lang = recordings[id].lang;
    label.dataset.author = recordings[id].author;

    checkbox.addEventListener("change", toggleSource);
    div.appendChild(label);
  }

  expandGroup.appendChild(expandToggle);
  expandGroup.appendChild(div);
  return expandGroup;
}

function buildFilter(recordings) {

  const langsInUse = [...new Set(Object.values(recordings)
                             .map(r => r.lang)
                                 .filter(l => Object.keys(langs).includes(l)))];
  let hasInstruments = false;
  for (let l of [...new Set(Object.values(recordings).map(r => r.lang))]) {
    const recordingGroup = Object.keys(recordings).filter(k => recordings[k].lang === l).reduce((a, b) => { a[b] = recordings[b]; return a;}, {});
    if (l in langs) {
      langFilter.appendChild(buildSongList(recordingGroup, {id:l, name: langs[l].name}));
    } else {
      hasInstruments = true;
      instrumentFilter.appendChild(buildSongList(recordingGroup, {id:l, name: l}));
    }
  }
  if (!hasInstruments) {
    instrumentFilter.style = "display: none";
  }
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

  const muteToggleLabel = document.createElement("label");
  muteToggleLabel.id = "cover-" + id;
  muteToggleLabel.setAttribute("aria-label", "Mute/Unmute recording by " + document.getElementById(id).dataset.author);
  const muteToggleIcon = document.createElement("span");
  muteToggleIcon.textContent = "🔊";
  const muteToggle = document.createElement("input");
  // 🔇 🔊
  muteToggle.id = "mute-" + id;
  muteToggle.type = "checkbox";
  muteToggle.className = "mute-toggle";
  muteToggle.addEventListener("change", () => {
    event.target.parentNode.querySelector("span").textContent = event.target.checked ? "🔇" : "🔊";
    refreshAudioSources();
  });
  const img = document.createElement("img");
  img.id = "singer-" + id;
  img.alt = "";
  img.src = "covers/" + id + ".png";
  img.width = 128;
  muteToggleLabel.appendChild(muteToggleIcon);
  muteToggleLabel.appendChild(muteToggle);
  muteToggleLabel.appendChild(img);
  covers.appendChild(muteToggleLabel);

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

  const cover = document.getElementById("cover-" + id);
  cover.remove();
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
async function refreshAudioSources({ reset } = { reset: false }) {
  if (getNbSelectedAndFetchedSources() === 0) {
    await audioContext.suspend();
    autoSuspended = true;
    startTime = audioContext.currentTime;
  }

  // Compute current segment (from 0 to 3)
  const currentSegment = Math.floor((audioContext.currentTime - startTime) / segmentDuration);

  // Remove sources that should no longer be there
  Object.keys(audioSources).filter(id => audioSources[id]).forEach(id => {
    if (reset || !selectedSources[id]) {
      audioSources[id].nodes.forEach(node => node.disconnect());
      audioSources[id].gainNode.disconnect();
      audioSources[id].pannerNode.disconnect();
      audioSources[id] = null;
    }
  });

  // Schedule sources that should be added
  Object.keys(selectedSources).filter(id => selectedSources[id] && fetchedSources[id]).forEach(id => {
    if (!audioSources[id]) {
      audioSources[id] = {
        segment: chooseSegment(),
        nodes: [],
        gainNode: audioContext.createGain(),
        pannerNode: audioContext.createPanner()
      };
      const panner = audioSources[id].pannerNode;
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 10000;
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 0;
      panner.coneOuterGain = 0;
      panner.setPosition(segmentPositions[audioSources[id].segment][0], segmentPositions[audioSources[id].segment][1], 0);
      for (let c of segmentClasses) {
        if (document.getElementById("singer-" +id)) {
          document.getElementById("singer-" +id).classList.remove(c);
        }
      }
      if (document.getElementById("singer-" +id)) {
        document.getElementById("singer-" + id).classList.add(segmentClasses[audioSources[id].segment]);
      }

      let playSegment = currentSegment + Math.abs(audioSources[id].segment - (currentSegment % 4));
      let playTime = startTime + playSegment * segmentDuration;
      if (playTime < audioContext.currentTime) {
        playTime += songDuration;
      }

      // To account for possible divergences in recording durations, the code
      // cannot simply rely on the "loop" mechanism of the Web Audio API.
      // Instead, it needs to re-create buffer source nodes on a recurring
      // basis. We use 2 alternating instances, because the "ended" event will
      // likely fire too late to restart a new node immediately
      function schedulePlayback(playTime) {
        const node = audioContext.createBufferSource();
        audioSources[id].nodes.push(node);
        node.buffer = fetchedSources[id];
        node.start(playTime, 0, songDuration);
        node.stop(playTime + songDuration);
        node.connect(audioSources[id].pannerNode);
        node.addEventListener("ended", () => {
          node.disconnect();
          audioSources[id].nodes = audioSources[id].nodes.filter(n => n !== node);
          schedulePlayback(playTime + 2 * songDuration);
        });
      }
      schedulePlayback(playTime);
      schedulePlayback(playTime + songDuration);
      
      audioSources[id].pannerNode.connect(audioSources[id].gainNode);
      audioSources[id].gainNode.connect(audioContext.destination);
    }
  });

  // Muting / unmuting
  Object.keys(selectedSources).filter(id => audioSources[id]).forEach(id => {
    if (document.getElementById("mute-" + id) && document.getElementById("mute-" + id).checked) {
      audioSources[id].gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    } else {
      audioSources[id].gainNode.gain.setValueAtTime(1 , audioContext.currentTime);
    }
  });

  if (autoSuspended && (getNbSelectedAndFetchedSources() > 0)) {
    audioContext.resume();
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
  return Object.keys(selectedSources).filter(id => selectedSources[id] && fetchedSources[id]).length;
}


fetch("lang.json")
  .then(r => r.json())
  .then(d => { langs = d;
               return fetch("recording.json"); })
  .then(r => r.json())
  .then(recordings => {
    buildFilter(recordings);
    buildRandomPicker(recordings);
    // Pick sources randomly
    const sources = Object.keys(recordings);
    if (sources.length === 0) {
      //status.textContent = "No matching recording found";
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
      startBtn.textContent = "⏵︎";
      startBtn.disabled = false;
    });
  });


function play() {
  if (getNbSelectedAndFetchedSources() > 0) {
    audioContext.resume();
  }
  else {
    autoSuspended = true;
  }
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  document.getElementById("covers").classList.add("playing");
  document.getElementById("covers").classList.remove("paused");
}

function pause() {
  audioContext.suspend();
  autoSuspended = false;
  pauseBtn.disabled = true;
  document.getElementById("covers").classList.add("paused");
}


function stop() {
  audioContext.suspend()
    .then(() => startTime = audioContext.currentTime)
    .then(() => refreshAudioSources({ reset: true }));
  autoSuspended = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  document.getElementById("covers").classList.remove("playing");
}


function buildRandomPicker(recordings) {
  const picker = document.getElementById("random");
  if (Object.keys(recordings).length < 4) {
    picker.remove();
    return
  }
  picker.disabled = false;
  picker.addEventListener("click", () => {
    const pick = shuffle(Object.keys(recordings)).slice(0, 4);
    console.log(pick);
    [...document.querySelectorAll("input.songselector")]
      .forEach(n => toggleInput(n, false));
    [...document.querySelectorAll("input.songselector")]
      .filter(n => pick.includes(n.id))
      .forEach(n => toggleInput(n, true));
  });
}
