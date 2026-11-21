# GitHub issue labels for beta findings

Recorded 2026-11-06. The source is the owner's instruction of 2026-11-04. No repository record of that instruction exists (no ledger line, decision record or earlier label file), so this page is the first written copy.

| Label | Use it for | Who takes it |
| --- | --- | --- |
| `android` | Any finding in the Android app, the Android build or the Android release path. The first body line of the issue is `Not a Mac task`. | Android work, done on the Windows PC |
| `mac` | Any finding that needs a Mac, such as iOS or Xcode work. | The Mac agent takes only `mac` issues |
| `needs-owner-ruling` | A decision is needed from the owner before the work can change behaviour, wording, thresholds, scope or release timing. Add it alongside `android` or `mac`. | The owner decides |

Rules:

1. Every finding carries exactly one of `android` or `mac`.
2. An `android` issue starts its body with the line `Not a Mac task`.
3. Add `needs-owner-ruling` to any finding that needs a decision. Do not change the behaviour in question until the ruling is recorded.
4. The Mac agent works only on issues labelled `mac`.
