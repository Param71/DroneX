export class AudioSystem {
    constructor() {
        this.initialized = false;
    }

    initAudio() {
        if (this.initialized) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);

        // --- Motor System ---
        this.motorGain = this.ctx.createGain();
        this.motorGain.gain.value = 0;
        this.motorGain.connect(this.masterGain);

        this.osc1 = this.ctx.createOscillator();
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.value = 80;
        
        this.osc2 = this.ctx.createOscillator();
        this.osc2.type = 'square';
        this.osc2.frequency.value = 82; // Slightly detuned

        // Lowpass filter to make it sound more like a hum and less like a raw synth
        this.motorFilter = this.ctx.createBiquadFilter();
        this.motorFilter.type = 'lowpass';
        this.motorFilter.frequency.value = 1000;

        this.osc1.connect(this.motorFilter);
        this.osc2.connect(this.motorFilter);
        this.motorFilter.connect(this.motorGain);

        this.osc1.start();
        this.osc2.start();

        // --- Wind System ---
        // Create white noise buffer
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = noiseBuffer;
        this.windSource.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 1000;
        this.windFilter.Q.value = 0.5;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        
        this.windSource.start();

        this.initialized = true;
        
        // Start idle sound
        this.motorHum(0);
    }

    motorHum(throttle) {
        if (!this.initialized) return;
        
        // throttle is usually 0 to 1, or -1 to 1.
        const absThrottle = Math.abs(throttle);
        
        // Freq: 80Hz idle, 300Hz full
        const targetFreq = 80 + (absThrottle * 220);
        
        // Smooth transition
        this.osc1.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        this.osc2.frequency.setTargetAtTime(targetFreq * 1.02, this.ctx.currentTime, 0.1); // Detune
        
        // Increase cutoff frequency at high throttle
        this.motorFilter.frequency.setTargetAtTime(800 + (absThrottle * 1000), this.ctx.currentTime, 0.1);
        
        // Engine is always on, even at 0 throttle (idle)
        this.motorGain.gain.setTargetAtTime(0.3 + (absThrottle * 0.2), this.ctx.currentTime, 0.1);
    }

    windSound(speed) {
        if (!this.initialized) return;
        
        // Silent below 20, max at 80
        let normalizedSpeed = (speed - 20) / 60;
        if (normalizedSpeed < 0) normalizedSpeed = 0;
        if (normalizedSpeed > 1) normalizedSpeed = 1;
        
        // Set gain
        this.windGain.gain.setTargetAtTime(normalizedSpeed * 0.6, this.ctx.currentTime, 0.2);
        
        // Higher speed = higher pitch wind
        this.windFilter.frequency.setTargetAtTime(800 + (normalizedSpeed * 1200), this.ctx.currentTime, 0.2);
    }

    crashSound() {
        if (!this.initialized) return;
        
        const now = this.ctx.currentTime;
        
        // 1. Thud (Oscillator drop)
        const thudOsc = this.ctx.createOscillator();
        thudOsc.type = 'sine';
        const thudGain = this.ctx.createGain();
        
        thudOsc.connect(thudGain);
        thudGain.connect(this.masterGain);
        
        thudOsc.frequency.setValueAtTime(150, now);
        thudOsc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        thudGain.gain.setValueAtTime(1, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        thudOsc.start(now);
        thudOsc.stop(now + 0.5);
        
        // 2. Noise Burst
        const bufferSize = this.ctx.sampleRate * 0.3; 
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 2000;
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(this.masterGain);
        
        noiseSource.start(now);
    }

    missionCompleteChime(full = true) {
        if (!this.initialized) return;
        
        const now = this.ctx.currentTime;
        const notes = full ? [440, 554.37, 659.25] : [659.25]; // A4, C#5, E5 OR just E5
        
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.frequency.value = freq;
            
            const startTime = now + (i * 0.15);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            
            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });
    }

    missionFailSound() {
        if (!this.initialized) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 1.0);
        
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 1.0);
        
        osc.start(now);
        osc.stop(now + 1.1);
    }
}
