import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import CapacityIndicator from '@/components/ui/CapacityIndicator';
import QRCodeGenerator from '@/components/boxes/QRCodeGenerator';
import BoxMovementHistory from '@/components/boxes/BoxMovementHistory';
import BoxExport from '@/components/boxes/BoxExport';
import { 
  Box, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  QrCode,
  MapPin,
  Loader2,
  Lock,
  Unlock,
  History,
  AlertTriangle
} from 'lucide-react';

interface ArchiveBox {
  id: string;
  name: string;
  box_number: number | null;
  max_capacity: number;
  current_count: number;
  shelf: string;
  column_position: string;
  side: string;
  qr_code: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
}

const BoxesPage = () => {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedBox, setSelectedBox] = useState<ArchiveBox | null>(null);
  const [editingBox, setEditingBox] = useState<ArchiveBox | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    maxCapacity: '50',
    shelf: '',
    columnPosition: '',
    side: 'left' as 'left' | 'right',
    status: 'available' as 'available' | 'full' | 'sealed',
  });

  useEffect(() => {
    fetchBoxes();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('boxes-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'archive_boxes' },
        () => fetchBoxes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Highlight and scroll to box if specified
    if (highlightId && boxes.length > 0) {
      const element = document.getElementById(`box-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 3000);
      }
    }
  }, [highlightId, boxes]);

  const fetchBoxes = async () => {
    try {
      const { data, error } = await supabase
        .from('archive_boxes')
        .select('*')
        .eq('is_active', true)
        .order('box_number', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setBoxes((data as ArchiveBox[]) || []);
    } catch (error) {
      console.error('Error fetching boxes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (box?: ArchiveBox) => {
    if (box) {
      setEditingBox(box);
      setFormData({
        name: box.name,
        maxCapacity: box.max_capacity.toString(),
        shelf: box.shelf,
        columnPosition: box.column_position,
        side: box.side as 'left' | 'right',
        status: box.status as 'available' | 'full' | 'sealed',
      });
    } else {
      setEditingBox(null);
      setFormData({
        name: '',
        maxCapacity: '50',
        shelf: '',
        columnPosition: '',
        side: 'left',
        status: 'available',
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' });
      return;
    }
    if (!formData.shelf.trim()) {
      toast({ title: 'Erreur', description: 'L\'étagère est requise', variant: 'destructive' });
      return;
    }
    if (!formData.columnPosition.trim()) {
      toast({ title: 'Erreur', description: 'La colonne est requise', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const oldLocation = editingBox ? `${editingBox.shelf}, ${editingBox.column_position} ${editingBox.side}` : null;
      const newLocation = `${formData.shelf.trim()}, ${formData.columnPosition.trim()} ${formData.side}`;
      
      let boxNumber: number | undefined;

      // Auto-assign box number for new boxes
      if (!editingBox) {
        const { data: maxBox } = await supabase
          .from('archive_boxes')
          .select('box_number')
          .not('box_number', 'is', null)
          .order('box_number', { ascending: false })
          .limit(1);

        boxNumber = (maxBox?.[0]?.box_number || 0) + 1;
      }

      const boxData = {
        name: formData.name.trim(),
        max_capacity: parseInt(formData.maxCapacity) || 50,
        shelf: formData.shelf.trim(),
        column_position: formData.columnPosition.trim(),
        side: formData.side,
        status: formData.status,
        ...(boxNumber !== undefined && { box_number: boxNumber }),
      };

      if (editingBox) {
        const { error } = await supabase
          .from('archive_boxes')
          .update(boxData)
          .eq('id', editingBox.id);

        if (error) throw error;

        // Log movement if location changed
        if (oldLocation !== newLocation && user) {
          await supabase.from('box_movements').insert({
            box_id: editingBox.id,
            action: 'moved',
            from_location: oldLocation,
            to_location: newLocation,
            performed_by: user.id,
          });
        }

        // Log status change
        if (editingBox.status !== formData.status && user) {
          await supabase.from('box_movements').insert({
            box_id: editingBox.id,
            action: 'status_changed',
            notes: `Statut changé: ${editingBox.status} → ${formData.status}`,
            performed_by: user.id,
          });
        }

        toast({ title: 'Box mise à jour', description: 'La box a été mise à jour.' });
      } else {
        const { data: newBox, error } = await supabase
          .from('archive_boxes')
          .insert(boxData)
          .select()
          .single();

        if (error) throw error;

        // Log creation
        if (newBox && user) {
          await supabase.from('box_movements').insert({
            box_id: newBox.id,
            action: 'created',
            to_location: newLocation,
            performed_by: user.id,
          });
        }

        toast({ title: 'Box créée', description: 'La nouvelle box a été créée.' });
      }

      setShowDialog(false);
      fetchBoxes();
    } catch (error: any) {
      console.error('Error saving box:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (box: ArchiveBox) => {
    if (box.current_count > 0) {
      toast({
        title: 'Impossible de supprimer',
        description: 'Cette box contient des archives. Retirez-les d\'abord.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${box.name}" ?`)) return;

    try {
      const { error } = await supabase
        .from('archive_boxes')
        .update({ is_active: false })
        .eq('id', box.id);

      if (error) throw error;
      toast({ title: 'Box supprimée', description: 'La box a été supprimée.' });
      fetchBoxes();
    } catch (error: any) {
      console.error('Error deleting box:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSeal = async (box: ArchiveBox) => {
    const newStatus = box.status === 'sealed' ? 'available' : 'sealed';
    const action = newStatus === 'sealed' ? 'sealed' : 'opened';

    try {
      const { error } = await supabase
        .from('archive_boxes')
        .update({ status: newStatus })
        .eq('id', box.id);

      if (error) throw error;

      // Log the action
      if (user) {
        await supabase.from('box_movements').insert({
          box_id: box.id,
          action: action,
          notes: newStatus === 'sealed' ? 'Box scellée' : 'Box descellée',
          performed_by: user.id,
        });
      }

      toast({ 
        title: newStatus === 'sealed' ? 'Box scellée' : 'Box descellée',
        description: newStatus === 'sealed' 
          ? 'La box a été scellée et ne peut plus recevoir d\'archives.'
          : 'La box a été descellée et peut recevoir des archives.'
      });
      fetchBoxes();
    } catch (error: any) {
      console.error('Error toggling seal:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors du changement de statut',
        variant: 'destructive',
      });
    }
  };

  const filteredBoxes = boxes.filter(box => {
    const matchesSearch = 
      box.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      box.shelf.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (box.box_number?.toString() || '').includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'available' && box.current_count < box.max_capacity && box.status !== 'sealed') ||
      (statusFilter === 'full' && box.current_count >= box.max_capacity) ||
      (statusFilter === 'sealed' && box.status === 'sealed') ||
      (statusFilter === 'almost_full' && box.current_count >= box.max_capacity * 0.8 && box.current_count < box.max_capacity);

    return matchesSearch && matchesStatus;
  });

  const getStatusClass = (box: ArchiveBox) => {
    if (box.status === 'sealed') return 'status-badge-info';
    const percentage = (box.current_count / box.max_capacity) * 100;
    if (percentage >= 100) return 'status-badge-danger';
    if (percentage >= 80) return 'status-badge-warning';
    return 'status-badge-success';
  };

  const getStatusLabel = (box: ArchiveBox) => {
    if (box.status === 'sealed') return 'Scellée';
    const percentage = (box.current_count / box.max_capacity) * 100;
    if (percentage >= 100) return 'Pleine';
    if (percentage >= 80) return 'Presque pleine';
    return 'Disponible';
  };

  const getStatusIcon = (box: ArchiveBox) => {
    if (box.status === 'sealed') return <Lock className="w-3 h-3" />;
    const percentage = (box.current_count / box.max_capacity) * 100;
    if (percentage >= 80) return <AlertTriangle className="w-3 h-3" />;
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des Boxes</h1>
            <p className="text-muted-foreground">
              Gérez les boxes d'archives et leur localisation
            </p>
          </div>
          <div className="flex gap-2">
            <BoxExport />
            {isAdmin && (
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle Box
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card-stats">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, numéro ou étagère..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="available">Disponibles</SelectItem>
                <SelectItem value="almost_full">Presque pleines</SelectItem>
                <SelectItem value="full">Pleines</SelectItem>
                <SelectItem value="sealed">Scellées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Boxes Grid */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : filteredBoxes.length === 0 ? (
          <div className="card-stats text-center py-12">
            <Box className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune box trouvée</p>
            {isAdmin && !searchQuery && statusFilter === 'all' && (
              <Button onClick={() => handleOpenDialog()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Créer la première box
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoxes.map((box) => (
              <div 
                key={box.id} 
                id={`box-${box.id}`}
                className={`card-stats transition-all duration-300 ${
                  box.status === 'sealed' ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      box.status === 'sealed' 
                        ? 'bg-info/10' 
                        : 'bg-primary/10'
                    }`}>
                      {box.status === 'sealed' ? (
                        <Lock className="w-5 h-5 text-info" />
                      ) : (
                        <Box className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{box.name}</h3>
                        {box.box_number && (
                          <span className="text-xs text-muted-foreground">#{box.box_number}</span>
                        )}
                      </div>
                      <span className={`status-badge ${getStatusClass(box)} gap-1`}>
                        {getStatusIcon(box)}
                        {getStatusLabel(box)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedBox(box);
                          setShowQRDialog(true);
                        }}
                        title="QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedBox(box);
                          setShowHistoryDialog(true);
                        }}
                        title="Historique"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleSeal(box)}
                        title={box.status === 'sealed' ? 'Desceller' : 'Sceller'}
                      >
                        {box.status === 'sealed' ? (
                          <Unlock className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(box)}
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(box)}
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <CapacityIndicator
                    current={box.current_count}
                    max={box.max_capacity}
                  />

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{box.shelf}, {box.column_position} ({box.side === 'left' ? 'Gauche' : 'Droite'})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingBox ? 'Modifier la Box' : 'Nouvelle Box'}
            </DialogTitle>
            <DialogDescription>
              {editingBox 
                ? 'Modifiez les détails de la box.'
                : 'Remplissez les informations pour créer une nouvelle box.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="boxName">Nom de la box *</Label>
              <Input
                id="boxName"
                placeholder="ex: Box A-001"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxCapacity">Capacité maximale</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="1"
                  placeholder="50"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'available' | 'full' | 'sealed') => 
                    setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="full">Pleine</SelectItem>
                    <SelectItem value="sealed">Scellée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf">Étagère *</Label>
                <Input
                  id="shelf"
                  placeholder="ex: Étagère A"
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="column">Colonne *</Label>
                <Input
                  id="column"
                  placeholder="ex: Colonne 2"
                  value={formData.columnPosition}
                  onChange={(e) => setFormData({ ...formData, columnPosition: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Côté *</Label>
              <Select
                value={formData.side}
                onValueChange={(value: 'left' | 'right') => 
                  setFormData({ ...formData, side: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Gauche</SelectItem>
                  <SelectItem value="right">Droite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingBox ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedBox?.name}</DialogTitle>
            <DialogDescription>
              Scannez ce code pour accéder rapidement à cette box.
            </DialogDescription>
          </DialogHeader>
          {selectedBox && (
            <div className="py-4">
              <QRCodeGenerator
                boxId={selectedBox.id}
                boxName={selectedBox.name}
                boxNumber={selectedBox.box_number}
                location={`${selectedBox.shelf}, ${selectedBox.column_position} ${selectedBox.side}`}
                size={200}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Historique - {selectedBox?.name}</DialogTitle>
            <DialogDescription>
              Historique des mouvements et changements de statut.
            </DialogDescription>
          </DialogHeader>
          {selectedBox && (
            <div className="py-4">
              <BoxMovementHistory boxId={selectedBox.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default BoxesPage;
