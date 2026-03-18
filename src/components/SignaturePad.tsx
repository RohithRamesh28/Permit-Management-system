import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'signature_pad';

interface SignaturePadProps {
  onSignatureChange?: (dataUrl: string) => void;
}

export interface SignaturePadRef {
  clear: () => void;
  toDataURL: () => string;
  isEmpty: () => boolean;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onSignatureChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignatureCanvas | null>(null);

    useEffect(() => {
      if (canvasRef.current && !signaturePadRef.current) {
        const canvas = canvasRef.current;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);

        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(ratio, ratio);
        }

        signaturePadRef.current = new SignatureCanvas(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)',
        });

        signaturePadRef.current.addEventListener('endStroke', () => {
          if (signaturePadRef.current && onSignatureChange) {
            onSignatureChange(signaturePadRef.current.toDataURL());
          }
        });

        const handleResize = () => {
          if (canvasRef.current && signaturePadRef.current) {
            const resizeRatio = Math.max(window.devicePixelRatio || 1, 1);
            const resizeCanvas = canvasRef.current;
            const data = signaturePadRef.current.toData();

            resizeCanvas.width = resizeCanvas.offsetWidth * resizeRatio;
            resizeCanvas.height = resizeCanvas.offsetHeight * resizeRatio;
            const resizeCtx = resizeCanvas.getContext('2d');
            if (resizeCtx) {
              resizeCtx.scale(resizeRatio, resizeRatio);
            }

            signaturePadRef.current.clear();
            signaturePadRef.current.fromData(data);
          }
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (signaturePadRef.current) {
            signaturePadRef.current.off();
          }
        };
      }
    }, [onSignatureChange]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        signaturePadRef.current?.clear();
      },
      toDataURL: () => {
        return signaturePadRef.current?.toDataURL() || '';
      },
      isEmpty: () => {
        return signaturePadRef.current?.isEmpty() ?? true;
      },
    }));

    return (
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
