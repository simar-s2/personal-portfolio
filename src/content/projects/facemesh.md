---
title: FaceMesh
order: 4
category: Machine learning
blurb: One PyTorch network that animates 3D faces and cleans up noisy face scans, with USD export for Blender.
summary: One PyTorch network that does two jobs. Give it someone's resting face and an expression, and it animates the face. Give it a messy 3D scan, and it returns a clean mesh with the same layout as every other face. The output opens in Blender.
pill: 5x better than baseline
repo: https://github.com/simar-s2/facemesh
stack: [Python, PyTorch, Docker, AWS, Blender]
results:
  - label: Scan cleanup, seen people
    value: 0.83 mm
    note: Average error, against 4.32 mm for just outputting the average face. About 5x better.
  - label: Expressions, seen people
    value: 0.45 mm
    note: Against 1.41 mm for the baseline, the average movement for each expression. About 3x better.
  - label: Scan cleanup, new people
    value: 2.59 mm
    note: On people left out of training completely, against 5.28 mm for the average face. About 2x better.
  - label: Training data
    value: '20,465'
    note: 3D face meshes from the CoMA dataset, with 12 people each making 12 expressions.
problem:
  - Raw 3D scans of faces are messy. They are clouds of points with noise, holes and stray points, in no particular order, so you can't animate them. Animation needs a mesh where every point always means the same part of the face.
  - Animating a face and cleaning up a scan look like separate problems, but both come down to knowing what faces look like. I wanted to see whether one shared encoder could do both, and whether the model was really learning anything beyond the average.
pipeline:
  - name: Points
    note: a resting face or a noisy scan
  - name: Encoder
    note: PointNet, order doesn't matter
  - name: Code
    note: 256 numbers describe the face
  - name: Decode
    note: expression or cleanup head
  - name: Mesh
    note: same layout for every face
  - name: USD
    note: opens in Blender
---

The encoder is a PointNet. The same small network runs on every point, then it keeps the maximum of each number across all points. Taking the maximum means the order of the points doesn't matter, which is what you need for scans. It turns a set of 3D points into 256 numbers that describe the face.

Two decoders share that code. The expression decoder takes it along with an expression and a point in time, and predicts how far each point of the face moves from its resting position. Ask for 60 points in time and you get an animation. The cleanup decoder takes the code from a scan and predicts how far each point is from the average face.

Training scans are simulated. I take a clean face mesh, cut a hole in it, add noise and some stray points, and shuffle the points. The clean mesh is the answer. The loss compares each predicted point with the real one, plus the lengths of the mesh edges so the surface stays smooth.

The repo also has a Docker image and a script that trains both tests on an AWS GPU and copies the results back to S3.

## Results

Error is the average distance between the predicted and real face points, in millimeters. Lower is better. I tested it two ways: new people, where 2 of the 12 are left out of training completely, and seen people, where every 10th frame is left out but everyone appears in training.

| Tested on | Expression: baseline | Expression: model | Cleanup: average face | Cleanup: model |
|---|---|---|---|---|
| New people | 1.58 | 1.58 | 5.28 | **2.59** |
| Seen people | 1.41 | **0.45** | 4.32 | **0.83** |

The hard part is guessing how a new person's face will move from only their resting face. With just 10 people to learn from, the model can't beat the average. Trained normally it was worse, at 1.90 mm. So for new people I use `--baseline_correction`, which starts from the average and only learns small adjustments on top. That's why the new-people expression number ties the baseline.

## Things I learned

- **Always compare against a simple baseline.** My first results looked fine until I compared them with the average movement and saw the model was losing on new people.
- **Load meshes with `trimesh.load(path, process=False)`.** By default trimesh reorders the points, which silently breaks everything without any error.
- **Don't use BatchNorm in a shared encoder.** Mine sees both clean faces and noisy scans, so BatchNorm's averages ended up fitting neither.
- **A small dataset needs augmentation.** Randomly stretching each head by up to 5% during training helped the model handle people it hadn't seen.

## Known limits

- With 12 people in the dataset, expressions for new people are no better than the baseline.
- Scans have to be in meters and facing forward.
- Getting CoMA requires requesting access, so the repo doesn't include the data or trained weights.

## Run it

```bash
python -m facemesh.train --data data/coma.npz --out_dir runs/coma_subject \
    --epochs 30 --baseline_correction

python -m facemesh.export_usd fit --checkpoint runs/coma_subject/best.pt \
    --scan my_scan.ply --out_dir exports/my_scan
```
