import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const salesData = [
  { id: "1", name: "Sale 1", address: "2817 Upland Trail Ln, Aubrey, TX", lat: 33.2467409, lng: -96.9006248 },
  { id: "2", name: "Sale 2", address: "2909 Upland trail Ln, Aubrey, TX", lat: 33.2471712, lng: -96.9006032 },
  { id: "3", name: "Sale 3", address: "1215 Starlight Avenue, Aubrey, TX - 76227", lat: 33.245989, lng: -96.908114 },
  { id: "4", name: "Sale 4", address: "1400 Mission Street, Aubrey, TX", lat: 33.242368, lng: -96.903415 },
  { id: "5", name: "Sale 5", address: "1260 Rosebush rd, Aubrey, TX", lat: 33.2489536, lng: -96.9064638 },
  { id: "6", name: "Sale 6", address: "1208 Stoneleigh Pl, Aubrey, TX", lat: 33.2471238, lng: -96.9084604 },
  { id: "7", name: "Sale 7", address: "1301 Saddle Ridge dr Aubrey, Tx", lat: 33.245376, lng: -96.905325 },
  { id: "8", name: "Sale 8", address: "2805 Lakeside Drive, Aubrey, TX", lat: 39.633465, lng: -74.960703 },
  { id: "9", name: "Sale 9", address: "1613 Berry Ridge Trl, Aubrey, TX", lat: 33.2502491, lng: -96.8999394 },
  { id: "10", name: "Sale 10", address: "2416 Prairie Trail Avenue, Aubrey TX 76227", lat: 33.24288402040816, lng: -96.8954167755102 },
  { id: "11", name: "Sale 11", address: "1713 Berry ridge trail, Aubrey, TX", lat: 33.2502007, lng: -96.8985838 },
  { id: "12", name: "Sale 12", address: "1817 Campground Way, Aubrey, TX", lat: 33.246966, lng: -96.8975558 },
  { id: "13", name: "Sale 13", address: "1620 Gold Mine Trail, Aubrey, TX", lat: 33.2505763, lng: -96.8997106 },
  { id: "14", name: "Sale 14", address: "1800 pleasant Knoll Trl, Aubrey, TX", lat: 33.2489249, lng: -96.8982683 },
  { id: "15", name: "Sale 15", address: "1628 Settlement Way, Aubrey, TX", lat: 33.241472, lng: -96.9000551 },
  { id: "16", name: "Sale 16", address: "1209 Coyote Ridge, Aubrey, TX", lat: 29.89319, lng: -98.39823271428573 },
  { id: "17", name: "Sale 17", address: "1825 Outpost Creek Lane, Aubrey, TX", lat: 33.2453405, lng: -96.8968664 },
  { id: "18", name: "Sale 18", address: "1612 Ridge Creek Lane Aubrey TX 76227", lat: 33.239896, lng: -96.9010986 },
  { id: "19", name: "Sale 19", address: "1900 Alton Way, Aubrey, TX", lat: 33.2434161959946, lng: -96.89673410054418 },
  { id: "20", name: "Sale 20", address: "1801 Ranch Trail, Aubrey, TX", lat: 32.9254762, lng: -96.9701271 },
  { id: "21", name: "Sale 21", address: "1809 Ranch Trail Rd, Aubrey, TX", lat: 33.242826000211245, lng: -96.89772065069968 },
  { id: "22", name: "Sale 22", address: "1225 Pleasant Knoll Trl, Aubrey, TX", lat: 33.2484354, lng: -96.9077798 },
  { id: "23", name: "Sale 23", address: "2100 Broken Arrow Dr. Aubrey TX 76227", lat: 33.2409185, lng: -96.8962687 },
  { id: "24", name: "Sale 24", address: "824 Saratoga Rd, Aubrey, TX", lat: 33.248322, lng: -96.909106 },
  { id: "25", name: "Sale 25", address: "912 Saratoga Rd, Aubrey, TX", lat: 33.247908, lng: -96.909132 },
  { id: "26", name: "Sale 26", address: "1836 Meadow Trail Lane, Aubrey, TX", lat: 33.2406084, lng: -96.89663 },
  { id: "27", name: "Sale 27", address: "2912 Upland Trail Lane, Aubrey, TX", lat: 33.2475626, lng: -96.9000194 },
  { id: "28", name: "Sale 28", address: "1944 Cinnamon Trail, Aubrey, TX", lat: 33.2480099, lng: -96.8954092 },
  { id: "29", name: "Sale 29", address: "1267 Mill Pl, Aubrey, TX", lat: 41.15777081224762, lng: -73.26552562709028 },
  { id: "30", name: "Sale 30", address: "2109 Crosstimber Ct, Aubrey TX 76227", lat: 33.303755, lng: -96.983379 },
  { id: "31", name: "Sale 31", address: "1220 Hutton Branch Trail, Aubrey, TX", lat: 33.2404283, lng: -96.9064594 },
  { id: "32", name: "Sale 32", address: "1920 Ridge Creek Lane, Aubrey, TX", lat: 33.2397718, lng: -96.8966681 },
  { id: "33", name: "Sale 33", address: "1247 Mill Place, Aubrey, TX", lat: 36.77221021037777, lng: -76.22061289444565 },
  { id: "34", name: "Sale 34", address: "1424 Saddle Ridge Drive, Aubrey, TX", lat: 39.71927771264808, lng: -105.42514939116516 },
  { id: "35", name: "Sale 35", address: "1825 Outpost Creek Ln, Aubrey, TX", lat: 33.2453405, lng: -96.8968664 },
  { id: "36", name: "Sale 36", address: "1701 Drover Creek Rd., Aubrey, TX", lat: 33.2447948, lng: -96.8993495 },
  { id: "37", name: "Sale 37", address: "812 Saratoga Rd, Aubrey, TX", lat: 42.910189, lng: -73.898288 },
  { id: "38", name: "Sale 38", address: "1320 Pleasant Knoll Trl, Aubrey, TX", lat: 33.2481161, lng: -96.9052545 },
  { id: "39", name: "Sale 39", address: "1929 Campground Way, Aubrey, TX", lat: 33.2468958, lng: -96.8958048 },
  { id: "40", name: "Sale 40", address: "1540 Laurel Av, Aubrey, TX", lat: 33.241182, lng: -96.909502 },
  { id: "41", name: "Sale 41", address: "1325 Sumner St, Aubrey, TX, 76227", lat: 33.24448, lng: -96.904429 },
  { id: "42", name: "Sale 42", address: "1416 Saddle Ridge Drive, Aubrey, TX 76227", lat: 33.24476, lng: -96.903425 },
  { id: "43", name: "Sale 43", address: "1436 Arrowwood Dr, Aubrey, TX", lat: 38.93380607043437, lng: -95.0918535433432 },
  { id: "44", name: "Sale 44", address: "1701 drover creek rd Aubrey tx 76227", lat: 33.244795, lng: -96.899349 },
  { id: "45", name: "Sale 45", address: "1305 Mill Place, Aubrey, TX", lat: 30.8427113, lng: -83.3075128 },
  { id: "46", name: "Sale 46", address: "1257 Pleasant Knoll Trail, Aubrey, TX", lat: 33.2486155, lng: -96.9064782 },
  { id: "47", name: "Sale 47", address: "1904 steppe trail dr, Aubrey, TX", lat: 33.2456656, lng: -96.8966864 },
];

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
  visited: makeIcon("#16a34a", "white"),
  skipped: makeIcon("#9ca3af", "white"),
  user: makeIcon("#2563eb", "white"),
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
  const [statuses, setStatuses] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sales"), (snapshot) => {
      const firebaseSales = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("🔥 Firestore sales:", firebaseSales);
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

      console.log("🔥 Firestore statuses:", statusMap);
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

  async function uploadSales() {
    if (uploading) return;

    const confirmed = window.confirm(
      "Upload all 47 sales to Firestore? Only click OK once, or you may create duplicates."
    );

    if (!confirmed) return;

    setUploading(true);

    try {
      for (const sale of salesData) {
        await addDoc(collection(db, "sales"), {
          originalId: sale.id,
          title: sale.name,
          name: sale.name,
          address: sale.address,
          lat: sale.lat,
          lng: sale.lng,
          custom: false,
        });
      }

      alert("Uploaded all sales to Firestore!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
    }
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
        {stats.visited}/{stats.total} visited · {stats.left} left ·{" "}
        {stats.skipped} skipped
      </div>

      <button onClick={uploadSales} disabled={uploading} style={uploadButtonStyle}>
        {uploading ? "Uploading..." : "Upload Sales"}
      </button>
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

const uploadButtonStyle = {
  position: "absolute",
  top: 130,
  left: 12,
  zIndex: 1000,
  background: "#ef4444",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #991b1b",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  fontWeight: "bold",
};
