import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ArchiveExport = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Fetch all archives with related data
      const { data: archives, error } = await supabase
        .from('archives')
        .select(`
          id,
          archive_number,
          patient_full_name,
          patient_id,
          admission_id,
          year,
          notes,
          is_archived,
          created_at,
          doctor:doctors(full_name, specialty),
          operation:operation_actes(name),
          box:archive_boxes(name, shelf, column_position, side, box_number),
          files:archive_files(id, is_attached, file_type:file_types(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!archives || archives.length === 0) {
        toast({ title: 'Aucune archive', description: 'Il n\'y a pas d\'archives à exporter.', variant: 'destructive' });
        return;
      }

      // Fetch creator profiles
      const creatorIds = [...new Set(archives.map((a: any) => a.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', creatorIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // CSV Headers
      const headers = [
        'Numéro Archive',
        'Nom Patient',
        'ID Patient',
        'ID Admission',
        'Année',
        'Docteur',
        'Spécialité Docteur',
        'Opération',
        'Box',
        'Numéro Box',
        'Emplacement (Étagère)',
        'Emplacement (Colonne)',
        'Emplacement (Côté)',
        'Fichiers Attachés',
        'Total Fichiers',
        'Statut',
        'Notes',
        'Date de Création',
        'Créé Par'
      ];

      // Build CSV rows
      const rows = archives.map((archive: any) => {
        const files = archive.files || [];
        const attachedCount = files.filter((f: any) => f.is_attached).length;
        const filesList = files.map((f: any) => f.file_type?.name || 'Inconnu').join('; ');

        return [
          archive.archive_number || 'Local',
          archive.patient_full_name,
          archive.patient_id,
          archive.admission_id,
          archive.year,
          archive.doctor?.full_name || '',
          archive.doctor?.specialty || '',
          archive.operation?.name || '',
          archive.box?.name || '',
          archive.box?.box_number || '',
          archive.box?.shelf || '',
          archive.box?.column_position || '',
          archive.box?.side || '',
          `${attachedCount}/${files.length}`,
          files.length,
          archive.is_archived ? 'Archivé' : 'Non archivé',
          (archive.notes || '').replace(/[\r\n]+/g, ' '),
          format(new Date(archive.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
          profileMap.get(archive.created_by) || 'Inconnu'
        ];
      });

      // Create CSV content with BOM for Excel UTF-8 support
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        headers.join(';'),
        ...rows.map(row => row.map((cell: any) => {
          const value = String(cell ?? '');
          // Escape quotes and wrap in quotes if contains separator or quotes
          if (value.includes(';') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(';'))
      ].join('\r\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archives_export_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ 
        title: 'Export réussi', 
        description: `${archives.length} archives exportées avec succès.` 
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erreur d\'export',
        description: error.message || 'Impossible d\'exporter les archives.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport} 
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Exporter CSV
    </Button>
  );
};

export default ArchiveExport;
