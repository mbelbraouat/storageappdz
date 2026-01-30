import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface QRCodeGeneratorProps {
  boxId: string;
  boxName: string;
  location: string;
  size?: number;
}

const QRCodeGenerator = ({ boxId, boxName, location, size = 150 }: QRCodeGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    generateQRCode();
  }, [boxId, boxName]);

  const generateQRCode = async () => {
    if (!canvasRef.current) return;

    const qrData = JSON.stringify({
      type: 'archive_box',
      id: boxId,
      name: boxName,
      location: location,
    });

    try {
      await QRCode.toCanvas(canvasRef.current, qrData, {
        width: size,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#ffffff',
        },
      });

      const dataUrl = canvasRef.current.toDataURL('image/png');
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `QR-${boxName.replace(/\s+/g, '-')}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code - ${boxName}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
              }
              .container {
                text-align: center;
                padding: 20px;
                border: 2px solid #333;
                border-radius: 10px;
              }
              h2 { margin: 0 0 10px 0; }
              p { margin: 5px 0; color: #666; }
              img { margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>${boxName}</h2>
              <p>${location}</p>
              <img src="${qrDataUrl}" alt="QR Code" />
              <p>Scan pour accéder à la box</p>
            </div>
            <script>window.onload = () => { window.print(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} className="rounded-lg" />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Télécharger
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimer
        </Button>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
