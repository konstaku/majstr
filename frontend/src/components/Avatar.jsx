export default function Avatar({ img, color, name }) {
  return (
    <div
      className="card-avatar"
      style={
        img ? { backgroundImage: `url(${img})` } : { backgroundColor: color }
      }
    >
      {!img && name[0]}
    </div>
  );
}
