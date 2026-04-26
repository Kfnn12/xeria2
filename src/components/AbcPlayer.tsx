import React, { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';
import { Play, Pause, Square, RotateCcw, Download } from 'lucide-react';

interface AbcPlayerProps {
  abcNotation: string;
  isStreaming?: boolean;
}

export function AbcPlayer({ abcNotation, isStreaming = false }: AbcPlayerProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const synthControlRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let visualObj: any;

    if (paperRef.current && abcNotation) {
      try {
        visualObj = abcjs.renderAbc(paperRef.current, abcNotation, {
          responsive: "resize",
          add_classes: true,
          paddingtop: 15,
          paddingbottom: 15,
          paddingright: 15,
          paddingleft: 15,
        });
      } catch (e) {
        console.error("Error rendering ABC:", e);
      }
    }

    const initAudio = async () => {
      if (isStreaming) return; // Prevent rapid audio setup during streaming
      
      if (typeof window !== "undefined" && abcjs.synth.supportsAudio() && visualObj && visualObj.length > 0 && visualObj[0]) {
        try {
          const SynthController = abcjs.synth.SynthController;
          synthControlRef.current = new SynthController();
          
          if (audioRef.current) {
            audioRef.current.innerHTML = "";
            synthControlRef.current.load(audioRef.current, null, {
              displayLoop: true,
              displayRestart: true,
              displayPlay: true,
              displayProgress: true,
              displayWarp: true,
            });
          }

          await synthControlRef.current.setTune(visualObj[0], false, {
             chordsOff: false,
             onEnded: () => {
               setIsPlaying(false);
               setProgress(0);
             },
          });

          setIsReady(true);
        } catch (e) {
          console.error("Audio error", e);
        }
      } else {
        console.warn("abcjs audio not supported or visualObj missing");
      }
    };

    initAudio();

    return () => {
      try {
        if (synthControlRef.current && synthControlRef.current.destroy) {
          synthControlRef.current.destroy();
        }
      } catch (e) {
        console.error("Cleanup error", e);
      }
    };
  }, [abcNotation, isStreaming]);

  const handlePlayPause = () => {
    if (!synthControlRef.current || !isReady) return;
    
    if (isPlaying) {
      synthControlRef.current.pause();
    } else {
      synthControlRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (!synthControlRef.current || !isReady) return;
    synthControlRef.current.pause();
    synthControlRef.current.seek(0);
    setIsPlaying(false);
    setProgress(0);
  };

  const downloadMidi = () => {
    if (!abcNotation) return;
    try {
      const dummyDiv = document.createElement("div");
      const visualObj = abcjs.renderAbc(dummyDiv, abcNotation);
      const midiData = abcjs.synth.getMidiFile(visualObj[0], { midiOutputType: "binary" });
      const bytes = new Uint8Array(midiData as any);
      const blob = new Blob([bytes], { type: "audio/midi" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-music.mid';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) {
       console.error("Error generating MIDI", e);
    }
  };

  return (
    <div className="bg-[#1e1f20] rounded-xl my-4 overflow-hidden border border-[#3c4043] flex flex-col">
      {/* Sheet Music Area */}
      <div className="overflow-x-auto bg-[#e3e3e3] p-4 flex justify-center items-center relative">
        <div ref={paperRef} className="min-w-max text-black filter invert-[0.1] contrast-[1.2]" />
      </div>
      
      {/* Hidden default player */}
      <div ref={audioRef} className="hidden" />

      {/* Custom Player Controls */}
      <div className="flex flex-col bg-[#2d2d30] border-t border-[#3c4043] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button
                onClick={handlePlayPause}
                disabled={!isReady || isStreaming}
                className="w-10 h-10 rounded-full bg-[#8ab4f8] text-[#1e1f20] flex items-center justify-center hover:bg-white transition-colors disabled:opacity-50 disabled:hover:bg-[#8ab4f8]"
             >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
             </button>
             <button
                onClick={handleStop}
                disabled={!isReady || isStreaming || (!isPlaying && progress === 0)}
                className="w-10 h-10 rounded-full bg-[#3c4043] text-[#e3e3e3] flex items-center justify-center hover:bg-[#4a4d51] transition-colors disabled:opacity-50"
             >
                <Square size={16} fill="currentColor" />
             </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
             {isStreaming ? (
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Composing...</span>
             ) : (
                isReady ? (
                   <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Ready</span>
                ) : (
                   <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Loading Audio...</span>
                )
             )}
          </div>

          <button
             onClick={downloadMidi}
             disabled={isStreaming}
             title="Download MIDI"
             className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#3c4043] transition-colors disabled:opacity-50"
          >
             <Download size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
