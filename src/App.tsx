import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code2, Shield, GraduationCap, CreditCard, MessageSquare, Terminal, Zap, CheckCircle2, ChevronRight, Globe, Layout, Cpu, Rocket, Sparkles, X, Image as ImageIcon, Volume2, LogOut, User, Mail, Lock, Mic, MicOff, Headset } from 'lucide-react';
import Markdown from 'react-markdown';
import { getGeminiResponse } from './services/gemini';
import { cn } from './lib/utils';

type View = 'landing' | 'ai' | 'security' | 'courses' | 'pricing' | 'login';

export default function App() {
  const [view, setView] = React.useState<View>('landing');
  const [user, setUser] = React.useState<{ email: string } | null>(null);
  const [messages, setMessages] = React.useState<{ role: 'user' | 'ai'; content: string; image?: string }[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [selectedCourse, setSelectedCourse] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<{ data: string; mimeType: string } | null>(null);
  const [selectedAudio, setSelectedAudio] = React.useState<{ data: string; mimeType: string } | null>(null);
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [questionsRemaining, setQuestionsRemaining] = React.useState(35);
  const [cooldownEnd, setCooldownEnd] = React.useState<number | null>(null);
  const [isAutoSpeak, setIsAutoSpeak] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const currentUtteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const courses = [
    "JavaScript Master",
    "Python para IA",
    "PHP Moderno",
    "Ruby on Rails",
    "Bash Scripting",
    "Lua para Games",
    "Go (Golang)",
    "Rust Systems",
    "C++ Avançado",
    "Java Enterprise"
  ];

  React.useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    
    // Prime speech synthesis voices
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      
      // Alguns navegadores precisam desse listener para carregar as vozes
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail && loginPassword) {
      setUser({ email: loginEmail });
      setView('landing');
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('landing');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({ data: base64String, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage && !selectedAudio) || isLoading) return;
    
    if (!user) {
      setView('login');
      return;
    }

    // Comando /cursos
    if (input.trim().toLowerCase() === '/cursos') {
      const coursesList = courses.map(c => `• ${c}`).join('\n');
      setMessages(prev => [
        ...prev, 
        { role: 'user', content: '/cursos' },
        { role: 'ai', content: `### 📚 Cursos Disponíveis:\n\nAqui estão os módulos que você pode adquirir por apenas R$ 5 cada:\n\n${coursesList}\n\nPara acessar, vá até a aba **Cursos** no menu superior.` }
      ]);
      setInput('');
      return;
    }

    // Sistema de Limite de Perguntas
    const now = Date.now();
    if (cooldownEnd && now < cooldownEnd) {
      const remainingTime = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60));
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `⚠️ **Limite atingido!** Você usou suas 35 perguntas gratuitas. Seu limite será resetado em aproximadamente **${remainingTime} horas**. Adquira o **Plano VIP** para acesso ilimitado!` 
      }]);
      setInput('');
      return;
    }

    if (questionsRemaining <= 0) {
      const fourHours = 4 * 60 * 60 * 1000;
      setCooldownEnd(now + fourHours);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `⚠️ **Limite atingido!** Você usou suas 35 perguntas gratuitas. Seu limite será resetado em **4 horas**. Adquira o **Plano VIP** para acesso ilimitado!` 
      }]);
      setInput('');
      return;
    }

    const userMsg = input;
    const currentImage = selectedImage;
    const currentAudio = selectedAudio;
    
    setInput('');
    setSelectedImage(null);
    setSelectedAudio(null);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMsg || (currentAudio ? "🎤 Mensagem de voz" : ""), 
      image: currentImage ? `data:${currentImage.mimeType};base64,${currentImage.data}` : undefined 
    }]);
    
    setIsLoading(true);
    
    // Adiciona uma mensagem vazia da IA que será preenchida pelo stream
    setMessages(prev => [...prev, { role: 'ai', content: '' }]);
    
    const response = await getGeminiResponse(
      userMsg || (currentAudio ? "Analise este áudio" : "Analise esta imagem"), 
      currentImage || undefined,
      currentAudio || undefined,
      (fullText) => {
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1].content = fullText;
          }
          return newMessages;
        });
      }
    );

    if (!response || response.includes("Desculpe, ocorreu um erro")) {
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0) {
          newMessages[newMessages.length - 1].content = response || 'Erro na resposta.';
        }
        return newMessages;
      });
    }

    setQuestionsRemaining(prev => prev - 1);
    setIsLoading(false);

    if (isAutoSpeak && response) {
      // Pequeno delay para garantir que o DOM e estados foram atualizados
      setTimeout(() => {
        if (!isSpeaking) speak(response);
      }, 300);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }

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
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setSelectedAudio({ data: base64String, mimeType: 'audio/webm' });
        };
        reader.readAsDataURL(audioBlob);
        
        // Para o stream para liberar o microfone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const speak = (text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Limpa o texto de marcações markdown
    const cleanText = text.replace(/[*#_`~]/g, '').replace(/\[.*?\]\(.*?\)/g, '');

    // Cancela qualquer fala anterior
    window.speechSynthesis.cancel();
    
    // Divide o texto em partes menores para evitar que o Chrome pare
    // Tenta dividir por sentenças, mas se a sentença for muito longa, divide por tamanho
    const rawChunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+/g) || [cleanText];
    const chunks: string[] = [];
    
    rawChunks.forEach(chunk => {
      if (chunk.length > 200) {
        // Se a sentença for maior que 200 caracteres, divide por vírgulas ou espaços
        const subChunks = chunk.match(/.{1,200}(\s|$)/g) || [chunk];
        chunks.push(...subChunks);
      } else {
        chunks.push(chunk);
      }
    });

    let currentChunkIndex = 0;

    const speakNextChunk = () => {
      if (currentChunkIndex >= chunks.length) return;

      const chunk = chunks[currentChunkIndex].trim();
      if (!chunk) {
        currentChunkIndex++;
        speakNextChunk();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = 'pt-BR';
      
      const voices = window.speechSynthesis.getVoices();
      const ptVoices = voices.filter(v => v.lang.includes('pt-BR'));
      
      const preferredVoice = ptVoices.find(v => 
        v.name.includes('Google') || v.name.includes('Maria') || v.name.includes('Francisca') || v.name.includes('Natural')
      ) || ptVoices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        currentChunkIndex++;
        if (currentChunkIndex >= chunks.length) {
          setIsSpeaking(false);
        } else {
          speakNextChunk();
        }
      };

      utterance.onerror = (e) => {
        console.error('Erro na fala:', e);
        setIsSpeaking(false);
        window.speechSynthesis.cancel();
      };

      // Mantém referência para evitar garbage collection
      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    // Pequeno delay para o navegador processar o cancelamento anterior
    setTimeout(() => {
      speakNextChunk();
    }, 100);
  };

  if (showSplash) {
    return (
      <div className="h-screen w-screen bg-[#05070A] flex flex-col items-center justify-center cyber-grid relative overflow-hidden">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-[#00E5FF] rounded-2xl flex items-center justify-center cyan-glow mb-6">
            <Terminal className="w-12 h-12 text-black" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tighter mb-2">CADU AI</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-[#00E5FF] font-black cyan-text-glow">By Cadu dos Mods</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070A] text-zinc-300 font-sans cyber-grid selection:bg-[#00E5FF]/30 selection:text-[#00E5FF]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#05070A]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <button onClick={() => setView('landing')} className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-[#00E5FF] rounded-xl flex items-center justify-center cyan-glow group-hover:scale-110 transition-transform">
              <Terminal className="w-6 h-6 text-black" />
            </div>
            <div className="text-left">
              <h1 className="font-display font-bold text-xl tracking-tight text-white">IA Programadora</h1>
              <p className="text-[8px] uppercase tracking-widest text-[#00E5FF] font-black">by cadu dos mods</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <HeaderLink active={view === 'ai'} onClick={() => setView('ai')}>IA Programadora</HeaderLink>
            <HeaderLink active={view === 'security'} onClick={() => setView('security')}>Cibersegurança</HeaderLink>
            <HeaderLink active={view === 'courses'} onClick={() => setView('courses')}>Cursos</HeaderLink>
            <HeaderLink active={view === 'pricing'} onClick={() => setView('pricing')}>Planos</HeaderLink>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-white">{user.email.split('@')[0]}</span>
                  <span className="text-[8px] uppercase tracking-widest text-[#00E5FF]">Usuário Ativo</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <LogOut className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')}
                className="bg-[#00E5FF] text-black px-6 py-2.5 rounded-xl font-bold text-sm cyan-glow hover:bg-[#00C2D9] transition-all active:scale-95"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="pt-20">
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto px-6 pt-24 pb-32"
            >
              <div className="bg-[#0B0E14] border border-white/10 rounded-[32px] p-10 shadow-2xl">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-[#00E5FF]/10 rounded-2xl flex items-center justify-center border border-[#00E5FF]/20 mx-auto mb-6">
                    <User className="w-8 h-8 text-[#00E5FF]" />
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white mb-2">
                    {isRegistering ? 'Criar Conta' : 'Bem-vindo de volta'}
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    {isRegistering ? 'Cadastre-se para começar' : 'Acesse sua conta para continuar'}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-2">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                      <input 
                        type="email" 
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/50 transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-2">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                      <input 
                        type="password" 
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/50 transition-all text-white"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-[#00E5FF] text-black py-4 rounded-2xl font-bold text-lg cyan-glow hover:bg-[#00C2D9] transition-all active:scale-95"
                  >
                    {isRegistering ? 'Cadastrar Agora' : 'Entrar Agora'}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-xs text-zinc-600">
                    {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} {' '}
                    <button 
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-[#00E5FF] cursor-pointer hover:underline font-bold"
                    >
                      {isRegistering ? 'Faça Login' : 'Cadastre-se'}
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="hero-gradient"
            >
              {/* Hero Section */}
              <section className="max-w-4xl mx-auto px-6 pt-24 pb-32 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold mb-8"
                >
                  <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                  <span className="text-zinc-400">A REVOLUÇÃO DO DESENVOLVIMENTO</span>
                </motion.div>
                
                <h1 className="text-7xl md:text-8xl font-display font-bold text-white tracking-tight mb-8">
                  Inteligente
                </h1>
                
                <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-12">
                  IA Programadora é a ferramenta revolucionária que transforma a forma como você desenvolve. Geração de código, depuração inteligente e otimização automática em um único lugar.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                  <button 
                    onClick={() => setView('ai')}
                    className="w-full sm:w-auto bg-[#00E5FF] text-black px-10 py-4 rounded-2xl font-bold text-lg cyan-glow hover:bg-[#00C2D9] transition-all flex items-center justify-center gap-3 group"
                  >
                    Começar Gratuitamente <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setView('pricing')}
                    className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                  >
                    Ver Planos <CreditCard className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-zinc-500">
                  <span className="flex items-center gap-2">✨ Sem cartão de crédito necessário</span>
                  <span className="flex items-center gap-2">🚀 Acesso imediato</span>
                  <span className="flex items-center gap-2">💯 Totalmente gratuito</span>
                </div>
              </section>

              {/* Languages Section */}
              <section className="max-w-7xl mx-auto px-6 pb-32">
                <div className="bg-white/5 border border-white/10 rounded-[40px] p-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#00E5FF]/10 blur-[100px] -mr-32 -mt-32" />
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                      <div className="max-w-lg">
                        <h2 className="text-4xl font-display font-bold text-white mb-6">Domínio Total de Linguagens</h2>
                        <p className="text-zinc-400 leading-relaxed mb-8">
                          Nossa IA possui conhecimento profundo em todas as linguagens de programação e script do mercado. Do desenvolvimento web à automação de sistemas complexos.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {['JavaScript', 'Python', 'PHP', 'Ruby', 'Bash', 'Lua', 'Go', 'Rust', 'C++', 'Java', 'PowerShell', 'Perl'].map((lang) => (
                            <div key={lang} className="flex items-center gap-2 text-sm font-bold text-white/70">
                              <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" /> {lang}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="w-full md:w-1/3 aspect-square bg-gradient-to-br from-[#00E5FF]/20 to-transparent rounded-3xl border border-[#00E5FF]/20 flex items-center justify-center p-12">
                        <Code2 className="w-full h-full text-[#00E5FF] opacity-50" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Features Section */}
              <section className="max-w-7xl mx-auto px-6 pb-32">
                <div className="text-center mb-16">
                  <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">Funcionalidades Poderosas</h2>
                  <p className="text-zinc-500">Tudo que você precisa para elevar seu desenvolvimento para o próximo nível</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <LandingFeature 
                    icon={<Code2 className="w-6 h-6" />}
                    title="Geração de Código"
                    desc="Crie algoritmos complexos e estruturas de dados em segundos com precisão absoluta."
                  />
                  <LandingFeature 
                    icon={<Shield className="w-6 h-6" />}
                    title="Segurança Ativa"
                    desc="Análise automática de vulnerabilidades e sugestões de correção em tempo real."
                  />
                  <LandingFeature 
                    icon={<Cpu className="w-6 h-6" />}
                    title="Otimização"
                    desc="Refatore seu código para máxima performance e menor consumo de recursos."
                  />
                </div>
              </section>

              {/* Footer Watermark */}
              <footer className="py-12 border-t border-white/5 text-center">
                <p className="text-[10px] uppercase tracking-[0.5em] text-[#00E5FF] font-black opacity-50">
                  By Cadu dos Mods
                </p>
              </footer>
            </motion.div>
          )}

          {view === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto w-full p-6 h-[calc(100vh-80px)] flex flex-col"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Perguntas Restantes</p>
                  <p className="text-xl font-display font-bold text-[#00E5FF]">{questionsRemaining}</p>
                </div>
                {cooldownEnd && (
                  <div className="px-4 py-2 bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-xl">
                    <p className="text-[10px] font-bold text-[#FF4444] uppercase tracking-widest mb-1">Cooldown Ativo</p>
                    <p className="text-xs text-white font-bold">Aguarde o reset</p>
                  </div>
                )}
                <button 
                  onClick={() => setIsAutoSpeak(!isAutoSpeak)}
                  className={cn(
                    "px-4 py-2 border rounded-xl flex items-center gap-2 transition-all",
                    isAutoSpeak ? "bg-[#00E5FF]/20 border-[#00E5FF]/50 text-[#00E5FF]" : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
                  )}
                >
                  <Headset className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Auto-Voz: {isAutoSpeak ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 scrollbar-hide">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-[#00E5FF]/10 rounded-2xl flex items-center justify-center border border-[#00E5FF]/20">
                      <Terminal className="w-8 h-8 text-[#00E5FF]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-bold text-white">Terminal de IA</h2>
                      <p className="text-sm text-zinc-500 max-w-md mx-auto">Pronto para codificar. Envie uma imagem ou digite sua dúvida.</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className={cn(
                      "flex gap-4 p-6 rounded-3xl relative group/msg",
                      msg.role === 'user' ? "bg-white/5 ml-12 border border-white/5" : "bg-[#00E5FF]/5 border border-[#00E5FF]/10 mr-12"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      msg.role === 'user' ? "bg-zinc-800" : "bg-[#00E5FF]"
                    )}>
                      {msg.role === 'user' ? <div className="text-sm font-bold">U</div> : <Terminal className="w-5 h-5 text-black" />}
                    </div>
                    <div className="flex-1 space-y-4">
                      {msg.image && (
                        <img src={msg.image} alt="User upload" className="max-w-sm rounded-xl border border-white/10" referrerPolicy="no-referrer" />
                      )}
                      <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                      {msg.role === 'ai' && (
                        <button 
                          onClick={() => {
                            if (isSpeaking) {
                              window.speechSynthesis.cancel();
                              setIsSpeaking(false);
                            } else {
                              speak(msg.content);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors",
                            isSpeaking ? "text-[#FF4444] hover:text-[#FF6666]" : "text-[#00E5FF] hover:text-[#00C2D9]"
                          )}
                        >
                          {isSpeaking ? (
                            <>
                              <div className="flex gap-0.5 items-end h-3">
                                <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-current" />
                                <motion.div animate={{ height: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-current" />
                                <motion.div animate={{ height: [4, 10, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-0.5 bg-current" />
                              </div>
                              Parar Leitura
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" /> Ouvir Resposta
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex gap-4 p-6 rounded-3xl bg-[#00E5FF]/5 border border-[#00E5FF]/10 mr-12 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-[#00E5FF] flex items-center justify-center shrink-0">
                      <Terminal className="w-5 h-5 text-black" />
                    </div>
                    <div className="space-y-2 flex-1 pt-2">
                      <div className="h-3 bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-800 rounded w-1/2" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pb-6">
                {selectedImage && (
                  <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl w-fit">
                    <img 
                      src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                      alt="Preview" 
                      className="w-12 h-12 object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                    <button onClick={() => setSelectedImage(null)} className="text-zinc-500 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <label className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer">
                      <ImageIcon className="w-5 h-5 text-zinc-400" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <button 
                      onClick={toggleListening}
                      className={cn(
                        "w-10 h-10 border rounded-xl flex items-center justify-center transition-all",
                        isListening ? "bg-[#FF4444]/20 border-[#FF4444]/50 text-[#FF4444] animate-pulse" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                      )}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    {selectedAudio && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-[#00E5FF]/10 border border-[#00E5FF]/20 rounded-lg animate-in fade-in zoom-in duration-300">
                        <Volume2 className="w-3 h-3 text-[#00E5FF]" />
                        <span className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-tighter">Áudio Pronto</span>
                        <button onClick={() => setSelectedAudio(null)} className="text-white/40 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Instrução de código ou dúvida..."
                    className="w-full bg-[#0B0E14] border border-white/10 rounded-2xl py-5 pl-16 pr-20 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/50 transition-all text-white placeholder:text-zinc-600"
                  />
                  
                  <button 
                    onClick={handleSend}
                    disabled={isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#00E5FF] rounded-xl flex items-center justify-center hover:bg-[#00C2D9] transition-colors disabled:opacity-50 cyan-glow"
                  >
                    <Zap className="w-6 h-6 text-black" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'security' && (
            <motion.div 
              key="security"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto px-6 py-12"
            >
              <div className="flex items-center gap-6 mb-12">
                <div className="w-16 h-16 bg-[#00E5FF]/10 rounded-2xl flex items-center justify-center border border-[#00E5FF]/20">
                  <Shield className="w-8 h-8 text-[#00E5FF]" />
                </div>
                <div>
                  <h2 className="text-4xl font-display font-bold text-white">Cibersegurança Elite</h2>
                  <p className="text-zinc-500">Módulos avançados de defesa, proteção mobile e anonimato digital.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <SecurityCard title="Penetration Testing" desc="Aprenda a testar a segurança de redes e aplicações de forma ética." level="Avançado" />
                <SecurityCard title="Segurança Mobile" desc="Como proteger seu celular (Android/iOS) contra spywares, malwares e invasões remotas." level="Expert" />
                <SecurityCard title="Proteção de IP & VPN" desc="Técnicas de anonimato, uso de Proxy, VPNs seguras e proteção contra vazamento de IP." level="Intermediário" />
                <SecurityCard title="Defesa de Perímetro" desc="Configuração de firewalls e sistemas de detecção de intrusão (IDS/IPS)." level="Intermediário" />
                <SecurityCard title="Criptoanálise" desc="Estudo de cifras e algoritmos de proteção de dados modernos e criptografia ponta-a-ponta." level="Expert" />
                <SecurityCard title="Segurança Web" desc="Proteção contra OWASP Top 10 e vulnerabilidades comuns em aplicações web." level="Iniciante" />
              </div>
            </motion.div>
          )}

          {view === 'courses' && (
            <motion.div 
              key="courses"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto px-6 py-12"
            >
              <div className="flex items-center gap-6 mb-12">
                <div className="w-16 h-16 bg-[#00E5FF]/10 rounded-2xl flex items-center justify-center border border-[#00E5FF]/20">
                  <GraduationCap className="w-8 h-8 text-[#00E5FF]" />
                </div>
                <div>
                  <h2 className="text-4xl font-display font-bold text-white">Cursos Especializados</h2>
                  <p className="text-zinc-500">Aprenda com quem entende. R$ 5 por módulo completo.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <CourseCard title="JavaScript Master" questions={100} price="5" onPreview={() => setSelectedCourse("JavaScript Master")} />
                <CourseCard title="Python para IA" questions={100} price="5" onPreview={() => setSelectedCourse("Python para IA")} />
                <CourseCard title="PHP Moderno" questions={100} price="5" onPreview={() => setSelectedCourse("PHP Moderno")} />
                <CourseCard title="Ruby on Rails" questions={100} price="5" onPreview={() => setSelectedCourse("Ruby on Rails")} />
                <CourseCard title="Bash Scripting" questions={100} price="5" onPreview={() => setSelectedCourse("Bash Scripting")} />
                <CourseCard title="Lua para Games" questions={100} price="5" onPreview={() => setSelectedCourse("Lua para Games")} />
                <CourseCard title="Go (Golang)" questions={100} price="5" onPreview={() => setSelectedCourse("Go (Golang)")} />
                <CourseCard title="Rust Systems" questions={100} price="5" onPreview={() => setSelectedCourse("Rust Systems")} />
                <CourseCard title="C++ Avançado" questions={100} price="5" onPreview={() => setSelectedCourse("C++ Avançado")} />
                <CourseCard title="Java Enterprise" questions={100} price="5" onPreview={() => setSelectedCourse("Java Enterprise")} />
              </div>
            </motion.div>
          )}

          {view === 'pricing' && (
            <motion.div 
              key="pricing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center"
            >
              <h2 className="text-5xl font-display font-bold text-white mb-16">Planos de Acesso</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                <PricingCard 
                  title="Plano Grátis" 
                  price="0" 
                  features={["35 Perguntas / 4h", "IA Básica", "Acesso ao Terminal"]}
                  onAction={() => setView('ai')}
                />
                <PricingCard 
                  title="Plano Prata" 
                  price="15" 
                  features={["IA Avançada", "Suporte 24h", "1 Curso/Mês", "Sem Cooldown"]}
                  onAction={() => {}}
                />
                <PricingCard 
                  title="Plano VIP" 
                  price="25" 
                  features={["IA Ilimitada", "Prioridade Total", "Todos os Cursos", "Cibersegurança VIP", "Sem Cooldown"]}
                  highlight
                  onAction={() => {}}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Certificate Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-black p-12 rounded-sm max-w-4xl w-full shadow-2xl relative border-[12px] border-zinc-100"
          >
            <button onClick={() => setSelectedCourse(null)} className="absolute -top-12 right-0 text-white flex items-center gap-2 font-bold">
              FECHAR <X className="w-5 h-5" />
            </button>
            <div className="border-4 border-zinc-900 p-10 flex flex-col items-center text-center">
              <Terminal className="w-12 h-12 text-zinc-900 mb-4" />
              <h3 className="text-sm font-black tracking-[0.3em] uppercase mb-8">Certificado de Conclusão</h3>
              <p className="text-zinc-500 italic mb-2">Concedido a um aluno exemplar no curso:</p>
              <h2 className="text-4xl font-display font-bold mb-12">{selectedCourse}</h2>
              <div className="grid grid-cols-2 gap-20 w-full mt-12">
                <div className="border-t border-zinc-900 pt-2">
                  <p className="text-[10px] font-bold uppercase">Data</p>
                  <p className="text-xs">{new Date().toLocaleDateString()}</p>
                </div>
                <div className="border-t border-zinc-900 pt-2">
                  <p className="font-display italic text-lg">Cadu dos Mods</p>
                  <p className="text-[10px] font-bold uppercase">Instrutor</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


function HeaderLink({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "transition-colors hover:text-[#00E5FF]",
        active ? "text-[#00E5FF]" : "text-zinc-500"
      )}
    >
      {children}
    </button>
  );
}

function LandingFeature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-[#00E5FF]/30 transition-all group">
      <div className="w-12 h-12 bg-[#00E5FF]/10 rounded-xl flex items-center justify-center mb-6 border border-[#00E5FF]/20 group-hover:scale-110 transition-transform">
        <div className="text-[#00E5FF]">{icon}</div>
      </div>
      <h3 className="text-xl font-display font-bold text-white mb-4">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function SecurityCard({ title, desc, level }: { title: string, desc: string, level: string }) {
  return (
    <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-[#00E5FF]/30 transition-all">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-display font-bold text-white">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-[#00E5FF]/10 text-[#00E5FF] rounded">{level}</span>
      </div>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6">{desc}</p>
      <button className="text-xs font-bold text-[#00E5FF] flex items-center gap-2 hover:gap-3 transition-all uppercase tracking-widest">
        Iniciar Módulo <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function CourseCard({ title, questions, price, onPreview }: { title: string, questions: number, price: string, onPreview: () => void }) {
  return (
    <div className="p-8 rounded-3xl bg-white/5 border border-white/5 flex flex-col h-full">
      <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
        <Code2 className="w-6 h-6 text-[#00E5FF]" />
      </div>
      <h3 className="text-xl font-display font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-zinc-500 mb-8 flex items-center gap-2">
        <CheckCircle2 className="w-3 h-3 text-[#00E5FF]" /> {questions} Perguntas de Fixação
      </p>
      <div className="mt-auto space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-white">R$ {price}</span>
          <button className="bg-[#00E5FF] text-black px-6 py-2 rounded-xl font-bold text-sm cyan-glow">Comprar</button>
        </div>
        <button onClick={onPreview} className="text-[10px] text-zinc-600 hover:text-[#00E5FF] transition-colors uppercase font-bold tracking-widest w-full text-center">
          Ver Certificado Exemplo
        </button>
      </div>
    </div>
  );
}

function PricingCard({ title, price, features, highlight, onAction }: { title: string, price: string, features: string[], highlight?: boolean, onAction: () => void }) {
  return (
    <div className={cn(
      "p-10 rounded-[32px] border flex flex-col",
      highlight 
        ? "bg-[#00E5FF]/5 border-[#00E5FF]/30 cyan-glow" 
        : "bg-white/5 border-white/10"
    )}>
      <h3 className="text-2xl font-display font-bold text-white mb-2">{title}</h3>
      <div className="flex items-baseline gap-1 mb-8">
        <span className="text-4xl font-bold text-white">R$ {price}</span>
        <span className="text-zinc-500 text-sm">/mês</span>
      </div>
      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" /> {f}
          </li>
        ))}
      </ul>
      <button 
        onClick={onAction}
        className={cn(
          "w-full py-4 rounded-2xl font-bold transition-all",
          highlight ? "bg-[#00E5FF] text-black hover:bg-[#00C2D9]" : "bg-white/10 text-white hover:bg-white/20"
        )}
      >
        Assinar Agora
      </button>
    </div>
  );
}
