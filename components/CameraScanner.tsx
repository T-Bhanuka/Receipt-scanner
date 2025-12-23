
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface CameraScannerProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError("Camera permission denied. Please allow camera access in your settings.");
        console.error(err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
      }
    }
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
      <div className="p-5 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <h2 className="text-slate-100 font-black text-xl tracking-tight">Scanner View</h2>
        <button 
          onClick={onClose}
          className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-center p-8 bg-slate-900 rounded-3xl m-4 border border-slate-800">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <p className="text-slate-300 mb-6 font-medium leading-relaxed">{error}</p>
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-purple-600 text-white font-black rounded-2xl hover:bg-purple-500 transition-all shadow-xl shadow-purple-500/20"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 border-[60px] border-black/60 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-purple-500/80 rounded-[2rem] relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-400 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-400 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-400 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-400 rounded-br-lg"></div>
              </div>
            </div>
            <p className="absolute bottom-10 left-0 right-0 text-center text-white/50 text-sm font-bold uppercase tracking-widest bg-black/40 py-2">
              Center receipt in frame
            </p>
          </>
        )}
      </div>

      <div className="p-10 bg-slate-900 flex justify-center items-center border-t border-slate-800">
        <button 
          onClick={captureImage}
          disabled={!!error}
          className="group relative w-24 h-24 flex items-center justify-center disabled:opacity-50 transition-all active:scale-90"
        >
          <div className="absolute inset-0 bg-purple-600 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
          <div className="relative w-20 h-20 bg-white rounded-full border-[6px] border-slate-950 shadow-2xl flex items-center justify-center">
             <div className="w-16 h-16 rounded-full border-2 border-slate-200"></div>
          </div>
        </button>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraScanner;
