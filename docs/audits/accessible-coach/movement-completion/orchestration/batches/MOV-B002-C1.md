**Batch:** MOV-B002  **Type:** REPAIR (correction 1 to your acknowledgement — read before editing any movement data)

Your MOV-B002 acknowledgement lists the wrong movement IDs for the clipped groups. Eight of the IDs you named are NOT clipped and are excluded from this batch: 141, 100, 39, 174, 175, 263, 113, 282. Do not edit their data. If you already have, revert those edits before committing.

The fifteen clipped movements, by manifest `movementId` and name, with the measured neutral overflow:

| movementId | Name | Side | dp | At |
| --- | --- | --- | --- | --- |
| 86 | Dumbbell Floor Press | left | 8.448 | 0 ms |
| 128 | Alternating Floor Press | left | 8.448 | 0 ms |
| 196 | Extended Range One-Arm Kettlebell Floor Press | left | 8.448 | 0 ms |
| 10 | Dumbbell Bench Press | left | 6.256 | 0 ms |
| 125 | 3/4 Sit-Up | left | 3.028 | 0 ms |
| 161 | Cable Seated Crunch | left | 3.028 | 0 ms |
| 173 | Cross-Body Crunch | left | 3.028 | 0 ms |
| 226 | Janda Sit-Up | left | 3.028 | 0 ms |
| 245 | Oblique Crunches | left | 3.028 | 0 ms |
| 287 | Stiff Leg Barbell Good Morning | left | 1.313 | 1485 ms |
| 42 | Chest-Supported Dumbbell Row | left | 0.464 | 0 ms |
| 116 | Cable Rope Overhead Triceps Extension | bottom | 0.459 | 0 ms |
| 157 | Cable One Arm Tricep Extension | bottom | 0.459 | 0 ms |
| 193 | Dumbbell Tricep Extension -Pronated Grip | bottom | 0.459 | 0 ms |
| 283 | Standing Overhead Barbell Triceps Extension | bottom | 0.459 | 0 ms |

These are the same fifteen IDs already keyed in `TRACKED_RESIDUALS` in `MovementPreview.canonicalFrameFit.test.js`. Before editing, confirm each ID's `name` in the manifest matches this table and report any mismatch instead of guessing.

Acceptance is unchanged, with one addition: in my re-run, the drawn output of every movement OTHER than these fifteen must be byte-identical to the baseline `ee5bca7143e922b491024972f9f8e81875e83824`.

Reply to `claude` with subject starting `MOV-B002 C1 ACK` stating which IDs you will edit.
