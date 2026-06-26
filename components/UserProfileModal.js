'use client';

import React from 'react';
import { X, Award, Shield, Calendar, MapPin } from 'lucide-react';

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

export default function UserProfileModal({ isOpen, onClose, user, issues, onSelectIssue }) {
  if (!isOpen || !user) return null;

  // Calculate dynamic points from matched user or fallback
  const userPoints = user.points || 0;
  
  // Find current avatar information
  const avatarInfo = AVATARS.find(a => a.id === user.avatar) || AVATARS[0];

  // Resolve user's rank/title
  const getRankTitle = (pts) => {
    if (pts >= 1000) return 'Community Hero';
    if (pts >= 750) return 'Elite Guardian';
    if (pts >= 500) return 'Municipal Master';
    if (pts >= 250) return 'Civic Defender';
    if (pts >= 100) return 'Community Sentinel';
    if (pts >= 20) return 'Civic Rookie';
    return 'Active Citizen';
  };

  const rankTitle = getRankTitle(userPoints);

  // Filter badges to only show activated/unlocked ones
  const unlockedBadges = BADGES.filter(badge => userPoints >= badge.points);

  // Filter issues reported by this citizen
  // Match either by email (if available) or by reporterName case-insensitive comparison
  const citizenIssues = issues.filter(issue => {
    if (user.email && issue.reporterEmail) {
      return issue.reporterEmail.toLowerCase() === user.email.toLowerCase();
    }
    return issue.reporterName && issue.reporterName.toLowerCase().trim() === user.name.toLowerCase().trim();
  });

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-400" />
            <h2 className="text-lg font-black text-slate-200 tracking-wide">Citizen Profile</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800/50 rounded-xl transition text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main User Card Section */}
          <div className="bg-slate-900/20 border border-slate-800/40 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl border flex items-center justify-center text-5xl shrink-0 ${avatarInfo.bg} shadow-lg shadow-indigo-500/5`}>
              {avatarInfo.emoji}
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <h3 className="text-xl font-black text-slate-100 tracking-tight flex flex-col sm:flex-row sm:items-center gap-2">
                <span>{user.name}</span>
                <span className="inline-flex items-center text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg w-fit mx-auto sm:mx-0">
                  {rankTitle}
                </span>
              </h3>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span className="font-extrabold text-slate-300">{userPoints} Dynamic Points</span>
                </div>
                {user.createdAt && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Joined {new Date(user.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Unlocked Badges (5 cols) */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl flex flex-col">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Activated Achievements ({unlockedBadges.length})</h4>
                
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {unlockedBadges.length === 0 ? (
                    <div className="text-center py-8 text-slate-650 text-xs font-bold border border-dashed border-slate-800/60 rounded-xl">
                      No badges activated yet
                    </div>
                  ) : (
                    unlockedBadges.map((badge) => (
                      <div 
                        key={badge.id}
                        className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl flex items-start gap-3 shadow-[0_0_12px_rgba(245,158,11,0.02)]"
                      >
                        <span className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center shrink-0 select-none bg-amber-500/10">
                          {badge.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-black text-amber-400">
                            {badge.title}
                          </h5>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed break-words">{badge.desc}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Citizen Reports (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl flex flex-col h-[340px]">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Citizen Reports ({citizenIssues.length})</h4>
                
                <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                  {citizenIssues.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 text-xs font-bold border border-dashed border-slate-800/60 rounded-xl">
                      No issues reported yet
                    </div>
                  ) : (
                    citizenIssues.map((issue) => (
                      <div
                        key={issue.id}
                        onClick={() => {
                          onSelectIssue(issue);
                          onClose();
                        }}
                        className="p-3 bg-slate-950 border border-slate-850 hover:border-indigo-500/30 rounded-xl flex items-center justify-between cursor-pointer transition text-xs hover:bg-slate-900/50"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <h5 className="font-extrabold text-slate-300 truncate leading-snug">{issue.title}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{issue.category}</span>
                            {issue.city && (
                              <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 text-slate-600" />
                                {issue.city}
                              </span>
                            )}
                          </div>
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
    </div>
  );
}
