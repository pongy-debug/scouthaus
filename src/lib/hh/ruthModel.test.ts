import { readFileSync } from "node:fs";
import { Box3, Mesh } from "three";
import { expect, it } from "vitest";
import { buildRuthHouse } from "./ruthModel";

it("builds finite geometry for the two photographed rooms", () => {
  const { root, shell } = buildRuthHouse();
  const bounds = new Box3().setFromObject(root);
  expect(bounds.min.toArray().every(Number.isFinite)).toBe(true);
  expect(bounds.max.toArray().every(Number.isFinite)).toBe(true);
  expect(bounds.max.z - bounds.min.z).toBeGreaterThan(9);
  expect(root.getObjectByName("Oven glass door")).toBeDefined();
  expect(root.getObjectByName("Television")).toBeDefined();
  expect(shell.getObjectByName("Ceiling")).toBeDefined();
  root.traverse((node) => {
    if (node instanceof Mesh) {
      expect(Array.from(node.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      node.geometry.dispose();
    }
  });
});

it("exports a valid GLB container with reconstruction metadata", () => {
  const bytes = readFileSync("public/tours/first-ruth-house/first-ruth-house.glb");
  expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  const length = bytes.readUInt32LE(12);
  const scene = JSON.parse(bytes.toString("utf8", 20, 20 + length));
  expect(scene.nodes.some((node: { extras?: { description?: string } }) => node.extras?.description?.includes("Not a measured survey"))).toBe(true);
  expect(scene.meshes.length).toBeGreaterThan(200);
});
