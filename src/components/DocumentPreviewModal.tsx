import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DocumentPreviewModalProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  onClose: () => void;
}

export default function DocumentPreviewModal({ fileUrl, fileName, fileType, onClose }: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-4">{fileName}</h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close preview"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading preview...</div>
            </div>
          )}

          {isImage && (
            <div className="flex items-center justify-center h-full">
              <img
                src={fileUrl}
                alt={fileName}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {isPDF && (
            <iframe
              src={fileUrl}
              title={fileName}
              onLoad={() => setIsLoading(false)}
              className="w-full h-full border-0 rounded"
            />
          )}

          {!isImage && !isPDF && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-600 mb-4">Preview not available for this file type</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#0072BC] text-white rounded-lg hover:bg-[#005a94] transition-colors"
              >
                Download File
              </a>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {isImage && 'Image preview'}
              {isPDF && 'PDF preview'}
              {!isImage && !isPDF && 'File preview'}
            </span>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#0072BC] hover:text-[#005a94] font-medium"
            >
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
