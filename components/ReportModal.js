'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Camera, MapPin } from 'lucide-react';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Helper to compress and convert image to base64 data URL (max width 800px, 70% quality)
const convertToBase64 = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max_width = 800;
        let width = img.width;
        let height = img.height;
        if (width > max_width) {
          height = Math.round((height * max_width) / width);
          width = max_width;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64);
      };
    };
  });
};

// Helper to upload image to Firebase Storage with base64 fallback
const uploadImage = async (file) => {
  if (!storage) {
    return await convertToBase64(file);
  }
  try {
    const storageRef = ref(storage, `issues/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (err) {
    console.error("Storage upload failed, falling back to base64:", err);
    return await convertToBase64(file);
  }
};

export default function ReportModal({ isOpen, onClose, coordinates, onSubmit, currentUser }) {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [userNotes, setUserNotes] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiFailed, setAiFailed] = useState(false);

  // Editable/Manual fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Potholes & Road Damage');
  const [severity, setSeverity] = useState(3.0);
  const [description, setDescription] = useState('');

  // Load contact details from currentUser when modal opens
  useEffect(() => {
    if (isOpen) {
      setReporterName(currentUser?.name || '');
      setReporterPhone(currentUser?.phone || '');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const normalizeCategory = (cat) => {
    if (!cat) return 'Other';
    const c = cat.toLowerCase();
    if (c.includes('road') || c.includes('pavement') || c.includes('infrastructure')) return 'Potholes & Road Damage';
    if (c.includes('water') || c.includes('leak') || c.includes('sewage') || c.includes('pipe')) return 'Water Leakage';
    if (c.includes('garbage') || c.includes('sanitation') || c.includes('clean') || c.includes('litter') || c.includes('waste') || c.includes('dustbin')) return 'Garbage & Sanitation';
    if (c.includes('safety') || c.includes('hazard') || c.includes('wire') || c.includes('electricity') || c.includes('electric') || c.includes('cable')) return 'Safety Hazard';
    if (c.includes('streetlight') || c.includes('light')) return 'Safety Hazard';
    return 'Other';
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAiAnalysis(null); // Reset previous analysis
      setAiFailed(false);
      setTitle('');
      setCategory('Potholes & Road Damage');
      setSeverity(3.0);
      setDescription('');
      
      // Trigger Gemini automatic analysis on upload
      setIsAnalyzing(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userNotes', userNotes);
      formData.append('lat', coordinates.lat);
      formData.append('lng', coordinates.lng);
      formData.append('reporterName', currentUser?.name || 'Concerned Citizen');
      formData.append('reporterAddress', currentUser?.address || 'Local Address');

      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data && !data.error) {
          setAiAnalysis(data);
          setAiFailed(false);
          setTitle(data.title || '');
          setCategory(normalizeCategory(data.category));
          setSeverity(Number(data.severity) || 3.0);
          setDescription(data.description || '');
        } else {
          setAiFailed(true);
          setAiAnalysis(null);
          alert('Failed to analyze image. Please fill details manually.');
        }
      } catch (err) {
        console.error('API call failed:', err);
        setAiFailed(true);
        setAiAnalysis(null);
        alert('Failed to analyze image. Please fill details manually.');
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert('Please upload an image first.');
      return;
    }

    if (!aiAnalysis && !aiFailed) {
      alert('Please wait for the AI analysis to complete or fill details manually if it failed.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      alert('Please fill out the title and description fields.');
      return;
    }

    if (!reporterName.trim() || !reporterPhone.trim()) {
      alert('Please provide your name and phone number to record points on the leaderboard.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Upload to Firebase Storage or compress to Base64
      const finalImageUrl = await uploadImage(imageFile);

      // 2. Prepare submitted record data
      let finalIssueData;
      const reporterAddress = currentUser?.address || 'Local Address';

      if (aiFailed) {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Basic resolution timeline estimate
        const timeline = severity >= 4 ? "3-5 Business Days" : "5-7 Business Days";
        const explanation = `Priority queue based on severity level of ${severity}/5.`;
        
        // Draft a basic complaint letter
        const complaint = `To,\nThe Assistant Executive Engineer\nMunicipal Corporation\n\nSubject: Attention Required: ${title}\n\nRespected Sir/Madam,\n\nI am writing to report a civic issue: "${title}".\n\nDetails:\nCategory: ${category}\nDescription: ${description}\nLocation: Lat ${coordinates.lat.toFixed(4)}, Lng ${coordinates.lng.toFixed(4)}\nSeverity: ${severity}/5\n\nPlease inspect this site and take necessary action.\n\nSincerely,\n${reporterName}\nAddress: ${reporterAddress}\nCommunity Hero Platform`;

        // Default civic actions
        const actions = [
          "Be careful when passing by this area.",
          "Keep children and pets away from the hazard.",
          "Alert nearby residents about this issue."
        ];

        finalIssueData = {
          title,
          category,
          severity,
          severityReasoning: "Manually entered by citizen.",
          description,
          complaintDraft: complaint,
          resolutionTimeline: `${timeline}. ${explanation}`,
          civicActions: actions,
          refId: `CH-${randomSuffix}`,
          recipientEmail: "municipal.civic@dummy.gov.in",
        };
      } else {
        // AI succeeded - use the aiAnalysis object but override with edited values from states!
        finalIssueData = {
          ...aiAnalysis,
          title,
          category,
          severity,
          description,
        };

        // Update signature on complaintDraft if it exists
        if (finalIssueData.complaintDraft) {
          let draft = finalIssueData.complaintDraft;
          draft = draft.replace(/Sincerely,[\s\S]*$/gi, "");
          draft = draft.replace(/Sincerely[\s\S]*$/gi, "");
          draft = draft.replace(/Yours Sincerely,[\s\S]*$/gi, "");
          draft = draft.replace(/Yours Sincerely[\s\S]*$/gi, "");
          draft = draft.trim();
          draft += `\n\nSincerely,\n${reporterName}\nAddress: ${reporterAddress}\nCommunity Hero Platform`;
          finalIssueData.complaintDraft = draft;
        }
      }

      // 2.5. Reverse geocode location
      let city = 'N/A';
      let state = 'N/A';
      let pincode = 'N/A';
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&lat=${coordinates.lat}&lon=${coordinates.lng}`);
        const geoData = await geoRes.json();
        if (geoData && geoData.address) {
          city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.suburb || geoData.address.county || 'N/A';
          state = geoData.address.state || geoData.address.region || 'N/A';
          pincode = geoData.address.postcode || 'N/A';
        }
      } catch (err) {
        console.error("Failed to reverse-geocode coordinates:", err);
      }

      // Fallback to reporter's profile pincode if geocoding failed or returned N/A
      if ((pincode === 'N/A' || !pincode) && currentUser?.pincode) {
        pincode = currentUser.pincode;
      }

      // 3. Submit complete record back up to main page
      onSubmit({
        ...finalIssueData,
        reporterName,
        reporterPhone,
        reporterEmail: currentUser?.email || '',
        reporterAddress: reporterAddress,
        reporterAvatar: currentUser?.avatar || 'avatar_1',
        lat: coordinates.lat,
        lng: coordinates.lng,
        imageUrl: finalImageUrl,
        city,
        state,
        pincode,
        geocoded: true,
      });
      
      // Clean states and close
      setImageFile(null);
      setPreviewUrl(null);
      setUserNotes('');
      setAiAnalysis(null);
      setAiFailed(false);
      onClose();
    } catch (err) {
      console.error("Error submitting issue:", err);
      alert("Failed to submit issue. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0b1120] border border-slate-800/80 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/60 flex justify-between items-center bg-[#0e172a]/40">
          <h2 className="font-extrabold text-lg text-slate-100">Report Community Issue</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800/60 text-slate-400 hover:text-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
 
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#0b1120]">
          {/* Coordinates check */}
          <div className="flex items-center gap-2.5 text-xs text-indigo-400 bg-indigo-950/40 p-4 rounded-2xl border border-indigo-500/25">
            <MapPin className="w-4 h-4 stroke-[2.5px]" />
            <span className="font-medium tracking-wide">Target Location: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</span>
          </div>

          {/* Reporter Details (Name & Phone) - only show if not logged in */}
          {(!currentUser || !currentUser.phone) && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Your Name</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                  placeholder="Your name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                <input 
                  type="tel"
                  required
                  className="w-full px-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                  placeholder="Phone number"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                />
              </div>
            </div>
          )}
 
          {/* Context Notes */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Additional Notes</label>
            <textarea 
              rows={2}
              className="w-full px-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
              placeholder="Provide any extra details here to help Gemini analyze..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
            />
          </div>

          {/* Image Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Upload Photo</label>
            {previewUrl ? (
              <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-slate-800">
                <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                <button 
                  type="button" 
                  onClick={() => { setPreviewUrl(null); setImageFile(null); setAiAnalysis(null); setAiFailed(false); }}
                  className="absolute top-3 right-3 bg-slate-950/80 p-2 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-44 w-full border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-2xl cursor-pointer bg-slate-900/10 hover:bg-slate-900/30 transition-all duration-200 group">
                <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                  <Camera className="w-8 h-8 mb-2 stroke-[1.5px]" />
                  <span className="text-xs font-semibold">Click to select photo</span>
                  <span className="text-[10px] text-slate-600 mt-1">PNG, JPG, or WEBP</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} required />
              </label>
            )}
          </div>
 
          {/* AI Output Preview / Loading */}
          {isAnalyzing && (
            <div className="flex items-center justify-center p-6 border border-dashed border-indigo-500/30 rounded-2xl bg-indigo-950/20 text-indigo-400 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-semibold">Gemini is analyzing visual severity...</span>
            </div>
          )}

          {isSubmitting && (
            <div className="flex items-center justify-center p-6 border border-dashed border-indigo-500/30 rounded-2xl bg-indigo-950/20 text-indigo-400 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-semibold">Saving issue details and uploading image...</span>
            </div>
          )}
 
          {/* Manual inputs & AI output editable preview */}
          {(aiAnalysis || aiFailed) && (
            <div className="p-5 border border-slate-800 bg-[#0c1322] rounded-2xl space-y-4 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
              <h3 className="text-xs font-bold text-indigo-400 tracking-wider uppercase">
                {aiAnalysis ? 'AI Generated Details (Editable)' : 'Enter Details Manually'}
              </h3>
              
              <div className="space-y-3.5">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Issue Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500/50 transition placeholder-slate-600 font-medium"
                    placeholder="e.g. Hazardous wire bundle hanging low"
                  />
                </div>

                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500/50 transition cursor-pointer font-medium"
                  >
                    <option value="Potholes & Road Damage">Potholes & Road Damage</option>
                    <option value="Water Leakage">Water Leakage</option>
                    <option value="Garbage & Sanitation">Garbage & Sanitation</option>
                    <option value="Safety Hazard">Safety Hazard</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Severity Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Severity Level</label>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                      severity >= 4 ? 'bg-rose-950/40 text-rose-400 border-rose-500/30' :
                      severity >= 2.5 ? 'bg-amber-950/40 text-amber-400 border-amber-500/30' :
                      'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {Number(severity).toFixed(1)} / 5.0
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={severity}
                    onChange={(e) => setSeverity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-semibold px-0.5">
                    <span>1.0 Minor</span>
                    <span>3.0 Medium</span>
                    <span>5.0 Critical</span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Observation Description</label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-xl text-sm focus:outline-none focus:border-indigo-500/50 transition placeholder-slate-600 leading-relaxed font-medium"
                    placeholder="Describe what is broken or hazardous at this location..."
                  />
                </div>

                {/* AI severityReasoning note (Only if AI analyzed successfully) */}
                {aiAnalysis?.severityReasoning && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/30 p-3 rounded-xl border border-slate-900 leading-relaxed italic">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block not-italic text-[9px] mb-0.5">AI Severity Reasoning:</span>
                    "{aiAnalysis.severityReasoning}"
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isAnalyzing || isSubmitting || (!aiAnalysis && !aiFailed)}
              className="w-full py-4 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold tracking-wide rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-950/20 hover:shadow-indigo-950/40"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}