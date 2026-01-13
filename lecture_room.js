// gl-matrix 라이브러리 로드
import {
    mat4,
    mat3,
    vec3,
    vec4 
} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.4/esm/index.js";

// --------------------------------
// 0. 캔버스 & GL 초기화
// --------------------------------
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("WebGL2 not supported");

function resize() {
    const w = canvas.clientWidth,
        h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}
window.addEventListener("resize", resize);

// --------------------------------
// 1. Shaders
// --------------------------------
const vs = `#version 300 es
    precision highp float;

    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    layout(location = 2) in vec2 aUV;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProj;
    uniform mat3 uNormalMat;

    out vec3 vNormalVS; 
    out vec3 vViewPos;  
    out vec2 vUV;

    void main() {
        vec4 viewPos = uView * uModel * vec4(aPosition, 1.0);
        vViewPos = viewPos.xyz; 
        vNormalVS = uNormalMat * aNormal; 
        vUV = aUV;
        gl_Position = uProj * viewPos;
    }
`;

const fs = `#version 300 es
    precision highp float;

    // Lights
    uniform vec3 uLightDir;      // Directional Light 
    uniform vec3 uPointLightPos; // Point Light  - View Space

    // Materials
    uniform vec3 uAmbient;
    uniform vec3 uDiffuse;
    uniform vec3 uSpecular;
    uniform float uShininess;

    uniform sampler2D uTex;
    uniform bool uUseTex;

    in vec3 vNormalVS;
    in vec3 vViewPos;
    in vec2 vUV;

    out vec4 outColor;

    void main() {
        vec3 N = normalize(vNormalVS); 
        vec3 V = normalize(-vViewPos);  

        vec3 baseColor = uDiffuse;
        if(uUseTex) {
            vec4 texColor = texture(uTex, vUV);
            baseColor = texColor.rgb;
        }

       // -------------------------------------------
        // 1. Directional Light 
        // -------------------------------------------
        vec3 L_dir = normalize(-uLightDir);
        vec3 R_dir = normalize(reflect(-L_dir, N));
        
        float diff_dir = max(dot(N, L_dir), 0.0);
        float spec_dir = pow(max(dot(R_dir, V), 0.0), uShininess);
        
        vec3 color_dir = (baseColor * diff_dir * 0.6) + (uSpecular * spec_dir * 0.3);

        // -------------------------------------------
        // 2. Point Light 
        // -------------------------------------------
        vec3 L_point = normalize(uPointLightPos - vViewPos);
        vec3 R_point = normalize(reflect(-L_point, N));

        float diff_point = max(dot(N, L_point), 0.0);
        float spec_point = pow(max(dot(R_point, V), 0.0), uShininess);

        // 빛 감쇠 (거리가 멀어질수록 약해짐)
        float distance = length(uPointLightPos - vViewPos);
        float attenuation = 1.0 / (1.0 + 0.09 * distance + 0.032 * distance * distance);

        vec3 color_point = (baseColor * diff_point + uSpecular * spec_point) * attenuation * 1.0;

        // -------------------------------------------
        // 3. Final Combine
        // -------------------------------------------
        vec3 finalColor;
        if (baseColor.r > 0.9 && baseColor.g > 0.9 && baseColor.b > 0.9 && uShininess > 90.0) {
             finalColor = baseColor; 
        } else {
             finalColor = uAmbient + color_dir + color_point;
        }

        outColor = vec4(finalColor, 1.0);
    }
`;

// --------------------------------
// 2. Program Setup
// --------------------------------
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
const program = createProgram(gl, vertexShader, fragmentShader);
gl.useProgram(program);


const uModel = gl.getUniformLocation(program, "uModel");
const uView = gl.getUniformLocation(program, "uView");
const uProj = gl.getUniformLocation(program, "uProj");
const uNormalMat = gl.getUniformLocation(program, "uNormalMat");
const uLightDir = gl.getUniformLocation(program, "uLightDir");
const uAmbient = gl.getUniformLocation(program, "uAmbient");
const uDiffuse = gl.getUniformLocation(program, "uDiffuse");
const uSpecular = gl.getUniformLocation(program, "uSpecular");
const uShininess = gl.getUniformLocation(program, "uShininess");
const uTex = gl.getUniformLocation(program, "uTex");
const uUseTex = gl.getUniformLocation(program, "uUseTex");
const uPointLightPos = gl.getUniformLocation(program, "uPointLightPos"); 

// --------------------------------
// 3. Geometry Setup
// --------------------------------
const geometries = {
    cube: createCubeFacesStandard(), 
    cylinder: createCylinder(1.0, 1.0, 32),
    sphere: createSphereSmooth(1.0, 32, 32) 
};

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// VBO/IBO 초기화
const posVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

const normalVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalVBO);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

const uvVBO = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);


// --------------------------------
// 4. Scene Objects
// --------------------------------
const lightPos = [2.5, 2., 1.];
const deskScaleX = 2.5, deskScaleY = 0.2, deskScaleZ = 1.2;
const deskPosY = -0.75-deskScaleY*0.5, deskPosZ = 1.75;
const laptopScale = 1; 



const sceneObjects = [
    { geometry: geometries.cube, scale: [10.0, 1, 15.0], 
        translate: [0.0, -2.5, 0.0], diffuse: [1, 1, 1], specular: [0.1, 0.1, 0.1], shininess: 10.0, name: "Floor" },
    { geometry: geometries.cube, scale: [10.0, 5.0, 0.1], 
        translate: [0.0, 0.0, -3.0], diffuse: [0.8, 0.7, 0.6], specular: [0.05, 0.05, 0.05], shininess: 5.0, name: "Back Wall" },
    { geometry: geometries.cube, scale: [0.1, 5.0, 10.0], 
        translate: [5.0, 0.0, 0.0], diffuse: [0.8, 0.7, 0.6], specular: [0.05, 0.05, 0.05], shininess: 5.0, name: "Right Wall" },
    { geometry: geometries.cube, scale: [10.0, 0.1, 10.0], 
        translate: [0.0, 2.5, 0.0], diffuse: [0.8, 0.7, 0.6], specular: [0.1, 0.1, 0.1], shininess: 10.0, name: "Ceiling" },
    
    { 
        geometry: geometries.cube, scale: [5.0, 3, 0.05],
        translate: [0.0, 1, -2.9], diffuse: [1, 1, 1], specular: [0.5, 0.5, 0.5], shininess: 30.0, name: "Screen", useTexture: true, textureFaceIndex: 0
    },
    
    { geometry: geometries.cube, scale: [10.0, 1.5, 0.08], 
        translate: [0.0, 0.1, -2.95], diffuse: [0.1, 0.5, 0.3], specular: [0.1, 0.1, 0.1], shininess: 30.0, name: "Blackboard" },
    { geometry: geometries.cube, scale: [deskScaleX, deskScaleY, deskScaleZ], 
        translate: [0.0, deskPosY, deskPosZ], diffuse: [0.6, 0.4, 0.2], specular: [0.2, 0.2, 0.2], shininess: 5.0, name: "Desk Top" },
    
    ...Array(4).fill(0).map((_, i) => ({
        geometry: geometries.cylinder, scale: [0.1, 1.1, 0.1], 
        translate: [i < 2 ? + 1.1 : -(+ 1.1), deskPosY-deskScaleY*0.5 - 0.55, i % 2 == 0 ? deskPosZ+0.5 : deskPosZ-0.5], 
        diffuse: [0.7, 0.7, 0.7], specular: [0.8, 0.8, 0.8], shininess: 50.0, name: `Desk Leg ${i+1}`
    })),
    
    { geometry: geometries.cube, scale: [laptopScale * 0.6, laptopScale * 0.05, laptopScale * 0.4], 
        translate: [0.0, -0.7, 2], diffuse: [1, 1, 1], specular: [1.0, 1.0, 1.0], shininess: 20.0, name: "Laptop Base" },

    { 
        geometry: geometries.sphere, scale: [0.2, 0.11, 0.3], 
        translate: [1, deskPosY+0.05, deskPosZ],diffuse: [0.9, 0.9, 0.9], specular: [1.0, 1.0, 1.0],shininess: 100.0, name: "Mouse"
    },
    { 
        geometry: geometries.cube, scale: [1.0, 0.05, 3], 
        translate: [lightPos[0],lightPos[1]+0.4,lightPos[2]], diffuse: [1.0, 1.0, 1.0], specular: [0.0, 0.0, 0.0], shininess: 95.0, name: "LED Light"
    },

    {
        geometry: geometries.cube,scale: [0.2, 4.0, 2], 
        translate: [5, 0, 0], diffuse: [0.8, 1, 1], specular: [0.2, 0.2, 0.2], shininess: 30.0,name: "Door Left"
    },
        {
        geometry: geometries.cube,scale: [0.2, 4.0, 2], 
        translate: [5, 0, 2.05], diffuse: [0.8, 1, 1], specular: [0.2, 0.2, 0.2], shininess: 30.0,name: "Door Right"
    },
    {
        geometry: geometries.cylinder,scale: [0.2, 0.4, 0.05], 
        translate: [4.9, 0, 0.75],diffuse: [0.7, 0.7, 0.7], specular: [1.0, 1.0, 1.0], shininess: 100.0, name: "Handle Left"
    },
    {
        geometry: geometries.cylinder,scale: [0.2, 0.4, 0.05], 
        translate: [4.9, 0, 1.3],diffuse: [0.7, 0.7, 0.7], specular: [1.0, 1.0, 1.0], shininess: 100.0, name: "Handle Right"
    },
];

// Laptop Screen State
const OPEN_ANGLE = -110;
const laptopScreen = {
    geometry: geometries.cube, scale: [laptopScale * 0.6, laptopScale * 0.05, laptopScale * 0.4], 
    translate: [0.0, -0.66, 2], diffuse: [1, 1, 1], specular: [1.0, 1.0, 1.0], shininess: 20.0,
    name: "Laptop Screen",rotationX: OPEN_ANGLE,  pivot: [0.0, 0 + (laptopScale * 0.05 / 2), 0 + (laptopScale * 0.4 / 2)], 
    useTexture: true, textureFaceIndex: 3
};

// --------------------------------
// 5. Camera & Interaction State
// --------------------------------
let cameraZ = 6; 
let lastTime = 0;

let isDragging = false;
let lastMouseY = 0;
let globalViewMat = mat4.create();
let globalProjMat = mat4.create();

// --------------------------------
// 6. Interaction Event Handlers
// --------------------------------
function projectWorldToScreen(worldPos, view, proj, width, height) {
    const clipSpace = vec4.create();
    vec4.transformMat4(clipSpace, [worldPos[0], worldPos[1], worldPos[2], 1.0], view);
    vec4.transformMat4(clipSpace, clipSpace, proj);

    if (clipSpace[3] === 0) return null;

    const ndcX = clipSpace[0] / clipSpace[3];
    const ndcY = clipSpace[1] / clipSpace[3];

    const screenX = (ndcX + 1) * width / 2;
    const screenY = (1 - ndcY) * height / 2; 

    return [screenX, screenY];
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const screenPos = projectWorldToScreen(laptopScreen.translate, globalViewMat, globalProjMat, canvas.width, canvas.height);
    
    if (screenPos) {
        const dx = mouseX - screenPos[0];
        const dy = mouseY - screenPos[1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 200) {
            isDragging = true;
            lastMouseY = mouseY;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const deltaY = mouseY - lastMouseY;
    lastMouseY = mouseY;

    laptopScreen.rotationX += deltaY * 0.5;
    if (laptopScreen.rotationX > 0) laptopScreen.rotationX = 0;
    if (laptopScreen.rotationX < -135) laptopScreen.rotationX = -135;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    const zoomSpeed = 0.01; 
    cameraZ += e.deltaY * zoomSpeed;

    if (cameraZ < 2.5) cameraZ = 2.5;
    if (cameraZ > 6.0) cameraZ = 6.0;
}, { passive: false });


// --------------------------------
// 7. Rendering Loop
// --------------------------------
loadTexture("texture1.png").then((loadedTexture) => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, loadedTexture);
    gl.uniform1i(uTex, 0);

    requestAnimationFrame(render);
});


function render(now) {
    now *= 0.001; 
    const deltaTime = now - lastTime;
    lastTime = now;

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.1, 0.1, 0.12, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(vao);

    // [줌 인 시 노트북으로 시선 이동]
    const t = (6.0 - cameraZ) / 4.0; // 0 ~ 1 비율
    const eyeX = -4.0 * (1.0 - t); 
    const eyeY = 0.0 * (1.0 - t) + (-0.6 * t);
    const targetX = 0.0;
    const targetY = -1.0 * (1.0 - t) + (-0.8 * t); 
    const targetZ = 0.0 * (1.0 - t) + (2.0 * t); 

    
    mat4.lookAt(globalViewMat, [eyeX, eyeY, cameraZ], [targetX, targetY, targetZ], [0, 1, 0]); 
    mat4.perspective(globalProjMat, Math.PI / 3, canvas.width / canvas.height, 0.1, 100);
    
    gl.uniformMatrix4fv(uView, false, globalViewMat);
    gl.uniformMatrix4fv(uProj, false, globalProjMat);

    // Light
    // 1. Directional Light
    const lightDirVS = vec3.create();
    vec3.transformMat3(lightDirVS, [1, -1, -1.0], mat3.fromMat4(mat3.create(), globalViewMat));
    gl.uniform3fv(uLightDir, normalize(lightDirVS));

    // 2. Point Light 
    const pointLightVS = vec3.create();
    vec3.transformMat4(pointLightVS, [lightPos[0], lightPos[1], lightPos[2], 1.0], globalViewMat);
    gl.uniform3fv(uPointLightPos, pointLightVS);
    gl.uniform3fv(uAmbient, [0.3, 0.3, 0.3]);

    const bigScreen = sceneObjects.find(obj => obj.name === "Screen");

    // 상태 업데이트
    if (laptopScreen.rotationX > -45) {
        laptopScreen.useTexture = false;       
        if(bigScreen) {
            bigScreen.useTexture = false;
            bigScreen.diffuse = [0.1, 0.1, 0.8]; 
        } 
    } else {
        laptopScreen.useTexture = true;        
        if(bigScreen) {
            bigScreen.useTexture = true;
            bigScreen.diffuse = [1, 1, 1]; 
        }
    }

    [...sceneObjects, laptopScreen].forEach(obj => {
        
        const model = mat4.create();
        if (obj.name === "Laptop Screen") {
            mat4.translate(model, model, obj.translate);
            mat4.translate(model, model, [-obj.pivot[0], -obj.pivot[1], -obj.pivot[2]])
            mat4.rotateX(model, model, obj.rotationX * (Math.PI / 180));;
            mat4.translate(model, model, obj.pivot); 
            mat4.scale(model, model, obj.scale);
        } else {
            mat4.translate(model, model, obj.translate);
            mat4.scale(model, model, obj.scale);    
        }

        const modelView = mat4.create();
        mat4.multiply(modelView, globalViewMat, model);
        const normalMat = mat3.create();
        mat3.normalFromMat4(normalMat, modelView); 

        gl.uniformMatrix4fv(uModel, false, model);
        gl.uniformMatrix3fv(uNormalMat, false, normalMat);
        gl.uniform3fv(uSpecular, obj.specular);
        gl.uniform1f(uShininess, obj.shininess);

        if (Array.isArray(obj.geometry)) {
            // 큐브 (면 분할 렌더링)
            obj.geometry.forEach((face, index) => {
                gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
                gl.bufferData(gl.ARRAY_BUFFER, face.positions, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, normalVBO);
                gl.bufferData(gl.ARRAY_BUFFER, face.normals, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
                gl.bufferData(gl.ARRAY_BUFFER, face.uvs, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, face.indices, gl.STATIC_DRAW);

                const targetFace = (obj.textureFaceIndex !== undefined) ? obj.textureFaceIndex : -1;

            // 현재 그리는 면(index)이 타겟 면(targetFace)과 같으면 텍스처 적용
            if (index === targetFace && obj.useTexture) {
                gl.uniform1i(uUseTex, 1);
                gl.uniform3fv(uDiffuse, [1,1,1]); 
            } else {
                gl.uniform1i(uUseTex, 0);
                gl.uniform3fv(uDiffuse, obj.diffuse);
            }
                
                gl.drawElements(gl.TRIANGLES, face.indices.length, gl.UNSIGNED_SHORT, 0);
            });

        } else {
            // 원통 & 구 (단일 렌더링)
            const geo = obj.geometry;
            gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.positions), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, normalVBO);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.normals), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.uvs), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indices), gl.STATIC_DRAW);

            gl.uniform1i(uUseTex, 0);
            gl.uniform3fv(uDiffuse, obj.diffuse);

            gl.drawElements(gl.TRIANGLES, geo.indices.length, gl.UNSIGNED_SHORT, 0);
        }
    });

    requestAnimationFrame(render);
}

// --------------------------------
// Utilities 
// --------------------------------


  // 셰이더 프로그램 생성 함수
  function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error linking program:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
}
// 셰이더 컴파일 함수
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
}

function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l === 0) return [0, 0, 0];
    return [v[0] / l, v[1] / l, v[2] / l];
}

function loadTexture(url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 120, 120, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            resolve(tex);
        };
        img.src = url;
    });
}

function makeFace(posArr, normArr) {
    return {
        positions: new Float32Array(posArr),
        normals: new Float32Array(normArr),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint16Array([0, 1, 2, 0, 2, 3])
    };
}

function createCubeFacesStandard() {
    return [
        makeFace([-0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5], [0,0,1, 0,0,1, 0,0,1, 0,0,1]), // Front
        makeFace([-0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,0.5,-0.5, 0.5,-0.5,-0.5], [0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1]), // Back
        makeFace([-0.5,0.5,-0.5, -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5], [0,1,0, 0,1,0, 0,1,0, 0,1,0]), // Top
        makeFace([-0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5], [0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0]), // Bottom
        makeFace([0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5], [1,0,0, 1,0,0, 1,0,0, 1,0,0]), // Right
        makeFace([-0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5], [-1,0,0, -1,0,0, -1,0,0, -1,0,0]) // Left
    ];
}


function createCylinder(radius, height, segments) {
    const positions = [];
    const normals = [];
    const indices = [];
    const uvs = []; 
    const h = height / 2;
    positions.push(0, h, 0); normals.push(0, 1, 0); uvs.push(0.5, 0.5);
    positions.push(0, -h, 0); normals.push(0, -1, 0); uvs.push(0.5, 0.5);
    let vertexIndex = 2;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * 2 * Math.PI;
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        const u = i / segments; 
        positions.push(x, h, z); normals.push(0, 1, 0); uvs.push(u, 0); 
        positions.push(x, -h, z); normals.push(0, -1, 0); uvs.push(u, 0);
        if (i < segments) {
            indices.push(0, vertexIndex + 2, vertexIndex); 
            indices.push(1, vertexIndex + 1, vertexIndex + 3); 
        }
        vertexIndex += 2;
    }
    const bodyBaseIndex = vertexIndex;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * 2 * Math.PI;
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        const n = normalize([x, 0, z]);
        const u = i / segments;
        positions.push(x, h, z); normals.push(...n); uvs.push(u, 1); 
        positions.push(x, -h, z); normals.push(...n); uvs.push(u, 0); 
        if (i < segments) {
            const v0 = bodyBaseIndex + (i * 2);
            const v1 = bodyBaseIndex + (i * 2) + 1;
            const v2 = bodyBaseIndex + (i * 2) + 2;
            const v3 = bodyBaseIndex + (i * 2) + 3;
            indices.push(v0, v1, v2);
            indices.push(v2, v1, v3);
        }
    }
    return { positions, normals, indices, uvs }; 
}

function createSphereSmooth(r, latBands, lonBands) {
  const positions = [],
    normals = [],
    indices = [],
    uvs = []; 
  for (let lat = 0; lat <= latBands; lat++) {
    const t = (lat * Math.PI) / latBands;

    for (let lon = 0; lon <= lonBands; lon++) {
      const p = (lon * 2 * Math.PI) / lonBands;

      const x = r * Math.sin(t) * Math.cos(p);
      const y = r * Math.cos(t);
      const z = r * Math.sin(t) * Math.sin(p);

      positions.push(x, y, z);

      const n = normalize([x, y, z]);
      normals.push(n[0], n[1], n[2]);

      const u = 1 - (lon / lonBands);
      const v = 1 - (lat / latBands);
      uvs.push(u, v);
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const i1 = lat * (lonBands + 1) + lon;
      const i2 = i1 + lonBands + 1;

      indices.push(i1, i2, i1 + 1);
      indices.push(i1 + 1, i2, i2 + 1);
    }
  }

  return { positions, normals, indices, uvs };
}