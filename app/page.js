'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  Shield, Plus, MapPin, ThumbsUp, Award, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, Activity, Copy, 
  ChevronLeft, Users, FileText, Lightbulb, Check, Trash2, User, Mail, Bell,
  Filter, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import ReportModal from '../components/ReportModal';
import AuthModal from '../components/AuthModal';
import ProfileModal from '../components/ProfileModal';
import UserProfileModal from '../components/UserProfileModal';
import 'leaflet/dist/leaflet.css';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Dynamically import InteractiveMap to prevent Next.js SSR errors
const InteractiveMap = dynamic(() => import('../components/InteractiveMap'), { ssr: false });

const BADGES = [
  { id: 'rookie', title: 'Civic Rookie', emoji: '🌟', points: 20, desc: 'Started your civic journey!' },
  { id: 'sentinel', title: 'Community Sentinel', emoji: '🛡️', points: 100, desc: 'Actively tracking local problems.' },
  { id: 'defender', title: 'Civic Defender', emoji: '⚔️', points: 250, desc: 'Trusted community problem solver.' },
  { id: 'master', title: 'Municipal Master', emoji: '🏛️', points: 500, desc: 'High-tier citizen routing authority.' },
  { id: 'guardian', title: 'Elite Guardian', emoji: '🔰', points: 750, desc: 'Distinguished community advocate.' },
  { id: 'hero', title: 'Community Hero', emoji: '👑', points: 1000, desc: 'Ultimate savior and guardian of the city!' }
];

const center = [12.9716, 77.5946]; // Bangalore coordinates

export default function Home() {
  const [customIcon, setCustomIcon] = useState(null);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [issues, setIssues] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportCoordinates, setReportCoordinates] = useState({ lat: 12.9716, lng: 77.5946 });
  const [selectedPosition, setSelectedPosition] = useState(null);
  
  // New States
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeTab, setActiveTab] = useState('reports');
  const [copied, setCopied] = useState(false);
  const [checkedActions, setCheckedActions] = useState({});
  const [myUpvotes, setMyUpvotes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState('overall'); // 'overall' or 'weekly'
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [celebratingBadge, setCelebratingBadge] = useState(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);

  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState('escalation'); // 'escalation', 'activity', 'achievements'

  // Sorting and Filtering States
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterEscalation, setFilterEscalation] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Retrieve read notification IDs from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('community_hero_read_notifications');
    if (saved) {
      try {
        setReadNotificationIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse read notifications:", e);
      }
    }
  }, []);



  const getAvatarEmoji = (id) => {
    const mapping = {
      avatar_1: '👮',
      avatar_2: '🧑‍🚒',
      avatar_3: '👷',
      avatar_4: '🌱',
      avatar_5: '💧',
      avatar_6: '⚡'
    };
    return mapping[id] || '👮';
  };

  const getCommenterAvatar = (comment) => {
    if (!comment) return 'avatar_1';
    const foundUser = allUsers.find(u => u.email === comment.email);
    return foundUser ? foundUser.avatar : (comment.avatar || 'avatar_1');
  };

  // Retrieve persisted user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('community_hero_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        if (user.defaultLat && user.defaultLng) {
          setMapCenter([user.defaultLat, user.defaultLng]);
          setReportCoordinates({ lat: user.defaultLat, lng: user.defaultLng });
        }
      } catch (e) {
        console.error("Failed to parse saved user:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.defaultLat && currentUser.defaultLng) {
      // Clear any temporary selection/focused issue so map flies directly to user location
      setSelectedPosition(null);
      setSelectedIssue(null);
      setReportCoordinates({ lat: currentUser.defaultLat, lng: currentUser.defaultLng });
    } else if (!currentUser) {
      setSelectedPosition(null);
      setSelectedIssue(null);
      setReportCoordinates({ lat: 12.9716, lng: 77.5946 });
    }
  }, [currentUser]);
  // Consolidate map centering and reset logic based on selectedIssue and currentUser
  useEffect(() => {
    if (selectedIssue && selectedIssue.lat && selectedIssue.lng) {
      setMapCenter([selectedIssue.lat, selectedIssue.lng]);
    } else {
      if (currentUser && currentUser.defaultLat && currentUser.defaultLng) {
        setMapCenter([currentUser.defaultLat, currentUser.defaultLng]);
      } else {
        setMapCenter([12.9716, 77.5946]);
      }
    }
  }, [selectedIssue, currentUser]);

  // Retroactive coordinate healing for users with default fallback coordinates
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;
    
    // Check if the user's coordinates are the default Bangalore ones
    const isDefaultBangalore = 
      Math.abs(currentUser.defaultLat - 12.9716) < 0.0001 && 
      Math.abs(currentUser.defaultLng - 77.5946) < 0.0001;
      
    if (isDefaultBangalore && currentUser.pincode) {
      const healUserCoordinates = async () => {
        try {
          const addressQuery = `${currentUser.address || ''} ${currentUser.pincode} India`.trim();
          const attempts = [
            addressQuery,
            `${currentUser.pincode} India`,
            `${currentUser.address || ''} India`
          ];
          
          let resolved = null;
          for (const q of attempts) {
            if (!q || q === "India") continue;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=en&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data && data.length > 0) {
              resolved = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
              };
              break;
            }
          }
          
          if (resolved) {
            const isResolvedBangalore = 
              Math.abs(resolved.lat - 12.9716) < 0.0001 && 
              Math.abs(resolved.lng - 77.5946) < 0.0001;
              
            if (!isResolvedBangalore) {
              console.log(`Healed user coordinates from Bangalore to:`, resolved);
              const updatedUser = {
                ...currentUser,
                defaultLat: resolved.lat,
                defaultLng: resolved.lng
              };
              
              // Update in state
              setCurrentUser(updatedUser);
              localStorage.setItem('community_hero_user', JSON.stringify(updatedUser));
              
              // Update in Firestore
              if (db && !currentUser.id.startsWith('temp_')) {
                const userRef = doc(db, 'users', currentUser.id);
                await updateDoc(userRef, {
                  defaultLat: resolved.lat,
                  defaultLng: resolved.lng
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to heal user coordinates retroactively:", err);
        }
      };
      
      healUserCoordinates();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      const voted = issues
        .filter(issue => issue.upvoteDetails?.some(v => v.email === currentUser.email))
        .map(issue => issue.id);
      setMyUpvotes(voted);
    } else {
      setMyUpvotes([]);
    }
  }, [issues, currentUser]);

  const getRankTitle = (pts) => {
    if (pts >= 500) return 'Community Hero';
    if (pts >= 300) return 'Civic Guardian';
    if (pts >= 200) return 'Watchman';
    if (pts >= 100) return 'Active Citizen';
    return 'Rookie';
  };

  // Fix default Leaflet marker icons in Next.js
  useEffect(() => {
    import('leaflet').then((L) => {
      setCustomIcon(
        new L.Icon({
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        })
      );
      setSelectedIcon(
        new L.Icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        })
      );
    });
  }, []);

  // Retrieve issues from Firestore on mount
  useEffect(() => {
    if (!db) {
      setIssues([]);
      return;
    }

    try {
      const q = query(collection(db, 'issues'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedIssues = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let status = data.status || 'reported';
          // Sanitize status based on upvote count: if less than 5 upvotes, status must be reported
          if ((data.upvotes || 0) < 5 && status !== 'reported') {
            status = 'reported';
            if (db) {
              updateDoc(docSnap.ref, { status: 'reported' }).catch(err =>
                console.error("Error sanitizing issue status in DB:", err)
              );
            }
          }
          loadedIssues.push({ id: docSnap.id, ...data, status });
        });
        setIssues(loadedIssues);
      }, (error) => {
        console.error("Firestore onSnapshot error:", error);
        setIssues([]);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to connect to Firestore:", e);
      setIssues([]);
    }
  }, []);

  const [allUsers, setAllUsers] = useState([]);

  // Retrieve users from Firestore on mount
  useEffect(() => {
    if (!db) {
      setAllUsers([]);
      return;
    }

    try {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedUsers = [];
        snapshot.forEach((doc) => {
          loadedUsers.push({ id: doc.id, ...doc.data() });
        });
        setAllUsers(loadedUsers);
      }, (error) => {
        console.error("Firestore users onSnapshot error:", error);
        setAllUsers([]);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to connect to Firestore users:", e);
      setAllUsers([]);
    }
  }, []);

  // Keep selectedIssue synced with current data
  useEffect(() => {
    if (selectedIssue) {
      const updated = issues.find(i => i.id === selectedIssue.id);
      if (updated) {
        setSelectedIssue(updated);
      }
    }
  }, [issues, selectedIssue]);

  // Fetch missing location details (city, state, pincode) if not present
  useEffect(() => {
    if (!selectedIssue || !selectedIssue.id) return;
    
    // Check if we already have city/state/pincode (and it's not N/A)
    const hasValidCity = selectedIssue.city && selectedIssue.city !== 'N/A';
    const hasValidState = selectedIssue.state && selectedIssue.state !== 'N/A';
    const hasValidPincode = selectedIssue.pincode && selectedIssue.pincode !== 'N/A';
    if (hasValidCity && hasValidState && hasValidPincode) return;

    const fetchMissingAddressDetails = async () => {
      try {
        const lat = selectedIssue.lat;
        const lng = selectedIssue.lng;
        if (!lat || !lng) return;

        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&lat=${lat}&lon=${lng}`);
        const geoData = await geoRes.json();
        if (geoData && geoData.address) {
          const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.suburb || geoData.address.county || 'N/A';
          const state = geoData.address.state || geoData.address.region || 'N/A';
          const pincode = geoData.address.postcode || 'N/A';
          
          // Update selectedIssue state locally so it renders immediately
          setSelectedIssue(prev => {
            if (prev && prev.id === selectedIssue.id) {
              return { ...prev, city, state, pincode, geocoded: true };
            }
            return prev;
          });

          // Update in Firestore if it's a real issue in DB
          if (db && !selectedIssue.id.startsWith('issue_')) {
            try {
              const docRef = doc(db, 'issues', selectedIssue.id);
              await updateDoc(docRef, { city, state, pincode, geocoded: true });
            } catch (e) {
              console.error("Failed to write geocoded address to Firestore:", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch address details on the fly:", err);
      }
    };

    fetchMissingAddressDetails();
  }, [selectedIssue?.id]);

  // Background geocoder to resolve address for all issues sequentially
  useEffect(() => {
    if (!db || issues.length === 0) return;

    // Find first issue that hasn't been geocoded and has N/A or missing city/state
    const unresolved = issues.find(i => 
      !i.geocoded && (!i.city || i.city === 'N/A' || !i.state || i.state === 'N/A')
    );

    if (!unresolved) return;

    const timer = setTimeout(async () => {
      try {
        const lat = unresolved.lat;
        const lng = unresolved.lng;
        if (!lat || !lng) return;

        console.log(`Background geocoding issue: ${unresolved.title}`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&lat=${lat}&lon=${lng}`);
        const geoData = await geoRes.json();
        let city = 'N/A';
        let state = 'N/A';
        let pincode = 'N/A';
        if (geoData && geoData.address) {
          city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.suburb || geoData.address.county || 'N/A';
          state = geoData.address.state || geoData.address.region || 'N/A';
          pincode = geoData.address.postcode || 'N/A';
        }

        console.log(`Resolved issue ${unresolved.id} -> ${city}, ${state}`);
        if (db && !unresolved.id.startsWith('issue_')) {
          const docRef = doc(db, 'issues', unresolved.id);
          await updateDoc(docRef, { city, state, pincode, geocoded: true });
        }
      } catch (err) {
        console.error("Background geocoding failed for issue:", unresolved.id, err);
        if (db && !unresolved.id.startsWith('issue_')) {
          try {
            const docRef = doc(db, 'issues', unresolved.id);
            await updateDoc(docRef, { geocoded: true });
          } catch (e) {
            console.error("Failed to mark geocoded as true on error:", e);
          }
        }
      }
    }, 2500); // 2.5s delay to be extremely friendly to Nominatim limits

    return () => clearTimeout(timer);
  }, [issues, db]);

  const handleMapClick = (latlng) => {
    setSelectedPosition(latlng);
    setReportCoordinates({ lat: latlng.lat, lng: latlng.lng });
  };

  const handleAddIssue = async (newIssue) => {
    const formattedIssue = {
      status: 'reported',
      upvotes: 0,
      createdAt: new Date().toISOString(),
      ...newIssue
    };

    if (db) {
      try {
        await addDoc(collection(db, 'issues'), formattedIssue);
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    } else {
      setIssues((prev) => [
        ...prev,
        { id: `issue_${Date.now()}`, ...formattedIssue }
      ]);
    }
    
    setSelectedPosition(null); // Clear temporary selected pin
  };

  const handleDeleteIssue = async (issueId) => {
    const targetIssue = issues.find(i => i.id === issueId) || (selectedIssue && selectedIssue.id === issueId ? selectedIssue : null);
    if (!targetIssue) {
      alert("Issue not found.");
      return;
    }

    if (!currentUser || currentUser.email !== targetIssue.reporterEmail) {
      alert("Unauthorized: Only the creator of this issue can delete it.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this issue report? This action cannot be undone.")) {
      return;
    }

    if (db) {
      try {
        await deleteDoc(doc(db, 'issues', issueId));
        setSelectedIssue(null);
      } catch (e) {
        console.error("Error deleting issue: ", e);
        alert("Failed to delete issue. Please try again.");
      }
    } else {
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
      setSelectedIssue(null);
    }
  };

  const handleOpenReportModal = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!selectedPosition && currentUser.defaultLat && currentUser.defaultLng) {
      setReportCoordinates({ lat: currentUser.defaultLat, lng: currentUser.defaultLng });
    }
    setModalOpen(true);
  };

  const triggerAutoEmailSend = async (issue) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refId: issue.refId,
          title: issue.title,
          category: issue.category,
          severity: issue.severity,
          city: issue.city || issue.cityName || 'Local Area',
          description: issue.description,
          complaintDraft: issue.complaintDraft,
          reporterName: issue.reporterName || 'Civic Leader',
          reporterEmail: issue.reporterEmail || 'anonymous@citizen.com',
          recipientEmail: issue.recipientEmail
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`Automatic email dispatch successful to ${data.recipient}`);
        if (db) {
          const issueRef = doc(db, 'issues', issue.id);
          await updateDoc(issueRef, { mailSent: true });
        } else {
          setIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, mailSent: true } : i));
        }
      } else {
        console.error("Auto email dispatch API failed: ", data.error);
      }
    } catch (err) {
      console.error("Failed to automatically dispatch escalation email: ", err);
    }
  };

  const handleUpvote = async (issueId) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    if (myUpvotes.includes(issueId)) {
      alert("You have already upvoted/verified this issue!");
      return;
    }

    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    const newUpvotes = (issue.upvotes || 0) + 1;
    let newStatus = issue.status;
    const shouldTriggerMail = newUpvotes >= 5 && issue.status === 'reported' && !issue.mailSent;
    if (newUpvotes >= 5 && issue.status === 'reported') {
      newStatus = 'verified';
    }

    const voterInfo = { 
      name: currentUser.name, 
      email: currentUser.email,
      avatar: currentUser.avatar || 'avatar_1',
      createdAt: new Date().toISOString()
    };
    const upvoteDetails = issue.upvoteDetails ? [...issue.upvoteDetails, voterInfo] : [voterInfo];

    setMyUpvotes((prev) => [...prev, issueId]);

    if (db) {
      try {
        const issueRef = doc(db, 'issues', issueId);
        await updateDoc(issueRef, { 
          upvotes: newUpvotes,
          status: newStatus,
          upvoteDetails: upvoteDetails
        });
        
        if (shouldTriggerMail) {
          triggerAutoEmailSend({
            ...issue,
            upvotes: newUpvotes,
            status: newStatus,
            upvoteDetails: upvoteDetails
          });
        }
      } catch (e) {
        console.error("Error upvoting: ", e);
      }
    } else {
      setIssues((prev) => prev.map((i) => i.id === issueId ? { ...i, upvotes: newUpvotes, status: newStatus, upvoteDetails: upvoteDetails } : i));
      if (shouldTriggerMail) {
        triggerAutoEmailSend({
          ...issue,
          upvotes: newUpvotes,
          status: newStatus,
          upvoteDetails: upvoteDetails
        });
      }
    }
  };

  const handleUpdateStatus = async (issueId, nextStatus) => {
    const targetIssue = issues.find(i => i.id === issueId) || (selectedIssue && selectedIssue.id === issueId ? selectedIssue : null);
    if (!targetIssue) return;

    if (!currentUser || currentUser.email !== targetIssue.reporterEmail) {
      alert("Unauthorized: Only the creator of this issue can update its status.");
      return;
    }

    if ((targetIssue.upvotes || 0) < 5) {
      alert("Cannot escalate status: Issue must be verified by the community first (5+ upvotes required).");
      return;
    }

    if (!['in-progress', 'resolved'].includes(nextStatus)) {
      alert("Invalid status update.");
      return;
    }

    if (targetIssue.status === 'resolved' && nextStatus === 'in-progress') {
      alert("This issue has already been resolved and cannot be changed back to in progress.");
      return;
    }

    if (db) {
      try {
        const issueRef = doc(db, 'issues', issueId);
        await updateDoc(issueRef, { status: nextStatus });
      } catch (e) {
        console.error("Error updating status: ", e);
      }
    } else {
      setIssues((prev) => prev.map((i) => i.id === issueId ? { ...i, status: nextStatus } : i));
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUser) {
      alert("Please log in or sign up to add a comment.");
      return;
    }
    
    const newComment = {
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar || 'avatar_1',
      content: commentText.trim(),
      createdAt: new Date().toISOString()
    };
    
    const updatedComments = [...(selectedIssue.comments || []), newComment];
    
    // Update client state immediately
    setSelectedIssue(prev => ({ ...prev, comments: updatedComments }));
    setIssues(prev => prev.map(i => i.id === selectedIssue.id ? { ...i, comments: updatedComments } : i));
    setCommentText('');

    if (db) {
      try {
        const issueRef = doc(db, 'issues', selectedIssue.id);
        await updateDoc(issueRef, {
          comments: updatedComments
        });
      } catch (err) {
        console.error("Failed to post comment to Firestore:", err);
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleActionItem = (actionIndex) => {
    setCheckedActions(prev => ({
      ...prev,
      [actionIndex]: !prev[actionIndex]
    }));
  };

  // Hotspots detection
  const getHotspots = () => {
    const hotspots = [];
    const categories = [...new Set(issues.map(i => i.category))];
    
    categories.forEach(cat => {
      const catIssues = issues.filter(i => i.category === cat);
      for (let i = 0; i < catIssues.length; i++) {
        const cluster = [catIssues[i]];
        for (let j = i + 1; j < catIssues.length; j++) {
          const latDiff = Math.abs(catIssues[i].lat - catIssues[j].lat);
          const lngDiff = Math.abs(catIssues[i].lng - catIssues[j].lng);
          if (latDiff < 0.015 && lngDiff < 0.015) {
            cluster.push(catIssues[j]);
          }
        }
        if (cluster.length >= 2) {
          hotspots.push({
            category: cat,
            count: cluster.length,
            representativeLat: cluster[0].lat,
            representativeLng: cluster[0].lng,
          });
          break;
        }
      }
    });
    return hotspots;
  };

  const hotspots = getHotspots();

  // Compute stats
  const totalReports = issues.length;
  const criticalReports = issues.filter(i => i.severity >= 4).length;
  const resolvedReports = issues.filter(i => i.status === 'resolved').length;
  const totalUpvotes = issues.reduce((acc, i) => acc + (i.upvotes || 0), 0);

  // Memoized filtered and sorted issues for display
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...issues];

    // 1. Filter by category
    if (filterCategory !== 'all') {
      result = result.filter(issue => issue.category === filterCategory);
    }

    // 2. Filter by status (reported, verified, in-progress, resolved)
    if (filterEscalation !== 'all') {
      result = result.filter(issue => issue.status === filterEscalation);
    }

    // 3. Filter by date range (calendar from/to)
    if (filterDateFrom) {
      const fromTime = new Date(filterDateFrom).setHours(0, 0, 0, 0);
      result = result.filter(issue => {
        if (!issue.createdAt) return false;
        const time = new Date(issue.createdAt).getTime();
        return time >= fromTime;
      });
    }
    if (filterDateTo) {
      const toTime = new Date(filterDateTo).setHours(23, 59, 59, 999);
      result = result.filter(issue => {
        if (!issue.createdAt) return false;
        const time = new Date(issue.createdAt).getTime();
        return time <= toTime;
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'severity') {
        diff = (a.severity || 0) - (b.severity || 0);
      } else if (sortBy === 'engagement') {
        const engagementA = (a.upvotes || 0) + (a.comments?.length || 0);
        const engagementB = (b.upvotes || 0) + (b.comments?.length || 0);
        diff = engagementA - engagementB;
      } else if (sortBy === 'escalation') {
        const getEscalationScore = (issue) => {
          if (issue.status === 'resolved') return 4;
          if (issue.status === 'in-progress') return 3;
          if (issue.status === 'verified') return 2;
          return 1; // reported
        };
        diff = getEscalationScore(a) - getEscalationScore(b);
      } else {
        // default: sortBy === 'date'
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        diff = timeA - timeB;
      }
      return sortDirection === 'desc' ? -diff : diff;
    });

    return result;
  }, [issues, sortBy, sortDirection, filterCategory, filterEscalation, filterDateFrom, filterDateTo]);

  const getDynamicLeaderboard = (mode = 'overall') => {
    const pointsMap = {};
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    issues.forEach(issue => {
      const issueTime = issue.createdAt ? new Date(issue.createdAt).getTime() : 0;
      const isIssueWeekly = (now - issueTime) <= oneWeekMs;

      // 1. Reporter Points (creating issue, severity, mail sent, resolved)
      if (issue.reporterName) {
        const name = issue.reporterName.trim();
        if (name) {
          const key = name.toLowerCase();
          
          let pts = 0;
          if (mode === 'overall' || isIssueWeekly) {
            const basePoints = 10;
            const severityPoints = Math.round((parseFloat(issue.severity) || 1.0) * 5);
            const mailPoints = issue.mailSent ? 30 : 0;
            const resolvedPoints = issue.status === 'resolved' ? 50 : 0;
            pts += basePoints + severityPoints + mailPoints + resolvedPoints;
          }

          if (pointsMap[key]) {
            pointsMap[key].points += pts;
          } else {
            pointsMap[key] = {
              name,
              points: pts,
              avatar: issue.reporterAvatar || 'avatar_1',
              title: '',
            };
          }
        }
      }

      // 2. Upvote points (uniform: both reporter and upvoter get +5 pts per upvote)
      if (issue.upvoteDetails && Array.isArray(issue.upvoteDetails)) {
        issue.upvoteDetails.forEach(voter => {
          const voteTime = voter.createdAt ? new Date(voter.createdAt).getTime() : 0;
          const isVoteWeekly = (now - voteTime) <= oneWeekMs;

          if (mode === 'overall' || isVoteWeekly) {
            // Give reporter +5 pts
            if (issue.reporterName) {
              const repKey = issue.reporterName.trim().toLowerCase();
              if (pointsMap[repKey]) {
                pointsMap[repKey].points += 5;
              }
            }

            // Give upvoter +5 pts
            if (voter.name) {
              const voterName = voter.name.trim();
              const voterKey = voterName.toLowerCase();
              if (pointsMap[voterKey]) {
                pointsMap[voterKey].points += 5;
              } else {
                pointsMap[voterKey] = {
                  name: voterName,
                  points: 5,
                  avatar: voter.avatar || 'avatar_1',
                  title: '',
                };
              }
            }
          }
        });
      }

      // 3. Comment points (uniform: both commenter and reporter get +10 pts, max 1 comment scored per person per issue to prevent spam)
      if (issue.comments && Array.isArray(issue.comments)) {
        const scoredCommenters = new Set();
        issue.comments.forEach(comment => {
          if (!comment.name) return;
          const commenterName = comment.name.trim();
          const commenterKey = commenterName.toLowerCase();

          // Check if this user has already commented on this issue
          if (scoredCommenters.has(commenterKey)) {
            return; // Skip scoring to prevent spam
          }
          scoredCommenters.add(commenterKey);

          const commentTime = comment.createdAt ? new Date(comment.createdAt).getTime() : 0;
          const isCommentWeekly = (now - commentTime) <= oneWeekMs;

          if (mode === 'overall' || isCommentWeekly) {
            // Give reporter +10 pts
            if (issue.reporterName) {
              const repKey = issue.reporterName.trim().toLowerCase();
              if (pointsMap[repKey]) {
                pointsMap[repKey].points += 10;
              }
            }

            // Give commenter +10 pts
            if (pointsMap[commenterKey]) {
              pointsMap[commenterKey].points += 10;
            } else {
              pointsMap[commenterKey] = {
                name: commenterName,
                points: 10,
                avatar: comment.avatar || 'avatar_1',
                title: '',
              };
            }
          }
        });
      }
    });

    // Compute titles
    Object.keys(pointsMap).forEach(key => {
      pointsMap[key].title = getRankTitle(pointsMap[key].points);
    });

    // Sort by points desc
    const sorted = Object.values(pointsMap).sort((a, b) => b.points - a.points);

    // Assign ranks
    return sorted.map((user, idx) => {
      const foundDbUser = allUsers.find(u => u.name.toLowerCase().trim() === user.name.toLowerCase().trim());
      return {
        ...user,
        email: foundDbUser ? foundDbUser.email : null,
        id: foundDbUser ? foundDbUser.id : null,
        createdAt: foundDbUser ? foundDbUser.createdAt : null,
        avatar: foundDbUser ? foundDbUser.avatar : user.avatar,
        rank: idx + 1,
        isUser: currentUser && user.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
      };
    });
  };

  const overallLeaderboard = getDynamicLeaderboard('overall');
  const weeklyLeaderboard = getDynamicLeaderboard('weekly');
  const dynamicLeaderboard = leaderboardMode === 'weekly' ? weeklyLeaderboard : overallLeaderboard;

  const currentUserEntry = overallLeaderboard.find(
    (entry) => currentUser && entry.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
  );
  const currentUserPoints = currentUserEntry ? currentUserEntry.points : 0;

  // Track unlocked badges to trigger celebration popup
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const currentlyUnlocked = BADGES.filter(b => currentUserPoints >= b.points).map(b => b.id);
    const celebrated = currentUser.celebratedBadges || [];
    
    // Find the first badge that is currently unlocked but hasn't been celebrated yet
    const newlyUnlockedId = currentlyUnlocked.find(id => !celebrated.includes(id));
    
    if (newlyUnlockedId) {
      const badgeDetails = BADGES.find(b => b.id === newlyUnlockedId);
      setCelebratingBadge(badgeDetails);

      // Save to celebrated list immediately to prevent multiple popups
      const updatedCelebrated = [...celebrated, newlyUnlockedId];
      const updatedUser = {
        ...currentUser,
        celebratedBadges: updatedCelebrated
      };

      // Update in local state
      setCurrentUser(updatedUser);
      localStorage.setItem('community_hero_user', JSON.stringify(updatedUser));

      // Update in Firestore
      if (db && !currentUser.id.startsWith('temp_')) {
        const userRef = doc(db, 'users', currentUser.id);
        updateDoc(userRef, { celebratedBadges: updatedCelebrated }).catch(e => {
          console.error("Failed to update celebratedBadges in Firestore:", e);
        });
      }
    }
  }, [currentUserPoints, currentUser?.email, currentUser?.celebratedBadges]);

  // Compute live notifications dynamically from Firestore database updates
  const computedNotifications = useMemo(() => {
    if (!currentUser) return [];

    const notifs = [];
    const myIssues = issues.filter(issue => issue.reporterEmail === currentUser.email);

    myIssues.forEach(issue => {
      // 1. Upvotes on citizen's issue
      if (issue.upvoteDetails && Array.isArray(issue.upvoteDetails)) {
        issue.upvoteDetails.forEach(voter => {
          if (voter.email !== currentUser.email) {
            notifs.push({
              id: `upvote_${issue.id}_${voter.email}_${voter.createdAt || ''}`,
              category: 'activity',
              title: '👍 Verification Upvote',
              message: `${voter.name || 'A citizen'} upvoted & verified your report: "${issue.title}"`,
              date: voter.createdAt || issue.createdAt || new Date().toISOString(),
              issue: issue
            });
          }
        });
      }

      // 2. Comments on citizen's issue
      if (issue.comments && Array.isArray(issue.comments)) {
        issue.comments.forEach(comment => {
          if (comment.email !== currentUser.email) {
            notifs.push({
              id: `comment_${issue.id}_${comment.email}_${comment.createdAt || ''}`,
              category: 'activity',
              title: '💬 Community Comment',
              message: `${comment.name || 'A citizen'} commented: "${comment.content}" on your report: "${issue.title}"`,
              date: comment.createdAt || issue.createdAt || new Date().toISOString(),
              issue: issue
            });
          }
        });
      }

      // 3. Status changes (verified, in-progress, resolved)
      if (issue.status && issue.status !== 'reported') {
        notifs.push({
          id: `status_${issue.id}_${issue.status}`,
          category: 'escalation',
          title: `Status: ${issue.status.toUpperCase()}`,
          message: `Your report "${issue.title}" has transitioned to ${issue.status.toUpperCase()}.`,
          date: issue.createdAt || new Date().toISOString(),
          issue: issue
        });
      }

      // 4. Mail sent escalations
      if (issue.mailSent) {
        notifs.push({
          id: `mail_${issue.id}`,
          category: 'escalation',
          title: '📬 Escalation Email Dispatched',
          message: `Official complaint letter has been automatically dispatched to authorities for your report: "${issue.title}".`,
          date: issue.createdAt || new Date().toISOString(),
          issue: issue
        });
      }
    });

    // 5. Badge Unlocks
    BADGES.forEach(badge => {
      if (currentUserPoints >= badge.points) {
        notifs.push({
          id: `badge_${badge.id}`,
          category: 'achievements',
          title: '🏆 Achievement Activated',
          message: `Congratulations! You unlocked the "${badge.title}" milestone: ${badge.desc}`,
          date: currentUser.createdAt || new Date().toISOString()
        });
      }
    });

    // Sort by timestamp desc
    return notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [issues, currentUser?.email, currentUserPoints]);

  const unreadByTab = (category) => {
    return computedNotifications
      .filter(n => n.category === category)
      .some(n => !readNotificationIds.includes(n.id));
  };

  const hasUnreadNotifications = computedNotifications.some(n => !readNotificationIds.includes(n.id));

  const markCategoryAsRead = (category) => {
    const categoryNotifIds = computedNotifications
      .filter(n => n.category === category)
      .map(n => n.id);
    
    setReadNotificationIds(prev => {
      const updated = Array.from(new Set([...prev, ...categoryNotifIds]));
      localStorage.setItem('community_hero_read_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  // Automatically mark current active tab as read when panel is open
  useEffect(() => {
    if (notificationsOpen && currentUser) {
      markCategoryAsRead(activeNotificationTab);
    }
  }, [notificationsOpen, activeNotificationTab, computedNotifications.length]);

  if (!customIcon || !selectedIcon) return <div className="p-6 bg-[#070a13] text-slate-300 min-h-screen flex items-center justify-center font-semibold">Loading map assets...</div>;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070a13] text-slate-100 font-sans">
      
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-8 py-4 bg-[#0c1224]/80 backdrop-blur-md border-b border-slate-800/80 shadow-lg z-30">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Community Hero
            </span>
            <span className="text-[9px] text-slate-500 tracking-wider uppercase font-semibold">Autonomous Civic Agent Hub</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold px-4 py-2 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live Civic Database
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2.5 relative">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`p-2 rounded-xl border transition-all duration-200 relative ${
                    notificationsOpen
                      ? 'bg-indigo-900/30 border-indigo-500/80 text-indigo-300'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-205'
                  }`}
                  title="Notifications"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {hasUnreadNotifications && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950 animate-pulse"></span>
                  )}
                </button>

                {/* Backdrop to close dropdown on outside click */}
                {notificationsOpen && (
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setNotificationsOpen(false)}
                  />
                )}

                {/* Notifications Dropdown Panel */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-[#0a0f1d] border border-slate-800/80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="p-3.5 border-b border-slate-850 bg-slate-950/40 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-indigo-400" /> Notifications
                      </span>
                      {hasUnreadNotifications && (
                        <button
                          onClick={() => {
                            setReadNotificationIds(computedNotifications.map(n => n.id));
                            localStorage.setItem('community_hero_read_notifications', JSON.stringify(computedNotifications.map(n => n.id)));
                          }}
                          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition uppercase tracking-wider"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Notification Category Tabs */}
                    <div className="flex border-b border-slate-800/50 bg-slate-950/40 p-1">
                      {[
                        { id: 'escalation', label: '🚨 Escalation' },
                        { id: 'activity', label: '💬 Activity' },
                        { id: 'achievements', label: '🏆 Badges' }
                      ].map((tab) => {
                        const hasUnread = unreadByTab(tab.id);
                        const isActive = activeNotificationTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveNotificationTab(tab.id)}
                            type="button"
                            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 relative flex items-center justify-center gap-1 ${
                              isActive
                                ? 'bg-slate-900 text-slate-100'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                            }`}
                          >
                            <span>{tab.label}</span>
                            {hasUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2 bg-slate-950/20">
                      {computedNotifications.filter(n => n.category === activeNotificationTab).length === 0 ? (
                        <div className="text-center py-8 text-slate-550 text-[10px] font-bold italic">
                          No new notifications
                        </div>
                      ) : (
                        computedNotifications
                          .filter(n => n.category === activeNotificationTab)
                          .map((n) => {
                            const isUnread = !readNotificationIds.includes(n.id);
                            return (
                              <div
                                key={n.id}
                                onClick={() => {
                                  if (n.issue) {
                                    setSelectedIssue(n.issue);
                                    if (n.issue.lat && n.issue.lng) {
                                      setMapCenter([n.issue.lat, n.issue.lng]);
                                    }
                                    setNotificationsOpen(false);
                                  }
                                }}
                                className={`p-2.5 rounded-xl border text-left transition duration-200 ${
                                  n.issue ? 'cursor-pointer hover:bg-slate-900/50' : 'select-none'
                                } ${
                                  isUnread
                                    ? 'bg-indigo-950/20 border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.02)]'
                                    : 'bg-slate-950 border-slate-900/60'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className={`text-[10px] font-black leading-none ${
                                    isUnread ? 'text-indigo-300' : 'text-slate-450'
                                  }`}>
                                    {n.title}
                                  </span>
                                  <span className="text-[8px] text-slate-550 shrink-0 font-semibold">
                                    {n.date ? new Date(n.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-350 leading-relaxed mt-1 break-words">
                                  {n.message}
                                </p>
                                {n.issue && (
                                  <div className="text-[8px] text-indigo-400/80 font-bold mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                                    <MapPin className="w-2.5 h-2.5 text-indigo-500/60" /> Click to view on map
                                  </div>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Box */}
              <button 
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/35 hover:border-indigo-500/60 px-4 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:text-indigo-200 transition text-left shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                title="View Profile & Badges"
              >
                <span className="text-sm">{getAvatarEmoji(currentUser.avatar)}</span>
                <span>{currentUser.name} ({currentUserPoints} pts)</span>
              </button>
              
              {/* Log Out Box */}
              <button 
                onClick={() => {
                  setCurrentUser(null);
                  localStorage.removeItem('community_hero_user');
                }} 
                className="bg-slate-900/60 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-450 transition shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition border border-indigo-400/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              Log In / Sign Up
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Leaflet Map Box */}
        <div className="w-[58%] h-full relative z-0 border-r border-slate-800/50">
          <InteractiveMap
            center={mapCenter}
            zoom={14}
            focusedIssue={selectedIssue}
            customIcon={customIcon}
            selectedIcon={selectedIcon}
            selectedPosition={selectedPosition}
            onMapClick={handleMapClick}
            heatmapMode={heatmapMode}
            issues={issues}
          />

          {/* Trigger Button Overlay */}
          <button 
            className="absolute bottom-6 right-6 flex items-center gap-2.5 px-6 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:to-purple-600 text-white rounded-2xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.6)] transform hover:-translate-y-0.5 transition-all duration-200 font-bold tracking-wide z-[1000] border border-indigo-400/20"
            onClick={handleOpenReportModal}
          >
            <Plus className="w-5 h-5 stroke-[3px]" />
            Report Local Issue
          </button>
        </div>

        {/* Sidebar */}
        <aside className="w-[42%] h-full bg-[#080d19]/95 flex flex-col z-10 border-l border-slate-800/50 shadow-2xl">
          
          {selectedIssue ? (
            /* Selected Issue Detailed View */
            <div className="flex flex-col h-full bg-[#080d19] overflow-hidden">
              <div className="p-5 border-b border-slate-800/60 bg-[#0c1224]/50 flex items-center gap-3">
                <button 
                  onClick={() => setSelectedIssue(null)} 
                  className="p-1.5 hover:bg-slate-800/80 rounded-xl transition text-slate-400 hover:text-slate-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h3 className="font-extrabold text-sm text-slate-100">Detailed Report</h3>
                  <p className="text-[10px] text-slate-400">Ref ID: {selectedIssue.refId || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {currentUser && currentUser.email === selectedIssue.reporterEmail && (
                    <button 
                      onClick={() => handleDeleteIssue(selectedIssue.id)} 
                      className="p-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl transition border border-transparent hover:border-rose-500/20"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                    selectedIssue.status === 'resolved' 
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                      : selectedIssue.status === 'in-progress'
                        ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                        : selectedIssue.status === 'verified'
                          ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}>
                    {selectedIssue.status === 'verified' 
                      ? '🔥 Verified' 
                      : selectedIssue.status === 'in-progress' 
                        ? 'In Progress' 
                        : selectedIssue.status === 'resolved' 
                          ? 'Resolved' 
                          : 'Reported'}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Image and Header */}
                <div className="space-y-3">
                  <h2 className="text-lg font-black text-slate-100 leading-tight">{selectedIssue.title}</h2>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{selectedIssue.category}</span>
                    </div>
                    {selectedIssue.severity && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">•</span>
                        <span className={`font-bold ${
                          selectedIssue.severity >= 4 
                            ? 'text-rose-400' 
                            : selectedIssue.severity >= 3 
                              ? 'text-amber-400' 
                              : 'text-indigo-400'
                        }`}>
                          Severity: {Number(selectedIssue.severity).toFixed(1)}/5
                        </span>
                      </div>
                    )}
                    {selectedIssue.createdAt && (
                      <div className="flex items-center gap-1 text-slate-450 font-semibold">
                        <span className="text-slate-500">•</span>
                        <span>{new Date(selectedIssue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                  {selectedIssue.imageUrl && (
                    <div className="relative h-40 w-full rounded-2xl overflow-hidden border border-slate-800">
                      <img src={selectedIssue.imageUrl} alt={selectedIssue.title} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <p className="text-xs text-slate-300 leading-relaxed italic">"{selectedIssue.description}"</p>
                </div>

                {/* Status Timeline */}
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                  <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" /> Real-time Progress Tracking
                  </h4>
                  
                  <div className="grid grid-cols-4 gap-1 relative text-[9px] font-bold text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500 text-rose-400 flex items-center justify-center mb-1">1</div>
                      <span className="text-rose-400">Reported</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 border ${
                        ['verified', 'in-progress', 'resolved'].includes(selectedIssue.status)
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}>2</div>
                      <span className={['verified', 'in-progress', 'resolved'].includes(selectedIssue.status) ? 'text-indigo-400' : 'text-slate-600'}>Verified</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 border ${
                        ['in-progress', 'resolved'].includes(selectedIssue.status)
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}>3</div>
                      <span className={['in-progress', 'resolved'].includes(selectedIssue.status) ? 'text-amber-400' : 'text-slate-600'}>In Progress</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 border ${
                        selectedIssue.status === 'resolved'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}>4</div>
                      <span className={selectedIssue.status === 'resolved' ? 'text-emerald-400' : 'text-slate-600'}>Resolved</span>
                    </div>
                  </div>

                  {/* Creator-only Status Change Controls */}
                  {currentUser && currentUser.email === selectedIssue.reporterEmail ? (
                    (selectedIssue.upvotes || 0) < 5 ? (
                      <div className="p-3 bg-slate-950 border border-slate-900 rounded-2xl text-center text-[10px] font-bold text-slate-500">
                        🔒 Escalation locked. Community verification required (needs 5+ upvotes to unlock). Current upvotes: {selectedIssue.upvotes || 0}/5
                      </div>
                    ) : (
                      <div className="pt-2 space-y-2">
                        <label className="block text-[9px] uppercase font-black tracking-wider text-slate-500">Update Issue Status</label>
                        <div className="flex gap-2">
                          {['in-progress', 'resolved'].map((st) => {
                            const isResolved = selectedIssue.status === 'resolved';
                            const isDisabled = isResolved && st === 'in-progress';
                            return (
                              <button
                                key={st}
                                onClick={() => !isDisabled && handleUpdateStatus(selectedIssue.id, st)}
                                disabled={isDisabled}
                                className={`flex-1 py-1.5 rounded-lg border text-[9px] font-black uppercase transition ${
                                  selectedIssue.status === st
                                    ? st === 'resolved'
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                      : 'bg-blue-500/20 border-blue-500 text-blue-400'
                                    : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-350'
                                } ${
                                  isDisabled ? 'opacity-30 cursor-not-allowed border-slate-950' : ''
                                }`}
                              >
                                {st === 'in-progress' ? 'in progress' : st}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="p-3 bg-slate-950 border border-slate-900 rounded-2xl text-center text-[10px] font-bold text-slate-500">
                      🔒 Only the reporter can change status
                    </div>
                  )}
                </div>

                {/* Gemini AI Agent Section */}
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-4">
                    
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 tracking-wider">AI Agentic Analysis</h4>
                    </div>

                    {/* Timeline */}
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-indigo-300">Resolution Estimate:</span>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        {selectedIssue.resolutionTimeline || 'Calculating resolution timeline...'}
                      </p>
                    </div>

                    {/* Checkable Actions */}
                    {selectedIssue.civicActions && selectedIssue.civicActions.length > 0 && (
                      <div className="text-xs space-y-2">
                        <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Immediate Citizen Steps:
                        </span>
                        <div className="space-y-2 pt-1">
                          {selectedIssue.civicActions.map((action, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-start gap-2.5 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40 transition hover:border-slate-800/80"
                            >
                              <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mt-0.5 shrink-0">
                                <span className="text-[10px] font-extrabold text-amber-400">{idx + 1}</span>
                              </div>
                              <span className="text-slate-300 text-[11px] leading-snug">{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Complaint Letter Draft */}
                    {selectedIssue.complaintDraft && (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-300 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Official Complaint Draft
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedIssue.complaintDraft)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition border border-indigo-500/20 text-[10px]"
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="p-3 bg-slate-950/60 border border-slate-800 text-[10px] rounded-xl overflow-x-auto text-slate-300 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap font-mono">
                          {selectedIssue.complaintDraft}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Municipal Routing Details */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                  <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" /> Municipal Routing Details
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">From (Citizen):</span>
                      <span className="text-slate-300 font-mono text-[10px] truncate max-w-[180px]" title={selectedIssue.reporterEmail || 'anonymous@citizen.com'}>
                        {selectedIssue.reporterEmail || 'anonymous@citizen.com'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">To (Authority):</span>
                      <span className="text-slate-300 font-mono text-[10px] truncate max-w-[180px]" title={selectedIssue.recipientEmail || 'Feature not available'}>
                        {selectedIssue.recipientEmail || 'Feature not available'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Automated Escalation Status */}
                  {selectedIssue.recipientEmail && selectedIssue.recipientEmail !== "Feature not available outside India" && (
                    selectedIssue.mailSent ? (
                      <div className="w-full mt-2 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 select-none animate-in fade-in duration-300">
                        <Check className="w-4 h-4" />
                        Escalated to Municipal Corporation
                      </div>
                    ) : (
                      <div className="w-full mt-2 py-2.5 bg-slate-950/60 border border-slate-900 text-slate-500 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 select-none">
                        <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-500/60" />
                        Awaiting Community Verification (5+ upvotes)
                      </div>
                    )
                  )}
                 </div>

                {/* Location & Reporter Details */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                  <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Location & Reporter Details
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">Issuer Name:</span>
                      <span className="text-slate-350 font-bold">{selectedIssue.reporterName || 'Anonymous'}</span>
                    </div>
                    {selectedIssue.reporterPhone && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-500">Issuer Phone:</span>
                        <span className="text-slate-350 font-mono">{selectedIssue.reporterPhone}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">Latitude / Longitude:</span>
                      <span className="text-slate-350 font-mono text-[10px]">
                        {selectedIssue.lat ? Number(selectedIssue.lat).toFixed(5) : 'N/A'}, {selectedIssue.lng ? Number(selectedIssue.lng).toFixed(5) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">City / Town:</span>
                      <span className="text-slate-350">{selectedIssue.city || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">State / Region:</span>
                      <span className="text-slate-350">{selectedIssue.state || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">Pincode:</span>
                      <span className="text-slate-350 font-mono">{selectedIssue.pincode || 'N/A'}</span>
                    </div>
                    {selectedIssue.createdAt && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-500">Reported On:</span>
                        <span className="text-slate-350">{new Date(selectedIssue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Support Upvote */}
                <div className="pt-2">
                  {myUpvotes.includes(selectedIssue.id) ? (
                    <div className="w-full py-4 bg-slate-900/60 border border-slate-800/80 text-slate-400 font-bold tracking-wide rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-default border-dashed">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Already Verified & Upvoted</span>
                        <span className="text-[10px] text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                          +5 PTS EARNED
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Total Community Votes: {selectedIssue.upvotes || 0}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpvote(selectedIssue.id)}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold tracking-wide rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 border border-emerald-400/20"
                    >
                      <ThumbsUp className="w-4 h-4 fill-white/10" />
                      Verify & Upvote (+5 pts)
                      <span className="ml-1 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-xs">
                        Total: {selectedIssue.upvotes || 0} votes
                      </span>
                    </button>
                  )}
                </div>

                {/* Community Comments section */}
                <div className="pt-4 border-t border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-100 tracking-wider">Community Discussion ({(selectedIssue.comments || []).length})</h4>
                  </div>
                  
                  {/* Comments list */}
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {!(selectedIssue.comments && selectedIssue.comments.length > 0) ? (
                      <p className="text-[10px] text-slate-500 italic text-center py-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                        No comments yet. Start the conversation!
                      </p>
                    ) : (
                      selectedIssue.comments.map((comment, index) => (
                        <div key={index} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <div 
                              onClick={() => {
                                const found = allUsers.find(u => u.email === comment.email || u.name.toLowerCase().trim() === comment.name.toLowerCase().trim());
                                const lbEntry = overallLeaderboard.find(entry => entry.name.toLowerCase().trim() === comment.name.toLowerCase().trim());
                                const dynamicPts = lbEntry ? lbEntry.points : 0;
                                
                                setSelectedProfileUser({
                                  name: comment.name,
                                  email: comment.email || (found ? found.email : null),
                                  avatar: found ? found.avatar : (comment.avatar || 'avatar_1'),
                                  points: dynamicPts,
                                  createdAt: found ? found.createdAt : null,
                                  id: found ? found.id : null
                                });
                              }}
                              className="flex items-center gap-1.5 font-extrabold text-indigo-300 cursor-pointer hover:text-indigo-400 hover:underline transition-all duration-200"
                              title="View citizen profile"
                            >
                              <span className="text-sm shrink-0">{getAvatarEmoji(getCommenterAvatar(comment))}</span>
                              <span className="truncate max-w-[120px]">{comment.name}</span>
                            </div>
                            <span className="text-slate-550 font-semibold">
                              {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                          </div>
                          <p className="text-slate-350 text-[11px] leading-relaxed break-words">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Form */}
                  {currentUser ? (
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment... (+10 pts to you & reporter)"
                        rows={2}
                        maxLength={500}
                        className="w-full p-3 bg-slate-950 border border-slate-850 text-xs font-semibold rounded-xl text-slate-200 placeholder-slate-600 focus:border-indigo-500/80 outline-none transition resize-none leading-relaxed"
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        Post Comment
                      </button>
                    </form>
                  ) : (
                    <div className="p-3 bg-slate-950 border border-dashed border-slate-855 rounded-xl text-center text-[10px] font-bold text-slate-500">
                      🔐 Please <button type="button" onClick={() => setAuthModalOpen(true)} className="text-indigo-400 hover:underline">log in or sign up</button> to post comments
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Sidebar Main Panel (Tabs, Stats, Alerts, Feed, Leaderboard) */
            <div className="flex flex-col h-full bg-[#080d19] overflow-hidden">
              
              {/* Tab Selector */}
              <div className="grid grid-cols-3 p-1 bg-[#0c1224]/60 border-b border-slate-800/80 gap-1">
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`py-2 text-[10px] font-black rounded-lg transition uppercase flex items-center justify-center gap-1 border ${
                    activeTab === 'reports' 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  Reports
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`py-2 text-[10px] font-black rounded-lg transition uppercase flex items-center justify-center gap-1 border ${
                    activeTab === 'leaderboard' 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  Leaderboard
                </button>
                <button
                  onClick={() => setActiveTab('impact')}
                  className={`py-2 text-[10px] font-black rounded-lg transition uppercase flex items-center justify-center gap-1 border ${
                    activeTab === 'impact' 
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Impact
                </button>
              </div>

              {activeTab === 'reports' ? (
                /* Tab 1: Civic Reports */
                <div className="flex-1 overflow-y-auto flex flex-col">
                  
                  {/* Stats Bar */}
                  <div className="p-4 bg-[#0b1222]/40 border-b border-slate-800/50 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase font-black tracking-wider">Reports</span>
                      <span className="text-sm font-extrabold text-indigo-400">{totalReports}</span>
                    </div>
                    <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase font-black tracking-wider">Severity</span>
                      <span className="text-sm font-extrabold text-rose-500">{criticalReports} Critical</span>
                    </div>
                    <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500 uppercase font-black tracking-wider">Resolved</span>
                      <span className="text-sm font-extrabold text-emerald-400">{resolvedReports}</span>
                    </div>
                  </div>
                  
                  {/* Filter & Sort Controls Panel Header */}
                  <div className="px-5 py-3.5 border-b border-slate-800/60 bg-[#0c1224]/30 flex items-center justify-between relative shrink-0">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reports Feed</h4>
                    <div className="flex items-center gap-2">
                      {/* Reset Filters button */}
                      {(sortBy !== 'date' || sortDirection !== 'desc' || filterCategory !== 'all' || filterEscalation !== 'all' || filterDateFrom || filterDateTo) && (
                        <button 
                          onClick={() => {
                            setSortBy('date');
                            setSortDirection('desc');
                            setFilterCategory('all');
                            setFilterEscalation('all');
                            setFilterDateFrom('');
                            setFilterDateTo('');
                          }}
                          className="text-[9px] uppercase font-bold text-indigo-400 hover:text-indigo-350 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 transition-all"
                        >
                          Reset
                        </button>
                      )}
                      
                      {/* Sort Toggle Button */}
                      <button 
                        onClick={() => {
                          setShowSortDropdown(!showSortDropdown);
                          setShowFilterDropdown(false);
                        }}
                        className={`p-1.5 rounded-lg border transition ${
                          showSortDropdown || sortBy !== 'date'
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Sort Reports"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Filter Toggle Button */}
                      <button 
                        onClick={() => {
                          setShowFilterDropdown(!showFilterDropdown);
                          setShowSortDropdown(false);
                        }}
                        className={`p-1.5 rounded-lg border transition ${
                          showFilterDropdown || (filterCategory !== 'all' || filterEscalation !== 'all' || filterDateFrom || filterDateTo)
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                        title="Filter Reports"
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Floating Sort Dropdown */}
                    {showSortDropdown && (
                      <div className="absolute right-5 top-12 z-[1100] w-48 bg-[#0c1224]/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Sort By</span>
                        </div>
                        
                        {/* Sort Direction Toggle */}
                        <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/60">
                          <button
                            onClick={() => setSortDirection('asc')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md text-[9px] font-black tracking-wider transition-all ${
                              sortDirection === 'asc' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Sort Ascending"
                          >
                            <ArrowUp className="w-3 h-3 stroke-[3px]" />
                            <span>ASC</span>
                          </button>
                          <button
                            onClick={() => setSortDirection('desc')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md text-[9px] font-black tracking-wider transition-all ${
                              sortDirection === 'desc' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Sort Descending"
                          >
                            <ArrowDown className="w-3 h-3 stroke-[3px]" />
                            <span>DESC</span>
                          </button>
                        </div>

                        <div className="h-px bg-slate-800/60 my-0.5" />

                        <div className="flex flex-col gap-1.5 text-xs font-bold text-slate-350">
                          {[
                            { value: 'date', label: '📅 Posted Date' },
                            { value: 'severity', label: '🚨 Severity' },
                            { value: 'engagement', label: '💬 Engagement' },
                            { value: 'escalation', label: '⚡ Escalation Level' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setSortBy(opt.value);
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800/40 transition-colors flex items-center justify-between ${
                                sortBy === opt.value ? 'text-indigo-400 bg-slate-900/50' : 'hover:text-slate-100'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {sortBy === opt.value && <Check className="w-3 h-3 stroke-[3px]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Floating Filter Dropdown */}
                    {showFilterDropdown && (
                      <div className="absolute right-5 top-12 z-[1100] w-64 bg-[#0c1224]/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {/* Filter Option 1: Category */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Issue Type</label>
                          <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none font-bold text-xs focus:border-indigo-500/50 transition cursor-pointer"
                          >
                            <option value="all">🔍 All Categories</option>
                            <option value="Potholes & Road Damage">Potholes & Road Damage</option>
                            <option value="Water Leakage">Water Leakage</option>
                            <option value="Safety Hazard">Safety Hazard</option>
                            <option value="Garbage & Waste">Garbage & Waste</option>
                            <option value="Electricity / Streetlight">Electricity & Streetlight</option>
                            <option value="Other Civic Issues">Other Civic Issues</option>
                          </select>
                        </div>

                        {/* Filter Option 2: Status */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Status</label>
                          <select
                            value={filterEscalation}
                            onChange={(e) => setFilterEscalation(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none font-bold text-xs focus:border-indigo-500/50 transition cursor-pointer"
                          >
                            <option value="all">⚡ All Statuses</option>
                            <option value="reported">Reported</option>
                            <option value="verified">Verified</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>

                        {/* Filter Option 3: Date Range */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Date Range</label>
                          <div className="flex gap-1.5">
                            <input
                              type="date"
                              value={filterDateFrom}
                              onChange={(e) => setFilterDateFrom(e.target.value)}
                              onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                              className="w-1/2 px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none font-bold text-[9px] focus:border-indigo-500/50 transition cursor-pointer"
                              title="From Date"
                            />
                            <input
                              type="date"
                              value={filterDateTo}
                              onChange={(e) => setFilterDateTo(e.target.value)}
                              onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                              className="w-1/2 px-2 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl outline-none font-bold text-[9px] focus:border-indigo-500/50 transition cursor-pointer"
                              title="To Date"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    
                    {/* Hotspot Alert box */}
                    {hotspots.length > 0 && hotspots.map((hot, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex gap-3 shadow-[0_0_15px_rgba(245,158,11,0.08)] animate-pulse"
                      >
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-400">AI Cluster Hotspot Detected</h4>
                          <p className="text-[10px] text-slate-300 leading-relaxed mt-1">
                            {hot.count} active **{hot.category}** issues identified within 1.5km. High probability of regional utility/infrastructure failure.
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Issue List */}
                    {filteredAndSortedIssues.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-800 rounded-2xl p-6 text-center bg-slate-900/20">
                        <MapPin className="w-8 h-8 text-slate-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-400">No matching reports</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Try adjusting your filters or search criteria above</p>
                      </div>
                    ) : (
                      filteredAndSortedIssues.map((issue) => (
                        <div 
                          key={issue.id || issue.title}
                          onClick={() => setSelectedIssue(issue)}
                          className="relative overflow-hidden p-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60 hover:border-indigo-500/25 transition-all duration-300 cursor-pointer group shadow-md"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors duration-200 leading-snug">
                                {issue.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1 flex-wrap">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {issue.category}
                                  {issue.city && issue.city !== 'N/A' && (
                                    <span className="text-[10px] text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.5 rounded-md font-bold select-none ml-1 shrink-0">
                                      📍 {issue.city}{issue.state && issue.state !== 'N/A' ? `, ${issue.state}` : ''}
                                    </span>
                                  )}
                                </span>
                                <span className="text-slate-700 font-semibold select-none">|</span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  posted by: 
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const reporterName = issue.reporterName || 'Anonymous';
                                      const found = allUsers.find(u => u.email === issue.reporterEmail || u.name.toLowerCase().trim() === reporterName.toLowerCase().trim());
                                      const lbEntry = overallLeaderboard.find(entry => entry.name.toLowerCase().trim() === reporterName.toLowerCase().trim());
                                      const dynamicPts = lbEntry ? lbEntry.points : 0;
                                      
                                      setSelectedProfileUser({
                                        name: reporterName,
                                        email: issue.reporterEmail || (found ? found.email : null),
                                        avatar: found ? found.avatar : (issue.reporterAvatar || 'avatar_1'),
                                        points: dynamicPts,
                                        createdAt: found ? found.createdAt : null,
                                        id: found ? found.id : null
                                      });
                                    }}
                                    className="text-indigo-400 hover:text-indigo-300 hover:underline font-extrabold cursor-pointer ml-1 transition-colors duration-150"
                                    title="View citizen profile"
                                  >
                                    {issue.reporterName || 'Anonymous'}
                                  </span>
                                </span>
                                {issue.createdAt && (
                                  <>
                                    <span className="text-slate-700 font-semibold select-none">|</span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      posted on: {new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  </>
                                )}
                              </div>
                              {issue.description && (
                                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed italic">
                                  "{issue.description}"
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                                issue.status === 'resolved' 
                                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                                  : issue.status === 'in-progress'
                                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                                    : issue.status === 'verified'
                                      ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
                                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                              }`}>
                                {issue.status}
                              </span>
                              {issue.upvotes > 0 && (
                                <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                  👍 {issue.upvotes} {issue.upvotes >= 5 && '🔥'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Severity Bar */}
                          {issue.severity && (
                            <div className="mt-3.5 flex items-center justify-between border-t border-slate-800/60 pt-2.5">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Severity: {Number(issue.severity).toFixed(1)}/5</span>
                              <div className="w-24 h-1.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/20">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    issue.severity >= 4 
                                      ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]' 
                                      : issue.severity >= 3 
                                        ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' 
                                        : 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                                  }`}
                                  style={{ width: `${(issue.severity / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === 'leaderboard' ? (
                /* Tab 2: Leaderboard */
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  
                  {/* Toggle switch for Weekly vs Overall */}
                  <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-850 rounded-xl">
                    <button
                      onClick={() => setLeaderboardMode('overall')}
                      className={`py-1.5 text-[9px] font-black rounded-lg transition uppercase border ${
                        leaderboardMode === 'overall'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Overall Lifetime
                    </button>
                    <button
                      onClick={() => setLeaderboardMode('weekly')}
                      className={`py-1.5 text-[9px] font-black rounded-lg transition uppercase border ${
                        leaderboardMode === 'weekly'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-black'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Weekly Rankings
                    </button>
                  </div>

                  {/* Leaderboard list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <Users className="w-4 h-4 text-indigo-400" /> Civic Leaders ({leaderboardMode === 'weekly' ? 'Weekly' : 'Overall'})
                    </h4>
                    
                    <div className="space-y-2">
                      {dynamicLeaderboard.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-800 rounded-2xl p-6 text-center bg-slate-900/10">
                          <Users className="w-8 h-8 text-slate-600 mb-3" />
                          <p className="text-sm font-semibold text-slate-400">No active leaders yet</p>
                          <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Report local issues or upvote/comment to gain points!</p>
                        </div>
                      ) : (
                        dynamicLeaderboard.map((item, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              const lbEntry = overallLeaderboard.find(entry => entry.name.toLowerCase().trim() === item.name.toLowerCase().trim());
                              const dynamicPts = lbEntry ? lbEntry.points : item.points;

                              setSelectedProfileUser({
                                name: item.name,
                                email: item.email,
                                avatar: item.avatar,
                                points: dynamicPts,
                                createdAt: item.createdAt,
                                id: item.id
                              });
                            }}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer hover:border-indigo-500/30 hover:scale-[1.01] ${
                              item.isUser 
                                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.1)] scale-[1.02]' 
                                : 'bg-slate-900/30 border-slate-800/60 hover:bg-slate-900/50'
                            }`}
                            title="View citizen profile"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                item.rank === 1 
                                  ? 'bg-amber-400/20 border border-amber-400 text-amber-400' 
                                  : item.rank === 2
                                    ? 'bg-slate-300/20 border border-slate-300 text-slate-300'
                                    : item.rank === 3
                                      ? 'bg-amber-700/20 border border-amber-700 text-amber-600'
                                      : 'bg-slate-950 text-slate-500'
                              }`}>
                                {item.rank}
                              </span>
                              <div>
                                <span className={`text-xs font-bold flex items-center gap-1.5 ${item.isUser ? 'text-indigo-300' : 'text-slate-200'}`}>
                                  <span className="text-sm shrink-0">{getAvatarEmoji(item.avatar)}</span>
                                  {item.name} {item.isUser && '(You)'}
                                </span>
                                <span className="block text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{item.title}</span>
                              </div>
                            </div>
                            <span className={`text-xs font-black ${item.isUser ? 'text-indigo-400' : 'text-slate-400'}`}>
                              {item.points} pts
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Tab 3: Impact Dashboard */
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-400" /> Civic Impact Metrics
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                        <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Active Problems</span>
                        <span className="text-xl font-extrabold text-indigo-400">
                          {issues.filter(i => i.status !== 'resolved').length}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
                        <span className="block text-[9px] text-slate-500 uppercase font-black tracking-wider">Resolved Issues</span>
                        <span className="text-xl font-extrabold text-emerald-400">
                          {issues.filter(i => i.status === 'resolved').length}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs space-y-2 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-450">Community Resolution Rate:</span>
                        <span className="font-black text-slate-200">
                          {issues.length > 0 ? Math.round((issues.filter(i => i.status === 'resolved').length / issues.length) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-900">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${issues.length > 0 ? (issues.filter(i => i.status === 'resolved').length / issues.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hotspot Heatmap Overlay Toggle */}
                  <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl flex items-center justify-between shadow-md">
                    <div>
                      <h4 className="text-xs font-bold text-slate-250">Civic Hotspot Heatmap</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">Overlay glowing hazard density zones on the map</p>
                    </div>
                    <button
                      onClick={() => setHeatmapMode(!heatmapMode)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        heatmapMode ? 'bg-indigo-600' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          heatmapMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Category distribution */}
                  <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Category Distribution</h3>
                    
                    <div className="space-y-3.5">
                      {['Water Leakage', 'Safety Hazard', 'Potholes & Road Damage', 'Garbage & Sanitation', 'Other'].map(cat => {
                        const count = issues.filter(i => i.category === cat).length;
                        const pct = issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
                        return (
                          <div key={cat} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-350">{cat}</span>
                              <span className="text-slate-500">{count} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-1 border border-slate-900">
                              <div 
                                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Department Scorecard */}
                  <div className="bg-slate-900/30 border border-slate-800/40 p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolved Wards Scorecard</h3>
                    
                    <div className="space-y-3">
                      {(() => {
                        const deptConfig = {
                          'BWSSB (Water Supply)': {
                            categories: ['Water Leakage'],
                            color: 'text-indigo-400'
                          },
                          'BESCOM (Electricity/Power)': {
                            categories: ['Safety Hazard'],
                            color: 'text-yellow-400'
                          },
                          'BBMP (Roads & Sanitation)': {
                            categories: ['Potholes & Road Damage', 'Garbage & Sanitation'],
                            color: 'text-rose-400'
                          }
                        };
                        return Object.keys(deptConfig).map(deptName => {
                          const config = deptConfig[deptName];
                          const deptIssues = issues.filter(i => config.categories.includes(i.category));
                          const resolvedIssues = deptIssues.filter(i => i.status === 'resolved');
                          const resolvedCount = resolvedIssues.length;
                          
                          let scoreDisplay;
                          if (resolvedCount === 0) {
                            scoreDisplay = <span className="text-slate-500 font-medium italic text-[11px]">No resolved issues</span>;
                          } else {
                            const score = ((resolvedCount / deptIssues.length) * 5.0).toFixed(1);
                            scoreDisplay = <span className={`font-black text-sm ${config.color}`}>{score} / 5.0</span>;
                          }

                          return (
                            <div key={deptName} className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <span className="font-extrabold text-slate-300">{deptName}</span>
                                <span className="block text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                  Response Efficiency {deptIssues.length > 0 ? `(${resolvedCount}/${deptIssues.length} resolved)` : ''}
                                </span>
                              </div>
                              {scoreDisplay}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </aside>
      </div>

      {/* Report Form Popup */}
      <ReportModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        coordinates={reportCoordinates}
        onSubmit={handleAddIssue}
        currentUser={currentUser}
      />

      {/* Auth Portal Popup */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('community_hero_user', JSON.stringify(user));
        }}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        currentUserPoints={currentUserPoints}
        onProfileUpdate={(user) => {
          setCurrentUser(user);
          localStorage.setItem('community_hero_user', JSON.stringify(user));
        }}
        issues={issues}
        onSelectIssue={(issue) => setSelectedIssue(issue)}
      />

      {/* Public Citizen User Profile Modal */}
      <UserProfileModal
        isOpen={!!selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        user={selectedProfileUser}
        issues={issues}
        onSelectIssue={(issue) => {
          setSelectedIssue(issue);
          if (issue.lat && issue.lng) {
            setMapCenter([issue.lat, issue.lng]);
          }
        }}
      />

      {/* Badge Unlock Celebration Popup */}
      {celebratingBadge && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
            }
            @keyframes badge-glow {
              0% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
              50% { box-shadow: 0 0 50px rgba(245, 158, 11, 0.6); }
              100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
            }
            .confetti {
              position: absolute;
              width: 10px;
              height: 10px;
              background-color: #f59e0b;
              animation: confetti-fall 3.5s linear infinite;
            }
          `}</style>
          
          {/* Confetti Rain */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 3;
              const size = Math.random() * 8 + 6;
              const colors = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#f43f5e'];
              const color = colors[Math.floor(Math.random() * colors.length)];
              return (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${left}%`,
                    animationDelay: `${delay}s`,
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: color,
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  }}
                />
              );
            })}
          </div>

          <div className="bg-[#0b1329] border-2 border-amber-500/30 rounded-3xl p-8 max-w-md w-full text-center relative shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col items-center space-y-6" style={{ animation: 'badge-glow 3s infinite' }}>
            
            {/* Glowing background ring */}
            <div className="w-28 h-28 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-6xl relative select-none animate-pulse">
              <div className="absolute inset-0 rounded-full bg-amber-500/5 blur-xl animate-ping" />
              {celebratingBadge.emoji}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                Badge Unlocked!
              </span>
              <h2 className="text-2xl font-black text-slate-100 tracking-tight pt-1">
                Congratulations, {currentUser?.name}!
              </h2>
              <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                Your dedication to public service has earned you a new rank in the community!
              </p>
            </div>

            {/* Badge Details Card */}
            <div className="w-full p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-1">
              <h3 className="text-lg font-black text-amber-400">
                {celebratingBadge.title}
              </h3>
              <p className="text-xs text-slate-350 italic">
                "{celebratingBadge.desc}"
              </p>
              <div className="pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Unlocked at {celebratingBadge.points} Points
              </div>
            </div>

            {/* Claim button */}
            <button
              onClick={() => setCelebratingBadge(null)}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-sm tracking-wider uppercase rounded-2xl shadow-lg transition duration-200"
            >
              Continue Journey
            </button>
          </div>
        </div>
      )}
    </div>
  );
}