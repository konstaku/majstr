type AvatarProps = {
  img: string | null;
  color: string;
  name: string;
};

export default function Avatar({ img, color, name }: AvatarProps) {
  return (
    <div
      className="card-avatar"
      style={
        img ? { backgroundImage: `url(${img})` } : { backgroundColor: color }
      }
    >
      {!img && name && name[0]}
    </div>
  );
}
