import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface QRCodeGeneratorProps {
  boxId: string;
  boxName: string;
  boxNumber?: number | null;
  location: string;
  size?: number;
}

const QRCodeGenerator = ({ boxId, boxName, boxNumber, location, size = 200 }: QRCodeGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    generateQRCode();
  }, [boxId, boxName, boxNumber]);

  const generateQRCode = async () => {
    if (!canvasRef.current) return;

    // QR data optimized for scanning
    const qrData = JSON.stringify({
      t: 'box', // type
      i: boxId, // id
      n: boxName, // name
      b: boxNumber, // box number
    });

    try {
      await QRCode.toCanvas(canvasRef.current, qrData, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
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
    const safeName = boxName.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `QR_Box_${boxNumber || safeName}.png`;
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
              @page {
                size: 50mm 30mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: Arial, sans-serif;
              }
              .label {
                width: 48mm;
                height: 28mm;
                border: 1px solid #000;
                display: flex;
                flex-direction: row;
                align-items: center;
                padding: 2mm;
                box-sizing: border-box;
              }
              .qr-section {
                flex-shrink: 0;
              }
              .qr-section img {
                width: 22mm;
                height: 22mm;
              }
              .info-section {
                flex: 1;
                padding-left: 2mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
              }
              .box-name {
                font-size: 9pt;
                font-weight: bold;
                margin: 0 0 1mm 0;
                line-height: 1.1;
              }
              .box-number {
                font-size: 14pt;
                font-weight: bold;
                margin: 0 0 1mm 0;
              }
              .location {
                font-size: 7pt;
                color: #333;
                margin: 0;
                line-height: 1.1;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="qr-section">
                <img src="${qrDataUrl}" alt="QR Code" />
              </div>
              <div class="info-section">
                <p class="box-name">${boxName}</p>
                ${boxNumber ? `<p class="box-number">#${boxNumber}</p>` : ''}
                <p class="location">${location}</p>
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 250);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <canvas ref={canvasRef} className="block" />
      </div>
      
      <div className="text-center">
        <p className="font-semibold">{boxName}</p>
        {boxNumber && <p className="text-lg font-bold">#{boxNumber}</p>}
        <p className="text-sm text-muted-foreground">{location}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Télécharger
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimer (50x30mm)
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Format optimisé pour étiquettes code-barres standard (50x30mm).
        Compatible avec imprimantes thermiques.
      </p>
    </div>
  );
};

export default QRCodeGenerator;
