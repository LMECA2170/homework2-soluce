const m4 = twgl.m4;




const canvas = document.getElementById("glcanvas");
let gl;
// Affichage des indices via HTML
const divContainerElement = document.querySelector("#divcontainer");
var divSetNdx = 0;
var divSets = [];

const triangleCheckHTML = document.getElementById("triangles");
const pointsCheckHTML = document.getElementById("points");

// Construction du maillage
var [pointArr, triangleArr] = loadArrayFromJson(meshData);
var mesh = createMesh(meshData);

// Coordonnees des points isoles 
// var isolatedPoints = [[2.5, 1.0],
//             [0.0, 2.0],
//             [-2.0, -1.0],
//         ]; 
var isolatedPoints =[];



document.getElementById("halfEdgeDescription").innerText = meshToString(mesh);


// Description des triangles par des triplets d'indices des points
let xMin = Number.MAX_VALUE;
let yMin = Number.MAX_VALUE;
let xMax = Number.MIN_VALUE;
let yMax = Number.MIN_VALUE;
for (node of mesh.nodes) {
    xMax = Math.max(xMax, node.pos[0]);
    xMin = Math.min(xMin, node.pos[0]);
    yMax = Math.max(yMax, node.pos[1]);
    yMin = Math.min(yMin, node.pos[1]);
}
const xRange = xMax - xMin;
const yRange = yMax - yMin;

let projectionMatrix;
let cameraMatrix;
let viewMatrix;
let worldMatrix;
let viewProjection;
let viewProjectionWorld;
let inverse;

let startInverseMatrix;
let startCamera;
let startPos;
let startClipPos;
let startMousePos;
let startViewProjWorld;

const cameraParam = {
    x: (xMin+xMax)/2,
    y: (yMin+yMax)/2,
    z: 0.6*Math.max(xRange, yRange)/Math.tan(45 * Math.PI / 180/2),
    zoom: 0.6*Math.max(xRange, yRange)/Math.tan(45 * Math.PI / 180/2),
}

function loadArrayFromJson(jsonObject){
    var data_el = meshData["Elements"];
    var triangleArr = [];
    for (let i = 0; i < data_el.length; i++){
        if (data_el[i]["Type"] == 2) {
            triangleArr = data_el[i]["NodalConnectivity"];
        }
        
    } 
    var pointArr = [];
    var data_nodes = meshData["Nodes"][0];
    for (let i = 0; i < data_nodes["Indices"].length; i++){
        pointArr[data_nodes["Indices"][i]] = data_nodes["Coordinates"][i];
    }
    return [pointArr, triangleArr];
}

main();

function main() {
    
    gl = canvas.getContext("webgl") || canvas.getContext("expermimental-webgl");
    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }

    gl.getExtension('GL_OES_standard_derivatives');
    gl.getExtension('OES_standard_derivatives');

    const vsSource = `
        precision mediump float;
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;

        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uWorldMatrix;
        
        varying lowp vec4 vColor;

        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * uWorldMatrix * aVertexPosition;
            gl_PointSize = 8.0;
            vColor = aVertexColor;
    }`;

    const fsPointSource = `

        #ifdef GL_OES_standard_derivatives
        #extension GL_OES_standard_derivatives : enable
        #endif

        precision mediump float;
        varying  vec4 vColor;
        
        void
        main()
        {
            float r = 0.0, delta = 0.0, alpha = 1.0;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            r = dot(cxy, cxy);
        #ifdef GL_OES_standard_derivatives
            delta = fwidth(r);
            alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);   
        #endif 
            if (alpha < 0.45){
                discard;
            }
            gl_FragColor = vColor * (alpha);
    }`;
    
    const fsSource = `
        precision mediump float;

        varying lowp vec4 vColor;

        void main() {
            gl_FragColor = vColor;
    }`;
    
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const shaderProgramPoint = initShaderProgram(gl, vsSource, fsPointSource);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
          vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
          vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(shaderProgram, 'uViewMatrix'),
            worldMatrix: gl.getUniformLocation(shaderProgram, 'uWorldMatrix'),
        },
      };
    const programPointInfo = {
    program: shaderProgramPoint,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgramPoint, 'aVertexPosition'),
            vertexColor: gl.getAttribLocation(shaderProgramPoint, 'aVertexColor'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgramPoint, 'uProjectionMatrix'),
            viewMatrix: gl.getUniformLocation(shaderProgramPoint, 'uViewMatrix'),
            worldMatrix: gl.getUniformLocation(shaderProgramPoint, 'uWorldMatrix'),
        },
    };
    const program = [programInfo, programPointInfo];

    var buffers = initBuffers(gl, mesh, isolatedPoints);

    drawScene(gl, program, buffers, mesh, isolatedPoints);

    [triangleCheckHTML, pointsCheckHTML].forEach((elem)=>{
        elem.addEventListener("input", 
            ()=> {drawScene(gl, program, buffers, mesh, isolatedPoints)})
    })

    divContainerElement.addEventListener('wheel', handleMouseWheel);

    function handleMouseWheel(e){
        const [clipX, clipY] = getClipSpaceMousePosition(e);
        if (Math.abs(clipX) > 1 || Math.abs(clipY) > 1) return; // si zoom en dehors, ne fait rien

        e.preventDefault(); // empêche le scrolling dans le canvas

        var delta = e.deltaY > 0 ? 0.05 : -0.05;
        const newZoom = cameraParam.zoom* Math.pow(2, delta);
        cameraParam.zoom = Math.max(0.02, Math.min(100, newZoom)); // ZoomMin = 0.02, ZoomMax = 100
        cameraParam.z = newZoom;

        drawScene(gl, program, buffers, mesh, isolatedPoints);
    }

    divContainerElement.addEventListener('mousedown', (e) => {
        e.preventDefault();
        divContainerElement.addEventListener('mousemove', handleMouseMove);
        divContainerElement.addEventListener('mouseup', handleMouseUp);
      
        startInverseMatrix = inverseMatrix;
        startViewProjWorld = viewProjectionWorld;
        startCamera = Object.assign({}, cameraParam);

        const [clipX, clipY] = getClipSpaceMousePosition(e);
        const clipZ = m4.transformPoint(startViewProjWorld, [0, 0, 0]);
        startClipPos = [clipX, clipY, clipZ[2]];
        startPos = m4.transformPoint(startInverseMatrix, startClipPos);
        startMousePos = [e.clientX, e.clientY];
        drawScene(gl, program, buffers, mesh, isolatedPoints);
    });

    function handleMouseMove(e) {
        moveCamera(e);
    }
      
    function handleMouseUp(e) {
        drawScene(gl, program, buffers, mesh, isolatedPoints);
        divContainerElement.removeEventListener('mousemove', handleMouseMove);
        divContainerElement.removeEventListener('mouseup', handleMouseUp);
    }

    function moveCamera(e) {
        let [clipX, clipY] = getClipSpaceMousePosition(e);
        const clipZ = m4.transformPoint(startViewProjWorld, [0, 0, 0]);
        let pos = m4.transformPoint(startInverseMatrix, [clipX, clipY, clipZ[2]]);
        cameraParam.x = startCamera.x + startPos[0] - pos[0];
        cameraParam.y = startCamera.y + startPos[1] - pos[1];
        drawScene(gl, program, buffers, mesh, isolatedPoints);
    }

    divContainerElement.addEventListener('click', (e) => {
        let [clipX, clipY] = getClipSpaceMousePosition(e);
        const clipZ = m4.transformPoint(startViewProjWorld, [0, 0, 0]);
        let pos = m4.transformPoint(startInverseMatrix, [clipX, clipY, clipZ[2]]);
        // newNode = {id: mesh.nodes.length, pos: [pos[0], pos[1], pos[2]]};
        // console.log(mesh.nodes.length);
		insertNode(mesh, [pos[0], pos[1], pos[2]]);
        buffers = initBuffers(gl, mesh, isolatedPoints);
        drawScene(gl, program, buffers, mesh, isolatedPoints);
        document.getElementById("halfEdgeDescription").innerText = meshToString(mesh);
    })

}

function initBuffers(gl, mesh, isolatedPoints) {
    let nP = mesh.nodes.length;
    let nT = mesh.faces.length;
    let nI = isolatedPoints.length;

    let pointsCoord = [];
    for (let i = 0; i < nP; i++) {
        pointsCoord[i] = mesh.nodes[i].pos.slice();               // slice empêche l'aliasing
        pointsCoord[i][2] = -1e-5;                          // Profondeur des triangles
        pointsCoord[i+nP] = mesh.nodes[i].pos.slice();
        pointsCoord[i+nP][2] = 0.0;                         // Profondeur du maillage
        pointsCoord[i+nP*2] = mesh.nodes[i].pos.slice();
        pointsCoord[i+nP*2][2] = 1e-5;                      // Profondeur des points
    }
    // console.log("pointsCoord", pointsCoord);


    let isolatedPointsCoord = isolatedPoints.slice();
    for (let i = 0; i < nI; i++){
        isolatedPointsCoord[i][2] = 2e-5;
    }
    // console.log("isolatedPointsCoord", isolatedPointsCoord);


    const triangleIdx = [];
    // for (let i = 0; i < nI; i++){ // Pour chaque point isolé
    //     for (let j = 0; j < nT; j++){
    //         let a = pointsCoord[triangleList[j][0]];
    //         let b = pointsCoord[triangleList[j][1]];
    //         let c = pointsCoord[triangleList[j][2]];
    //         if (isPointInTriangle(isolatedPointsCoord[i], a, b, c)){
    //             triangleIdx.push(triangleList[j][0], triangleList[j][1], triangleList[j][2]);
    //         }  // ce triangle est a colorier car il y a un des points isoles dedans
    //     }
    // }
    // console.log("TriangleIdx", triangleIdx);


    const positions = pointsCoord.concat(isolatedPointsCoord).flat();
    // console.log("positions", positions);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    let color = [];
    for (let i = 0; i < nP; i++) { 
        color[i*4] = 0.8;       // RED      // Couleur du triangle plein
        color[i*4+1] = 0.4;     // GREEN
        color[i*4+2] = 0.3;     // BLUE
        color[i*4+3] = 0.5;     // ALPHA

        color[(nP+i)*4] = 0.0;              // Couleur du maillage
        color[(nP+i)*4+1] = 0.0;
        color[(nP+i)*4+2] = 0.0;
        color[(nP+i)*4+3] = 1.0;

        color[(nP*2+i)*4] = 0.0;            // Couleur des points
        color[(nP*2+i)*4+1] = 0.0;
        color[(nP*2+i)*4+2] = 0.0;
        color[(nP*2+i)*4+3] = 1.0;
    }

    for (let i = 0; i < nI; i++){ 
        color[(nP*3+i)*4] = 0.3;            // Couleur des points isolés
        color[(nP*3+i)*4+1] = 0.7;
        color[(nP*3+i)*4+2] = 0.4;
        color[(nP*3+i)*4+3] = 1.0;
    }
    // console.log("Color", color);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(color), gl.STATIC_DRAW);

    // Indices of edges
    let meshIdx = [];
    for (face of mesh.faces) {
        e = face.incidentEdge;
        do {
            meshIdx.push(e.orig.id+nP);
            meshIdx.push(e.dest.id+nP);
            e = e.next;
        } while (e != face.incidentEdge);
    }

    // for (let i = 0; i < nT; i++) {
    //     meshIdx[i*6] = triangleList[i][0]+nP;    // on change le format de la liste d'indice
    //     meshIdx[i*6+1] = triangleList[i][1]+nP;  //  [A,B,C] -> [A,B,B,C,C,A]
    //     meshIdx[i*6+2] = triangleList[i][0]+nP;
    //     meshIdx[i*6+3]= triangleList[i][2]+nP;
    //     meshIdx[i*6+4]= triangleList[i][1]+nP;
    //     meshIdx[i*6+5]= triangleList[i][2]+nP;
    // }
    // console.log("Triangle Array : ", triangleList);
    // console.log("Mesh Indices : ", meshIdx);

    const idx = meshIdx.concat(triangleIdx);
    // console.log("IDX : ", idx);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        color: colorBuffer,
        indices : indexBuffer,
        pointsCoord: pointsCoord,
        triangleIdx: triangleIdx,
        isolatedPointsCoord: isolatedPointsCoord,
    };
}


function drawScene(gl, program, buffers, mesh){

    let programInfo = program[0];
    let programPointInfo = program[1];

    gl.clearColor(0.7, 0.7, 0.7, 0.8);  // coulour d'effacement
    gl.clearDepth(1.0);                 
    gl.enable(gl.DEPTH_TEST);           // test de profondeur, on affiche pas ce qui est caché
    gl.depthFunc(gl.LESS);              // les choses proches cachent les choses lointaines, si même profondeur seul la premiere appelee est dessinee 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let nP = mesh.nodes.length;
    let nT = mesh.faces.length;
    let nI = isolatedPoints.length;

    updateMatrix();
    
    // ---------------------Premier Programme ------------------------ //

    // Positions
    const numComponents = 3;  // extraire 3 valeurs par itération
    const type = gl.FLOAT;    // les données dans le tampon sont des flottants 32bit
    const normalize = false;  // ne pas normaliser
    const stride = 0;         // combien d'octets à extraire entre un jeu de valeurs et le suivant
    // 0 = utiliser le type et numComponents ci-dessus ici: 3*Float32Array.BYTES_PER_ELEMENT ou aussi gl.FLOAT
    const offset = 0;         // démarrer à partir de combien d'octets dans le tampon ie: l'array

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);


    // Couleurs
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    
    gl.useProgram(programInfo.program);
    
    // Définir les uniformes du shader              
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.worldMatrix, false, worldMatrix);

    gl.drawElements(gl.LINES, nT*6, gl.UNSIGNED_SHORT, 0); 
    gl.drawElements(gl.TRIANGLES, buffers.triangleIdx.length, gl.UNSIGNED_SHORT, nT*12); 
    

    // ---------------------Deuxieme Programme ------------------------ //

    // Positions
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.enableVertexAttribArray(programPointInfo.attribLocations.vertexPosition);
    gl.vertexAttribPointer(programPointInfo.attribLocations.vertexPosition,
                3, gl.FLOAT, false, 0, 0);
                
    // Couleurs
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.enableVertexAttribArray(programPointInfo.attribLocations.vertexColor);
    gl.vertexAttribPointer(programPointInfo.attribLocations.vertexColor,
                4, gl.FLOAT, false, 0, 0);
    
    gl.useProgram(programPointInfo.program);

    // Uniforme pour ce programme             
    gl.uniformMatrix4fv(programPointInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programPointInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(programPointInfo.uniformLocations.worldMatrix, false, worldMatrix);

    gl.drawArrays(gl.POINTS, 2*nP, nP+nI);      
    
    // Affichage des noms des points et des triangles via HTML

    if (pointsCheckHTML.checked){
        for (node of mesh.nodes){
            let clipspace = m4.transformPoint(viewProjectionWorld, [node.pos[0], node.pos[1], 0.0]);
            if (Math.abs(clipspace[0]) > 1 || Math.abs(clipspace[1]) > 1) continue;
            let pixelX = (clipspace[0] *  0.5 + 0.5) * gl.canvas.width;
            let pixelY = (clipspace[1] * -0.5 + 0.5) * gl.canvas.height;
    
            addDivSet(`${node.id}`, pixelX, pixelY, "blue");
        }
    }
    
    if (triangleCheckHTML.checked) {
        // Compute barycenter of triangle
        for (face of mesh.faces){
            nodes = []; // nodes of current triangle
            e = face.incidentEdge;
            do {
                nodes.push(e.orig);
                e = e.next;
            } while(e != face.incidentEdge);
            let centre = [0.0, 0.0, 0.0];
            for (i = 0; i < 3; i++) {
                for (d = 0; d < 2; d++) {
                    centre[d] += nodes[i].pos[d] / 3;
                }
            }
            // let a = mesh.nodes[triangleArr[i][0]];
            // let b = mesh.nodes[triangleArr[i][1]];
            // let c = mesh.nodes[triangleArr[i][2]];
            // let centre = [(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3, 0.0]
            
            let clipspace = m4.transformPoint(viewProjectionWorld, centre);

            if (Math.abs(clipspace[0]) > 1 || Math.abs(clipspace[1]) > 1) continue; // pas afficher si en dehors
            let pixelX = (clipspace[0] *  0.5 + 0.5) * gl.canvas.width;
            let pixelY = (clipspace[1] * -0.5 + 0.5) * gl.canvas.height;

            addDivSet(`${face.id}`, pixelX, pixelY, "black", true);
        }
    }
    resetDivSets();
}                                          


// Crée un shader du type donné, upload le code source et le compile
function loadShader(gl, type, source) {

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);  
    gl.compileShader(shader);
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
}

// Initialise un programme de shader
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }

function isPointInTriangle(p, a, b, c) {
    let det = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

    return  det * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0 &&
            det * ((c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0])) >= 0 &&
            det * ((a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0])) >= 0    
}

function resetDivSets() {
    for (; divSetNdx < divSets.length; ++divSetNdx) {
      divSets[divSetNdx].style.display = "none";
    }
    divSetNdx = 0;
}

function addDivSet(msg, x, y, color="black", isTriangle = false) {
    
    var divSet = divSets[divSetNdx++];

    if (!divSet) { // Si n'existe pas, la creer
      divSet = {};
      divSet.div = document.createElement("div");
      divSet.textNode = document.createTextNode("");
      divSet.style = divSet.div.style;
      divSet.div.className = "floating-div";

      // Ajout du texte au noeud
      divSet.div.appendChild(divSet.textNode);

      // Ajout de la div au container
      divContainerElement.appendChild(divSet.div);
      divSets.push(divSet);
    }

    // Affichage et style
    divSet.style.display = "block";
    if (isTriangle){
        divSet.style.left = Math.floor(x) -5 + "px";
        divSet.style.top = Math.floor(y) -10+ "px";
    }else{
        divSet.style.left = Math.floor(x) + "px";
        divSet.style.top = Math.floor(y) + "px";
        divSet.style.margin = "1px"
    }
    divSet.style.color = color;
    divSet.textNode.nodeValue = msg;
}

function updateMatrix(){
    const fieldOfView = 45 * Math.PI / 180;   // en radians champ de vision
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight; //taille d'affichage du canvas
    const zNear = 0.01;  //profondeur min = 1er plan
    const zFar =  1000; //profondeur max = arrière plan
    projectionMatrix = m4.perspective(fieldOfView, aspect, zNear, zFar);
    cameraMatrix = m4.lookAt(
                [cameraParam.x, cameraParam.y, cameraParam.z],    // Position de la caméra
                [cameraParam.x, cameraParam.y, 0.0],    // Point que regarde la caméra
                [0.0, 1.0, 0.0]);    // Direction du haut

    viewMatrix = m4.inverse(cameraMatrix);

    worldMatrix = m4.translation([0, 0, 0]);  // Matrice identité

    viewProjection = m4.multiply(projectionMatrix, viewMatrix);
    viewProjectionWorld = m4.multiply(viewProjection, worldMatrix);
    inverseMatrix = m4.inverse(viewProjectionWorld);
}

function getClipSpaceMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    let pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
    let pixelY = mouseY * gl.canvas.height / gl.canvas.clientHeight;

    clipX = pixelX / gl.canvas.width  *  2 - 1;
    clipY = pixelY / gl.canvas.height * -2 + 1;

    return [clipX, clipY];
}

// MESH DESCRIPTION
function meshToString(mesh) {

    function edgeToString(e) {
        if (e == null) return null;
        else return '(' + e.orig.id + ' → ' + e.dest.id + ')';
    }

    str = '';
    for (e of mesh.edges) {
        str += `${edgeToString(e)} is incident to face ${e.incidentFace.id}, next is ${edgeToString(e.next)}, twin is ${edgeToString(e.twin)}.\n`;
    }
    for (f of mesh.faces) {
        str += `Face ${f.id} has ${edgeToString(f.incidentEdge)} as incident edge.\n`;
    }
    
    return str;
}

