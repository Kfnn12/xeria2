import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, FileImage, RotateCw, Contrast, Sun, Wand2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (editedImageDataUrl: string) => void;
}

export function ImageEditor({ isOpen, onClose, imageSrc, onSave }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'adjust' | 'ai'>('adjust');
  const [aiPrompt, setAiPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [variations, setVariations] = useState<string[]>([]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      const editedImage = await getEditedImage(
        currentImageSrc,
        croppedAreaPixels,
        rotation,
        brightness,
        contrast
      );
      onSave(editedImage);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAiEdit = async (generateVariations = false) => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    
    try {
      // First apply any crop/rotation/brightness changes before AI edits
      const baseImageForAi = await getEditedImage(
        currentImageSrc,
        croppedAreaPixels,
        rotation,
        brightness,
        contrast
      );
      
      const mimeTypeMatch = baseImageForAi.match(/^data:(image\/[a-zA-Z]*);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
      const base64Data = baseImageForAi.replace(/^data:image\/\w+;base64,/, '');

      let finalPromptText = aiPrompt;
      if (negativePrompt.trim()) {
        finalPromptText += `\n\nCRITICAL INSTRUCTION: Do NOT include, generate, or add any of the following: ${negativePrompt}`;
      }

      const generateSingle = async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: finalPromptText,
              },
            ],
          },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
        return null;
      };

      if (generateVariations) {
        const promises = Array.from({ length: 4 }).map(() => generateSingle());
        const results = await Promise.all(promises);
        const newVariations = results.filter((res) => res !== null) as string[];
        if (newVariations.length > 0) {
          setVariations(newVariations);
        } else {
          throw new Error("No images generated");
        }
      } else {
        const newImageUrl = await generateSingle();
        if (newImageUrl) {
          setCurrentImageSrc(newImageUrl);
          // Reset adjustments for the new image
          setZoom(1);
          setRotation(0);
          setBrightness(100);
          setContrast(100);
          setCrop({ x: 0, y: 0 });
          setAiPrompt('');
          setVariations([]);
        } else {
          throw new Error("No images generated");
        }
      }
    } catch (error: any) {
      console.error("AI Edit failed:", error);
      
      let errorText = 'AI Image Editing failed. Please try again later.';
      const msg = error?.message?.toLowerCase() || '';
      const status = error?.status || error?.response?.status;
      
      if (msg.includes('api key') || status === 403 || status === 401 || msg.includes('permission_denied')) {
        errorText = 'Authentication failed: Invalid API key or missing permissions.';
      } else if (msg.includes('quota') || msg.includes('429') || status === 429 || msg.includes('resource_exhausted')) {
        errorText = 'Quota exceeded: You have reached the usage limit for this model. Please check your billing details or wait until your quota resets.';
      } else if (msg.includes('not found') || status === 404) {
        errorText = 'Model not found: The specified AI model is not available or does not exist.';
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
        errorText = 'Network error. Please check your internet connection and try again.';
      } else if (status >= 500) {
        errorText = 'Server error: The AI service is currently experiencing issues. Please try again later.';
      } else if (msg) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) {
                errorText = `Error: ${parsed.error.message}`;
            } else {
                errorText = `Error: ${error.message}`;
            }
        } catch(e) {
            errorText = `Error: ${error.message}`;
        }
      }
      
      alert(errorText);
    } finally {
      setIsAiProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      >
        <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
          <div className="flex items-center justify-between p-4 border-b border-[#3c4043]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#e3e3e3]">
                <FileImage size={20} className="text-[#8ab4f8]" />
                <h2 className="text-lg font-medium">Image Editor</h2>
              </div>
              <div className="flex bg-[#2d2d30] rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('adjust')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'adjust' ? 'bg-[#3c4043] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Adjust
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'ai' ? 'bg-[#3c4043] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  AI Magic
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#2d2d30] rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 min-h-[400px] relative bg-black">
            <Cropper
              image={currentImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={undefined}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              style={{
                containerStyle: { background: 'transparent' },
                mediaStyle: { filter: `brightness(${brightness}%) contrast(${contrast}%)` }
              }}
            />
            {isAiProcessing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white">
                <Loader2 size={32} className="animate-spin text-[#8ab4f8] mb-4" />
                <p className="font-medium animate-pulse">AI is working its magic...</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#0e0e11] border-t border-[#3c4043]">
            {activeTab === 'adjust' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="flex items-center justify-between text-sm text-[#e3e3e3]">
                    <span className="flex items-center gap-2"><Sun size={16}/> Brightness</span>
                    <span className="text-gray-400">{brightness}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" max="200" 
                    value={brightness} 
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-[#8ab4f8]"
                  />
                  
                  <label className="flex items-center justify-between text-sm text-[#e3e3e3]">
                    <span className="flex items-center gap-2"><Contrast size={16}/> Contrast</span>
                    <span className="text-gray-400">{contrast}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" max="200" 
                    value={contrast} 
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-[#8ab4f8]"
                  />
                </div>
                
                <div className="space-y-4">
                   <label className="flex items-center justify-between text-sm text-[#e3e3e3]">
                    <span className="flex items-center gap-2"><RotateCw size={16}/> Rotation</span>
                    <span className="text-gray-400">{rotation}°</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" max="360" 
                    value={rotation} 
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full accent-[#8ab4f8]"
                  />
                  
                  <label className="flex items-center justify-between text-sm text-[#e3e3e3]">
                    <span className="flex items-center gap-2">Zoom</span>
                    <span className="text-gray-400">{zoom.toFixed(1)}x</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="3" step="0.1"
                    value={zoom} 
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-[#8ab4f8]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 flex flex-col gap-3">
                    <textarea
                      rows={2}
                      placeholder="Describe what you want to see (e.g., 'Change background to a dense, mystical forest with glowing mushrooms', 'Make the subject wear sunglasses and a leather jacket')"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isAiProcessing) handleAiEdit();
                        }
                      }}
                      disabled={isAiProcessing}
                      className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-xl px-4 py-3 text-sm text-[#e3e3e3] outline-none focus:border-[#8ab4f8] disabled:opacity-50 resize-none"
                    />
                    <input
                      type="text"
                      placeholder="Negative Prompt: What NOT to include (e.g., 'blurry, distorted, text, watermarks')"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isAiProcessing && handleAiEdit()}
                      disabled={isAiProcessing}
                      className="w-full bg-[#1e1f20]/50 border border-[#3c4043] rounded-lg px-4 py-2 text-xs text-[#b0b0b0] outline-none focus:border-[#8ab4f8] disabled:opacity-50 placeholder-[#6c6f72]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAiEdit(false)}
                      disabled={isAiProcessing || !aiPrompt.trim()}
                      className="px-6 py-3 rounded-xl text-sm font-medium bg-[#3c4043] hover:bg-[#4a4d51] text-white transition-colors flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:hover:bg-[#3c4043] w-full"
                    >
                      <Wand2 size={16} className={isAiProcessing ? "animate-spin" : ""} /> Apply
                    </button>
                    <button
                      onClick={() => handleAiEdit(true)}
                      disabled={isAiProcessing || !aiPrompt.trim()}
                      className="px-4 py-3 rounded-xl text-sm font-medium bg-[#8ab4f8] text-black hover:bg-[#a9c9ff] transition-colors flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:hover:bg-[#8ab4f8] w-full"
                    >
                      Variations (4x)
                    </button>
                  </div>
                </div>

                {variations.length > 0 && (
                  <div className="flex gap-4 items-center">
                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Select Variation:</span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {variations.map((v, i) => (
                        <div key={i} className="relative group cursor-pointer flex-shrink-0" onClick={() => {
                          setCurrentImageSrc(v);
                          setZoom(1);
                          setRotation(0);
                          setBrightness(100);
                          setContrast(100);
                          setCrop({ x: 0, y: 0 });
                        }}>
                          <img 
                            src={v} 
                            className="w-16 h-16 rounded object-cover border border-[#3c4043] hover:border-[#8ab4f8] transition-colors" 
                            alt={`Variation ${i + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Example Prompts</span>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        'Change background to cyberpunk city',
                        'Add dramatic cinematic lighting',
                        'Oil painting in the style of Van Gogh',
                        'Professional studio photography',
                        'Add floating pink neon triangles',
                        'Vintage polaroid photo effect'
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => setAiPrompt(prompt)}
                          disabled={isAiProcessing}
                          className="px-3 py-1.5 rounded-full text-xs bg-[#2d2d30] border border-[#3c4043] text-gray-300 hover:border-[#8ab4f8] hover:text-[#e3e3e3] transition-colors disabled:opacity-50 text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2 block">Negative Prompt Building Blocks (+ to add)</span>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        'blurry, out of focus',
                        'text, watermarks, logos',
                        'malformed, distorted',
                        'overexposed, washed out',
                        'people, faces'
                      ].map((neg) => (
                        <button
                          key={neg}
                          onClick={() => setNegativePrompt(prev => prev ? `${prev}, ${neg}` : neg)}
                          disabled={isAiProcessing}
                          className="px-3 py-1.5 rounded-full text-xs border border-[#3c4043] text-gray-400 hover:bg-[#3c4043]/30 hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          + {neg}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-[#3c4043] flex justify-end gap-3 bg-[#1e1f20]">
             <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#2d2d30] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-[#8ab4f8] text-[#1e1f20] hover:bg-white transition-colors flex items-center gap-2"
            >
               <Check size={16} /> Save Final Image
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = url
  })

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

async function getEditedImage(
  imageSrc: string,
  pixelCrop: any,
  rotation = 0,
  brightness = 100,
  contrast = 100,
  flip = { horizontal: false, vertical: false }
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return imageSrc
  }

  const rotRad = getRadianAngle(rotation)

  const bBoxSize = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxSize.width
  canvas.height = bBoxSize.height

  ctx.translate(bBoxSize.width / 2, bBoxSize.height / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // Apply filters before drawing the full image
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
  ctx.drawImage(image, 0, 0)

  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) {
    return imageSrc
  }

  const safePixelCrop = pixelCrop || { x: 0, y: 0, width: bBoxSize.width, height: bBoxSize.height }

  croppedCanvas.width = safePixelCrop.width
  croppedCanvas.height = safePixelCrop.height

  croppedCtx.drawImage(
    canvas,
    safePixelCrop.x,
    safePixelCrop.y,
    safePixelCrop.width,
    safePixelCrop.height,
    0,
    0,
    safePixelCrop.width,
    safePixelCrop.height
  )

  return new Promise((resolve) => {
    resolve(croppedCanvas.toDataURL('image/jpeg'))
  })
}
