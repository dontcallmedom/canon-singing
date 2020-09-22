async function normalize(file) {
  const context = new window.AudioContext;

  const buffer = await fetch(file).then(res => res.arrayBuffer());
  const decodedBuffer = await context.decodeAudioData(buffer);
  const source = context.createBufferSource();
  source.buffer = decodedBuffer;

  const analyser = context.createAnalyser();

  const gain = context.createGain();
  gain.gain.value = 0.1;

  source.connect(analyser);
  analyser.connect(gain);
  gain.connect(context.destination);

  analyser.fftSize = 2048;
  const sampleBuffer = new Float32Array(analyser.fftSize);

  let max = -Infinity;
  let stopped = false;
  function loop() {
    analyser.getFloatFrequencyData(sampleBuffer);

    // Compute max value
    for (let i = 0; i < sampleBuffer.length; i++) {
      const val = sampleBuffer[i];
      const absval = val > 0 ? val : 0 - val;
      max = Math.max(max, val);
    }

    if (!stopped) {
      requestAnimationFrame(loop);
    }
  }
  loop();

  source.start(0);

  document.getElementById('stop').addEventListener('click', () => {
    source.stop();
    stopped = true;
    console.log(max);
  });
}

normalize('frere-jacques.mp3');
