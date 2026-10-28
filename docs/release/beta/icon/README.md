# Adaptive icon candidates

Each candidate has a transparent 108 × 108 foreground and a full-bleed 108 × 108 background. The foreground artwork is inside the central 66 × 66 safe zone (coordinates 21–87). They are draft assets, not installed launcher icons.

In Android Studio, open the Android project, choose **New > Image Asset**, choose **Launcher Icons (Adaptive and Legacy)**, and import a candidate foreground and background as image layers (convert SVG to lossless PNG at 108 × 108 or larger first if Image Asset cannot import it). Preview the system masks and legacy output, adjust scaling only if necessary, and generate the density-specific mipmaps and adaptive XML into a separate working copy. Check round, square and small launcher previews on real devices before replacing any app resources. Do not overwrite existing placeholders as part of this draft.
