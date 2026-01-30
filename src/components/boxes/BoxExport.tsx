import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

const BoxExport = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const { data: boxes, error } = await supabase
        .from('archive_boxes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (!boxes || boxes.length === 0) {
        toast({
          title: 'Aucune donnée',
          description: 'Aucune box à exporter',
          variant: 'destructive',
        });
        return;
      }

      // Create CSV content
      const headers = [
        'Nom',
        'Numéro',
        'Étagère',
        'Colonne',
        'Côté',
        'Capacité Max',
        'Occupées',
        'Disponibles',
        'Taux Occupation %',
        'Statut',
        'Date Création',
      ];

      const csvRows = boxes.map(box => {
        const occupancy = ((box.current_count / box.max_capacity) * 100).toFixed(1);
        const available = box.max_capacity - box.current_count;
        const status = box.status === 'sealed' ? 'Scellée' : 
                       box.current_count >= box.max_capacity ? 'Pleine' : 'Disponible';
        
        return [
          box.name,
          box.box_number || '',
          box.shelf,
          box.column_position,
          box.side === 'left' ? 'Gauche' : 'Droite',
          box.max_capacity,
          box.current_count,
          available,
          occupancy,
          status,
          new Date(box.created_at).toLocaleDateString('fr-FR'),
        ].map(value => `"${value}"`).join(',');
      });

      const csvContent = [headers.join(','), ...csvRows].join('\n');

      // Add BOM for Excel UTF-8 compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Download file
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inventaire-boxes-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: `${boxes.length} boxes exportées`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting} className="gap-2">
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      Exporter CSV
    </Button>
  );
};

export default BoxExport;
