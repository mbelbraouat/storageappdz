import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QrCode, Search, Camera, Box, Archive } from 'lucide-react';

const ScanQR = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [manualCode, setManualCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    // Check if camera is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setHasCamera(true);
    }
  }, []);

  const handleManualSearch = async () => {
    if (!manualCode.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez entrer un code', variant: 'destructive' });
      return;
    }

    setIsSearching(true);

    try {
      // Try to parse as JSON (QR code data)
      let searchData: { type?: string; id?: string; name?: string } = {};
      
      try {
        searchData = JSON.parse(manualCode);
      } catch {
        // If not JSON, search by box name
        searchData = { name: manualCode };
      }

      if (searchData.type === 'archive_box' && searchData.id) {
        // Direct box ID lookup
        const { data: box, error } = await supabase
          .from('archive_boxes')
          .select('*')
          .eq('id', searchData.id)
          .single();

        if (error) throw error;
        
        if (box) {
          navigate(`/boxes?highlight=${box.id}`);
          return;
        }
      }

      // Search by name
      const searchTerm = searchData.name || manualCode;
      const { data: boxes, error } = await supabase
        .from('archive_boxes')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .limit(1);

      if (error) throw error;

      if (boxes && boxes.length > 0) {
        navigate(`/boxes?highlight=${boxes[0].id}`);
      } else {
        toast({
          title: 'Non trouvé',
          description: 'Aucune box trouvée avec ce code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la recherche',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const startCamera = async () => {
    try {
      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        videoRef.current.srcObject = stream;
        setCameraError(null);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Scanner QR Code</h1>
          <p className="text-muted-foreground mt-1">
            Scannez un QR code ou entrez le code manuellement
          </p>
        </div>

        {/* Camera Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Scanner avec la caméra</h2>
          </div>
          
          {hasCamera ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <p className="text-muted-foreground text-center px-4">{cameraError}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={startCamera} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Démarrer la caméra
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Arrêter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Note: Le scan automatique de QR code nécessite une bibliothèque de décodage supplémentaire.
                Utilisez la recherche manuelle pour le moment.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Caméra non disponible sur cet appareil</p>
            </div>
          )}
        </Card>

        {/* Manual Search */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Recherche manuelle</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Entrez le nom ou code de la box..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              />
              <Button onClick={handleManualSearch} disabled={isSearching} className="gap-2">
                <Search className="w-4 h-4" />
                {isSearching ? 'Recherche...' : 'Rechercher'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Accès rapide</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/boxes')}
            >
              <Box className="w-6 h-6 text-primary" />
              <span>Toutes les boxes</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/archives')}
            >
              <Archive className="w-6 h-6 text-primary" />
              <span>Archives</span>
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ScanQR;
