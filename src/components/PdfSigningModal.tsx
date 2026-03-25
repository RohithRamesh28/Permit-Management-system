import { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle, ZoomIn, ZoomOut, Type, PenTool, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PdfSigningModalProps {
  pdfUrl: string;
  pdfName: string;
  onClose: () => void;
  onApprove: (signatureData: string, signerName: string, position: { x: number; y: number }) => void;
  signerName?: string;
}

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', style: "'Dancing Script', cursive" },
  { name: 'Great Vibes', style: "'Great Vibes', cursive" },
  { name: 'Allura', style: "'Allura', cursive" },
  { name: 'Pacifico', style: "'Pacifico', cursive" },
  { name: 'Sacramento', style: "'Sacramento', cursive" },
  { name: 'Pinyon Script', style: "'Pinyon Script', cursive" },
  { name: 'Tangerine', style: "'Tangerine', cursive" },
  { name: 'Satisfy', style: "'Satisfy', cursive" },
  { name: 'Marck Script', style: "'Marck Script', cursive" },
  { name: 'Kaushan Script', style: "'Kaushan Script', cursive" },
];

export default function PdfSigningModal({ pdfUrl, pdfName, onClose, onApprove }: PdfSigningModalProps) {
  const { userName } = useAuth();

  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [signatureSize, setSignatureSize] = useState({ width: 180, height: 60 });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingClickPosition, setPendingClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [signatureTab, setSignatureTab] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState(userName || '');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [signerNameForApproval, setSignerNameForApproval] = useState(userName || '');

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSignatureModal) {
          setShowSignatureModal(false);
          setPendingClickPosition(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, showSignatureModal]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Kaushan+Script&family=Marck+Script&family=Pacifico&family=Pinyon+Script&family=Sacramento&family=Satisfy&family=Tangerine:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    if (showSignatureModal && signatureTab === 'draw' && drawCanvasRef.current) {
      const canvas = drawCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'transparent';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showSignatureModal, signatureTab]);

  const generateTypedSignature = useCallback((name: string, font: typeof SIGNATURE_FONTS[0]): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 400;
    canvas.height = 120;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = `48px ${font.style}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  }, []);

  const handlePdfMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSignatureModal) return;

    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();

    if (isDragging && signaturePosition) {
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      setSignaturePosition({
        x: Math.max(0, Math.min(newX, rect.width - signatureSize.width)),
        y: Math.max(0, Math.min(newY, rect.height - signatureSize.height)),
      });
    } else if (!signaturePosition && signatureDataUrl) {
      setCursorPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSignatureModal || isDragging) return;

    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (signatureDataUrl && !signaturePosition) {
      setSignaturePosition({
        x: clickX - signatureSize.width / 2,
        y: clickY - signatureSize.height / 2,
      });
      setCursorPosition(null);
    } else if (!signatureDataUrl) {
      setPendingClickPosition({ x: clickX, y: clickY });
      setShowSignatureModal(true);
      setTypedName(userName || '');
    }
  };

  const handleSignatureMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!signaturePosition) return;

    setIsDragging(true);

    const signatureElement = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - signatureElement.left,
      y: e.clientY - signatureElement.top,
    });
  };

  const handleIncreaseSize = () => {
    setSignatureSize(prev => ({
      width: Math.min(prev.width + 30, 350),
      height: Math.min(prev.height + 10, 120),
    }));
  };

  const handleDecreaseSize = () => {
    setSignatureSize(prev => ({
      width: Math.max(prev.width - 30, 100),
      height: Math.max(prev.height - 10, 35),
    }));
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  const handleApprove = () => {
    if (!signaturePosition) {
      alert('Please place your signature on the document');
      return;
    }

    onApprove(signatureDataUrl, signerNameForApproval, signaturePosition);
  };

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    lastPointRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;

    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentPoint = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = currentPoint;
  };

  const handleDrawEnd = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const isDrawCanvasEmpty = (): boolean => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false;
    }
    return true;
  };

  const handleApplySignature = () => {
    let dataUrl = '';
    let name = typedName || userName || '';

    if (signatureTab === 'type') {
      if (!typedName.trim()) {
        alert('Please enter your name');
        return;
      }
      dataUrl = generateTypedSignature(typedName, selectedFont);
      name = typedName;
    } else {
      if (isDrawCanvasEmpty()) {
        alert('Please draw your signature');
        return;
      }
      const canvas = drawCanvasRef.current;
      if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
      }
    }

    setSignatureDataUrl(dataUrl);
    setSignerNameForApproval(name);

    if (pendingClickPosition) {
      setSignaturePosition({
        x: pendingClickPosition.x - signatureSize.width / 2,
        y: pendingClickPosition.y - signatureSize.height / 2,
      });
    }

    setShowSignatureModal(false);
    setPendingClickPosition(null);
  };

  const handleEditSignature = () => {
    setShowSignatureModal(true);
    setTypedName(signerNameForApproval || userName || '');
  };

  const handleRemoveSignature = () => {
    setSignatureDataUrl('');
    setSignaturePosition(null);
    setCursorPosition(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[95vh] flex flex-col" style={{ maxWidth: '90vw' }}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sign and Approve Document</h2>
            <p className="text-sm text-gray-600 mt-1">
              {signatureDataUrl
                ? 'Drag to reposition your signature, or click "Edit" to change it.'
                : 'Click anywhere on the document to add your signature.'}
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

        <div className="flex-1 overflow-auto bg-gray-100 relative" ref={pdfContainerRef}>
          <div
            className="relative p-4 min-h-full flex justify-center"
            onMouseMove={handlePdfMouseMove}
            onClick={handlePdfClick}
            style={{ cursor: signatureDataUrl ? (signaturePosition ? 'default' : 'crosshair') : 'crosshair' }}
          >
            <div
              ref={pdfWrapperRef}
              className="relative bg-white rounded shadow-lg"
              style={{ width: '850px', minHeight: '1100px' }}
            >
              <iframe
                src={pdfUrl}
                title={pdfName}
                className="w-full border-0 rounded"
                style={{ height: '1100px', pointerEvents: 'none' }}
              />

              {cursorPosition && signatureDataUrl && !signaturePosition && (
                <img
                  src={signatureDataUrl}
                  alt="Signature preview"
                  className="absolute pointer-events-none opacity-60 border-2 border-dashed border-blue-400"
                  style={{
                    left: `${cursorPosition.x - signatureSize.width / 2}px`,
                    top: `${cursorPosition.y - signatureSize.height / 2}px`,
                    width: `${signatureSize.width}px`,
                    height: `${signatureSize.height}px`,
                    objectFit: 'contain',
                  }}
                />
              )}

              {signaturePosition && signatureDataUrl && (
                <div
                  className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} group`}
                  style={{
                    left: `${signaturePosition.x}px`,
                    top: `${signaturePosition.y}px`,
                  }}
                  onMouseDown={handleSignatureMouseDown}
                >
                  <img
                    src={signatureDataUrl}
                    alt="Signature"
                    className="border-2 border-transparent group-hover:border-blue-400 transition-colors"
                    style={{
                      width: `${signatureSize.width}px`,
                      height: `${signatureSize.height}px`,
                      objectFit: 'contain',
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditSignature();
                    }}
                    className="absolute -top-8 left-0 px-2 py-1 bg-blue-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSignature();
                    }}
                    className="absolute -top-8 left-14 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-4">
            {signatureDataUrl && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Size:</span>
                <button
                  onClick={handleDecreaseSize}
                  disabled={signatureSize.width <= 100}
                  className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Decrease signature size"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  onClick={handleIncreaseSize}
                  disabled={signatureSize.width >= 350}
                  className="p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Increase signature size"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            )}
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
      </div>

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Your Signature</h3>
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setPendingClickPosition(null);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setSignatureTab('type')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  signatureTab === 'type'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Type size={18} />
                Type Name
              </button>
              <button
                onClick={() => setSignatureTab('draw')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  signatureTab === 'draw'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <PenTool size={18} />
                Draw Signature
              </button>
            </div>

            <div className="p-4">
              {signatureTab === 'type' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Style
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {SIGNATURE_FONTS.map((font) => (
                        <button
                          key={font.name}
                          onClick={() => setSelectedFont(font)}
                          className={`p-3 border-2 rounded-lg text-center transition-all ${
                            selectedFont.name === font.name
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span
                            style={{ fontFamily: font.style, fontSize: '24px' }}
                            className="text-gray-900"
                          >
                            {typedName || 'Your Name'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preview
                    </label>
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[80px]">
                      <span
                        style={{ fontFamily: selectedFont.style, fontSize: '36px' }}
                        className="text-gray-900"
                      >
                        {typedName || 'Your Name'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {signatureTab === 'draw' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Draw Your Signature
                      </label>
                      <button
                        onClick={clearDrawCanvas}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <RotateCcw size={14} />
                        Clear
                      </button>
                    </div>
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                      <canvas
                        ref={drawCanvasRef}
                        width={460}
                        height={150}
                        className="w-full touch-none cursor-crosshair"
                        style={{ touchAction: 'none' }}
                        onMouseDown={handleDrawStart}
                        onMouseMove={handleDrawMove}
                        onMouseUp={handleDrawEnd}
                        onMouseLeave={handleDrawEnd}
                        onTouchStart={handleDrawStart}
                        onTouchMove={handleDrawMove}
                        onTouchEnd={handleDrawEnd}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use your mouse or touchpad to draw your signature
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setPendingClickPosition(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySignature}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
