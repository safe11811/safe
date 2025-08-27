```markdown
# Safe — Single-page Terminal Portfolio (layout + assets update)

Summary
- Header nav/buttons are centered (logo left, nav centered, status right).
- About avatar now sits to the right of the text on desktop, and stacks nicely on mobile.
- The About terminal (about-shell) now stretches to match the height of the About text card so both columns feel balanced.
- About action buttons are stylized with neon/terminal styles (primary / secondary / outline).
- Social logos are now loaded from `assets/pmg/*.png`. Place your PNG logos in that folder:
  - assets/pmg/instagram.png
  - assets/pmg/github.png
  - assets/pmg/youtube.png
  - assets/pmg/reddit.png
- Your sketch image should be saved to `assets/sketch.jpg` (or change path in index.html).

How to update / preview
1. Create folders: `assets/pmg/` and `assets/` (if not already).
2. Add logos into `assets/pmg/` with the filenames above.
3. Put your sketch into `assets/sketch.jpg`.
4. Open `index.html` in a browser (or push to your static host).

Notes & next tweaks I can apply
- If you want the avatar smaller / larger or turned into a neon-traced version I can add CSS filters or produce a traced SVG version.
- If the PNG filenames are different, tell me the filenames or paste them and I will patch the HTML to match.
- I left the mini-terminal and About terminal behavior untouched; if you want an unlock/resume command or an animated avatar overlay, I can add that.

```