
function createMesh(meshData) {
	// Initialize mesh data structure
	mesh = {
		nodes: [], nodeID: 0,
		faces: [], faceID: 0,
		edges: [],
	};

	// We assume nodes are numbered 0..n-1
	nodeData = meshData.Nodes[0];
	elemData = meshData.Elements[1];

	// Create nodes
	for (i = 0; i < nodeData.Indices.length; i++) {
		mesh.nodes.push({
			id: 	nodeData.Indices[i],
			pos: 	nodeData.Coordinates[i]
		})
		mesh.nodeID = Math.max(mesh.nodeID, nodeData.Indices[i]) + 1;
	}

	// Create faces and half-edges
	nodePairToEdge = {}
	for (i = 0; i < elemData.Indices.length; i++) {
		mesh.faces.push(face = {id: elemData.Indices[i], incidentEdge: null});
		mesh.faceID = Math.max(mesh.faceID, elemData.Indices[i]) + 1;
		nodes = elemData.NodalConnectivity[i];
		edges = []
		for (j = 0; j < 3; j++) {
			edges.push(edge = {
				orig: mesh.nodes[nodes[j]], 
				dest: mesh.nodes[nodes[(j+1)%3]], 
				next: null,
				twin: null,
				incidentFace: face,
			});
			if ([edge.dest.id, edge.orig.id] in nodePairToEdge) {
				edge.twin = nodePairToEdge[[edge.dest.id, edge.orig.id]];
				// console.log(`${edge.orig.id}, ${edge.dest.id}, ${edge.twin.orig.id}, ${edge.twin.dest.id}`);
				edge.twin.twin = edge;
			} else nodePairToEdge[[edge.orig.id, edge.dest.id]] = edge;
		}
		for (j = 0; j < 3; j++) {
			edges[j].next = edges[(j+1)%3];
			mesh.edges.push(edges[j]);
		}
		face.incidentEdge = edges[0];
	}

	// console.log(nodePairToEdge);

	console.log(mesh);

	return mesh;
}

// Cross product of 2D vectors
function cross(u, v) {
	return u[0]*v[1] - u[1]*v[0];
}	
// Side of node wrt half-edge: positive if left, negative if right
function side(node, edge) {
	u = [edge.dest.pos[0] - edge.orig.pos[0], edge.dest.pos[1] - edge.orig.pos[1]];
	v = [node.pos[0]      - edge.orig.pos[0], node.pos[1]      - edge.orig.pos[1]];
	return cross(u, v);
}

function insertNode(mesh, pos) {
	newNode = {id: mesh.nodeID++, pos: pos};
	// First locate face containing the new node
	for (face of mesh.faces) {
		inFace = true;
		he = face.incidentEdge;
		do {
			if (side(newNode, he) <= 0) {
				inFace = false;
				break;
			}
			he = he.next;
		} while(he != face.incidentEdge);
		if (inFace) {
			console.log("face: ", face);
			faceToTriangulate = face;
			break;
		}
	}

	// Store half-edges of face to be triangulated, and create new faces
	faceEdges = [];
	newFaces = [];
	e = faceToTriangulate.incidentEdge;
	do {
		faceEdges.push(e);
		face = {id: mesh.faceID++, incidentEdge: e};
		newFaces.push(face);
		e.incidentFace = face;
		e = e.next;
	} while (e != faceToTriangulate.incidentEdge);
	nNew = newFaces.length; // number of new triangles

	// Create new (internal) half-edges
	inEdges = []; // inward half-edges
	outEdges = []; // outward half-edges
	for (i = 0; i < nNew; i++) {
		// he, inEdge, outEdge form a triangle :-)
		edge = faceEdges[i], newFace = newFaces[i];
		inEdges.push({ orig: edge.dest, dest: newNode,   incidentFace: newFace});
		outEdges.push({orig: newNode,   dest: edge.orig, incidentFace: newFace});
	}
	// Update half-edges connections
	for (i = 0; i < nNew; i++) {
		faceEdges[i].next = inEdges[i];
		inEdges[i].next = outEdges[i];
		inEdges[i].twin = outEdges[(i+1)%nNew];
		outEdges[i].next = faceEdges[i];
		outEdges[i].twin = inEdges[(i-1+nNew)%nNew];
	}

	// Update mesh data structure
	mesh.nodes.push(newNode);
	mesh.faces.splice(mesh.faces.indexOf(faceToTriangulate), 1) // remove triangulated face
	mesh.faces.push(...newFaces);
	mesh.edges.push(...inEdges);
	mesh.edges.push(...outEdges);
}