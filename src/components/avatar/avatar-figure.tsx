import type { AvatarDef } from "@shared/avatars/catalog";
import { cn } from "@/lib/utils";

/**
 * A catalog avatar as HTML: the character (animated as a whole) with its
 * prop layered on top. Sized by the inherited font-size, so it drops into
 * any text-sized slot. Motion lives in index.css (`.avatar-*`) and collapses
 * under reduced motion / "Reduce effects".
 */
export function AvatarFigure({
  def,
  className,
}: {
  def: AvatarDef;
  className?: string;
}) {
  return (
    <span
      className={cn("avatar-fig", className)}
      data-avatar-id={def.id}
      title={def.label}
    >
      <span className="avatar-body" data-anim={def.anim}>
        <span className="avatar-base">{def.base}</span>
        {def.prop && (
          <span className="avatar-prop" data-prop-anim={def.propAnim ?? "ride"}>
            <span
              className="avatar-prop-glyph"
              data-anchor={def.anchor ?? "top-right"}
              data-prop-anim={def.propAnim ?? "ride"}
            >
              {def.prop}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}
