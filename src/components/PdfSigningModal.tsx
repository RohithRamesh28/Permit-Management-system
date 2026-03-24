import { useState, useRef, useEffect } from 'react';
import { X, CheckCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { SignaturePad, SignaturePadRef } from './SignaturePad';

interface PdfSigningModalProps {
  pdfUrl: string;
  pdfName: string;
  onClose: () => void;
  onApprove: (signatureData: string, signerName: string, position: { x: number; y: number }) => void;
}

type SigningStep = 'draw' | 'place';

export default function PdfSigningModal({ pdfUrl, pdfName, onClose, onApprove }: PdfSigningModalProps) {
  const [step, setStep] = useState<SigningStep>('draw');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signerName, setSignerName] = useState('');
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [signatureSize, setSignatureSize] = useState({ width: 150, height: 50 });
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDrawSignature = () => {
    if (!signerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      alert('Please draw your signature');
      return;
    }

    const dataUrl = signaturePadRef.current.toDataURL();
    setSignatureDataUrl(dataUrl);
    setStep('place');
  };

  const handlePdfMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'place') return;

    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollTop = pdfContainerRef.current?.parentElement?.scrollTop || 0;
    const scrollLeft = pdfContainerRef.current?.parentElement?.scrollLeft || 0;

    if (isDragging && signaturePosition) {
      setSignaturePosition({
        x: e.clientX - rect.left + scrollLeft - dragOffset.x,
        y: e.clientY - rect.top + scrollTop - dragOffset.y,
      });
    } else if (!signaturePosition) {
      setCursorPosition({
        x: e.clientX - rect.left + scrollLeft,
        y: e.clientY - rect.top + scrollTop,
      });
    }
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'place' || !signatureDataUrl) return;

    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollTop = pdfContainerRef.current?.parentElement?.scrollTop || 0;
    const scrollLeft = pdfContainerRef.current?.parentElement?.scrollLeft || 0;

    if (!signaturePosition) {
      setSignaturePosition({
        x: e.clientX - rect.left + scrollLeft - signatureSize.width / 2,
        y: e.clientY - rect.top + scrollTop - signatureSize.height / 2,
      });
      setCursorPosition(null);
    }
  };

  const handleSignatureMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signaturePosition) return;

    setIsDragging(true);
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    const scrollTop = pdfContainerRef.current?.parentElement?.scrollTop || 0;
    const scrollLeft = pdfContainerRef.current?.parentElement?.scrollLeft || 0;

    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left + scrollLeft - signaturePosition.x,
        y: e.clientY - rect.top + scrollTop - signaturePosition.y,
      });
    }
  };

  const handleIncreaseSize = () => {
    setSignatureSize(prev => ({
      width: Math.min(prev.width + 30, 300),
      height: Math.min(prev.height + 10, 100),
    }));
  };

  const handleDecreaseSize = () => {
    setSignatureSize(prev => ({
      width: Math.max(prev.width - 30, 90),
      height: Math.max(prev.height - 10, 30),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  const handleApprove = () => {
    if (!signaturePosition) {
      alert('Please place your signature on the document');
      return;
    }

    onApprove(signatureDataUrl, signerName, signaturePosition);
  };

  const handleBackToDrawing = () => {
    setStep('draw');
    setSignaturePosition(null);
    setCursorPosition(null);
    setSignatureDataUrl('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[95vh] flex flex-col" style={{ maxWidth: step === 'draw' ? '500px' : '90vw' }}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'draw' ? 'Draw Your Signature' : 'Place Signature on Document'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'draw'
                ? 'Draw your signature and enter your name to continue'
                : 'Click anywhere on the document to place your signature. You can drag to reposition it.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {step === 'draw' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-md mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draw Your Signature <span className="text-red-500">*</span>
                </label>
                <SignaturePad ref={signaturePadRef} />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">Use your mouse or touchpad to sign</p>
                  <button
                    type="button"
                    onClick={() => signaturePadRef.current?.clear()}
                    className="text-xs text-[#0072BC] hover:text-[#005a94] font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDrawSignature}
                  className="px-6 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
                >
                  Next: Place Signature
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'place' && (
          <>
            <div className="flex-1 overflow-auto bg-gray-100 relative">
              <div
                ref={pdfContainerRef}
                className="relative min-h-full p-4"
                onMouseMove={handlePdfMouseMove}
                onClick={handlePdfClick}
                style={{ cursor: signaturePosition ? 'default' : 'crosshair' }}
              >
                <div className="relative bg-white rounded shadow-lg mx-auto" style={{ maxWidth: '800px' }}>
                  <iframe
                    src={pdfUrl}
                    title={pdfName}
                    className="w-full border-0 rounded"
                    style={{ height: '1000px', pointerEvents: 'none' }}
                  />

                  {cursorPosition && !signaturePosition && (
                    <div
                      className="absolute pointer-events-none opacity-70 z-10"
                      style={{
                        left: `${cursorPosition.x - signatureSize.width / 2}px`,
                        top: `${cursorPosition.y - signatureSize.height / 2}px`,
                      }}
                    >
                      <img
                        src={signatureDataUrl}
                        alt="Signature preview"
                        className="border-2 border-dashed border-blue-500 bg-white"
                        style={{ width: `${signatureSize.width}px`, height: `${signatureSize.height}px` }}
                      />
                    </div>
                  )}

                  {signaturePosition && (
                    <div
                      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} shadow-lg z-10`}
                      style={{
                        left: `${signaturePosition.x}px`,
                        top: `${signaturePosition.y}px`,
                      }}
                      onMouseDown={handleSignatureMouseDown}
                    >
                      <img
                        src={signatureDataUrl}
                        alt="Signature"
                        className="border-2 border-blue-500 bg-white"
                        style={{ width: `${signatureSize.width}px`, height: `${signatureSize.height}px` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToDrawing}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to Drawing
                </button>

                <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
                  <span className="text-sm text-gray-600 font-medium">Size:</span>
                  <button
                    onClick={handleDecreaseSize}
                    disabled={signatureSize.width <= 90}
                    className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Decrease signature size"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={handleIncreaseSize}
                    disabled={signatureSize.width >= 300}
                    className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Increase signature size"
                  >
                    <ZoomIn size={18} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!signaturePosition}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} />
                  Approve with Signature
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
