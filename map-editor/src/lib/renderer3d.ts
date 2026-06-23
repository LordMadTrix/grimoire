import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mapStore, type MapShape, type MapStamp } from './stores/mapStore.svelte';
import importedTextures from './imported_textures.json';
import importedStamps from './imported_stamps.json';

const WALL_HEIGHT = 50;
const STONE_TILE_SIZE = 64;

// ── Texture procédurale pierre (diffuse) ────────────────────────────────────
function buildStoneDiffuse(): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;

  c.fillStyle = '#0e0b07';
  c.fillRect(0, 0, size, size);

  const drawBlock = (bx: number, by: number, bw: number, bh: number) => {
    if (bw <= 0 || bh <= 0) return;
    const v = Math.floor(Math.random() * 20);
    c.fillStyle = `rgb(${42 + v},${32 + v},${20 + v})`;
    c.fillRect(bx, by, bw, bh);
    const grain = Math.floor(bw * bh / 20);
    for (let i = 0; i < grain; i++) {
      const gx = bx + Math.random() * bw;
      const gy = by + Math.random() * bh;
      c.fillStyle = Math.random() > 0.5 ? 'rgba(255,200,120,0.07)' : 'rgba(0,0,0,0.14)';
      c.fillRect(gx, gy, 1 + Math.random(), 1 + Math.random());
    }
    c.fillStyle = 'rgba(255,210,140,0.22)';
    c.fillRect(bx, by, bw, 2);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(bx, by + bh - 2, bw, 2);
    c.fillStyle = 'rgba(0,0,0,0.14)';
    c.fillRect(bx, by + Math.floor(bh * 0.65), bw, Math.ceil(bh * 0.35) - 2);
    c.fillStyle = 'rgba(255,210,140,0.10)';
    c.fillRect(bx, by, 2, bh);
  };

  drawBlock(3,   3,  133, 58);
  drawBlock(140, 3,  113, 58);
  drawBlock(3,   65, 65,  58);
  drawBlock(70,  65, 116, 58);
  drawBlock(188, 65, 65,  58);
  const v2 = Math.floor(Math.random() * 18);
  drawBlock(3,   127, 100 + v2, 58);
  drawBlock(106 + v2, 127, 147 - v2, 58);
  drawBlock(3,   189, 50,  64);
  drawBlock(55,  189, 140, 64);
  drawBlock(197, 189, 56,  64);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Texture procédurale pierre — normal map ──────────────────────────────────
function buildStoneNormal(): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;

  c.fillStyle = 'rgb(128,128,255)';
  c.fillRect(0, 0, size, size);

  const jointColor = 'rgb(102,128,255)';
  const joints = [
    { x: 0, y: 0, w: size, h: 3 },
    { x: 0, y: 62, w: size, h: 3 },
    { x: 137, y: 0, w: 3, h: 62 },
    { x: 0, y: 65, w: size, h: 3 },
    { x: 0, y: 124, w: size, h: 3 },
    { x: 68, y: 65, w: 3, h: 59 },
    { x: 185, y: 65, w: 3, h: 59 },
    { x: 0, y: 127, w: size, h: 3 },
    { x: 0, y: 186, w: size, h: 3 },
    { x: 53, y: 127, w: 3, h: 59 },
    { x: 0, y: 189, w: size, h: 3 },
    { x: 0, y: 253, w: size, h: 3 },
    { x: 53, y: 189, w: 3, h: 64 },
    { x: 195, y: 189, w: 3, h: 64 },
  ];
  c.fillStyle = jointColor;
  for (const j of joints) c.fillRect(j.x, j.y, j.w, j.h);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Texture procédurale sol (pavés) ─────────────────────────────────────────
function buildPavingDiffuse(): THREE.CanvasTexture {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;

  c.fillStyle = '#3a3636';
  c.fillRect(0, 0, size, size);
  c.strokeStyle = '#1a1616';
  c.lineWidth = 2;
  for (let x = 0; x <= size; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, size); c.stroke(); }
  for (let y = 0; y <= size; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(size, y); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  for (let x = 0; x < size; x += 64) {
    for (let y = 0; y < size; y += 64) {
      c.beginPath(); c.moveTo(x + 2, y + 62); c.lineTo(x + 2, y + 2); c.lineTo(x + 62, y + 2); c.stroke();
    }
  }
  for (let i = 0; i < 300; i++) {
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    c.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    c.fillRect(gx, gy, 1, 1);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Renderer principal ───────────────────────────────────────────────────────
export class DungeonRenderer3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private perspCamera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  public isPerspective = false;
  private wallMat: THREE.MeshStandardMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  // Caches séparés pour éviter les conflits de types MeshStandard vs Sprite
  private meshMatCache: Map<string, THREE.MeshStandardMaterial> = new Map();
  private spriteMatCache: Map<string, THREE.SpriteMaterial> = new Map();
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  private shapeGroup: THREE.Group;
  private stampGroup: THREE.Group;
  private dirLight: THREE.DirectionalLight;
  // Dirty flags pour éviter de reconstruire la géométrie à chaque frame
  private _shapesKey = '';
  private _stampsKey = '';

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000);
    this.camera.up.set(0, 0, -1);

    this.perspCamera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
    this.perspCamera.up.set(0, 0, -1);

    this.controls = new OrbitControls(this.perspCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enabled = false;

    // ── Éclairage ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffe8c0, 0.55);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight(0xfff0d0, 1.4);
    this.dirLight.position.set(-1.5, 3, -1.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 8000;
    this.dirLight.shadow.camera.left = -3000;
    this.dirLight.shadow.camera.right = 3000;
    this.dirLight.shadow.camera.top = 3000;
    this.dirLight.shadow.camera.bottom = -3000;
    this.dirLight.shadow.bias = -0.001;
    this.scene.add(this.dirLight);

    const fillLight = new THREE.DirectionalLight(0x8090c0, 0.25);
    fillLight.position.set(2, 1, 2);
    this.scene.add(fillLight);

    // ── Textures & matériaux ──────────────────────────────────────────────────
    const stoneDiff = buildStoneDiffuse();
    stoneDiff.repeat.set(1 / STONE_TILE_SIZE, 1 / STONE_TILE_SIZE);

    const stoneNorm = buildStoneNormal();
    stoneNorm.repeat.set(1 / STONE_TILE_SIZE, 1 / STONE_TILE_SIZE);

    const pavingDiff = buildPavingDiffuse();
    pavingDiff.repeat.set(1 / 64, 1 / 64);

    this.wallMat = new THREE.MeshStandardMaterial({
      map: stoneDiff,
      normalMap: stoneNorm,
      roughness: 0.95,
      metalness: 0.0,
    });

    this.floorMat = new THREE.MeshStandardMaterial({
      map: pavingDiff,
      roughness: 0.92,
      metalness: 0.0,
    });

    this.shapeGroup = new THREE.Group();
    this.stampGroup = new THREE.Group();
    this.scene.add(this.shapeGroup);
    this.scene.add(this.stampGroup);
  }

  // Synchronise la caméra avec le pan/zoom du Canvas 2D
  syncCamera(panX: number, panY: number, zoom: number, containerW: number, containerH: number) {
    this.renderer.setSize(containerW, containerH, false);

    const halfW = containerW / (2 * zoom);
    const halfH = containerH / (2 * zoom);
    const cx = (containerW / 2 - panX) / zoom;
    const cz = (containerH / 2 - panY) / zoom;

    this.perspCamera.aspect = containerW / containerH;
    this.perspCamera.updateProjectionMatrix();

    if (!this.isPerspective) {
      this.camera.left = -halfW;
      this.camera.right = halfW;
      this.camera.top = halfH;
      this.camera.bottom = -halfH;
      this.camera.updateProjectionMatrix();

      this.camera.position.set(cx, 2000, cz);
      this.camera.lookAt(cx, 0, cz);

      this.dirLight.position.set(cx - 800, 2000, cz - 600);
      this.dirLight.target.position.set(cx, 0, cz);
      this.dirLight.target.updateMatrixWorld();
    } else {
      this.dirLight.position.set(this.perspCamera.position.x - 800, 2000, this.perspCamera.position.z - 600);
      this.dirLight.target.position.set(this.controls.target.x, 0, this.controls.target.z);
      this.dirLight.target.updateMatrixWorld();
    }

    this.dirLight.shadow.camera.left = -halfW - 200;
    this.dirLight.shadow.camera.right = halfW + 200;
    this.dirLight.shadow.camera.top = halfH + 200;
    this.dirLight.shadow.camera.bottom = -halfH - 200;
    this.dirLight.shadow.camera.updateProjectionMatrix();
  }

  // Met à jour la géométrie 3D — ne reconstruit que si les shapes ont changé
  updateShapes(shapes: MapShape[]) {
    // Seules les shapes "wall" sont gérées en 3D (les autres sont rendues par le Canvas 2D)
    const wallShapes = shapes.filter(s =>
      (s.type === 'rectangle') && s.fillTexture === 'wall'
    );

    const key = wallShapes.map(s =>
      `${s.id}:${s.points.map(p => `${p.x},${p.y}`).join(';')}:${s.fillTexture ?? ''}`
    ).join('|');
    if (key === this._shapesKey) return;
    this._shapesKey = key;

    // Détruire les meshes existants
    while (this.shapeGroup.children.length > 0) {
      const child = this.shapeGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      this.shapeGroup.remove(child);
    }

    if (wallShapes.length === 0) return;

    // Bounding-box pour le plan de sol
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    const doorTexIds = new Set(Object.values(mapStore.dungeonThemes).map(t => t.door));

    for (const shape of wallShapes) {
      const [p0, p1] = shape.points;
      const x = Math.min(p0.x, p1.x); const z = Math.min(p0.y, p1.y);
      const x2 = Math.max(p0.x, p1.x); const z2 = Math.max(p0.y, p1.y);
      if (x < minX) minX = x; if (z < minZ) minZ = z;
      if (x2 > maxX) maxX = x2; if (z2 > maxZ) maxZ = z2;
    }

    if (isFinite(minX)) {
      const fw = maxX - minX;
      const fh = maxZ - minZ;
      const floorGeo = new THREE.PlaneGeometry(fw, fh);
      const floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(minX + fw / 2, -1, minZ + fh / 2);
      floorMesh.receiveShadow = true;
      this.shapeGroup.add(floorMesh);
    }

    for (const shape of wallShapes) {
      const [p0, p1] = shape.points;
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      const w = Math.abs(p1.x - p0.x);
      const h = Math.abs(p1.y - p0.y);
      if (w <= 0 || h <= 0) continue;

      const isDoor = shape.fillTexture ? doorTexIds.has(shape.fillTexture) : false;
      const actualHeight = isDoor ? WALL_HEIGHT * 0.75 : WALL_HEIGHT;
      const elevation = actualHeight / 2;

      const geo = new THREE.BoxGeometry(w, actualHeight, h);
      const mesh = new THREE.Mesh(geo, this.wallMat);
      mesh.position.set(x + w / 2, elevation, y + h / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.shapeGroup.add(mesh);
    }
  }

  private getMeshMaterial(textureId: string): THREE.MeshStandardMaterial {
    if (this.meshMatCache.has(textureId)) return this.meshMatCache.get(textureId)!;

    const texData = importedTextures.find(t => t.id === textureId);
    if (!texData?.file) return this.wallMat;

    const tex = this.textureLoader.load(texData.file);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / 128, 1 / 128);

    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    this.meshMatCache.set(textureId, mat);
    return mat;
  }

  // Met à jour les Stamps (billboards) — ne reconstruit que si les stamps ont changé
  updateStamps(stamps: MapStamp[]) {
    const key = stamps.map(s => `${s.id}:${s.type}:${s.x},${s.y}:${s.scale}`).join('|');
    if (key === this._stampsKey) return;
    this._stampsKey = key;

    while (this.stampGroup.children.length > 0) {
      this.stampGroup.remove(this.stampGroup.children[0]);
    }

    for (const stamp of stamps) {
      const stampData = importedStamps.find(s => s.id === stamp.type);
      if (!stampData?.file) continue;

      let mat = this.spriteMatCache.get(stamp.type);
      if (!mat) {
        const tex = this.textureLoader.load(stampData.file);
        mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true });
        this.spriteMatCache.set(stamp.type, mat);
      }

      const sprite = new THREE.Sprite(mat);
      const size = 100 * stamp.scale;
      sprite.scale.set(size, size, 1);
      sprite.position.set(stamp.x, size / 2, stamp.y);
      this.stampGroup.add(sprite);
    }
  }

  setMode(perspective: boolean) {
    this.isPerspective = perspective;
    this.controls.enabled = perspective;

    if (perspective) {
      this.perspCamera.position.set(this.camera.position.x, 800, this.camera.position.z + 600);
      this.controls.target.set(this.camera.position.x, 0, this.camera.position.z);
      this.controls.update();
    }
  }

  render() {
    if (this.isPerspective) {
      this.controls.update();
      this.renderer.render(this.scene, this.perspCamera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.controls.dispose();
    this.renderer.dispose();
    this.wallMat.dispose();
    this.floorMat.dispose();
    for (const mat of this.meshMatCache.values()) mat.dispose();
    for (const mat of this.spriteMatCache.values()) mat.dispose();
  }
}
