/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  AlarmClock, 
  Mic, 
  BarChart3, 
  Settings, 
  Menu, 
  Plus, 
  ChevronRight, 
  Moon, 
  Sun, 
  Play, 
  Trash2, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Sparkles,
  Volume2,
  Thermometer,
  MessageSquare,
  AlignLeft,
  Zap,
  User,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, collection, onSnapshot, deleteDoc, updateDoc } from './firebase';
import type { User as FirebaseUser } from 'firebase/auth';

// --- Types ---

type View = 'welcome' | 'alarms' | 'edit' | 'insights' | 'recording' | 'settings' | 'awakening' | 'login' | 'profile';

interface Alarm {
  id: string;
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  label: string;
  task: string;
  days: string[];
  active: boolean;
  tone: string;
  volume: number;
}

// --- Components ---

const Waveform = ({ active = false, color = "bg-secondary" }: { active?: boolean, color?: string }) => {
  return (
    <div className="flex items-end justify-center gap-1 h-12">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-1.5 rounded-full ${color}`}
          animate={active ? {
            height: [12, 32, 16, 40, 20, 12][(i % 6)],
            opacity: [0.4, 1, 0.6, 1, 0.5, 0.4][(i % 6)]
          } : { height: 8, opacity: 0.3 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

const BottomNav = ({ currentView, setView }: { currentView: View, setView: (v: View) => void }) => {
  const navItems = [
    { id: 'alarms', icon: AlarmClock, label: 'Alarms' },
    { id: 'recording', icon: Mic, label: 'Record' },
    { id: 'insights', icon: BarChart3, label: 'Insights' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-2xl rounded-t-[2rem] shadow-[0_-8px_32px_rgba(26,35,126,0.08)] px-4 pb-8 pt-4 flex justify-around items-center">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300 ${
              isActive ? 'text-secondary bg-secondary-container/20 scale-110' : 'text-outline-variant hover:text-secondary'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} fill={isActive ? "currentColor" : "none"} />
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const TopBar = ({ onMenuClick, onProfileClick, user }: { onMenuClick?: () => void, onProfileClick?: () => void, user: FirebaseUser | null }) => (
  <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
    <div className="flex items-center gap-4">
      <button onClick={onMenuClick} className="text-primary hover:bg-surface-container-low p-2 rounded-full transition-colors">
        <Menu size={24} />
      </button>
      <h1 className="text-2xl font-extrabold tracking-tighter text-primary">VocaDo</h1>
    </div>
    <button onClick={onProfileClick} className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed-dim shadow-sm hover:opacity-80 transition-opacity bg-surface-container-high flex items-center justify-center text-primary">
      {user?.photoURL ? (
        <img 
          src={user.photoURL} 
          alt="User" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <User size={20} />
      )}
    </button>
  </header>
);

const SideMenu = ({ isOpen, onClose, onNavigate, user }: { isOpen: boolean, onClose: () => void, onNavigate: (v: View) => void, user: FirebaseUser | null }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
        />
        <motion.div 
          initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 h-full w-3/4 max-w-sm bg-surface z-[70] shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-outline-variant flex items-center gap-4 pt-12">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary bg-surface-container-high flex items-center justify-center text-primary">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-on-surface">{user?.displayName || 'VocaDo User'}</h3>
              <p className="text-xs text-on-surface-variant">{user?.email || 'Not signed in'}</p>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <button onClick={() => { onNavigate('alarms'); onClose(); }} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container-low text-on-surface font-semibold transition-colors">
              <AlarmClock size={20} className="text-primary" /> Alarms
            </button>
            <button onClick={() => { onNavigate('recording'); onClose(); }} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container-low text-on-surface font-semibold transition-colors">
              <Mic size={20} className="text-primary" /> Record
            </button>
            <button onClick={() => { onNavigate('insights'); onClose(); }} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container-low text-on-surface font-semibold transition-colors">
              <BarChart3 size={20} className="text-primary" /> Insights
            </button>
            <button onClick={() => { onNavigate('settings'); onClose(); }} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container-low text-on-surface font-semibold transition-colors">
              <Settings size={20} className="text-primary" /> Settings
            </button>
          </div>
          <div className="mt-auto p-6">
            <button onClick={() => { onNavigate('welcome'); onClose(); }} className="w-full py-3 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors">
              Log Out
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Views ---

const WelcomeView = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen flex flex-col items-center justify-between p-8 bg-gradient-to-br from-surface via-surface to-secondary-container/10 relative overflow-hidden">
    <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
    <div className="absolute top-1/2 -right-20 w-80 h-80 bg-secondary/5 rounded-full blur-[80px]" />
    
    <div className="w-full max-w-md flex flex-col items-center mt-12 space-y-12 relative z-10">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <div className="absolute inset-0 border-[6px] border-primary/5 rounded-full" />
        <div className="absolute inset-4 border-[2px] border-secondary/10 rounded-full" />
        <div className="relative flex items-end justify-center gap-1.5 h-16">
          <div className="w-2 h-6 bg-primary rounded-full" />
          <div className="w-2 h-10 bg-primary/40 rounded-full" />
          <div className="w-2 h-16 bg-primary rounded-full relative">
            <CheckCircle2 className="absolute -top-10 left-1/2 -translate-x-1/2 text-4xl text-primary" size={32} />
          </div>
          <div className="w-2 h-10 bg-secondary/40 rounded-full" />
          <div className="w-2 h-6 bg-secondary rounded-full" />
        </div>
      </div>

      <div className="text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight leading-[1.1] text-on-surface">
          Wake up to <span className="text-primary italic">your</span> favorite voice.
        </h1>
        <p className="text-on-surface-variant text-lg max-w-[280px] mx-auto leading-relaxed">
          A professional digital companion for a calm transition from sleep to productivity.
        </p>
      </div>
    </div>

    <div className="w-full max-w-md pb-12 relative z-10">
      <button 
        onClick={onStart}
        className="w-full indigo-calm-gradient text-white font-bold text-xl py-5 rounded-full shadow-[0_8px_32px_rgba(0,6,102,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        Get Started
        <ArrowRight size={24} />
      </button>
      <div className="mt-8 text-center">
        <p className="text-on-surface-variant text-sm font-medium">
          Already using VocaDo? <button className="text-primary font-bold hover:underline">Log in</button>
        </p>
      </div>
    </div>
  </div>
);

const AlarmsView = ({ alarms, onEdit, onToggle, onTestWake }: { alarms: Alarm[], onEdit: (a?: Alarm) => void, onToggle: (id: string) => void, onTestWake: (a: Alarm) => void }) => {
  const nextAlarm = alarms.find(a => a.active) || alarms[0];

  return (
    <div className="px-6 pt-24 pb-32 space-y-10 max-w-2xl mx-auto">
      <section className="relative overflow-hidden rounded-2xl p-10 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100/50 shadow-sm">
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-indigo-400 font-bold tracking-[0.2em] text-[10px] mb-6 uppercase">Next Awakening</p>
          <div className="relative mb-6">
            <h2 className="text-7xl font-extrabold text-primary tracking-tighter flex items-baseline gap-2">
              {nextAlarm ? `${nextAlarm.hour}:${nextAlarm.minute}` : '--:--'} <span className="text-2xl font-bold opacity-30">{nextAlarm?.period || ''}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2.5 text-indigo-700 bg-white/60 border border-indigo-100 px-5 py-2.5 rounded-full backdrop-blur-xl shadow-sm">
            <Sun size={18} />
            <span className="text-sm font-semibold tracking-tight">{nextAlarm ? `${nextAlarm.label} • Tomorrow` : 'No active alarms'}</span>
          </div>
          {nextAlarm && (
            <button onClick={() => onTestWake(nextAlarm)} className="mt-4 text-xs font-bold text-primary/60 hover:text-primary underline underline-offset-4 transition-colors">
              Test Wake Screen
            </button>
          )}
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg text-on-surface">My Alarms</h3>
          <span className="text-xs font-semibold text-primary/70">{alarms.length} TOTAL</span>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {alarms.map(alarm => (
            <div 
              key={alarm.id}
              className={`p-6 rounded-xl flex flex-col justify-between min-h-[160px] border transition-all duration-300 hover:shadow-lg ${
                alarm.active ? 'bg-surface border-slate-200 shadow-sm' : 'bg-surface-container-low border-slate-200 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col cursor-pointer" onClick={() => onEdit(alarm)}>
                  <span className="text-4xl font-bold text-on-surface tracking-tight">
                    {alarm.hour}:{alarm.minute} <span className="text-base font-semibold opacity-30 uppercase">{alarm.period}</span>
                  </span>
                  <span className="text-sm text-on-surface-variant font-medium mt-1">{alarm.label}</span>
                </div>
                <div 
                  onClick={() => onToggle(alarm.id)}
                  className={`w-12 h-6.5 rounded-full relative transition-colors cursor-pointer ${alarm.active ? 'bg-secondary' : 'bg-outline-variant'}`}
                >
                  <div className={`absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-sm transition-all ${alarm.active ? 'right-[3px]' : 'left-[3px]'}`} />
                </div>
              </div>
              <div className="flex gap-1.5 mt-8 cursor-pointer" onClick={() => onEdit(alarm)}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                  const isScheduled = alarm.days.includes(day);
                  return (
                    <span 
                      key={i} 
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        isScheduled ? 'bg-secondary text-white' : 'bg-surface-container-high text-outline-variant'
                      }`}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="bg-primary text-white rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] font-bold text-primary-fixed tracking-[0.15em] uppercase">Weekly Pulse</span>
          <BarChart3 size={20} className="text-primary-fixed" />
        </div>
        <p className="text-xl font-bold text-white leading-snug mb-8">
          Wake-up consistency is up <span className="text-secondary-container font-extrabold">12%</span> this week.
        </p>
        <div className="h-20 w-full flex items-end justify-between px-2">
          {[30, 50, 45, 70, 60, 85, 100].map((h, i) => (
            <div 
              key={i} 
              className={`w-7 rounded-t-lg transition-all ${i >= 5 ? 'bg-secondary-container' : 'bg-white/10'}`} 
              style={{ height: `${h}%` }} 
            />
          ))}
        </div>
      </section>

      <button 
        onClick={() => onEdit()}
        className="fixed right-6 bottom-32 w-14 h-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all hover:bg-primary/90 z-40"
      >
        <Plus size={32} strokeWidth={3} />
      </button>
    </div>
  );
};

const TONES = [
  { name: 'Ocean Mist', desc: 'Soft rolling waves', icon: Volume2, url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_783d1a0e02.mp3?filename=ocean-waves-112906.mp3' },
  { name: 'Forest Rain', desc: 'Gentle droplets', icon: Sun, url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_88444c6c00.mp3?filename=rain-on-leaves-6311.mp3' },
  { name: 'Gentle Breeze', desc: 'Whispering wind', icon: Sun, url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=wind-chimes-in-the-breeze-14137.mp3' },
];

const EditAlarmView = ({ alarm, allAlarms, onSave, onCancel, onDelete }: { alarm?: Alarm, allAlarms: Alarm[], onSave: (a: Alarm) => void, onCancel: () => void, onDelete: (id: string) => void }) => {
  const [hour, setHour] = useState(alarm?.hour || '07');
  const [minute, setMinute] = useState(alarm?.minute || '30');
  const [period, setPeriod] = useState<'AM'|'PM'>(alarm?.period || 'AM');
  const [label, setLabel] = useState(alarm?.label || 'New Alarm');
  const [task, setTask] = useState(alarm?.task || 'Wake up');
  const [selectedTone, setSelectedTone] = useState(alarm?.tone || 'Ocean Mist');
  const [volume, setVolume] = useState(alarm?.volume || 70);
  const [days, setDays] = useState<string[]>(alarm?.days || ['M', 'T', 'W', 'T', 'F']);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleSave = () => {
    onSave({
      id: alarm?.id || Date.now().toString(),
      hour: hour.padStart(2, '0'),
      minute: minute.padStart(2, '0'),
      period,
      label,
      task,
      days,
      active: alarm?.active ?? true,
      tone: selectedTone,
      volume
    });
  };

  const toggleDay = (day: string) => {
    if (days.includes(day)) {
      setDays(days.filter(d => d !== day));
    } else {
      setDays([...days, day]);
    }
  };

  const handlePreview = () => {
    if (isPreviewing) {
      audioRef.current?.pause();
      setIsPreviewing(false);
      return;
    }

    let url = '';
    if (selectedTone === 'Custom Recording' && recordedUrl) {
      url = recordedUrl;
    } else {
      const tone = TONES.find(t => t.name === selectedTone);
      if (tone) url = tone.url;
    }

    if (url) {
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
      } else {
        audioRef.current.src = url;
      }
      audioRef.current.volume = volume / 100;
      audioRef.current.play();
      setIsPreviewing(true);
      audioRef.current.onended = () => setIsPreviewing(false);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedUrl(audioUrl);
        setSelectedTone('Custom Recording');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse this alarm request: "${aiPrompt}". Current time is ${new Date().toLocaleTimeString()}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hour: { type: Type.STRING, description: "Hour from 01 to 12" },
              minute: { type: Type.STRING, description: "Minute from 00 to 59" },
              period: { type: Type.STRING, description: "AM or PM" },
              label: { type: Type.STRING, description: "Name or label of the alarm" },
              task: { type: Type.STRING, description: "Task for the alarm" },
              tone: { type: Type.STRING, description: "Sound tone, e.g., Ocean Mist, Forest Rain, Gentle Breeze" },
              days: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }, 
                description: "Array of days, e.g. ['M', 'T', 'W', 'T', 'F', 'S', 'S']" 
              }
            }
          }
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      if (data.hour) setHour(data.hour.padStart(2, '0'));
      if (data.minute) setMinute(data.minute.padStart(2, '0'));
      if (data.period) setPeriod(data.period.toUpperCase());
      if (data.label) setLabel(data.label);
      if (data.task) setTask(data.task);
      if (data.tone) setSelectedTone(data.tone);
      if (data.days && Array.isArray(data.days)) setDays(data.days);
      setAiPrompt('');
    } catch (error) {
      console.error("AI parsing error:", error);
      alert("Could not parse the alarm details. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiPrompt(transcript);
    };
    recognition.start();
  };

  return (
    <div className="px-6 pt-24 pb-32 max-w-2xl mx-auto space-y-10">
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="text-primary p-2 rounded-full hover:bg-surface-container-low transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-primary">{alarm ? 'Edit Alarm' : 'New Alarm'}</h1>
        </div>
        <button onClick={onCancel} className="text-primary font-bold text-sm">Reset</button>
      </header>

      <div className="mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Assistant</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={startListening}
            className="bg-surface-container-high text-primary p-3 rounded-xl hover:bg-surface-container-highest transition-colors flex-shrink-0"
            title="Use Voice"
          >
            <Mic size={20} />
          </button>
          <input
            type="text"
            placeholder="e.g., Wake me up at 6:30 AM for Yoga with Forest Rain"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAiSubmit()}
            className="flex-1 bg-surface-container-lowest px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 border border-outline-variant"
          />
          <button
            onClick={handleAiSubmit}
            disabled={isAiLoading || !aiPrompt.trim()}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex-shrink-0"
          >
            {isAiLoading ? '...' : 'Set'}
          </button>
        </div>
      </div>

      <section className="relative text-center">
        <div className="w-full aspect-video rounded-3xl overflow-hidden relative bg-surface-container-low mb-8 shadow-sm">
          <img 
            src="https://picsum.photos/seed/calm/800/450" 
            alt="Calm sky" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        </div>
        
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <div className="text-[5.5rem] font-extrabold tracking-tighter text-on-surface leading-none tabular-nums flex items-center">
              <input type="text" maxLength={2} value={hour} onChange={e => setHour(e.target.value.replace(/\D/g, ''))} className="w-28 bg-transparent text-center focus:outline-none focus:bg-surface-container-lowest/50 rounded-xl" />
              <span className="text-primary/20 scale-75 mx-1">:</span>
              <input type="text" maxLength={2} value={minute} onChange={e => setMinute(e.target.value.replace(/\D/g, ''))} className="w-28 bg-transparent text-center focus:outline-none focus:bg-surface-container-lowest/50 rounded-xl" />
            </div>
          </div>
          <div className="mt-6 inline-flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant">
            <button onClick={() => setPeriod('AM')} className={`px-6 py-2 rounded-xl font-bold text-sm transition-colors ${period === 'AM' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-lowest'}`}>AM</button>
            <button onClick={() => setPeriod('PM')} className={`px-6 py-2 rounded-xl font-bold text-sm transition-colors ${period === 'PM' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-lowest'}`}>PM</button>
          </div>
        </div>
      </section>

      <div className="space-y-8">
        <div className="space-y-4">
          <label className="block text-[13px] font-bold text-primary/80 ml-1 uppercase tracking-wider">Repeat Days</label>
          <div className="flex justify-between gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
              const isScheduled = days.includes(day);
              return (
                <button 
                  key={i} 
                  onClick={() => toggleDay(day)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition-all ${
                    isScheduled ? 'bg-secondary text-white shadow-md' : 'bg-surface-container-low text-outline-variant hover:bg-surface-container-high'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="block text-[13px] font-bold text-primary/80 ml-1 uppercase tracking-wider">Your Name / Label</label>
            <input 
              type="text" 
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full h-14 px-5 bg-surface-container-low border border-outline-variant rounded-2xl text-on-surface font-semibold focus:border-primary/40 focus:ring-0 focus:bg-surface-container-lowest transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[13px] font-bold text-primary/80 ml-1 uppercase tracking-wider">Task for the alarm</label>
            <input 
              type="text" 
              value={task}
              onChange={e => setTask(e.target.value)}
              className="w-full h-14 px-5 bg-surface-container-low border border-outline-variant rounded-2xl text-on-surface font-semibold focus:border-primary/40 focus:ring-0 focus:bg-surface-container-lowest transition-all"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="block text-[13px] font-bold text-primary/80 uppercase tracking-wider">Sound Selection</label>
            <button 
              onClick={handlePreview}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                isPreviewing 
                  ? 'bg-secondary text-white shadow-lg scale-105' 
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {isPreviewing ? (
                <>
                  <div className="flex gap-0.5">
                    <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-white" />
                    <motion.div animate={{ height: [10, 4, 10] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-white" />
                    <motion.div animate={{ height: [6, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-white" />
                  </div>
                  Stop Preview
                </>
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  Preview Sound
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {TONES.map((tone, i) => (
              <div 
                key={i}
                onClick={() => {
                  setSelectedTone(tone.name);
                  if (isPreviewing) {
                    audioRef.current?.pause();
                    setIsPreviewing(false);
                  }
                }}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer border ${
                  selectedTone === tone.name 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'bg-surface-container-low border-transparent hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTone === tone.name ? 'bg-primary text-white' : 'bg-primary/5 text-primary/40'}`}>
                    {isPreviewing && selectedTone === tone.name ? (
                      <div className="flex gap-0.5 items-end h-4">
                        <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-white rounded-full" />
                        <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-white rounded-full" />
                        <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-white rounded-full" />
                      </div>
                    ) : (
                      <tone.icon size={20} />
                    )}
                  </div>
                  <div>
                    <p className={`font-bold ${selectedTone === tone.name ? 'text-primary' : 'text-on-surface'}`}>{tone.name}</p>
                    <p className="text-xs text-on-surface-variant/60">{tone.desc}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedTone === tone.name ? 'border-primary' : 'border-outline-variant'}`}>
                  {selectedTone === tone.name && <div className="w-3 h-3 rounded-full bg-primary" />}
                </div>
              </div>
            ))}
            
            {recordedUrl && (
              <div 
                onClick={() => {
                  setSelectedTone('Custom Recording');
                  if (isPreviewing) {
                    audioRef.current?.pause();
                    setIsPreviewing(false);
                  }
                }}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer border ${
                  selectedTone === 'Custom Recording' 
                    ? 'bg-primary/5 border-primary shadow-sm' 
                    : 'bg-surface-container-low border-transparent hover:bg-surface-container-high'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTone === 'Custom Recording' ? 'bg-primary text-white' : 'bg-primary/5 text-primary/40'}`}>
                    {isPreviewing && selectedTone === 'Custom Recording' ? (
                      <div className="flex gap-0.5 items-end h-4">
                        <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-white rounded-full" />
                        <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-white rounded-full" />
                        <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-white rounded-full" />
                      </div>
                    ) : (
                      <Mic size={20} />
                    )}
                  </div>
                  <div>
                    <p className={`font-bold ${selectedTone === 'Custom Recording' ? 'text-primary' : 'text-on-surface'}`}>Custom Recording</p>
                    <p className="text-xs text-on-surface-variant/60">Your recorded sound</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedTone === 'Custom Recording' ? 'border-primary' : 'border-outline-variant'}`}>
                  {selectedTone === 'Custom Recording' && <div className="w-3 h-3 rounded-full bg-primary" />}
                </div>
              </div>
            )}

            <button 
              onClick={toggleRecording}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                isRecording ? 'bg-red-50 border-red-200' : 'bg-surface-container-low border-dashed border-outline-variant hover:bg-surface-container-high'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-primary/5 text-primary/40'}`}>
                  <Mic size={20} />
                </div>
                <div className="text-left">
                  <p className={`font-bold ${isRecording ? 'text-red-600' : 'text-on-surface'}`}>
                    {isRecording ? 'Recording...' : recordedUrl ? 'Re-record Custom Sound' : 'Record Custom Sound'}
                  </p>
                  <p className="text-xs text-on-surface-variant/60">
                    {isRecording ? 'Tap to stop' : 'Use your own voice or music'}
                  </p>
                </div>
              </div>
              {!isRecording && <Plus size={20} className="text-outline-variant" />}
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6 bg-surface-container-low rounded-3xl border border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[13px] font-bold text-primary/80 uppercase tracking-wider">Alarm Volume</label>
            <span className="text-sm font-bold text-primary">{volume}%</span>
          </div>
          <div className="flex items-center gap-4">
            <Volume2 size={20} className="text-primary/40" />
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume} 
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="flex-1 h-2 bg-primary/10 rounded-full appearance-none cursor-pointer accent-primary"
            />
            <Volume2 size={20} className="text-primary" />
          </div>
          <p className="text-[10px] text-on-surface-variant font-medium italic">
            Volume will gradually increase over 30 seconds for a gentle awakening.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block text-[13px] font-bold text-primary/80 ml-1 uppercase tracking-wider">Voice Interaction</label>
          <div className="flex p-1.5 bg-surface-container-low rounded-3xl border border-outline-variant shadow-inner">
            <button className="flex-1 flex items-center justify-center gap-3 h-14 rounded-2xl bg-surface-container-lowest shadow-sm text-primary font-bold border border-primary/10">
              <Sparkles size={20} fill="currentColor" />
              AI Voice
            </button>
            <button className="flex-1 flex items-center justify-center gap-3 h-14 rounded-2xl text-on-surface-variant font-bold hover:bg-surface-container-lowest/50">
              <Mic size={20} />
              Record
            </button>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-5 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Volume2 size={24} />
              </div>
              <div>
                <p className="text-[11px] font-extrabold text-primary/60 uppercase tracking-[0.1em]">AI Generator</p>
                <p className="text-base font-bold text-primary">VocaDo Voice 2.0</p>
              </div>
            </div>
            <button className="px-5 h-10 rounded-full bg-surface-container-lowest text-secondary font-bold text-sm shadow-sm border border-secondary/10 flex items-center gap-2">
              <Play size={14} fill="currentColor" />
              Preview
            </button>
          </div>
          <div className="p-5 bg-surface-container-lowest/80 backdrop-blur-sm rounded-2xl border border-white/20 text-on-surface leading-relaxed relative z-10">
            <p className="italic font-medium px-4 text-[15px] text-on-surface-variant">
              "Ayan, now it's your breakfast time, please do your breakfast."
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-4 text-left">
        <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Weekly Overview</h3>
        <div className="flex overflow-x-auto gap-3 pb-4 snap-x px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => {
            const dayAlarms = allAlarms.filter(a => a.active && a.days.includes(day));
            return (
              <div key={index} className="min-w-[140px] bg-surface-container-low p-4 rounded-2xl snap-start flex flex-col gap-3 border border-outline-variant/30">
                <div className="font-bold text-primary text-sm">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}</div>
                <div className="flex flex-col gap-2">
                  {dayAlarms.length > 0 ? (
                    dayAlarms.map(a => (
                      <div key={a.id} className="text-xs bg-surface-container-lowest/60 p-2.5 rounded-xl border border-outline-variant/50 shadow-sm">
                        <div className="font-bold text-primary mb-0.5">{a.hour}:{a.minute} {a.period}</div>
                        <div className="text-on-surface-variant truncate font-medium">{a.label}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-on-surface-variant/50 italic py-2">No alarms</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="pt-6 space-y-4 pb-12">
        <button 
          onClick={handleSave}
          className="w-full h-16 indigo-calm-gradient text-white font-bold text-lg rounded-3xl shadow-xl active:scale-[0.97] transition-all"
        >
          Save Changes
        </button>
        {alarm && (
          <button 
            onClick={() => onDelete(alarm.id)}
            className="w-full h-14 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Delete Alarm
          </button>
        )}
        <button 
          onClick={onCancel}
          className="w-full h-14 text-on-surface-variant font-bold rounded-2xl hover:text-red-500 transition-colors text-sm"
        >
          Discard Changes
        </button>
      </div>
    </div>
  );
};

const InsightsView = ({ user, alarms }: { user: FirebaseUser | null, alarms: Alarm[] }) => {
  const [bedtime, setBedtime] = useState('22:30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchBedtime = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.preferences?.bedtime) {
            setBedtime(data.preferences.bedtime);
          }
        }
      } catch (error) {
        console.error('Error fetching bedtime:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBedtime();
  }, [user]);

  const activeAlarms = alarms.filter(a => a.active);
  let nextAlarm: Alarm | null = null;
  
  if (activeAlarms.length > 0) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let minDiff = Infinity;
    activeAlarms.forEach(a => {
      let h = parseInt(a.hour);
      if (a.period === 'PM' && h !== 12) h += 12;
      if (a.period === 'AM' && h === 12) h = 0;
      const alarmMinutes = h * 60 + parseInt(a.minute);
      
      let diff = alarmMinutes - currentMinutes;
      if (diff < 0) diff += 24 * 60;
      
      if (diff < minDiff) {
        minDiff = diff;
        nextAlarm = a;
      }
    });
  }

  let timeInBedStr = '--h --m';
  let actualSleepStr = '--h --m';
  let sleepQuality = 0;
  let sleepQualityText = 'No data';
  let insightMessage = "Set an active alarm and a target bedtime to see your sleep insights.";

  if (nextAlarm) {
    let h = parseInt(nextAlarm.hour);
    if (nextAlarm.period === 'PM' && h !== 12) h += 12;
    if (nextAlarm.period === 'AM' && h === 12) h = 0;
    const wakeMinutes = h * 60 + parseInt(nextAlarm.minute);
    
    const [bedH, bedM] = bedtime.split(':').map(Number);
    const bedMinutes = bedH * 60 + bedM;
    
    let durationMinutes = wakeMinutes - bedMinutes;
    if (durationMinutes < 0) durationMinutes += 24 * 60;
    
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    
    timeInBedStr = `${hours}h ${mins}m`;
    
    const actualMinutes = Math.floor(durationMinutes * 0.9);
    const actualHours = Math.floor(actualMinutes / 60);
    const actualMins = actualMinutes % 60;
    actualSleepStr = `${actualHours}h ${actualMins}m`;
    
    sleepQuality = Math.min(100, Math.round((durationMinutes / (8 * 60)) * 100));
    if (sleepQuality > 90) sleepQualityText = 'restorative';
    else if (sleepQuality > 70) sleepQualityText = 'good';
    else if (sleepQuality > 50) sleepQualityText = 'fair';
    else sleepQualityText = 'poor';
    
    insightMessage = `Based on your target bedtime of ${bedtime} and your next alarm at ${nextAlarm.hour}:${nextAlarm.minute} ${nextAlarm.period}, you're on track for a ${sleepQualityText} night's sleep.`;
  }

  if (loading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
  <div className="px-6 pt-24 pb-32 max-w-lg mx-auto min-h-screen">
    <section className="mb-10">
      <p className="text-secondary font-semibold tracking-widest text-[11px] uppercase mb-2">Morning Reflection</p>
      <h2 className="text-4xl font-extrabold tracking-tight text-primary leading-tight">Your Sleep <br/>Insights.</h2>
    </section>

    <section className="mb-8 relative group">
      <div className="relative bg-surface-container-lowest p-8 rounded-xl shadow-sm border-l-4 border-secondary">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-on-surface-variant font-bold text-lg">Sleep Quality</h3>
            <p className="text-secondary font-medium">{sleepQuality}% • {sleepQualityText}</p>
          </div>
          <div className="bg-secondary/10 p-3 rounded-full text-secondary">
            <Moon size={24} fill="currentColor" />
          </div>
        </div>
        <div className="flex items-end gap-1 mb-6">
          <span className="text-7xl font-extrabold tracking-tighter text-primary">{sleepQuality}</span>
          <span className="text-2xl font-bold text-primary/30 mb-2">%</span>
        </div>
        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
          <div className={`bg-gradient-to-r from-secondary to-secondary-container h-full rounded-full`} style={{ width: `${sleepQuality}%` }} />
        </div>
        <p className="mt-6 text-on-surface-variant text-sm leading-relaxed italic">
          "{insightMessage}"
        </p>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-4 mb-8">
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between aspect-square">
        <Sun className="text-primary/40 mb-4" size={24} />
        <div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-1">Time in Bed</p>
          <p className="text-2xl font-extrabold text-primary">{timeInBedStr}</p>
        </div>
      </div>
      <div className="bg-secondary/5 p-6 rounded-xl flex flex-col justify-between aspect-square border border-secondary/10">
        <Sparkles className="text-secondary mb-4" size={24} />
        <div>
          <p className="text-secondary font-bold uppercase tracking-wider text-[10px] mb-1">Actual Sleep</p>
          <p className="text-2xl font-extrabold text-secondary">{actualSleepStr}</p>
        </div>
      </div>
    </div>

    <section className="bg-primary p-8 rounded-xl overflow-hidden relative group cursor-pointer transition-transform active:scale-[0.98]">
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-secondary/20 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-secondary-container" />
          <h4 className="text-white font-bold text-sm tracking-wide uppercase">Sleep Architect</h4>
        </div>
        <p className="text-primary-fixed text-xl font-medium leading-tight mb-6">
          Consistency is your superpower. Try to maintain your target bedtime of {bedtime} this week.
        </p>
        <div className="flex items-center gap-4">
          <button className="bg-secondary text-white px-5 py-2 rounded-lg font-bold text-sm">View Analysis</button>
          <span className="text-secondary-container text-xs font-bold">New Report Available</span>
        </div>
      </div>
    </section>
  </div>
  );
};

const RecordingView = ({ user, onSave, onDiscard }: { user: FirebaseUser | null, onSave: () => void, onDiscard: () => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        setRecordedUrl(null);
        timerRef.current = window.setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access is required to record a voice memo.");
      }
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!audioBlob || !user) return;
    setIsSaving(true);
    try {
      const recordingId = Date.now().toString();
      const storageRef = ref(storage, `users/${user.uid}/recordings/${recordingId}.webm`);
      await uploadBytes(storageRef, audioBlob);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const recordingDocRef = doc(db, `users/${user.uid}/recordings`, recordingId);
      await setDoc(recordingDocRef, {
        id: recordingId,
        url: downloadUrl,
        createdAt: serverTimestamp(),
        name: `Recording ${new Date().toLocaleDateString()}`
      });
      
      onSave();
    } catch (error) {
      console.error("Error saving recording:", error);
      alert("Failed to save recording.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 mt-16 pb-32 px-6 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
      <div className="text-center mb-12 space-y-2">
        <span className="text-secondary font-semibold tracking-widest uppercase text-xs">Voice Memo</span>
        <h2 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">New Awakening</h2>
        <p className="text-on-surface-variant max-w-xs mx-auto text-sm leading-relaxed">Speak your morning intentions. We'll play them back to wake you gently.</p>
      </div>

      <div className="w-full aspect-square md:aspect-video max-h-[400px] bg-surface-container-low rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-tr from-secondary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="mb-8 z-10">
          <span className="text-6xl font-light text-primary tabular-nums tracking-tighter">
            {formatTime(recordingTime)}
          </span>
        </div>
        
        <div className="w-full h-32 flex items-center justify-center gap-1 px-12 z-10">
          <Waveform active={isRecording || isPlaying} color={isRecording ? "bg-red-500" : "bg-secondary-container"} />
        </div>

        <div className="mt-12 flex items-center gap-8 z-10">
          <button onClick={onDiscard} className="flex flex-col items-center gap-2 group">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant group-hover:bg-red-100 group-hover:text-red-500 transition-all">
              <Trash2 size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-60">Discard</span>
          </button>
          
          <button 
            onClick={recordedUrl ? togglePlayback : toggleRecording}
            className={`w-24 h-24 rounded-full p-1 shadow-2xl active:scale-95 transition-transform ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-primary to-primary-container'
            }`}
          >
            <div className="w-full h-full rounded-full bg-background/10 backdrop-blur-sm border-4 border-white/20 flex items-center justify-center text-white">
              {isRecording ? (
                <div className="w-8 h-8 bg-white rounded-lg" />
              ) : recordedUrl ? (
                isPlaying ? <div className="w-8 h-8 bg-white rounded-sm" /> : <Play size={32} fill="currentColor" />
              ) : (
                <Mic size={32} />
              )}
            </div>
          </button>

          <button 
            onClick={handleSave} 
            disabled={!recordedUrl || isSaving}
            className="flex flex-col items-center gap-2 group disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-all">
              {isSaving ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <CheckCircle2 size={20} />}
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-60">Save Recording</span>
          </button>
        </div>
      </div>

      {recordedUrl && (
        <audio 
          ref={audioRef} 
          src={recordedUrl} 
          onEnded={() => setIsPlaying(false)} 
          className="hidden" 
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 w-full">
        <div className="bg-surface-container-low p-6 rounded-[1.5rem] flex items-center justify-between group hover:bg-surface-container transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
              <AlarmClock size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60">Set For</p>
              <p className="text-lg font-bold text-primary">06:30 AM</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-outline-variant group-hover:text-primary transition-colors" />
        </div>
        <div className="bg-surface-container-low p-6 rounded-[1.5rem] flex items-center justify-between group hover:bg-surface-container transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
              <Volume2 size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant opacity-60">Volume</p>
              <p className="text-lg font-bold text-primary">Gentle Rise</p>
            </div>
          </div>
          <div className="flex gap-1">
            <div className="w-1 h-3 bg-secondary rounded-full" />
            <div className="w-1 h-3 bg-secondary rounded-full" />
            <div className="w-1 h-3 bg-secondary/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginView = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user document exists, if not create it
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          preferences: {
            voiceType: 'Zephyr',
            verbosity: 'Normal',
            intensity: 'Gentle'
          }
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
            <User size={40} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">Welcome to VocaDo</h1>
          <p className="text-on-surface-variant">Sign in to sync your alarms and AI preferences across devices.</p>
        </div>

        {error && (
          <div className="p-4 bg-error/10 text-error rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-14 bg-primary text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn size={24} />
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const ProfileView = ({ user, onLogout }: { user: FirebaseUser, onLogout: () => void }) => {
  return (
    <div className="px-6 pt-24 pb-32 max-w-2xl mx-auto space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary-container shadow-xl">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-surface-container-high flex items-center justify-center text-primary">
              <User size={48} />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">{user.displayName || 'VocaDo User'}</h2>
          <p className="text-on-surface-variant">{user.email}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Account Actions</h3>
        <div className="space-y-3">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-5 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors font-bold"
          >
            <div className="flex items-center gap-4">
              <LogOut size={20} />
              <span>Sign Out</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

const SettingsView = ({ user, theme, setTheme }: { user: FirebaseUser | null, theme: 'light' | 'dark', setTheme: (t: 'light' | 'dark') => void }) => {
  const [voiceType, setVoiceType] = useState('Zephyr');
  const [verbosity, setVerbosity] = useState('Normal');
  const [intensity, setIntensity] = useState('Gentle');
  const [bedtime, setBedtime] = useState('22:30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchPreferences = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.preferences) {
            setVoiceType(data.preferences.voiceType || 'Zephyr');
            setVerbosity(data.preferences.verbosity || 'Normal');
            setIntensity(data.preferences.intensity || 'Gentle');
            setBedtime(data.preferences.bedtime || '22:30');
            if (data.preferences.theme) setTheme(data.preferences.theme);
          }
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
  }, [user, setTheme]);

  const handleUpdatePreference = async (key: string, value: string) => {
    if (!user) return;
    
    // Optimistic update
    if (key === 'voiceType') setVoiceType(value);
    if (key === 'verbosity') setVerbosity(value);
    if (key === 'intensity') setIntensity(value);
    if (key === 'bedtime') setBedtime(value);
    if (key === 'theme') setTheme(value as 'light' | 'dark');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`preferences.${key}`]: value
      });
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      // Revert on error could be implemented here
    }
  };

  if (loading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
  <div className="px-6 pt-24 pb-32 max-w-2xl mx-auto space-y-8">
    <section className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-container p-8 text-white shadow-2xl">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-secondary-container/10 blur-3xl rounded-full" />
      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-widest uppercase text-white/60">Currently Selected</span>
          <h2 className="text-4xl font-extrabold tracking-tight">Ocean Mist</h2>
        </div>
        
        <div className="w-full">
          <Waveform active color="bg-secondary-container" />
        </div>

        <div className="flex items-center gap-6 w-full max-w-xs">
          <button className="w-14 h-14 flex items-center justify-center rounded-full bg-white text-primary shadow-lg hover:scale-105 transition-transform">
            <Play size={32} fill="currentColor" />
          </button>
          <div className="flex-1">
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="w-1/2 h-full bg-secondary-container" />
            </div>
          </div>
          <Volume2 size={24} className="text-secondary-container" />
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">AI Assistant Behavior</h3>
      <div className="space-y-3">
        <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h4 className="font-bold text-primary">Preferred Voice</h4>
              <p className="text-xs text-on-surface-variant">The voice used for your morning briefings</p>
            </div>
          </div>
          <div className="flex gap-2">
            {['Zephyr', 'Puck', 'Kore'].map(voice => (
              <button 
                key={voice}
                onClick={() => handleUpdatePreference('voiceType', voice)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                  voiceType === voice 
                    ? 'bg-primary text-white border-primary shadow-md' 
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
              <AlignLeft size={20} />
            </div>
            <div>
              <h4 className="font-bold text-primary">Response Verbosity</h4>
              <p className="text-xs text-on-surface-variant">How detailed the AI's responses should be</p>
            </div>
          </div>
          <div className="flex gap-2">
            {['Concise', 'Normal', 'Detailed'].map(level => (
              <button 
                key={level}
                onClick={() => handleUpdatePreference('verbosity', level)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                  verbosity === level 
                    ? 'bg-secondary text-white border-secondary shadow-md' 
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="font-bold text-primary">Default Alarm Intensity</h4>
              <p className="text-xs text-on-surface-variant">The starting volume and urgency of alarms</p>
            </div>
          </div>
          <div className="flex gap-2">
            {['Gentle', 'Normal', 'Intense'].map(level => (
              <button 
                key={level}
                onClick={() => handleUpdatePreference('intensity', level)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                  intensity === level 
                    ? 'bg-error text-white border-error shadow-md' 
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Sleep Insights</h3>
      <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Moon size={20} />
            </div>
            <div>
              <h4 className="font-bold text-primary">Target Bedtime</h4>
              <p className="text-xs text-on-surface-variant">Used to calculate sleep insights</p>
            </div>
          </div>
          <input 
            type="time" 
            value={bedtime}
            onChange={(e) => handleUpdatePreference('bedtime', e.target.value)}
            className="bg-surface-container-lowest text-primary font-bold px-3 py-2 rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Appearance</h3>
      <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <h4 className="font-bold text-primary">Dark Mode</h4>
              <p className="text-xs text-on-surface-variant">Switch between light and dark themes</p>
            </div>
          </div>
          <button 
            onClick={() => handleUpdatePreference('theme', theme === 'dark' ? 'light' : 'dark')}
            className={`w-14 h-8 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-outline-variant'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>

    <section className="space-y-4">
      <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Voice & Custom</h3>
      <button className="w-full flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl group hover:bg-secondary-container/10 transition-all border border-transparent hover:border-secondary/20">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary text-white">
            <Mic size={24} />
          </div>
          <div className="text-left">
            <h4 className="font-bold text-lg text-primary">Use Custom Recording</h4>
            <p className="text-sm text-on-surface-variant">Wake up to your own voice or a loved one</p>
          </div>
        </div>
        <Plus size={24} className="text-outline-variant group-hover:text-primary transition-colors" />
      </button>
    </section>

    <section className="space-y-4">
      <h3 className="text-sm font-bold text-on-surface-variant tracking-wider uppercase px-2">Ambient Tones</h3>
      <div className="space-y-3">
        {[
          { name: 'Ocean Mist', desc: 'Soft rolling waves with distant gulls', icon: Volume2, selected: true },
          { name: 'Forest Rain', desc: 'Gentle droplets on broad leaves', icon: Sun, selected: false },
          { name: 'Gentle Breeze', desc: 'Whispering wind through pine trees', icon: Sun, selected: false },
          { name: 'Midnight Echo', desc: 'Low frequency harmonic hums', icon: Moon, selected: false },
        ].map((tone, i) => (
          <div 
            key={i}
            className={`flex items-center justify-between p-5 rounded-lg transition-all cursor-pointer ${
              tone.selected ? 'bg-surface-container-lowest border-l-4 border-secondary shadow-sm' : 'bg-surface-container-low hover:bg-surface-container-high'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tone.selected ? 'bg-secondary/10 text-secondary' : 'bg-primary/5 text-primary/40'}`}>
                <tone.icon size={20} />
              </div>
              <div>
                <p className={`font-bold ${tone.selected ? 'text-primary' : 'text-on-surface-variant'}`}>{tone.name}</p>
                <p className="text-xs text-on-surface-variant/60">{tone.desc}</p>
              </div>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${tone.selected ? 'border-secondary' : 'border-outline-variant'}`}>
              {tone.selected && <div className="w-3 h-3 rounded-full bg-secondary" />}
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
  );
};

const AwakeningView = ({ alarm, onDismiss, onSnooze }: { alarm: Alarm, onDismiss: () => void, onSnooze: () => void }) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const tone = TONES.find(t => t.name === alarm.tone) || TONES[0];
    if (tone) {
      const audio = new Audio(tone.url);
      audio.loop = true;
      audio.volume = alarm.volume / 100;
      audio.play().catch(e => console.error("Audio playback failed:", e));
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [alarm]);

  return (
  <div className="fixed inset-0 z-[100] indigo-calm-gradient flex flex-col justify-between items-center px-8 pt-20 pb-12 text-center overflow-hidden">
    <div className="absolute inset-0 opacity-20 mix-blend-overlay">
      <img 
        src="https://picsum.photos/seed/night/1920/1080" 
        alt="Night sky" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
    
    <header className="flex flex-col items-center gap-2 relative z-10">
      <span className="text-white/80 font-bold tracking-[0.25em] text-xs uppercase">VocaDo Awakening</span>
      <div className="h-0.5 w-8 bg-secondary-container/40 rounded-full" />
    </header>

    <section className="flex flex-col items-center gap-6 relative z-10">
      <h1 className="font-extrabold text-[8rem] leading-none tracking-tight text-white drop-shadow-2xl">
        {alarm.hour}:{alarm.minute}
      </h1>
      <div className="glass-panel px-8 py-3 rounded-full border border-white/10 shadow-xl">
        <h2 className="font-bold text-xl text-secondary-container tracking-[0.15em] uppercase">
          {alarm.task}
        </h2>
      </div>
    </section>

    <section className="w-full max-w-sm h-40 flex items-center justify-center gap-2 relative z-10">
      <Waveform active color="bg-secondary-container" />
    </section>

    <section className="w-full max-w-sm flex flex-col gap-5 relative z-10">
      <button 
        onClick={onDismiss}
        className="w-full h-20 rounded-2xl bg-primary text-white shadow-2xl flex items-center justify-center transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10"
      >
        <span className="font-extrabold text-2xl tracking-widest uppercase">Dismiss</span>
      </button>
      <button 
        onClick={onSnooze}
        className="w-full h-18 rounded-2xl glass-panel border border-white/10 flex items-center justify-center transition-all hover:bg-white/10 active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <AlarmClock size={24} className="text-secondary-container" />
          <span className="font-bold text-lg text-white">Snooze for 10m</span>
        </div>
      </button>
    </section>

    <footer className="flex items-center gap-10 relative z-10">
      <div className="flex flex-col items-center gap-1.5">
        <Moon size={24} className="text-white/70" />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.1em]">Moonset 5:12</span>
      </div>
      <div className="h-10 w-[1px] bg-white/10" />
      <div className="flex flex-col items-center gap-1.5">
        <Thermometer size={24} className="text-white/70" />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.1em]">62°F Calm</span>
      </div>
    </footer>

    <div className="fixed top-8 left-8 z-20">
      <div className="w-12 h-12 rounded-full glass-panel border border-white/10 flex items-center justify-center shadow-lg">
        <Mic size={24} className="text-secondary-container" fill="currentColor" />
      </div>
    </div>
  </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>('welcome');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | undefined>();
  const [activeAwakeningAlarm, setActiveAwakeningAlarm] = useState<Alarm | undefined>();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    const fetchTheme = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.preferences?.theme) {
            setTheme(data.preferences.theme);
          }
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
      }
    };
    fetchTheme();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);
  
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  useEffect(() => {
    if (!user) {
      setAlarms([]);
      return;
    }

    const alarmsRef = collection(db, 'users', user.uid, 'alarms');
    const unsubscribe = onSnapshot(alarmsRef, (snapshot) => {
      const fetchedAlarms: Alarm[] = [];
      snapshot.forEach((docSnap) => {
        fetchedAlarms.push(docSnap.data() as Alarm);
      });
      setAlarms(fetchedAlarms);
    }, (error) => {
      console.error('Error fetching alarms:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditAlarm = (alarm?: Alarm) => {
    setSelectedAlarm(alarm);
    setView('edit');
  };

  const handleSaveAlarm = async (updatedAlarm: Alarm) => {
    if (!user) return;
    try {
      const alarmRef = doc(db, 'users', user.uid, 'alarms', updatedAlarm.id);
      await setDoc(alarmRef, updatedAlarm);
      setView('alarms');
      setSelectedAlarm(undefined);
    } catch (error) {
      console.error('Error saving alarm:', error);
    }
  };

  const handleToggleAlarm = async (id: string) => {
    if (!user) return;
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    try {
      const alarmRef = doc(db, 'users', user.uid, 'alarms', id);
      await updateDoc(alarmRef, { active: !alarm.active });
    } catch (error) {
      console.error('Error toggling alarm:', error);
    }
  };

  const handleDeleteAlarm = async (id: string) => {
    if (!user) return;
    try {
      const alarmRef = doc(db, 'users', user.uid, 'alarms', id);
      await deleteDoc(alarmRef);
      setView('alarms');
    } catch (error) {
      console.error('Error deleting alarm:', error);
    }
  };

  const handleStart = () => {
    if (user) {
      setView('alarms');
    } else {
      setView('login');
    }
  };

  const handleTestWake = (alarm: Alarm) => {
    setActiveAwakeningAlarm(alarm);
    setView('awakening');
  };

  const handleSnooze = async () => {
    if (activeAwakeningAlarm && user) {
      let hour = parseInt(activeAwakeningAlarm.hour, 10);
      let minute = parseInt(activeAwakeningAlarm.minute, 10);
      let period = activeAwakeningAlarm.period;

      minute += 10;
      if (minute >= 60) {
        minute -= 60;
        hour += 1;
        if (hour === 12) {
          period = period === 'AM' ? 'PM' : 'AM';
        } else if (hour > 12) {
          hour -= 12;
        }
      }

      const snoozedAlarm: Alarm = {
        ...activeAwakeningAlarm,
        id: Date.now().toString(),
        hour: hour.toString().padStart(2, '0'),
        minute: minute.toString().padStart(2, '0'),
        period,
        label: `${activeAwakeningAlarm.label} (Snoozed)`,
      };

      try {
        const alarmRef = doc(db, 'users', user.uid, 'alarms', snoozedAlarm.id);
        await setDoc(alarmRef, snoozedAlarm);
      } catch (error) {
        console.error('Error saving snoozed alarm:', error);
      }
    }
    setView('alarms');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('welcome');
  };

  const handleProfileClick = () => {
    if (user) {
      setView('profile');
    } else {
      setView('login');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-secondary-container/30">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen"
        >
          {view === 'welcome' && <WelcomeView onStart={handleStart} />}
          {view === 'login' && <LoginView onLoginSuccess={() => setView('alarms')} />}
          
          {view !== 'welcome' && view !== 'login' && view !== 'awakening' && (
            <>
              <TopBar onMenuClick={() => setIsMenuOpen(true)} onProfileClick={handleProfileClick} user={user} />
              <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onNavigate={setView} user={user} />
              {view === 'alarms' && <AlarmsView alarms={alarms} onEdit={handleEditAlarm} onToggle={handleToggleAlarm} onTestWake={handleTestWake} />}
              {view === 'edit' && <EditAlarmView alarm={selectedAlarm} allAlarms={alarms} onSave={handleSaveAlarm} onCancel={() => setView('alarms')} onDelete={handleDeleteAlarm} />}
              {view === 'insights' && <InsightsView user={user} alarms={alarms} />}
              {view === 'recording' && <RecordingView user={user} onSave={() => setView('alarms')} onDiscard={() => setView('alarms')} />}
              {view === 'settings' && <SettingsView user={user} theme={theme} setTheme={setTheme} />}
              {view === 'profile' && user && <ProfileView user={user} onLogout={handleLogout} />}
              <BottomNav currentView={view} setView={setView} />
            </>
          )}

          {view === 'awakening' && <AwakeningView alarm={activeAwakeningAlarm || alarms[0]} onDismiss={() => setView('alarms')} onSnooze={handleSnooze} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
