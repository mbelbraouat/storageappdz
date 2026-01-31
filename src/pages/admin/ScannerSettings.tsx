import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Smartphone, Bluetooth, Usb, Wifi, QrCode, Settings2, Info } from 'lucide-react';

const ScannerSettings = () => {
  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Settings2 className="w-7 h-7 text-primary" />
            Configuration Scanner
          </h1>
          <p className="text-muted-foreground mt-1">
            Comment connecter un téléphone ou une douchette pour scanner les boxes
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Mode de fonctionnement</AlertTitle>
          <AlertDescription>
            Lorsque vous scannez un QR code de box, vous accédez directement à la liste des archives qu'elle contient.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Smartphone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Smartphone (Recommandé)
              </CardTitle>
              <CardDescription>
                Utilisez l'application web directement depuis votre téléphone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Ouvrez l'application sur votre téléphone via le navigateur</li>
                <li>Connectez-vous avec vos identifiants</li>
                <li>Allez dans <strong>"Scanner QR"</strong> dans le menu</li>
                <li>Autorisez l'accès à la caméra</li>
                <li>Pointez la caméra vers le QR code de la box</li>
                <li>La liste des enveloppes s'affiche automatiquement</li>
              </ol>
              <div className="p-3 bg-accent/30 rounded-lg text-sm">
                <strong>Avantage:</strong> Aucune installation requise, fonctionne sur tous les smartphones avec navigateur moderne.
              </div>
            </CardContent>
          </Card>

          {/* USB Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Usb className="w-5 h-5 text-warning" />
                Douchette USB
              </CardTitle>
              <CardDescription>
                Scanners code-barres filaires connectés à un ordinateur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Connectez la douchette USB à votre ordinateur</li>
                <li>La plupart fonctionnent en mode "clavier" (HID)</li>
                <li>Ouvrez l'application et allez sur <strong>"Scanner QR"</strong></li>
                <li>Placez le curseur dans le champ de recherche</li>
                <li>Scannez le QR code - les données s'inscrivent automatiquement</li>
                <li>Appuyez sur Entrée ou le scanner le fait automatiquement</li>
              </ol>
              <div className="p-3 bg-accent/30 rounded-lg text-sm">
                <strong>Configuration:</strong> Réglez la douchette en mode "2D QR Code" si nécessaire (voir manuel du fabricant).
              </div>
            </CardContent>
          </Card>

          {/* Bluetooth Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bluetooth className="w-5 h-5 text-info" />
                Douchette Bluetooth
              </CardTitle>
              <CardDescription>
                Scanners sans fil Bluetooth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Mettez la douchette en mode appairage (voir manuel)</li>
                <li>Sur votre appareil, activez Bluetooth et appairez</li>
                <li>La douchette fonctionne ensuite comme un clavier</li>
                <li>Même fonctionnement que la douchette USB</li>
              </ol>
              <div className="p-3 bg-accent/30 rounded-lg text-sm">
                <strong>Marques compatibles:</strong> Zebra, Honeywell, Symbol, Datalogic, Netum, etc.
              </div>
            </CardContent>
          </Card>

          {/* WiFi Scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-success" />
                Terminal WiFi
              </CardTitle>
              <CardDescription>
                Terminaux de collecte de données professionnels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Connectez le terminal au réseau WiFi</li>
                <li>Ouvrez le navigateur intégré du terminal</li>
                <li>Accédez à l'URL de l'application</li>
                <li>Connectez-vous et utilisez le scanner intégré</li>
              </ol>
              <div className="p-3 bg-accent/30 rounded-lg text-sm">
                <strong>Terminaux recommandés:</strong> Zebra TC21/TC26, Honeywell CT40/CT60, Datalogic Memor
              </div>
            </CardContent>
          </Card>
        </div>

        {/* QR Code Format */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              Format des QR Codes
            </CardTitle>
            <CardDescription>
              Informations techniques sur les QR codes générés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Contenu du QR Code</h4>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "t": "box",      // Type
  "i": "uuid...",  // ID unique
  "n": "Box A1",   // Nom
  "b": 42          // Numéro
}`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium mb-2">Spécifications</h4>
                <ul className="text-sm space-y-1">
                  <li>• Format: QR Code 2D</li>
                  <li>• Correction d'erreur: Niveau M (15%)</li>
                  <li>• Taille d'impression: 50mm x 30mm</li>
                  <li>• Compatible imprimantes thermiques</li>
                  <li>• Encodage: UTF-8 JSON</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ScannerSettings;
