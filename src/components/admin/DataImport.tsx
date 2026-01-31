import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DataImportProps {
  onImportComplete?: () => void;
}

const DataImport = ({ onImportComplete }: DataImportProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [importType, setImportType] = useState<'doctors' | 'operations'>('doctors');
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      const data = lines.map(line => {
        // Handle both comma and semicolon separators
        const separator = line.includes(';') ? ';' : ',';
        return line.split(separator).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
      });
      setPreviewData(data.slice(0, 6)); // Show first 5 rows + header
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!file) return;
    
    setIsImporting(true);
    setImportResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        const separator = lines[0]?.includes(';') ? ';' : ',';
        const rows = lines.slice(1).map(line => 
          line.split(separator).map(cell => cell.trim().replace(/^["']|["']$/g, ''))
        );

        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            if (importType === 'doctors') {
              // Format: full_name, specialty (optional), local_archive (optional: true/false)
              const [fullName, specialty, localArchive] = row;
              if (!fullName?.trim()) continue;

              const { error } = await supabase.from('doctors').insert({
                full_name: fullName.trim(),
                specialty: specialty?.trim() || null,
                local_archive: localArchive?.toLowerCase() === 'true' || localArchive === '1',
              });

              if (error) throw error;
              successCount++;
            } else {
              // Format: name, description (optional)
              const [name, description] = row;
              if (!name?.trim()) continue;

              const { error } = await supabase.from('operation_actes').insert({
                name: name.trim(),
                description: description?.trim() || null,
              });

              if (error) throw error;
              successCount++;
            }
          } catch (error: any) {
            errors.push(`Ligne ${i + 2}: ${error.message || 'Erreur inconnue'}`);
          }
        }

        setImportResult({ success: successCount, errors });
        
        if (successCount > 0) {
          toast({
            title: 'Import terminé',
            description: `${successCount} ${importType === 'doctors' ? 'docteur(s)' : 'opération(s)'} importé(s).`,
          });
          onImportComplete?.();
        }
      };
      reader.readAsText(file, 'UTF-8');
    } catch (error: any) {
      toast({
        title: 'Erreur d\'import',
        description: error.message || 'Impossible d\'importer le fichier.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getFormatHelp = () => {
    if (importType === 'doctors') {
      return {
        description: 'Le fichier CSV doit contenir les colonnes suivantes:',
        columns: ['nom_complet (obligatoire)', 'spécialité (optionnel)', 'archive_local (optionnel: true/false)'],
        example: 'Dr. Martin,Cardiologie,false\nDr. Dupont,Chirurgie,true'
      };
    }
    return {
      description: 'Le fichier CSV doit contenir les colonnes suivantes:',
      columns: ['nom (obligatoire)', 'description (optionnel)'],
      example: 'Appendicectomie,Ablation de l\'appendice\nCholécystectomie,Ablation de la vésicule'
    };
  };

  const formatHelp = getFormatHelp();

  return (
    <>
      <Button variant="outline" onClick={() => setShowDialog(true)} className="gap-2">
        <Upload className="w-4 h-4" />
        Importer CSV
      </Button>

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Importer des données</DialogTitle>
            <DialogDescription>
              Importez une liste de docteurs ou d'opérations depuis un fichier CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de données</Label>
              <Select 
                value={importType} 
                onValueChange={(v: 'doctors' | 'operations') => {
                  setImportType(v);
                  resetDialog();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctors">Docteurs</SelectItem>
                  <SelectItem value="operations">Opérations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-1">{formatHelp.description}</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  {formatHelp.columns.map((col, i) => (
                    <li key={i}>{col}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                  Exemple:<br />{formatHelp.example}
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="file">Fichier CSV</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
              />
            </div>

            {previewData.length > 0 && (
              <div className="space-y-2">
                <Label>Aperçu des données</Label>
                <div className="overflow-x-auto border rounded-lg max-h-48">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {previewData[0]?.map((cell, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium">
                            {cell || `Colonne ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(1).map((row, i) => (
                        <tr key={i} className="border-t">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{importResult.success} élément(s) importé(s)</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span>{importResult.errors.length} erreur(s)</span>
                    </div>
                    <ul className="text-xs text-destructive bg-destructive/10 p-2 rounded max-h-24 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Fermer
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || isImporting}
              className="gap-2"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DataImport;
