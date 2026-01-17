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
import { Bell, Trophy, LogOut, Sun, Moon, User, Chrome } from 'lucide-react';

// --- KONFIGURASI FIREBASE ANLAS ---
const firebaseConfig = {
  apiKey: "AIzaSyBa2q4SNNl97cJ66l2LNGF3UnqTIRsjAe0",
  authDomain: "anlas-4ce05.firebaseapp.com",
  projectId: "anlas-4ce05",
  storageBucket: "anlas-4ce05.firebasestorage.app",
  messagingSenderId: "8438845826",
  appId: "1:8438845826:web:688c98a7d5be2c9ca07f9b"
};

// Inisialisasi Firebase
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

  // 1. Pantau status Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sinkronisasi Data Firestore (Leaderboard & Profil)
  useEffect(() => {
    if (!user) return;

    // Path Koleksi sesuai aturan main Firestore Environment
    const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    
    // Ambil Leaderboard secara real-time
    const q = query(usersCol);
    const unsubBoard = onSnapshot(q, (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push(doc.data());
      });
      // Sort berdasarkan streak di memori
      setLeaderboard(players.sort((a, b) => (b.streak || 0) - (a.streak || 0)));
    }, (err) => console.error("Leaderboard Error:", err));

    // Pantau profil saya sendiri
    const myDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    const unsubProfile = onSnapshot(myDocRef, (snap) => {
      if (snap.exists()) setMyProfile(snap.data());
    });

    return () => {
      unsubBoard();
      unsubProfile();
    };
  }, [user]);

  // 3. Logika Alarm
  useEffect(() => {
    let interval;
    if (isMonitoring && targetTime && !alarmTriggered) {
      interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (currentTime === targetTime) {
          setAlarmTriggered(true);
          updateStatus('🚨 SEDANG BERISIK!');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, targetTime, alarmTriggered]);

  const updateStatus = async (statusText) => {
    if (!user) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, { 
      status: statusText,
      lastAction: serverTimestamp() 
    }).catch(() => {});
  };

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid);
      
      // Simpan/Update data user saat login (Pastikan foto masuk)
      await setDoc(userRef, {
        uid: result.user.uid,
        name: result.user.displayName,
        photo: result.user.photoURL || '', 
        streak: result.user.uid === auth.currentUser?.uid ? (myProfile?.streak || 0) : 0,
        status: 'Online',
        lastAction: serverTimestamp()
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const handleSuccess = async () => {
    setIsMonitoring(false);
    setAlarmTriggered(false);
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, {
      status: 'Berhasil Bangun! ✅',
      streak: increment(1),
      lastAction: serverTimestamp()
    });
    setActiveTab('leaderboard');
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-slate-400 text-xs tracking-widest uppercase">Memuat Anlas...</p>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-200">
          <Bell size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2 italic tracking-tighter">ANLAS.</h1>
        <p className="text-slate-500 mb-8 max-w-[250px] leading-snug">Tunjukkan kedisiplinanmu dan pantau teman yang masih tidur.</p>
        <button onClick={login} className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95">
          <Chrome size={20} />
          Masuk dengan Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        <header className="flex justify-between items-center py-4 mb-4">
          <div>
            <h1 className="text-2xl font-black text-indigo-600 italic leading-none">ANLAS</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Anti Malas System</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-1 pr-3 rounded-2xl shadow-sm border border-slate-100">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-8 h-8 rounded-xl object-cover border border-slate-100" 
              alt="Profil"
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${user.displayName}` }}
            />
            <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={18}/>
            </button>
          </div>
        </header>

        <nav className="flex bg-white p-1 rounded-2xl shadow-sm mb-8 border border-slate-100">
          <button onClick={() => setActiveTab('alarm')} className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'alarm' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Alarm</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'leaderboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Peringkat</button>
        </nav>

        {activeTab === 'alarm' ? (
          <div className={`bg-white p-10 rounded-[40px] shadow-xl text-center border-4 transition-all duration-500 ${alarmTriggered ? 'border-red-500 animate-pulse scale-[1.02]' : 'border-transparent'}`}>
            <div className={`w-20 h-20 rounded-[30px] flex items-center justify-center mx-auto mb-8 transition-colors ${alarmTriggered ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
              {alarmTriggered ? <Bell size={40} /> : isMonitoring ? <Sun size={40} className="animate-spin-slow text-orange-400" /> : <Moon size={40} />}
            </div>
            <h2 className="text-2xl font-black mb-1 uppercase tracking-tight italic">{alarmTriggered ? "BANGUN SEKARANG!" : isMonitoring ? "Sistem Menunggu..." : "Mau Bangun Jam?"}</h2>
            <p className="text-slate-400 text-xs mb-8 font-medium italic">Streak saat ini: {myProfile?.streak || 0} Hari</p>
            
            <input 
              type="time" 
              value={targetTime} 
              disabled={isMonitoring} 
              onChange={(e) => setTargetTime(e.target.value)} 
              className="w-full p-4 bg-slate-50 rounded-3xl text-6xl font-black text-center mb-10 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" 
            />
            
            {alarmTriggered ? (
              <button onClick={handleSuccess} className="w-full bg-emerald-500 text-white font-black py-6 rounded-3xl shadow-2xl shadow-emerald-200 text-xl active:scale-95 transition-transform">SAYA SUDAH BANGUN!</button>
            ) : (
              <button 
                onClick={() => { setIsMonitoring(!isMonitoring); updateStatus(isMonitoring ? 'Online' : 'Siaga Bangun 😴'); }} 
                disabled={!targetTime} 
                className={`w-full font-black py-5 rounded-3xl transition-all active:scale-95 shadow-lg ${isMonitoring ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-indigo-100'}`}
              >
                {isMonitoring ? 'Batalkan Kontrak' : 'Mulai Kontrak'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-50">
             <div className="flex justify-between items-end mb-8">
               <h3 className="font-black text-xl flex items-center gap-2 italic uppercase tracking-tighter">
                 <Trophy size={28} className="text-yellow-500" /> Pejuang Subuh
               </h3>
               <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-widest">
                 {leaderboard.length} Peserta
               </span>
             </div>

             <div className="space-y-4">
               {leaderboard.map((p, i) => (
                 <div key={p.uid} className={`flex items-center justify-between p-4 rounded-3xl transition-all ${p.uid === user.uid ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'bg-slate-50 border border-slate-100'}`}>
                   <div className="flex items-center gap-4">
                     <span className={`text-xs font-black w-4 ${p.uid === user.uid ? 'text-indigo-200' : 'text-slate-300'}`}>{i+1}</span>
                     <img 
                       src={p.photo || `https://ui-avatars.com/api/?name=${p.name}`} 
                       className={`w-11 h-11 rounded-2xl border-2 object-cover ${p.uid === user.uid ? 'border-indigo-400' : 'border-white'}`} 
                       alt={p.name} 
                       onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${p.name}` }}
                     />
                     <div>
                       <p className="text-sm font-black uppercase tracking-tight leading-none mb-1">{p.uid === user.uid ? 'Anda' : p.name?.split(' ')[0]}</p>
                       <p className={`text-[9px] font-bold uppercase tracking-widest ${p.uid === user.uid ? 'text-indigo-200' : 'text-indigo-400'}`}>{p.status}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className={`text-xl font-black leading-none ${p.uid === user.uid ? 'text-white' : 'text-indigo-600'}`}>{p.streak || 0}</p>
                     <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${p.uid === user.uid ? 'text-indigo-300' : 'text-slate-400'}`}>Streak</p>
                   </div>
                 </div>
               ))}
               {leaderboard.length === 0 && (
                 <div className="py-20 text-center text-slate-300 italic text-sm">Belum ada pejuang bergabung...</div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}