# Homework 2 - Half-Edges

This homework is purely algorithmic: we are not going to do any OpenGL (🎉).

You are going to build and work with a *double-connected edge list*, one of the most versatile data structures for representing geometric subdivisions.
This data structure will be the foundation for the project coming up, so it is important that you have a good understanding of it.
If you are not completely familiar with doubly-connected edge lists, we recommend you read Section 2.2 of the book before starting the homework.

There are 2 tasks to complete (in `homework.js`):
1. Given a mesh described in a JSON file as in homework 1, build a `mesh` object with the following structure:
   - `mesh.nodes`: an array of nodes; a `node` has structure
     - `node.id`: a unique integer identifying the node (use the indices given in the JSON file),
     - `node.pos`: a pair of coordinates representing the position of the node.
   - `mesh.faces`: an array of faces; a `face` has structure
     - `face.id`: a unique integer identifying the face (use the indices given in the JSON file),
     - `face.incidentEdge`: *one* (!) edge that is incident to `face`, i.e., has `face` on its left side.
   - `mesh.edges`: an array of (half-)edges; an `edge` has structure
     - `edge.orig`: the origin node of the half-edge,
     - `edge.dest`: the destination node of the half-edge,
     - `edge.incidentFace`: the face to the left of the half-edge,
     - `edge.next`: the next half-edge on the boundary of the incident face,
     - `edge.twin`: the opposite half-edge.
2. Given a pair of coordinates, create a new node, connect the node to the 3 nodes of the corresponding face, and most importantly: *update the subdivision data structure correctly*. A new node is created when clicking on the canvas (already implemented).

Under the visualization (which is kindly implemented for you), a description of each half-edge and face is given, which will allow you (and us) to check that your implementation is correct.

Completing the two tasks _perfectly_ will grant you the maximal grade.
Here are suggestions of bonus tasks (but we encourage you to be creative!):
- Visualize the half-edges in a pretty way,
- Allow new nodes to be added *outside* an existing triangle; there are several ways to do this, we just want your implementation to be *robust*.

| Task | Points | 
| --- | --- | 
| `createMesh` | 10 | 
| `insertNode` | 10 |
| Bonus: visualization | 2 |
| Bonus: node outside triangle | 2 |
| Other bonus: | ∞ |
| --- | --- | 
| Total | 20 | 

## Practical information
- **Groups:** *The groups must be the same for the 3 homeworks and the project*
- **Collaboration:** *You are allowed, and even encouraged, to exchange ideas on how to  
address this assignment with students from other groups.  However, you must  
do all the writing (report and codes) only with your own group; it is strictly  
forbidden to share the production of your group. Plagiarism will be checked.*
- **Writing:** *You write a small report (in `report.md`) explaining what you have done, especially if  
you went further than asked.*
- **Language:** *All reports and communications are equally accepted in French and English.*
- **Deliverables:** *Each group is asked to submit their project on the github classroom:*
  - *A Read Me file shortly explaining your work,*  
  - *The  .hmtl,  .css,  .js and  .json files.*
- **Deadline:** *The homework is due for the Monday 14 November at 12:45* 
- **Questions:** *You can adress questions by sending an email to the teaching assistants (matteo.couplet@uclouvain.be, antoine.quiriny@uclouvain.be). Direct messages on Teams will not be considered*
