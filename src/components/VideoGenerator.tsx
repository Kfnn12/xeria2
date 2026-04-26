import { useState, useRef } from 'react';
import { X, Video, Play, Loader2, AlertTriangle, Key } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface VideoGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, videoUrl: string) => void;
}

export function VideoGenerator({ isOpen, onClose, onGenerate }: VideoGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setStatusText('Starting generation...');
    setPreviewImage(null);

    try {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
          // We assume key selection was successful to mitigate race condition
        }
      } else {
        console.warn("aistudio API not available, proceeding without key dialog.");
      }

      const apiKeyToUse = process.env.GEMINI_API_KEY;
      const aiInstance = new GoogleGenAI({ apiKey: apiKeyToUse });

      setStatusText('Generating storyboard preview...');
      setProgress(5);

      try {
        let mappedAspectRatio = aspectRatio;
        if (aspectRatio === '21:9') mappedAspectRatio = '16:9';
        
        const imageResult = await aiInstance.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [{ text: prompt.trim() }]
          },
          config: {
            imageConfig: {
              aspectRatio: mappedAspectRatio as any
            }
          }
        });
        
        const firstPart = imageResult.candidates?.[0]?.content?.parts?.[0];
        if (firstPart?.inlineData?.data) {
           setPreviewImage(`data:image/jpeg;base64,${firstPart.inlineData.data}`);
        }
      } catch (imgErr) {
        console.warn("Could not generate preview image", imgErr);
      }

      setStatusText('Submitting prompt to Veo...');
      setProgress(10);

      let operation = await aiInstance.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt.trim(),
        config: {
          numberOfVideos: 1,
          resolution: resolution, 
          aspectRatio: aspectRatio
        }
      });

      setStatusText('Generating video (this usually takes 1-2 minutes)...');
      let currentProgress = 15;

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await aiInstance.operations.getVideosOperation({operation: operation});
        
        // increment progress slowly to show activity
        if (currentProgress < 90) {
          currentProgress += Math.floor(Math.random() * 5) + 2;
          setProgress(Math.min(currentProgress, 90));
        }
      }

      setStatusText('Fetching completed video...');
      setProgress(95);

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("Failed to generate video (no URI returned).");
      }

      const videoResponse = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKeyToUse || '',
        },
      });

      if (!videoResponse.ok) {
         if (videoResponse.status === 404) {
             throw new Error("Video not found.");
         }
         throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
      }

      const blob = await videoResponse.blob();
      const videoUrl = URL.createObjectURL(blob);

      setProgress(100);
      setStatusText('Done!');

      onGenerate(prompt, videoUrl);
      setPrompt('');
      onClose();
    } catch (err: any) {
      console.error(err);
      const errorObj = err?.error || err;
      const msg = errorObj?.message?.toLowerCase() || (typeof err === 'string' ? err.toLowerCase() : JSON.stringify(err).toLowerCase());
      if (msg.includes('requested entity was not found') || msg.includes('permission_denied') || msg.includes('403')) {
        setError("Missing permissions. Veo/Imagen generation requires your own Google Cloud API Key with billing enabled. Please try selecting your API key again.");
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try { await (window as any).aistudio.openSelectKey(); } catch(e){}
        }
      } else if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
        setError("Quota exceeded. You have reached the usage limit for this model. Please check your billing details or wait until your quota resets.");
      } else {
        try {
            const parsed = JSON.parse(err.message || JSON.stringify(err));
            setError(parsed?.error?.message || err.message || 'An error occurred during video generation.');
        } catch(e) {
            setError(err.message || 'An error occurred during video generation.');
        }
      }
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setStatusText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-[#1e1e20] rounded-2xl w-full max-w-lg shadow-2xl border border-[#3c4043] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-2 text-white font-medium">
            <Video className="w-5 h-5 text-purple-400" />
            <span>Generate Video (Veo)</span>
          </div>
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
             <div className="space-y-4">
                
                {/* Info Box */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex gap-3 text-sm text-purple-200">
                  <Key className="w-5 h-5 flex-shrink-0 mt-0.5 text-purple-300" />
                  <div>
                    <p className="font-semibold mb-1">Requires Google Cloud API Key</p>
                    <p className="opacity-90 leading-relaxed">
                      Video generation uses the Veo model and requires a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-purple-300 underline hover:text-purple-100">paid API key</a>. You'll be prompted to select one when you click generate.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Prompt</label>
                    <textarea
                      rows={4}
                      placeholder="e.g. A neon hologram of a cat driving at top speed..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-[#2d2d30] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Aspect Ratio</label>
                      <select 
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        disabled={isGenerating}
                        className="w-full bg-[#2d2d30] border border-[#3c4043] rounded-xl px-4 py-2.5 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] disabled:opacity-50"
                      >
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:3">4:3</option>
                        <option value="3:4">3:4</option>
                        <option value="21:9">21:9 (Cinematic)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Resolution</label>
                      <select 
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        disabled={isGenerating}
                        className="w-full bg-[#2d2d30] border border-[#3c4043] rounded-xl px-4 py-2.5 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] disabled:opacity-50"
                      >
                        <option value="1080p">1080p (FHD)</option>
                        <option value="720p">720p (HD)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {previewImage && (
                  <div className="space-y-2 animate-in fade-in duration-500">
                    <label className="text-sm font-medium text-gray-300">Storyboard Preview</label>
                    <div className="rounded-xl overflow-hidden border border-[#3c4043] bg-black/50">
                      <img src={previewImage} alt="Video Preview" className="w-full h-auto object-contain max-h-[300px]" />
                    </div>
                  </div>
                )}

                {isGenerating && (
                  <div className="space-y-2">
                     <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>{statusText}</span>
                        <span>{progress}%</span>
                     </div>
                     <div className="w-full bg-[#2d2d30] rounded-full h-2 overflow-hidden border border-[#3c4043]">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                     </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

             </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3c4043] bg-[#2d2d30]/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 pl-4 pr-5 py-2 bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating (takes ~1-2 mins)...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
