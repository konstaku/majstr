import Sigil from "./Sigil";

type AvatarProps = {
  img: string | null;
  /** Kept for backward compatibility — no longer used (sigil replaces the colored letter). */
  color?: string;
  /** Display name — used as the sigil seed when no `seed` is passed. */
  name: string;
  /** Stable identifier (e.g. master._id) — preferred sigil seed. */
  seed?: string;
};

export default function Avatar({ img, name, seed }: AvatarProps) {
  if (img) {
    return (
      <div
        className="card-avatar"
        style={{ backgroundImage: `url(${img})`, backgroundColor: "transparent" }}
      />
    );
  }
  return (
    <div className="card-avatar card-avatar--sigil">
      <Sigil seed={seed || name || "?"} size={3} />
    </div>
  );
}
