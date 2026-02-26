import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Upload, 
  Volume2, 
  Type, 
  Languages, 
  Copy, 
  Check, 
  Play, 
  Loader2,
  FileAudio,
  Trash2,
  ArrowRightLeft,
  History,
  Clock,
  ChevronRight,
  Sparkles,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { transcribeAudio, textToSpeech, TranscriptionResult } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Mode = 'stt' | 'tts';
type Language = 'pt' | 'en';

interface HistoryItem {
  id: string;
  type: Mode;
  timestamp: number;
  input: string;
  output: string;
  summary?: string;
  language: Language;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('stt');
  const [language, setLanguage] = useState<Language>('pt');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [shouldTranslate, setShouldTranslate] = useState(false);
  const [inputText, setInputText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('voxconvert_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem('voxconvert_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        setError('O arquivo é muito grande. O limite é 15MB.');
        return;
      }
      processAudio(file);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const transcriptionResult = await transcribeAudio(base64data, blob.type, language, shouldTranslate);
        setResult(transcriptionResult);
        addToHistory({
          type: 'stt',
          input: 'Audio Recording/Upload',
          output: transcriptionResult.text,
          summary: transcriptionResult.summary,
          language
        });
        setIsProcessing(false);
      };
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Erro ao processar o áudio. Tente novamente.');
      setIsProcessing(false);
    }
  };

  const handleTTS = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const base64Audio = await textToSpeech(inputText, language);
      if (base64Audio) {
        const audioBlob = await (await fetch(`data:audio/wav;base64,${base64Audio}`)).blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        addToHistory({
          type: 'tts',
          input: inputText,
          output: 'Audio Generated',
          language
        });
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = url;
          audioPlayerRef.current.play();
        }
      }
      setIsProcessing(false);
    } catch (err) {
      console.error('Error generating speech:', err);
      setError('Erro ao gerar áudio. Tente novamente.');
      setIsProcessing(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'pt' ? 'en' : 'pt');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('voxconvert_history');
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-emerald-100 flex overflow-hidden">
      {/* Sidebar History */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 glass z-50 flex flex-col shadow-premium"
            >
              <div className="p-8 border-b border-black/5 flex justify-between items-center">
                <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
                  <History size={20} className="text-accent" />
                  Histórico
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-black/30 text-sm italic text-center">
                    <History size={40} className="mb-4 opacity-20" />
                    Nenhum registro ainda.
                  </div>
                ) : (
                  history.map(item => (
                    <motion.div 
                      key={item.id} 
                      whileHover={{ x: 4 }}
                      className="p-4 bg-white/50 border border-black/5 rounded-2xl hover:bg-white hover:shadow-premium cursor-pointer transition-all group"
                      onClick={() => {
                        if (item.type === 'stt') {
                          setMode('stt');
                          setResult({ text: item.output, summary: item.summary || '' });
                        } else {
                          setMode('tts');
                          setInputText(item.input);
                        }
                        setShowHistory(false);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-accent/70">
                          {item.type === 'stt' ? 'Audio' : 'Text'}
                        </span>
                        <span className="text-[10px] font-mono opacity-30">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-medium line-clamp-2 opacity-70 group-hover:opacity-100 transition-opacity">
                        {item.type === 'stt' ? item.output : item.input}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
              {history.length > 0 && (
                <div className="p-6 border-t border-black/5">
                  <button 
                    onClick={clearHistory}
                    className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Limpar Histórico
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="px-10 py-6 flex justify-between items-center glass border-b border-black/5 z-30">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowHistory(true)}
              className="p-3 hover:bg-black/5 rounded-2xl transition-all active:scale-90"
            >
              <History size={24} className="text-ink/70" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent text-white flex items-center justify-center rounded-2xl shadow-premium">
                <Volume2 size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">VoxConvert</h1>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-30">Premium Audio Engine</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/50 border border-black/5 rounded-2xl font-mono text-[10px] uppercase tracking-widest">
              <Clock size={14} className="text-accent" />
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-3 px-6 py-2.5 bg-ink text-white rounded-2xl hover:opacity-90 transition-all active:scale-95 font-mono text-[10px] font-bold uppercase tracking-[0.2em] shadow-premium"
            >
              <Languages size={16} />
              <span>{language}</span>
              <ArrowRightLeft size={12} className="opacity-30" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-10 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.03),transparent_40%)]">
          <div className="max-w-7xl mx-auto space-y-10">
            {/* Mode Selector */}
            <div className="flex justify-center">
              <div className="inline-flex p-1.5 bg-white/50 border border-black/5 rounded-3xl shadow-premium">
                <button
                  onClick={() => setMode('stt')}
                  className={cn(
                    "px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-3",
                    mode === 'stt' ? "bg-ink text-white shadow-premium" : "text-ink/40 hover:text-ink"
                  )}
                >
                  <Mic size={16} />
                  Áudio para Texto
                </button>
                <button
                  onClick={() => setMode('tts')}
                  className={cn(
                    "px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-3",
                    mode === 'tts' ? "bg-ink text-white shadow-premium" : "text-ink/40 hover:text-ink"
                  )}
                >
                  <Type size={16} />
                  Texto para Áudio
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Input Panel */}
              <motion.div 
                layout
                className="bg-white rounded-[2.5rem] p-10 border border-black/5 shadow-premium flex flex-col min-h-[550px]"
              >
                <div className="flex justify-between items-center mb-10">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Phase 01</span>
                    <h2 className="font-serif text-2xl font-semibold italic">Entrada de Dados</h2>
                  </div>
                  {mode === 'tts' && inputText && (
                    <button onClick={() => setInputText('')} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                {mode === 'stt' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-12">
                    <div className="relative">
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.6, opacity: 0.1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-red-500 rounded-full"
                          />
                        )}
                      </AnimatePresence>
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing}
                        className={cn(
                          "relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 group",
                          isRecording 
                            ? "bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.3)]" 
                            : "bg-white text-ink border border-black/5 shadow-premium hover:border-accent/30"
                        )}
                      >
                        {isRecording ? <Square size={40} /> : <Mic size={40} className="group-hover:text-accent transition-colors" />}
                      </button>
                    </div>
                    
                    <div className="text-center space-y-8 w-full">
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">
                          {isRecording ? 'Capturando Frequências' : 'Pronto para Gravar'}
                        </p>
                        <p className="font-serif italic text-sm opacity-50">
                          {isRecording ? 'Fale claramente para melhores resultados' : 'Use o microfone ou carregue um arquivo'}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-6 px-10">
                        <div className="h-px bg-black/5 flex-1" />
                        <span className="font-serif italic text-xs opacity-20">ou</span>
                        <div className="h-px bg-black/5 flex-1" />
                      </div>

                      <label className="inline-flex items-center gap-3 px-10 py-4 bg-paper border border-black/5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] cursor-pointer hover:bg-white hover:shadow-premium hover:border-accent/20 transition-all active:scale-95">
                        <Upload size={18} className="text-accent" />
                        Upload de Arquivo
                        <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>

                    <div className="w-full mt-auto pt-10 border-t border-black/5">
                      <div 
                        onClick={() => setShouldTranslate(!shouldTranslate)}
                        className="flex items-center justify-between cursor-pointer group p-4 rounded-2xl hover:bg-paper transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Tradução em Tempo Real</span>
                          <span className="font-serif italic text-xs opacity-40">Converter para {language === 'pt' ? 'Português' : 'Inglês'}</span>
                        </div>
                        <div className={cn(
                          "w-12 h-6 rounded-full transition-all relative border",
                          shouldTranslate ? "bg-accent border-accent" : "bg-white border-black/10"
                        )}>
                          <motion.div 
                            animate={{ x: shouldTranslate ? 24 : 0 }}
                            className={cn(
                              "absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full shadow-sm transition-colors",
                              shouldTranslate ? "bg-white" : "bg-black/10"
                            )} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 relative group">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Insira o texto para conversão..."
                        className="w-full h-full resize-none border-none focus:ring-0 text-2xl font-serif italic placeholder:opacity-10 bg-transparent leading-relaxed"
                      />
                      <div className="absolute bottom-0 right-0 p-4 opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <span className="font-mono text-[10px] opacity-30">{inputText.length} caracteres</span>
                      </div>
                    </div>
                    <button
                      onClick={handleTTS}
                      disabled={!inputText.trim() || isProcessing}
                      className="mt-10 w-full py-5 bg-ink text-white font-bold uppercase tracking-[0.3em] text-[10px] rounded-2xl shadow-premium hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-4"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                      Sintetizar Áudio
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Output Panel */}
              <motion.div 
                layout
                className="bg-white rounded-[2.5rem] p-10 border border-black/5 shadow-premium flex flex-col min-h-[550px] relative overflow-hidden"
              >
                <div className="flex justify-between items-center mb-10">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Phase 02</span>
                    <h2 className="font-serif text-2xl font-semibold italic">Saída Processada</h2>
                  </div>
                  {(result || audioUrl) && (
                    <button
                      onClick={() => handleCopy(result?.text || inputText)}
                      className="flex items-center gap-2 px-4 py-2 bg-paper rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-accent hover:text-white transition-all active:scale-95"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col relative z-10">
                  {isProcessing ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-8 text-ink/20">
                      <div className="relative">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                          className="w-20 h-20 border-2 border-dashed border-accent/30 rounded-full"
                        />
                        <Loader2 size={40} className="absolute inset-0 m-auto animate-spin text-accent" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]">Neural Processing</p>
                        <p className="font-serif italic text-sm opacity-50">Refinando transcrição e gerando resumo...</p>
                      </div>
                    </div>
                  ) : mode === 'stt' ? (
                    result ? (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 opacity-30">
                            <FileText size={16} />
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Transcrição Completa</span>
                          </div>
                          <div className="p-8 bg-paper rounded-3xl border border-black/5">
                            <p className="text-xl leading-relaxed font-serif italic text-ink/90 first-letter:text-4xl first-letter:font-bold first-letter:mr-1 first-letter:float-left">
                              {result.text}
                            </p>
                          </div>
                        </div>
                        
                        <div className="p-8 bg-accent/5 rounded-[2rem] border border-accent/10 space-y-4 relative overflow-hidden group">
                          <div className="flex items-center gap-3 text-accent">
                            <Sparkles size={18} />
                            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Resumo de Conteúdo</span>
                          </div>
                          <p className="text-sm leading-relaxed text-accent/80 font-medium">
                            {result.summary}
                          </p>
                          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 opacity-5">
                        <FileAudio size={120} strokeWidth={0.3} />
                        <p className="font-mono text-[10px] uppercase tracking-[0.4em]">Aguardando Sinal</p>
                      </div>
                    )
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-10">
                      {audioUrl ? (
                        <div className="w-full space-y-10 animate-in zoom-in-95 duration-700">
                          <div className="flex flex-col items-center gap-8">
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="w-32 h-32 bg-ink text-white rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
                            >
                              <Volume2 size={56} />
                            </motion.div>
                            <div className="text-center space-y-2">
                              <h3 className="font-bold uppercase tracking-[0.3em] text-[10px] text-accent">Audio Mastered</h3>
                              <p className="font-serif italic text-sm opacity-40">Pronto para reprodução e download</p>
                            </div>
                          </div>
                          <div className="p-6 bg-paper rounded-3xl border border-black/5 shadow-inner">
                            <audio ref={audioPlayerRef} controls className="w-full h-12" />
                          </div>
                          <a 
                            href={audioUrl} 
                            download="voxconvert-master.wav"
                            className="block w-full py-5 bg-white border border-black/5 rounded-2xl text-center text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-paper hover:shadow-premium transition-all active:scale-95"
                          >
                            Exportar Arquivo .WAV
                          </a>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 opacity-5">
                          <Play size={120} strokeWidth={0.3} />
                          <p className="font-mono text-[10px] uppercase tracking-[0.4em]">Aguardando Síntese</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtle background pattern */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
              </motion.div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-red-50 border border-red-100 text-red-500 text-[10px] font-bold uppercase tracking-[0.3em] text-center rounded-2xl shadow-premium"
              >
                {error}
              </motion.div>
            )}

            {/* Footer Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 bg-white rounded-3xl border border-black/5 shadow-premium flex flex-col gap-2 group hover:border-accent/20 transition-colors">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 group-hover:text-accent transition-colors">System Status</span>
                <span className="text-xs font-bold uppercase flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  Operational
                </span>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-black/5 shadow-premium flex flex-col gap-2 group hover:border-accent/20 transition-colors">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 group-hover:text-accent transition-colors">AI Engine</span>
                <span className="text-xs font-bold uppercase">Gemini 3 Flash // 1.5 Pro</span>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-black/5 shadow-premium flex flex-col gap-2 group hover:border-accent/20 transition-colors">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 group-hover:text-accent transition-colors">Session History</span>
                <span className="text-xs font-bold uppercase">{history.length} Active Records</span>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-10 py-8 glass border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-6 z-30">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">VoxConvert Premium v2.5</p>
            <p className="font-serif italic text-[10px] opacity-20">Designed for high-fidelity audio processing</p>
          </div>
          <div className="flex gap-10 font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
            <span className="hover:text-accent cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-accent cursor-pointer transition-colors">API Access</span>
            <span className="hover:text-accent cursor-pointer transition-colors">Privacy</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
