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

// --- KONFIGURASI FIREBASE ANDA ---
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

  // 1. Pantau Status Login (Auth Observer)
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

    // Path Koleksi: /artifacts/{appId}/public/data/users
    const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    
    // Ambil Leaderboard secara real-time
    const q = query(usersCol);
    const unsubBoard = onSnapshot(q, (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => players.push(doc.data()));
      // Sort berdasarkan streak di memori (Rule Firestore: No Complex Queries)
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

  // 3. Logika Alarm (Engine)
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

  // Fungsi: Login Google
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', result.user.uid);
      
      // Simpan/Update data user saat login
      await setDoc(userRef, {
        uid: result.user.uid,
        name: result.user.displayName,
        photo: result.user.photoURL,
        streak: 0,
        status: 'Online',
        lastAction: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Login Gagal:", error);
    }
  };

  const updateStatus = async (statusText) => {
    if (!user) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
    await updateDoc(userRef, { 
      status: statusText,
      lastAction: serverTimestamp() 
    }).catch(() => {});
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

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-indigo-600 animate-pulse uppercase tracking-widest">Memuat Anlas...</div>;

  // Tampilan jika Belum Login
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-indigo-600 w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-200 rotate-3">
          <Bell size={48} className="text-white -rotate-3" />
        </div>
        <h1 className="text-5xl font-black text-slate-900 mb-4 italic tracking-tighter">ANLAS.</h1>
        <p className="text-slate-500 mb-10 max-w-[280px] leading-relaxed">Bangun pagi atau dipermalukan teman di Leaderboard. Siap berkomitmen?</p>
        <button 
          onClick={handleLogin} 
          className="flex items-center gap-4 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95"
        >
          <Chrome size={20} />
          Masuk dengan Google
        </button>
      </div>
    );
  }

  // Tampilan Utama (Setelah Login)
  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
      <div className="max-w-md mx-auto">
        <header className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-black text-indigo-600 italic tracking-tight">ANLAS</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anti Malas System</p>
          </div>
          <div className="flex items-center gap-3">
            <img src={user.photoURL} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="Profile" />
            <button onClick={() => signOut(auth)} className="bg-white p-2 rounded-xl border border-slate-100 text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={18}/>
            </button>
          </div>
        </header>

        <nav className="flex bg-white p-1.5 rounded-2xl shadow-sm mb-8 border border-slate-100">
          <button 
            onClick={() => setActiveTab('alarm')} 
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'alarm' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Atur Alarm
          </button>
          <button 
            onClick={() => setActiveTab('leaderboard')} 
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'leaderboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Peringkat
          </button>
        </nav>

        <main>
          {activeTab === 'alarm' ? (
            <div className={`bg-white p-10 rounded-[48px] shadow-xl text-center border-4 transition-all duration-500 ${alarmTriggered ? 'border-red-500 scale-105' : 'border-transparent'}`}>
              <div className={`w-24 h-24 rounded-[36px] flex items-center justify-center mx-auto mb-8 transition-colors ${alarmTriggered ? 'bg-red-50 text-red-500 animate-bounce' : 'bg-indigo-50 text-indigo-600'}`}>
                {alarmTriggered ? <Bell size={48} /> : isMonitoring ? <Sun size={48} className="animate-spin-slow" /> : <Moon size={48} />}
              </div>
              
              <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">
                {alarmTriggered ? "BANGUN SEKARANG!" : isMonitoring ? "Sistem Menunggu..." : "Janji Bangun Jam?"}
              </h2>
              <p className="text-slate-400 text-xs mb-10 font-medium">Jangan sampai streak {myProfile?.streak || 0} kamu hangus!</p>

              <div className="relative mb-10">
                <input 
                  type="time" 
                  value={targetTime} 
                  onChange={(e) => setTargetTime(e.target.value)} 
                  disabled={isMonitoring}
                  className={`w-full p-6 bg-slate-50 rounded-[28px] text-6xl font-black text-center outline-none transition-all ${isMonitoring ? 'opacity-40 cursor-not-allowed' : 'focus:ring-8 focus:ring-indigo-50 tracking-widest'}`}
                />
              </div>

              {alarmTriggered ? (
                <button 
                  onClick={handleSuccess} 
                  className="w-full bg-emerald-500 text-white font-black py-6 rounded-[28px] shadow-2xl shadow-emerald-200 text-xl active:scale-95 transition-transform"
                >
                  SAYA SUDAH BANGUN!
                </button>
              ) : (
                <button 
                  onClick={() => { setIsMonitoring(!isMonitoring); updateStatus(isMonitoring ? 'Idle' : 'Siaga Bangun'); }} 
                  disabled={!targetTime} 
                  className={`w-full font-black py-5 rounded-[28px] uppercase tracking-[0.2em] text-xs transition-all active:scale-95 ${isMonitoring ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'}`}
                >
                  {isMonitoring ? 'Batalkan Kontrak' : 'Mulai Kontrak'}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-50">
               <div className="flex justify-between items-end mb-8">
                 <h3 className="font-black text-xl flex items-center gap-3 italic uppercase tracking-tighter">
                   <Trophy size={28} className="text-yellow-500" /> Pejuang Subuh
                 </h3>
                 <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-widest">
                   {leaderboard.length} Peserta
                 </span>
               </div>

               <div className="space-y-4">
                 {leaderboard.length === 0 ? (
                   <div className="py-20 text-center text-slate-300 italic text-sm">Belum ada pejuang bergabung...</div>
                 ) : (
                   leaderboard.map((p, i) => (
                     <div key={p.uid} className={`flex items-center justify-between p-4 rounded-3xl transition-all ${p.uid === user.uid ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 -mx-2 px-6' : 'bg-slate-50 border border-slate-100'}`}>
                       <div className="flex items-center gap-4">
                         <span className={`text-xs font-black w-4 ${p.uid === user.uid ? 'text-indigo-200' : 'text-slate-300'}`}>{i+1}</span>
                         <img src={p.photo} className={`w-11 h-11 rounded-full border-2 ${p.uid === user.uid ? 'border-indigo-400' : 'border-white'}`} alt="" />
                         <div>
                           <p className="text-sm font-black uppercase tracking-tight">{p.uid === user.uid ? 'Anda' : p.name?.split(' ')[0]}</p>
                           <p className={`text-[9px] font-bold uppercase tracking-widest ${p.uid === user.uid ? 'text-indigo-200' : 'text-indigo-400'}`}>{p.status}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className={`text-xl font-black leading-none ${p.uid === user.uid ? 'text-white' : 'text-indigo-600'}`}>{p.streak || 0}</p>
                         <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${p.uid === user.uid ? 'text-indigo-300' : 'text-slate-400'}`}>Streak</p>
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