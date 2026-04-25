import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const SALES_URL = "/yardsaletracker/sales.json";

const icons = {
  unvisited: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  visited: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  skipped: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
  user: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  }),
};

function RecenterButton({ userLocation }) {
  const map = useMap();

  return (
    <button
      onClick={() => {
        if (userLocation) {
          map.setView([userLocation.lat, userLocation.lng], 16);
        }
      }}
      style={buttonStyle}
    >
      📍 Me
    </button>
  );
}

export default function YardSaleTracker() {
  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState(() => {
    return JSON.parse(localStorage.getItem("yard-sale-statuses") || "{}");
  });
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    fetch(SALES_URL)
      .then((res) => res.json())
      .then(setSales)
      .catch((err) => console.error("Could not load sales.json", err));
  }, []);

  useEffect(() => {
    localStorage.setItem("yard-sale-statuses", JSON.stringify(statuses));
  }, [statuses]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.warn("Location error:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const stats = useMemo(() => {
    const visited = sales.filter((sale) => statuses[sale.id] === "visited").length;
    const skipped = sales.filter((sale) => statuses[sale.id] === "skipped").length;
    return {
      total: sales.length,
      visited,
      skipped,
      left: sales.length - visited - skipped,
    };
  }, [sales, statuses]);

  function setStatus(id, status) {
    setStatuses((current) => ({
      ...current,
      [id]: status,
    }));
  }

  function directionsUrl(sale) {
    const destination = `${sale.lat},${sale.lng}`;

    if (userLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${destination}`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <MapContainer
        center={[33.2448, -96.9031]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sales.map((sale) => {
          const status = statuses[sale.id] || "unvisited";

          return (
            <Marker
              key={sale.id}
              position={[sale.lat, sale.lng]}
              icon={icons[status]}
            >
              <Popup>
                <strong>{sale.name}</strong>
                <br />
                {sale.address}
                <br />
                <br />

                <button onClick={() => setStatus(sale.id, "visited")}>
                  Visited
                </button>{" "}
                <button onClick={() => setStatus(sale.id, "skipped")}>
                  Skipped
                </button>{" "}
                <button onClick={() => setStatus(sale.id, "unvisited")}>
                  Reset
                </button>

                <br />
                <br />

                <a href={directionsUrl(sale)} target="_blank" rel="noreferrer">
                  Open directions
                </a>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={icons.user}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        <RecenterButton userLocation={userLocation} />
      </MapContainer>

      <div style={statusBoxStyle}>
        <strong>Yard Sale Tracker</strong>
        <br />
        {stats.visited}/{stats.total} visited · {stats.left} left · {stats.skipped} skipped
      </div>
    </div>
  );
}

const statusBoxStyle = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "10px 14px",
  borderRadius: 10,
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  fontFamily: "system-ui, sans-serif",
};

const buttonStyle = {
  position: "absolute",
  top: 80,
  left: 12,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
};
