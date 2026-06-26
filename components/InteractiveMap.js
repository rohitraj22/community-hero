import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Circle } from 'react-leaflet';
import { Search, Loader2 } from 'lucide-react';

function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function ChangeMapView({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords[0] && coords[1]) {
      map.flyTo(coords, 15, {
        animate: true,
        duration: 1.2
      });
    }
  }, [coords, map]);
  return null;
}

function MapSearch({ onSearchSelect }) {
  const map = useMap();
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  // Disable Leaflet propagation for the search bar container
  useEffect(() => {
    if (containerRef.current) {
      import('leaflet').then((L) => {
        L.DomEvent.disableClickPropagation(containerRef.current);
        L.DomEvent.disableScrollPropagation(containerRef.current);
      });
    }
  }, []);

  // Close dropdown on map panning/zoom
  useEffect(() => {
    const handleMapInteract = () => {
      setShowDropdown(false);
    };
    map.on('dragstart zoomstart click', handleMapInteract);
    return () => {
      map.off('dragstart zoomstart click', handleMapInteract);
    };
  }, [map]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (queryText.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=5`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'Community-Hero-App-Civic'
          }
        });
        const data = await res.json();
        if (data) {
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [queryText]);

  const handleSelectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    map.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
    onSearchSelect({ lat, lng });
    setQueryText(item.display_name);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=1`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'Community-Hero-App-Civic'
        }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        handleSelectSuggestion(data[0]);
      } else {
        alert("Location not found. Please try a more specific search.");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      alert("Error searching for location.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="absolute top-4 left-14 z-[1000] w-80 flex flex-col gap-1.5">
      <div className="bg-[#0c1224]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1.5 flex items-center gap-1.5">
        <form onSubmit={handleSearch} className="flex w-full items-center gap-1.5">
          <div className="flex items-center gap-2 pl-3 flex-1">
            {loading ? (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <input
              type="text"
              placeholder="Search address or area..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="w-full bg-transparent border-0 text-slate-100 placeholder-slate-500 text-xs py-1.5 outline-none font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl text-[11px] font-extrabold transition-all duration-200 shadow-md shadow-indigo-950/20 shrink-0 border border-indigo-400/10"
          >
            Search
          </button>
        </form>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="bg-[#0c1224]/95 backdrop-blur-lg border border-slate-800/90 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-800/40">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-4 py-3 hover:bg-slate-800/50 text-slate-300 hover:text-slate-100 transition-all duration-150 text-[11px] leading-snug font-medium truncate"
              title={item.display_name}
            >
              {item.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InteractiveMap({ center, zoom, focusedIssue, customIcon, selectedIcon, selectedPosition, onMapClick, heatmapMode, issues }) {
  return (
    <MapContainer center={center} zoom={zoom} className="w-full h-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onMapClick={onMapClick} />
      <MapSearch onSearchSelect={onMapClick} />
      <ChangeMapView coords={center} />
      
      {heatmapMode && issues && issues.length > 0 && issues.map((issue) => {
        if (issue.status === 'resolved' || !issue.lat || !issue.lng) return null;
        const color = issue.severity >= 4.0 ? '#f43f5e' : '#f59e0b';
        return (
          <Circle
            key={`heat_${issue.id}`}
            center={[issue.lat, issue.lng]}
            radius={(issue.severity || 1.0) * 120}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.18,
              stroke: false
            }}
          />
        );
      })}
      
      {focusedIssue && (
        <Marker 
          position={[focusedIssue.lat, focusedIssue.lng]} 
          icon={customIcon}
        >
          <Popup>
            <div className="p-1.5 max-w-xs text-sm">
              <h4 className="font-extrabold text-slate-900 leading-snug">{focusedIssue.title}</h4>
              <span className="inline-block mt-1 text-[10px] uppercase font-extrabold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                {focusedIssue.category}
              </span>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed italic">"{focusedIssue.description}"</p>
              {focusedIssue.refId && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
                  Ref ID: {focusedIssue.refId}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {selectedPosition && (
        <Marker 
          position={[selectedPosition.lat, selectedPosition.lng]} 
          icon={selectedIcon}
        >
          <Popup>
            <div className="p-1 text-xs font-semibold text-rose-600">
              Selected Location (Click "Report Local Issue" to report here)
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
