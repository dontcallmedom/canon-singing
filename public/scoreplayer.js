const recordBtn = document.getElementById('record');
const status = document.getElementById('status');
let oscillator = null;

/**
 * Prepare data for score playback:
 * 1. Load note frequencies file
 * 2. Load instrument wave form
 * 3. Load score to play
 * 4. Parse score to create a series of frequencies and durations
 */
async function prepare() {
  function parseDuration(duration) {
    if (!duration) {
      return 1;
    }
    const dotted = (duration.endsWith('.') ? 1.5 : 1);
    return dotted * 4 / parseInt(duration.split('.')[0], 10);
  }

  const frequencies = await fetch('frequencies.json').then(res => res.json());

  const wave = await fetch('organ.json').then(res => res.json());
  const c = wave.real.length;
  const real = new Float32Array(c);
  const imag = new Float32Array(c);
  for (let i = 0; i < c; i++) {
    real[i] = wave.real[i];
    imag[i] = wave.imag[i];
  }
  const instrument = { real, imag };
  
  const score = await fetch('score.json')
    .then(res => res.json())
    .then(score => score.join(' '))
    .then(score => score.split(' '))
    .then(notes => notes.map(note => {
      const tokens = note.split('-');
      return {
        note: tokens[0],
        frequency: frequencies[tokens[0]],
        duration: parseDuration(tokens[1])
      };
    }));

  return { score, instrument };
}


/**
 * Play the score, and record it to a local file if so requested
 *
 * Note: "bpm" stands for "beats per minute"
 */
function play(score, { bpm: bpm, record: record} = {bpm: 90, record: false}) {
  const tempo = 60 / bpm;

  // Create the oscillator
  const audioCtx = new window.AudioContext();
  const waveTable = audioCtx.createPeriodicWave(score.instrument.real, score.instrument.imag);
  oscillator = audioCtx.createOscillator();
  oscillator.setPeriodicWave(waveTable);
  oscillator.connect(audioCtx.destination);

  // Schedule the oscillator
  let time = audioCtx.currentTime;
  score.score.forEach(note => {
    oscillator.frequency.setValueAtTime(note.frequency, time);
    time += (note.duration * tempo) - 0.03;
    oscillator.frequency.setValueAtTime(0, time);
    time += 0.03;
  });

  // Prepare and start recorder if needed
  if (record) {
    const streamDestination = new window.MediaStreamAudioDestinationNode(audioCtx);

    const format = MediaRecorder.isTypeSupported('audio/webm') ? 'webm' : 'ogg';
    const recorder = new MediaRecorder(streamDestination.stream, { mimeType: `audio/${format}`});
    recorder.addEventListener('dataavailable', event => saveAs(event.data, `reference.${format}`));

    oscillator.connect(streamDestination);
    oscillator.addEventListener('ended', () => recorder.stop());
    recorder.start();
  }

  // Play the oscillator until the end of the score
  oscillator.start();
  oscillator.stop(time);
}

function stop() {
  oscillator.stop();
}


// Main loop: prepare things, then enable "Record" button,
// and start recording when button is pressed.
prepare().then(score => {
  status.textContent = "Ready to record";

  let recording = false;
  recordBtn.disabled = false;
  recordBtn.addEventListener('click', () => {
    if (recording) {
      recording = false;
      recordBtn.innerText = 'Recording';
      stop();
    }
    else {
      recording = true;
      recordBtn.innerText = 'Stop recording';
      play(score, { bpm: 90, record: true });
    }
  });
});