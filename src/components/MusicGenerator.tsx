import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Music, Wand2 } from 'lucide-react';

interface MusicGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
}

const INSTRUMENTS = [
  { value: 0, label: 'Acoustic Grand Piano' },
  { value: 4, label: 'Electric Piano 1' },
  { value: 6, label: 'Harpsichord' },
  { value: 16, label: 'Drawbar Organ' },
  { value: 24, label: 'Acoustic Guitar (nylon)' },
  { value: 25, label: 'Acoustic Guitar (steel)' },
  { value: 27, label: 'Electric Guitar (clean)' },
  { value: 29, label: 'Overdriven Guitar' },
  { value: 32, label: 'Acoustic Bass' },
  { value: 33, label: 'Electric Bass (finger)' },
  { value: 40, label: 'Violin' },
  { value: 42, label: 'Cello' },
  { value: 46, label: 'Orchestral Harp' },
  { value: 48, label: 'String Ensemble 1' },
  { value: 56, label: 'Trumpet' },
  { value: 57, label: 'Trombone' },
  { value: 60, label: 'French Horn' },
  { value: 65, label: 'Alto Sax' },
  { value: 68, label: 'Oboe' },
  { value: 71, label: 'Clarinet' },
  { value: 73, label: 'Flute' },
  { value: 75, label: 'Pan Flute' },
  { value: 104, label: 'Sitar' },
];

const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Am', 'Em', 'Dm'];

export function MusicGenerator({ isOpen, onClose, onGenerate }: MusicGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [tempo, setTempo] = useState(120);
  const [key, setKey] = useState('C');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [instrument, setInstrument] = useState(0);
  const [duration, setDuration] = useState('Medium'); // Short, Medium, Long
  const [vocals, setVocals] = useState('None'); // None, Male Choir, Female Choir, Mixed Choir

  if (!isOpen) return null;

  const handleGenerate = () => {
    const instrumentName = INSTRUMENTS.find(i => i.value === Number(instrument))?.label || 'Piano';
    let fullPrompt = `Generate a ${duration.toLowerCase()} song`;
    if (prompt.trim()) {
      fullPrompt += ` about/in the style of "${prompt.trim()}"`;
    }
    
    fullPrompt += `. The song must be in the key of ${key}, with a time signature of ${timeSignature}, a tempo of 1/4=${tempo}, and use the instrument ${instrumentName} (%%MIDI program ${instrument}).`;

    if (vocals !== 'None') {
      fullPrompt += ` Also include a vocal line imitating a ${vocals.toLowerCase()}.`;
    }

    onGenerate(fullPrompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#3c4043]">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Music className="text-[#8ab4f8]" size={20} /> AI Music Generator
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2d2d30] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Prompt / Theme</label>
                <textarea
                  rows={2}
                  placeholder="e.g. A fast, upbeat heroic battle theme..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-[#2d2d30] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] resize-none"
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-sm font-medium text-gray-300">Instrument</label>
                  <select 
                    value={instrument}
                    onChange={(e) => setInstrument(Number(e.target.value))}
                    className="w-full h-10 bg-[#2d2d30] border border-[#3c4043] rounded-lg px-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8]"
                  >
                    {INSTRUMENTS.map(inst => (
                      <option key={inst.value} value={inst.value}>{inst.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-sm font-medium text-gray-300">Vocals</label>
                  <select 
                    value={vocals}
                    onChange={(e) => setVocals(e.target.value)}
                    className="w-full h-10 bg-[#2d2d30] border border-[#3c4043] rounded-lg px-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8]"
                  >
                    {['None', 'Male Choir', 'Female Choir', 'Mixed Choir'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 col-span-1">
                  <label className="text-sm font-medium text-gray-300">Key</label>
                  <select 
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full h-10 bg-[#2d2d30] border border-[#3c4043] rounded-lg px-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8]"
                  >
                    {KEYS.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Time Signature</label>
                  <select 
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    className="w-full h-10 bg-[#2d2d30] border border-[#3c4043] rounded-lg px-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8]"
                  >
                    {['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'].map(ts => (
                      <option key={ts} value={ts}>{ts}</option>
                    ))}
                  </select>
                </div>
             </div>

             <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-gray-300">Tempo (BPM)</label>
                  <span className="text-xs text-gray-400 bg-[#2d2d30] px-2 py-0.5 rounded">{tempo}</span>
                </div>
                <input 
                  type="range" 
                  min="40" max="240" step="1" 
                  value={tempo} 
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-full accent-[#8ab4f8] bg-[#2d2d30] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
             </div>

             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex justify-between">
                  Length Duration
                </label>
                <div className="flex bg-[#2d2d30] rounded-xl overflow-hidden border border-[#3c4043]">
                  {['Short', 'Medium', 'Long'].map(len => (
                    <button
                      key={len}
                      onClick={() => setDuration(len)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        duration === len 
                          ? 'bg-[#3c4043] text-white' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#3c4043] flex justify-end">
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[#8ab4f8] text-[#1e1f20] hover:bg-white transition-colors flex items-center gap-2"
          >
            <Wand2 size={16} /> Generate Music
          </button>
        </div>
      </motion.div>
    </div>
  );
}
