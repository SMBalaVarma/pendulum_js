// Import and setup THREE.js and textures
import * as THREE from 'three';


let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let clickAngle = 0;

async function loadTexture(loader, url) {
    const texture = await loader.loadAsync(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(100, 10);
    return texture;
}

async function createGround() {
    const loader = new THREE.TextureLoader();
    const textureColor = await loadTexture(loader, './public/paving_color.jpg');
    const textureRoughness = await loadTexture(loader, './public/paving_roughness.jpg');
    const textureNormal = await loadTexture(loader, './public/paving_normal.jpg');
    const textureAmbientOcclusion = await loadTexture(loader, './public/paving_ambient_occlusion.jpg');

    const planeGeometry = new THREE.PlaneGeometry(1000, 100);
    const planeMaterial = new THREE.MeshStandardMaterial({
        map: textureColor,
        normalMap: textureNormal,
        normalScale: new THREE.Vector2(2, 2),
        roughness: 1,
        roughnessMap: textureRoughness,
        aoMap: textureAmbientOcclusion,
        aoMapIntensity: 1,
    });
    const mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -5;

    return mesh;
}

// Create the Pendulum class and associated functions
class Pendulum {
    constructor(stringMesh, ballMesh, frequency, amplitude) {
        this.string = stringMesh;
        this.ball = ballMesh;
        this.frequency = frequency;
        this.amplitude = amplitude;
        this.isSwinging = false;
        this.angle = 0;
        this.velocity = 0;
        this.lastUpdateTime = 0;
    }

    setAngleFromMouse(x, y) {
        const relativeX = x - window.innerWidth / 2;
        this.angle = (relativeX / (window.innerWidth / 2)) * Math.PI / 4; // Limit to ±45 degrees
        this.updatePendulumPosition();
    }

    updatePendulumPosition() {
        this.string.rotation.z = this.angle;
        this.ball.rotation.z = this.angle;
        // this.ball.position.x = Math.sin(this.angle) * 8;
        // this.ball.position.y = -Math.cos(this.angle) * 8 + 6;
    }

    update(totalTime) {
        if (this.isSwinging) {
            const deltaTime = (totalTime - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = totalTime;

            const acceleration = -9.81 / 8 * Math.sin(this.angle);
            this.velocity += acceleration * deltaTime;
            this.angle += this.velocity * deltaTime;

            // Apply damping
            this.velocity *= 0.99995;
        }
        this.updatePendulumPosition();
    }

    startSwinging(totalTime) {
        this.isSwinging = true;
        this.lastUpdateTime = totalTime;
        this.velocity = 0; // Start with zero velocity
    }

    stopSwinging() {
        this.isSwinging = false;
    }
}

function createStringMesh(scene) {
    const geometry = new THREE.CylinderGeometry(0.001, 0.001, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0, metalness: 0.2 });
    const string = new THREE.Mesh(geometry, material);
    scene.add(string);
    return string;
}

async function createBallMesh(scene) {
    const loader = new THREE.TextureLoader();
    const marbleTextureColor = await loader.loadAsync('./public/marble_color.jpg');
    const marbleTextureRoughness = await loader.loadAsync('./public/marble_roughness.jpg');

    const geometry = new THREE.SphereGeometry(0.5);
    const material = new THREE.MeshStandardMaterial({
        map: marbleTextureColor,
        roughness: 1,
        roughnessMap: marbleTextureRoughness,
        metalness: 0.2,
    });
    const ball = new THREE.Mesh(geometry, material);
    ball.castShadow = true;
    scene.add(ball);
    return ball;
}

async function createPendulum(scene, origin, frequency = 1, amplitude = 0.5) {
    const stringMesh = createStringMesh(scene);
    stringMesh.position.add(origin);
    stringMesh.translateY(6);
    stringMesh.geometry.translate(0, -4, 0);

    const ballMesh = await createBallMesh(scene);
    ballMesh.position.add(origin);
    ballMesh.translateY(6);
    ballMesh.geometry.translate(0, -8.5, 0);

    const pendulum = new Pendulum(stringMesh, ballMesh, frequency, amplitude);
    return pendulum;
}

// Main setup function
async function main() {
    const sceneCanvas = document.getElementById('sceneCanvas');
    sceneCanvas.width = window.innerWidth;
    sceneCanvas.height = window.innerHeight;

    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = Math.max(7 / aspect, 5);
    camera.position.y = 1;
    camera.lookAt(0, -1, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
    renderer.shadowMap.enabled = true;

    window.addEventListener('resize', () => {
        sceneCanvas.width = window.innerWidth;
        sceneCanvas.height = window.innerHeight;
        const aspect = window.innerWidth / window.innerHeight;
        camera.aspect = aspect;
        camera.position.z = Math.max(8 / aspect, 6);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    scene.background = new THREE.Color(0xc7dcff);

    const light = new THREE.AmbientLight(0xdddddd, 0.4);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(4, 10, 4);
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.camera.left = -20;
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const ground = await createGround();
    scene.add(ground);

    const pendulums = [];
    for (let i = 0; i < 12; i++) {
        const pendulum = await createPendulum(scene, new THREE.Vector3(0, 0, -i * 1.2), 1.2 + i * 0.05);
        pendulums.push(pendulum);
    }

    scene.fog = new THREE.Fog(0xc7dcff, 1, 80);

    let startTime = null;
    let lastFrameTime = null;
    function onMouseDown(event) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    
        pendulums.forEach((pendulum) => {
            pendulum.stopSwinging();
            pendulum.setAngleFromMouse(lastMouseX, lastMouseY);
        });
    }
    
    function onMouseMove(event) {
        if (isDragging) {
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
    
            pendulums.forEach((pendulum) => {
                pendulum.setAngleFromMouse(lastMouseX, lastMouseY);
            });
        }
    }
    
    function onMouseUp(event) {
        isDragging = false;
    
        pendulums.forEach((pendulum, index) => {
            // Add a slight delay to each pendulum's start
            setTimeout(() => {
                pendulum.startSwinging(performance.now() - startTime);
            }, index * 100);
        });
    }
    
    // Attach event listeners
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    // Main rendering loop (as before)
    function animationFrame(time) {
        if (startTime == null) {
            startTime = time;
        }
        if (lastFrameTime == null) {
            lastFrameTime = time;
        }
        const deltaTime = time - lastFrameTime;
        lastFrameTime = time;
        const totalTime = time - startTime;
        update(deltaTime, totalTime);
        renderer.render(scene, camera);
        window.requestAnimationFrame(animationFrame);
    }
    
    function update(deltaTime, totalTime) {
    if (isDragging) {
        pendulums.forEach((pendulum, index) => {
            // Add a slight delay to each pendulum's movement
            setTimeout(() => {
                pendulum.setAngleFromMouse(lastMouseX, lastMouseY);
            }, index * 30);
        });
    } else {
        pendulums.forEach((p) => {
            p.update(totalTime);
        });
    }
}
    
    window.requestAnimationFrame(animationFrame);
}

main();


