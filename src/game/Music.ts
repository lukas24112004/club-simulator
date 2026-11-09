// Generated house music (Tone.js): free, no downloads. The lights read `beats` and `pulse` so they hit on the kick.
// Tone is loaded only after the first click (browsers need a click before they allow sound).

export const BPM = 124;

export class Music {
  muted = false;
  started = false;
  private tone: typeof import('tone') | null = null;
  private t0 = performance.now() / 1000;

  /** Position in the song, counted in beats. Runs even before the music starts so the lights are alive. */
  get beats(): number {
    const seconds = this.tone ? this.tone.getTransport().seconds : performance.now() / 1000 - this.t0;
    return (seconds * BPM) / 60;
  }

  /** 1 on the kick, fading quickly to 0. */
  get pulse(): number {
    return Math.exp(-(this.beats % 1) * 5);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      const Tone = await import('tone');
      await Tone.start();
      this.tone = Tone;
      const transport = Tone.getTransport();
      transport.bpm.value = BPM;
      Tone.getDestination().volume.value = -8;

      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
      }).toDestination();
      const hatFilter = new Tone.Filter(7000, 'highpass').toDestination();
      const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hatFilter);
      hat.volume.value = -18;
      const bass = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1 },
        filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, baseFrequency: 120, octaves: 3 },
      }).toDestination();
      bass.volume.value = -12;
      const lead = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
      }).toDestination();
      lead.volume.value = -22;

      const bassNotes = ['A1', 'A1', 'C2', 'G1'];
      const arp = ['A3', 'C4', 'E4', 'C4', 'A3', 'E4', 'G3', 'D4'];
      let step = 0;
      new Tone.Loop((time) => {
        const s = step % 16;
        const bar = Math.floor(step / 16) % 4;
        if (s % 4 === 0) kick.triggerAttackRelease('C1', '8n', time);
        if (s % 4 === 2) {
          hat.triggerAttackRelease('16n', time);
          bass.triggerAttackRelease(bassNotes[bar], '8n', time);
        }
        if (bar >= 2 && s % 2 === 0) lead.triggerAttackRelease(arp[(s / 2) % 8], '16n', time, 0.4);
        step++;
      }, '16n').start(0);
      transport.start();
    } catch {
      this.tone = null; // no audio available: the club still looks alive
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.tone) this.tone.getDestination().mute = this.muted;
    return this.muted;
  }
}
