
import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SignaturePadProps {
  onSignatureCapture: (signatureDataUrl: string) => void;
  width?: number;
  height?: number;
  clearAfterCapture?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureCapture,
  width = 500,
  height = 200,
  clearAfterCapture = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set up the canvas
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.fillStyle = 'white';
    
    // Fill with white background
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    setCtx(context);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setIsEmpty(false);
    
    if (!ctx) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      e.preventDefault(); // Prevent scrolling while drawing
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      ctx?.closePath();
      setIsDrawing(false);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const captureSignature = () => {
    if (isEmpty) {
      toast.error("Please sign before submitting");
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureCapture(dataUrl);
      
      if (clearAfterCapture) {
        clearSignature();
      }
      
      toast.success("Signature captured successfully");
    } catch (error) {
      console.error("Error capturing signature:", error);
      toast.error("Failed to capture signature");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="border border-gray-300 rounded-md bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={clearSignature}>
          Clear
        </Button>
        <Button onClick={captureSignature}>
          Capture Signature
        </Button>
      </div>
    </div>
  );
};
