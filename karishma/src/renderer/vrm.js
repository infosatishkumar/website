// Optional 3D body: any .vrm model (e.g. made in VRoid Studio) driven by the
// same pose data as the 2D rig.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const DEG = Math.PI / 180;

export class VrmCharacter {
  static async load(container, bytes) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await loader.parseAsync(buffer, '');
    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('Not a VRM file');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    return new VrmCharacter(container, vrm);
  }

  constructor(container, vrm) {
    this.vrm = vrm;
    container.innerHTML = '';
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'k-canvas';

    this.scene = new THREE.Scene();
    this.scene.add(vrm.scene);
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1, 1.5, 2);
    this.scene.add(light, new THREE.AmbientLight(0xffffff, 0.9));

    const box = new THREE.Box3().setFromObject(vrm.scene);
    this.modelHeight = box.max.y - box.min.y || 1.6;
    const h = this.modelHeight * 1.06;
    const w = (h * 200) / 300;
    this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h * 0.98, -h * 0.02, 0.01, 20);
    this.camera.position.set(0, 0, 5);

    this.lookTarget = new THREE.Object3D();
    this.scene.add(this.lookTarget);
    if (vrm.lookAt) vrm.lookAt.target = this.lookTarget;

    this.bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
    this.hipsBaseY = this.bone('hips') ? this.bone('hips').position.y : 0;
    this.clock = new THREE.Clock();
  }

  setSize(px, py) {
    this.renderer.setSize(px, py, false);
  }

  setOutfit() {
    // VRM models bring their own clothes.
  }

  hitAreas() {
    return { head: { cx: 100, cy: 45, r: 42 }, body: { x: 55, y: 80, w: 90, h: 216 } };
  }

  setExpr(name, value) {
    const em = this.vrm.expressionManager;
    if (em && em.getExpression(name)) em.setValue(name, value);
  }

  apply(p) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const b = this.bone;
    const set = (name, x, y, z) => {
      const n = b(name);
      if (n) n.rotation.set(x, y, z);
    };
    const f = p.facing < 0 ? -1 : 1;

    this.vrm.scene.rotation.y = p.walking ? f * 0.7 : 0;
    this.vrm.scene.rotation.z = -p.lean * DEG;
    this.vrm.scene.scale.set(p.squashX, p.squashY, 1);

    const hips = b('hips');
    if (hips) hips.position.y = this.hipsBaseY - (p.bob / 300) * this.modelHeight - (p.sitting ? 0.25 * this.modelHeight : 0);

    set('leftUpperArm', 0, 0, -1.35 + p.armR * DEG);
    set('rightUpperArm', 0, 0, 1.35 - p.armL * DEG);
    set('leftLowerArm', 0, 0, p.armR > 60 ? -0.4 : 0);
    set('rightLowerArm', 0, 0, p.armL > 60 ? 0.4 : 0);

    if (p.sitting) {
      set('leftUpperLeg', -1.45 + p.legR * DEG * 0.5, 0, 0);
      set('rightUpperLeg', -1.45 + p.legL * DEG * 0.5, 0, 0);
      set('leftLowerLeg', 1.45, 0, 0);
      set('rightLowerLeg', 1.45, 0, 0);
    } else {
      set('leftUpperLeg', p.legR * DEG, 0, 0);
      set('rightUpperLeg', p.legL * DEG, 0, 0);
      set('leftLowerLeg', Math.max(0, -p.legR) * DEG, 0, 0);
      set('rightLowerLeg', Math.max(0, -p.legL) * DEG, 0, 0);
    }
    set('spine', 0, 0, -p.torsoTilt * DEG);
    set('neck', 0, 0, -p.headTilt * DEG * 0.6);
    set('head', 0, 0, -p.headTilt * DEG * 0.4);

    // Eyes follow the cursor
    this.lookTarget.position.set(p.lookX * 2 * f, this.modelHeight * 0.9 - p.lookY * 1.2, 3);

    // Expressions
    const happy = p.eyes === 'happy' || p.mouth === 'cat' ? 1 : 0;
    this.setExpr('blink', p.eyes === 'closed' ? 1 : happy ? 0 : p.blink);
    this.setExpr('happy', happy);
    this.setExpr('surprised', p.eyes === 'surprised' ? 1 : 0);
    this.setExpr('sad', p.mouth === 'sad' ? 0.8 : 0);
    this.setExpr('relaxed', p.blush * 0.5);
    this.setExpr('aa', p.talk > 0.05 ? p.talk : p.mouth === 'open' ? 0.6 : 0);
    this.setExpr('oh', p.mouth === 'o' ? 0.8 : 0);

    this.vrm.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
