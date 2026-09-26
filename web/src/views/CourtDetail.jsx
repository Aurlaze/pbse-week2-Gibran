import { useParams } from "react-router-dom";

export default function CourtDetail() {
  const { courtId } = useParams();

  return (
    <main>
      <h1>Court Detail</h1>
      <p>Court ID: {courtId}</p>
    </main>
  );
}