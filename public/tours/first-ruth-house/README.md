# First Ruth House virtual tour

The original four photos were supplied by the user for this tour. The GLB is a procedural, photo-informed reconstruction of the visible kitchen and lounge only, not a photogrammetric scan or measured floor plan. Dimensions, concealed surfaces, furniture proportions and room connectivity are approximate. Small belongings and clutter are omitted. No unseen bedrooms, bathrooms or exterior have been invented.

Open `/tour/first-ruth-house` in the app, or import `first-ruth-house.glb` into a GLB-compatible viewer or 3D editor. The app hides the right wall, far wall and ceiling in its cutaway overview; the downloaded model includes those surfaces in the named “Cutaway walls and ceiling” group.

Model source: `src/lib/hh/ruthModel.ts`. Rebuild the GLB with `node --experimental-strip-types scripts/export-ruth-model.mjs` after changing the geometry. This model is standalone until the owner confirms which current property listing it should belong to.
