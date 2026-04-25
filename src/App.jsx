import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
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
import "leaflet-rotate";
import L from "leaflet";

function makeIcon(color, border = "white", size = 22) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid ${border};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function makeUserIcon(heading = 0, facingMode = false) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
      ">
        ${
          facingMode
            ? `<div style="
                position: absolute;
                left: 10px;
                top: -4px;
                width: 0;
                height: 0;
                border-left: 7px solid transparent;
                border-right: 7px solid transparent;
                border-bottom: 16px solid #2563eb;
                transform: rotate(${heading}deg);
                transform-origin: 7px 21px;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));
              "></div>`
            : ""
        }

        <div style="
          position: absolute;
          left: 6px;
          top: 6px;
          width: 18px;
          height: 18px;
          background: #2563eb;
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
        "></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const icons = {
  unvisited: makeIcon("white", "black"),
  want: makeIcon("#f97316", "white"),
  visited: makeIcon("#16a34a", "white"),
  skipped: makeIcon("#9ca3af", "white"),
  draft: makeIcon("#facc15", "black"),
};

function cleanAddress(address) {
  return (address || "Yard Sale")
    .replace(/,?\s*Aubrey,?\s*Texas\s*76227/gi, "")
    .replace(/,?\s*Aubrey,?\s*TX\s*76227/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatStatus(status) {
  if (!status) return "Unvisited";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function RecenterButton({ userLocation }) {
  const map = useMap();

  return (
    <button
      onClick={() => {
        if (userLocation) {
          map.setView([userLocation.lat, userLocation.lng], 18);
        }
      }}
      style={buttonStyle}
      title="Center on me"
    >
      <span style={meDotOuterStyle}>
        <span style={meDotInnerStyle} />
      </span>
    </button>
  );
}

function OrientationButton({ orientationMode, setOrientationMode }) {
  return (
    <button
      onClick={() => {
        setOrientationMode((current) =>
          current === "north" ? "facing" : "north"
        );
      }}
      style={{
        ...orientationButtonStyle,
        background: orientationMode === "facing" ? "#2563eb" : "white",
        color: orientationMode === "facing" ? "white" : "#2563eb",
      }}
      title={orientationMode === "north" ? "Follow direction" : "North up"}
    >
      ➤
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
          const position = event.target.getLatLng();

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

function ZoomAwareSaleMarker({ sale, status, onClick }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    function updateZoom() {
      setZoom(map.getZoom());
    }

    map.on("zoomend", updateZoom);
    return () => map.off("zoomend", updateZoom);
  }, [map]);

  const size = zoom <= 13 ? 14 : zoom === 14 ? 18 : 22;

  const icon =
    status === "want"
      ? makeIcon("#f97316", "white", size)
      : status === "visited"
      ? makeIcon("#16a34a", "white", size)
      : status === "skipped"
      ? makeIcon("#9ca3af", "white", size)
      : makeIcon("white", "black", size);

  return (
    <Marker
      position={[sale.lat, sale.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
    />
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

  async function searchAddress() {
  const typedAddress = window.prompt(
    "Enter address",
    "2700 Upland Trail Lane"
  );

  if (!typedAddress) return;

  const searchText = typedAddress.toLowerCase().includes("aubrey")
    ? typedAddress
    : `${typedAddress}, Aubrey, TX 76227`;

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `format=json&addressdetails=1&limit=5&q=${encodeURIComponent(searchText)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    const results = await response.json();

    if (!results || results.length === 0) {
      window.alert("No close matches found.");
      return;
    }

    const choices = results
      .map((result, index) => `${index + 1}. ${result.display_name}`)
      .join("\n\n");

    const selected = window.prompt(
      `Choose the correct address:\n\n${choices}\n\nType 1-${results.length}`,
      "1"
    );

    if (!selected) return;

    const selectedIndex = Number(selected) - 1;

    if (
      Number.isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= results.length
    ) {
      window.alert("Invalid selection.");
      return;
    }

    const chosen = results[selectedIndex];
    const lat = Number(chosen.lat);
    const lng = Number(chosen.lon);

    setDraftSale({
      lat,
      lng,
    });

    map.setView([lat, lng], 18);
  } catch (error) {
    console.error("Address search error:", error);
    window.alert("Could not search address.");
  }
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

      <button onClick={searchAddress} style={smallButtonStyle}>
        Address
      </button>
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

function BottomSheet({
  sale,
  status,
  onClose,
  onStatus,
  directionsUrl,
  onStartRoute,
  onClearRoute,
  routeActive,
  routeInfo,
}) {
  if (!sale) return null;

  return (
    <div style={sheetOverlayStyle}>
      <div style={sheetHandleStyle} />

      <div style={sheetHeaderStyle}>
        <div>
          <div style={sheetTitleStyle}>{cleanAddress(sale.address)}</div>
          <div style={sheetStatusStyle}>Status: {formatStatus(status)}</div>
          {routeInfo && (
            <div style={sheetStatusStyle}>
              Route: {routeInfo.distanceMiles} mi · {routeInfo.durationMinutes} min
            </div>
          )}
        </div>

        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
      </div>

      <div style={sheetButtonGridStyle}>
        <button onClick={() => onStatus(sale.id, "want")} style={wantButtonStyle}>
          Want
        </button>
        <button onClick={() => onStatus(sale.id, "visited")} style={visitedButtonStyle}>
          Visited
        </button>
        <button onClick={() => onStatus(sale.id, "skipped")} style={skippedButtonStyle}>
          Skipped
        </button>
        <button onClick={() => onStatus(sale.id, "unvisited")} style={resetButtonStyle}>
          Reset
        </button>
      </div>

      <button onClick={() => onStartRoute(sale)} style={routeButtonStyle}>
        {routeActive ? "Refresh Route" : "Start Route"}
      </button>

      {routeActive && (
        <button onClick={onClearRoute} style={clearRouteButtonStyle}>
          Clear Route
        </button>
      )}

      <a
        href={directionsUrl(sale)}
        target="_blank"
        rel="noreferrer"
        style={directionsButtonStyle}
      >
        Open in Google Maps
      </a>
    </div>
  );
}

function MapRotationController({ orientationMode, userLocation, routeActive }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (orientationMode === "north") {
      map.setBearing(0);
      return;
    }

    const heading = userLocation?.heading;
    const lat = userLocation?.lat;
    const lng = userLocation?.lng;

    if (
      orientationMode === "facing" &&
      typeof heading === "number" &&
      !Number.isNaN(heading) &&
      lat &&
      lng
    ) {
      map.setBearing(-heading);

      if (routeActive) {
        map.setView([lat, lng], 18, { animate: true });
      }
    }
  }, [orientationMode, userLocation, routeActive, map]);

  return null;
}

function RouteCameraController({ routeLine, userLocation, routeActive }) {
  const map = useMap();

  useEffect(() => {
    if (!map || routeLine.length === 0) return;

    const bounds = L.latLngBounds(routeLine);
    map.fitBounds(bounds, {
      paddingTopLeft: [40, 80],
      paddingBottomRight: [40, 240],
      maxZoom: 18,
    });
  }, [routeLine, map]);

  useEffect(() => {
    if (!map || !routeActive || !userLocation) return;

    map.setView([userLocation.lat, userLocation.lng], 18, {
      animate: true,
    });
  }, [userLocation, routeActive, map]);

  return null;
}

export default function YardSaleTracker() {
  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [draftSale, setDraftSale] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [orientationMode, setOrientationMode] = useState("north");
  const [routeLine, setRouteLine] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeDestinationId, setRouteDestinationId] = useState(null);

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
          heading: pos.coords.heading,
        });
      },
      (err) => console.warn("Location error:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
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

  async function startRoute(sale) {
    if (!userLocation) {
      window.alert("Current location is not available yet.");
      return;
    }

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${userLocation.lng},${userLocation.lat};${sale.lng},${sale.lat}` +
      `?overview=full&geometries=geojson&steps=true`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        window.alert("No route found.");
        return;
      }

      const route = data.routes[0];

      const line = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      setRouteLine(line);
      setRouteDestinationId(sale.id);
      setRouteInfo({
        distanceMiles: (route.distance / 1609.344).toFixed(1),
        durationMinutes: Math.round(route.duration / 60),
      });

      setOrientationMode("facing");
    } catch (error) {
      console.error("Route error:", error);
      window.alert("Could not load route.");
    }
  }

  function clearRoute() {
    setRouteLine([]);
    setRouteInfo(null);
    setRouteDestinationId(null);
  }

  const userHeading =
    userLocation?.heading !== null && userLocation?.heading !== undefined
      ? userLocation.heading
      : 0;

  const routeActive = routeLine.length > 0;

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <MapContainer
        center={[33.2448, -96.9031]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        rotate={true}
        touchRotate={true}
        bearing={0}
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png"
        />

        {routeLine.length > 0 && (
          <Polyline positions={routeLine} pathOptions={routeLineStyle} />
        )}

        {sales.map((sale) => {
  const status = statuses[sale.id] || "unvisited";

  return (
    <ZoomAwareSaleMarker
      key={sale.id}
      sale={sale}
      status={status}
      onClick={() => setSelectedSale(sale)}
    />
  );
})}

        <DraftSaleMarker draftSale={draftSale} setDraftSale={setDraftSale} />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={makeUserIcon(userHeading, orientationMode === "facing")}
          />
        )}

        <RecenterButton userLocation={userLocation} />
        <OrientationButton
          orientationMode={orientationMode}
          setOrientationMode={setOrientationMode}
        />
        <AddSaleControls draftSale={draftSale} setDraftSale={setDraftSale} />

        <MapRotationController
          orientationMode={orientationMode}
          userLocation={userLocation}
          routeActive={routeActive}
        />

        <RouteCameraController
          routeLine={routeLine}
          userLocation={userLocation}
          routeActive={routeActive}
        />
      </MapContainer>

      <div style={statusBoxStyle}>
        <strong>Arrowbrooke Yard Sale</strong>
        <br />
        🟠 {stats.want} want · 🟢 {stats.visited} visited
        <br />
        ⚪ {stats.left} left · ⚫ {stats.skipped} skipped
      </div>

      <Speedometer userLocation={userLocation} />

      <BottomSheet
        sale={selectedSale}
        status={selectedSale ? statuses[selectedSale.id] || "unvisited" : "unvisited"}
        onClose={() => setSelectedSale(null)}
        onStatus={setStatus}
        directionsUrl={directionsUrl}
        onStartRoute={startRoute}
        onClearRoute={clearRoute}
        routeActive={routeDestinationId === selectedSale?.id}
        routeInfo={routeDestinationId === selectedSale?.id ? routeInfo : null}
      />
    </div>
  );
}

const routeLineStyle = {
  color: "#2563eb",
  weight: 7,
  opacity: 0.9,
};

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
  top: 114,
  left: 12,
  zIndex: 1000,
  width: 46,
  height: 46,
  borderRadius: "50%",
  border: "1px solid #aaa",
  background: "white",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const meDotOuterStyle = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#2563eb",
  border: "4px solid white",
  boxShadow: "0 1px 5px rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const meDotInnerStyle = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#93c5fd",
};

const orientationButtonStyle = {
  position: "absolute",
  bottom: 28,
  left: 16,
  zIndex: 1000,
  width: 46,
  height: 46,
  borderRadius: "50%",
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  fontSize: 24,
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "rotate(-45deg)",
};

const addButtonStyle = {
  position: "absolute",
  top: 114,
  left: 68,
  zIndex: 1000,
  background: "white",
  color: "black",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #aaa",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
};

const draftBoxStyle = {
  position: "absolute",
  top: 114,
  left: 68,
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

const sheetOverlayStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2000,
  background: "white",
  color: "black",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  padding: 16,
  boxShadow: "0 -6px 20px rgba(0,0,0,0.3)",
  fontFamily: "system-ui, sans-serif",
};

const sheetHandleStyle = {
  width: 40,
  height: 4,
  background: "#ccc",
  borderRadius: 999,
  margin: "0 auto 10px",
};

const sheetHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const sheetTitleStyle = {
  fontSize: 21,
  fontWeight: "bold",
  lineHeight: 1.25,
};

const sheetStatusStyle = {
  fontSize: 15,
  color: "#666",
  marginTop: 5,
};

const closeButtonStyle = {
  border: "none",
  background: "none",
  color: "black",
  fontSize: 26,
};

const sheetButtonGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 14,
};

const wantButtonStyle = {
  background: "#f97316",
  color: "white",
  padding: 12,
  border: "none",
  borderRadius: 10,
  fontWeight: "bold",
};

const visitedButtonStyle = {
  background: "#16a34a",
  color: "white",
  padding: 12,
  border: "none",
  borderRadius: 10,
  fontWeight: "bold",
};

const skippedButtonStyle = {
  background: "#6b7280",
  color: "white",
  padding: 12,
  border: "none",
  borderRadius: 10,
  fontWeight: "bold",
};

const resetButtonStyle = {
  background: "white",
  color: "black",
  border: "1px solid #ccc",
  padding: 12,
  borderRadius: 10,
  fontWeight: "bold",
};

const routeButtonStyle = {
  display: "block",
  width: "100%",
  marginTop: 12,
  background: "#2563eb",
  color: "white",
  textAlign: "center",
  padding: 14,
  borderRadius: 12,
  border: "none",
  textDecoration: "none",
  fontWeight: "bold",
};

const clearRouteButtonStyle = {
  display: "block",
  width: "100%",
  marginTop: 8,
  background: "#111827",
  color: "white",
  textAlign: "center",
  padding: 12,
  borderRadius: 12,
  border: "none",
  fontWeight: "bold",
};

const directionsButtonStyle = {
  display: "block",
  marginTop: 8,
  background: "white",
  color: "#2563eb",
  textAlign: "center",
  padding: 12,
  borderRadius: 12,
  textDecoration: "none",
  fontWeight: "bold",
  border: "1px solid #2563eb",
};
