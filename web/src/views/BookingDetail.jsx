import { useParams } from "react-router-dom";

export default function BookingDetail() {
  const { bookingId } = useParams();

  return (
    <main>
      <h1>Booking Detail</h1>
      <p>Booking ID: {bookingId}</p>
    </main>
  );
}