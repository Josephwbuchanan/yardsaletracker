import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

export default function YardSaleTracker() {
  const [sales, setSales] = useState([]);

  useEffect(() => {
    fetch("/yardsaletracker/sales.json")
      .then((res) => res.json())
      .then(setSales)
      .catch((err) => console.error("Could not load sales.json", err));
  }, []);

  return (
    <MapContainer
      center={[33.2448, -96.9031]}
      zoom={14}
      style={{ height: "100vh", width: "100vw" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {sales.map((sale) => (
        <Marker key={sale.id} position={[sale.lat, sale.lng]}>
          <Popup>
            <strong>{sale.name}</strong>
            <br />
            {sale.address}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
