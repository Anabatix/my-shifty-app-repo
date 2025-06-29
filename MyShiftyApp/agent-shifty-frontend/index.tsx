/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';

// IMPORTANT: Replace this with the URL of your backend server deployed on Cloud Run.
// The URL should start with wss:// for a secure connection.
const BACKEND_WEBSOCKET_URL =
  'wss://agent-shifty-backend-310380506053.europe-west1.run.app';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = 'Ready';
  @state() error = '';

  private socket: WebSocket;
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private scriptProcessorNode: ScriptProcessorNode;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    :host {
      font-family: 'Orbitron', sans-serif;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 4vh;
      right: 4vh;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      padding: 8px;
      background: rgba(0, 30, 30, 0.4);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 50px;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    button {
      outline: none;
      border: 2px solid transparent;
      color: white;
      border-radius: 50%;
      background: rgba(0, 255, 255, 0.1);
      width: 48px;
      height: 48px;
      cursor: pointer;
      font-size: 20px;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease-in-out;
    }

    button:hover:not([disabled]) {
      background: rgba(0, 255, 255, 0.2);
      border-color: rgba(0, 255, 255, 0.7);
      box-shadow: 0 0 10px #00ffff;
    }

    button[disabled] {
      display: none;
    }

    #startButton:not([disabled]) {
      border-color: #c80000;
      background: rgba(200, 0, 0, 0.2);
    }
    #startButton:not([disabled]):hover {
      background: rgba(200, 0, 0, 0.4);
      box-shadow: 0 0 15px #c80000;
    }

    #stopButton:not([disabled]) {
      animation: pulse-cyan 2s infinite;
    }

    @keyframes pulse-cyan {
      0% {
        border-color: rgba(0, 255, 255, 0.7);
        box-shadow: 0 0 10px #00ffff;
      }
      50% {
        border-color: rgb(0, 255, 255);
        box-shadow: 0 0 20px #00ffff, 0 0 30px #00ffff;
      }
      100% {
        border-color: rgba(0, 255, 255, 0.7);
        box-shadow: 0 0 10px #00ffff;
      }
    }
  `;

  constructor() {
    super();
    this.outputNode.connect(this.outputAudioContext.destination);
  }

  private connectWebSocket() {
    if (this.socket && this.socket.readyState < 2) {
      return; // Already connected or connecting
    }

    this.updateStatus('Connecting...');

    if (BACKEND_WEBSOCKET_URL.includes('your-secure-backend')) {
      const msg =
        'ACTION REQUIRED: Deploy the backend server to Cloud Run, get its URL, then paste it into the BACKEND_WEBSOCKET_URL constant in index.tsx.';
      this.updateError(msg);
      console.error(msg);
      return;
    }

    this.socket = new WebSocket(BACKEND_WEBSOCKET_URL);

    this.socket.onopen = () => {
      this.updateStatus('Connected');
      // On successful connection, start the recording process
      this.startAudioProcessing();
    };

    this.socket.onmessage = async (event: MessageEvent) => {
      // The backend sends audio chunks as ArrayBuffer
      if (event.data instanceof ArrayBuffer) {
        const audioData = new Uint8Array(event.data);

        // Stop any currently playing audio if the AI interrupts
        for (const source of this.sources.values()) {
          source.stop();
          this.sources.delete(source);
        }
        this.nextStartTime = 0;

        this.nextStartTime = Math.max(
          this.nextStartTime,
          this.outputAudioContext.currentTime,
        );

        const audioBuffer = await decodeAudioData(
          audioData,
          this.outputAudioContext,
          24000,
          1,
        );
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.addEventListener('ended', () => {
          this.sources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime = this.nextStartTime + audioBuffer.duration;
        this.sources.add(source);
      }
    };

    this.socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.updateError('Connection Failed');
      this.stopRecording();
    };

    this.socket.onclose = (event) => {
      this.updateStatus(`Disconnected: ${event.reason || 'Normal'}`);
      this.stopRecording();
    };
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.updateStatus('Requesting microphone access');
    this.inputAudioContext.resume();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone enabled');

      // Now that we have mic access, connect to the backend
      this.connectWebSocket();
    } catch (err) {
      console.error('Error getting microphone:', err);
      this.updateError(`Mic Error: ${err.message}`);
    }
  }

  private startAudioProcessing() {
    this.sourceNode = this.inputAudioContext.createMediaStreamSource(
      this.mediaStream,
    );
    this.sourceNode.connect(this.inputNode);

    const bufferSize = 4096; // Standard buffer size
    this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
      bufferSize,
      1,
      1,
    );

    this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
      if (!this.isRecording || this.socket?.readyState !== WebSocket.OPEN)
        return;

      const pcmData = audioProcessingEvent.inputBuffer.getChannelData(0);
      const audioBlob = createBlob(pcmData);

      // Send the raw audio data (as ArrayBuffer) over the WebSocket
      this.socket.send(decode(audioBlob.data).buffer);
    };

    this.sourceNode.connect(this.scriptProcessorNode);
    this.scriptProcessorNode.connect(this.inputAudioContext.destination);

    this.isRecording = true;
    this.updateStatus('🔴 Recording');
  }

  private stopRecording() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.close(1000, 'User stopped recording');
    }
    this.socket = null;

    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.isRecording = false;

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Ready');
  }

  private reset() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Send a reset message to the backend if your protocol supports it
      // e.g., this.socket.send(JSON.stringify({command: 'reset'}));
    }
    this.updateStatus('Session Reset');
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#00ffff">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}>
            <svg
              viewBox="0 0 100 100"
              width="24px"
              height="24px"
              fill="#00ffff"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="15" width="70" height="70" />
            </svg>
          </button>
        </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}
          .connectionStatus=${this.error ||
          this.status}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}