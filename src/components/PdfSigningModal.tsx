import { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle, ZoomIn, ZoomOut, Type, PenTool, RotateCcw, Copy, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SignatureItem {
  id: string;
  dataUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  signerName: string;
}

interface PdfSigningModalProps {
  pdfUrl: string;
  pdfName: string;
  onClose: () => void;
  onApprove: (signatures: Array<{ signatureData: string; signerName: string; position: { x: number; y: number }; size: { width: number; height: number } }>) => void;
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

const DEFAULT_SIGNATURE_SIZE = { width: 180, height: 60 };

export default function PdfSigningModal({ pdfUrl, pdfName, onClose, onApprove }: PdfSigningModalProps) {
  const { userName } = useAuth();

  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingClickPosition, setPendingClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [signatureTab, setSignatureTab] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState(userName || '');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]);
  const [createdSignatures, setCreatedSignatures] = useState<Array<{ dataUrl: string; signerName: string }>>([]);
  const [selectedCreatedSignature, setSelectedCreatedSignature] = useState<number | null>(null);
  const [pendingSignatureDataUrl, setPendingSignatureDataUrl] = useState<string>('');
  const [pendingSignerName, setPendingSignerName] = useState<string>('');

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

  const generateId = () => `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handlePdfMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSignatureModal) return;

    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();

    if (isDragging && activeSignatureId) {
      const activeSignature = signatures.find(s => s.id === activeSignatureId);
      if (!activeSignature) return;

      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      setSignatures(prev => prev.map(sig =>
        sig.id === activeSignatureId
          ? {
              ...sig,
              position: {
                x: Math.max(0, Math.min(newX, rect.width - sig.size.width)),
                y: Math.max(0, Math.min(newY, rect.height - sig.size.height)),
              }
            }
          : sig
      ));
    } else if (pendingSignatureDataUrl) {
      setCursorPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSignatureModal || isDragging) return;

    const target = e.target as HTMLElement;
    if (target.closest('.signature-item')) return;

    const wrapper = pdfWrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (pendingSignatureDataUrl) {
      const newSignature: SignatureItem = {
        id: generateId(),
        dataUrl: pendingSignatureDataUrl,
        position: {
          x: clickX - DEFAULT_SIGNATURE_SIZE.width / 2,
          y: clickY - DEFAULT_SIGNATURE_SIZE.height / 2,
        },
        size: { ...DEFAULT_SIGNATURE_SIZE },
        signerName: pendingSignerName,
      };
      setSignatures(prev => [...prev, newSignature]);
      setActiveSignatureId(newSignature.id);
      setPendingSignatureDataUrl('');
      setPendingSignerName('');
      setCursorPosition(null);
    } else {
      setPendingClickPosition({ x: clickX, y: clickY });
      setShowSignatureModal(true);
      setTypedName(userName || '');
      setSelectedCreatedSignature(null);
    }
  };

  const handleSignatureMouseDown = (e: React.MouseEvent, signatureId: string) => {
    e.stopPropagation();
    e.preventDefault();

    setActiveSignatureId(signatureId);
    setIsDragging(true);

    const signatureElement = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - signatureElement.left,
      y: e.clientY - signatureElement.top,
    });
  };

  const handleIncreaseSize = (signatureId: string) => {
    setSignatures(prev => prev.map(sig =>
      sig.id === signatureId
        ? {
            ...sig,
            size: {
              width: Math.min(sig.size.width + 30, 350),
              height: Math.min(sig.size.height + 10, 120),
            }
          }
        : sig
    ));
  };

  const handleDecreaseSize = (signatureId: string) => {
    setSignatures(prev => prev.map(sig =>
      sig.id === signatureId
        ? {
            ...sig,
            size: {
              width: Math.max(sig.size.width - 30, 100),
              height: Math.max(sig.size.height - 10, 35),
            }
          }
        : sig
    ));
  };

  const handleRemoveSignature = (signatureId: string) => {
    setSignatures(prev => prev.filter(sig => sig.id !== signatureId));
    if (activeSignatureId === signatureId) {
      setActiveSignatureId(null);
    }
  };

  const handleCopySignature = (signatureId: string) => {
    const signatureToCopy = signatures.find(s => s.id === signatureId);
    if (!signatureToCopy) return;

    const newSignature: SignatureItem = {
      id: generateId(),
      dataUrl: signatureToCopy.dataUrl,
      position: {
        x: signatureToCopy.position.x + 20,
        y: signatureToCopy.position.y + 20,
      },
      size: { ...signatureToCopy.size },
      signerName: signatureToCopy.signerName,
    };
    setSignatures(prev => [...prev, newSignature]);
    setActiveSignatureId(newSignature.id);
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
    if (signatures.length === 0) {
      alert('Please place at least one signature on the document');
      return;
    }

    const signatureData = signatures.map(sig => ({
      signatureData: sig.dataUrl,
      signerName: sig.signerName,
      position: sig.position,
      size: sig.size,
    }));

    onApprove(signatureData);
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
    if (selectedCreatedSignature !== null && createdSignatures[selectedCreatedSignature]) {
      const selected = createdSignatures[selectedCreatedSignature];
      if (pendingClickPosition) {
        const newSignature: SignatureItem = {
          id: generateId(),
          dataUrl: selected.dataUrl,
          position: {
            x: pendingClickPosition.x - DEFAULT_SIGNATURE_SIZE.width / 2,
            y: pendingClickPosition.y - DEFAULT_SIGNATURE_SIZE.height / 2,
          },
          size: { ...DEFAULT_SIGNATURE_SIZE },
          signerName: selected.signerName,
        };
        setSignatures(prev => [...prev, newSignature]);
        setActiveSignatureId(newSignature.id);
      }
      setShowSignatureModal(false);
      setPendingClickPosition(null);
      setSelectedCreatedSignature(null);
      return;
    }

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

    setCreatedSignatures(prev => [...prev, { dataUrl, signerName: name }]);

    if (pendingClickPosition) {
      const newSignature: SignatureItem = {
        id: generateId(),
        dataUrl,
        position: {
          x: pendingClickPosition.x - DEFAULT_SIGNATURE_SIZE.width / 2,
          y: pendingClickPosition.y - DEFAULT_SIGNATURE_SIZE.height / 2,
        },
        size: { ...DEFAULT_SIGNATURE_SIZE },
        signerName: name,
      };
      setSignatures(prev => [...prev, newSignature]);
      setActiveSignatureId(newSignature.id);
    }

    setShowSignatureModal(false);
    setPendingClickPosition(null);
  };

  const handleCreateNewSignature = () => {
    setPendingClickPosition(null);
    setShowSignatureModal(true);
    setTypedName(userName || '');
    setSelectedCreatedSignature(null);
  };

  const handleUseExistingSignature = (index: number) => {
    const existing = createdSignatures[index];
    if (!existing) return;

    setPendingSignatureDataUrl(existing.dataUrl);
    setPendingSignerName(existing.signerName);
    setShowSignatureModal(false);
    setPendingClickPosition(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-[95vh] flex flex-col" style={{ maxWidth: '90vw' }}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sign and Approve Document</h2>
            <p className="text-sm text-gray-600 mt-1">
              {pendingSignatureDataUrl
                ? 'Click anywhere on the document to place your signature.'
                : signatures.length > 0
                  ? 'Drag signatures to reposition. Click document to add more signatures.'
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
            style={{ cursor: pendingSignatureDataUrl ? 'crosshair' : 'default' }}
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

              {cursorPosition && pendingSignatureDataUrl && (
                <img
                  src={pendingSignatureDataUrl}
                  alt="Signature preview"
                  className="absolute pointer-events-none opacity-60 border-2 border-dashed border-blue-400"
                  style={{
                    left: `${cursorPosition.x - DEFAULT_SIGNATURE_SIZE.width / 2}px`,
                    top: `${cursorPosition.y - DEFAULT_SIGNATURE_SIZE.height / 2}px`,
                    width: `${DEFAULT_SIGNATURE_SIZE.width}px`,
                    height: `${DEFAULT_SIGNATURE_SIZE.height}px`,
                    objectFit: 'contain',
                  }}
                />
              )}

              {signatures.map((signature) => (
                <div
                  key={signature.id}
                  className={`signature-item absolute ${isDragging && activeSignatureId === signature.id ? 'cursor-grabbing' : 'cursor-grab'} group`}
                  style={{
                    left: `${signature.position.x}px`,
                    top: `${signature.position.y}px`,
                  }}
                  onMouseDown={(e) => handleSignatureMouseDown(e, signature.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSignatureId(signature.id);
                  }}
                >
                  <img
                    src={signature.dataUrl}
                    alt="Signature"
                    className={`border-2 transition-colors ${activeSignatureId === signature.id ? 'border-blue-500' : 'border-transparent group-hover:border-blue-400'}`}
                    style={{
                      width: `${signature.size.width}px`,
                      height: `${signature.size.height}px`,
                      objectFit: 'contain',
                    }}
                  />
                  <div className="absolute -top-10 left-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecreaseSize(signature.id);
                      }}
                      disabled={signature.size.width <= 100}
                      className="p-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIncreaseSize(signature.id);
                      }}
                      disabled={signature.size.width >= 350}
                      className="p-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom in"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySignature(signature.id);
                      }}
                      className="p-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      title="Copy signature"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSignature(signature.id);
                      }}
                      className="p-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      title="Remove signature"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-4">
            {createdSignatures.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Your signatures:</span>
                <div className="flex gap-2">
                  {createdSignatures.map((sig, index) => (
                    <button
                      key={index}
                      onClick={() => handleUseExistingSignature(index)}
                      className="p-1 border border-gray-300 rounded hover:border-blue-500 transition-colors"
                      title={`Use ${sig.signerName}'s signature`}
                    >
                      <img
                        src={sig.dataUrl}
                        alt={`Signature ${index + 1}`}
                        className="h-8 w-auto object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleCreateNewSignature}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus size={16} />
              Create New Signature
            </button>
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
              disabled={signatures.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} />
              Approve with Signature{signatures.length > 1 ? 's' : ''}
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
                  setSelectedCreatedSignature(null);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {createdSignatures.length > 0 && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use an existing signature
                </label>
                <div className="flex gap-2 flex-wrap">
                  {createdSignatures.map((sig, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedCreatedSignature(index)}
                      className={`p-2 border-2 rounded-lg transition-all ${
                        selectedCreatedSignature === index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={sig.dataUrl}
                        alt={`Signature ${index + 1}`}
                        className="h-10 w-auto object-contain"
                      />
                    </button>
                  ))}
                </div>
                {selectedCreatedSignature !== null && (
                  <button
                    onClick={handleApplySignature}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Use Selected Signature
                  </button>
                )}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">Or create a new signature below</p>
                </div>
              </div>
            )}

            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {
                  setSignatureTab('type');
                  setSelectedCreatedSignature(null);
                }}
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
                onClick={() => {
                  setSignatureTab('draw');
                  setSelectedCreatedSignature(null);
                }}
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
                  setSelectedCreatedSignature(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplySignature}
                disabled={selectedCreatedSignature !== null}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
