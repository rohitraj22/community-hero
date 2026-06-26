'use client';

import React, { useState, useEffect } from 'react';
import { X, Mail, MapPin, Lock, Loader2, AlertCircle, CheckCircle2, User, Phone, Shield, Award, Eye, EyeOff } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const AVATARS = [
  { id: 'avatar_1', emoji: '👮', label: 'Civic Guard', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'avatar_2', emoji: '🧑‍🚒', label: 'Safety Officer', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'avatar_3', emoji: '👷', label: 'Road Builder', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'avatar_4', emoji: '🌱', label: 'Eco Guardian', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'avatar_5', emoji: '💧', label: 'Water Saver', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { id: 'avatar_6', emoji: '⚡', label: 'Utility Master', bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
];

const BADGES = [
  { id: 'rookie', title: 'Civic Rookie', emoji: '🌟', points: 20, desc: 'Started your civic journey!' },
  { id: 'sentinel', title: 'Community Sentinel', emoji: '🛡️', points: 100, desc: 'Actively tracking local problems.' },
  { id: 'defender', title: 'Civic Defender', emoji: '⚔️', points: 250, desc: 'Trusted community problem solver.' },
  { id: 'master', title: 'Municipal Master', emoji: '🏛️', points: 500, desc: 'High-tier citizen routing authority.' },
  { id: 'guardian', title: 'Elite Guardian', emoji: '🔰', points: 750, desc: 'Distinguished community advocate.' },
  { id: 'hero', title: 'Community Hero', emoji: '👑', points: 1000, desc: 'Ultimate savior and guardian of the city!' }
];

export default function ProfileModal({ isOpen, onClose, currentUser, currentUserPoints, onProfileUpdate, issues, onSelectIssue }) {
  const [activeAvatar, setActiveAvatar] = useState(currentUser?.avatar || 'avatar_1');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [pincode, setPincode] = useState(currentUser?.pincode || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (currentUser) {
      setActiveAvatar(currentUser.avatar || 'avatar_1');
      setEmail(currentUser.email || '');
      setAddress(currentUser.address || '');
      setPincode(currentUser.pincode || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const currentAvatarInfo = AVATARS.find(a => a.id === activeAvatar) || AVATARS[0];
  const userIssues = issues.filter(issue => issue.reporterEmail === currentUser.email);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !address.trim() || !pincode.trim()) {
      setErrorMsg('Please fill in all the required fields.');
      return;
    }

    setLoading(true);

    try {
      let defaultLat = currentUser.defaultLat || 12.9716;
      let defaultLng = currentUser.defaultLng || 77.5946;

      // Geocode pincode/address only if pincode has changed
      if (pincode.trim() !== currentUser.pincode) {
        try {
          const attempts = [
            `${address.trim()} ${pincode.trim()} India`,
            `${pincode.trim()} India`,
            `${address.trim()} India`
          ];
          
          let geocodeSuccess = false;
          for (const q of attempts) {
            if (geocodeSuccess) break;
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=en&q=${encodeURIComponent(q)}`);
              const data = await res.json();
              if (data && data.length > 0) {
                defaultLat = parseFloat(data[0].lat);
                defaultLng = parseFloat(data[0].lon);
                geocodeSuccess = true;
              }
            } catch (e) {
              console.warn(`Geocoding attempt failed for "${q}":`, e);
            }
          }
        } catch (err) {
          console.warn("Geocoding failed during profile update. Keeping existing coordinates.", err);
        }
      }

      const updatedFields = {
        email: email.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        avatar: activeAvatar,
        defaultLat,
        defaultLng,
      };

      if (password.trim()) {
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        updatedFields.password = password;
      }

      if (db && currentUser.id) {
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, updatedFields);
      }

      // Propagate state update
      const updatedUser = {
        ...currentUser,
        ...updatedFields
      };
      delete updatedUser.password; // do not store password in state

      onProfileUpdate(updatedUser);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setPassword('');
      }, 2000);

    } catch (err) {
      console.error("Profile update failed:", err);
      setErrorMsg('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-indigo-400" />
            <h2 className="text-lg font-black text-slate-200 tracking-wide">Citizen Profile & Achievements</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800/50 rounded-xl transition text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Column: Form & Avatars (7 cols) */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Avatar Picker */}
            <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Choose Your Civic Avatar</h3>
              
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-4xl shrink-0 ${currentAvatarInfo.bg} shadow-lg shadow-indigo-500/5 animate-pulse`}>
                  {currentAvatarInfo.emoji}
                </div>
                <div className="grid grid-cols-6 gap-2 w-full">
                  {AVATARS.map((av) => (
                    <button
                      key={av.id}
                      onClick={() => setActiveAvatar(av.id)}
                      title={av.label}
                      type="button"
                      className={`h-10 rounded-xl border flex items-center justify-center text-xl transition-all duration-200 ${
                        activeAvatar === av.id 
                          ? `${av.bg} scale-110 shadow-md ring-2 ring-indigo-500/40`
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 hover:scale-105'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Profile Info Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Credentials</h3>
              
              {errorMsg && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {successMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Name - Disabled */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Full Name (Fixed)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      value={currentUser.name}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-900 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Phone - Disabled */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Phone Number (Fixed)</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      value={currentUser.phone}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/40 border border-slate-900 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition focus:border-indigo-500/80 outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Home Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition focus:border-indigo-500/80 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Pincode */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Pincode (Updates Coordinates)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition focus:border-indigo-500/80 outline-none"
                    />
                  </div>
                </div>

                {/* Password change */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-500 mb-1.5">Change Password (Optional)</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition focus:border-indigo-500/80 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-550 hover:text-slate-350 transition flex items-center justify-center"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 border border-indigo-400/10 shadow-lg shadow-indigo-500/10 mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating Account...
                  </>
                ) : (
                  'Save Profile Details'
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Badges & My Reports (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            
            {/* Achievements */}
            <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Honor Badges</h3>
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                  {currentUserPoints} PTS
                </span>
              </div>

              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {BADGES.map((badge) => {
                  const isUnlocked = currentUserPoints >= badge.points;
                  return (
                    <div 
                      key={badge.id}
                      className={`p-3 rounded-xl border flex items-start gap-3.5 transition-all duration-300 ${
                        isUnlocked 
                          ? 'bg-slate-950 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.04)]'
                          : 'bg-slate-950/40 border-slate-900 opacity-40'
                      }`}
                    >
                      <span className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center shrink-0 select-none ${isUnlocked ? 'bg-amber-500/10' : 'bg-slate-900 filter grayscale'}`}>
                        {badge.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-black ${isUnlocked ? 'text-amber-400' : 'text-slate-500'}`}>
                          {badge.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed break-words">{badge.desc}</p>
                      </div>
                      <span className={`text-[9px] font-black shrink-0 px-2 py-0.5 rounded border ${
                        isUnlocked 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}>
                        {isUnlocked ? 'UNLOCKED' : `${badge.points} PTS`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* My Reports */}
            <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl h-48 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">My Reports ({userIssues.length})</h3>
              
              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {userIssues.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 text-xs font-bold border border-dashed border-slate-800/60 rounded-xl">
                    No issues reported yet
                  </div>
                ) : (
                  userIssues.map((issue) => (
                    <div
                      key={issue.id}
                      onClick={() => {
                        onSelectIssue(issue);
                        onClose();
                      }}
                      className="p-2.5 bg-slate-950 border border-slate-850 hover:border-indigo-500/30 rounded-xl flex items-center justify-between cursor-pointer transition text-xs hover:bg-slate-900/50"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <h4 className="font-extrabold text-slate-300 truncate leading-snug">{issue.title}</h4>
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{issue.category}</span>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded shrink-0 ${
                        issue.status === 'resolved' 
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : issue.status === 'in-progress'
                            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            : issue.status === 'verified'
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}>
                        {issue.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
