import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, User, Bot, Loader2, Mic, Copy, Check, Sliders, X, Download, ThumbsUp, ThumbsDown, Paperclip, FileText, ImageIcon, Wand2, Edit2, Music, AlertTriangle, Volume2, Square, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ImageEditor } from './components/ImageEditor';
import { AbcPlayer } from './components/AbcPlayer';
import { MusicGenerator } from './components/MusicGenerator';
import { VideoGenerator } from './components/VideoGenerator';


// ai instance will be created per-request


type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  feedback?: { type: 'up' | 'down', text?: string } | null;
  isError?: boolean;
  videoUrl?: string;
  attachment?: {
    name: string;
    data: string;
    mimeType: string;
  };
};

// Add TypeScript support for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'initial', role: 'model', content: 'Hello! I am XER. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
  const [selectedFile, setSelectedFile] = useState<{name: string, data: string, mimeType: string} | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isFileProcessing, setIsFileProcessing] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isMusicGeneratorOpen, setIsMusicGeneratorOpen] = useState(false);
  const [isVideoGeneratorOpen, setIsVideoGeneratorOpen] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState<{ id: string, type: 'up' | 'down' } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cleanup speech synthesis on unmount
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');
        
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInput(''); // Clear input before starting new recording
      recognitionRef.current?.start();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string, id: string) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      window.speechSynthesis.cancel();
      const textToSpeak = text.replace(/```[\s\S]*?```/g, 'Code block omitted.');
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(id);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAutoSubmit = async (promptContent: string) => {
    if ((!promptContent.trim() && !selectedFile) || isLoading || isStreaming) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: promptContent,
      ...(selectedFile && { attachment: selectedFile })
    };
    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, userMessage]);
    
    // Create payload
    let contentsPayload: any = promptContent;
    if (selectedFile) {
      const base64Data = selectedFile.data.split(',')[1];
      contentsPayload = [];
      if (promptContent.trim()) contentsPayload.push({ text: promptContent });
      contentsPayload.push({
        inlineData: {
          data: base64Data,
          mimeType: selectedFile.mimeType
        }
      });
    }

    setInput('');
    const hasFile = !!selectedFile;
    setSelectedFile(null);
    setIsLoading(true);
    setIsStreaming(false);
    setIsFileProcessing(hasFile);

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || (import.meta.env && import.meta.env.VITE_API_KEY) || process.env.GEMINI_API_KEY || process.env.API_KEY || '' });
      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: contentsPayload,
        config: {
          systemInstruction: "You are a helpful AI assistant. If asked to generate music or a song or play music, output an ABC notation block like this:\n```abc\nX: 1\nT: Song Title\nC: Composer\nM: 4/4\nL: 1/8\nQ: 1/4=120\nK: C\n%%MIDI program 0\n...\n```\nIf the user specifies musical parameters like tempo, key, and instrument, incorporate them into the ABC notation. Use `%%MIDI program` for instruments (e.g., 0=Piano, 24=Guitar, 40=Violin, 56=Trumpet, 73=Flute). When the user asks for a specific instrument, you MUST include the corresponding `%%MIDI program` directive.",
          temperature: temperature,
          maxOutputTokens: maxOutputTokens,
        }
      });
      
      setIsFileProcessing(false);

      let fullText = '';
      let isFirstChunk = true;
      let pendingUpdate = false;

      const performUpdate = () => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === modelMessageId ? { ...msg, content: fullText } : msg
          )
        );
        pendingUpdate = false;
      };

      for await (const chunk of responseStream) {
        if (isFirstChunk) {
          setIsLoading(false);
          setIsStreaming(true);
          setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '' }]);
          isFirstChunk = false;
        }
        if (chunk.text) {
          fullText += chunk.text;
          if (!pendingUpdate) {
            pendingUpdate = true;
            requestAnimationFrame(performUpdate);
          }
        }
      }

      if (pendingUpdate) {
        performUpdate();
      }

      if (!fullText) {
        if (isFirstChunk) {
          setIsLoading(false);
        }
        setMessages(prev => [
            ...prev.filter(msg => msg.id !== modelMessageId), 
            { id: modelMessageId, role: 'model', content: 'Sorry, I couldn\'t generate a response.', isError: true }
        ]);
      }
    } catch (error: any) {
      setIsFileProcessing(false);
      // console.error('Error generating content:', error);
      let errorText = 'Oops! Something went wrong. Please try again later.';
      
      const errorObj = error?.error || error;
      const msg = errorObj?.message?.toLowerCase() || (typeof error === 'string' ? error.toLowerCase() : JSON.stringify(error).toLowerCase());
      const status = errorObj?.code || error?.status || error?.response?.status;
      
      if (msg.includes('api key') || status === 403 || status === 401 || msg.includes('permission_denied')) {
        errorText = 'Authentication failed: Invalid API key or missing permissions.';
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e){}
        }
      } else if (msg.includes('quota') || msg.includes('429') || status === 429 || msg.includes('resource_exhausted')) {
        errorText = 'Quota exceeded: You have reached the usage limit for this model. Please check your billing details or wait until your quota resets.';
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e){}
        }
      } else if (msg.includes('not found') || status === 404) {
        errorText = 'Model not found: The specified AI model is not available or does not exist.';
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
        errorText = 'Network error. Please check your internet connection and try again.';
      } else if (status >= 500) {
        errorText = 'Server error: The AI service is currently experiencing issues. Please try again later.';
      } else if (msg) {
        try {
            const parsed = JSON.parse(error.message || JSON.stringify(error));
            if (parsed.error && parsed.error.message) {
                errorText = `Error: ${parsed.error.message}`;
            } else {
                errorText = `Error: ${error.message || JSON.stringify(error)}`;
            }
        } catch(e) {
            errorText = `Error: ${error.message || JSON.stringify(error)}`;
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: errorText,
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleExport = () => {
    const chatText = messages
      .map((msg) => `${msg.role === 'user' ? 'ME' : 'XER'}:\n${msg.content}`)
      .join('\n\n----------------------------------------\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XER-Chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFeedbackClick = (id: string, type: 'up' | 'down') => {
    const msg = messages.find(m => m.id === id);
    if (msg?.feedback?.type === type) {
      // Toggle off
      setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: null } : m));
      if (feedbackInput?.id === id) setFeedbackInput(null);
    } else {
      // Set type, open input
      setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: { type, text: m.feedback?.text } } : m));
      setFeedbackInput({ id, type });
      setFeedbackText(msg?.feedback?.text || '');
    }
  };

  const submitFeedback = (id: string) => {
    if (feedbackInput && feedbackInput.id === id) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: { type: feedbackInput.type, text: feedbackText } } : m));
      setFeedbackInput(null);
      setFeedbackText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      alert('Only PDF and Image files are currently supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        data: event.target?.result as string,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleAutoEnhance = () => {
    if (!selectedFile || !selectedFile.mimeType.startsWith('image/')) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Auto enhance: increase contrast, saturation, and slight brightness
      ctx.filter = 'contrast(1.15) saturate(1.2) brightness(1.05)';
      ctx.drawImage(img, 0, 0);
      
      const enhancedData = canvas.toDataURL(selectedFile.mimeType);
      setSelectedFile({
        ...selectedFile,
        name: `enhanced_${selectedFile.name}`,
        data: enhancedData
      });
    };
    img.src = selectedFile.data;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading || isStreaming) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      ...(selectedFile && { attachment: selectedFile })
    };
    const modelMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, userMessage]);
    
    // Create payload
    let contentsPayload: any = input;
    if (selectedFile) {
      const base64Data = selectedFile.data.split(',')[1];
      contentsPayload = [];
      if (input.trim()) contentsPayload.push({ text: input });
      contentsPayload.push({
        inlineData: {
          data: base64Data,
          mimeType: selectedFile.mimeType
        }
      });
    }

    setInput('');
    const hasFile = !!selectedFile;
    setSelectedFile(null);
    setIsLoading(true);
    setIsStreaming(false);
    setIsFileProcessing(hasFile);

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || (import.meta.env && import.meta.env.VITE_API_KEY) || process.env.GEMINI_API_KEY || process.env.API_KEY || '' });
      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: contentsPayload,
        config: {
          systemInstruction: "You are a helpful AI assistant. If asked to generate music or a song or play music, output an ABC notation block like this:\n```abc\nX: 1\nT: Song Title\nC: Composer\nM: 4/4\nL: 1/8\nQ: 1/4=120\nK: C\n%%MIDI program 0\n...\n```\nIf the user specifies musical parameters like tempo, key, and instrument, incorporate them into the ABC notation. Use `%%MIDI program` for instruments (e.g., 0=Piano, 24=Guitar, 40=Violin, 56=Trumpet, 73=Flute). When the user asks for a specific instrument, you MUST include the corresponding `%%MIDI program` directive.",
          temperature: temperature,
          maxOutputTokens: maxOutputTokens,
        }
      });
      
      setIsFileProcessing(false);

      let fullText = '';
      let isFirstChunk = true;
      let pendingUpdate = false;

      const performUpdate = () => {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === modelMessageId ? { ...msg, content: fullText } : msg
          )
        );
        pendingUpdate = false;
      };

      for await (const chunk of responseStream) {
        if (isFirstChunk) {
          setIsLoading(false);
          setIsStreaming(true);
          setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '' }]);
          isFirstChunk = false;
        }
        if (chunk.text) {
          fullText += chunk.text;
          if (!pendingUpdate) {
            pendingUpdate = true;
            requestAnimationFrame(performUpdate);
          }
        }
      }

      if (pendingUpdate) {
        performUpdate();
      }

      if (!fullText) {
        if (isFirstChunk) {
          setIsLoading(false);
        }
        setMessages(prev => [
            ...prev.filter(msg => msg.id !== modelMessageId), 
            { id: modelMessageId, role: 'model', content: 'Sorry, I couldn\'t generate a response.', isError: true }
        ]);
      }
    } catch (error: any) {
      setIsFileProcessing(false);
      // console.error('Error generating content:', error);
      let errorText = 'Oops! Something went wrong. Please try again later.';
      
      const errorObj = error?.error || error;
      const msg = errorObj?.message?.toLowerCase() || (typeof error === 'string' ? error.toLowerCase() : JSON.stringify(error).toLowerCase());
      const status = errorObj?.code || error?.status || error?.response?.status;
      
      if (msg.includes('api key') || status === 403 || status === 401 || msg.includes('permission_denied')) {
        errorText = 'Authentication failed: Invalid API key or missing permissions.';
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e){}
        }
      } else if (msg.includes('quota') || msg.includes('429') || status === 429 || msg.includes('resource_exhausted')) {
        errorText = 'Quota exceeded: You have reached the usage limit for this model. Please check your billing details or wait until your quota resets.';
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e){}
        }
      } else if (msg.includes('not found') || status === 404) {
        errorText = 'Model not found: The specified AI model is not available or does not exist.';
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
        errorText = 'Network error. Please check your internet connection and try again.';
      } else if (status >= 500) {
        errorText = 'Server error: The AI service is currently experiencing issues. Please try again later.';
      } else if (msg) {
        try {
            const parsed = JSON.parse(error.message || JSON.stringify(error));
            if (parsed.error && parsed.error.message) {
                errorText = `Error: ${parsed.error.message}`;
            } else {
                errorText = `Error: ${error.message || JSON.stringify(error)}`;
            }
        } catch(e) {
            errorText = `Error: ${error.message || JSON.stringify(error)}`;
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: errorText,
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0e0e11] text-[#e3e3e3] font-sans antialiased overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-[#2d2d30] z-10 sticky top-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">XER AI</span>
          <span className="bg-[#2d2d30] text-[10px] px-2 py-0.5 rounded text-gray-400 font-medium uppercase tracking-tighter">Powered by Google</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2d2d30] rounded-xl transition-colors"
            title="Export Chat"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2d2d30] rounded-xl transition-colors"
            title="Settings"
          >
            <Sliders size={20} />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 max-w-[80vw] bg-[#171719] border-l border-[#2d2d30] z-50 p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#2d2d30] pb-4 mb-6">
                <h2 className="text-lg font-semibold text-[#e3e3e3]">Model Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white p-1.5 rounded-md hover:bg-[#2d2d30] transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-8 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Model</label>
                  </div>
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-[#2d2d30] border border-[#3c4043] rounded-lg p-2 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8]"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Temperature</label>
                    <span className="text-xs text-gray-400 bg-[#2d2d30] px-2 py-1 rounded select-none">{temperature.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="2" step="0.1" 
                    value={temperature} 
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#8ab4f8] bg-[#2d2d30] h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Max output tokens</label>
                    <span className="text-xs text-gray-400 bg-[#2d2d30] px-2 py-1 rounded select-none">{maxOutputTokens}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" max="8192" step="1" 
                    value={maxOutputTokens} 
                    onChange={(e) => setMaxOutputTokens(parseInt(e.target.value))}
                    className="w-full accent-[#8ab4f8] bg-[#2d2d30] h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                   <p className="text-[11px] text-gray-500 leading-relaxed">
                    The maximum number of tokens to generate. Requests can use up to 8192 tokens shared between prompt and completion.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-10 flex flex-col gap-6 md:gap-8 max-w-4xl mx-auto w-full">
        <div className="flex flex-col space-y-6 md:space-y-8">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex gap-3 md:gap-5 w-full max-w-4xl"
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center ${
                  message.role === 'user' ? 'rounded bg-gray-700 text-xs font-bold text-[#e3e3e3]' : 'rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 text-white'
                }`}>
                  {message.role === 'user' ? 'ME' : <Bot size={16} />}
                </div>

                {/* Message Content */}
                <div className="flex-1 space-y-1 pt-1 opacity-90 min-w-0">
                  {message.role === 'model' ? (
                    <div className={message.isError ? "text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20 shadow-sm" : "markdown-body"}>
                      {message.isError ? (
                        <div className="flex gap-3">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold mb-1 text-red-300">Request Failed</p>
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            <button 
                               onClick={() => setInput(messages[messages.findIndex(m => m.id === message.id) - 1]?.content || '')}
                               className="mt-3 text-xs font-medium bg-red-400/20 hover:bg-red-400/30 text-red-300 px-3 py-1.5 rounded-lg transition-colors border border-red-400/30"
                            >
                               Click here to retrieve your last prompt
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Markdown
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                  if (!inline && match && match[1] === 'abc') {
                                    return <AbcPlayer abcNotation={String(children).replace(/\n$/, '')} isStreaming={isStreaming && message.id === messages[messages.length - 1]?.id} />;
                                  }
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {message.content + (isStreaming && message.id === messages[messages.length - 1]?.id ? ' ▍' : '')}
                          </Markdown>
                          {message.videoUrl && (
                            <div className="mt-4 rounded-xl overflow-hidden border border-[#3c4043] bg-black/50">
                              <video 
                                src={message.videoUrl} 
                                controls 
                                className="w-full max-h-[60vh] object-contain"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {message.attachment && (
                        <div className="relative group w-fit">
                          {message.role === 'user' && isFileProcessing && message.id === messages[messages.length - 1]?.id && (
                            <div className="absolute inset-0 bg-[#2d2d30]/80 rounded-lg flex flex-col items-center justify-center z-10 backdrop-blur-[1px]">
                              <Loader2 size={24} className="text-[#8ab4f8] animate-spin mb-1" />
                              <span className="text-[10px] font-medium text-white">Uploading...</span>
                            </div>
                          )}
                          <div className={`flex items-center gap-2 bg-[#2d2d30] px-3 py-2 rounded-lg border border-[#3c4043] transition-opacity ${message.role === 'user' && isFileProcessing && message.id === messages[messages.length - 1]?.id ? 'opacity-50' : ''}`}>
                            {message.attachment.mimeType.startsWith('image/') ? (
                              <img 
                                src={message.attachment.data} 
                                alt="uploaded" 
                                className="h-20 w-auto rounded object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                                onClick={() => setExpandedImage(message.attachment?.data || null)}
                              />
                            ) : (
                              <>
                                <FileText size={16} className="text-[#8ab4f8]" />
                                <span className="text-sm font-medium text-gray-300 truncate max-w-[200px]">{message.attachment.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {message.content && (
                        <p className="whitespace-pre-wrap leading-relaxed text-[#e3e3e3] text-sm md:text-base">
                          {message.content}
                        </p>
                      )}
                    </div>
                  )}
                  {message.role === 'model' && !message.isError && (
                    <div className="flex flex-col gap-2 pt-3">
                      <div className="flex gap-4 items-center">
                        <button 
                          onClick={() => handleCopy(message.content, message.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === message.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          {copiedId === message.id ? 'Copied!' : 'Copy'}
                        </button>
                        {!isStreaming && (
                          <>
                            <button
                              onClick={() => handleSpeak(message.content, message.id)}
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                              title={speakingId === message.id ? "Stop speaking" : "Read aloud"}
                            >
                              {speakingId === message.id ? <Square size={14} className="text-blue-400" /> : <Volume2 size={14} />}
                              {speakingId === message.id ? 'Stop' : 'Read'}
                            </button>
                            <button
                              onClick={() => handleFeedbackClick(message.id, 'up')}
                              className={`flex items-center gap-1.5 text-xs transition-colors ${message.feedback?.type === 'up' ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}
                              title="Helpful response"
                            >
                              <ThumbsUp size={14} className={message.feedback?.type === 'up' ? "fill-green-500/20" : ""} />
                            </button>
                            <button
                              onClick={() => handleFeedbackClick(message.id, 'down')}
                              className={`flex items-center gap-1.5 text-xs transition-colors ${message.feedback?.type === 'down' ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}
                              title="Not helpful"
                            >
                              <ThumbsDown size={14} className={message.feedback?.type === 'down' ? "fill-red-500/20" : ""} />
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Detailed Feedback Input */}
                      {feedbackInput?.id === message.id && (
                        <div className="mt-2 bg-[#2d2d30] p-3 rounded-lg border border-[#3c4043] animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-xs text-gray-400 mb-2">
                             {feedbackInput.type === 'up' ? 'What did you like about this response?' : 'How could we improve this response?'}
                          </p>
                          <textarea
                             value={feedbackText}
                             onChange={(e) => setFeedbackText(e.target.value)}
                             placeholder="Provide additional feedback (optional)..."
                             className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-lg px-3 py-2 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] resize-none h-16"
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setFeedbackInput(null)}
                              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitFeedback(message.id)}
                              className="px-3 py-1.5 text-xs bg-[#8ab4f8] text-[#1e1f20] rounded-lg font-medium hover:bg-white transition-colors"
                            >
                              Submit Feedback
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display Submitted Feedback Note */}
                      {message.feedback?.text && feedbackInput?.id !== message.id && (
                        <div className="mt-1 text-xs text-gray-500 italic bg-[#2d2d30]/50 px-3 py-2 rounded-lg border border-[#3c4043]/50 w-fit">
                          Feedback submitted: "{message.feedback.text}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 md:gap-5 w-full max-w-4xl"
            >
               <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="flex-1 space-y-1 pt-3 opacity-90 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-pulse delay-75"></div>
                  <div className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-pulse delay-150"></div>
                </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 pb-6 md:p-6 bg-[#0e0e11] sticky bottom-0">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          
          {selectedFile && (
            <div className="absolute -top-12 left-0 right-0 flex px-2 z-10">
              <div className="bg-[#2d2d30] border border-[#3c4043] rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg max-w-full">
                {selectedFile.mimeType.startsWith('image/') ? (
                  <ImageIcon size={14} className="text-[#8ab4f8] flex-shrink-0" />
                ) : (
                  <FileText size={14} className="text-[#8ab4f8] flex-shrink-0" />
                )}
                <span className="text-xs font-medium text-gray-200 truncate max-w-[150px]">{selectedFile.name}</span>
                {selectedFile.mimeType.startsWith('image/') && (
                  <>
                    <button
                      type="button"
                      onClick={handleAutoEnhance}
                      className="p-1 hover:bg-[#3c4043] rounded-full text-blue-400 hover:text-blue-300 transition-colors ml-1"
                      title="Auto Enhance Image"
                    >
                      <Wand2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsImageEditorOpen(true)}
                      className="p-1 hover:bg-[#3c4043] rounded-full text-green-400 hover:text-green-300 transition-colors"
                      title="Edit Image"
                    >
                      <Edit2 size={12} />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-[#3c4043] rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <form 
            onSubmit={handleSubmit}
            className="relative bg-[#1e1f20] border border-[#3c4043] rounded-2xl p-1.5 md:p-2 shadow-2xl flex items-center"
          >
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a prompt here..."
              disabled={isLoading || isStreaming}
              className="flex-1 bg-transparent border-none text-[#e3e3e3] placeholder-gray-500 focus:ring-0 px-3 md:px-4 h-12 md:h-14 outline-none text-sm md:text-base disabled:opacity-50"
            />
            {recognitionRef.current && (
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading || isStreaming}
                  className={`p-2 md:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-all duration-300 disabled:opacity-50 ml-1 flex-shrink-0 ${isListening ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 ring-2 ring-red-500/50 ring-offset-1 ring-offset-[#1e1f20]' : 'text-gray-400 hover:bg-[#2d2d30] hover:text-[#8ab4f8]'}`}
                  title={isListening ? "Stop listening" : "Start typing with your voice"}
                >
                  <div className="relative">
                    {isListening ? (
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    ) : (
                      <Mic size={20} />
                    )}
                    {isListening && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                    )}
                  </div>
                </button>
                {isListening && (
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg animate-pulse">
                    Listening...
                  </span>
                )}
              </div>
            )}
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isStreaming}
              className="p-2 md:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-50 ml-1 text-gray-400 hover:bg-[#2d2d30] hover:text-[#8ab4f8] flex-shrink-0"
              title="Attach PDF"
            >
              <Paperclip size={20} />
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading || isStreaming}
              className="p-2 md:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-50 ml-1 text-gray-400 hover:bg-[#2d2d30] hover:text-[#8ab4f8] flex-shrink-0"
              title="Upload Image"
            >
              <ImageIcon size={20} />
            </button>

            <button
              type="button"
              onClick={() => setIsMusicGeneratorOpen(true)}
              disabled={isLoading || isStreaming}
              className="p-2 md:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-50 ml-1 text-gray-400 hover:bg-[#2d2d30] hover:text-purple-400 flex-shrink-0"
              title="Music Generator"
            >
              <Music size={20} />
            </button>

            <button
              type="button"
              onClick={() => setIsVideoGeneratorOpen(true)}
              disabled={isLoading || isStreaming}
              className="p-2 md:p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-50 ml-1 text-gray-400 hover:bg-[#2d2d30] hover:text-purple-400 flex-shrink-0"
              title="Video Generator"
            >
              <Video size={20} />
            </button>

            <button
              type="submit"
              disabled={(!input.trim() && !selectedFile) || isLoading || isStreaming}
              className="p-2 md:p-2.5 bg-[#8ab4f8] text-[#1e1f20] rounded-xl hover:bg-white min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-[#8ab4f8] ml-1 md:ml-2 flex-shrink-0"
              title="Send message"
            >
              <Send size={20} className={(input.trim() || selectedFile) && !isLoading ? "translate-x-0.5" : ""} />
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-500 mt-3 px-2">XER may display inaccurate info, including about people, so double-check its responses.</p>
        </div>
      </footer>

      {/* Expanded Image Modal */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          >
            <div className="absolute top-4 right-4 flex gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement('a');
                  link.href = expandedImage;
                  link.download = `image-${Date.now()}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="p-2 bg-[#2d2d30] hover:bg-[#3c4043] rounded-full text-white transition-colors cursor-pointer"
                title="Download Image"
              >
                <Download size={24} />
              </button>
              <button
                onClick={() => setExpandedImage(null)}
                className="p-2 bg-[#2d2d30] hover:bg-[#3c4043] rounded-full text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={expandedImage} 
              alt="Expanded" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {selectedFile && selectedFile.mimeType.startsWith('image/') && (
        <ImageEditor
          isOpen={isImageEditorOpen}
          onClose={() => setIsImageEditorOpen(false)}
          imageSrc={selectedFile.data}
          onSave={(editedImageDataUrl) => {
            setSelectedFile({
              ...selectedFile,
              data: editedImageDataUrl,
              name: `edited_${selectedFile.name}`
            });
          }}
        />
      )}

      <MusicGenerator
        isOpen={isMusicGeneratorOpen}
        onClose={() => setIsMusicGeneratorOpen(false)}
        onGenerate={(prompt) => {
          handleAutoSubmit(prompt);
        }}
      />
      <VideoGenerator
        isOpen={isVideoGeneratorOpen}
        onClose={() => setIsVideoGeneratorOpen(false)}
        onGenerate={(prompt, videoUrl) => {
          const userMessage: Message = { 
            id: Date.now().toString(), 
            role: 'user', 
            content: `Generate a video: ${prompt}`
          };
          const modelMessageId = (Date.now() + 1).toString();
          const modelMessage: Message = {
            id: modelMessageId,
            role: 'model',
            content: `Here is the video you requested: "${prompt}".`,
            videoUrl: videoUrl,
          };
          setMessages(prev => [...prev, userMessage, modelMessage]);
          scrollToBottom();
        }}
      />
    </div>
  );
}
