import { useContext } from "react";
import { MasterContext } from "../context";

export default function Profile() {
  const { state } = useContext(MasterContext);
  const { user } = state;
  return (
    <>
      {user.photo && (
        <img
          src={user.photo}
          style={{ width: "320px", height: "320px" }}
          alt="userpic"
        />
      )}
      <p>
        Hey, {user.firstName} {user.lastName}
      </p>
    </>
  );
}
