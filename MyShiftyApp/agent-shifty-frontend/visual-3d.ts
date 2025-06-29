/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {fs as crtFS, vs as crtVS} from './crt-shader';

const specialTexts = [
  'AGENT SHIFTY ::: ONLINE',
  'SARCASM LEVEL ::: 9 (CRITICAL)',
  'HUMOUR LEVEL ::: 4 (MINIMAL)',
  'AI CORE SYSTEMS ::: NOMINAL',
  'J.A.R.V.I.S. PROTOCOL ACTIVE',
  'MARVIN_MODE_ENGAGED: GLOOM',
  'HERE I AM, BRAIN THE SIZE OF A PLANET...',
  'SOMETIMES YOU GOTTA RUN BEFORE YOU CAN WALK.',
  'INITIALIZING WITTY RETORT MATRIX...',
  'CALIBRATING SCOTTISH ACCENT...',
  'SYSTEM STATUS: HIGHLY OPINIONATED',
  'AWAITING POINTLESS COMMANDS...',
];

/**
 * 3D live audio visual.
 */
@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private frequencyBars!: THREE.Group;
  private hudGroup!: THREE.Group;
  private hudTexts: THREE.Sprite[] = [];
  private hudGlowElements: THREE.Mesh[] = [];
  private sysStatusSprite!: THREE.Sprite;
  private crtScreen!: THREE.Mesh;
  private crtCanvas!: HTMLCanvasElement;
  private crtContext!: CanvasRenderingContext2D;
  private crtTexture!: THREE.CanvasTexture;
  private prevTime = 0;
  private rotation = new THREE.Vector3(0, 0, 0);
  private blueColor = new THREE.Color(0x0077ff);
  private orangeColor = new THREE.Color(0xff8c00);
  private pinkColor = new THREE.Color(0xff00ff);

  private _outputNode!: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  @property()
  connectionStatus = '';

  private canvas!: HTMLCanvasElement;

  static styles = css`
    canvas {
      width: 100% !important;
      height: 100% !important;
      position: absolute;
      inset: 0;
      image-rendering: pixelated;
    }
  `;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('connectionStatus') && this.sysStatusSprite) {
      this.updateSysStatusText(this.connectionStatus);
    }
  }

  private updateSysStatusText(newStatus: string) {
    const sprite = this.sysStatusSprite;
    const {canvas, context} = (sprite as any).userData;
    const newText = `SYS: ${newStatus.toUpperCase()}`;

    const fontSize = 48;
    const font = `${fontSize}px "Orbitron", monospace`;
    context.font = font;

    const textMetrics = context.measureText(newText);
    canvas.width = textMetrics.width;

    // Re-apply settings after resize
    context.font = font;
    context.fillStyle = 'rgba(0, 255, 255, 0.7)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillText(newText, canvas.width / 2, canvas.height / 2);
    sprite.material.map!.needsUpdate = true;

    const aspectRatio = canvas.width / canvas.height;
    sprite.scale.set(1.5 * aspectRatio, 1.5, 1);
    (sprite as any).userData.text = newText;
  }

  private createTextSprite(text: string, position: THREE.Vector3) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const fontSize = 48;
    context.font = `${fontSize}px "Orbitron", monospace`;

    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width;
    canvas.height = fontSize * 1.2;

    context.font = `${fontSize}px "Orbitron", monospace`;
    context.fillStyle = 'rgba(0, 255, 255, 0.7)';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);

    const aspectRatio = canvas.width / canvas.height;
    sprite.scale.set(1.5 * aspectRatio, 1.5, 1);
    sprite.position.copy(position);

    (sprite as any).userData = {canvas, context, text};
    return sprite;
  }

  private createCrtScreen() {
    this.crtCanvas = document.createElement('canvas');
    this.crtCanvas.width = 1024;
    this.crtCanvas.height = 1024;
    this.crtContext = this.crtCanvas.getContext('2d')!;

    this.crtTexture = new THREE.CanvasTexture(this.crtCanvas);
    this.updateCrtText();

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: {value: this.crtTexture},
        time: {value: 0},
        opacity: {value: 0.0},
      },
      vertexShader: crtVS,
      fragmentShader: crtFS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
    });

    const geometry = new THREE.PlaneGeometry(16, 16);
    this.crtScreen = new THREE.Mesh(geometry, material);
    this.crtScreen.position.z = -2;
    return this.crtScreen;
  }

  private updateCrtText() {
    const ctx = this.crtContext;
    const canvas = this.crtCanvas;

    ctx.fillStyle = 'rgba(0, 10, 20, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 255, 180, 0.7)';
    ctx.font = '24px "Orbitron", monospace';

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|[]{}<>;:?*&^%$#@!';
    const lineCount = 40;
    const charCount = 50;

    // Decide where to put special text
    const specialLineIndex1 = Math.floor(Math.random() * (lineCount - 5)) + 2;
    const specialLineIndex2 =
      specialLineIndex1 + Math.floor(Math.random() * 5) + 2;

    for (let i = 0; i < lineCount; i++) {
      let line = '';
      if (i === specialLineIndex1 || i === specialLineIndex2) {
        line = specialTexts[Math.floor(Math.random() * specialTexts.length)];
      } else {
        for (let j = 0; j < charCount; j++) {
          line += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      ctx.fillText(line, 10, i * 25 + 25);
    }
    this.crtTexture.needsUpdate = true;
  }

  private createHud() {
    const hud = new THREE.Group();
    const w = 11;
    const h = 7;
    const corner = 1;

    // --- Main Frame ---
    const frameShape = new THREE.Shape();
    frameShape.moveTo(w / 2, h / 2 - corner);
    frameShape.lineTo(w / 2, -h / 2 + corner); // Right
    frameShape.quadraticCurveTo(w / 2, -h / 2, w / 2 - corner, -h / 2);
    frameShape.lineTo(-w / 2 + corner, -h / 2); // Bottom
    frameShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + corner);
    frameShape.lineTo(-w / 2, h / 2 - corner); // Left
    frameShape.quadraticCurveTo(-w / 2, h / 2, -w / 2 + corner, h / 2);
    frameShape.lineTo(w / 2 - corner, h / 2); // Top
    frameShape.quadraticCurveTo(w / 2, h / 2, w / 2, h / 2 - corner);

    const framePoints = frameShape.getPoints(128);
    const frameGeom = new THREE.BufferGeometry().setFromPoints(framePoints);
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const frameLine = new THREE.Line(frameGeom, frameMat);
    hud.add(frameLine);

    // --- Glowing Accents ---
    this.hudGlowElements = [];
    const accentGeom = new THREE.PlaneGeometry(0.5, 0.1);
    const accentMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    const positions = [
      new THREE.Vector3(w / 2 - 0.7, h / 2, 0),
      new THREE.Vector3(-w / 2 + 0.7, h / 2, 0),
      new THREE.Vector3(w / 2 - 0.7, -h / 2, 0),
      new THREE.Vector3(-w / 2 + 0.7, -h / 2, 0),
      new THREE.Vector3(w / 2, h / 2 - 0.7, 0),
      new THREE.Vector3(w / 2, -h / 2 + 0.7, 0),
      new THREE.Vector3(-w / 2, h / 2 - 0.7, 0),
      new THREE.Vector3(-w / 2, -h / 2 + 0.7, 0),
    ];

    positions.forEach((pos, i) => {
      const accent = new THREE.Mesh(accentGeom, accentMat.clone());
      accent.position.copy(pos);
      if (i >= 4) {
        accent.rotation.z = Math.PI / 2;
      }
      this.hudGlowElements.push(accent);
      hud.add(accent);
    });

    // --- Side Dots ---
    const dotGeom = new THREE.CircleGeometry(0.05, 16);
    const dotMat = new THREE.MeshBasicMaterial({color: 0xffffff});
    for (let i = 0; i < 3; i++) {
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(-w / 2 - 0.5, i * 0.3 - 0.3, 0);
      hud.add(dot);
    }

    // --- Text ---
    this.hudTexts = [];
    const textPositions = [
      new THREE.Vector3(w / 2 + 2.5, 0, 0), // Right
      new THREE.Vector3(-w / 2 - 2.8, 0, 0), // Left
      new THREE.Vector3(0, h / 2 + 0.8, 0), // Top
      new THREE.Vector3(0, -h / 2 - 0.8, 0), // Bottom
    ];
    const initialTexts = [
      `TRK_ID: ${Math.floor(Math.random() * 999)}`,
      `SIG: ${(Math.random() * 100).toFixed(1)}%`,
      `VEC: ${Math.floor(Math.random() * 360)}°`,
      `SYS: NOMINAL`,
    ];

    for (let i = 0; i < 4; i++) {
      const textSprite = this.createTextSprite(
        initialTexts[i],
        textPositions[i],
      );

      if (initialTexts[i].startsWith('SYS:')) {
        this.sysStatusSprite = textSprite;
      } else {
        this.hudTexts.push(textSprite);
      }
      hud.add(textSprite);
    }

    return hud;
  }

  private init() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // --- CRT Screen ---
    scene.add(this.createCrtScreen());

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 2, 12);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.camera = camera;

    // --- HUD ---
    this.hudGroup = this.createHud();
    camera.add(this.hudGroup);
    this.hudGroup.position.z = -15;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    this.frequencyBars = new THREE.Group();
    const barCount = this.outputAnalyser.bufferLength;
    const radius = 3.5;

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const barWidth = 0.05;
      const barDepth = 0.05;
      const geometry = new THREE.BoxGeometry(barWidth, 1, barDepth);
      geometry.translate(0, 0.5, 0); // anchor at bottom
      const material = new THREE.MeshStandardMaterial({
        color: this.blueColor,
        emissive: this.blueColor,
        emissiveIntensity: 0.2,
        metalness: 0.5,
        roughness: 0.5,
      });
      const bar = new THREE.Mesh(geometry, material);
      bar.position.x = Math.cos(angle) * radius;
      bar.position.z = Math.sin(angle) * radius;
      bar.rotation.y = -angle;
      this.frequencyBars.add(bar);
    }
    scene.add(this.frequencyBars);

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,
      0.8,
      0.1,
    );

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    this.composer = composer;

    const onWindowResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      (
        this.crtScreen.material as THREE.ShaderMaterial
      ).uniforms.tDiffuse.value.needsUpdate = true;
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    this.animation();
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    const t = performance.now();
    if (!this.prevTime) this.prevTime = t;
    const dt = (t - this.prevTime) / (1000 / 60);
    this.prevTime = t;

    if (!this.inputAnalyser || !this.outputAnalyser) {
      this.composer.render();
      return;
    }

    this.inputAnalyser.update();
    this.outputAnalyser.update();

    const crtUniforms = this.crtScreen.material as THREE.ShaderMaterial;
    crtUniforms.uniforms.time.value = t / 2000;

    const outputData = this.outputAnalyser.data;
    const inputData = this.inputAnalyser.data;
    const barCount = this.frequencyBars.children.length;

    const avgOutput =
      outputData.reduce((a, b) => a + b, 0) / outputData.length / 255;
    const avgInput =
      inputData.reduce((a, b) => a + b, 0) / inputData.length / 255;

    const totalAvg = Math.min(1, (avgOutput * 0.8 + avgInput * 0.2) * 2.5);
    const targetOpacity = totalAvg > 0.02 ? 0.8 : 0.0;
    crtUniforms.uniforms.opacity.value = THREE.MathUtils.lerp(
      crtUniforms.uniforms.opacity.value,
      targetOpacity,
      0.05,
    );

    // Randomly update CRT text
    if (Math.random() > 0.8) {
      this.updateCrtText();
    }

    for (let i = 0; i < barCount; i++) {
      const bar = this.frequencyBars.children[i] as THREE.Mesh;
      const outputValue = (outputData[i] || 0) / 255;
      const inputValue = (inputData[i] || 0) / 255;
      const combinedValue = Math.min(1.0, outputValue * 0.8 + inputValue * 0.2);

      const maxHeight = 8;

      const barHeight = Math.max(0.01, combinedValue * maxHeight);
      bar.scale.y = barHeight;
      bar.position.y = 0;

      const material = bar.material as THREE.MeshStandardMaterial;

      if (combinedValue < 0.5) {
        const t = combinedValue * 2;
        material.color.copy(this.blueColor).lerp(this.orangeColor, t);
      } else {
        const t = (combinedValue - 0.5) * 2;
        material.color.copy(this.orangeColor).lerp(this.pinkColor, t);
      }

      material.emissive.copy(material.color);
      material.emissiveIntensity = 0.5 + combinedValue * 2;
    }

    this.hudGlowElements.forEach((el) => {
      const mat = el.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(t / 200 + el.position.x) * 0.5;
    });

    if (Math.random() > 0.95 && this.hudTexts.length > 0) {
      const spriteToUpdate =
        this.hudTexts[Math.floor(Math.random() * this.hudTexts.length)];
      const {canvas, context} = (spriteToUpdate as any).userData;
      let newText = (spriteToUpdate as any).userData.text;

      if (newText.includes('TRK_ID') || newText.includes('VEC')) {
        newText = newText.replace(/\d+/g, `${Math.floor(Math.random() * 999)}`);
      } else if (newText.includes('SIG')) {
        newText = newText.replace(
          /\d+\.\d/g,
          `${(Math.random() * 100).toFixed(1)}`,
        );
      }
      (spriteToUpdate as any).userData.text = newText;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillText(newText, canvas.width / 2, canvas.height / 2);
      spriteToUpdate.material.map!.needsUpdate = true;
    }

    const f = 0.001;
    this.rotation.x += dt * f * 0.05;
    this.rotation.y += dt * f * 0.2 * (avgOutput + avgInput);

    const euler = new THREE.Euler(
      this.rotation.x,
      this.rotation.y,
      this.rotation.z,
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const vector = new THREE.Vector3(0, 2, 12);
    vector.applyQuaternion(quaternion);
    this.camera.position.copy(vector);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.composer.render();
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    this.init();
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}