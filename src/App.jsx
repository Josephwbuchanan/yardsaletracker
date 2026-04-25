import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
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
  draft: makeIcon("#facc15", "black"),
};

function RecenterButton({ userLocation }) {
  const map = useMap();

  return (
    <button
      onClick={() => {
        if (userLocation) {
          map.setView([userLocation.lat, userLocation.lng], 17);
        }
      }}
      style={buttonStyle}
    >
      Me
    </button>
  );
}

function Speedometer({ userLocation }) {
  const speedMph =
    userLocation?.speed !== null && userLocation?.speed !== undefined
      ? Math.round(userLocation.speed * 2.23694)
      : 0;

  const accuracyFeet =
    userLocation?.accuracy !== null && userLocation?.accuracy !== undefined
      ? Math.round(userLocation.accuracy * 3.28084)
      : null;

  return (
    <div style={speedometerStyle}>
      <div style={speedNumberStyle}>{speedMph}</div>
      <div style={speedUnitStyle}>MPH</div>
      {accuracyFeet && <div style={accuracyStyle}>GPS ± {accuracyFeet} ft</div>}
    </div>
  );
}

function DraftSaleMarker({ draftSale, setDraftSale }) {
  if (!draftSale) return null;

  return (
    <Marker
      position={[draftSale.lat, draftSale.lng]}
      icon={icons.draft}
      draggable={true}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target;
          const position = marker.getLatLng();

          setDraftSale({
            lat: position.lat,
            lng: position.lng,
          });
        },
      }}
    >
      <Popup>Drag this pin to the new sale, then tap Apply / Save.</Popup>
    </Marker>
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

  function movePinToCenter() {
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
      Drag the yellow pin, or move the map.
      <br />
      <button onClick={movePinToCenter} style={smallButtonStyle}>
        Move Pin to Center
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
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
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
    const want = sales.filter((sale) => statuses[sale.id] === "want").length;
    const visited = sales.filter((sale) => statuses[sale.id] === "visited").length;
    const skipped = sales.filter((sale) => statuses[sale.id] === "skipped").length;

    return {
      total: sales.length,
      want,
      visited,
      skipped,
      left: sales.length - want - visited - skipped,
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
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
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

        <DraftSaleMarker draftSale={draftSale} setDraftSale={setDraftSale} />

        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={9}
            pathOptions={{
              color: "white",
              weight: 3,
              fillColor: "#2563eb",
              fillOpacity: 1,
            }}
          >
            <Popup>You are here</Popup>
          </CircleMarker>
        )}

        <RecenterButton userLocation={userLocation} />
        <AddSaleControls draftSale={draftSale} setDraftSale={setDraftSale} />
      </MapContainer>

      <div style={statusBoxStyle}>
        <strong>Arrowbrooke Yard Sale</strong>
        <br />
        🟠 {stats.want} want · 🟢 {stats.visited} visited
        <br />
        ⚪ {stats.left} left · ⚫ {stats.skipped} skipped
      </div>

      <Speedometer userLocation={userLocation} />
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
  top: 124,
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
  top: 174,
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
  top: 174,
  left: 12,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  fontFamily: "system-ui, sans-serif",
  maxWidth: 180,
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

const speedometerStyle = {
  position: "absolute",
  bottom: 28,
  right: 16,
  zIndex: 1000,
  width: 86,
  height: 86,
  borderRadius: "50%",
  background: "white",
  color: "black",
  boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
  border: "4px solid #111827",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
};

const speedNumberStyle = {
  fontSize: 30,
  fontWeight: 800,
  lineHeight: 1,
};

const speedUnitStyle = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
};

const accuracyStyle = {
  position: "absolute",
  bottom: -24,
  right: -4,
  background: "white",
  color: "#374151",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 999,
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  whiteSpace: "nowrap",
};
