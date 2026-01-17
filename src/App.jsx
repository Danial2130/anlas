import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  query, 
  orderBy,
  increment
} from 'firebase/firestore';
import { Bell, Trophy, LogOut, Sun, Moon, User, Chrome, AlertCircle, CheckCircle2 } from 'lucide-react';

// --- KONFIGURASI FIREBASE ANLAS ---
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
const googleProvider = new GoogleAuthProvider();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'social-alarm-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alarm');
  const [targetTime, setTargetTime] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;
    
    const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const q = query(usersCol);
    
    const unsubBoard = onSnapshot(q, (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => players.push(doc.data()));
      setLeaderboard(players.sort((a, b) => (b.streak || 0) - (a.streak || 0)));
    }, (error) => console.error("Leaderboard error:", error));

    const myDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubProfile = onSnapshot(myDocRef, (snap) => {
      if (snap.exists()) setMyProfile(snap.data());
    });

    return () => {
      unsubBoard();
      unsubProfile();
    };
  }, [user]);

  // Alarm Engine
  useEffect(() => {
    let interval;
    if (isMonitoring && targetTime && !alarmTriggered) {
      interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (currentTime === targetTime) {
          setAlarmTriggered(true);
          updateStatus('🚨 BERISIK!');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, targetTime, alarmTriggered]);

  const updateStatus = async (statusText) => {
    if (!user) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, { status: statusText, lastAction: serverTimestamp() }).catch(() => {});
  };

  const login = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        name: result.user.displayName,
        photo: result.user.photoURL, 
        streak: myProfile?.streak || 0,
        status: 'Online',
        lastAction: serverTimestamp()
      }, { merge: true });
    } catch (e) { 
      console.error(e);
      setAuthError("Gagal masuk. Periksa koneksi atau domain Firebase.");
    }
  };

  const handleSuccess = async () => {
    setIsMonitoring(false);
    setAlarmTriggered(false);
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, {
      status: 'Bangun Tepat Waktu! ✅',
      streak: increment(1),
      lastAction: serverTimestamp()
    });
    setActiveTab('leaderboard');
  };

  // Helper Foto Profil Fixed
  const getAvatar = (photoUrl, name) => {
    if (photoUrl && photoUrl.length > 10) return photoUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=6366f1&color=fff`;
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Memuat...</p>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center text-center max-w-sm w-full">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-100 rotate-3">
            <Bell size={32} className="text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-black mb-2 tracking-tighter italic uppercase">Anlas<span className="text-indigo-600">.</span></h1>
          <p className="text-slate-500 mb-8 text-xs font-medium px-4">Alarm sosial untuk membangun disiplin pagi bersama teman-temanmu.</p>
          
          {authError && (
            <div className="mb-6 p-3 bg-red-50 rounded-xl flex items-start gap-2 text-left border border-red-100 w-full">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-red-600 leading-tight">{authError}</p>
            </div>
          )}

          <button onClick={login} className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-md">
            <Chrome size={18} />
            Lanjut dengan Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <div className="max-w-md mx-auto px-5">
        
        {/* Header Fixed Photo */}
        <header className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-xl font-black tracking-tighter italic uppercase">Anlas</h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-emerald-500">
              <div className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
              <p className="text-[8px] font-black uppercase tracking-widest opacity-80">Server Online</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-1.5 pr-3 rounded-xl shadow-sm border border-slate-100">
            <img 
              src={getAvatar(user.photoURL, user.displayName)} 
              className="w-8 h-8 rounded-lg object-cover ring-2 ring-slate-50" 
              alt="Me"
            />
            <button onClick={() => signOut(auth)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
              <LogOut size={16}/>
            </button>
          </div>
        </header>

        {/* Tab - Normal Size */}
        <nav className="flex bg-slate-200/50 p-1 rounded-2xl mb-6 backdrop-blur-sm border border-slate-200/30">
          <button onClick={() => setActiveTab('alarm')} className={`flex-1 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all ${activeTab === 'alarm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Alarm</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all ${activeTab === 'leaderboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Peringkat</button>
        </nav>

        {activeTab === 'alarm' ? (
          <div className={`bg-white p-8 rounded-[40px] shadow-xl border-2 transition-all duration-500 ${alarmTriggered ? 'border-red-400 scale-[1.01] shadow-red-100' : 'border-white'}`}>
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 transition-all ${alarmTriggered ? 'bg-red-500 text-white animate-bounce' : 'bg-indigo-50 text-indigo-600'}`}>
              {alarmTriggered ? <Bell size={36} /> : isMonitoring ? <Sun size={36} className="animate-[spin_8s_linear_infinite]" /> : <Moon size={36} />}
            </div>
            
            <div className="mb-6 text-center">
              <h2 className={`text-xl font-black mb-1 ${alarmTriggered ? 'text-red-600' : 'text-slate-900'}`}>
                {alarmTriggered ? "BANGUN SEKARANG!" : isMonitoring ? "Monitor Aktif" : "Atur Alarm Pagi"}
              </h2>
              <span className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">
                🔥 Streak: {myProfile?.streak || 0} Hari
              </span>
            </div>
            
            <div className="mb-8 relative">
              <input 
                type="time" 
                value={targetTime} 
                disabled={isMonitoring} 
                onChange={(e) => setTargetTime(e.target.value)} 
                className={`w-full bg-slate-50 rounded-3xl py-8 text-6xl font-black text-center outline-none border-2 transition-all ${isMonitoring ? 'border-transparent text-slate-200' : 'border-slate-100 focus:border-indigo-200 focus:bg-white text-slate-900'}`} 
              />
            </div>
            
            {alarmTriggered ? (
              <button onClick={handleSuccess} className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> SAYA SUDAH BANGUN
              </button>
            ) : (
              <button 
                onClick={() => { setIsMonitoring(!isMonitoring); updateStatus(isMonitoring ? 'Online' : 'Menunggu Pagi ⏳'); }} 
                disabled={!targetTime} 
                className={`w-full font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 ${isMonitoring ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-900 text-white hover:bg-black disabled:opacity-20'}`}
              >
                {isMonitoring ? 'Batalkan Kontrak' : 'Tanda Tangani Kontrak'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[32px] shadow-xl border border-slate-100">
             <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-2.5">
                 <div className="bg-amber-400 p-2 rounded-lg shadow-md shadow-amber-50">
                   <Trophy size={18} className="text-white" />
                 </div>
                 <h3 className="font-black text-lg">Pejuang Subuh</h3>
               </div>
               <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-2 py-1 rounded-md uppercase tracking-widest">
                 {leaderboard.length} Anggota
               </span>
             </div>

             <div className="space-y-3">
               {leaderboard.map((p, i) => (
                 <div key={p.uid} className={`flex items-center justify-between p-3.5 rounded-2xl transition-all border ${p.uid === user.uid ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-100/50'}`}>
                   <div className="flex items-center gap-3">
                     <span className={`text-[10px] font-black w-3 text-center ${p.uid === user.uid ? 'text-indigo-200' : 'text-slate-300'}`}>{i+1}</span>
                     <div className="relative">
                       <img 
                         src={getAvatar(p.photo, p.name)} 
                         className={`w-10 h-10 rounded-xl object-cover shadow-sm ${p.uid === user.uid ? 'ring-2 ring-white/30' : 'border-2 border-white'}`} 
                         alt={p.name}
                       />
                       {p.status?.includes('🚨') && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>}
                     </div>
                     <div>
                       <p className="text-xs font-black tracking-tight mb-0.5 truncate max-w-[120px]">{p.uid === user.uid ? 'Anda' : (p.name || 'User')}</p>
                       <p className={`text-[8px] font-bold uppercase tracking-wider opacity-70`}>{p.status || 'Offline'}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <div className="flex items-center justify-end gap-1">
                        <span className="text-lg font-black italic">{p.streak || 0}</span>
                        <Sun size={10} className={p.uid === user.uid ? 'text-indigo-200' : 'text-amber-400'} />
                     </div>
                     <p className="text-[7px] font-black uppercase tracking-widest opacity-50">Streak</p>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        <footer className="mt-8 text-center">
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.3em]">Anlas v1.0.3 • Localhost Build</p>
        </footer>
      </div>
    </div>
  );
}