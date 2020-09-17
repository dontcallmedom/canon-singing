const recordBtn = document.getElementById('record');
const status = document.getElementById('status');
const transposeInput = document.getElementById('transpose');
const tempoInput = document.getElementById('tempo');

let oscillator = null;
let frequencies = null;
let instrument = null;

/**
 * Modulo function that always returns a positive number
 */
function mod(nb, n) {
  return ((nb % n) + n) % n;
}


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

  frequencies = await fetch('frequencies.json').then(res => res.json());

  const wave = await fetch('organ.json').then(res => res.json());
  const c = wave.real.length;
  const real = new Float32Array(c);
  const imag = new Float32Array(c);
  for (let i = 0; i < c; i++) {
    real[i] = wave.real[i];
    imag[i] = wave.imag[i];
  }
  instrument = { real, imag };
  
  const score = await fetch('score.json')
    .then(res => res.json())
    .then(score => score.join(' '))
    .then(score => score.split(' '))
    .then(notes => notes.map(note => {
      const tokens = note.split('-');
      return {
        note: tokens[0].substr(0, tokens[0].length - 1),
        octave: parseInt(tokens[0].substr(-1), 10),
        duration: parseDuration(tokens[1])
      };
    }));

  return score;
}


function transposeScore(score, steps) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const equiv = {
    'Db': 'C#',
    'Eb': 'D#',
    'Gb': 'F#',
    'Ab': 'G#',
    'Bb': 'A#'
  };
  const nbOctaves = steps < 0 ? Math.ceil(steps / 12) : Math.floor(steps / 12);

  return score.map(note => {
    const normalized = notes.includes(note.note) ? note.note : equiv[note.note];
    const notePos = notes.findIndex(note => note === normalized);
    const newPos = mod(notePos + steps, notes.length);
    const newNote = notes[newPos];
    let newOctave = note.octave + nbOctaves;
    if ((steps < 0) && (newPos > notePos)) {
      newOctave -= 1;
    }
    else if ((steps > 0) && (newPos < notePos)) {
      newOctave += 1;
    }
    return {
      note: newNote,
      octave: newOctave,
      duration: note.duration
    };
  });
}



/**
 * Play the score, and record it to a local file if so requested
 *
 * Note: "bpm" stands for "beats per minute"
 */
function play(score, {bpm, record, transpose} = {bpm: 90, record: false, transpose: 0}) {
  const tempo = 60 / bpm;

  // Create the oscillator
  const audioCtx = new window.AudioContext();
  const waveTable = audioCtx.createPeriodicWave(instrument.real, instrument.imag);
  oscillator = audioCtx.createOscillator();
  oscillator.setPeriodicWave(waveTable);
  oscillator.connect(audioCtx.destination);

  // Transpose music if needed
  const transposed = transposeScore(score, transpose);

  // Schedule the oscillator
  let time = audioCtx.currentTime;
  transposed.forEach(note => {
    oscillator.frequency.setValueAtTime(frequencies[`${note.note}${note.octave}`], time);
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

      const transpose = parseInt(transposeInput.value, 10);
      const bpm = parseInt(tempoInput.value, 10);
      play(score, { bpm, transpose, record: true });
    }
  });
});