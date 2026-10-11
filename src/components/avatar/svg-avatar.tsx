import type { PropAnchor } from "@shared/avatars/catalog";
import type { AvatarRender } from "./avatar";

/** Prop offsets as fractions of the knob radius, per anchor. */
const ANCHOR: Record<PropAnchor, [number, number]> = {
  top: [0, -0.8],
  "top-right": [0.75, -0.7],
  "top-left": [-0.75, -0.7],
  right: [0.95, 0],
  left: [-0.95, 0],
};

/**
 * A player's avatar drawn inside an SVG knob of radius `r` centred on
 * (cx, cy). Catalog characters reuse the `.avatar-*` CSS animations; the
 * transform origins are set inline in view-box units because `fill-box`
 * would make them relative to each glyph's own box.
 */
export function SvgAvatar({
  render,
  cx,
  cy,
  r,
}: {
  render: AvatarRender;
  cx: number;
  cy: number;
  r: number;
}) {
  if (render.kind === "initial") {
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 1.1}
        fontWeight={800}
        fill="var(--color-primary-foreground)"
        data-testid="pip-initial"
      >
        {render.text}
      </text>
    );
  }
  if (render.kind === "emoji") {
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r * 1.35}
        data-testid="pip-emoji"
      >
        {render.text}
      </text>
    );
  }
  const { def } = render;
  const [ax, ay] = ANCHOR[def.anchor ?? "top-right"];
  const px = cx + ax * r;
  const py = cy + ay * r;
  const propAnim = def.propAnim ?? "ride";
  const origin = (x: number, y: number) => ({
    transformBox: "view-box" as const,
    transformOrigin: `${x}px ${y}px`,
  });
  return (
    <g
      className="avatar-body"
      data-anim={def.anim}
      data-avatar-id={def.id}
      // The keyframes move in em: one em here is the knob radius.
      style={{ fontSize: r, ...origin(cx, cy) }}
      data-testid="pip-figure"
    >
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: r * 1.35 }}
      >
        {def.base}
      </text>
      {def.prop && (
        <g
          className="avatar-prop"
          data-prop-anim={propAnim}
          style={{ fontSize: r, ...origin(cx, cy) }}
        >
          <text
            className="avatar-prop-glyph"
            data-prop-anim={propAnim}
            x={px}
            y={py}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: r * 0.75, ...origin(px, py) }}
          >
            {def.prop}
          </text>
        </g>
      )}
    </g>
  );
}
