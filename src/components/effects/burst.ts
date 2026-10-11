const MAX_GLYPHS = 40;

export interface BurstOptions {
  glyphs: ReadonlyArray<string>;
  count: number;
  /** Name chip shown under the burst (the sender, or a caption). */
  label?: string;
  /** Written to `data-effect` on every glyph so tests can find the burst. */
  effect: string;
  /** "rise" floats up from the bottom (effects); "fall" rains from the top. */
  direction?: "rise" | "fall";
}

/**
 * Throws a handful of emoji across `root`. Glyphs are plain spans driven
 * by the Web Animations API, capped so a flood never piles up thousands of
 * nodes.
 */
export function burst(root: HTMLElement, options: BurstOptions): void {
  const { glyphs, count, label, effect, direction = "rise" } = options;
  const live = root.querySelectorAll("[data-testid=effect-burst]").length;
  const n = Math.max(1, Math.min(count, MAX_GLYPHS - live));
  const width = root.clientWidth || 360;
  const height = root.clientHeight || 640;
  const fall = direction === "fall";
  const baseX = fall ? width / 2 : 40 + Math.random() * (width - 80);
  const spread = fall ? width : 120;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.textContent = glyphs[i % glyphs.length]!;
    el.dataset.testid = "effect-burst";
    el.dataset.effect = effect;
    const x = baseX + (Math.random() - 0.5) * spread;
    const top = fall ? -60 : height - 80;
    el.style.cssText = `position:absolute;left:${x}px;top:${top}px;font-size:${28 + Math.random() * 20}px;will-change:transform,opacity;`;
    root.appendChild(el);
    const drift = (Math.random() - 0.5) * 160;
    const travel = fall ? height + 120 : 300 + Math.random() * 300;
    const sign = fall ? 1 : -1;
    const duration = fall
      ? 2200 + Math.random() * 1600
      : 1400 + Math.random() * 900;
    const anim = el.animate(
      fall
        ? [
            { transform: "translate(0,0) rotate(0deg)", opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 1, offset: 0.85 },
            {
              transform: `translate(${drift}px,${travel}px) rotate(${drift / 2}deg)`,
              opacity: 0,
            },
          ]
        : [
            { transform: "translate(0,0) rotate(0deg) scale(0.6)", opacity: 0 },
            {
              transform: `translate(${drift * 0.3}px,${sign * travel * 0.3}px) rotate(${drift / 8}deg) scale(1.1)`,
              opacity: 1,
              offset: 0.2,
            },
            {
              transform: `translate(${drift}px,${sign * travel}px) rotate(${drift / 4}deg) scale(1)`,
              opacity: 0,
            },
          ],
      {
        duration,
        delay: i * (fall ? 90 : 40),
        easing: fall ? "cubic-bezier(.4,0,.8,1)" : "cubic-bezier(.2,.8,.3,1)",
        fill: "forwards",
      },
    );
    anim.onfinish = () => el.remove();
  }
  if (label) {
    const chip = document.createElement("span");
    chip.textContent = label;
    chip.dataset.testid = "effect-from";
    chip.style.cssText = `position:absolute;left:${fall ? width / 2 : baseX}px;top:${height - 60}px;transform:translateX(-50%);padding:2px 10px;border-radius:999px;background:var(--color-card);color:var(--color-foreground);font-size:12px;font-weight:600;`;
    root.appendChild(chip);
    chip.animate(
      [
        { opacity: 0, transform: "translate(-50%,10px)" },
        { opacity: 1, transform: "translate(-50%,0)", offset: 0.15 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: "translate(-50%,-30px)" },
      ],
      { duration: 1800, fill: "forwards" },
    ).onfinish = () => chip.remove();
  }
}
