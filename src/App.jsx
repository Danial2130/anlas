import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  query, 
  onSnapshot, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Bell, Trophy, Moon, Sun, AlertCircle, User, WifiOff } from 'lucide-react';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBa2q4SNNl97cJ66l2LNGF3UnqTIRsjAe0",
  authDomain: "anlas-4ce05.firebaseapp.com",
  projectId: "anlas-4ce05",
  storageBucket: "anlas-4ce05.firebasestorage.app",
  messagingSenderId: "8438845826",
  appId: "1:8438845826:web:688c98a7d5be2c9ca07f9b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'social-alarm-habit';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alarm');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [targetTime, setTargetTime] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  // 1. Auth Logic - Diperbaiki agar tidak crash jika config belum siap
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Mencoba login anonim
          await signInAnonymously(auth);
        }
      } catch (error) {
        // Jika error configuration-not-found, aktifkan mode lokal tanpa melempar error berat
        if (isMounted) {
          console.warn("Firebase Auth belum dikonfigurasi di Console. Beralih ke Mode Lokal.");
          setIsLocalMode(true);
          setUser({ uid: 'local-' + Math.random().toString(36).substring(7), isLocal: true });
          setLoading(false);
        }
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isMounted && currentUser) {
        setUser(currentUser);
        setIsLocalMode(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Data Sync - Hanya jalan jika tidak dalam mode lokal
  useEffect(() => {
    if (!user || isLocalMode) return;

    const usersCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);

    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        setDoc(userDocRef, {
          uid: user.uid,
          name: `Pejuang-${user.uid.substring(0, 4)}`,
          streak: 0,
          status: 'Online',
          lastAction: serverTimestamp()
        }).catch(e => console.error("Gagal buat profil:", e));
      }
    }, (err) => console.error("Firestore Error:", err));

    const unsubBoard = onSnapshot(usersCollectionRef, (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => users.push(doc.data()));
      setLeaderboard(users.sort((a, b) => (b.streak || 0) - (a.streak || 0)));
    }, (err) => console.error("Leaderboard Error:", err));

    return () => {
      unsubProfile();
      unsubBoard();
    };
  }, [user, isLocalMode]);

  // 3. Alarm Engine
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMonitoring && targetTime && !alarmTriggered) {
        const now = new Date();
        const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (current === targetTime) setAlarmTriggered(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isMonitoring, targetTime, alarmTriggered]);

  const handleStart = async () => {
    setIsMonitoring(true);
    if (user && !isLocalMode) {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      await updateDoc(userRef, { status: 'Siaga Bangun', lastAction: serverTimestamp() }).catch(e => {});
    }
  };

  const handleWakeUp = async () => {
    setIsMonitoring(false);
    setAlarmTriggered(false);
    const newStreak = (userProfile?.streak || 0) + 1;
    
    // Update local state untuk feedback instan
    setUserProfile(prev => prev ? { ...prev, streak: newStreak, status: 'Berhasil!' } : { streak: newStreak });

    if (user && !isLocalMode) {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      await updateDoc(userRef, { 
        status: 'Berhasil!', 
        streak: newStreak,
        lastAction: serverTimestamp() 
      }).catch(e => {});
    }
    setActiveTab('leaderboard');
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-bold text-indigo-600 animate-pulse text-xs tracking-widest uppercase">Menghubungkan Ke Anlas...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-indigo-600 italic tracking-tighter">ANLAS</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Anti Malas System</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-sm border flex items-center gap-2 ${isLocalMode ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-white border-slate-100 text-slate-500'}`}>
            {isLocalMode ? <WifiOff size={12} /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
            {isLocalMode ? 'MODE LOKAL' : `ID: ${user?.uid?.substring(0, 6)}`}
          </div>
        </header>

        <nav className="flex bg-white p-1 rounded-2xl shadow-sm mb-6 border border-slate-100">
          <button onClick={() => setActiveTab('alarm')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'alarm' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Alarm</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'leaderboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Peringkat</button>
        </nav>

        <main>
          {activeTab === 'alarm' ? (
            <div className={`bg-white p-8 rounded-[40px] shadow-xl text-center border-4 transition-all duration-500 ${alarmTriggered ? 'border-red-500 scale-105' : 'border-transparent'}`}>
              <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6 transition-colors ${alarmTriggered ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
                {alarmTriggered ? <Bell size={40} className="animate-bounce" /> : isMonitoring ? <Sun size={40} className="animate-spin-slow" /> : <Moon size={40} />}
              </div>
              
              <h2 className="text-xl font-black mb-2 uppercase tracking-tight">
                {alarmTriggered ? 'BANGUN SEKARANG!' : isMonitoring ? 'Sistem Memantau...' : 'Setel Janji Bangun'}
              </h2>
              <p className="text-slate-400 text-xs mb-8 font-medium italic">"Kejujuran adalah kunci streak tinggi."</p>

              <div className="relative mb-8">
                <input 
                  type="time" 
                  value={targetTime} 
                  onChange={(e) => setTargetTime(e.target.value)} 
                  disabled={isMonitoring}
                  className={`w-full p-6 bg-slate-50 rounded-[24px] text-5xl font-black text-center outline-none transition-all ${isMonitoring ? 'opacity-50' : 'focus:ring-4 focus:ring-indigo-100'}`}
                />
              </div>

              {alarmTriggered ? (
                <button onClick={handleWakeUp} className="w-full bg-emerald-500 text-white font-black py-5 rounded-[24px] shadow-xl text-xl animate-pulse active:scale-95 transition-transform tracking-tight">
                  SAYA SUDAH BANGUN!
                </button>
              ) : (
                <button 
                  onClick={isMonitoring ? () => {setIsMonitoring(false); setAlarmTriggered(false);} : handleStart}
                  className={`w-full font-black py-4 rounded-[24px] text-sm uppercase tracking-widest transition-all active:scale-95 ${isMonitoring ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'}`}
                >
                  {isMonitoring ? 'Batalkan Kontrak' : 'Mulai Kontrak Sosial'}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-lg flex items-center gap-2 italic uppercase tracking-tighter"><Trophy size={22} className="text-yellow-500" /> Peringkat Pejuang</h3>
                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{leaderboard.length} USER</span>
              </div>

              {isLocalMode && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-4 flex gap-3">
                  <AlertCircle className="text-amber-500 shrink-0" size={18} />
                  <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase">
                    Peringkat global tidak muncul karena Anonymous Auth belum aktif di Firebase Console.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {leaderboard.length === 0 && !isLocalMode ? (
                  <div className="text-center py-12 opacity-30 italic text-sm">Menunggu pejuang lain...</div>
                ) : isLocalMode ? (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black">1</div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight">Anda (Guest)</p>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Mode Lokal</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-600 leading-none">{userProfile?.streak || 0}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Streak</p>
                    </div>
                  </div>
                ) : (
                  leaderboard.map((p, i) => (
                    <div key={p.uid} className={`flex items-center justify-between p-4 rounded-2xl transition-all ${p.uid === user?.uid ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-transparent'}`}>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-black w-4 ${i < 3 ? 'text-indigo-600' : 'text-slate-300'}`}>{i+1}</span>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${p.uid === user?.uid ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                          {p.name?.charAt(8) || 'P'}
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-tight">{p.uid === user?.uid ? 'Anda' : p.name}</p>
                          <p className={`text-[9px] font-black uppercase tracking-tighter ${p.status === 'Berhasil!' ? 'text-emerald-500' : 'text-indigo-400'}`}>{p.status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-600 leading-none">{p.streak || 0}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Streak</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}