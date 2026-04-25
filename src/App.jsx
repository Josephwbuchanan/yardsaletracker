import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function makeIcon(color, border = "white") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: ${color};
        border: 3px solid ${border};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      "></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

const icons = {
  unvisited: makeIcon("white", "black"),
  want: makeIcon("#f97316", "white"),
  visited: makeIcon("#16a34a", "white"),
  skipped: makeIcon("#9ca3af", "white"),
  user: makeIcon("#2563eb", "white"),
  draft: makeIcon("#facc15", "black"),
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

function AddSaleControls({ draftSale, setDraftSale }) {
  const map = useMap();

  function startAddSale() {
    const center = map.getCenter();

    setDraftSale({
      lat: center.lat,
      lng: center.lng,
    });
  }

  function updateDraftToCenter() {
    const center = map.getCenter();

    setDraftSale({
      lat: center.lat,
      lng: center.lng,
    });
  }

  async function applyDraftSale() {
    if (!draftSale) return;

    const name = window.prompt("Sale name?", "Added Sale");

    if (name === null) return;

    const address = window.prompt("Address or note?", "Added from map");

    if (address === null) return;

    await addDoc(collection(db, "sales"), {
      title: name || "Added Sale",
      name: name || "Added Sale",
      address: address || "Added from map",
      lat: draftSale.lat,
      lng: draftSale.lng,
      custom: true,
    });

    setDraftSale(null);
  }

  if (!draftSale) {
    return (
      <button onClick={startAddSale} style={addButtonStyle}>
        ➕ Add Sale
      </button>
    );
  }

  return (
    <div style={draftBoxStyle}>
      <strong>New Sale Pin</strong>
      <br />
      Move the map, then tap:
      <br />
      <button onClick={updateDraftToCenter} style={smallButtonStyle}>
        Move Pin Here
      </button>
      <br />
      <button onClick={applyDraftSale} style={smallButtonStyle}>
        Apply / Save
      </button>
      <br />
      <button onClick={() => setDraftSale(null)} style={smallButtonStyle}>
        Cancel
      </button>
    </div>
  );
}

export default function YardSaleTracker() {
  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [draftSale, setDraftSale] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sales"), (snapshot) => {
      const firebaseSales = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSales(firebaseSales);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "statuses"), (snapshot) => {
      const statusMap = {};

      snapshot.docs.forEach((doc) => {
        statusMap[doc.id] = doc.data().status;
      });

      setStatuses(statusMap);
    });

    return () => unsubscribe();
  }, []);

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

  async function setStatus(id, status) {
    await setDoc(doc(db, "statuses", id), {
      status,
    });
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
  attribution="Tiles &copy; Esri"
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
/>

<TileLayer
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png"
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
                <strong>{sale.title || sale.name || "Yard Sale"}</strong>
                <br />
                {sale.address}
                <br />
                <br />

              <button onClick={() => setStatus(sale.id, "want")}>
                Want
              </button>{" "}
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

        {draftSale && (
          <Marker position={[draftSale.lat, draftSale.lng]} icon={icons.draft}>
            <Popup>New sale will be saved here</Popup>
          </Marker>
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={icons.user}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        <RecenterButton userLocation={userLocation} />
        <AddSaleControls draftSale={draftSale} setDraftSale={setDraftSale} />
      </MapContainer>

      <div style={statusBoxStyle}>
        <strong>Yard Sale Tracker</strong>
        <br />
        {stats.visited}/{stats.total} visited · {stats.left} left ·{" "}
        {stats.skipped} skipped
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

const addButtonStyle = {
  position: "absolute",
  top: 130,
  left: 12,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
};

const draftBoxStyle = {
  position: "absolute",
  top: 130,
  left: 12,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  fontFamily: "system-ui, sans-serif",
};

const smallButtonStyle = {
  marginTop: 8,
  width: "100%",
  padding: "8px",
  borderRadius: 8,
  border: "1px solid #aaa",
  background: "#f9fafb",
  color: "black",
};
