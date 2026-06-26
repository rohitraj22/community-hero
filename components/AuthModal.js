'use client';

import React, { useState } from 'react';
import { X, User, Mail, Phone, MapPin, Lock, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  if (!isOpen) return null;

  const handleToggleTab = () => {
    setIsLoginTab(!isLoginTab);
    setErrorMsg('');
    setSuccessMsg('');
    // Reset fields
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setPincode('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both Email/Phone and Password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      if (!db) {
        // Fallback for offline mode
        console.warn("Firebase not connected. Using local mock login.");
        const mockUser = {
          name: 'Demo Citizen',
          email: email.trim(),
          phone: '9876543210',
          address: 'Bangalore, Karnataka',
          pincode: '560001',
          defaultLat: 12.9716,
          defaultLng: 77.5946,
          points: 0,
          avatar: 'avatar_1'
        };
        onLoginSuccess(mockUser);
        onClose();
        return;
      }

      const input = email.trim();
      const usersRef = collection(db, 'users');
      
      // Query by email
      const qEmail = query(usersRef, where('email', '==', input), where('password', '==', password));
      const snapshotEmail = await getDocs(qEmail);

      let matchedUserDoc = null;
      if (!snapshotEmail.empty) {
        matchedUserDoc = snapshotEmail.docs[0];
      } else {
        // Query by phone
        const qPhone = query(usersRef, where('phone', '==', input), where('password', '==', password));
        const snapshotPhone = await getDocs(qPhone);
        if (!snapshotPhone.empty) {
          matchedUserDoc = snapshotPhone.docs[0];
        }
      }

      if (matchedUserDoc) {
        const userData = { id: matchedUserDoc.id, ...matchedUserDoc.data() };
        // Delete password from memory
        delete userData.password;
        onLoginSuccess(userData);
        onClose();
      } else {
        setErrorMsg('Invalid login credentials. Please check your credentials and try again.');
      }
    } catch (err) {
      console.error("Login failed:", err);
      setErrorMsg('Failed to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validations
    if (!name.trim() || !email.trim() || !phone.trim() || !address.trim() || !pincode.trim() || !password.trim()) {
      setErrorMsg('Please fill in all the required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      let defaultLat = 12.9716;
      let defaultLng = 77.5946;
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
        console.warn("Geocoding failed. Using default center coordinates.", err);
      }

      if (!db) {
        // Fallback for offline mode
        const mockUser = {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          pincode: pincode.trim(),
          defaultLat,
          defaultLng,
          points: 0,
          avatar: 'avatar_1'
        };
        onLoginSuccess(mockUser);
        onClose();
        return;
      }

      // Step 2: Check if email already exists
      const usersRef = collection(db, 'users');
      const qExist = query(usersRef, where('email', '==', email.trim()));
      const snapExist = await getDocs(qExist);

      if (!snapExist.empty) {
        setErrorMsg('An account with this email address already exists.');
        setLoading(false);
        return;
      }

      // Step 3: Write new user document to Firestore
      const newUser = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        password, // stored directly for hackathon simplicity
        defaultLat,
        defaultLng,
        points: 0,
        avatar: 'avatar_1',
        celebratedBadges: [],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(usersRef, newUser);
      const userData = { id: docRef.id, ...newUser };
      delete userData.password;

      setSuccessMsg('Account created successfully! Logging you in...');
      setTimeout(() => {
        onLoginSuccess(userData);
        onClose();
      }, 1000);

    } catch (err) {
      console.error("Signup failed:", err);
      setErrorMsg('Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[1500] p-4">
      <div className="bg-[#0b1120] border border-slate-800/80 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/60 flex justify-between items-center bg-[#0e172a]/40">
          <h2 className="font-extrabold text-lg text-slate-100">
            {isLoginTab ? 'Access Portal' : 'Citizen Registration'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800/60 text-slate-400 hover:text-slate-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1 bg-[#090e1a]/80 border-b border-slate-800/50">
          <button
            onClick={() => { if (!isLoginTab) handleToggleTab(); }}
            className={`py-3 text-xs font-bold transition-all ${
              isLoginTab 
                ? 'text-indigo-400 bg-slate-900/30 border-b-2 border-indigo-500' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { if (isLoginTab) handleToggleTab(); }}
            className={`py-3 text-xs font-bold transition-all ${
              !isLoginTab 
                ? 'text-indigo-400 bg-slate-900/30 border-b-2 border-indigo-500' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#0b1120]">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/25 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/25 rounded-2xl flex items-start gap-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {isLoginTab ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Email Address / Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                    placeholder="Enter email or mobile number"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    className="w-full pl-11 pr-12 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-350 transition flex items-center justify-center"
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold tracking-wide rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Log In
                </button>
              </div>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                      placeholder="email@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                      placeholder="Street, Area, City"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Pincode</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                    placeholder="560001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-12 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-350 transition flex items-center justify-center"
                      title={showSignupPassword ? "Hide password" : "Show password"}
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type={showSignupConfirmPassword ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-12 py-3 border border-slate-800/80 bg-slate-950/40 text-slate-100 rounded-2xl text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition placeholder-slate-600"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                      className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-355 transition flex items-center justify-center"
                      title={showSignupConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold tracking-wide rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Account
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
