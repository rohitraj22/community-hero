import React, { useState, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Shield, Plus, MapPin, AlertCircle } from 'lucide-react';

// Map configuration
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const center = {
  lat: 12.9716, // Default center (e.g., Bangalore)
  lng: 77.5946,
};

const options = {
  disableDefaultUI: true,
  zoomControl: true,
};

// Mock issue data aligning with the planned schema
const mockIssues = [
  {
    id: 'issue_1',
    title: 'Large Pothole',
    category: 'Roads & Infrastructure',
    status: 'reported', // Red pin
    lat: 12.9750,
    lng: 77.5960,
    upvotes: 4,
  },
  {
    id: 'issue_2',
    title: 'Water Leakage',
    category: 'Water Leakage',
    status: 'dispatched', // Orange pin
    lat: 12.9720,
    lng: 77.5930,
    upvotes: 12,
  },
  {
    id: 'issue_3',
    title: 'Broken Streetlight',
    category: 'Streetlights',
    status: 'resolved', // Green pin
    lat: 12.9690,
    lng: 77.5950,
    upvotes: 2,
  },
];

// Helper to return marker colors based on status
const getMarkerIcon = (status) => {
  switch (status) {
    case 'reported':
      return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    case 'dispatched':
      return 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png';
    case 'resolved':
      return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
    default:
      return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
  }
};

export default function MapDashboard() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '', // Define this in your .env file
  });

  const [selectedIssue, setSelectedIssue] = useState(null);

  const onMapClick = useCallback((event) => {
    // This function will eventually trigger the submission modal with coordinates
    console.log("Clicked Coordinates: ", event.latLng.lat(), event.latLng.lng());
  }, []);

  if (loadError) return <div className="p-4 text-red-500">Error loading maps API</div>;
  if (!isLoaded) return <div className="p-4 text-gray-500">Loading maps...</div>;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-xl tracking-tight">Community Hero</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full">
            My Rank: #12 (150 pts)
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Map View */}
        <div className="w-2/3 h-full relative">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={14}
            center={center}
            options={options}
            onClick={onMapClick}
          >
            {mockIssues.map((issue) => (
              <Marker
                key={issue.id}
                position={{ lat: issue.lat, lng: issue.lng }}
                icon={getMarkerIcon(issue.status)}
                onClick={() => setSelectedIssue(issue)}
              />
            ))}

            {selectedIssue && (
              <InfoWindow
                position={{ lat: selectedIssue.lat, lng: selectedIssue.lng }}
                onCloseClick={() => setSelectedIssue(null)}
              >
                <div className="p-2 max-w-xs text-sm">
                  <h4 className="font-bold text-gray-900">{selectedIssue.title}</h4>
                  <p className="text-gray-500 text-xs">{selectedIssue.category}</p>
                  <p className="mt-1 font-semibold text-xs capitalize text-indigo-600">
                    Status: {selectedIssue.status}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{selectedIssue.upvotes} Upvotes</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Trigger Button Overlay */}
          <button 
            className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition font-medium z-10"
            onClick={() => alert("Open report intake modal")}
          >
            <Plus className="w-5 h-5" />
            Report Issue
          </button>
        </div>

        {/* Sidebar */}
        <aside className="w-1/3 h-full bg-white border-l border-gray-200 flex flex-col z-10">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-lg">Nearby Issues</h2>
            <p className="text-xs text-gray-500 mt-1">Review active items reported in your zone</p>
          </div>

          {/* Active Issue List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mockIssues.map((issue) => (
              <div 
                key={issue.id}
                onClick={() => setSelectedIssue(issue)}
                className={`p-4 rounded-xl border border-gray-100 hover:border-indigo-100 cursor-pointer transition ${
                  selectedIssue?.id === issue.id ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-sm">{issue.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" /> {issue.category}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    issue.status === 'reported' ? 'bg-red-50 text-red-600' :
                    issue.status === 'dispatched' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {issue.status}
                  </span>
                </div>
                <div className="mt-3 flex justify-between items-center text-xs text-gray-400">
                  <span>{issue.upvotes} citizens verified</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}