/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Analyser class for live audio visualisation.
 */
export class Analyser {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;

  constructor(node: AudioNode) {
    this.analyser = node.context.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = 0.85;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    node.connect(this.analyser);
  }

  update() {
    this.analyser.getByteFrequencyData(this.dataArray);
  }

  get bufferLength(): number {
    return this.analyser.frequencyBinCount;
  }

  get data(): Uint8Array {
    return this.dataArray;
  }
}