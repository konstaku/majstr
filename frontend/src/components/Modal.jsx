export default function Modal({ id, master }) {
  if (!id) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div
          className="modal-content"
          id="details-modal"
          style={{ height: '200px', width: '200px', backgroundColor: 'red' }}
        >
          {master._id}
        </div>
      </div>
    </div>
  );
}
