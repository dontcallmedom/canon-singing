import AudioRecorder from './lib/audio-recorder-polyfill/index.js';
import mpegEncoder from './lib/audio-recorder-polyfill/mpeg-encoder/index.js';

AudioRecorder.encoder = mpegEncoder;
AudioRecorder.prototype.mimeType = 'audio/mpeg';
window.MediaRecorder = AudioRecorder;

export default function() {};
