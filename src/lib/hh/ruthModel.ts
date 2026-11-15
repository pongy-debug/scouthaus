// Photo-informed, approximate reconstruction. Units are estimated metres, not a measured floor plan.
// Imported only by the lazy tour scene and the model-export script.
import * as THREE from "three";

export function buildRuthHouse() {
  const root = new THREE.Group();
  root.name = "First Ruth House - approximate kitchen and lounge";
  root.userData = { description: "Reconstructed from four owner-supplied photographs. Dimensions, concealed surfaces and room layout are inferred. Not a measured survey.", units: "metres (estimated)" };
  const material = (color: string, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wall = material("#e8e3d7"), trim = material("#faf8ee"), cabinet = material("#bdbdb4"), stone = material("#a7a59b"), black = material("#202322"), steel = material("#a5aba7", 0.3, 0.75);
  const blue = material("#b4d6de", 0.25), sofa = material("#655563"), cushion = material("#3b414c"), chair = material("#244e50");
  const wood = ["#a69170", "#b29e7d", "#c1ad8d", "#ac9675", "#baa688"].map((c) => material(c));
  const box = (name: string, pos: [number, number, number], size: [number, number, number], mat: THREE.Material, parent: THREE.Group = root) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.name = name; mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const cylinder = (name: string, pos: [number, number, number], radius: number, height: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), mat); mesh.name = name; mesh.position.set(...pos); mesh.castShadow = true; root.add(mesh); return mesh;
  };

  // Long plank flooring through both photographed rooms.
  box("Floor base", [0, -0.11, 2.6], [3.7, 0.2, 9.5], wood[0]!);
  for (let col = 0; col < 18; col++) for (let row = 0; row < 10; row++) {
    const start = -2.1 + row * 0.94;
    box("Oak-effect plank", [-1.7 + col * 0.2, 0.005, start + 0.465], [0.196, 0.025, 0.928], wood[(col * 3 + row * 7) % wood.length]!);
  }
  const shell = new THREE.Group(); shell.name = "Cutaway walls and ceiling"; root.add(shell);
  box("Back kitchen wall", [0, 1.4, -2.18], [3.76, 2.8, 0.16], wall);
  box("Left wall", [-1.88, 1.4, 2.6], [0.16, 2.8, 9.5], wall);
  box("Right wall", [1.88, 1.4, 2.6], [0.16, 2.8, 9.5], wall, shell);
  box("Lounge end wall", [0, 1.4, 7.38], [3.76, 2.8, 0.16], wall, shell);
  box("Ceiling", [0, 2.85, 2.6], [3.76, 0.12, 9.5], wall, shell);
  // Wide opening visible between the two spaces; its width is inferred.
  box("Opening left pier", [-1.38, 1.4, 2.12], [0.86, 2.8, 0.18], wall);
  box("Opening right pier", [1.38, 1.4, 2.12], [0.86, 2.8, 0.18], wall, shell);
  box("Opening lintel", [0, 2.6, 2.12], [2, 0.4, 0.18], wall);
  box("Left skirting", [-1.78, 0.08, 2.6], [0.05, 0.16, 9.4], trim);
  box("Right skirting", [1.78, 0.08, 2.6], [0.05, 0.16, 9.4], trim, shell);

  function windowUnit(name: string, pos: [number, number, number], rotation: number, width: number, blind = false) {
    const frame = new THREE.Group(); frame.name = name; frame.position.set(...pos); frame.rotation.y = rotation; root.add(frame);
    box("Window daylight", [0, 0, 0], [width, 1.25, 0.035], blue, frame);
    for (const x of [-width / 2, width / 2]) box("White window frame", [x, 0, 0.04], [0.055, 1.34, 0.08], trim, frame);
    for (const y of [-0.65, 0.24, 0.65]) box("Window crossbar", [0, y, 0.055], [width + 0.08, 0.055, 0.08], trim, frame);
    box("Window sill", [0, -0.69, 0.1], [width + 0.18, 0.06, 0.25], trim, frame);
    if (blind) box("Roller blind", [0, 0.39, 0.09], [width - 0.03, 0.48, 0.04], material("#cec9bd"), frame);
  }
  windowUnit("Kitchen window with blind", [1.775, 1.8, 0.25], -Math.PI / 2, 1.4, true);
  windowUnit("Lounge side window one", [-1.775, 1.8, 3.7], Math.PI / 2, 0.9);
  windowUnit("Lounge side window two", [-1.775, 1.8, 5.75], Math.PI / 2, 0.9);
  windowUnit("Lounge end window", [0, 1.8, 7.275], Math.PI, 1.1);

  function cupboard(x: number, z: number, angle = 0, upper = false) {
    const unit = new THREE.Group(); unit.name = upper ? "Upper cabinet" : "Base cabinet"; unit.position.set(x, 0, z); unit.rotation.y = angle; root.add(unit);
    const y = upper ? 2.06 : 0.48, height = upper ? 0.78 : 0.83, depth = upper ? 0.34 : 0.6;
    box("Cabinet body", [0, y, 0], [0.59, height, depth], cabinet, unit);
    box("Cabinet door", [0, y, depth / 2 + 0.015], [0.575, height - 0.02, 0.025], cabinet, unit);
    box("Black pull handle", [0, upper ? y - 0.34 : y + 0.31, depth / 2 + 0.045], [0.41, 0.025, 0.035], black, unit);
    if (!upper) box("Recessed plinth", [0, 0.06, 0], [0.59, 0.12, 0.48], black, unit);
  }
  for (const x of [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]) { if (x !== -0.9) cupboard(x, -1.78); cupboard(x, -1.92, 0, true); }
  box("Back worktop", [0, 0.93, -1.77], [3.6, 0.065, 0.65], stone);
  box("Grey splashback", [0, 1.29, -2.065], [3.6, 0.66, 0.04], stone);
  for (const z of [-1.1, -0.5, 0.1, 0.7, 1.3]) cupboard(1.49, z, -Math.PI / 2);
  box("Window worktop", [1.48, 0.93, 0.1], [0.65, 0.065, 3.05], stone);
  box("Oven stainless body", [-0.9, 0.47, -1.78], [0.59, 0.83, 0.61], steel);
  box("Oven glass door", [-0.9, 0.39, -1.455], [0.49, 0.56, 0.025], black);
  box("Oven handle", [-0.9, 0.66, -1.405], [0.43, 0.035, 0.045], steel);
  box("Black ceramic hob", [-0.9, 0.972, -1.77], [0.59, 0.02, 0.53], black);
  for (const x of [-1.05, -0.76]) for (const z of [-1.92, -1.64]) cylinder("Hob ring", [x, 0.986, z], 0.09, 0.006, steel);
  box("Steel cooker splashback", [-0.9, 1.36, -2.03], [0.6, 0.77, 0.045], steel);
  box("Extractor hood", [-0.9, 1.72, -1.84], [0.62, 0.075, 0.45], steel);
  box("Sink rim", [0.75, 0.976, -1.77], [0.6, 0.018, 0.45], steel);
  box("Sink basin", [0.75, 0.987, -1.77], [0.44, 0.01, 0.33], material("#535e61", 0.3, 0.6));
  cylinder("Tap stem", [0.75, 1.12, -1.98], 0.025, 0.28, steel);
  box("Tap spout", [0.75, 1.25, -1.9], [0.04, 0.035, 0.2], steel);
  box("Microwave", [1.46, 1.12, 0.55], [0.45, 0.32, 0.52], steel);
  box("Microwave glass", [1.22, 1.12, 0.55], [0.02, 0.23, 0.4], black);
  cylinder("Kitchen bin", [0.9, 0.33, -0.8], 0.17, 0.66, steel);
  cylinder("Bin lid", [0.9, 0.67, -0.8], 0.18, 0.035, black);
  box("Small dining table", [-1.02, 0.76, 1.07], [1.25, 0.06, 0.72], trim);
  for (const x of [-1.54, -0.5]) for (const z of [0.8, 1.34]) box("Table leg", [x, 0.37, z], [0.045, 0.74, 0.045], black);
  box("Dining chair seat", [-0.95, 0.44, 1.68], [0.43, 0.05, 0.42], trim);
  box("Dining chair back", [-0.95, 0.69, 1.87], [0.43, 0.5, 0.04], trim);

  // Lounge furniture visible in the supplied view.
  box("Sofa base", [-1.26, 0.3, 5.35], [0.9, 0.38, 2.15], sofa);
  box("Sofa back", [-1.64, 0.67, 5.35], [0.18, 0.63, 2.15], sofa);
  for (const z of [4.34, 6.36]) box("Sofa arm", [-1.25, 0.61, z], [0.9, 0.48, 0.14], sofa);
  for (const z of [4.84, 5.84]) box("Sofa seat cushion", [-1.19, 0.53, z], [0.72, 0.14, 0.93], cushion);
  for (const z of [4.46, 6.24]) for (const x of [-1.58, -0.92]) box("Sofa foot", [x, 0.1, z], [0.05, 0.2, 0.05], black);
  box("Teal armchair seat", [-1.17, 0.43, 3.25], [0.75, 0.18, 0.72], chair);
  box("Teal armchair back", [-1.17, 0.72, 2.94], [0.75, 0.67, 0.16], chair);
  for (const x of [-1.51, -0.83]) box("Armchair arm", [x, 0.6, 3.25], [0.12, 0.4, 0.72], chair);
  box("Media cabinet", [1.5, 0.44, 5.3], [0.48, 0.7, 2.15], trim);
  box("TV backing panel", [1.7, 1.3, 5.3], [0.12, 2.1, 1.5], cabinet);
  box("Television", [1.36, 1.2, 5.3], [0.07, 0.72, 1.25], black);
  box("TV display", [1.315, 1.2, 5.3], [0.008, 0.64, 1.15], material("#263341", 0.2));
  box("Lounge radiator", [0, 0.58, 7.12], [1.3, 0.8, 0.16], trim);
  for (let i = 0; i < 13; i++) box("Radiator vent", [-0.58 + i * 0.095, 0.87, 7.025], [0.065, 0.025, 0.015], black);
  cylinder("Pendant cable", [0, 2.52, 5], 0.008, 0.53, black);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.14, 32, 1, true), steel); shade.position.set(0, 2.24, 5); shade.name = "Pendant lampshade"; root.add(shade);
  return { root, shell };
}
