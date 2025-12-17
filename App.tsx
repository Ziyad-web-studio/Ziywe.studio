import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { auth, googleProvider, db } from './firebaseConfig';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { AppView, DayMode, Transaction, UserProfile, ChatMessage } from './types';
import { IconGoogle, IconSend, IconSparkles } from './components/Icons';
import { getNightlyInsight, chatWithGemini, parseTransactionSmart } from './services/geminiService';

// --- Utility: Parse Input ---
const parseInput = (text: string): { itemName: string; price: number; quantity: number } => {
  let price = 0;
  let quantity = 1;
  let name = text;

  // 1. Extract Price (Look for "rb" or "k" or just numbers at the end)
  let cleanText = text.replace(/(\d+)(rb|k)/gi, '$1000');
  
  const priceMatch = cleanText.match(/(\d+)(?!.*\d)/);
  if (priceMatch) {
    price = parseInt(priceMatch[0]);
    cleanText = cleanText.replace(priceMatch[0], '').trim();
  }

  // 2. Extract Quantity
  const qtyMatch = cleanText.match(/(\d+)\s*(x|pcs|biji|bh|kg|liter|l)/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1]);
    cleanText = cleanText.replace(qtyMatch[0], '').trim();
  } else {
      const smallNumMatch = cleanText.match(/^(\d{1,2})\s+/);
      if(smallNumMatch) {
          quantity = parseInt(smallNumMatch[1]);
          cleanText = cleanText.replace(smallNumMatch[0], '').trim();
      }
  }

  // 3. Cleanup Name
  name = cleanText.replace(/[^\w\s]/gi, '').trim();

  return { itemName: name || "Barang Umum", price, quantity };
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "w-full py-4 rounded-[24px] font-semibold text-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-appleBlue text-white shadow-apple hover:shadow-apple-hover",
    secondary: "bg-offWhite text-black hover:bg-gray-200",
    success: "bg-successGreen text-white shadow-apple",
    ghost: "bg-transparent text-appleBlue hover:bg-gray-100/50"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ type = "text", placeholder, value, onChange, onKeyDown, className = '' }: any) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    className={`w-full px-6 py-4 rounded-[24px] bg-white/50 backdrop-blur-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-appleBlue/50 text-lg transition-all placeholder-gray-400 ${className}`}
  />
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [dayMode, setDayMode] = useState<DayMode>(DayMode.DAY);
  const [loading, setLoading] = useState(true);
  
  // Dashboard State
  const [inputText, setInputText] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nightInsight, setNightInsight] = useState<{ verdict: string; empathyMessage: string; status: 'green'|'yellow' } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Chatbot State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Auth State
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingInput, setOnboardingInput] = useState("");
  const [shopName, setShopName] = useState("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // 1. Strict Time Check (No Manual Toggle)
  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      // Night is strictly 18:00 to 04:59
      const isNight = hour >= 18 || hour < 5;
      const newMode = isNight ? DayMode.NIGHT : DayMode.DAY;
      
      setDayMode(newMode);
      
      if (newMode === DayMode.NIGHT) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // 2. Auth Listener & Profile Fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Fetch Profile
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          if (profile.onboardingComplete) {
            setView(AppView.DASHBOARD);
            fetchTodayTransactions(currentUser.uid);
          } else {
            setView(AppView.ONBOARDING);
          }
        } else {
          // New user, redirect to onboarding immediately
          setView(AppView.ONBOARDING);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setView(AppView.LANDING);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Scroll Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 4. Generate Night Insight (Only if Night Mode and Data Exists)
  useEffect(() => {
    if (dayMode === DayMode.NIGHT && view === AppView.DASHBOARD && transactions.length > 0 && userProfile?.shopName) {
      getNightlyInsight(transactions, userProfile.shopName).then(setNightInsight);
    }
  }, [dayMode, view, transactions, userProfile]);

  // --- Logic ---

  const fetchTodayTransactions = async (uid: string) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", uid),
      where("timestamp", ">=", Timestamp.fromDate(startOfDay)),
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const loadedTx: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      loadedTx.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    setTransactions(loadedTx);
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError("");
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error); // Keep for debugging
      setAuthError("Login Google belum siap. Coba pakai email dulu ya.");
    }
  };

  const handleEmailAuth = async () => {
    try {
      setAuthError("");
      
      // Validation Rule 1: Security & Best Practice
      if (isRegistering) {
          if (authPassword.length < 6) {
              setAuthError("Password minimal 6 karakter ya.");
              return;
          }
          if (authPassword === authEmail) {
              setAuthError("Password jangan sama dengan email ya.");
              return;
          }
      }

      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error: any) {
      // Human-readable error
      setAuthError("Login gagal. Coba cek email atau passwordnya lagi ya.");
    }
  };

  const handleOnboardingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onboardingInput.trim()) return;

    if (onboardingStep === 0) {
      setShopName(onboardingInput);
      setOnboardingInput("");
      setOnboardingStep(1);
    } else if (onboardingStep === 1) {
      // Complete Onboarding
      if (user) {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          shopName: shopName,
          shopCategory: onboardingInput,
          onboardingComplete: true
        };
        
        await setDoc(doc(db, "users", user.uid), newProfile);
        
        // Critical: Update local state to trigger view change without reload
        setUserProfile(newProfile);
        setView(AppView.DASHBOARD);
        fetchTodayTransactions(user.uid);
      }
    }
  };

  const handleTransactionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Block input in Night Mode or if empty
    if (!inputText.trim() || !user || dayMode === DayMode.NIGHT) return;

    const rawInput = inputText;
    setInputText(""); // Clear immediately for UX

    // 1. Basic Regex Parse
    let data = parseInput(rawInput);
    
    // 2. Fallback to AI
    if (data.price === 0) {
         const aiData = await parseTransactionSmart(rawInput);
         if (aiData) data = aiData;
    }

    if (data.price === 0) {
         setToastMessage("Gagal membaca harga. Coba: 'Nama 20rb'");
         setShowToast(true);
         setTimeout(() => setShowToast(false), 3000);
         setInputText(rawInput); // Restore text
         return;
    }

    const newTx: Transaction = {
      userId: user.uid,
      itemName: data.itemName,
      quantity: data.quantity,
      price: data.price,
      total: data.price * data.quantity,
      timestamp: Timestamp.now(),
      originalInput: rawInput
    };

    // Optimistic Update
    setTransactions(prev => [newTx, ...prev]);

    // Save to DB
    await addDoc(collection(db, "transactions"), newTx);

    setToastMessage("Oke, dicatat.");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    const history = chatMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const responseText = await chatWithGemini(history, userMsg.text);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  // --- Views ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offWhite dark:bg-darkCharcoal transition-colors duration-500">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-32 bg-gray-300 rounded mb-4"></div>
            <div className="h-4 w-48 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  // 1. Landing View
  if (view === AppView.LANDING) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-offWhite relative overflow-hidden">
        <div className="text-center max-w-md z-10">
          <h1 className="text-5xl font-bold mb-4 tracking-tight text-black">Tenangin</h1>
          <p className="text-xl text-gray-500 mb-12 leading-relaxed">
            Biar lu gak cuma capek jualan, tapi tau lu lagi maju.
          </p>
          <Button onClick={() => setView(AppView.AUTH)} className="shadow-2xl shadow-blue-500/30">
            Mulai Sekarang
          </Button>
        </div>
      </div>
    );
  }

  // 2. Auth View
  if (view === AppView.AUTH) {
    return (
      <div className="min-h-screen flex flex-col items-end justify-end p-0 bg-black/20 backdrop-blur-sm">
        <div className="w-full bg-white rounded-t-[32px] p-8 shadow-2xl animate-[slideUp_0.3s_ease-out]">
          <h2 className="text-2xl font-bold mb-6 text-center">Masuk ke Tenangin</h2>
          
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-4 rounded-[24px] font-medium text-lg mb-6 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <IconGoogle />
            Lanjut dengan Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-gray-400 text-sm">atau email</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <div className="space-y-4">
             <Input 
                type="email" 
                placeholder="Email kamu" 
                value={authEmail} 
                onChange={(e: any) => setAuthEmail(e.target.value)} 
            />
             <Input 
                type="password" 
                placeholder="Password" 
                value={authPassword} 
                onChange={(e: any) => setAuthPassword(e.target.value)} 
            />
             {authError && <p className="text-red-500 text-sm px-2 text-center">{authError}</p>}
             <Button onClick={handleEmailAuth} variant="primary">
                {isRegistering ? "Daftar Akun" : "Masuk"}
             </Button>
             <div className="text-center mt-4">
                <button onClick={() => setIsRegistering(!isRegistering)} className="text-appleBlue text-sm font-medium">
                    {isRegistering ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
                </button>
             </div>
             <button onClick={() => setView(AppView.LANDING)} className="w-full text-center text-gray-400 text-sm mt-4">Batal</button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Onboarding View
  if (view === AppView.ONBOARDING) {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col justify-end max-w-lg mx-auto">
        <div className="flex-1 overflow-y-auto pb-6 space-y-6">
           <div className="flex gap-3">
             <div className="w-10 h-10 rounded-full bg-appleBlue flex items-center justify-center text-white">
                <IconSparkles className="w-6 h-6" />
             </div>
             <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-[80%]">
               <p className="text-lg">Halo. Nama tokomu apa?</p>
             </div>
           </div>
           
           {shopName && (
             <div className="flex gap-3 justify-end">
                <div className="bg-appleBlue text-white p-4 rounded-2xl rounded-tr-none max-w-[80%]">
                    <p className="text-lg">{shopName}</p>
                </div>
             </div>
           )}

           {onboardingStep === 1 && (
             <div className="flex gap-3 animate-fade-in">
               <div className="w-10 h-10 rounded-full bg-appleBlue flex items-center justify-center text-white">
                  <IconSparkles className="w-6 h-6" />
               </div>
               <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-[80%]">
                 <p className="text-lg">Oke, {shopName}. Kamu jualan apa?</p>
               </div>
             </div>
           )}
        </div>

        <form onSubmit={handleOnboardingSubmit} className="relative">
           <Input 
             value={onboardingInput} 
             onChange={(e: any) => setOnboardingInput(e.target.value)} 
             placeholder="Ketik jawaban..." 
             className="pr-12"
           />
           <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-appleBlue">
             <IconSend className="w-6 h-6" />
           </button>
        </form>
      </div>
    );
  }

  // 4. Dashboard View
  return (
    <div className={`min-h-screen transition-colors duration-700 ${dayMode === DayMode.NIGHT ? 'bg-darkCharcoal text-white' : 'bg-offWhite text-black'}`}>
      
      {/* Header (Simplified, No Toggle) */}
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-20 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight">Tenangin</h1>
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="User" /> : <div className="w-full h-full bg-gradient-to-br from-blue-400 to-green-400" />}
            </div>
            <button onClick={() => signOut(auth)} className="text-sm opacity-50">Keluar</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-6 pb-32 max-w-lg mx-auto min-h-screen flex flex-col">
        
        {/* DAY MODE: Input Focused */}
        {dayMode === DayMode.DAY && (
            <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.5s]">
                <div className="mb-8">
                    <h2 className="text-4xl font-semibold mb-2 text-gray-300">Siang,</h2>
                    <h2 className="text-4xl font-bold">{userProfile?.shopName || 'Bos'}</h2>
                </div>
                
                <form onSubmit={handleTransactionSubmit} className="w-full relative">
                    <Input 
                        value={inputText}
                        onChange={(e: any) => setInputText(e.target.value)}
                        placeholder="Ada jualan apa hari ini?"
                        className="py-6 text-xl shadow-lg border-none"
                    />
                    <div className="mt-4 flex gap-2 overflow-x-auto text-sm text-gray-400 pb-2">
                        <span className="bg-white/50 px-3 py-1 rounded-full whitespace-nowrap">minyak 2L 32rb</span>
                        <span className="bg-white/50 px-3 py-1 rounded-full whitespace-nowrap">telur 1kg 28rb</span>
                    </div>
                </form>

                {/* Recent Transactions List */}
                <div className="mt-12">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-4">Barusan</h3>
                    <div className="space-y-3">
                        {transactions.slice(0, 5).map((tx) => (
                            <div key={tx.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                <div>
                                    <p className="font-medium">{tx.itemName}</p>
                                    <p className="text-xs text-gray-400">{tx.quantity} x {tx.price.toLocaleString()}</p>
                                </div>
                                <p className="font-semibold text-appleBlue">Rp {tx.total.toLocaleString()}</p>
                            </div>
                        ))}
                         {transactions.length === 0 && <p className="text-gray-400 italic">Belum ada transaksi hari ini.</p>}
                    </div>
                </div>
            </div>
        )}

        {/* NIGHT MODE: Insight Focused (No Input) */}
        {dayMode === DayMode.NIGHT && (
            <div className="flex-1 flex flex-col gap-6 pt-10 animate-[fadeIn_0.5s]">
                {/* 1. Empathy Card */}
                <div className="p-8 rounded-[32px] bg-white/10 backdrop-blur-md border border-white/5 shadow-2xl">
                    <IconSparkles className="w-8 h-8 text-yellow-400 mb-4 opacity-80" />
                    <p className="text-2xl font-light leading-relaxed text-white/90">
                        "{nightInsight?.empathyMessage || "Hari ini kamu sudah usaha keras. Istirahatlah."}"
                    </p>
                </div>

                {/* 2. Verdict Card */}
                <div className={`p-8 rounded-[32px] ${nightInsight?.status === 'green' ? 'bg-successGreen/20 text-successGreen' : 'bg-yellow-500/20 text-yellow-400'} backdrop-blur-md border border-white/5 shadow-xl`}>
                    <p className="text-sm uppercase tracking-widest opacity-70 mb-2">Verdict Hari Ini</p>
                    <h3 className="text-4xl font-bold">{nightInsight?.verdict || "Memproses..."}</h3>
                </div>

                {/* 3. Revenue Card */}
                <div className="p-8 rounded-[32px] bg-darkCharcoal border border-white/10 shadow-xl">
                    <p className="text-sm text-gray-400 uppercase tracking-widest mb-2">Untung Kotor Hari Ini</p>
                    <h3 className="text-5xl font-bold text-white">
                        Rp {transactions.reduce((acc, curr) => acc + curr.total, 0).toLocaleString('id-ID')}
                    </h3>
                    <p className="text-gray-500 mt-2">{transactions.length} Transaksi tercatat.</p>
                </div>
            </div>
        )}

      </main>

      {/* Floating Action Button for Chat */}
      <button 
        onClick={() => setShowChat(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-appleBlue rounded-full shadow-apple hover:shadow-apple-hover flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 z-30"
      >
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
          </span>
          <IconSparkles className="w-8 h-8" />
      </button>

      {/* Chat Interface Modal */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => setShowChat(false)}></div>
            <div className="bg-white dark:bg-darkCharcoal w-full max-w-md h-[80vh] sm:rounded-[32px] rounded-t-[32px] shadow-2xl pointer-events-auto flex flex-col overflow-hidden transition-transform transform translate-y-0">
                
                {/* Chat Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-white/80 dark:bg-darkCharcoal/80 backdrop-blur-xl">
                    <div>
                        <h3 className="font-bold text-lg dark:text-white">Tenangin AI</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Teman curhat usahamu</p>
                    </div>
                    <button onClick={() => setShowChat(false)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-offWhite dark:bg-[#151516]">
                    {chatMessages.length === 0 && (
                        <div className="text-center text-gray-400 mt-10">
                            <p>Halo, ada yang bikin pikiranmu berat hari ini?</p>
                        </div>
                    )}
                    {chatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl ${
                                msg.role === 'user' 
                                ? 'bg-appleBlue text-white rounded-br-sm' 
                                : 'bg-white dark:bg-gray-800 dark:text-gray-200 shadow-sm rounded-bl-sm'
                            }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                             <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-bl-sm shadow-sm flex gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                             </div>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 bg-white dark:bg-darkCharcoal border-t border-gray-200 dark:border-gray-800">
                    <form onSubmit={handleChatSubmit} className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Cerita aja..."
                            className="w-full pl-6 pr-14 py-4 rounded-[24px] bg-gray-100 dark:bg-gray-800 dark:text-white border-none focus:ring-2 focus:ring-appleBlue/50"
                        />
                        <button 
                            type="submit" 
                            disabled={!chatInput.trim() || isTyping}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-appleBlue text-white rounded-full disabled:opacity-50"
                        >
                            <IconSend className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-darkCharcoal/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-xl z-50 animate-bounce">
              <p className="text-sm font-medium">{toastMessage}</p>
          </div>
      )}
    </div>
  );
}