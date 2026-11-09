# Beta known issues

Known limits of the closed beta. Each one was ruled on by the owner and is
left as it is for the beta. Each line names its GitHub issue.

| Issue | What a tester sees | What to do | Ruling |
| --- | --- | --- | --- |
| [#166](https://github.com/FDOTPike/athlete-kinetics/issues/166) | After the phone's timezone changes (for example after travel), dates in the app (today's plan, today's reports, history days, the backup file name) can be one day off. The app keeps the old timezone until it is restarted. | Close the app fully and open it again after changing timezone. | 2026-11-05: a known issue for the beta; a timezone-change listener needs a new native dependency. |
| [#167](https://github.com/FDOTPike/athlete-kinetics/issues/167) | Debug builds only: a warning that `SafeAreaView` is deprecated, which can cover the bottom tab bar until it is dismissed. Release builds, including beta builds, do not show it. | Nothing in a release build. In a debug build, dismiss the warning. | 2026-11-05: leave it until a React Native upgrade. |
| [#173](https://github.com/FDOTPike/athlete-kinetics/issues/173) | An encrypted backup holds at most 8 MB of athlete data, about five athletes in this version (an empty athlete already takes about 1.4 MB). With more, "Create encrypted backup" says the backup is too large and saves no file. Once the #173 fix is merged, the app warns before a sixth athlete is added and the backup screen shows the limit and the current total. | Keep to about five athletes on a phone you need to back up. | 2026-11-05: warn before a sixth athlete and on the backup screen; a new backup format is later work. |
