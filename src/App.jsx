import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, XCircle, LocateFixed, RotateCcw, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

const KML_URL = "/yardsales.kml";


const STATUS = {
  unvisited: { label: "Not visited", color: "#2563eb", icon: Circle },
  visited: { label: "Visited", color: "#16a34a", icon: CheckCircle2 },
  skipped: { label: "Skipped", color: "#dc2626", icon: XCircle },
};

function getStoredStatuses() {
  try {
    return JSON.parse(localStorage.getItem("yard-sale-statuses") || "{}");
  } catch {
    return {};
  }
}

function saveStatuses(statuses) {
  localStorage.setItem("yard-sale-statuses", JSON.stringify(statuses));
}

function cleanText(text) {
  return (text || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKml(kmlText) {
  const placemarks = kmlText.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];
  return placemarks.map((block, index) => {
    const nameRaw = block.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1];
    const addressRaw = block.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1];
    const descRaw = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1];

    const name = cleanText(nameRaw) || `Sale ${index + 1}`;
    const address = cleanText(addressRaw) || name;

    return {
      id: String(index),
      name,
      address,
      description: cleanText(descRaw),
    };
  }).filter((sale) => sale.address);
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function YardSaleTracker() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const userMarkerRef = useRef(null);

  const [sales, setSales] = useState([]);
  const [statuses, setStatuses] = useState(getStoredStatuses);
  const [selectedId, setSelectedId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loadState, setLoadState] = useState("Loading...");
  const [isLocating, setIsLocating] = useState(false);

  const selectedSale = sales.find((sale) => sale.id === selectedId) || null;

  const stats = useMemo(() => {
    const visited = sales.filter((sale) => statuses[sale.id] === "visited").length;
    const skipped = sales.filter((sale) => statuses[sale.id] === "skipped").length;
    return {
      visited,
      skipped,
      total: sales.length,
      unvisited: Math.max(sales.length - visited - skipped, 0),
    };
  }, [sales, statuses]);

  useEffect(() => {
    saveStatuses(statuses);
  }, [statuses]);

  useEffect(() => {
    async function init() {
      setLoadState("Google Maps disabled — switch to Leaflet next");
      return;
      
      try {
        const maps = window.google?.maps;

        const response = await fetch(KML_URL);
        if (!response.ok) throw new Error("Could not find public/yardsales.kml");

        const kmlText = await response.text();
        const addressSales = parseKml(kmlText);
        if (!addressSales.length) throw new Error("No addresses found in yardsales.kml");

        const map = new maps.Map(mapDivRef.current, {
          center: { lat: 33.2448, lng: -96.9031 },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const geocoder = new maps.Geocoder();
        const cached = JSON.parse(localStorage.getItem("yard-sale-coordinates") || "{}");
        const geocoded = [];

        for (const sale of addressSales) {
          if (cached[sale.id]) {
            geocoded.push({ ...sale, ...cached[sale.id] });
            continue;
          }

          setLoadState(`Geocoding ${geocoded.length + 1} of ${addressSales.length}...`);

          const query = `${sale.address}, Aubrey, TX`;
          try {
            const result = await geocoder.geocode({ address: query });
            if (result.results?.[0]) {
              const loc = result.results[0].geometry.location;
              const coords = { lat: loc.lat(), lng: loc.lng() };
              cached[sale.id] = coords;
              localStorage.setItem("yard-sale-coordinates", JSON.stringify(cached));
              geocoded.push({ ...sale, ...coords });
            }
          } catch (err) {
            console.warn("Could not geocode", sale.address, err);
          }

          await sleep(150);
        }

        if (!geocoded.length) throw new Error("Google could not geocode the addresses. Check Geocoding API is enabled.");

        setSales(geocoded);
        setLoadState("Loaded");

        const bounds = new maps.LatLngBounds();

        geocoded.forEach((sale, index) => {
          const marker = new maps.Marker({
            position: { lat: sale.lat, lng: sale.lng },
            map,
            label: String(index + 1),
            title: sale.name,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: STATUS[statuses[sale.id] || "unvisited"].color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          marker.addListener("click", () => setSelectedId(sale.id));
          markerRefs.current[sale.id] = marker;
          bounds.extend(marker.getPosition());
        });

        map.fitBounds(bounds);
      } catch (error) {
        console.error(error);
        setLoadState(`Error: ${error.message || error}`);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!window.google?.maps) return;

    sales.forEach((sale) => {
      const marker = markerRefs.current[sale.id];
      if (!marker) return;
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: STATUS[statuses[sale.id] || "unvisited"].color,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      });
    });
  }, [statuses, sales]);

  function setStatus(saleId, status) {
    setStatuses((current) => ({ ...current, [saleId]: status }));
  }

  function resetAll() {
    if (!window.confirm("Reset all visited/skipped statuses?")) return;
    setStatuses({});
  }

  function locateMe() {
    if (!navigator.geolocation) {
      alert("Location is not available in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(next);
        setIsLocating(false);

        if (!mapRef.current || !window.google?.maps) return;

        if (!userMarkerRef.current) {
          userMarkerRef.current = new window.google.maps.Marker({
            position: next,
            map: mapRef.current,
            title: "You are here",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: "#0ea5e9",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          });
        } else {
          userMarkerRef.current.setPosition(next);
        }

        mapRef.current.setCenter(next);
        mapRef.current.setZoom(16);
      },
      (error) => {
        setIsLocating(false);
        alert(error.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function focusSale(sale) {
    setSelectedId(sale.id);
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: sale.lat, lng: sale.lng });
      mapRef.current.setZoom(17);
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
    <div className="h-screen w-full bg-slate-950 text-white">
      <div ref={mapDivRef} className="absolute inset-0" />

      <div className="absolute left-3 right-3 top-3 z-10 rounded-3xl bg-slate-950/90 p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Yard Sale Tracker</h1>
            <p className="text-xs text-slate-300">
              {stats.visited}/{stats.total} visited · {stats.unvisited} left · {stats.skipped} skipped
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={locateMe} className="rounded-2xl bg-white px-3 py-2 text-slate-950">
              {isLocating ? "..." : <LocateFixed className="h-5 w-5" />}
            </button>
            <button onClick={resetAll} className="rounded-2xl bg-slate-800 px-3 py-2 text-white">
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
        {loadState !== "Loaded" && <p className="mt-2 rounded-xl bg-white p-2 text-xs text-slate-900">{loadState}</p>}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[43vh] overflow-auto rounded-t-[2rem] bg-slate-950/95 p-4 shadow-2xl">
        {selectedSale ? (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Selected sale</p>
                <h2 className="text-xl font-bold">{selectedSale.name}</h2>
                <p className="text-sm text-slate-300">{selectedSale.address}</p>
              </div>
              <button className="rounded-full bg-slate-800 px-3 py-1 text-sm" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS).map(([key, meta]) => {
                const Icon = meta.icon;
                const active = (statuses[selectedSale.id] || "unvisited") === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStatus(selectedSale.id, key)}
                    className={`rounded-2xl p-3 text-xs font-bold ${active ? "bg-white text-slate-950" : "bg-slate-800 text-white"}`}
                  >
                    <Icon className="mx-auto mb-1 h-5 w-5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <a
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 p-3 text-sm font-bold text-white"
              href={directionsUrl(selectedSale)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation className="h-4 w-4" /> Open directions
            </a>
          </div>
        ) : (
          <div>
            <h2 className="mb-2 font-bold">Sales</h2>
            <div className="space-y-2">
              {sales.map((sale, index) => {
                const statusKey = statuses[sale.id] || "unvisited";
                return (
                  <button
                    key={sale.id}
                    onClick={() => focusSale(sale)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 p-3 text-left"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ background: STATUS[statusKey].color }}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{sale.name}</p>
                      <p className="text-xs text-slate-400">{STATUS[statusKey].label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
